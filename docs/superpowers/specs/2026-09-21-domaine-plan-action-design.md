# Design — Domaine Plan d'action

> **Statut : spec validée, non implémentée.** Écrite le 2026-09-21.
> Sujet transverse rattaché : `pass-emploi-tools/docs/app-jeune/plan-action.md`,
> **périmé sur deux points** et à mettre à jour :
> 1. l'invariant « rien n'est persisté côté API » est caduc depuis le commit
>    `478ed445` ;
> 2. son « Backlog de recette » est obsolète — le Grist a rattrapé les écarts
>    (voir « Correspondances figées »).

## 1. Le problème

Le plan d'action est aujourd'hui un **proxy sans domaine**. Le payload rendu par
le service externe *est* le plan : ses identifiants deviennent nos clés
primaires, son vocabulaire descend jusqu'en base, et sa disponibilité conditionne
la nôtre.

Trois conséquences concrètes, lisibles dans le code actuel :

| Symptôme | Où |
|---|---|
| Le référentiel est un **effet de bord de la sauvegarde** : `save()` fait un `bulkCreate(updateOnDuplicate)` de ce que le POC vient de renvoyer. Le référentiel se remplit au hasard des plans générés, sans source de vérité. | `plan-action-sql.repository.db.ts` |
| Le mobile reçoit l'**id de la solution**, pas celui de sa tâche : `getDernierPlan` mappe depuis `tacheSql.referentiel` et jette `tacheSql.id`. Cocher une tâche est impossible sans ambiguïté si deux objectifs portent la même solution. | `plan-action-sql.repository.db.ts` |
| ~150 lignes de dégradation défensive (`degraderEnConseil`, `kind` inconnu, `deepLink` non mappé) existent pour fabriquer un affichage à partir d'un payload qu'on ne maîtrise pas. | `commands/mappers/plan-action.mapper.ts` |

Le déclencheur : **le POC bayesimpact va être remplacé à courte échéance par une
solution interne.** Sans couture, ce remplacement rouvre tout le chemin de code.

## 2. Décisions

| # | Décision | Raison |
|---|---|---|
| D1 | **Notre référentiel fait foi.** Le générateur ne rend que des identifiants de solutions ; libellés, URL et services sont matérialisés depuis notre base. | Rend le plan stable dans le temps, aligne invité et accompagné, et supprime la dégradation défensive. |
| D2 | **Identifiants internes partout.** Une factory attribue un uuid à chaque objectif et à chaque tâche ; l'id de solution reste interne (`id_solution`). | Débloque le cochage d'une tâche, qui est aujourd'hui inadressable. |
| D3 | **Le Grist est la source du référentiel**, synchronisée par un cron mensuel. | C'est là que le métier édite. Le POC lit le même Grist : les ids coïncident par construction. |
| D4 | **Les colonnes de conversion FT / ML sont importées et portées par le domaine, mais non agies.** | Elles pointent vers `Demarche.ACreer` et `Action.Qualification.Code`. Les importer coûte des colonnes ; les omettre coûtera une migration. |
| D5 | **Le lexique métier est français dans le domaine, le contrat HTTP est inchangé.** Les mappers traduisent à la frontière. | Le domaine parle le vocabulaire de l'équipe ; le mobile n'a pas à être relivré pour un renommage. |
| D6 | **Une seule interface pour le référentiel** (`Repository`). Le job injecte `GristClient` en direct. | Pattern de la maison (`MajReferentielAgencesFTJobHandler` injecte `PoleEmploiClient`). Abstraire la source serait abstraire un changement que personne n'a annoncé. |
| D7 | **L'accroche n'est pas persistée.** Elle n'a de sens qu'à la génération. | `PlanActionConnecteQueryModel` ne la porte déjà pas. |
| D8 | **L'invité n'est pas persisté.** Même résolution, même factory, pas de `save`. | Un seul chemin de code ; la décision produit reste celle de la doc transverse. |

## 3. Lexique

Deux vocabulaires, pour deux moments distincts.

| Moment | Concept | Terme domaine | Colonne Grist | Contrat HTTP (inchangé) |
|---|---|---|---|---|
| Questionnaire | ce que le jeune veut | **besoin** | `Envie` | `goals` |
| Questionnaire | ce qui le bloque | **contrainte** | `Blocage` | `obstacles` |
| Plan | composant du plan | **objectif** | — | `objectives` |
| Plan | item d'un objectif | **tâche** | — | `actions` |
| Référentiel | ligne du référentiel | **solution** | `Solution` | jamais exposée |

« Tâche » et non « action » : `Action` est déjà un objet du domaine MILO. La base
l'avait compris (`plan_action_tache`), le contrat HTTP ne l'a pas suivi — et on
ne le corrige pas (D5).

## 4. Architecture

```
┌─ domain/plan-action/referentiel-plan-action.ts ──────────────────┐
│  Solution  (besoin · éligibilité · affichage · conversion)       │
│  Service   (id, nom, description)                                │
│  interface Repository            ◀── unique interface            │
└──────────────────────────────────────────────────────────────────┘
        ▲ écrit par le cron               ▲ lu à la génération
        │                                 │
┌───────┴──────────┐            ┌─────────┴────────────────────────┐
│ GristClient      │            │ domain/plan-action/plan-action.ts│
│ (classe concrète)│            │  PlanAction · Objectif · Tache   │
└──────────────────┘            │  Suggestion                      │
                                │  interface Generateur  ◀ couture │
                                │  interface Repository            │
                                │  class Factory                   │
                                └──────────────────────────────────┘
                                         △
                                ┌────────┴─────────┐
                                │ PlanActionClient │ adaptateur POC
                                │  (Generateur)    │ → jetable
                                └──────────────────┘
```

`ReferentielPlanAction` ne dépend de rien. `PlanAction` en dépend pour résoudre
les identifiants. Aucun des deux ne connaît Sequelize, Grist ni le POC.

**L'interface `Generateur` est la pièce durable du design.** L'adaptateur POC est
le seul consommable : le remplacer par la solution interne doit être l'écriture
d'une nouvelle implémentation et l'échange d'un provider, rien d'autre.

## 5. Domaine `ReferentielPlanAction`

`src/domain/plan-action/referentiel-plan-action.ts`

```ts
export const ReferentielPlanActionRepositoryToken =
  'ReferentielPlanActionRepositoryToken'

export namespace ReferentielPlanAction {
  export interface Service {
    id: string
    nom: string
    description: string
  }

  export interface Solution {
    id: string
    besoin?: PlanAction.Besoin
    contrainte?: PlanAction.Contrainte
    sousCategorie?: string
    besoinExprime?: string

    type: PlanAction.TypeTache
    libelle: string
    url?: string
    ecranApp?: PlanAction.Destination
    service?: Service

    situations: string[]
    authentifications: Profil.Structure[]
    ageMin?: number
    ageMax?: number
    territoires: string[]
    domaine?: string

    conversionFT?: ConversionFT
    conversionML?: ConversionML
  }

  export interface ConversionFT {
    thematique?: string
    demarche?: string
    codePourquoi?: string
    codeQuoi?: string
  }

  export interface ConversionML {
    categorie?: string
    codeCategorie?: string
    action?: string
    origine?: string
  }

  export interface Diff {
    nbCreees: number
    nbMisesAJour: number
    nbDesactivees: number
  }

  export interface Anomalies {
    nbServicesNonResolus: number
    nbDoublonsServices: number
    nbDoublonsSolutions: number
    nbSolutionsEcartees: number
  }

  export interface Repository {
    remplacer(services: Service[], solutions: Solution[]): Promise<Diff>
    trouverSolutions(ids: string[]): Promise<Solution[]>
  }
}
```

Deux opérations, deux clients : le cron écrit, la génération lit.

**Les énumérations appartiennent au domaine.** `PlanAction.TypeTache`
(`LIEN` / `NAVIGATION` / `CONSEIL`) et `PlanAction.Destination` vivent dans
`plan-action.ts` ; `TypeActionPlan` et `DestinationActionPlan` restent les
énumérations du contrat HTTP, dans les query models (D5). Leurs valeurs
coïncident aujourd'hui, le mapper traduit quand même — c'est ce qui permettra
d'en faire diverger une sans relivrer le mobile.

### Correspondance Grist → domaine

Source : `https://grist.numerique.gouv.fr/o/appcejpassemploi/gPz4MmVz5j49/Referentiel-pour-plan-daction/`

Identifiants réels des tables, relevés sur l'API : **`Services`** et
**`Solutions`** (au pluriel, ≠ noms des pages). Les identifiants de colonnes sont
normalisés par Grist : accents et espaces deviennent des `_`
(`Besoin_exprime_par_le_jeune`, `Ecran_de_l_app`, `Conversion_FT_Code_pourquoi`).

**Table `Services`** : `Nom` (Text), `Description` (Text). Aucun identifiant
technique — voir H2, c'est bloquant.

**Table `Solutions`**, 24 colonnes, types relevés sur `/columns` :

| Colonne Grist | Type Grist | Champ domaine | Traitement |
|---|---|---|---|
| `Id_technique` | Text | `id` | clé primaire (`p-2`) |
| `Envie` | **Choice** | `besoin` | valeurs contraintes par le Grist |
| `Blocage` | **Choice** | `contrainte` | idem |
| `Sous_categorie` | **Choice** | `sousCategorie` | idem |
| `Besoin_exprime_par_le_jeune` | **Choice** | `besoinExprime` | idem |
| `Type` | **Choice** | `type` | `Lien web` → `TypeTache.LIEN` |
| `Action_affichee_au_jeune` | Text | `libelle` | |
| `URL` | Text | `url` | |
| `Ecran_de_l_app` | Text | `ecranApp` | → `PlanAction.Destination` ; **texte libre**, donc valeur non mappable possible |
| `Service` | Text | `service` | nom résolu **à l'import** vers un `Service` — voir « Réconciliation » |
| `Situations` | Text | `situations[]` | multivalué en texte, séparateur `"; "` |
| `Authentification` | Text | `authentifications[]` | idem → `Profil.Structure` |
| `Age_minimum` / `Age_maximum` | Numeric | `ageMin` / `ageMax` | flottant Grist → entier |
| `Territoire` | Text | `territoires[]` | multivalué, séparateur `"; "`, code département |
| `Domaine` | Text | `domaine` | |
| `Conversion_FT_Thematique` / `_Demarche` / `_Code_pourquoi` / `_Code_quoi` | Text | `conversionFT` | porté, non agi |
| `Conversion_ML_Categorie` / `_Code_categorie` / `_Action` / `_Origine_de_l_action` | Text | `conversionML` | porté, non agi |

### Correspondances figées (relevées dans `widgetOptions`, 2026-09-22)

Les colonnes `Choice` portent leur liste exhaustive de valeurs. Les trois qui
alimentent une énumération sont **fermées et complètes** — `besoin` et
`contrainte` sont donc de vrais types du domaine, pas des chaînes.

**`Type` → `PlanAction.TypeTache`** — 3 valeurs, correspondance exacte :

| Grist | Domaine |
|---|---|
| `Lien web` | `LIEN` |
| `Écran de l'app` | `NAVIGATION` |
| `Conseil` | `CONSEIL` |

> **Invariant d'import** : `Type = "Écran de l'app"` sans `Ecran_de_l_app`
> renseigné donne une tâche sans destination, donc inutilisable. Ces lignes sont
> loggées et écartées à l'import, pas importées à moitié.

**`Envie` → `PlanAction.Besoin`** — 11 valeurs, **correspondance 1:1 exacte avec
`GoalPayload`** (11 valeurs elles aussi) : `M'orienter` → `ORIENTER`,
`Découvrir des métiers` → `DECOUVRIR_METIERS`, `Me former, me qualifier` →
`FORMER`, `Trouver un stage, une immersion` → `STAGE_IMMERSION`,
`Trouver une alternance` → `ALTERNANCE`, `Trouver un emploi` → `EMPLOI`,
`M'engager` → `ENGAGER`, `Faire une mobilité internationale` →
`MOBILITE_INTERNATIONALE`, `Être accompagné dans mes démarches` → `ACCOMPAGNE`,
`Créer mon activité` → `CREER_ACTIVITE`, `Vie quotidienne` → `VIE_QUOTIDIENNE`.

**`Blocage` → `PlanAction.Contrainte`** — 12 valeurs, qui correspondent
exactement à `ObstaclePayload` **privé de `AUTRE` et `RIEN_NE_ME_BLOQUE`**.
C'est cohérent : ce sont des réponses de questionnaire, pas des critères
d'éligibilité — aucune solution n'est étiquetée « Autre ». Le domaine porte donc
12 contraintes, et ces deux réponses ne filtrent simplement rien.

**`Sous_categorie` (74 valeurs) et `Besoin_exprime_par_le_jeune` (≈110)** restent
des chaînes libres : ce sont des taxonomies de travail du métier, sans
correspondance dans le code. Elles contiennent des doublons
(`Candidatures spontanées` deux fois) et des coquilles
(`Je découvre une métier en entreprise`) — matière produit, pas dette technique,
et sans effet tant que rien ne s'en sert.

### Trois pièges de parsing, constatés sur un enregistrement réel

**1. Les multivaluées sont du texte, pas des `ChoiceList`.** `Situations`,
`Authentification` et `Territoire` rendent
`"Au collège; Au lycée; En études supérieures; En emploi; Autre situation"`.
Il faut découper sur `;` puis `trim()`. Aucun marqueur de type à écarter —
contrairement à ce que rendrait une vraie `ChoiceList` Grist (`["L", …]`).

C'est le point **fragile** du contrat : rien n'empêche un `;` dans un libellé,
une variante de casse ou un séparateur oublié. Toute valeur non reconnue doit
être **loggée, jamais perdue silencieusement** (voir H5).

**2. Deux conventions de vide selon le type.** Les colonnes Text et Choice vides
rendent `""`, les colonnes Numeric vides rendent `null`. L'import doit normaliser
les deux vers `undefined`, sans quoi on stocke des chaînes vides qui passeront
les tests de présence.

**3. Les colonnes `Choice` portent leur liste de valeurs autorisées** dans
`fields.widgetOptions` (JSON contenant `choices`). C'est la source exhaustive
pour écrire les tables de correspondance `Type` → `TypeTache`,
`Envie` → besoin, `Blocage` → contrainte sans rien deviner.

### Pourquoi la conversion FT / ML est importée

Ce ne sont pas des notes de travail du métier : ce sont des clés de jointure vers
les deux domaines existants.

| Colonne Grist | Existe déjà dans le repo |
|---|---|
| `Conversion FT - Code pourquoi` (`P01`) | `Demarche.ACreer.pourquoi` — `src/domain/demarche.ts:151` |
| `Conversion FT - Code quoi` (`Q02`) | `Demarche.ACreer.quoi`, résolu via `catalogueDemarchesInMemory` |
| `Conversion ML - Code catégorie` (`PROJET_PROFESSIONNEL`) | `Action.Qualification.Code` — `src/domain/action/qualification.ts:12` |

Le référentiel est donc la **table de correspondance entre un besoin exprimé par
un jeune et les objets métier qu'on sait déjà créer**. Le jour où « transformer
une tâche en démarche » arrive, c'est un command handler à écrire et rien à
reprendre côté référentiel ni côté schéma.

## 6. Schéma

```
referentiel_plan_action_service                       NOUVELLE
  id                 text        PK
  nom                text        not null
  description        text        null

referentiel_plan_action_solution        (ex referentiel_plan_action_tache)
  id                 text        PK                   -- « p-2 »
  besoin             text        null
  contrainte         text        null
  sous_categorie     text        null
  besoin_exprime     text        null
  type               text        not null
  libelle            text        not null
  url                text        null
  ecran_app          text        null
  id_service         text        null  FK → referentiel_plan_action_service
  situations         text[]      not null default '{}'
  authentifications  text[]      not null default '{}'
  territoires        text[]      not null default '{}'
  age_min            integer     null
  age_max            integer     null
  domaine            text        null
  conversion_ft_thematique, conversion_ft_demarche,
  conversion_ft_code_pourquoi, conversion_ft_code_quoi        text null
  conversion_ml_categorie, conversion_ml_code_categorie,
  conversion_ml_action, conversion_ml_origine                 text null
  active             boolean     not null default true
  date_maj           timestamptz not null

plan_action_tache
  id_tache_referentiel  →  RENOMMÉE  id_solution
```

`text[]` et non une table de jointure : ces listes ne sont jamais interrogées
isolément, seulement filtrées. `DataType.ARRAY(DataType.STRING)` est déjà utilisé
dans le repo (`fichier.sql-model.ts:21`).

Les 8 colonnes de conversion restent typées plutôt que regroupées en `jsonb` :
elles ne coûtent rien et deviendront interrogeables le jour où on les agit.

**Renommage `tache` → `solution`** : une *tâche* est l'instance du jeune
(cochable, datée), une ligne de référentiel est une *solution* (partagée,
immuable). Le Grist et la doc du POC disent « solution ».

## 7. Le cron

`MajReferentielPlanActionJobHandler` → `Planificateur.JobType.MAJ_REFERENTIEL_PLAN_ACTION`
Fichier : `src/application/jobs/maj-referentiel-plan-action.job.handler.db.ts`
Expression : `0 5 1 * *` — le 1er de chaque mois à 5h, après ROME (3h) et agences FT (4h).

```
GristClient.recupererReferentiel()        2 appels : table Service, table Solution
   │
   │  garde-fou : 0 ligne reçue
   │           ou nb_desactivees > max(seuil_min, pct_max % du référentiel actif)
   │              → échec du job, rien n'est écrit (transaction annulée)
   ▼
Repository.remplacer(services, solutions)  1 transaction
   │  upsert des lignes présentes dans le Grist
   │  active = false pour les absentes
   ▼
SuiviJob { nbServices, nbSolutions, nbCreees, nbMisesAJour, nbDesactivees,
           nbServicesNonResolus, nbDoublonsServices, nbDoublonsSolutions }
```

### Réconciliation à l'import : le nom ne descend jamais en base

Le nom de service est une donnée d'affichage, pas une clé. Il est résolu **une
fois**, au moment de l'import, et la table `solution` ne porte qu'une clé
étrangère.

```
passe 1 — Services
   upsert par identifiant de ligne Grist   (records[].id : 1 → ONISEP)
   construction de l'index  Nom → Service

passe 2 — Solutions
   Service = "ONISEP"  ──▶ index ──▶ Service{ id: 1 }
   persistance : id_service = 1        ◀ jamais le nom

lecture
   trouverSolutions() joint referentiel_plan_action_service
   et repeuple Solution.service
```

Un renommage côté Grist ne touche donc qu'une ligne de `service` : les milliers
de lignes de `solution` qui la référencent restent valides. C'est ce que
l'identifiant de ligne Grist comme clé achète.

### Les trois anomalies détectées et loggées à l'import

| Anomalie | Règle | Compteur |
|---|---|---|
| `Solutions.Service` ne résout aucun `Nom` | solution importée **sans service**, nom cherché et `Id_technique` loggés | `nbServicesNonResolus` |
| Deux lignes de `Services` portent le même `Nom` | la jointure devient ambiguë : on retient l'**identifiant de ligne le plus bas** (déterministe, stable d'un import à l'autre) et on logge les deux | `nbDoublonsServices` |
| Deux lignes de `Solutions` portent le même `Id_technique` | c'est notre clé primaire : on retient la première par identifiant de ligne, on **écarte** les suivantes et on les logge | `nbDoublonsSolutions` |

Le doublon n'est pas théorique : la liste de choix `Sous_categorie` contient déjà
`Candidatures spontanées` deux fois. Un doublon silencieux sur `Id_technique`
ferait qu'un `upsert` écrase une solution par une autre sans que personne ne le
voie.

Ces compteurs naissent à la **réconciliation**, avant toute écriture : ils
appartiennent à `Anomalies`, pas au `Diff` du repository qui ne connaît que ce
qu'il a écrit. Le job fusionne les deux dans le `SuiviJob`, donc dans le rapport
du job : une anomalie de saisie devient visible sans lire les logs.

Une quatrième anomalie, `nbSolutionsEcartees`, compte les lignes inexploitables :
`Type` hors des trois valeurs connues, ou `Type = "Écran de l'app"` sans
`Ecran_de_l_app` renseigné.

### On ne supprime jamais une solution

`plan_action_tache.id_solution` référence cette table. Une solution retirée du
Grist est encore référencée par les plans déjà générés : la supprimer casse
l'historique. D'où `active` — le cron **désactive**. Les plans existants
continuent de s'afficher, la génération ne propose plus la solution.

C'est le même problème que `MajReferentielAgencesFT` (agences référencées par des
conseillers), qui s'en sort avec un plafond de suppressions et une
réaffectation. Ici la désactivation est plus simple et plus sûre : rien à
réaffecter.

Le garde-fou sur le volume reprend l'idiome maison : `MajReferentielAgencesFT`
combine `if (agencesFT.length === 0) throw` et un plafond
`max(nombreSuppressionsMin, pourcentageSuppressionsMax % du total)` piloté par la
config. On reprend les deux, avec les mêmes noms de réglages sous
`jobs.majReferentielPlanAction`, et un mode `dryRun` pour la première exécution.
Un Grist vidé par accident ne doit pas désactiver tout le référentiel.

### Rattrapage manuel

Gratuit : `PlanifierExecutionCronCommandHandler` prend n'importe quel `JobType`
et le pousse en file immédiatement. Déclarer `MAJ_REFERENTIEL_PLAN_ACTION` dans
l'enum suffit à rendre le ré-import relançable à la demande.

### Configuration

`GRIST_API_URL`, `GRIST_API_KEY`, `GRIST_DOC_ID` (`gPz4MmVz5j49`), plus les
identifiants des deux tables. Pas de valeur de repli dans le code : tout passe
par `ConfigService` et les variables d'environnement Scalingo.

## 8. Domaine `PlanAction`

`src/domain/plan-action/plan-action.ts`

```ts
export const PlanActionRepositoryToken = 'PlanActionRepositoryToken'
export const GenerateurDePlanActionToken = 'GenerateurDePlanActionToken'

export interface PlanAction {
  id: string
  idJeune: string
  dateCreation: DateTime
  objectifs: PlanAction.Objectif[]
}

export namespace PlanAction {
  export interface Objectif {
    id: string
    titre: string
    theme: string
    taches: Tache[]
  }

  export interface Tache {
    id: string
    idSolution: string
    terminee: boolean
    dateCreation: DateTime
    dateTerminee?: DateTime
  }

  export interface Profil {
    structure: Profil.Structure
    situation: string
    besoins: string[]
    contraintes: string[]
    dateNaissance?: DateTime
    domaine?: string
    habitation?: Commune
    villeRecherche?: Commune
    rayonKm?: number
  }

  export interface Suggestion {
    accroche: string
    genereLe: DateTime
    generateur: string
    objectifs: SuggestionObjectif[]
  }

  export interface SuggestionObjectif {
    titre: string
    theme: string
    idsSolutions: string[]
  }

  export interface Generateur {
    genererPlan(profil: Profil): Promise<Result<Suggestion>>
  }

  export interface Repository {
    save(plan: PlanAction): Promise<void>
    getDernierPlan(idJeune: string): Promise<PlanAction | undefined>
  }

  export class Factory {
    constructor(
      private readonly idService: IdService,
      private readonly dateService: DateService
    ) {}

    creer(
      idJeune: string,
      suggestion: Suggestion,
      solutions: ReferentielPlanAction.Solution[]
    ): Result<PlanAction>
  }
}
```

### `Suggestion` n'est pas `PlanAction`

C'est la distinction qui porte tout le design. Un générateur rend une
`Suggestion` : des titres, des thèmes, des identifiants de solutions. Il ne
connaît ni nos identifiants, ni notre persistance, ni nos query models.
`PlanAction` est ce que nous possédons.

Aujourd'hui les deux sont confondus, et c'est la racine des trois symptômes de
la section 1.

### La factory porte les règles

```
Factory.creer(idJeune, suggestion, solutions) → Result<PlanAction>
   │
   ├─ écarte les idsSolutions absents du référentiel  (ou inactifs)
   ├─ écarte les objectifs devenus vides
   ├─ si le plan est vide → failure
   ├─ attribue un uuid à chaque objectif et à chaque tâche
   └─ pose dateCreation, terminee = false
```

Le filtrage vit ici, pas enfoui dans un mapper : c'est une règle du domaine,
testable sans HTTP ni base.

**Plan vide → `failure` explicite.** La règle du POC est « on supprime
silencieusement », ce qui peut rendre un plan sans aucun objectif. Le mobile sait
afficher une erreur ; il ne sait pas afficher un plan vide utilement.

### La tâche ne porte pas son affichage

`Tache` garde `idSolution` ; l'appelant compose avec les solutions. Le query
handler fait donc deux lectures — deux requêtes indexées sur de petits volumes —
et les deux domaines restent décorrélés.

## 9. Les trois points d'entrée applicatifs

| Handler | Chaîne |
|---|---|
| `MajReferentielPlanActionJobHandler` | `GristClient.recupererReferentiel()` → `ReferentielPlanAction.Repository.remplacer()` |
| `GenererPlanActionCommandHandler` | `Generateur.genererPlan()` → `Referentiel.trouverSolutions()` → `Factory.creer()` → `PlanAction.Repository.save()` |
| `RecupererPlanActionQueryHandler` | `PlanAction.Repository.getDernierPlan()` → `Referentiel.trouverSolutions()` → mapper |

```ts
async handle(command, utilisateur) {
  const profil = toProfil(command.payload, utilisateur)

  const suggestion = await this.generateur.genererPlan(profil)
  if (isFailure(suggestion)) return suggestion

  const solutions = await this.referentiel.trouverSolutions(
    idsSolutions(suggestion.data)
  )

  const plan = this.planActionFactory.creer(
    command.idJeune,
    suggestion.data,
    solutions
  )
  if (isFailure(plan)) return plan

  if (!estInvite(utilisateur.profil.structure)) {
    await this.planActionRepository.save(plan.data)
  }

  return success(
    toPlanActionQueryModel(plan.data, solutions, suggestion.data.accroche)
  )
}
```

`GenererPlanAction` reste une **Command** (il écrit), `RecupererPlanAction` reste
une **Query** (il lit).

## 10. Ce qui disparaît

- L'upsert du référentiel dans `PlanActionSqlRepository.save()` — le référentiel
  cesse d'être un sous-produit de la génération.
- `toPlanActionQueryModel` côté POC et toute la dégradation défensive
  (`degraderEnConseil`, `kind` inconnu avec url exploitable, `deepLink` non
  mappé) : ~150 lignes qui n'existent que pour fabriquer un affichage à partir du
  payload externe.
- Le `try/catch` qui transforme un échec de `save()` en `ErreurHttp 500`.
- `toProfileDto` survit mais descend dans l'adaptateur POC, et part avec lui.

Les correspondances qui **restent** et deviennent le mapping durable sont celles
du **Grist vers les énumérations du domaine** : `Type` → `PlanAction.TypeTache`,
`Écran de l'app` → `PlanAction.Destination`, `Situations` / `Authentification` →
énumérations de profil. Puis, à la frontière HTTP, du domaine vers le contrat
(`TypeActionPlan`, `DestinationActionPlan`).

## 11. Découpage

**Étape 1 — le référentiel.** Domaine `ReferentielPlanAction`,
`ReferentielPlanActionSqlRepository`, `GristClient`,
`MajReferentielPlanActionJobHandler`, migration des deux tables.
Purement additif : la route de génération continue de tourner à l'identique,
l'upsert du `save()` reste en place le temps de l'étape.

**Étape 2 — le domaine `PlanAction`.** Entités, `Generateur`, `Repository`,
`Factory`, réécriture des deux handlers, adaptateur POC réduit aux identifiants,
suppression de l'upsert.

Le référentiel est l'actif durable, le générateur est le consommable : le
construire complet d'abord, c'est livrer l'entrée dont la solution interne aura
besoin, quel que soit celui qui génère. L'étape 1 a une valeur propre au lieu
d'être un échafaudage.

## 12. Tests

| Unité | Ce qui est couvert | Type |
|---|---|---|
| `PlanAction.Factory` | filtrage des ids inconnus, objectifs vidés, plan vide → failure, unicité des uuid | unitaire, sans stub lourd |
| Mapping Grist → `Solution` | marqueur `["L", …]` des choice lists, `Type` inconnu, colonnes vides, listes vides | unitaire |
| `ReferentielPlanActionSqlRepository` | upsert, désactivation des absentes, `trouverSolutions` ignore les inactives | `.db.test.ts` |
| `MajReferentielPlanActionJobHandler` | garde-fou 0 ligne, garde-fou chute de volume, stats du `SuiviJob` | unitaire, `GristClient` stubbé |
| `GenererPlanActionCommandHandler` | les 3 étapes, échec du générateur, plan vide, invité non persisté | unitaire |
| `RecupererPlanActionQueryHandler` | composition plan + solutions, plan absent → `NonTrouveError`, tâche dont la solution est inactive | unitaire — le test existe mais est **à réécrire** : le handler compose désormais deux lectures au lieu d'une |

Convention : `.test.ts`, `.db.test.ts` pour ce qui touche la base, marqueurs
`// Given` / `// When` / `// Then`. Aucun autre commentaire dans le code livré.

## 13. Hypothèses et points ouverts

| # | Point | Statut |
|---|---|---|
| H1 | ~~La colonne `Service` est-elle une colonne Référence ?~~ | **Levée le 2026-09-22** : c'est une colonne `Text` contenant le nom (`"ONISEP"`). La jointure se fait donc par le libellé, et H2 devient bloquant. |
| H2 | Le Grist n'a **aucun** moyen stable de désigner un service : `Services` n'a pas d'identifiant technique, et `Solutions.Service` pointe par le nom. Un renommage de service casse la jointure **à l'intérieur même du Grist**, avant de nous atteindre. | **Tranchée : option C** — on ne touche pas à la structure du Grist, on encaisse et on alerte |
| H3 | ~~Reprise de données nécessaire dans la migration ?~~ | **Levée le 2026-09-22** : `appJeuneActif` est à `false` en production et aucune donnée n'y existe. La migration est libre — renommages et changements de clé sans reprise. |
| H4 | Le POC et nous lisons le même Grist, les identifiants coïncident | confirmé en conception ; un compteur d'ids inconnus dans les logs le vérifie en continu |
| H5 | Les valeurs du Grist couvrent exactement nos énumérations | **Largement levée le 2026-09-22** : les colonnes `Choice` (`Type`, `Envie`, `Blocage`) sont fermées et correspondent exactement — voir « Correspondances figées ». Restent à valider sur export complet les colonnes **texte libre** : `Ecran_de_l_app`, `Situations`, `Authentification`, `Territoire`. Toute valeur inconnue doit être loggée, jamais perdue silencieusement. |

### H2 — comment désigner un service de façon stable

Constat : `Solutions.Service` est du texte qui recopie `Services.Nom`. Renommer
« ONISEP » dans `Services` ne met pas à jour les lignes de `Solutions` — la
jointure est cassée **côté Grist**, et aucun choix de notre part n'y change quoi
que ce soit.

Les deux corrections propres demandent une modification de **structure** du
Grist, ce que le métier ne veut pas :

| Option écartée | Demande | Pourquoi c'est mieux |
|---|---|---|
| **A — colonne Référence** | convertir `Solutions.Service` en `Ref:Services` + ajouter `Id_technique` à `Services` | Grist maintient l'intégrité et suit les renommages tout seul, le métier garde sa liste déroulante |
| **B — identifiant saisi** | ajouter `Id_technique` à `Services`, le faire porter par `Solutions.Service` | cohérent avec `Solutions.Id_technique`, mais le métier saisit un code au lieu d'un nom |

**Option C retenue — jointure par le nom, identité stabilisée de notre côté.**

- L'import **joint par `Nom`**, seul lien disponible.
- Notre `referentiel_plan_action_service.id` est l'**identifiant de ligne Grist**
  (`records[].id`), pas le nom. Un renommage garde la même ligne, donc notre
  identité de service ne bouge pas et les clés étrangères restent valides.
- Une solution dont le `Service` ne résout aucun `Nom` est **importée sans
  service**, et l'écart est loggé avec le nom cherché et l'id de la solution.
- Le `SuiviJob` remonte `nbServicesNonResolus`. Un renommage devient visible dans
  le rapport du job, pas silencieux.

Coût assumé : entre un renommage et sa correction dans le Grist, les solutions
concernées perdent leur nom de service à l'affichage. Dégradation visible,
loggée, réparable par une simple édition du Grist suivie d'un ré-import manuel
(`PlanifierExecutionCronCommandHandler`). Pas de perte de donnée.

Réserve sur l'identifiant de ligne Grist : il est stable tant que la ligne vit,
mais une suppression/recréation — ou une réimportation de la table par le métier
— en attribue un nouveau. C'est le prix de l'absence d'identifiant métier, pas un
défaut du choix.

**`Ecran_de_l_app` en texte libre** relève de la même contrainte : on ne demande
pas de le passer en `Choice`. La validation se fait à l'import, toute valeur
hors `PlanAction.Destination` étant loggée et la ligne écartée.

## 14. Hors périmètre

- **La conversion d'une tâche en Démarche FT ou en Action MILO.** Les données
  sont importées et portées par le domaine (D4), aucun cas d'usage ne les
  consomme.
- **Le cochage d'une tâche.** D2 le rend possible (la tâche devient adressable),
  mais l'endpoint n'est pas dans ce périmètre.
- **Le devenir du plan à la transition invité → inscrit**, qui dépend du sujet
  plus large de la transition.
- **Le réalignement du contrat HTTP sur le lexique français** (D5).
