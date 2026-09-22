# Référentiel Plan d'action depuis Grist — Plan d'implémentation (étape 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au référentiel du plan d'action une source de vérité propre — le Grist métier — synchronisée par un cron mensuel, au lieu d'être un effet de bord de la sauvegarde d'un plan.

**Architecture:** Un domaine `ReferentielPlanAction` (entités `Service` et `Solution`, une interface `Repository`), un `GristClient` qui lit les deux tables du document Grist, un mapper de réconciliation qui résout les services par nom et détecte les anomalies, un repository Sequelize qui upsert et désactive, et un `JobHandler` qui orchestre le tout derrière des garde-fous.

**Tech Stack:** NestJS 11, TypeScript 4.9, Sequelize 6 + PostgreSQL 14, Bull, Luxon, Mocha + Chai + Sinon + Nock.

**Spec:** `docs/superpowers/specs/2026-09-21-domaine-plan-action-design.md`

## Global Constraints

- **Yarn uniquement**, jamais npm.
- **Prettier** : `tabWidth: 2`, `semi: false`, `singleQuote: true`, `trailingComma: "none"`, `arrowParens: "avoid"`.
- **Guillemets** : string sans apostrophe → `'simples'` ; string avec apostrophe → `"doubles"`. Vaut aussi dans les `it()` et `describe()`.
- **Aucun commentaire** dans le code livré, sauf les trois exceptions du `CONTEXTE-TRANSVERSE.md` : fait non-évident indispensable, `// TODO:` actionnable, marqueurs `// Given` / `// When` / `// Then` des tests.
- **ESLint** : pas de `console`, pas de `process.env` hors `src/config/`, pas de `any`, type de retour explicite sur toute fonction.
- **Logs ECS** : tout log passe par `rootLogger`. Niveaux `info` ou `error`, jamais `warn`. **Jamais d'exception brute passée à un logger** — `toEcsError(e)` d'abord. Un `event.action` (verbe au passé, snake_case) **ne se crée que si les deux conditions cumulatives** de `pass-emploi-tools/docs/logs-ecs/conventions.md:28-57` sont remplies : on va l'agréger ou alerter dessus, **et** l'état n'est pas déjà capturé ailleurs. Un échec unitaire dans la boucle d'un job ne les remplit pas — son volume est déjà dans `SuiviJob.resultat` : il va en **texte libre, sans `event`**.
- **Lexique français dans le domaine** : `besoin` (Grist `Envie`), `contrainte` (Grist `Blocage`), `objectif`, `tache`, `solution`. Le contrat HTTP reste inchangé (`goals`, `obstacles`, `objectives`, `actions`).
- **Nommage** : `{Entité}SqlRepository`, `{Entité}SqlModel`, fichiers touchant la base en `*.db.ts`, tests en `*.test.ts` / `*.db.test.ts`.

## Périmètre : ce que l'étape 1 ne touche pas

L'étape 1 est **purement additive**. Elle crée `referentiel_plan_action_service`
et `referentiel_plan_action_solution` **à côté** de `referentiel_plan_action_tache`,
qui continue d'exister et d'être alimentée par l'upsert de
`PlanActionSqlRepository.save()`.

Rien n'est renommé, rien n'est supprimé, `GenererPlanActionCommandHandler` et
`RecupererPlanActionQueryHandler` ne sont pas touchés. La bascule — brancher
`plan_action_tache` sur la nouvelle table, supprimer l'upsert et l'ancienne
table — est l'étape 2, qui aura son propre plan.

Conséquence temporaire assumée : deux tables de référentiel coexistent, la
nouvelle alimentée par le cron, l'ancienne par la génération. C'est le prix d'une
étape 1 livrable seule.

---

### Task 1 : Domaine et réconciliation Grist → domaine

Le cœur métier de l'étape : les types du domaine, et la fonction pure qui
transforme les enregistrements Grist en `Service[]` + `Solution[]` en détectant
les anomalies. Aucun HTTP, aucune base : tout est testable en mémoire.

**Files:**
- Create: `src/domain/plan-action/plan-action.ts`
- Create: `src/domain/plan-action/referentiel-plan-action.ts`
- Create: `src/infrastructure/clients/dto/grist.dto.ts`
- Create: `src/application/jobs/mappers/referentiel-plan-action.mapper.ts`
- Test: `test/application/jobs/mappers/referentiel-plan-action.mapper.test.ts`

**Interfaces:**
- Consumes: rien (première tâche).
- Produces:
  - `PlanAction.TypeTache` (`LIEN` | `NAVIGATION` | `CONSEIL`), `PlanAction.Destination` (`OFFRES_ALTERNANCE` | `OFFRES_SERVICE_CIVIQUE` | `EVENEMENTS`), `PlanAction.Besoin` (11 valeurs), `PlanAction.Contrainte` (12 valeurs)
  - `ReferentielPlanAction.Service`, `.Solution`, `.Diff`, `.Anomalies`, `.Reconciliation`, `.PlafondDesactivations`, `.Repository`
  - `ReferentielPlanActionRepositoryToken: string`
  - `GristRecordDto<T>`, `GristServiceFieldsDto`, `GristSolutionFieldsDto`
  - `reconcilierReferentiel(services: Array<GristRecordDto<GristServiceFieldsDto>>, solutions: Array<GristRecordDto<GristSolutionFieldsDto>>): ReferentielPlanAction.Reconciliation`

- [ ] **Step 1 : Écrire les types du domaine**

`src/domain/plan-action/plan-action.ts` :

```ts
export namespace PlanAction {
  export enum TypeTache {
    LIEN = 'LIEN',
    NAVIGATION = 'NAVIGATION',
    CONSEIL = 'CONSEIL'
  }

  export enum Destination {
    OFFRES_ALTERNANCE = 'OFFRES_ALTERNANCE',
    OFFRES_SERVICE_CIVIQUE = 'OFFRES_SERVICE_CIVIQUE',
    EVENEMENTS = 'EVENEMENTS'
  }

  export enum Besoin {
    ORIENTER = 'ORIENTER',
    DECOUVRIR_METIERS = 'DECOUVRIR_METIERS',
    FORMER = 'FORMER',
    STAGE_IMMERSION = 'STAGE_IMMERSION',
    ALTERNANCE = 'ALTERNANCE',
    EMPLOI = 'EMPLOI',
    ENGAGER = 'ENGAGER',
    MOBILITE_INTERNATIONALE = 'MOBILITE_INTERNATIONALE',
    ACCOMPAGNE = 'ACCOMPAGNE',
    CREER_ACTIVITE = 'CREER_ACTIVITE',
    VIE_QUOTIDIENNE = 'VIE_QUOTIDIENNE'
  }

  export enum Contrainte {
    PAS_DE_PERMIS = 'PAS_DE_PERMIS',
    PAS_DE_TRANSPORT = 'PAS_DE_TRANSPORT',
    PAS_DE_LOGEMENT = 'PAS_DE_LOGEMENT',
    MANQUE_CONFIANCE = 'MANQUE_CONFIANCE',
    FIN_DE_MOIS = 'FIN_DE_MOIS',
    HANDICAP = 'HANDICAP',
    SANTE = 'SANTE',
    GARDE_ENFANT = 'GARDE_ENFANT',
    NUMERIQUE = 'NUMERIQUE',
    PAS_DE_DIPLOME = 'PAS_DE_DIPLOME',
    PEU_EXPERIENCE = 'PEU_EXPERIENCE',
    FRANCAIS = 'FRANCAIS'
  }
}
```

`src/domain/plan-action/referentiel-plan-action.ts` :

```ts
import { Profil } from '../profil'
import { PlanAction } from './plan-action'

export const ReferentielPlanActionRepositoryToken =
  'ReferentielPlanActionRepositoryToken'

export namespace ReferentielPlanAction {
  export interface Service {
    id: string
    nom: string
    description?: string
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
    territoires: string[]
    ageMin?: number
    ageMax?: number
    domaine?: string

    conversionFT?: ConversionFT
    conversionML?: ConversionML
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

  export interface Reconciliation {
    services: Service[]
    solutions: Solution[]
    anomalies: Anomalies
  }

  export interface PlafondDesactivations {
    pourcentageMax: number
    nombreMin: number
  }

  export interface Repository {
    remplacer(
      services: Service[],
      solutions: Solution[],
      plafond: PlafondDesactivations
    ): Promise<Diff>

    trouverSolutions(ids: string[]): Promise<Solution[]>
  }
}
```

`src/infrastructure/clients/dto/grist.dto.ts` :

```ts
export interface GristRecordDto<T> {
  id: number
  fields: T
}

export interface GristRecordsDto<T> {
  records: Array<GristRecordDto<T>>
}

export interface GristServiceFieldsDto {
  Nom: string
  Description: string
}

export interface GristSolutionFieldsDto {
  Id_technique: string
  Envie: string
  Blocage: string
  Sous_categorie: string
  Besoin_exprime_par_le_jeune: string
  Type: string
  Action_affichee_au_jeune: string
  URL: string
  Ecran_de_l_app: string
  Service: string
  Situations: string
  Authentification: string
  Age_minimum: number | null
  Age_maximum: number | null
  Territoire: string
  Domaine: string
  Conversion_FT_Thematique: string
  Conversion_FT_Demarche: string
  Conversion_FT_Code_pourquoi: string
  Conversion_FT_Code_quoi: string
  Conversion_ML_Categorie: string
  Conversion_ML_Code_categorie: string
  Conversion_ML_Action: string
  Conversion_ML_Origine_de_l_action: string
}
```

- [ ] **Step 2 : Écrire les tests du mapper**

`test/application/jobs/mappers/referentiel-plan-action.mapper.test.ts` :

```ts
import { reconcilierReferentiel } from 'src/application/jobs/mappers/referentiel-plan-action.mapper'
import { PlanAction } from 'src/domain/plan-action/plan-action'
import { Profil } from 'src/domain/profil'
import {
  GristRecordDto,
  GristServiceFieldsDto,
  GristSolutionFieldsDto
} from 'src/infrastructure/clients/dto/grist.dto'
import { expect } from 'test/utils'

describe('reconcilierReferentiel', () => {
  const serviceOnisep: GristRecordDto<GristServiceFieldsDto> = {
    id: 1,
    fields: { Nom: 'ONISEP', Description: 'site pour trouver une formation' }
  }

  function uneSolutionGrist(
    fields: Partial<GristSolutionFieldsDto> = {}
  ): GristRecordDto<GristSolutionFieldsDto> {
    return {
      id: 1,
      fields: {
        Id_technique: 'p-2',
        Envie: "M'orienter",
        Blocage: '',
        Sous_categorie: "Consulter des sites d'orientation",
        Besoin_exprime_par_le_jeune: 'Je ne sais pas',
        Type: 'Lien web',
        Action_affichee_au_jeune: 'Je consulte des sites',
        URL: 'https://www.onisep.fr/',
        Ecran_de_l_app: '',
        Service: 'ONISEP',
        Situations: 'Au collège; Au lycée',
        Authentification: 'France Travail; Mission Locale; Invité',
        Age_minimum: null,
        Age_maximum: null,
        Territoire: '',
        Domaine: '',
        Conversion_FT_Thematique: 'Mon (nouveau) métier',
        Conversion_FT_Demarche: 'Information sur un métier',
        Conversion_FT_Code_pourquoi: 'P01',
        Conversion_FT_Code_quoi: 'Q02',
        Conversion_ML_Categorie: 'Projet pro',
        Conversion_ML_Code_categorie: 'PROJET_PROFESSIONNEL',
        Conversion_ML_Action: 'Autre',
        Conversion_ML_Origine_de_l_action: 'Référentiel app jeune',
        ...fields
      }
    }
  }

  it('résout le service par son nom et le porte dans la solution', () => {
    // Given
    const solutions = [uneSolutionGrist()]

    // When
    const resultat = reconcilierReferentiel([serviceOnisep], solutions)

    // Then
    expect(resultat.services).to.deep.equal([
      { id: '1', nom: 'ONISEP', description: 'site pour trouver une formation' }
    ])
    expect(resultat.solutions[0].service).to.deep.equal({
      id: '1',
      nom: 'ONISEP',
      description: 'site pour trouver une formation'
    })
    expect(resultat.anomalies.nbServicesNonResolus).to.equal(0)
  })

  it('traduit les énumérations fermées', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Blocage: "Peu d'expérience professionnelle" })]
    )

    // Then
    expect(resultat.solutions[0].type).to.equal(PlanAction.TypeTache.LIEN)
    expect(resultat.solutions[0].besoin).to.equal(PlanAction.Besoin.ORIENTER)
    expect(resultat.solutions[0].contrainte).to.equal(
      PlanAction.Contrainte.PEU_EXPERIENCE
    )
  })

  it('découpe les multivaluées sur le point-virgule en ignorant les espaces', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Territoire: '75;  972 ;' })]
    )

    // Then
    expect(resultat.solutions[0].situations).to.deep.equal([
      'Au collège',
      'Au lycée'
    ])
    expect(resultat.solutions[0].authentifications).to.deep.equal([
      Profil.Structure.FRANCE_TRAVAIL,
      Profil.Structure.MILO,
      Profil.Structure.INVITE
    ])
    expect(resultat.solutions[0].territoires).to.deep.equal(['75', '972'])
  })

  it('normalise les deux conventions de vide vers undefined', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Blocage: '', Domaine: '', Age_minimum: null })]
    )

    // Then
    expect(resultat.solutions[0].contrainte).to.equal(undefined)
    expect(resultat.solutions[0].domaine).to.equal(undefined)
    expect(resultat.solutions[0].ageMin).to.equal(undefined)
  })

  it('mappe une navigation avec son écran', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [
        uneSolutionGrist({
          Type: "Écran de l'app",
          Ecran_de_l_app: 'EVENEMENTS'
        })
      ]
    )

    // Then
    expect(resultat.solutions[0].type).to.equal(PlanAction.TypeTache.NAVIGATION)
    expect(resultat.solutions[0].ecranApp).to.equal(
      PlanAction.Destination.EVENEMENTS
    )
  })

  it("écarte une navigation sans écran renseigné", () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Type: "Écran de l'app", Ecran_de_l_app: '' })]
    )

    // Then
    expect(resultat.solutions).to.deep.equal([])
    expect(resultat.anomalies.nbSolutionsEcartees).to.equal(1)
  })

  it('écarte une solution dont le type est inconnu', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Type: 'Podcast' })]
    )

    // Then
    expect(resultat.solutions).to.deep.equal([])
    expect(resultat.anomalies.nbSolutionsEcartees).to.equal(1)
  })

  it('importe sans service une solution dont le nom ne résout rien', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Service: 'ONISEP Orientation' })]
    )

    // Then
    expect(resultat.solutions[0].service).to.equal(undefined)
    expect(resultat.anomalies.nbServicesNonResolus).to.equal(1)
  })

  it("retient l'identifiant de ligne le plus bas quand deux services partagent un nom", () => {
    // Given
    const doublon: GristRecordDto<GristServiceFieldsDto> = {
      id: 7,
      fields: { Nom: 'ONISEP', Description: 'doublon' }
    }

    // When
    const resultat = reconcilierReferentiel(
      [doublon, serviceOnisep],
      [uneSolutionGrist()]
    )

    // Then
    expect(resultat.solutions[0].service!.id).to.equal('1')
    expect(resultat.anomalies.nbDoublonsServices).to.equal(1)
  })

  it("écarte les solutions en doublon d'identifiant technique", () => {
    // Given
    const premiere = uneSolutionGrist()
    const seconde = { id: 9, fields: uneSolutionGrist().fields }

    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [premiere, seconde]
    )

    // Then
    expect(resultat.solutions).to.have.length(1)
    expect(resultat.anomalies.nbDoublonsSolutions).to.equal(1)
  })
})
```

- [ ] **Step 3 : Lancer les tests et vérifier qu'ils échouent**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/application/jobs/mappers/referentiel-plan-action.mapper.test.ts' --exit --timeout 10000
```

Attendu : ÉCHEC — `Cannot find module 'src/application/jobs/mappers/referentiel-plan-action.mapper'`.

- [ ] **Step 4 : Écrire le mapper**

`src/application/jobs/mappers/referentiel-plan-action.mapper.ts` :

```ts
import { PlanAction } from '../../../domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../domain/plan-action/referentiel-plan-action'
import { Profil } from '../../../domain/profil'
import {
  GristRecordDto,
  GristServiceFieldsDto,
  GristSolutionFieldsDto
} from '../../../infrastructure/clients/dto/grist.dto'
import { rootLogger } from '../../../utils/logger.module'

const CONTEXT = 'ReferentielPlanActionMapper'

const typeParLibelle: Record<string, PlanAction.TypeTache> = {
  'Lien web': PlanAction.TypeTache.LIEN,
  "Écran de l'app": PlanAction.TypeTache.NAVIGATION,
  Conseil: PlanAction.TypeTache.CONSEIL
}

const besoinParLibelle: Record<string, PlanAction.Besoin> = {
  "M'orienter": PlanAction.Besoin.ORIENTER,
  'Découvrir des métiers': PlanAction.Besoin.DECOUVRIR_METIERS,
  'Me former, me qualifier': PlanAction.Besoin.FORMER,
  'Trouver un stage, une immersion': PlanAction.Besoin.STAGE_IMMERSION,
  'Trouver une alternance': PlanAction.Besoin.ALTERNANCE,
  'Trouver un emploi': PlanAction.Besoin.EMPLOI,
  "M'engager": PlanAction.Besoin.ENGAGER,
  'Faire une mobilité internationale':
    PlanAction.Besoin.MOBILITE_INTERNATIONALE,
  'Être accompagné dans mes démarches': PlanAction.Besoin.ACCOMPAGNE,
  'Créer mon activité': PlanAction.Besoin.CREER_ACTIVITE,
  'Vie quotidienne': PlanAction.Besoin.VIE_QUOTIDIENNE
}

const contrainteParLibelle: Record<string, PlanAction.Contrainte> = {
  'Pas de permis': PlanAction.Contrainte.PAS_DE_PERMIS,
  'Pas de moyens de transport': PlanAction.Contrainte.PAS_DE_TRANSPORT,
  'Pas de logement stable': PlanAction.Contrainte.PAS_DE_LOGEMENT,
  'Manque de confiance': PlanAction.Contrainte.MANQUE_CONFIANCE,
  'Fin de mois difficile': PlanAction.Contrainte.FIN_DE_MOIS,
  'Situation de handicap': PlanAction.Contrainte.HANDICAP,
  'Un problème de santé': PlanAction.Contrainte.SANTE,
  "Garde d'enfant": PlanAction.Contrainte.GARDE_ENFANT,
  'Difficulté avec le numérique': PlanAction.Contrainte.NUMERIQUE,
  'Pas de diplôme': PlanAction.Contrainte.PAS_DE_DIPLOME,
  "Peu d'expérience professionnelle": PlanAction.Contrainte.PEU_EXPERIENCE,
  'Difficulté avec le français': PlanAction.Contrainte.FRANCAIS
}

const structureParLibelle: Record<string, Profil.Structure> = {
  'France Travail': Profil.Structure.FRANCE_TRAVAIL,
  'Mission Locale': Profil.Structure.MILO,
  Invité: Profil.Structure.INVITE
}

export function reconcilierReferentiel(
  servicesGrist: Array<GristRecordDto<GristServiceFieldsDto>>,
  solutionsGrist: Array<GristRecordDto<GristSolutionFieldsDto>>
): ReferentielPlanAction.Reconciliation {
  const anomalies: ReferentielPlanAction.Anomalies = {
    nbServicesNonResolus: 0,
    nbDoublonsServices: 0,
    nbDoublonsSolutions: 0,
    nbSolutionsEcartees: 0
  }

  const services: ReferentielPlanAction.Service[] = []
  const serviceParNom = new Map<string, ReferentielPlanAction.Service>()

  for (const record of [...servicesGrist].sort((a, b) => a.id - b.id)) {
    const service: ReferentielPlanAction.Service = {
      id: String(record.id),
      nom: record.fields.Nom,
      ...(texte(record.fields.Description)
        ? { description: texte(record.fields.Description) }
        : {})
    }
    services.push(service)

    if (serviceParNom.has(service.nom)) {
      anomalies.nbDoublonsServices++
      logAnomalie('referentiel_service_en_doublon', {
        nom: service.nom,
        idRetenu: serviceParNom.get(service.nom)!.id,
        idIgnore: service.id
      })
      continue
    }
    serviceParNom.set(service.nom, service)
  }

  const solutions: ReferentielPlanAction.Solution[] = []
  const idsVus = new Set<string>()

  for (const record of [...solutionsGrist].sort((a, b) => a.id - b.id)) {
    const fields = record.fields

    if (idsVus.has(fields.Id_technique)) {
      anomalies.nbDoublonsSolutions++
      logAnomalie('referentiel_solution_en_doublon', {
        idTechnique: fields.Id_technique,
        ligneGrist: record.id
      })
      continue
    }
    idsVus.add(fields.Id_technique)

    const type = typeParLibelle[fields.Type]
    if (!type) {
      anomalies.nbSolutionsEcartees++
      logAnomalie('referentiel_solution_ecartee', {
        idTechnique: fields.Id_technique,
        raison: 'type_inconnu',
        valeur: fields.Type
      })
      continue
    }

    const ecranApp = destination(fields.Ecran_de_l_app)
    if (type === PlanAction.TypeTache.NAVIGATION && !ecranApp) {
      anomalies.nbSolutionsEcartees++
      logAnomalie('referentiel_solution_ecartee', {
        idTechnique: fields.Id_technique,
        raison: 'navigation_sans_ecran',
        valeur: fields.Ecran_de_l_app
      })
      continue
    }

    const nomService = texte(fields.Service)
    const service = nomService ? serviceParNom.get(nomService) : undefined
    if (nomService && !service) {
      anomalies.nbServicesNonResolus++
      logAnomalie('referentiel_service_non_resolu', {
        idTechnique: fields.Id_technique,
        nomCherche: nomService
      })
    }

    solutions.push({
      id: fields.Id_technique,
      ...optionnel('besoin', besoinParLibelle[fields.Envie]),
      ...optionnel('contrainte', contrainteParLibelle[fields.Blocage]),
      ...optionnel('sousCategorie', texte(fields.Sous_categorie)),
      ...optionnel(
        'besoinExprime',
        texte(fields.Besoin_exprime_par_le_jeune)
      ),
      type,
      libelle: fields.Action_affichee_au_jeune,
      ...optionnel('url', texte(fields.URL)),
      ...optionnel('ecranApp', ecranApp),
      ...optionnel('service', service),
      situations: liste(fields.Situations),
      authentifications: liste(fields.Authentification)
        .map(libelle => structureParLibelle[libelle])
        .filter(Boolean),
      territoires: liste(fields.Territoire),
      ...optionnel('ageMin', entier(fields.Age_minimum)),
      ...optionnel('ageMax', entier(fields.Age_maximum)),
      ...optionnel('domaine', texte(fields.Domaine)),
      ...optionnel('conversionFT', conversionFT(fields)),
      ...optionnel('conversionML', conversionML(fields))
    })
  }

  return { services, solutions, anomalies }
}

function texte(valeur: string | null | undefined): string | undefined {
  const propre = valeur?.trim()
  return propre ? propre : undefined
}

function liste(valeur: string | null | undefined): string[] {
  return (valeur ?? '')
    .split(';')
    .map(element => element.trim())
    .filter(element => element.length > 0)
}

function entier(valeur: number | null): number | undefined {
  return valeur === null || valeur === undefined
    ? undefined
    : Math.trunc(valeur)
}

function destination(valeur: string): PlanAction.Destination | undefined {
  const propre = texte(valeur)
  if (!propre) return undefined
  const connues = Object.values(PlanAction.Destination) as string[]
  return connues.includes(propre)
    ? (propre as PlanAction.Destination)
    : undefined
}

function conversionFT(
  fields: GristSolutionFieldsDto
): ReferentielPlanAction.ConversionFT | undefined {
  const conversion: ReferentielPlanAction.ConversionFT = {
    ...optionnel('thematique', texte(fields.Conversion_FT_Thematique)),
    ...optionnel('demarche', texte(fields.Conversion_FT_Demarche)),
    ...optionnel('codePourquoi', texte(fields.Conversion_FT_Code_pourquoi)),
    ...optionnel('codeQuoi', texte(fields.Conversion_FT_Code_quoi))
  }
  return Object.keys(conversion).length ? conversion : undefined
}

function conversionML(
  fields: GristSolutionFieldsDto
): ReferentielPlanAction.ConversionML | undefined {
  const conversion: ReferentielPlanAction.ConversionML = {
    ...optionnel('categorie', texte(fields.Conversion_ML_Categorie)),
    ...optionnel('codeCategorie', texte(fields.Conversion_ML_Code_categorie)),
    ...optionnel('action', texte(fields.Conversion_ML_Action)),
    ...optionnel('origine', texte(fields.Conversion_ML_Origine_de_l_action))
  }
  return Object.keys(conversion).length ? conversion : undefined
}

function optionnel<K extends string, V>(
  cle: K,
  valeur: V | undefined
): Record<K, V> | Record<string, never> {
  return valeur === undefined ? {} : ({ [cle]: valeur } as Record<K, V>)
}

function logAnomalie(
  message: string,
  details: Record<string, string | number>
): void {
  rootLogger.info({ context: CONTEXT, ...details }, message)
}
```

- [ ] **Step 5 : Lancer les tests et vérifier qu'ils passent**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/application/jobs/mappers/referentiel-plan-action.mapper.test.ts' --exit --timeout 10000
```

Attendu : 10 passing.

- [ ] **Step 6 : Vérifier types et lint**

```bash
npx tsc --noEmit -p tsconfig.json && npx eslint --fix src/domain/plan-action src/application/jobs/mappers src/infrastructure/clients/dto/grist.dto.ts test/application/jobs/mappers
```

Attendu : aucune sortie.

- [ ] **Step 7 : Commit**

```bash
git add src/domain/plan-action src/application/jobs/mappers src/infrastructure/clients/dto/grist.dto.ts test/application/jobs/mappers
git commit -m "feat(plan-action): domaine referentiel et reconciliation grist"
```

---

### Task 2 : Le client Grist

Lecture HTTP des deux tables du document Grist, et sa configuration.

**Files:**
- Create: `src/infrastructure/clients/grist-client.ts`
- Modify: `src/config/configuration.ts:108` (bloc voisin de `planAction`)
- Modify: `src/config/configuration.schema.ts`
- Modify: `test/utils/test-config.ts:86` (clé `grist`)
- Modify: `.environment.template`
- Test: `test/infrastructure/clients/grist-client.test.ts`

**Interfaces:**
- Consumes: `GristRecordDto<T>`, `GristRecordsDto<T>`, `GristServiceFieldsDto`, `GristSolutionFieldsDto` (Task 1).
- Produces:
  - `GristClient` avec `recupererServices(): Promise<Result<Array<GristRecordDto<GristServiceFieldsDto>>>>` et `recupererSolutions(): Promise<Result<Array<GristRecordDto<GristSolutionFieldsDto>>>>`
  - clé de config `grist` : `{ url, apiKey, docId, tableServices, tableSolutions, timeoutMs }`

- [ ] **Step 1 : Ajouter la configuration**

Dans `src/config/configuration.ts`, juste après le bloc `planAction` :

```ts
    grist: {
      url: process.env.GRIST_API_URL,
      apiKey: process.env.GRIST_API_KEY,
      docId: process.env.GRIST_DOC_ID,
      tableServices: process.env.GRIST_TABLE_SERVICES || 'Services',
      tableSolutions: process.env.GRIST_TABLE_SOLUTIONS || 'Solutions',
      timeoutMs: process.env.GRIST_TIMEOUT_MS || 20000
    },
```

Dans `src/config/configuration.schema.ts`, au même niveau que les autres clients :

```ts
  grist: Joi.object({
    url: Joi.string().required(),
    apiKey: Joi.string().required(),
    docId: Joi.string().required(),
    tableServices: Joi.string().required(),
    tableSolutions: Joi.string().required(),
    timeoutMs: Joi.number().required()
  }),
```

- [ ] **Step 2 : Ajouter la clé `grist` à la config de test**

`testConfig()` est défini dans `test/utils/test-config.ts` et réexporté par
`test/utils/module-for-testing.ts`. Ajouter, juste après le bloc `planAction`
(ligne 86) :

```ts
    grist: {
      url: 'https://grist.test',
      apiKey: 'grist-api-key',
      docId: 'doc-test',
      tableServices: 'Services',
      tableSolutions: 'Solutions',
      timeoutMs: 20000
    },
```

- [ ] **Step 3 : Écrire le test du client**

`test/infrastructure/clients/grist-client.test.ts` :

```ts
import axios from 'axios'
import * as nock from 'nock'
import { isFailure, isSuccess } from 'src/building-blocks/types/result'
import { GristClient } from 'src/infrastructure/clients/grist-client'
import { ExternalApiLoggerService } from 'src/utils/external-api-logger.service'
import { expect, stubClass } from 'test/utils'
import { testConfig } from 'test/utils/module-for-testing'

describe('GristClient', () => {
  let client: GristClient
  const config = testConfig()
  const grist = config.get('grist')

  beforeEach(() => {
    const externalApiLogger = stubClass(ExternalApiLoggerService)
    externalApiLogger.createAxios.returns(axios.create())

    client = new GristClient(config, externalApiLogger)
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('recupererServices', () => {
    it('rend les enregistrements de la table Services', async () => {
      // Given
      nock(grist.url)
        .get(`/api/docs/${grist.docId}/tables/${grist.tableServices}/records`)
        .reply(200, {
          records: [{ id: 1, fields: { Nom: 'ONISEP', Description: 'site' } }]
        })

      // When
      const result = await client.recupererServices()

      // Then
      expect(isSuccess(result)).to.equal(true)
      if (isSuccess(result)) {
        expect(result.data).to.deep.equal([
          { id: 1, fields: { Nom: 'ONISEP', Description: 'site' } }
        ])
      }
    })

    it('rend un échec quand Grist répond en erreur', async () => {
      // Given
      nock(grist.url)
        .get(`/api/docs/${grist.docId}/tables/${grist.tableServices}/records`)
        .reply(401)

      // When
      const result = await client.recupererServices()

      // Then
      expect(isFailure(result)).to.equal(true)
    })

    it('rend un échec quand la réponse ne porte pas de records', async () => {
      // Given
      nock(grist.url)
        .get(`/api/docs/${grist.docId}/tables/${grist.tableServices}/records`)
        .reply(200, { erreur: 'Table not found' })

      // When
      const result = await client.recupererServices()

      // Then
      expect(isFailure(result)).to.equal(true)
    })
  })

  describe('recupererSolutions', () => {
    it('rend les enregistrements de la table Solutions', async () => {
      // Given
      nock(grist.url)
        .get(`/api/docs/${grist.docId}/tables/${grist.tableSolutions}/records`)
        .reply(200, { records: [{ id: 1, fields: { Id_technique: 'p-2' } }] })

      // When
      const result = await client.recupererSolutions()

      // Then
      expect(isSuccess(result)).to.equal(true)
    })
  })
})
```

- [ ] **Step 4 : Lancer le test et vérifier qu'il échoue**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/infrastructure/clients/grist-client.test.ts' --exit --timeout 10000
```

Attendu : ÉCHEC — module `grist-client` introuvable.

- [ ] **Step 5 : Écrire le client**

`src/infrastructure/clients/grist-client.ts` :

```ts
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ErreurHttp } from '../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../building-blocks/types/result'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'
import {
  GristRecordDto,
  GristRecordsDto,
  GristServiceFieldsDto,
  GristSolutionFieldsDto
} from './dto/grist.dto'
import { ExternalApiClient } from './external-api-client'

const GRIST_ECHEC = 'La lecture du référentiel Grist a échoué'

@Injectable()
export class GristClient extends ExternalApiClient {
  private readonly apiUrl: string
  private readonly apiKey: string
  private readonly docId: string
  private readonly tableServices: string
  private readonly tableSolutions: string
  private readonly timeoutMs: number

  constructor(
    configService: ConfigService,
    externalApiLogger: ExternalApiLoggerService
  ) {
    super('GristClient', externalApiLogger)
    const config = configService.get('grist')
    this.apiUrl = config.url
    this.apiKey = config.apiKey
    this.docId = config.docId
    this.tableServices = config.tableServices
    this.tableSolutions = config.tableSolutions
    this.timeoutMs = config.timeoutMs
  }

  async recupererServices(): Promise<
    Result<Array<GristRecordDto<GristServiceFieldsDto>>>
  > {
    return this.recupererTable<GristServiceFieldsDto>(this.tableServices)
  }

  async recupererSolutions(): Promise<
    Result<Array<GristRecordDto<GristSolutionFieldsDto>>>
  > {
    return this.recupererTable<GristSolutionFieldsDto>(this.tableSolutions)
  }

  private async recupererTable<T>(
    table: string
  ): Promise<Result<Array<GristRecordDto<T>>>> {
    try {
      const response = await this.axios.get<GristRecordsDto<T>>(
        `${this.apiUrl}/api/docs/${this.docId}/tables/${table}/records`,
        {
          timeout: this.timeoutMs,
          headers: { Authorization: `Bearer ${this.apiKey}` }
        }
      )

      if (!Array.isArray(response.data?.records)) {
        return failure(new ErreurHttp(GRIST_ECHEC, 502))
      }

      return success(response.data.records)
    } catch (_e) {
      return failure(new ErreurHttp(GRIST_ECHEC, 502))
    }
  }
}
```

- [ ] **Step 6 : Lancer le test et vérifier qu'il passe**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/infrastructure/clients/grist-client.test.ts' --exit --timeout 10000
```

Attendu : 4 passing.

- [ ] **Step 7 : Documenter les variables d'environnement**

Ajouter dans `.environment.template` :

```
GRIST_API_URL=https://grist.numerique.gouv.fr
GRIST_API_KEY=
GRIST_DOC_ID=gPz4MmVz5j49
```

- [ ] **Step 8 : Vérifier types et lint, puis commit**

```bash
npx tsc --noEmit -p tsconfig.json && npx eslint --fix src/infrastructure/clients/grist-client.ts src/config test/utils/test-config.ts test/infrastructure/clients/grist-client.test.ts
git add src/infrastructure/clients/grist-client.ts src/config .environment.template test/utils/test-config.ts test/infrastructure/clients/grist-client.test.ts
git commit -m "feat(plan-action): client grist pour le referentiel"
```

---

### Task 3 : Migration, modèles Sequelize et repository

Les deux nouvelles tables et leur accès. **Purement additif** : `referentiel_plan_action_tache` n'est ni renommée ni touchée.

**Files:**
- Create: `src/infrastructure/sequelize/migrations/20260922000000-creer-referentiel-plan-action-grist.js`
- Create: `src/infrastructure/sequelize/models/referentiel-plan-action-service.sql-model.ts`
- Create: `src/infrastructure/sequelize/models/referentiel-plan-action-solution.sql-model.ts`
- Modify: `src/infrastructure/sequelize/models/index.ts`
- Create: `src/infrastructure/repositories/plan-action/referentiel-plan-action-sql.repository.db.ts`
- Test: `test/infrastructure/repositories/plan-action/referentiel-plan-action-sql.repository.db.test.ts`

**Interfaces:**
- Consumes: `ReferentielPlanAction.Service`, `.Solution`, `.Diff`, `.Repository`, `ReferentielPlanActionRepositoryToken`, `PlanAction.TypeTache`, `PlanAction.Destination` (Task 1).
- Produces: `ReferentielPlanActionSqlRepository implements ReferentielPlanAction.Repository`, `ReferentielPlanActionServiceSqlModel`, `ReferentielPlanActionSolutionSqlModel`.

- [ ] **Step 1 : Écrire la migration**

`src/infrastructure/sequelize/migrations/20260922000000-creer-referentiel-plan-action-grist.js` :

```js
'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('referentiel_plan_action_service', {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      nom: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true }
    })

    await queryInterface.createTable('referentiel_plan_action_solution', {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      besoin: { type: Sequelize.STRING, allowNull: true },
      contrainte: { type: Sequelize.STRING, allowNull: true },
      sous_categorie: { type: Sequelize.STRING, allowNull: true },
      besoin_exprime: { type: Sequelize.TEXT, allowNull: true },
      type: { type: Sequelize.STRING, allowNull: false },
      libelle: { type: Sequelize.TEXT, allowNull: false },
      url: { type: Sequelize.TEXT, allowNull: true },
      ecran_app: { type: Sequelize.STRING, allowNull: true },
      id_service: {
        type: Sequelize.STRING,
        allowNull: true,
        references: { model: 'referentiel_plan_action_service', key: 'id' }
      },
      situations: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: []
      },
      authentifications: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: []
      },
      territoires: {
        type: Sequelize.ARRAY(Sequelize.STRING),
        allowNull: false,
        defaultValue: []
      },
      age_min: { type: Sequelize.INTEGER, allowNull: true },
      age_max: { type: Sequelize.INTEGER, allowNull: true },
      domaine: { type: Sequelize.STRING, allowNull: true },
      conversion_ft_thematique: { type: Sequelize.STRING, allowNull: true },
      conversion_ft_demarche: { type: Sequelize.TEXT, allowNull: true },
      conversion_ft_code_pourquoi: { type: Sequelize.STRING, allowNull: true },
      conversion_ft_code_quoi: { type: Sequelize.STRING, allowNull: true },
      conversion_ml_categorie: { type: Sequelize.STRING, allowNull: true },
      conversion_ml_code_categorie: { type: Sequelize.STRING, allowNull: true },
      conversion_ml_action: { type: Sequelize.STRING, allowNull: true },
      conversion_ml_origine: { type: Sequelize.STRING, allowNull: true },
      active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      date_maj: { type: Sequelize.DATE, allowNull: false }
    })

    await queryInterface.addIndex(
      'referentiel_plan_action_solution',
      ['active'],
      { name: 'idx_referentiel_plan_action_solution_active' }
    )
  },

  down: async queryInterface => {
    await queryInterface.dropTable('referentiel_plan_action_solution')
    await queryInterface.dropTable('referentiel_plan_action_service')
  }
}
```

- [ ] **Step 2 : Écrire les modèles Sequelize**

`src/infrastructure/sequelize/models/referentiel-plan-action-service.sql-model.ts` :

```ts
import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'

export class ReferentielPlanActionServiceDto extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.STRING })
  id: string

  @Column({ field: 'nom', type: DataType.STRING })
  nom: string

  @Column({ field: 'description', type: DataType.TEXT })
  description: string | null
}

@Table({ timestamps: false, tableName: 'referentiel_plan_action_service' })
export class ReferentielPlanActionServiceSqlModel extends ReferentielPlanActionServiceDto {}
```

`src/infrastructure/sequelize/models/referentiel-plan-action-solution.sql-model.ts` :

```ts
import {
  BelongsTo,
  Column,
  DataType,
  ForeignKey,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'
import { ReferentielPlanActionServiceSqlModel } from './referentiel-plan-action-service.sql-model'

export class ReferentielPlanActionSolutionDto extends Model {
  @PrimaryKey
  @Column({ field: 'id', type: DataType.STRING })
  id: string

  @Column({ field: 'besoin', type: DataType.STRING })
  besoin: string | null

  @Column({ field: 'contrainte', type: DataType.STRING })
  contrainte: string | null

  @Column({ field: 'sous_categorie', type: DataType.STRING })
  sousCategorie: string | null

  @Column({ field: 'besoin_exprime', type: DataType.TEXT })
  besoinExprime: string | null

  @Column({ field: 'type', type: DataType.STRING })
  type: string

  @Column({ field: 'libelle', type: DataType.TEXT })
  libelle: string

  @Column({ field: 'url', type: DataType.TEXT })
  url: string | null

  @Column({ field: 'ecran_app', type: DataType.STRING })
  ecranApp: string | null

  @ForeignKey(() => ReferentielPlanActionServiceSqlModel)
  @Column({ field: 'id_service', type: DataType.STRING })
  idService: string | null

  @Column({ field: 'situations', type: DataType.ARRAY(DataType.STRING) })
  situations: string[]

  @Column({ field: 'authentifications', type: DataType.ARRAY(DataType.STRING) })
  authentifications: string[]

  @Column({ field: 'territoires', type: DataType.ARRAY(DataType.STRING) })
  territoires: string[]

  @Column({ field: 'age_min', type: DataType.INTEGER })
  ageMin: number | null

  @Column({ field: 'age_max', type: DataType.INTEGER })
  ageMax: number | null

  @Column({ field: 'domaine', type: DataType.STRING })
  domaine: string | null

  @Column({ field: 'conversion_ft_thematique', type: DataType.STRING })
  conversionFtThematique: string | null

  @Column({ field: 'conversion_ft_demarche', type: DataType.TEXT })
  conversionFtDemarche: string | null

  @Column({ field: 'conversion_ft_code_pourquoi', type: DataType.STRING })
  conversionFtCodePourquoi: string | null

  @Column({ field: 'conversion_ft_code_quoi', type: DataType.STRING })
  conversionFtCodeQuoi: string | null

  @Column({ field: 'conversion_ml_categorie', type: DataType.STRING })
  conversionMlCategorie: string | null

  @Column({ field: 'conversion_ml_code_categorie', type: DataType.STRING })
  conversionMlCodeCategorie: string | null

  @Column({ field: 'conversion_ml_action', type: DataType.STRING })
  conversionMlAction: string | null

  @Column({ field: 'conversion_ml_origine', type: DataType.STRING })
  conversionMlOrigine: string | null

  @Column({ field: 'active', type: DataType.BOOLEAN })
  active: boolean

  @Column({ field: 'date_maj', type: DataType.DATE })
  dateMaj: Date
}

@Table({ timestamps: false, tableName: 'referentiel_plan_action_solution' })
export class ReferentielPlanActionSolutionSqlModel extends ReferentielPlanActionSolutionDto {
  @BelongsTo(() => ReferentielPlanActionServiceSqlModel)
  service: ReferentielPlanActionServiceSqlModel
}
```

Puis enregistrer les deux modèles dans `src/infrastructure/sequelize/models/index.ts`, à côté de `ReferentielPlanActionTacheSqlModel` (ligne 87) : ajouter les imports et les deux entrées dans le tableau exporté.

- [ ] **Step 3 : Écrire le test du repository**

`test/infrastructure/repositories/plan-action/referentiel-plan-action-sql.repository.db.test.ts` :

```ts
import { PlanAction } from 'src/domain/plan-action/plan-action'
import { ReferentielPlanAction } from 'src/domain/plan-action/referentiel-plan-action'
import { Profil } from 'src/domain/profil'
import { ReferentielPlanActionSolutionSqlModel } from 'src/infrastructure/sequelize/models/referentiel-plan-action-solution.sql-model'
import { ReferentielPlanActionSqlRepository } from 'src/infrastructure/repositories/plan-action/referentiel-plan-action-sql.repository.db'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('ReferentielPlanActionSqlRepository', () => {
  let repository: ReferentielPlanActionSqlRepository
  let dateService: StubbedClass<DateService>

  const onisep: ReferentielPlanAction.Service = {
    id: '1',
    nom: 'ONISEP',
    description: 'site pour trouver une formation'
  }

  const plafondLarge: ReferentielPlanAction.PlafondDesactivations = {
    pourcentageMax: 100,
    nombreMin: 100
  }

  function uneSolution(
    override: Partial<ReferentielPlanAction.Solution> = {}
  ): ReferentielPlanAction.Solution {
    return {
      id: 'p-2',
      besoin: PlanAction.Besoin.ORIENTER,
      type: PlanAction.TypeTache.LIEN,
      libelle: 'Je consulte des sites',
      url: 'https://www.onisep.fr/',
      service: onisep,
      situations: ['Au collège'],
      authentifications: [Profil.Structure.FRANCE_TRAVAIL],
      territoires: [],
      ...override
    }
  }

  beforeEach(async () => {
    await getDatabase().cleanPG()
    dateService = stubClass(DateService)
    dateService.now.returns(uneDatetime())
    repository = new ReferentielPlanActionSqlRepository(dateService)
  })

  describe('remplacer', () => {
    it('crée les services et les solutions', async () => {
      // When
      const diff = await repository.remplacer([onisep], [uneSolution()], plafondLarge)

      // Then
      expect(diff).to.deep.equal({
        nbCreees: 1,
        nbMisesAJour: 0,
        nbDesactivees: 0
      })
    })

    it('met à jour une solution déjà connue sans la dupliquer', async () => {
      // Given
      await repository.remplacer([onisep], [uneSolution()], plafondLarge)

      // When
      const diff = await repository.remplacer(
        [onisep],
        [uneSolution({ libelle: 'Nouveau libellé' })],
        plafondLarge
      )

      // Then
      expect(diff.nbCreees).to.equal(0)
      expect(diff.nbMisesAJour).to.equal(1)
      const solutions = await repository.trouverSolutions(['p-2'])
      expect(solutions[0].libelle).to.equal('Nouveau libellé')
    })

    it('désactive les solutions absentes du nouveau référentiel', async () => {
      // Given
      await repository.remplacer(
        [onisep],
        [uneSolution(), uneSolution({ id: 'p-3' })],
        plafondLarge
      )

      // When
      const diff = await repository.remplacer([onisep], [uneSolution()], plafondLarge)

      // Then
      expect(diff.nbDesactivees).to.equal(1)
      const desactivee = await ReferentielPlanActionSolutionSqlModel.findByPk(
        'p-3'
      )
      expect(desactivee!.active).to.equal(false)
    })

    it('réactive une solution revenue dans le référentiel', async () => {
      // Given
      await repository.remplacer([onisep], [uneSolution()], plafondLarge)
      await repository.remplacer([onisep], [], plafondLarge)

      // When
      await repository.remplacer([onisep], [uneSolution()], plafondLarge)

      // Then
      const solutions = await repository.trouverSolutions(['p-2'])
      expect(solutions).to.have.length(1)
    })

    it('persiste une solution sans service', async () => {
      // When
      await repository.remplacer(
        [],
        [uneSolution({ service: undefined })],
        plafondLarge
      )

      // Then
      const solutions = await repository.trouverSolutions(['p-2'])
      expect(solutions[0].service).to.equal(undefined)
    })
  })

    it('refuse de désactiver au-delà du plafond et ne touche à rien', async () => {
      // Given
      await repository.remplacer(
        [onisep],
        [
          uneSolution(),
          uneSolution({ id: 'p-3' }),
          uneSolution({ id: 'p-4' })
        ],
        plafondLarge
      )

      // When
      const promesse = repository.remplacer([onisep], [uneSolution()], {
        pourcentageMax: 10,
        nombreMin: 1
      })

      // Then
      await expect(promesse).to.be.rejectedWith(
        'Plafond de désactivations dépassé : 2 > 1'
      )
      const encoreActives = await repository.trouverSolutions([
        'p-2',
        'p-3',
        'p-4'
      ])
      expect(encoreActives).to.have.length(3)
    })
  })

  describe('trouverSolutions', () => {
    it('rend les solutions demandées avec leur service', async () => {
      // Given
      await repository.remplacer([onisep], [uneSolution()], plafondLarge)

      // When
      const solutions = await repository.trouverSolutions(['p-2'])

      // Then
      expect(solutions).to.deep.equal([uneSolution()])
    })

    it('ignore les identifiants inconnus', async () => {
      // Given
      await repository.remplacer([onisep], [uneSolution()], plafondLarge)

      // When
      const solutions = await repository.trouverSolutions(['p-2', 'inconnue'])

      // Then
      expect(solutions).to.have.length(1)
    })

    it('ignore les solutions désactivées', async () => {
      // Given
      await repository.remplacer([onisep], [uneSolution()], plafondLarge)
      await repository.remplacer([onisep], [], plafondLarge)

      // When
      const solutions = await repository.trouverSolutions(['p-2'])

      // Then
      expect(solutions).to.deep.equal([])
    })

    it('rend un tableau vide sans identifiant demandé', async () => {
      // When
      const solutions = await repository.trouverSolutions([])

      // Then
      expect(solutions).to.deep.equal([])
    })
  })
})
```

- [ ] **Step 4 : Lancer la migration sur la base de test et vérifier que le test échoue**

```bash
yarn db:test && yarn migration
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/infrastructure/repositories/plan-action/referentiel-plan-action-sql.repository.db.test.ts' --exit --timeout 10000
```

Attendu : ÉCHEC — module `referentiel-plan-action-sql.repository.db` introuvable.

- [ ] **Step 5 : Écrire le repository**

`src/infrastructure/repositories/plan-action/referentiel-plan-action-sql.repository.db.ts` :

```ts
import { Injectable } from '@nestjs/common'
import { Op } from 'sequelize'
import { PlanAction } from '../../../domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../domain/plan-action/referentiel-plan-action'
import { Profil } from '../../../domain/profil'
import { ReferentielPlanActionServiceSqlModel } from '../../sequelize/models/referentiel-plan-action-service.sql-model'
import { ReferentielPlanActionSolutionSqlModel } from '../../sequelize/models/referentiel-plan-action-solution.sql-model'
import { DateService } from '../../../utils/date-service'

@Injectable()
export class ReferentielPlanActionSqlRepository
  implements ReferentielPlanAction.Repository
{
  constructor(private readonly dateService: DateService) {}

  async remplacer(
    services: ReferentielPlanAction.Service[],
    solutions: ReferentielPlanAction.Solution[],
    plafond: ReferentielPlanAction.PlafondDesactivations
  ): Promise<ReferentielPlanAction.Diff> {
    const maintenant = this.dateService.now().toJSDate()

    const idsRecus = solutions.map(solution => solution.id)
    const existantes = await ReferentielPlanActionSolutionSqlModel.findAll({
      attributes: ['id', 'active']
    })
    const idsExistants = new Set(existantes.map(solution => solution.id))

    const actives = existantes.filter(solution => solution.active)
    const idsRecusSet = new Set(idsRecus)
    const aDesactiver = actives.filter(
      solution => !idsRecusSet.has(solution.id)
    )
    const plafondCalcule = Math.max(
      plafond.nombreMin,
      Math.floor((actives.length * plafond.pourcentageMax) / 100)
    )
    if (aDesactiver.length > plafondCalcule) {
      throw new Error(
        `Plafond de désactivations dépassé : ${aDesactiver.length} > ${plafondCalcule}`
      )
    }

    await ReferentielPlanActionServiceSqlModel.bulkCreate(
      services.map(service => ({
        id: service.id,
        nom: service.nom,
        description: service.description ?? null
      })),
      { updateOnDuplicate: ['nom', 'description'] }
    )

    await ReferentielPlanActionSolutionSqlModel.bulkCreate(
      solutions.map(solution => ({
        id: solution.id,
        besoin: solution.besoin ?? null,
        contrainte: solution.contrainte ?? null,
        sousCategorie: solution.sousCategorie ?? null,
        besoinExprime: solution.besoinExprime ?? null,
        type: solution.type,
        libelle: solution.libelle,
        url: solution.url ?? null,
        ecranApp: solution.ecranApp ?? null,
        idService: solution.service?.id ?? null,
        situations: solution.situations,
        authentifications: solution.authentifications,
        territoires: solution.territoires,
        ageMin: solution.ageMin ?? null,
        ageMax: solution.ageMax ?? null,
        domaine: solution.domaine ?? null,
        conversionFtThematique: solution.conversionFT?.thematique ?? null,
        conversionFtDemarche: solution.conversionFT?.demarche ?? null,
        conversionFtCodePourquoi: solution.conversionFT?.codePourquoi ?? null,
        conversionFtCodeQuoi: solution.conversionFT?.codeQuoi ?? null,
        conversionMlCategorie: solution.conversionML?.categorie ?? null,
        conversionMlCodeCategorie: solution.conversionML?.codeCategorie ?? null,
        conversionMlAction: solution.conversionML?.action ?? null,
        conversionMlOrigine: solution.conversionML?.origine ?? null,
        active: true,
        dateMaj: maintenant
      })),
      {
        updateOnDuplicate: [
          'besoin',
          'contrainte',
          'sousCategorie',
          'besoinExprime',
          'type',
          'libelle',
          'url',
          'ecranApp',
          'idService',
          'situations',
          'authentifications',
          'territoires',
          'ageMin',
          'ageMax',
          'domaine',
          'conversionFtThematique',
          'conversionFtDemarche',
          'conversionFtCodePourquoi',
          'conversionFtCodeQuoi',
          'conversionMlCategorie',
          'conversionMlCodeCategorie',
          'conversionMlAction',
          'conversionMlOrigine',
          'active',
          'dateMaj'
        ]
      }
    )

    const [nbDesactivees] = await ReferentielPlanActionSolutionSqlModel.update(
      { active: false },
      {
        where: {
          active: true,
          ...(idsRecus.length ? { id: { [Op.notIn]: idsRecus } } : {})
        }
      }
    )

    const nbCreees = idsRecus.filter(id => !idsExistants.has(id)).length

    return {
      nbCreees,
      nbMisesAJour: idsRecus.length - nbCreees,
      nbDesactivees
    }
  }

  async trouverSolutions(
    ids: string[]
  ): Promise<ReferentielPlanAction.Solution[]> {
    if (!ids.length) return []

    const solutionsSql = await ReferentielPlanActionSolutionSqlModel.findAll({
      where: { id: { [Op.in]: ids }, active: true },
      include: [ReferentielPlanActionServiceSqlModel]
    })

    return solutionsSql.map(toSolution)
  }
}

function toSolution(
  solutionSql: ReferentielPlanActionSolutionSqlModel
): ReferentielPlanAction.Solution {
  return {
    id: solutionSql.id,
    ...optionnel('besoin', solutionSql.besoin as PlanAction.Besoin | null),
    ...optionnel(
      'contrainte',
      solutionSql.contrainte as PlanAction.Contrainte | null
    ),
    ...optionnel('sousCategorie', solutionSql.sousCategorie),
    ...optionnel('besoinExprime', solutionSql.besoinExprime),
    type: solutionSql.type as PlanAction.TypeTache,
    libelle: solutionSql.libelle,
    ...optionnel('url', solutionSql.url),
    ...optionnel(
      'ecranApp',
      solutionSql.ecranApp as PlanAction.Destination | null
    ),
    ...optionnel('service', toService(solutionSql.service)),
    situations: solutionSql.situations,
    authentifications: solutionSql.authentifications as Profil.Structure[],
    territoires: solutionSql.territoires,
    ...optionnel('ageMin', solutionSql.ageMin),
    ...optionnel('ageMax', solutionSql.ageMax),
    ...optionnel('domaine', solutionSql.domaine),
    ...optionnel('conversionFT', toConversionFT(solutionSql)),
    ...optionnel('conversionML', toConversionML(solutionSql))
  }
}

function toService(
  serviceSql: ReferentielPlanActionServiceSqlModel | undefined | null
): ReferentielPlanAction.Service | undefined {
  if (!serviceSql) return undefined
  return {
    id: serviceSql.id,
    nom: serviceSql.nom,
    ...optionnel('description', serviceSql.description)
  }
}

function toConversionFT(
  solutionSql: ReferentielPlanActionSolutionSqlModel
): ReferentielPlanAction.ConversionFT | undefined {
  const conversion: ReferentielPlanAction.ConversionFT = {
    ...optionnel('thematique', solutionSql.conversionFtThematique),
    ...optionnel('demarche', solutionSql.conversionFtDemarche),
    ...optionnel('codePourquoi', solutionSql.conversionFtCodePourquoi),
    ...optionnel('codeQuoi', solutionSql.conversionFtCodeQuoi)
  }
  return Object.keys(conversion).length ? conversion : undefined
}

function toConversionML(
  solutionSql: ReferentielPlanActionSolutionSqlModel
): ReferentielPlanAction.ConversionML | undefined {
  const conversion: ReferentielPlanAction.ConversionML = {
    ...optionnel('categorie', solutionSql.conversionMlCategorie),
    ...optionnel('codeCategorie', solutionSql.conversionMlCodeCategorie),
    ...optionnel('action', solutionSql.conversionMlAction),
    ...optionnel('origine', solutionSql.conversionMlOrigine)
  }
  return Object.keys(conversion).length ? conversion : undefined
}

function optionnel<K extends string, V>(
  cle: K,
  valeur: V | null | undefined
): Record<K, V> | Record<string, never> {
  return valeur === null || valeur === undefined
    ? {}
    : ({ [cle]: valeur } as Record<K, V>)
}
```

- [ ] **Step 6 : Lancer le test et vérifier qu'il passe**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/infrastructure/repositories/plan-action/referentiel-plan-action-sql.repository.db.test.ts' --exit --timeout 10000
```

Attendu : 10 passing.

- [ ] **Step 7 : Vérifier types et lint, puis commit**

```bash
npx tsc --noEmit -p tsconfig.json && npx eslint --fix src/infrastructure/sequelize src/infrastructure/repositories/plan-action test/infrastructure/repositories/plan-action
git add src/infrastructure/sequelize src/infrastructure/repositories/plan-action test/infrastructure/repositories/plan-action
git commit -m "feat(plan-action): tables et repository du referentiel grist"
```

---

### Task 4 : Le job de mise à jour et son cron

L'orchestration, les garde-fous, et le câblage NestJS.

**Files:**
- Create: `src/application/jobs/maj-referentiel-plan-action.job.handler.db.ts`
- Modify: `src/domain/planificateur.ts:116` (enum `JobType`) et le tableau `CRONS` (~ligne 325)
- Modify: `src/config/configuration.ts` (bloc `jobs`, voisin de `majAgencesFT` ligne 280)
- Modify: `src/config/configuration.schema.ts` (bloc `jobs`, ligne 215)
- Modify: `src/app.module.ts` (providers : `GristClient`, `ReferentielPlanActionRepositoryToken`, `MajReferentielPlanActionJobHandler`)
- Test: `test/application/jobs/maj-referentiel-plan-action.job.handler.test.ts`

**Interfaces:**
- Consumes: `GristClient` (Task 2), `reconcilierReferentiel` (Task 1), `ReferentielPlanAction.Repository` + `ReferentielPlanActionRepositoryToken` (Task 1), `ReferentielPlanActionSqlRepository` (Task 3).
- Produces: `MajReferentielPlanActionJobHandler`, `StatsMajReferentielPlanAction`, `Planificateur.JobType.MAJ_REFERENTIEL_PLAN_ACTION`.

- [ ] **Step 1 : Déclarer le type de job et le cron**

Dans `src/domain/planificateur.ts`, ajouter au bout de l'enum `JobType` (après `MAJ_REFERENTIEL_AGENCES_FT`) :

```ts
    MAJ_REFERENTIEL_PLAN_ACTION = 'MAJ_REFERENTIEL_PLAN_ACTION'
```

Puis dans le tableau `CRONS`, après l'entrée `MAJ_REFERENTIEL_AGENCES_FT` :

```ts
  {
    type: Planificateur.JobType.MAJ_REFERENTIEL_PLAN_ACTION,
    expression: '0 5 1 * *',
    description:
      "Le 1er de chaque mois à 5h. Mise à jour du référentiel du plan d'action depuis Grist."
  }
```

Dans `src/config/configuration.ts`, dans le bloc `jobs`, après `majAgencesFT` :

```ts
      majReferentielPlanAction: {
        dryRun: process.env.JOB_MAJ_REFERENTIEL_PLAN_ACTION_DRY_RUN === 'true',
        pourcentageDesactivationsMax:
          process.env
            .JOB_MAJ_REFERENTIEL_PLAN_ACTION_POURCENTAGE_DESACTIVATIONS_MAX ??
          '10',
        nombreDesactivationsMin:
          process.env
            .JOB_MAJ_REFERENTIEL_PLAN_ACTION_NOMBRE_DESACTIVATIONS_MIN ?? '5'
      }
```

Et dans `src/config/configuration.schema.ts`, dans le bloc `jobs` :

```ts
    majReferentielPlanAction: Joi.object({
      dryRun: Joi.boolean().required(),
      pourcentageDesactivationsMax: Joi.number().required(),
      nombreDesactivationsMin: Joi.number().required()
    })
```

- [ ] **Step 2 : Écrire le test du job**

`test/application/jobs/maj-referentiel-plan-action.job.handler.test.ts` :

```ts
import { ConfigService } from '@nestjs/config'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { MajReferentielPlanActionJobHandler } from 'src/application/jobs/maj-referentiel-plan-action.job.handler.db'
import { failure, success } from 'src/building-blocks/types/result'
import { ErreurHttp } from 'src/building-blocks/types/domain-error'
import { ReferentielPlanAction } from 'src/domain/plan-action/referentiel-plan-action'
import { Planificateur } from 'src/domain/planificateur'
import { SuiviJob } from 'src/domain/suivi-job'
import { GristClient } from 'src/infrastructure/clients/grist-client'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from 'test/utils'

describe('MajReferentielPlanActionJobHandler', () => {
  let handler: MajReferentielPlanActionJobHandler
  let gristClient: StubbedClass<GristClient>
  let repository: StubbedType<ReferentielPlanAction.Repository>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let dateService: StubbedClass<DateService>

  const job: Planificateur.Job<void> = {
    dateExecution: uneDatetime().toJSDate(),
    type: Planificateur.JobType.MAJ_REFERENTIEL_PLAN_ACTION,
    contenu: undefined
  }

  const serviceGrist = {
    id: 1,
    fields: { Nom: 'ONISEP', Description: 'site' }
  }

  const solutionGrist = {
    id: 1,
    fields: {
      Id_technique: 'p-2',
      Envie: "M'orienter",
      Blocage: '',
      Sous_categorie: '',
      Besoin_exprime_par_le_jeune: '',
      Type: 'Lien web',
      Action_affichee_au_jeune: 'Je consulte des sites',
      URL: 'https://www.onisep.fr/',
      Ecran_de_l_app: '',
      Service: 'ONISEP',
      Situations: 'Au collège',
      Authentification: 'France Travail',
      Age_minimum: null,
      Age_maximum: null,
      Territoire: '',
      Domaine: '',
      Conversion_FT_Thematique: '',
      Conversion_FT_Demarche: '',
      Conversion_FT_Code_pourquoi: '',
      Conversion_FT_Code_quoi: '',
      Conversion_ML_Categorie: '',
      Conversion_ML_Code_categorie: '',
      Conversion_ML_Action: '',
      Conversion_ML_Origine_de_l_action: ''
    }
  }

  function unConfigService(dryRun = false): ConfigService {
    return new ConfigService({
      jobs: {
        majReferentielPlanAction: {
          dryRun,
          pourcentageDesactivationsMax: '10',
          nombreDesactivationsMin: '5'
        }
      }
    })
  }

  beforeEach(() => {
    const sandbox = createSandbox()
    gristClient = stubClass(GristClient)
    repository = stubInterface(sandbox)
    suiviJobService = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(uneDatetime())

    handler = new MajReferentielPlanActionJobHandler(
      gristClient,
      repository,
      suiviJobService,
      dateService,
      unConfigService()
    )
  })

  it('importe le référentiel et remonte les compteurs', async () => {
    // Given
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(success([solutionGrist]))
    repository.remplacer.resolves({
      nbCreees: 1,
      nbMisesAJour: 0,
      nbDesactivees: 0
    })

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(suiviJob.succes).to.equal(true)
    expect(suiviJob.resultat).to.deep.equal({
      dryRun: false,
      nbServices: 1,
      nbSolutions: 1,
      nbCreees: 1,
      nbMisesAJour: 0,
      nbDesactivees: 0,
      nbServicesNonResolus: 0,
      nbDoublonsServices: 0,
      nbDoublonsSolutions: 0,
      nbSolutionsEcartees: 0
    })
  })

  it("échoue sans rien écrire quand la lecture des services échoue", async () => {
    // Given
    gristClient.recupererServices.resolves(
      failure(new ErreurHttp('grist ko', 502))
    )
    gristClient.recupererSolutions.resolves(success([solutionGrist]))

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(suiviJob.succes).to.equal(false)
    expect(repository.remplacer).not.to.have.been.called
  })

  it("échoue sans rien écrire quand le Grist ne rend aucune solution", async () => {
    // Given
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(success([]))

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(suiviJob.succes).to.equal(false)
    expect(repository.remplacer).not.to.have.been.called
  })

  it("n'écrit rien en mode dryRun", async () => {
    // Given
    handler = new MajReferentielPlanActionJobHandler(
      gristClient,
      repository,
      suiviJobService,
      dateService,
      unConfigService(true)
    )
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(success([solutionGrist]))

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(repository.remplacer).not.to.have.been.called
    expect(suiviJob.succes).to.equal(true)
    expect((suiviJob.resultat as { dryRun: boolean }).dryRun).to.equal(true)
  })

  it('remonte les anomalies de réconciliation dans le résultat', async () => {
    // Given
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(
      success([
        solutionGrist,
        { id: 2, fields: { ...solutionGrist.fields, Service: 'INCONNU' } }
      ])
    )
    repository.remplacer.resolves({
      nbCreees: 1,
      nbMisesAJour: 0,
      nbDesactivees: 0
    })

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(
      (suiviJob.resultat as { nbDoublonsSolutions: number }).nbDoublonsSolutions
    ).to.equal(1)
  })
})
```

- [ ] **Step 3 : Lancer le test et vérifier qu'il échoue**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/application/jobs/maj-referentiel-plan-action.job.handler.test.ts' --exit --timeout 10000
```

Attendu : ÉCHEC — module `maj-referentiel-plan-action.job.handler.db` introuvable.

- [ ] **Step 4 : Écrire le job handler**

`src/application/jobs/maj-referentiel-plan-action.job.handler.db.ts` :

```ts
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { isFailure } from '../../building-blocks/types/result'
import {
  ReferentielPlanAction,
  ReferentielPlanActionRepositoryToken
} from '../../domain/plan-action/referentiel-plan-action'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { GristClient } from '../../infrastructure/clients/grist-client'
import { DateService } from '../../utils/date-service'
import { reconcilierReferentiel } from './mappers/referentiel-plan-action.mapper'

export interface StatsMajReferentielPlanAction {
  dryRun: boolean
  nbServices: number
  nbSolutions: number
  nbCreees: number
  nbMisesAJour: number
  nbDesactivees: number
  nbServicesNonResolus: number
  nbDoublonsServices: number
  nbDoublonsSolutions: number
  nbSolutionsEcartees: number
}

@Injectable()
@ProcessJobType(Planificateur.JobType.MAJ_REFERENTIEL_PLAN_ACTION)
export class MajReferentielPlanActionJobHandler extends JobHandler<void> {
  constructor(
    private readonly gristClient: GristClient,
    @Inject(ReferentielPlanActionRepositoryToken)
    private readonly referentielRepository: ReferentielPlanAction.Repository,
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    private readonly configService: ConfigService
  ) {
    super(Planificateur.JobType.MAJ_REFERENTIEL_PLAN_ACTION, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const debutExecutionJob = this.dateService.now()
    const config = this.configService.get('jobs').majReferentielPlanAction
    const stats: StatsMajReferentielPlanAction = {
      dryRun: config.dryRun,
      nbServices: 0,
      nbSolutions: 0,
      nbCreees: 0,
      nbMisesAJour: 0,
      nbDesactivees: 0,
      nbServicesNonResolus: 0,
      nbDoublonsServices: 0,
      nbDoublonsSolutions: 0,
      nbSolutionsEcartees: 0
    }
    let succes = true

    try {
      const servicesResult = await this.gristClient.recupererServices()
      if (isFailure(servicesResult)) {
        throw new Error(
          `Lecture des services Grist échouée : ${servicesResult.error.message}`
        )
      }

      const solutionsResult = await this.gristClient.recupererSolutions()
      if (isFailure(solutionsResult)) {
        throw new Error(
          `Lecture des solutions Grist échouée : ${solutionsResult.error.message}`
        )
      }
      if (solutionsResult.data.length === 0) {
        throw new Error("Le référentiel Grist du plan d'action est vide")
      }

      const reconciliation = reconcilierReferentiel(
        servicesResult.data,
        solutionsResult.data
      )

      stats.nbServices = reconciliation.services.length
      stats.nbSolutions = reconciliation.solutions.length
      stats.nbServicesNonResolus =
        reconciliation.anomalies.nbServicesNonResolus
      stats.nbDoublonsServices = reconciliation.anomalies.nbDoublonsServices
      stats.nbDoublonsSolutions = reconciliation.anomalies.nbDoublonsSolutions
      stats.nbSolutionsEcartees = reconciliation.anomalies.nbSolutionsEcartees

      if (!config.dryRun) {
        const diff = await this.referentielRepository.remplacer(
          reconciliation.services,
          reconciliation.solutions,
          {
            pourcentageMax: parseInt(config.pourcentageDesactivationsMax, 10),
            nombreMin: parseInt(config.nombreDesactivationsMin, 10)
          }
        )
        stats.nbCreees = diff.nbCreees
        stats.nbMisesAJour = diff.nbMisesAJour
        stats.nbDesactivees = diff.nbDesactivees
      }
    } catch (e) {
      this.logger.error(e)
      succes = false
    }

    return {
      jobType: this.jobType,
      nbErreurs: succes ? 0 : 1,
      succes,
      dateExecution: debutExecutionJob,
      tempsExecution: DateService.calculerTempsExecution(debutExecutionJob),
      resultat: stats
    }
  }
}
```

- [ ] **Step 5 : Lancer le test et vérifier qu'il passe**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/application/jobs/maj-referentiel-plan-action.job.handler.test.ts' --exit --timeout 10000
```

Attendu : 5 passing.

- [ ] **Step 6 : Câbler dans `app.module.ts`**

Ajouter les imports et, dans le tableau `providers` :

```ts
    GristClient,
    {
      provide: ReferentielPlanActionRepositoryToken,
      useClass: ReferentielPlanActionSqlRepository
    },
```

Et `MajReferentielPlanActionJobHandler` dans la liste des job handlers (à côté de `RecupererSituationsJeunesMiloJobHandler`, ligne ~977).

- [ ] **Step 7 : Vérifier l'ensemble**

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint --fix src test
yarn test:local:unit
yarn test:local:db
```

Attendu : aucune erreur de type, aucune erreur de lint, toutes les suites vertes.

- [ ] **Step 8 : Commit**

```bash
git add src/application/jobs src/domain/planificateur.ts src/config src/app.module.ts test/application/jobs
git commit -m "feat(plan-action): job mensuel de mise a jour du referentiel depuis grist"
```

---

## Après l'étape 1

1. **Lancer le job une première fois en `dryRun`** sur staging
   (`JOB_MAJ_REFERENTIEL_PLAN_ACTION_DRY_RUN=true`) via
   `PlanifierExecutionCronCommandHandler`, et lire les compteurs du `SuiviJob`.
2. **Valider les colonnes texte libre** restées en suspens (H5) :
   `Situations`, `Authentification`, `Territoire`, `Ecran_de_l_app`. Le compteur
   `nbSolutionsEcartees` et les logs `referentiel_solution_ecartee` disent
   exactement quelles valeurs ne sont pas couvertes.
3. **Relancer sans `dryRun`** une fois les correspondances complètes.
4. **Étape 2** : domaine `PlanAction` (entités, `Generateur`, `Repository`,
   `Factory`), bascule de `plan_action_tache` sur
   `referentiel_plan_action_solution`, suppression de l'upsert et de
   `referentiel_plan_action_tache`, adaptateur POC réduit aux identifiants.
   Elle aura son propre plan, écrit une fois les valeurs réelles du Grist
   connues.
