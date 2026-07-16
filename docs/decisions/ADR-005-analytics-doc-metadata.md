# Documentation hybride de la pipeline analytics (JSDoc metadata)

* Statut : proposé
* Date : 2026-07-16

## Contexte et Définition du Problème

La pipeline analytics est décrite dans [ANALYTICS.md](../ANALYTICS.md) et implémentée
dans plusieurs job handlers (`src/application/jobs/analytics/`). Pour le travail
humain et agentique, il faut pouvoir retrouver rapidement : étape dans la chaîne,
déclencheur, tables touchées, lien vers la doc ops — **sans** paraphraser la logique
métier dans le code (convention commentaires du repo) et **sans** dupliquer toute
l'orchestration dans chaque fichier.

Comment documenter la pipeline de façon partagée et maintenable ?

## Facteurs de Décision

* Découvrabilité (IDE, grep, agents)
* Une seule vérité comportementale : le code (`handle`, `ajouterJob`)
* Éviter les longs commentaires explicatifs
* Ne pas introduire de framework / catalogue data runtime (surdimensionné)

## Solutions Étudiées

* **A** — Uniquement `ANALYTICS.md` + lecture du code (`ajouterJob`, `JobType`)
* **B** — JSDoc standard minimal (`@see` + une ligne « step X/4 ») sur chaque handler
* **C** — JSDoc + tags conventionnels `@analytics.*` (trigger, after/before, tables)
* **D** — Catalogue runtime / OpenLineage / génération Typedoc obligatoire

## Résultat de la Décision

Solution retenue : **C** (hybride), car elle ajoute une carte légère à côté du handler
sans changer le runtime, tout en gardant [ANALYTICS.md](../ANALYTICS.md) pour l'ops
(Metabase, fraîcheur, reprise).

### Concepts (contrat d'équipe)

| Concept | Signification |
| --- | --- |
| **Commentaire JSDoc** | Texte non exécuté ; visible dans le source et au survol IDE |
| **`@see`** | Tag JSDoc standard → lien vers la section `ANALYTICS.md` |
| **`@analytics.*`** | Convention **équipe** (pas un standard Nest/Bull) ; utile au grep / agents |
| **Comportement runtime** | Uniquement décorateurs (`@ProcessJobType`, …) + `handle()` / `ajouterJob` |

Ces tags **ne sont pas des commandes** : ils ne pilotent ni Bull ni Nest.

### Tags `@analytics.*` retenus

| Tag | Rôle |
| --- | --- |
| `@analytics.trigger` | Cron, `ajouterJob` amont, ou `TASK_NAME=…` (maintenance) |
| `@analytics.after` | JobType typiquement exécuté avant celui-ci |
| `@analytics.before` | JobType typiquement enfilé après (souvent conditionnel, ex. lundi) |
| `@analytics.tables_in` / `tables_out` | Tables principales lues / écrites |
| `@analytics.scope` | Périmètre maintenance (historique / dernière année) |

Première ligne du bloc : `Analytics pipeline — step N/4 (…)` ou `maintenance (hors chaîne)`.

### Impacts Positifs

* Carte pipeline greppable depuis les handlers
* Lien explicite code ↔ `ANALYTICS.md`
* Pas de dépendance runtime

### Impacts Négatifs

* Risque de **dérive** si on change `ajouterJob` sans mettre à jour les tags
* Tags custom à connaître (d'où cette ADR)
* Moins « standard » qu'un simple `@see` seul

## Liens

* Orchestration ops : [ANALYTICS.md](../ANALYTICS.md)
* Décision ELT : [ADR-004](./ADR-004-pipeline-analytics.md)
* Nuances observabilité (hors doc ops) : [AUDIT-SPECS.md](../AUDIT-SPECS.md)
* Handlers concernés : `src/application/jobs/analytics/*`
