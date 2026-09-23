# Catalogue de SLO — parcours bénéficiaire

> Statut : proposition à valider par le métier. Issu de la demande de préparer des tests de
> perf et des scénarios de charge en vue de l'élargissement de l'application à un public
> invité (onboarding + plan d'action + recherche d'offres/événements) et à un public
> connecté (tout ce qui précède + suivi + messagerie).

## 1. Objectif et périmètre

Ce document a deux objectifs :

1. Donner un **état des lieux factuel** de ce qui existe aujourd'hui en matière de mesure
   (monitoring, alerting) sur l'API.
2. Proposer un **catalogue de SLO par parcours bénéficiaire**, avec des cibles indicatives,
   à faire valider par le métier avant d'être considérées comme engageantes.

**Périmètre couvert** : les parcours bénéficiaire (app mobile) **déjà en production**
aujourd'hui : authentification, recherche d'offres, consultation d'événements, favoris,
suivi (actions + rendez-vous), messagerie.

**Explicitement hors périmètre de ce document** :

- Les parcours côté conseiller (web) — non demandés, à traiter séparément si besoin.
- Les features pas encore construites : onboarding QCM, plan d'action (jeune connecté
  et invité), extension du périmètre invité aux offres/événements. Voir §5 et le design
  [`2026-07-03-mode-invite-design.md`](./2026-07-03-mode-invite-design.md) — seule
  l'authentification invité y est implémentée à date (commit `549fd373`), le reste
  (QCM, plan d'action, mémos, migration) reste à spécifier et construire. On ne peut pas
  fixer de cible chiffrée réaliste sur une feature dont le comportement n'est pas défini.
- Les scénarios de test de charge concrets (outillage, jeux de données, seuils de rupture) :
  spec séparée, à construire une fois ce catalogue validé — c'est lui qui doit en fixer
  les objectifs.
- Le plan d'instrumentation (métriques à créer pour mesurer ce qui manque aujourd'hui) :
  spec séparée, également dépendante de ce catalogue.

## 2. État des lieux — monitoring actuel

### 2.1 Outillage en place

- **Elastic APM** (`elastic-apm-node@3.52.2`) est le seul outil de monitoring applicatif.
  Initialisé dans `src/infrastructure/monitoring/apm.init.ts`, `transactionSampleRate`
  à 0.5 par défaut. Chaque handler CQRS (command/query/job) est automatiquement instrumenté
  en transaction APM (`building-blocks/types/{command,query,job}-handler.ts`), avec des
  spans manuels sur les clients externes (France Travail, MILO, Firebase, Matomo).
- Un tracking du temps d'attente en queue des jobs Bull existe
  (`infrastructure/middlewares/queue-time.middleware.ts`,
  `infrastructure/monitoring/worker.tracking.service.ts`), mais c'est un suivi opérationnel
  des jobs, pas une métrique de SLO exposée.
- **Pas de Prometheus, statsd ou OpenTelemetry.** La config APM ignore une route `/metrics`
  (`transactionIgnoreUrls: ['/metrics']`) mais aucune route de ce nom n'est implémentée —
  probablement une réservation jamais utilisée.
- **Analytics métier** (Matomo + `EvenementService`) existe mais répond à un besoin produit
  (usage, funnels), pas à un besoin de fiabilité/performance.

### 2.2 Alertes existantes

Quatre alertes de **disponibilité binaire** (service up/down), via Elastic Heartbeat +
règles Kibana, décrites dans `docs/decoupage.md` :

| # | Alerte | Déclencheur |
|---|---|---|
| 1 | API web down | `/health` KO sur 3 checks (~2 min) |
| 2 | Connect down | `/health` KO sur 3 checks (Connect = service d'auth séparé) |
| 3 | Front web down | `/api/health` KO sur 3 checks |
| 4 | Worker mort | `/health/worker` en 503 (dead man's switch, 45 min sans job) |

Ce sont des alertes **binaires infra** (le service répond-il), pas des SLO produit par
parcours (le parcours fonctionne-t-il correctement, avec quelle latence, pour combien
d'utilisateurs).

### 2.3 Ce qui manque

- **Aucune SLO ni SLA formalisée.** Aucun document de référence, aucun objectif chiffré
  validé avec le métier avant ce document.
- **Aucun test de charge.** Pas de k6/artillery/autocannon dans le repo, aucun job de perf
  en CI (`.github/workflows/` ne contient que lint/test/sécurité).
- **Pas de distinction erreur technique / erreur métier** dans les métriques actuelles :
  APM capture les erreurs 5xx et exceptions, mais ne distingue pas, par exemple, un bug
  interne d'un timeout du partenaire France Travail.
- **Pas de mesure de fraîcheur des données** synchronisées depuis les partenaires
  externes (offres France Travail, événements FT/MILO).
- **Pas de dashboard par parcours** : APM donne une vue par transaction/endpoint technique,
  pas une vue agrégée par parcours utilisateur.

## 3. Méthodologie

### 3.1 Fenêtre et budget d'erreur

Convention SRE standard : chaque cible de disponibilité et de latence est évaluée sur une
**fenêtre glissante de 28 jours**, avec un **budget d'erreur** explicite qui en découle
(ex. 99.5 % de disponibilité = 3h22 d'indisponibilité tolérée sur 28 jours). Ce budget sert
de langage commun avec le métier pour arbitrer entre vitesse de livraison et fiabilité.

### 3.2 Types de SLI retenus

| Type de SLI | Ce qu'il mesure | Dépendance actuelle |
|---|---|---|
| **Disponibilité** | % de requêtes réussies (hors 5xx / timeout) sur la fenêtre | Dérivable des transactions APM existantes |
| **Latence (p95 / p99)** | Temps de réponse perçu par le bénéficiaire | Dérivable des transactions APM existantes |
| **Taux d'erreur métier** | Échecs dus à une dépendance externe (FT, MILO) plutôt qu'à un bug de l'API | **Non mesuré aujourd'hui** — nécessite d'étiqueter les erreurs par origine |
| **Fraîcheur des données** | Délai entre mise à jour côté partenaire et visibilité côté bénéficiaire | **Non mesuré aujourd'hui** — n'a de sens que pour les parcours qui synchronisent des données externes |

Tous les parcours n'ont pas les quatre types de SLI — voir le détail par parcours en §4.

### 3.3 Comment lire les cibles de ce document

Les cibles chiffrées ci-dessous sont **indicatives**, dérivées de standards du secteur pour
des API REST comparables (pas de données réelles de prod, faute d'accès direct à Kibana/APM
depuis cet environnement de travail). Elles doivent être **recalibrées avec les données
APM réelles** avant validation finale avec le métier — voir §6.

## 4. Catalogue par parcours

### 4.1 Authentification / connexion

Contrôleur : `authentification.controller.ts`. Dépend de **pass-emploi-connect**
(serveur OIDC séparé) qui fédère les IdP externes (France Travail, MILO, Conseil
départemental) — une partie du budget d'erreur de ce parcours est donc hors du contrôle
direct de pass-emploi-api.

| SLI | Cible indicative | Note |
|---|---|---|
| Disponibilité | 99.5 % | budget d'erreur ≈ 3h22 / 28j |
| Latence p95 | < 500 ms | hors temps de fédération IdP externe |
| Latence p99 | < 1.5 s | |
| Taux d'erreur métier | < 1 % | ex. IdP externe (MILO/FT) indisponible, distinct d'un bug interne |
| Fraîcheur des données | N/A | ne s'applique pas à ce parcours |

### 4.2 Recherche d'offres (emploi / immersion / service civique)

Contrôleurs : `offres-emploi.controller.ts`, `offres-immersion.controller.ts`,
`services-civique.controller.ts`, `recherches-jeunes.controller.ts` (recherches
sauvegardées). Dépend de l'API France Travail (`PoleEmploiClient`) et d'Immersion Facile.

| SLI | Cible indicative | Note |
|---|---|---|
| Disponibilité | 99.5 % | budget d'erreur ≈ 3h22 / 28j |
| Latence p95 | < 800 ms | dépend de la latence du partenaire externe |
| Latence p99 | < 2 s | |
| Taux d'erreur métier | < 1 % | timeout/erreur partenaire (FT, Immersion Facile), distinct d'un bug API |
| Fraîcheur des données | à définir avec le métier | délai de synchronisation offres FT → visibilité bénéficiaire, non mesuré aujourd'hui |

### 4.3 Consultation d'événements

Contrôleurs : `evenements.controller.ts` (animations collectives MILO),
`evenements-emploi.controller.ts` (événements France Travail).

| SLI | Cible indicative | Note |
|---|---|---|
| Disponibilité | 99.5 % | budget d'erreur ≈ 3h22 / 28j |
| Latence p95 | < 800 ms | dépend de la latence du partenaire externe |
| Latence p99 | < 2 s | |
| Taux d'erreur métier | < 1 % | timeout/erreur partenaire (FT, MILO) |
| Fraîcheur des données | à définir avec le métier | délai de sync événements → visibilité bénéficiaire, non mesuré aujourd'hui |

### 4.4 Favoris

Contrôleur : `favoris.controller.ts`. Données possédées par l'API, pas de dépendance
externe synchrone à la lecture/écriture.

| SLI | Cible indicative | Note |
|---|---|---|
| Disponibilité | 99.8 % | pas de dépendance externe, cible plus stricte |
| Latence p95 | < 300 ms | opération CRUD simple |
| Latence p99 | < 800 ms | |
| Taux d'erreur métier | N/A | pas de dépendance externe significative — les erreurs restent des erreurs techniques classiques |
| Fraîcheur des données | N/A | données possédées par l'API, pas de synchronisation externe |

### 4.5 Suivi (actions + rendez-vous)

Contrôleurs : `actions.controller.ts`, `rendez-vous.controller.ts`. Les actions sont
purement internes ; certains rendez-vous (sessions MILO) sont synchronisés depuis le
système d'information MILO.

| SLI | Cible indicative | Note |
|---|---|---|
| Disponibilité | 99.8 % | |
| Latence p95 | < 500 ms | |
| Latence p99 | < 1.2 s | |
| Taux d'erreur métier | < 1 % | échec de synchronisation MILO sur les rendez-vous/sessions, distinct d'un bug interne |
| Fraîcheur des données | à définir avec le métier | délai de sync sessions MILO → visibilité bénéficiaire, non mesuré aujourd'hui |

### 4.6 Messagerie

Contrôleur : `messages.controller.ts`. **Point d'attention méthodologique** : le chat
temps réel entre bénéficiaire et conseiller passe directement par Firebase depuis les
clients (app mobile / web), pas par pass-emploi-api. Le rôle de l'API dans ce parcours
(listing de conversations, compteurs, déclenchement de notifications) est donc plus étroit
que « la messagerie » au sens large — la fiabilité de la livraison des messages en
temps réel relève du SLA Firebase, hors du contrôle direct de l'équipe.

| SLI | Cible indicative | Note |
|---|---|---|
| Disponibilité | 99.5 % | sur les endpoints API (hors livraison temps réel Firebase) |
| Latence p95 | < 500 ms | |
| Latence p99 | < 1.2 s | |
| Taux d'erreur métier | < 1 % | échec d'écriture Firebase, distinct d'un bug API |
| Fraîcheur des données | N/A | la fraîcheur de la conversation elle-même est portée par Firebase, pas par l'API |

## 5. Hors périmètre — à traiter dans des specs séparées

- **Scénarios de test de charge** : quels parcours charger en priorité, avec quel outillage
  (à choisir — ex. k6), quels jeux de données, quels seuils de rupture rechercher. Cette
  spec s'appuiera sur les cibles validées ici pour savoir quoi tester et à partir de quel
  seuil un résultat est un échec.
- **Plan d'instrumentation** : comment combler les manques identifiés en §2.3 — étiquetage
  des erreurs métier vs techniques, mesure de fraîcheur, dashboards par parcours plutôt que
  par endpoint technique. Dépend des cibles retenues ici (pas la peine d'instrumenter plus
  finement que ce que les SLO exigent).
- **SLO pour les features futures** (onboarding QCM, plan d'action connecté et invité,
  extension du périmètre invité aux offres/événements) : à spécifier une fois ces features
  elles-mêmes spécifiées. Le design invité existant (§1) donne déjà la liste des tables et
  endpoints envisagés, mais rien n'est encore assez stable pour en tirer des cibles de
  performance.

## 6. Questions ouvertes pour le métier

1. Les cibles indicatives de ce document doivent être **recalibrées avec les données APM
   réelles** (p95/p99/taux d'erreur actuels par endpoint) avant validation finale — qui a
   accès à Kibana pour extraire ces chiffres ?
2. **Fraîcheur des données** (offres, événements, sessions MILO) : quel délai est
   acceptable pour le métier ? Aucune cible proposée faute de mesure actuelle et de
   position métier connue.
3. **Criticité relative des parcours** : tous les parcours ont-ils le même niveau
   d'exigence, ou certains (ex. authentification, suivi) sont-ils plus critiques que
   d'autres (ex. favoris) et méritent des budgets d'erreur plus stricts ? Les cibles
   proposées en §4 font déjà une différence entre parcours à dépendance externe et
   parcours internes — à confirmer ou ajuster avec le métier.
4. **Périmètre invité vs connecté** : une fois le périmètre invité étendu (recherche
   d'offres/événements), doit-il avoir les **mêmes cibles** que le parcours connecté
   équivalent, ou des cibles distinctes (ex. rate limiting plus strict déjà prévu dans le
   design invité, §6.6 de `2026-07-03-mode-invite-design.md`) ?

## 7. Prochaines étapes

1. Validation de ce catalogue avec le métier (cibles, criticité relative, fraîcheur).
2. Recalibrage des cibles avec les données APM réelles.
3. Spec « scénarios de test de charge » basée sur ce catalogue validé.
4. Spec « plan d'instrumentation » pour combler les manques de mesure identifiés en §2.3.