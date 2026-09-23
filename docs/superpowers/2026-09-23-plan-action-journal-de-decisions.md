# Plan d'action — journal des décisions (étapes 1 et 2)

> **Trace des arbitrages rendus pendant l'implémentation**, y compris ceux pris
> sans validation humaine. Écrit le 2026-09-23, à la clôture de la branche
> `feat/plan-action-reconexion`.
>
> Conception : [`specs/2026-09-21-domaine-plan-action-design.md`](./specs/2026-09-21-domaine-plan-action-design.md)
> Plans : [`plans/2026-09-22-referentiel-plan-action-grist.md`](./plans/2026-09-22-referentiel-plan-action-grist.md) · [`plans/2026-09-22-domaine-plan-action-etape-2.md`](./plans/2026-09-22-domaine-plan-action-etape-2.md)
>
> Ce document remplace les espaces de travail d'exécution, supprimés. L'historique
> git porte le détail commit par commit.

## Ce qui a été livré

Le plan d'action était un **proxy sans domaine** : le payload du service externe
*était* le plan, donc ses identifiants étaient nos clés primaires et son
vocabulaire descendait jusqu'en base. Le référentiel, lui, n'avait pas de source
de vérité — il se remplissait en effet de bord de chaque sauvegarde.

**Étape 1 — le référentiel prend une source de vérité.** Un document Grist édité
par le métier, synchronisé par un cron mensuel (`MAJ_REFERENTIEL_PLAN_ACTION`,
`0 5 1 * *`) dans `referentiel_plan_action_service` et
`referentiel_plan_action_solution`. Domaine `ReferentielPlanAction`, client Grist,
mapper de réconciliation, repository Sequelize, garde-fous de désactivation.

**Étape 2 — le plan d'action prend un domaine.** Un générateur, quel qu'il soit,
rend une `Suggestion` : titres, thèmes, identifiants de solutions. Une `Factory`
les résout contre le référentiel, attribue nos propres uuid, produit un
`PlanAction`. Le service externe est derrière `PlanAction.Generateur`, et son
adaptateur est délibérément jetable.

**Trois conséquences visibles :**

- Le mobile reçoit l'identifiant de **sa tâche**, plus celui de la solution — ce
  qui rend une tâche adressable, donc cochable. C'est le défaut qui justifiait
  les deux étapes.
- `DestinationActionPlan` passe de 3 à 5 valeurs.
- Le format de `genereLe` change (`…Z` → `…+00:00`).

## État de vérification à la clôture

| | |
|---|---|
| `tsc --noEmit` | muet |
| `yarn test:local:unit` | 2080 passing, 0 failing |
| Suite `.db.test.ts` | 1019 passing, 4 failing — **les 4 préexistants**, aucun nouveau |
| Commits | 40 depuis `develop` (fork `22aedf9c`), poussés sur la PR |

Les 4 échecs base de données ne touchent aucun fichier de ce travail : trois sur
`InitialiserLaVueDemarchesIAJobHandler` (la base de test locale ne contient
aucune vue analytics, elles sont créées par une tâche jamais lancée dessus) et un
sur `CacheApiPartenaireService` (test sensible au temps).

## Décisions prises sans arbitrage humain

Chacune a été consignée au moment où elle a été prise, avec son coût si elle est
fausse. Elles sont toutes défaisables.

### Sur les logs

| Décision | Coût si faux |
|---|---|
| **Les logs d'anomalie du mapper Grist sont en texte libre, sans `event.action` ni `event.outcome`.** La doctrine de `logs-ecs/conventions.md:28-57` exige deux conditions cumulatives pour créer une entrée de taxonomie, et son contre-exemple décrit littéralement notre cas : un échec unitaire dans la boucle d'un job dont le volume agrégé vit déjà dans `SuiviJob.resultat`. | On perd l'agrégation par type d'anomalie dans Kibana — mais c'est précisément ce que la doctrine refuse, et les compteurs du `SuiviJob` la couvrent. |
| **Les détails de diagnostic passent sous `labels.*` en snake_case.** Un champ racine est mappé dynamiquement par Elasticsearch : le type est figé par le premier document et toute forme différente est rejetée en 400, donc le log est perdu. Nos détails mêlent chaînes et nombres. | Un préfixe de plus dans les requêtes Kibana. Aucune perte. |

### Sur la configuration et le déploiement

| Décision | Coût si faux |
|---|---|
| **Le schéma Joi garde `grist` en `required()` sans valeur de repli**, aligné sur `planAction` (`configuration.schema.ts:73-77`), le précédent le plus récent. Inventer une URL Grist de repli serait pire qu'un refus de démarrer : on appellerait un hôte faux en silence. | Un déploiement qui ne boote pas, détecté immédiatement. **Voir « Ce qui reste à faire ».** |
| **Les tâches 2 et 3 de l'étape 2 laissent volontairement `tsc` en erreur**, les handlers ne compilant plus tant que la tâche 4 n'est pas faite. | Ces deux tâches ne sont pas déployables isolément, contrairement à celles de l'étape 1. |

### Sur le référentiel Grist

| Décision | Coût si faux |
|---|---|
| **Jointure des services par le nom**, sans demander de restructuration du Grist. Le métier accepte de faire évoluer le contenu, pas la forme. Notre `referentiel_plan_action_service.id` est l'identifiant de ligne Grist, ce qui stabilise notre identité malgré un renommage. | Entre un renommage et sa correction, les solutions concernées perdent leur nom de service à l'affichage — visible dans `nbServicesNonResolus`, réparable par une édition du Grist et un ré-import. |
| **`remplacer()` enveloppe ses trois écritures dans une transaction.** Le patron existait déjà dans le même dossier (`plan-action-sql.repository.db.ts`). Sans elle, une désactivation qui échoue après les upserts laisse `active` des solutions retirées du Grist. | Un paramètre de plus par requête. Aucun effet fonctionnel. |
| **Trois constats mineurs promus avant merge** — colonnes de texte libre en `TEXT`, index inutile sur `active` supprimé, `Joi.uri()` — parce que la migration n'avait jamais quitté le local : la modifier sur place coûtait zéro, après un déploiement il aurait fallu une seconde migration. | Une vague de correction un peu plus large que le strict nécessaire. |

### Sur le domaine et le contrat

| Décision | Coût si faux |
|---|---|
| **`PlanAction.Profil.besoins` et `.contraintes` sont des `string[]`**, le vocabulaire du **questionnaire**, et non les énumérations `Besoin`/`Contrainte` qui sont le vocabulaire du **référentiel**. Les typer sur le référentiel jetait `AUTRE` et `RIEN_NE_ME_BLOQUE` à chaque génération — une perte de donnée sur le chemin nominal, qu'un test verrouillait. | Typage plus lâche sur deux champs de profil. |
| **Un référentiel désynchronisé rend 502, plus 400.** Le payload du jeune est valide ; la panne est la nôtre. Cohérent avec le reste du chemin (échec générateur = 502, timeout = 504). | Si le mobile traite les 502 différemment des 400, à vérifier. |
| **`DestinationActionPlan` élargi à 5 valeurs.** Le Grist porte `offres-emploi` et `aller-vers` ; les écarter amputerait le référentiel, les dégrader en conseil rendrait des tâches inertes. | Deux destinations exposées que l'app ne sait peut-être pas ouvrir. **Voir « Ce qui reste à faire ».** |
| **La lecture est alignée sur l'écriture** : les objectifs vidés sont écartés et un plan effondré rend `NonTrouveError`, comme la factory refuse un plan vide à l'écriture. | Un jeune dont toutes les solutions ont été désactivées reçoit une erreur plutôt qu'un plan vide. |
| **`optionnel()` reste dupliqué** entre le mapper (application) et le repository (infrastructure) : les deux signatures diffèrent légitimement — `undefined` seul d'un côté, `null | undefined` de l'autre, parce que l'un lit du SQL. | Un relecteur demandera l'extraction ; correction locale. |
| **Le DTO HTTP qui remonte dans la couche applicative reste en place.** `generer-plan-action.command.handler.ts` est le seul fichier de `src/application/` à importer de `src/infrastructure/routes/validation`. Le constat est juste et c'est la cause structurelle de la perte de donnée ci-dessus, mais le corriger demande de refondre la forme de la commande et le contrôleur. | La même confusion peut reproduire le même défaut ailleurs. **À traiter dans un lot dédié.** |

### Sur le dépôt

| Décision | Coût si faux |
|---|---|
| **13 documents de conception d'autres chantiers ont été dé-suivis sans réécrire l'historique.** Un `git add docs/superpowers` initial les avait embarqués ; ils sont redevenus non suivis dans l'arbre. | Les blobs restent dans l'historique de la branche sans être dans l'arbre. Un rebase les purgerait. |

## Ce qui a été volontairement laissé de côté

Aucun de ces points n'est corrigé. Ils sont connus et documentés.

- **`dateMaj` de `plan_action` est vestigiale** : aucune méthode de mise à jour
  n'existe dans le domaine, elle ne peut structurellement jamais diverger de
  `dateCreation`. La bonne fenêtre de décision est l'arrivée de l'endpoint de
  cochage — soit il l'utilise, soit elle part avec la migration de ce lot-là.
- **FK `id_service` sans `onDelete`/`onUpdate` explicite.** Sans conséquence tant
  que le repository ne supprime jamais de service. À trancher le jour où une
  purge est écrite — elle butera sur la contrainte.
- **`GristClient` ne distingue pas un timeout (504) d'un autre échec (502).**
  Contrairement à `plan-action-client.ts`, mais le code HTTP meurt ici dans un
  `catch` et n'est jamais exposé ; l'appel sortant est déjà journalisé par
  `ExternalApiLoggerService`. Dupliquer un état capturé ailleurs va contre la
  doctrine ECS.
- **Pas d'assertion sur le `Diff` du cas « solution inactive qui revient ».** La
  logique a été vérifiée correcte par lecture, mais rien ne la couvre.
- **Styles d'import hétérogènes** entre les six fichiers de test de ce travail
  (quatre en absolu, deux en relatif). Le dépôt est partagé sur ce point.

> **Un invariant non écrit dans le code, à connaître.**
> `plan_action_tache.id_solution` référence le référentiel, et `trouverSolutions`
> ne rend que les solutions actives. Ça tient uniquement parce que `remplacer()`
> désactive sans jamais supprimer. Le jour où quelqu'un ajoutera une purge des
> solutions inactives, `save()` cassera en production sur violation de clé
> étrangère.

## Ce qui reste à faire

**Avant tout déploiement :**

1. **Provisionner `GRIST_API_URL`, `GRIST_DOC_ID` et `GRIST_API_KEY`** dans le
   vault de chaque environnement. Sans elles, la validation Joi refuse de
   démarrer **l'API entière**, pas seulement la fonctionnalité Grist. Les valeurs
   sont déjà dans le `.vault` du dépôt.
2. **Lancer `yarn tasks:initialiser-les-crons`** après déploiement, sinon le job
   ne tourne jamais et le silence dure un mois.
3. **Prévenir l'équipe mobile de trois ruptures de contrat** : l'identifiant
   d'action devient celui de la tâche, `DestinationActionPlan` passe à cinq
   valeurs, et `genereLe` change de format.

**À vérifier sur staging, une demi-heure :**

4. **Lancer un premier import en `dryRun`** via `PlanifierExecutionCronCommandHandler`
   et lire les compteurs du `SuiviJob`. Le mode simule réellement : il calcule le
   `Diff` et applique le plafond avant d'annuler la transaction.
5. **Comparer les identifiants rendus par le POC à ceux de
   `referentiel_plan_action_solution`.** C'est l'hypothèse la plus structurante
   du design (D3/H4) et elle n'a jamais été mesurée. Les compteurs
   `plan_action_ids_recus` et `plan_action_ids_inconnus` sont désormais dans les
   logs pour la suivre en continu.
6. **Confirmer que l'app sait naviguer vers `offres-emploi` et `aller-vers`.**
   Si ce n'est pas le cas, il faudra retomber sur une dégradation en conseil.

**Documentation d'équipe à corriger :**

7. `pass-emploi-tools/docs/app-jeune/plan-action.md` est périmé sur trois points :
   l'invariant « rien n'est persisté côté API », son « Backlog de recette » (le
   Grist a comblé les trois écarts qu'il liste), et le fait que le référentiel ne
   vient plus du POC.
8. Le `CLAUDE.md` du dépôt annonce **TypeScript 4.9.5** ; la version installée est
   `^5.9.3`.

## Une vérification qui a évité une panne silencieuse

Les valeurs de la colonne Grist `Ecran_de_l_app` avaient été **devinées** : le
code attendait littéralement `OFFRES_ALTERNANCE`, un nom d'énumération créé dans
le même commit. L'export de production a montré du kebab-case — `evenements`,
`offres-alternance`, `offres-emploi`, `offres-services-civiques`, `aller-vers`.

Sans cette vérification, le premier import réel aurait **écarté en bloc toute la
catégorie navigation du référentiel**, avec pour seul signal un compteur dans un
rapport mensuel. Aucune erreur, aucun test rouge.

Le signal qui a mis sur la piste n'était pas une valeur mais une **asymétrie de
forme** : toutes les autres colonnes étaient mappées depuis un libellé français
lisible, celle-là seule était traitée en identité contre nos propres constantes.

L'export a aussi montré que `aller-vers` est la seule destination dont la ligne
porte `Authentification: Invité` seul — vraisemblablement un écran propre au
parcours invité, à confirmer côté mobile.
