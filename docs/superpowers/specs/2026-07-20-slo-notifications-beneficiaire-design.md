# Notifications bénéficiaire — scénarios et catalogue de SLO

> Statut : proposition à valider par le métier. Complément au catalogue de SLO parcours
> ([`2026-07-20-slo-catalogue-beneficiaire-design.md`](./2026-07-20-slo-catalogue-beneficiaire-design.md)),
> centré sur les notifications push envoyées aux bénéficiaires : quand, pourquoi, par quel
> mécanisme, et quelles SLO on peut en dériver.

## 1. Objectif et périmètre

Deux objectifs :

1. **Recenser tous les scénarios** dans lesquels un bénéficiaire reçoit une notification push
   (le déclencheur, le mécanisme, le calendrier).
2. Déterminer **quelles SLO sont dérivables** de ces scénarios, en distinguant ce qui est
   mesurable aujourd'hui de ce qui nécessite d'abord une instrumentation.

**Constat structurant (voir §2.3)** : contrairement aux parcours synchrones — où l'APM fournit
déjà latence et taux d'erreur exploitables — la chaîne de notification **ne mesure pas la
livraison réelle**. Les échecs d'envoi Firebase sont avalés, Matomo compte les tentatives et
non les livraisons, et rien ne trace la réception côté appareil. Le SLI le plus important d'une
notification (a-t-elle été livrée à temps ?) n'est donc **pas observable en l'état**. Ce
document propose des SLO en marquant explicitement, pour chaque indicateur, s'il est mesurable
aujourd'hui ou s'il constitue un prérequis d'instrumentation.

**Périmètre couvert** : les notifications **push** envoyées aux **bénéficiaires (jeunes)** par
les parcours déjà en production.

**Explicitement hors périmètre** :

- Les **emails conseiller** (les conseillers ne reçoivent pas de push ; ex. cron
  `MAIL_CONSEILLER_MESSAGES`, `envoyer-emails-messages-conseillers.job.handler.ts`).
- La messagerie **temps réel** elle-même (portée par Firebase directement entre clients ;
  l'API n'intervient que pour déclencher la notification d'un nouveau message).
- Les notifications des **features futures** (mode invité étendu, plan d'action, onboarding) —
  non spécifiées, donc non chiffrables.

## 2. État des lieux

### 2.1 Comment une notification est construite et envoyée

- Domaine : `src/domain/notification/notification.ts` — namespace `Notification` avec l'enum
  `Notification.Type` (le catalogue, §4), l'interface `Notification.Repository.send(...)`, le
  service `Notification.Service` (méthodes `notifier*` qui vérifient token + préférence puis
  construisent le message), et les builders (`creerNotificationRappelRdv`, etc.).
- Repository : `src/infrastructure/repositories/notification-firebase.repository.db.ts`.
  `send(message, idJeune?, pushNotification = true)` :
  - si `pushNotification` : appelle `firebaseClient.send(...)` **et**
    `matomoClient.trackEventPushNotificationEnvoyee(...)` ;
  - si `idJeune` fourni : écrit une ligne dans `notification_jeune` (centre de notifications
    in-app), indépendamment du push. Les erreurs de persistance sont seulement loggées.
- Client FCM : `src/infrastructure/clients/firebase-client.ts`. `send()` appelle
  `messaging.send(tokenMessage)` — **un token à la fois** (pas de multicast/batch).
- Token push : colonne `push_notification_token` sur la table `jeune`
  (`jeune.sql-model.ts`), renseignée par
  `update-jeune-configuration-application.command.handler.ts`.

### 2.2 Préférences / opt-out

Flags booléens par bénéficiaire (`configuration-application.ts`, défaut tous à `true`) :

| Préférence | Ce qu'elle gate |
|---|---|
| `alertesOffres` | `NOUVELLE_OFFRE` |
| `messages` | `NEW_MESSAGE` |
| `creationActionConseiller` | `NEW_ACTION` |
| `rendezVousSessions` | RDV + inscription/modif/désinscription session (envoi immédiat) |
| `rappelActions` | rappel action (job) |
| `actualitesMilo` | `NEW_ACTU` : ne bloque pas l'envoi, bascule seulement en « centre de notifs sans push » |

**Écarts connus** (préférences ignorées) : le job de **rappel RDV**
(`notifier-rappel-rendez-vous.job.handler.ts`) ne vérifie que le token, pas
`rendezVousSessions` ; et tous les broadcasts (actualisation, campagne, bonne alternance,
rappels de création, 0 heures, notifier-bénéficiaires) ne filtrent que sur la présence d'un
token. Ces écarts sont à trancher avant d'engager une SLO qui suppose le respect des
préférences.

### 2.3 Observabilité — ce qui est mesurable, ce qui ne l'est pas

**Mesurable aujourd'hui :**

- **`SuiviJob`** : chaque job d'envoi (broadcast/cron/rappel) retourne un résultat avec
  `nbErreurs`, `succes` et un `resultat` par job (`nbEnvoyees`, `nbNotifsEnvoyees`,
  `nbPersonnesNotifiees`…). Le cron `MONITORER_JOBS` (quotidien 9h45) les surveille. →
  permet de savoir si **le job a tourné et s'est terminé sans planter**.
- **Matomo** : `trackEventPushNotificationEnvoyee` émis à chaque `send` (par type). ⚠️ compte
  les **tentatives**, pas les livraisons — émis même si l'envoi FCM échoue ensuite.
- **`notification_jeune`** : registre des notifications *voulues* (type/titre/date), pas des
  livraisons.
- **APM** : `FirebaseClient.send` remonte les erreurs FCM non liées au token via
  `captureError`.

**NON mesurable aujourd'hui (prérequis d'instrumentation) :**

- **Taux de livraison réel** : les échecs `messaging.send()` sont loggés/APM mais **jamais
  comptés par type** ni réinjectés dans Matomo ou la base. Un push échoué produit quand même
  un événement Matomo « envoyée » et une ligne `notification_jeune`.
- **Nettoyage des tokens invalides** : `registration-token-not-registered` est seulement
  loggé en warn ; le token périmé n'est jamais retiré du bénéficiaire → il est retenté à
  chaque notification suivante.
- **Retry** : aucun sur l'envoi FCM.
- **Ponctualité réelle** : aucun horodatage « moment d'envoi vs moment prévu/déclencheur »
  n'est conservé, donc le délai déclencheur → push n'est pas mesuré.
- **Réception / ouverture** : aucun accusé de réception FCM ni label analytics consommé.

## 3. Les 5 familles de déclenchement

Le mécanisme de déclenchement — plus que le type — détermine quels SLI ont du sens. D'où ce
regroupement en 5 familles.

### Famille 1 — Envoi immédiat sur action (synchrone)

Déclenché dans un command handler, juste après une action conseiller (ou une auto-action du
bénéficiaire). Attendu : push quasi immédiat.

| Type | Déclencheur | Fichier |
|---|---|---|
| `NEW_RENDEZVOUS` / `UPDATED` / `CANCELED` / `DELETED_RENDEZVOUS` | Conseiller crée/modifie/annule un RDV | `create-/update-/delete-rendez-vous.command.handler` |
| `NEW_ACTION` | Conseiller crée une action | `create-action.command.handler.ts` |
| `DETAIL_ACTION` | Conseiller commente une action | `add-commentaire-action.command.handler.ts` |
| `NEW_MESSAGE` (groupe) | Conseiller envoie un message de groupe | `envoyer-message-groupe.command.handler.ts` |
| `DETAIL_SESSION_MILO` / `DELETED_SESSION_MILO` | Inscription / auto-inscription / désinscription session | `update-session-milo`, `autoinscrire-beneficiaire-session-milo` |
| `NOUVELLE_OFFRE` (immersion) | Appel API déclenchant de nouvelles immersions | `notifier-nouvelles-immersions.command.handler.ts` |

### Famille 2 — Event externe via polling / queue (asynchrone)

Déclenché par l'ingestion d'un événement d'un partenaire externe. Le délai déclencheur → push
est borné par la fréquence de polling.

| Type | Déclencheur | Fréquence | Fichier |
|---|---|---|---|
| RDV/session (MILO) | File d'événements MILO | poll toutes les **15 min** (`SUIVRE_FILE_EVENEMENTS_MILO`) → jobs `TRAITER_EVENEMENT_MILO` | `suivre-file-evenements-milo`, `traiter-evenement-milo.job.handler.ts` |
| RDV (France Travail) | Poll de l'API notifications PE | toutes les **2 h** (`NOTIFIER_RENDEZVOUS_PE`) | `notifier-rendez-vous-pole-emploi.job.handler.ts` |

### Famille 3 — Rappels programmés (job différé)

Job Bull différé planifié à la création de l'objet, re-planifié/annulé si l'objet change.

| Type | Échéance | Fichier |
|---|---|---|
| `RAPPEL_RENDEZVOUS` | J-7 et J-1 avant le RDV | `notifier-rappel-rendez-vous.job.handler.ts` |
| `DETAIL_SESSION_MILO` (rappel) | J-7 et J-1 avant la session | `notifier-rappel-instance-session-milo.job.handler.ts` |
| `DETAIL_ACTION` (rappel) | J-3 avant l'échéance de l'action | `notifier-rappel-action.job.handler.ts` |

### Famille 4 — Broadcast récurrent (cron)

Cron planifié (`listeCronJobs`, `planificateur.ts`), cible une population selon la structure.

| Type | Calendrier | Fichier |
|---|---|---|
| `ACTUALISATION_PE` | 7 du mois, 8h | `notifier-actualisation.job.handler.db.ts` |
| `NOUVELLE_OFFRE` (emploi) | quotidien 9h | `notifier-recherches-offre-emploi.job.handler.ts` |
| `NOUVELLE_OFFRE` (service civique) | quotidien 11h | `notifier-recherches-service-civique.job.handler.ts` |
| `RAPPEL_CREATION_ACTION` / `RAPPEL_CREATION_DEMARCHE` | jeudi 10h | `notifier-rappel-creation-actions-demarches.job.handler.db.ts` |
| `RAPPEL_CREATION_ACTION` (0 heures) | lundi 16h | `notifier-0-heures-declarees.job.handler.db.ts` |
| `NEW_ACTU` | à la publication d'une actualité MILO (job re-queué par lots de 100) | `notifier-nouvelle-actualite-milo.job.handler.db.ts` |

### Famille 5 — Broadcast manuel (déclenché à la demande)

Lancé via un endpoint support / une création métier. Job auto-paginé avec pacing entre lots.

| Type | Déclencheur | Fichier |
|---|---|---|
| `CAMPAGNE` | Création d'une campagne de satisfaction (+ rappel J+7) | `notifier-campagne.job.handler.db.ts`, `create-campagne.command.handler.ts` |
| `LA_BONNE_ALTERNANCE` | Broadcast ad-hoc (lots de 2000) | `notifier-bonne-alternance.job.handler.db.ts` |
| `TypeNotifManuelle` (`BENEVOLAT`, `EVENT_LIST`, `MON_SUIVI`, `NOUVELLES_FONCTIONNALITES`, `OFFRES_ENREGISTREES`, `OUTILS`, `RECHERCHE`, `SAVED_SEARCHES`, `MIGRATION_PARCOURS_EMPLOI`, `CENTRE_DE_NOTIFS_UNIQUEMENT`) | Broadcast manuel via `support.controller.ts` | `notifier-beneficiaires.command.handler.ts` + `.job.handler.db.ts` |

> `CENTRE_DE_NOTIFS_UNIQUEMENT` est interdit au push (store-only) — il ne relève d'aucune SLO
> de livraison push.

## 4. Table de correspondance type → famille

| Type | Famille |
|---|---|
| `NEW_RENDEZVOUS`, `UPDATED_RENDEZVOUS`, `CANCELED_RENDEZVOUS`, `DELETED_RENDEZVOUS` | 1 (conseiller) / 2 (MILO, FT) |
| `NEW_ACTION`, `DETAIL_ACTION` (commentaire) | 1 |
| `NEW_MESSAGE` | 1 (groupe) / voir note messagerie |
| `DETAIL_SESSION_MILO`, `DELETED_SESSION_MILO` | 1 (inscription) / 2 (modif MILO) / 3 (rappel) |
| `NOUVELLE_OFFRE` | 1 (immersion) / 4 (emploi, service civique) |
| `RAPPEL_RENDEZVOUS` | 3 |
| `DETAIL_ACTION` (rappel J-3) | 3 |
| `NEW_ACTU` | 4 |
| `ACTUALISATION_PE`, `RAPPEL_CREATION_ACTION`, `RAPPEL_CREATION_DEMARCHE` | 4 |
| `CAMPAGNE`, `LA_BONNE_ALTERNANCE` | 5 |
| `BENEVOLAT`, `EVENT_LIST`, `MON_SUIVI`, `NOUVELLES_FONCTIONNALITES`, `OFFRES_ENREGISTREES`, `OUTILS`, `RECHERCHE`, `SAVED_SEARCHES`, `MIGRATION_PARCOURS_EMPLOI` | 5 |
| `CENTRE_DE_NOTIFS_UNIQUEMENT` | store-only (pas de push) |

## 5. Catalogue de SLO par famille

Convention : fenêtre glissante 28 jours + budget d'erreur (comme le catalogue parcours).
Cibles **indicatives**, à recalibrer avec les données réelles. Colonne « Mesurable ? » :
✅ dès aujourd'hui · ⚠️ partiel · ❌ nécessite instrumentation (voir §2.3).

### Famille 1 — Envoi immédiat sur action

| SLI | Mesurable ? | Cible indicative | Note |
|---|---|---|---|
| Latence déclencheur → tentative d'envoi | ❌ (pas d'horodatage relatif) | p95 < 30 s | l'envoi est synchrone dans le handler ; APM donne la latence du handler mais pas le délai jusqu'au push |
| Taux de tentative d'envoi (le handler a bien appelé `send`) | ⚠️ Matomo (tentatives) | 99.5 % | |
| Taux de livraison FCM réel | ❌ | 98 % (aspirationnel) | prérequis : compter les retours FCM par type |
| Respect des préférences | ✅ (gate en place pour cette famille) | — | famille 1 vérifie bien les préférences |

### Famille 2 — Event externe via polling / queue

| SLI | Mesurable ? | Cible indicative | Note |
|---|---|---|---|
| Fraîcheur (event externe → push) | ⚠️ bornée par le poll | MILO < 20 min · FT < 2h30 | borne = intervalle de poll (15 min / 2 h) + temps de traitement |
| Complétude du poll (le cron a tourné) | ✅ `SuiviJob` / `MONITORER_JOBS` | 99 % des exécutions planifiées | |
| Taux d'erreur d'ingestion partenaire | ⚠️ `SuiviJob.nbErreurs` | < 2 % | erreur MILO/FT distincte d'un bug interne |
| Taux de livraison FCM réel | ❌ | 98 % (aspirationnel) | |

### Famille 3 — Rappels programmés

| SLI | Mesurable ? | Cible indicative | Note |
|---|---|---|---|
| Ponctualité (envoi dans la fenêtre prévue, ex. ±1 h du créneau J-1) | ❌ | 95 % dans la fenêtre | `SuiviJob` donne un retour par bénéficiaire (`notificationEnvoyee`) mais pas l'écart temporel |
| Complétude (part des rappels dûs effectivement tentés) | ⚠️ (numérateur oui, dénominateur non instrumenté) | 99 % | |
| Taux de livraison FCM réel | ❌ | 98 % (aspirationnel) | prérequis : retours FCM + nettoyage tokens |
| Respect des préférences | écart connu | — | le rappel RDV **ne vérifie pas** `rendezVousSessions` → à corriger avant d'engager la SLO |

### Famille 4 — Broadcast récurrent (cron)

| SLI | Mesurable ? | Cible indicative | Note |
|---|---|---|---|
| Ponctualité du cron (démarré à l'heure planifiée) | ✅ `SuiviJob` / `MONITORER_JOBS` | 99 % | |
| Complétude (le job a terminé toute sa population sans planter) | ✅ `SuiviJob` (offset/pagination) | 99 % | broadcasts auto-paginés |
| Couverture (part des bénéficiaires éligibles réellement notifiés) | ⚠️ compteurs job vs population éligible non systématisée | 98 % | |
| Taux de livraison FCM réel | ❌ | 97 % (aspirationnel) | volume élevé → sensibilité aux tokens périmés |

### Famille 5 — Broadcast manuel

| SLI | Mesurable ? | Cible indicative | Note |
|---|---|---|---|
| Achèvement du broadcast (job terminé sans plantage) | ✅ `SuiviJob` | 99 % | |
| Débit / respect du pacing (pas de saturation FCM ni du quota) | ⚠️ pacing en dur (`setTimeout`), pas de métrique de débit | — | 150–500 ms entre lots selon le job |
| Concurrence (pas de double lancement) | ✅ garde en place (`NOTIFIER_BENEFICIAIRES`) | — | |
| Taux de livraison FCM réel | ❌ | 97 % (aspirationnel) | |

## 6. SLI transverses (toutes familles)

- **Taux de livraison FCM par type** ❌ — le SLI le plus important, non mesurable aujourd'hui.
  Prérequis commun à toutes les familles.
- **Taux de tokens invalides / périmés** ❌ — aujourd'hui jamais nettoyés ; un stock croissant
  de tokens morts dégrade mécaniquement tout taux de livraison réel une fois qu'on le mesurera.
- **Disponibilité du dépendant Firebase** — hors contrôle direct de l'équipe (SLA Firebase),
  à mentionner comme borne externe du budget d'erreur des SLI de livraison.

## 7. Questions ouvertes pour le métier

1. **Priorité d'instrumentation** : le taux de livraison réel est le SLI le plus parlant mais
   n'existe pas encore. Faut-il conditionner toute SLO de notification à sa mise en place, ou
   démarrer avec les SLI « job » mesurables aujourd'hui (familles 4/5) ?
2. **Criticité par famille** : une notification immédiate ratée (nouveau RDV) et un broadcast
   marketing raté n'ont pas le même impact bénéficiaire. Quels budgets d'erreur différenciés ?
3. **Fenêtre de ponctualité acceptable** (famille 3) : ±1 h pour un rappel J-1 est-il un bon
   défaut, ou le métier attend-il plus serré / plus lâche ?
4. **Écarts de respect des préférences** (§2.2) : à corriger avant d'engager une SLO qui
   suppose l'opt-out honoré (rappel RDV, broadcasts) — décision produit + technique.
5. **Fraîcheur famille 2** : un délai jusqu'à 2h30 sur un RDV France Travail est-il acceptable,
   ou faut-il resserrer la fréquence de poll (impact quota partenaire) ?

## 8. Prochaines étapes

1. Validation de ce catalogue avec le métier (familles, criticité, ponctualité, fraîcheur).
2. **Plan d'instrumentation notifications** (spec dédiée) : comptage des retours FCM par type,
   nettoyage des tokens invalides, horodatage déclencheur → envoi pour la ponctualité. C'est le
   prérequis des SLI marqués ❌ — probablement à fusionner avec le plan d'instrumentation
   général évoqué dans le catalogue parcours.
3. Recalibrage des cibles indicatives une fois la donnée disponible.
4. Prise en compte des notifications des features futures (invité, plan d'action) quand elles
   seront spécifiées.