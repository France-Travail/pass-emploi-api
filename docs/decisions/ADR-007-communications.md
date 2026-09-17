# Communications : un message porté par le back, ciblé par population

* Statut : accepté, implémenté (conseillers, puis jeunes et envoi push)
* Date : 2026-09-16, complété le 2026-09-17
* Suite de [ADR-006](ADR-006-deploiements-fonctionnalites-migrations.md), section « Suite : communications »

Avant J d'un déploiement, on veut prévenir les utilisateurs : « le 15 octobre,
votre application évolue ». Aujourd'hui le back n'envoie qu'une date
(`dateDeMigration`) et le texte du bandeau est écrit en dur dans le web et
l'app. Chaque changement de formulation est une livraison front, et le texte ne
peut pas différer d'une population à l'autre. On déplace le message en base :
le back envoie titre et contenu, le front affiche.

## Décisions

1. **Une communication est rattachée à une population, pas à un déploiement.**
   Une campagne s'écrit une fois par population, quels que soient les
   déploiements qui la visent. L'appartenance à la population se lit avec les
   mêmes règles que pour les déploiements (`sqlConseillerDansPopulation`,
   `sqlJeuneDansPopulation`, ADR-006 § Règles).
2. **Deux énumérations et rien d'autre.** `destinataire` (`JEUNE` |
   `CONSEILLER`) dit à qui, `type` (`IN_APP` | `NOTIFICATION`) dit comment. Le
   reste est du contenu.
3. **Visible à partir d'une date, calculé à la lecture.** `date_debut <=
   maintenant`, serveur faisant autorité sur l'horloge, comme les
   déploiements. Pas d'état « active » stocké. `date_fin` (exclue) borne la
   fin de visibilité, mais son caractère obligatoire dépend du `type` — voir
   décision 10.
4. **Un seul message par lecture : le plus urgent.** Un utilisateur peut être
   dans plusieurs populations (l'union fait foi, ADR-006 scénario 3). Le front
   n'affiche qu'un bandeau, on renvoie la communication dont `date_fin` est la
   plus proche — l'équivalent du `MIN(date_activation)` de `dateDeMigration`.
   Une communication sans `date_fin` (visible indéfiniment) passe toujours
   après celles qui en ont une : elle n'est jamais urgente par définition
   (`ORDER BY date_fin ASC NULLS LAST`, comportement par défaut de Postgres,
   rendu explicite dans la requête).
5. **Le contenu est du texte brut.** Les sauts de ligne (`\n`) sont respectés
   par le front, rien d'autre n'est interprété. Pas de HTML : pas de
   sanitisation à faire, et le même texte sert au web et au mobile.
6. **L'id est technique.** `SERIAL`, renvoyé à la création comme pour les
   déploiements. Deux utilisateurs d'une même population reçoivent le même id ;
   le mobile s'en sert pour son état local, le web l'ignore.
7. **Supprimer une population emporte ses communications.** Contrairement à un
   déploiement, une communication n'a pas d'effet au-delà de sa population :
   la garder orpheline n'aurait pas de sens. FK en `ON DELETE CASCADE`, comme
   les cibles (emails, profils).
8. **Les handlers support écrivent en Sequelize direct**, le repository domaine
   ne sert qu'à la lecture côté client : [ADR-008](ADR-008-handlers-support-sql-direct.md).
9. **Le CTA se renseigne en entier ou pas du tout.** `ctaLabel`, `ctaUrlAndroid`
   et `ctaUrlIos` sont optionnels ensemble, jamais séparément : un lien de
   téléchargement sans les deux stores n'a pas de sens pour le mobile. Vérifié
   à la création (`Communication.creer`), donc aussi bien pour `POST` que pour
   `PUT` (même fonction).
10. **`NOTIFICATION` n'a pas de `date_fin`, `IN_APP` l'a en option.** Une fois
    une notification poussée, elle ne peut pas être rappelée : une échéance de
    visibilité n'a donc aucun sens pour ce `type`, `date_fin` y est **interdite**
    (`Communication.creer` la refuse). Le cron `NOTIFIER_COMMUNICATIONS` envoie
    dès qu'il voit `date_debut` atteinte et `envoyee_le` nul, **même après
    plusieurs jours de blocage du cron** : pas de garde-fou anti-retard, la
    seule protection est « un seul job `NOTIFIER_BENEFICIAIRES` actif à la
    fois » (pas d'envois simultanés qui se chevauchent). Pour `IN_APP`,
    `date_fin` reste optionnelle dans l'autre sens : absente, le bandeau est
    visible indéfiniment jusqu'à suppression manuelle (utile pour un message
    permanent, pas lié à une échéance connue à l'avance). `destinataire` est
    forcément `JEUNE` pour `NOTIFICATION` (pas de push aux conseillers) et
    `typeNotification` est **obligatoire, sans valeur par défaut** : il pilote
    le deeplink au clic, et rien ne dit que toutes les communications futures
    mèneront au même endroit.

## Modèle

```mermaid
erDiagram
    population { string id PK }
    communication { int id PK  string id_population FK  string destinataire "JEUNE | CONSEILLER"  string type "IN_APP | NOTIFICATION"  timestamptz date_debut  timestamptz date_fin "nul : indéfinie si IN_APP, toujours nulle si NOTIFICATION"  string titre  text contenu "texte brut, \n autorisé"  string cta_label "nul, les 3 champs cta ensemble ou aucun"  string cta_url_android "nul"  string cta_url_ios "nul"  string type_notification "nul, requis si NOTIFICATION"  timestamptz envoyee_le "nul, posé par NOTIFIER_COMMUNICATIONS" }
    population ||--o{ communication : ""
```

Contraintes en base : `date_debut < date_fin` (satisfaite d'office par
Postgres quand `date_fin` est `NULL`, donc pas de migration à part pour la
rendre optionnelle au-delà d'un `DROP NOT NULL`), FK `id_population` en
`ON DELETE CASCADE`. Pas d'unicité : deux campagnes sur une même population
sont légitimes (l'une après l'autre, ou l'une pour les jeunes et l'autre pour
les conseillers). Les règles sur le CTA, sur `type_notification` et sur la
présence de `date_fin` (tout-ou-rien, cohérence avec `type`/`destinataire`)
sont vérifiées dans `Communication.creer`, pas en `CHECK` SQL : elles sont
partagées par `POST` et `PUT`, donc plus simples à faire évoluer côté domaine
qu'en migration.

## Routes

### Support

Sous `X-API-KEY` support, dans le même groupe Swagger que les populations.

| Route | Corps | Retour |
|---|---|---|
| `POST /support/communications` | `{ idPopulation, destinataire, type, dateDebut, dateFin?, titre, contenu, ctaLabel?, ctaUrlAndroid?, ctaUrlIos?, typeNotification? }` | 201 `{ id }`. 404 population inconnue, 400 si `dateDebut >= dateFin` (quand fournie), date invalide, CTA partiel, ou règles `NOTIFICATION` (voir décision 10, `dateFin` y compris) non respectées. Pas d'upsert. |
| `PUT /support/communications/:id` | mêmes champs que la création | 204. Remplace tout le contenu (un champ absent, un CTA ou `dateFin` compris, est effacé) sauf `envoyee_le`, jamais touché par un `PUT`. 404 communication ou population inconnue, 400 dates/CTA/`NOTIFICATION`. |
| `DELETE /support/communications/:id` | | 204. 404 sinon. |
| `GET /support/populations/:id` | | ajoute `communications: [{ id, destinataire, type, dateDebut, dateFin?, titre, contenu, ctaLabel?, ctaUrlAndroid?, ctaUrlIos?, typeNotification?, envoyeeLe? }]`. |
| `DELETE /support/populations/:id` | | supprime aussi ses communications (toujours 400 si un déploiement la vise). |

### Clients

| Route | Retour |
|---|---|
| `GET /conseillers/:id/communications` | 200 `{ messageInformatif?: { id, titre, contenu } }`. La communication `CONSEILLER` × `IN_APP` visible maintenant dont `date_fin` est la plus proche ; `messageInformatif` absent s'il n'y en a pas. Autorisation : le conseiller lui-même, `DISPOSITIFS_ACCOMPAGNES`. |
| `GET /jeunes/:id/communications` | 200 `{ messageInformatif?: { id, titre, contenu, cta?: { label, urlAndroid, urlIos } } }`. Même lecture côté jeune (`JEUNE` × `IN_APP`, `sqlJeuneDansPopulation`) ; `cta` absent si la communication n'en a pas. Autorisation : le jeune lui-même, tous profils sauf invité. |
| `GET /conseillers/:id` | `dateDeMigration` inchangé (l'app mobile et l'accueil FT s'en servent encore). Le web ne le lit plus. |

## Scénario

```
POST /support/populations         { "id": "PHASE_C" }
POST /support/populations/profils { "id": "PHASE_C", "structure": "FRANCE_TRAVAIL", "dispositif": "AIJ" }
POST /support/deploiements        { "nature": "MIGRATION", "idPopulation": "PHASE_C", "dateActivation": "2026-10-15T00:00:00Z" }
POST /support/communications      { "idPopulation": "PHASE_C", "destinataire": "CONSEILLER", "type": "IN_APP",
                                    "dateDebut": "2026-09-30T00:00:00Z", "dateFin": "2026-10-15T00:00:00Z",
                                    "titre": "Votre application évolue",
                                    "contenu": "Le 15 octobre 2026, l’application pass emploi ne sera plus disponible. Vos services seront accessibles sur l’application Parcours Emploi.\nNous vous recommandons de ne plus ajouter de nouveaux bénéficiaires à votre portefeuille." }
                                                                                                    → 201 { "id": 3 }
```

| Date | `GET /conseillers/:id/communications` pour un conseiller FT AIJ |
|---|---|
| Avant le 30 septembre | `{}` |
| Du 30 septembre au 14 octobre | `{ "messageInformatif": { "id": 3, "titre": "Votre application évolue", "contenu": "…" } }` |
| À partir du 15 octobre | `{}` — et la connexion est refusée par le déploiement `MIGRATION`. |

Même population, communication `NOTIFICATION` cette fois (une notification
push, en plus du bandeau `IN_APP` ci-dessus) — pas de `dateFin`, interdite
pour ce `type` :

```
POST /support/communications      { "idPopulation": "PHASE_C", "destinataire": "JEUNE", "type": "NOTIFICATION",
                                    "dateDebut": "2026-09-30T00:00:00Z",
                                    "titre": "Votre appli évolue", "contenu": "Téléchargez Parcours Emploi",
                                    "typeNotification": "MIGRATION_PARCOURS_EMPLOI" }
                                                                                                    → 201 { "id": 4 }
```

Le 30 septembre à 9h, `NOTIFIER_COMMUNICATIONS` trouve la communication 4
(`date_debut` atteinte, `envoyee_le` nul), enfile `NOTIFIER_BENEFICIAIRES`
pour `PHASE_C` et pose `envoyee_le`. Les jours suivants, le cron l'ignore —
non plus à cause d'une échéance dépassée (il n'y en a pas), mais parce que
`envoyee_le` n'est plus nul.

Autre cas : un bandeau permanent, sans échéance connue, qu'on retirera à la
main quand il ne sera plus pertinent — `dateFin` simplement omise :

```
POST /support/communications      { "idPopulation": "PILOTE_1J1S", "destinataire": "CONSEILLER", "type": "IN_APP",
                                    "dateDebut": "2026-09-01T00:00:00Z",
                                    "titre": "Vous testez la nouvelle fonctionnalité 1J1S",
                                    "contenu": "Un retour ? Écrivez-nous à support@pass-emploi.fr" }
                                                                                                    → 201 { "id": 5 }
```

Visible dès le 1ᵉʳ septembre, sans jamais disparaître d'elle-même.

## Livraison

**Première étape** (PR `feat/communications`) : table complète, routes
support, route conseiller, bandeau web. Le web abandonne `dateDeMigration` et
affiche `titre` / `contenu` tels quels.

**Deuxième étape** (PR `feat/communications-beneficiaires`) : côté jeune.
`GET /jeunes/:id/communications` avec CTA ; colonnes `type_notification` et
`envoyee_le` ; règles CTA tout-ou-rien, `NOTIFICATION` et `date_fin`
optionnelle/interdite selon `type` dans `Communication.creer` ; cron
`NOTIFIER_COMMUNICATIONS`. Reste à faire côté mobile : consommer la route et
afficher le bandeau + CTA.

Hors de cette ADR :

* `cta_url_web` si le web doit un jour afficher un lien.
* L'optimisation du batching de `NOTIFIER_BENEFICIAIRES` (taille de lot non
  plafonnée par défaut, cadence) et une route support de prévisualisation
  d'une population (stats + liste conseillers/jeunes avant un envoi) sont des
  sujets transverses au ciblage par population, pas spécifiques aux
  communications — suivis à part.

## Points ouverts

1. **Push sans deeplink, côté mobile.** `typeNotification` est obligatoire
   (décision 10) : il n'existe pas de valeur « n'ouvre rien » ou « ouvre
   l'accueil ». Si un besoin de ce type se présente, il faudra soit réutiliser
   un type existant à cet effet, soit en créer un côté app — pas une décision
   à prendre côté API seule.

## Liens

* [ADR-006](ADR-006-deploiements-fonctionnalites-migrations.md) : populations
  et déploiements, règles d'appartenance.
* `src/domain/communication.ts`,
  `src/infrastructure/repositories/communication.repository.db.ts`,
  `src/infrastructure/repositories/sql-helpers.ts` (appartenance).
