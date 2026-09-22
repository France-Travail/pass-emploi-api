# Domaine PlanAction — Plan d'implémentation (étape 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au plan d'action un domaine propre — entités, générateur derrière une interface, factory d'identifiants, repository — pour que le remplacement du POC externe par une solution interne soit l'écriture d'une classe et rien d'autre.

**Architecture:** Un générateur, quel qu'il soit, rend une `Suggestion` : des titres, des thèmes et des identifiants de solutions. Une `Factory` résout ces identifiants contre le référentiel importé du Grist à l'étape 1, attribue nos propres uuid, et produit un `PlanAction`. Le contrat HTTP reste en anglais, les mappers traduisent à la frontière.

**Tech Stack:** NestJS 11, TypeScript 5.9, Sequelize 6 + PostgreSQL 14, Luxon, Mocha + Chai + Sinon + Nock.

**Spec:** `docs/superpowers/specs/2026-09-21-domaine-plan-action-design.md` (sections 8 à 11)

## Global Constraints

- **Yarn uniquement**, jamais npm.
- **Prettier** : `tabWidth: 2`, `semi: false`, `singleQuote: true`, `trailingComma: "none"`, `arrowParens: "avoid"`.
- **Guillemets** : string sans apostrophe → `'simples'` ; avec apostrophe → `"doubles"`. Vaut aussi dans les `it()` et `describe()`.
- **Aucun commentaire** dans le code livré, sauf `// Given` / `// When` / `// Then` dans les tests et un `// TODO:` actionnable.
- **ESLint** : pas de `console`, pas de `process.env` hors `src/config/`, pas de `any`, type de retour explicite sur toute fonction.
- **Logs ECS** : `rootLogger` uniquement. Un `event.action` ne se crée **que si** les deux conditions cumulatives de `pass-emploi-tools/docs/logs-ecs/conventions.md:28-57` sont remplies : on va l'agréger, **et** l'état n'est pas déjà capturé ailleurs. Les détails de diagnostic vont sous `labels.*` en snake_case. Jamais d'exception brute passée à un logger : `toEcsError(e)` d'abord.
- **Lexique français dans le domaine** : `besoin`, `contrainte`, `objectif`, `tache`, `solution`. Le contrat HTTP garde `goals`, `obstacles`, `objectives`, `actions`.
- **Result monad** : pas d'exception métier, `failure()` / `success()`.
- **Nommage** : `{Entité}SqlRepository`, `{Entité}SqlModel`, fichiers touchant la base en `*.db.ts`, tests en `*.test.ts` / `*.db.test.ts`.

## Ce que l'étape 1 a livré et sur quoi ce plan s'appuie

- `src/domain/plan-action/plan-action.ts` — namespace `PlanAction` avec `TypeTache`, `Destination` (5 valeurs), `Besoin` (11), `Contrainte` (12).
- `src/domain/plan-action/referentiel-plan-action.ts` — `ReferentielPlanAction.Service`, `.Solution`, `.Repository` avec `trouverSolutions(ids): Promise<Solution[]>`, et `ReferentielPlanActionRepositoryToken`.
- `referentiel_plan_action_service` et `referentiel_plan_action_solution` en base, alimentées par le cron mensuel.
- L'ancienne `referentiel_plan_action_tache` vit encore, alimentée par l'upsert de `PlanActionSqlRepository.save()`. **C'est ce plan qui la supprime.**

## Décision tranchée en ouverture de cette étape

`DestinationActionPlan` (contrat HTTP) **passe de 3 à 5 valeurs** et s'aligne sur `PlanAction.Destination`. Le Grist porte `offres-emploi` et `aller-vers` ; les écarter amputerait le référentiel, les dégrader en conseil rendrait des tâches inertes. Le contrat change déjà dans cette étape (identifiants internes) : une seule rupture mobile plutôt que deux.

---

### Task 1 : Le domaine PlanAction — entités, interfaces, factory

Le cœur. `Suggestion` (ce que produit un générateur) est distinct de `PlanAction` (ce que nous possédons) : c'est la confusion des deux qui fait que, aujourd'hui, les identifiants du POC sont nos clés primaires.

**Files:**
- Modify: `src/domain/plan-action/plan-action.ts`
- Test: `test/domain/plan-action/plan-action.test.ts`

**Interfaces:**
- Consumes: `PlanAction.TypeTache`, `.Destination`, `.Besoin`, `.Contrainte`, `ReferentielPlanAction.Solution` (étape 1).
- Produces:
  - `PlanAction` — `{ id, idJeune, dateCreation, objectifs }`
  - `PlanAction.Objectif` — `{ id, titre, theme, taches }`
  - `PlanAction.Tache` — `{ id, idSolution, terminee, dateCreation, dateTerminee? }`
  - `PlanAction.Profil`, `PlanAction.Commune`
  - `PlanAction.Suggestion` — `{ accroche, genereLe, generateur, objectifs: SuggestionObjectif[] }`
  - `PlanAction.SuggestionObjectif` — `{ titre, theme, idsSolutions: string[] }`
  - `PlanAction.Generateur` — `genererPlan(profil): Promise<Result<Suggestion>>`
  - `PlanAction.Repository` — `save(plan): Promise<void>`, `getDernierPlan(idJeune): Promise<PlanAction | undefined>`
  - `PlanAction.Factory` — `creer(idJeune, suggestion, solutions): Result<PlanAction>`
  - `PlanActionRepositoryToken`, `GenerateurDePlanActionToken`

- [ ] **Step 1 : Écrire les types, sans la factory**

Ajouter en tête de `src/domain/plan-action/plan-action.ts`, avant le `namespace` :

```ts
import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../../building-blocks/types/domain-error'
import { failure, Result, success } from '../../building-blocks/types/result'
import { Profil } from '../profil'
import { IdService } from '../../utils/id-service'
import { DateService } from '../../utils/date-service'
import { ReferentielPlanAction } from './referentiel-plan-action'

export const PlanActionRepositoryToken = 'PlanActionRepositoryToken'
export const GenerateurDePlanActionToken = 'GenerateurDePlanActionToken'

export interface PlanAction {
  id: string
  idJeune: string
  dateCreation: DateTime
  objectifs: PlanAction.Objectif[]
}
```

Puis, **à l'intérieur** du `namespace PlanAction` existant, après les énumérations :

```ts
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

  export interface Commune {
    codeInsee: string
    nom: string
  }

  export interface Profil {
    structure: ProfilStructure
    situation: string
    besoins: Besoin[]
    contraintes: Contrainte[]
    dateNaissance?: DateTime
    domaine?: string
    habitation?: Commune
    villeRecherche?: Commune
    rayonKm?: number
  }

  export interface SuggestionObjectif {
    titre: string
    theme: string
    idsSolutions: string[]
  }

  export interface Suggestion {
    accroche: string
    genereLe: DateTime
    generateur: string
    objectifs: SuggestionObjectif[]
  }

  export interface Generateur {
    genererPlan(profil: Profil): Promise<Result<Suggestion>>
  }

  export interface Repository {
    save(plan: PlanAction): Promise<void>

    getDernierPlan(idJeune: string): Promise<PlanAction | undefined>
  }
```

`ProfilStructure` est un alias d'import à poser en tête du fichier pour éviter la collision entre `PlanAction.Profil` et le namespace `Profil` du domaine :

```ts
type ProfilStructure = Profil.Structure
```

- [ ] **Step 2 : Écrire les tests de la factory**

`test/domain/plan-action/plan-action.test.ts` :

```ts
import { PlanAction } from 'src/domain/plan-action/plan-action'
import { ReferentielPlanAction } from 'src/domain/plan-action/referentiel-plan-action'
import { Profil } from 'src/domain/profil'
import { MauvaiseCommandeError } from 'src/building-blocks/types/domain-error'
import { failure, isSuccess } from 'src/building-blocks/types/result'
import { DateService } from 'src/utils/date-service'
import { IdService } from 'src/utils/id-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'

describe('PlanAction.Factory', () => {
  let factory: PlanAction.Factory
  let idService: StubbedClass<IdService>
  let dateService: StubbedClass<DateService>

  const maintenant = uneDatetime()

  function uneSolution(
    id: string
  ): ReferentielPlanAction.Solution {
    return {
      id,
      type: PlanAction.TypeTache.LIEN,
      libelle: 'Je consulte des sites',
      situations: [],
      authentifications: [Profil.Structure.FRANCE_TRAVAIL],
      territoires: []
    }
  }

  function uneSuggestion(
    idsSolutions: string[][] = [['p-2']]
  ): PlanAction.Suggestion {
    return {
      accroche: 'Bonjour',
      genereLe: maintenant,
      generateur: 'llm',
      objectifs: idsSolutions.map((ids, index) => ({
        titre: `Objectif ${index}`,
        theme: 'apprenticeship',
        idsSolutions: ids
      }))
    }
  }

  beforeEach(() => {
    idService = stubClass(IdService)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)

    let compteur = 0
    idService.uuid.callsFake(() => `uuid-${compteur++}`)

    factory = new PlanAction.Factory(idService, dateService)
  })

  it('attribue nos propres identifiants au plan, aux objectifs et aux tâches', () => {
    // When
    const result = factory.creer('jeune-1', uneSuggestion(), [
      uneSolution('p-2')
    ])

    // Then
    expect(isSuccess(result)).to.equal(true)
    if (isSuccess(result)) {
      expect(result.data.id).to.equal('uuid-0')
      expect(result.data.objectifs[0].id).to.equal('uuid-1')
      expect(result.data.objectifs[0].taches[0].id).to.equal('uuid-2')
      expect(result.data.objectifs[0].taches[0].idSolution).to.equal('p-2')
    }
  })

  it('pose le jeune, la date de création et des tâches non terminées', () => {
    // When
    const result = factory.creer('jeune-1', uneSuggestion(), [
      uneSolution('p-2')
    ])

    // Then
    if (isSuccess(result)) {
      expect(result.data.idJeune).to.equal('jeune-1')
      expect(result.data.dateCreation).to.deep.equal(maintenant)
      expect(result.data.objectifs[0].taches[0].terminee).to.equal(false)
      expect(result.data.objectifs[0].taches[0].dateTerminee).to.equal(
        undefined
      )
    }
  })

  it('écarte les identifiants de solution absents du référentiel', () => {
    // When
    const result = factory.creer(
      'jeune-1',
      uneSuggestion([['p-2', 'inconnue']]),
      [uneSolution('p-2')]
    )

    // Then
    if (isSuccess(result)) {
      expect(result.data.objectifs[0].taches).to.have.length(1)
      expect(result.data.objectifs[0].taches[0].idSolution).to.equal('p-2')
    }
  })

  it('écarte les objectifs devenus vides', () => {
    // When
    const result = factory.creer(
      'jeune-1',
      uneSuggestion([['p-2'], ['inconnue']]),
      [uneSolution('p-2')]
    )

    // Then
    if (isSuccess(result)) {
      expect(result.data.objectifs).to.have.length(1)
      expect(result.data.objectifs[0].titre).to.equal('Objectif 0')
    }
  })

  it('échoue quand aucun objectif ne survit au filtrage', () => {
    // When
    const result = factory.creer('jeune-1', uneSuggestion([['inconnue']]), [
      uneSolution('p-2')
    ])

    // Then
    expect(result).to.deep.equal(
      failure(
        new MauvaiseCommandeError(
          "Aucune solution du plan d'action généré n'est présente dans le référentiel"
        )
      )
    )
  })

  it('déduplique les identifiants répétés dans un même objectif', () => {
    // When
    const result = factory.creer(
      'jeune-1',
      uneSuggestion([['p-2', 'p-2']]),
      [uneSolution('p-2')]
    )

    // Then
    if (isSuccess(result)) {
      expect(result.data.objectifs[0].taches).to.have.length(1)
    }
  })
})
```

- [ ] **Step 3 : Lancer les tests et vérifier qu'ils échouent**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/domain/plan-action/plan-action.test.ts' --exit --timeout 10000
```

Attendu : ÉCHEC — `PlanAction.Factory is not a constructor`.

- [ ] **Step 4 : Écrire la factory**

À ajouter dans le `namespace PlanAction` :

```ts
  export class Factory {
    constructor(
      private readonly idService: IdService,
      private readonly dateService: DateService
    ) {}

    creer(
      idJeune: string,
      suggestion: Suggestion,
      solutions: ReferentielPlanAction.Solution[]
    ): Result<PlanAction> {
      const idsConnus = new Set(solutions.map(solution => solution.id))
      const maintenant = this.dateService.now()
      const id = this.idService.uuid()

      const objectifs = suggestion.objectifs
        .map(objectif => this.construireObjectif(objectif, idsConnus, maintenant))
        .filter((objectif): objectif is Objectif => objectif !== undefined)

      if (!objectifs.length) {
        return failure(
          new MauvaiseCommandeError(
            "Aucune solution du plan d'action généré n'est présente dans le référentiel"
          )
        )
      }

      return success({ id, idJeune, dateCreation: maintenant, objectifs })
    }

    private construireObjectif(
      objectif: SuggestionObjectif,
      idsConnus: Set<string>,
      maintenant: DateTime
    ): Objectif | undefined {
      const idsRetenus = Array.from(new Set(objectif.idsSolutions)).filter(
        idSolution => idsConnus.has(idSolution)
      )
      if (!idsRetenus.length) return undefined

      return {
        id: this.idService.uuid(),
        titre: objectif.titre,
        theme: objectif.theme,
        taches: idsRetenus.map(idSolution => ({
          id: this.idService.uuid(),
          idSolution,
          terminee: false,
          dateCreation: maintenant
        }))
      }
    }
  }
```

> **L'ordre des appels à `idService.uuid()` est asserté par le premier test** : le plan d'abord (`uuid-0`), puis chaque objectif, puis ses tâches. D'où l'identifiant du plan tiré en tête de méthode plutôt qu'au moment de construire l'objet retourné. Si tu déplaces cet appel, corrige aussi les valeurs attendues dans le test — ne laisse pas les deux diverger.

- [ ] **Step 5 : Lancer les tests et vérifier qu'ils passent**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/domain/plan-action/plan-action.test.ts' --exit --timeout 10000
```

Attendu : 6 passing.

- [ ] **Step 6 : Vérifier types et lint, puis commit**

```bash
npx tsc --noEmit -p tsconfig.json && npx eslint --fix src/domain/plan-action test/domain/plan-action
git add src/domain/plan-action test/domain/plan-action
git commit -m "feat(plan-action): domaine, suggestion et factory d'identifiants"
```

---

### Task 2 : L'adaptateur POC, réduit aux identifiants

Le `PlanActionClient` devient une implémentation de `PlanAction.Generateur`. C'est du code **jetable** : il part quand le POC part. On n'y investit que le strict nécessaire.

**Files:**
- Modify: `src/infrastructure/clients/plan-action-client.ts`
- Create: `src/infrastructure/clients/mappers/plan-action-poc.mapper.ts`
- Test: `test/infrastructure/clients/plan-action-client.test.ts`
- Test: `test/infrastructure/clients/mappers/plan-action-poc.mapper.test.ts`

**Interfaces:**
- Consumes: `PlanAction.Generateur`, `.Profil`, `.Suggestion` (Task 1) ; `ProfileDto`, `PlanDto` (`src/infrastructure/clients/dto/plan-action.dto.ts`, inchangé).
- Produces: `PlanActionClient implements PlanAction.Generateur`, plus `toProfileDto(profil): ProfileDto` et `toSuggestion(plan: PlanDto): PlanAction.Suggestion` dans le mapper POC.

- [ ] **Step 1 : Écrire les tests du mapper POC**

`test/infrastructure/clients/mappers/plan-action-poc.mapper.test.ts` :

```ts
import { DateTime } from 'luxon'
import { PlanAction } from 'src/domain/plan-action/plan-action'
import { Profil } from 'src/domain/profil'
import { PlanDto } from 'src/infrastructure/clients/dto/plan-action.dto'
import {
  toProfileDto,
  toSuggestion
} from 'src/infrastructure/clients/mappers/plan-action-poc.mapper'
import { expect } from 'test/utils'

describe('plan-action-poc.mapper', () => {
  describe('toSuggestion', () => {
    const planDto: PlanDto = {
      id: 'plan-poc-1',
      greeting: 'Bonjour Camille',
      generatedAt: '2026-09-22T10:00:00.000Z',
      generator: 'llm',
      objectives: [
        {
          id: 'obj-poc-1',
          title: 'Trouver une alternance',
          theme: 'apprenticeship',
          actions: [
            {
              id: 'p-2',
              label: 'ignoré',
              kind: 'link',
              done: false
            },
            {
              id: 'p-7',
              label: 'ignoré aussi',
              kind: 'advice',
              done: false
            }
          ]
        }
      ]
    }

    it("ne retient que les identifiants de solution, jamais le contenu", () => {
      // When
      const suggestion = toSuggestion(planDto)

      // Then
      expect(suggestion.objectifs).to.deep.equal([
        {
          titre: 'Trouver une alternance',
          theme: 'apprenticeship',
          idsSolutions: ['p-2', 'p-7']
        }
      ])
    })

    it("reporte l'accroche, la date et le générateur", () => {
      // When
      const suggestion = toSuggestion(planDto)

      // Then
      expect(suggestion.accroche).to.equal('Bonjour Camille')
      expect(suggestion.generateur).to.equal('llm')
      expect(suggestion.genereLe.toISO()).to.equal(
        DateTime.fromISO('2026-09-22T10:00:00.000Z').toISO()
      )
    })
  })

  describe('toProfileDto', () => {
    const profil: PlanAction.Profil = {
      structure: Profil.Structure.MILO,
      situation: 'LYCEE',
      besoins: [PlanAction.Besoin.ALTERNANCE],
      contraintes: [PlanAction.Contrainte.PAS_DE_PERMIS],
      dateNaissance: DateTime.fromISO('2006-03-14T00:00:00.000+02:00', {
        setZone: true
      })
    }

    it('compose le profil attendu par le service', () => {
      // When
      const dto = toProfileDto(profil)

      // Then
      expect(dto.authProvider).to.equal('mission-locale')
      expect(dto.situation).to.equal('LYCEE')
      expect(dto.goals).to.deep.equal(['ALTERNANCE'])
      expect(dto.obstacles).to.deep.equal(['PAS_DE_PERMIS'])
      expect(dto.dateNaissance).to.equal('2006-03-14')
    })

    it('omet la date de naissance quand elle est absente', () => {
      // When
      const dto = toProfileDto({ ...profil, dateNaissance: undefined })

      // Then
      expect(dto.dateNaissance).to.equal(undefined)
    })
  })
})
```

- [ ] **Step 2 : Lancer et vérifier l'échec**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/infrastructure/clients/mappers/plan-action-poc.mapper.test.ts' --exit --timeout 10000
```

Attendu : ÉCHEC — module `plan-action-poc.mapper` introuvable.

- [ ] **Step 3 : Écrire le mapper POC**

`src/infrastructure/clients/mappers/plan-action-poc.mapper.ts` :

```ts
import { DateTime } from 'luxon'
import { PlanAction } from '../../../domain/plan-action/plan-action'
import { estInvite, estMilo } from '../../../domain/profil'
import { Profil } from '../../../domain/profil'
import {
  AuthProviderDto,
  CommuneDto,
  GoalDto,
  ObstacleDto,
  PlanDto,
  ProfileDto,
  SituationDto
} from '../dto/plan-action.dto'

export function toSuggestion(plan: PlanDto): PlanAction.Suggestion {
  return {
    accroche: plan.greeting,
    genereLe: DateTime.fromISO(plan.generatedAt),
    generateur: plan.generator,
    objectifs: plan.objectives.map(objective => ({
      titre: objective.title,
      theme: objective.theme,
      idsSolutions: objective.actions.map(action => action.id)
    }))
  }
}

export function toProfileDto(profil: PlanAction.Profil): ProfileDto {
  const dateNaissance = profil.dateNaissance?.toISODate() ?? undefined

  return {
    authProvider: authProvider(profil.structure),
    situation: profil.situation as SituationDto,
    goals: profil.besoins as unknown as GoalDto[],
    obstacles: profil.contraintes as unknown as ObstacleDto[],
    ...(dateNaissance ? { dateNaissance } : {}),
    ...(profil.domaine !== undefined ? { domaine: profil.domaine } : {}),
    ...(profil.habitation
      ? { habitation: toCommuneDto(profil.habitation) }
      : {}),
    ...(profil.villeRecherche
      ? { villeRecherche: toCommuneDto(profil.villeRecherche) }
      : {}),
    ...(profil.rayonKm !== undefined ? { rayonKm: profil.rayonKm } : {})
  }
}

function authProvider(structure: Profil.Structure): AuthProviderDto {
  if (estInvite(structure)) return 'guest'
  if (estMilo(structure)) return 'mission-locale'
  return 'france-travail'
}

function toCommuneDto(commune: PlanAction.Commune): CommuneDto {
  return { codeInsee: commune.codeInsee, nom: commune.nom }
}
```

> Les `as unknown as` sur `goals` et `obstacles` sont volontaires et **temporaires** : les valeurs de `PlanAction.Besoin` et `GoalDto` coïncident exactement (vérifié à l'étape 1, 11 contre 11 et 12 contre 12). Ils disparaissent avec l'adaptateur POC. Si tsc les refuse, écris des tables de correspondance explicites plutôt que d'introduire un `any`.

- [ ] **Step 4 : Réécrire le client comme générateur**

Dans `src/infrastructure/clients/plan-action-client.ts`, remplacer la méthode `genererPlan(profile: ProfileDto): Promise<Result<PlanDto>>` par l'implémentation de l'interface :

```ts
@Injectable()
export class PlanActionClient
  extends ExternalApiClient
  implements PlanAction.Generateur
{
  async genererPlan(
    profil: PlanAction.Profil
  ): Promise<Result<PlanAction.Suggestion>> {
    try {
      const body: GenererPlanActionRequestDto = {
        profile: toProfileDto(profil),
        ...(this.modele ? { model: this.modele } : {})
      }

      const response = await this.axios.post<GenererPlanActionResponseDto>(
        `${this.apiUrl}/v1/action-plans`,
        body,
        {
          timeout: this.timeoutMs,
          headers: { Authorization: `Bearer ${this.apiKey}` }
        }
      )

      const plan = response.data?.plan
      if (
        !plan ||
        !Array.isArray(plan.objectives) ||
        plan.objectives.some(objective => !Array.isArray(objective.actions))
      ) {
        return failure(new ErreurHttp(PLAN_ACTION_ECHEC, 502))
      }

      return success(toSuggestion(plan))
    } catch (e) {
      return handlePlanActionError(e)
    }
  }
}
```

Le reste du fichier (constructeur, `PLAN_ACTION_ECHEC`, `handlePlanActionError`) est inchangé, à ceci près que `handlePlanActionError` rend désormais `Result<PlanAction.Suggestion>`.

- [ ] **Step 5 : Adapter le test du client**

Dans `test/infrastructure/clients/plan-action-client.test.ts`, les appels deviennent `genererPlan(unProfil)` où `unProfil` est un `PlanAction.Profil`, et les assertions de succès portent sur une `Suggestion` (donc sur `idsSolutions`, pas sur des libellés). Garde toutes les assertions d'échec existantes (502, 504 sur timeout) : elles ne changent pas.

- [ ] **Step 6 : Lancer, vérifier, commit**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/infrastructure/clients/mappers/plan-action-poc.mapper.test.ts' 'test/infrastructure/clients/plan-action-client.test.ts' --exit --timeout 10000
npx tsc --noEmit -p tsconfig.json
npx eslint --fix src/infrastructure/clients test/infrastructure/clients
```

`tsc` signalera que `GenererPlanActionCommandHandler` ne compile plus : **c'est attendu**, la tâche 4 le réécrit. Note-le dans ton rapport et ne le corrige pas ici.

```bash
git add src/infrastructure/clients test/infrastructure/clients
git commit -m "feat(plan-action): adaptateur poc reduit aux identifiants de solution"
```

---

### Task 3 : Bascule du schéma et du repository

`plan_action_tache` pointe vers l'ancienne table de référentiel. On la fait pointer vers la nouvelle, on supprime l'ancienne, et le repository cesse d'upserter quoi que ce soit.

**Files:**
- Create: `src/infrastructure/sequelize/migrations/20260923000000-basculer-plan-action-sur-referentiel-grist.js`
- Modify: `src/infrastructure/sequelize/models/plan-action-tache.sql-model.ts`
- Delete: `src/infrastructure/sequelize/models/referentiel-plan-action-tache.sql-model.ts`
- Modify: `src/infrastructure/sequelize/models/index.ts`
- Modify: `src/infrastructure/repositories/plan-action/plan-action-sql.repository.db.ts`
- Test: `test/infrastructure/repositories/plan-action/plan-action-sql.repository.db.test.ts`

**Interfaces:**
- Consumes: `PlanAction`, `PlanAction.Repository`, `PlanActionRepositoryToken` (Task 1).
- Produces: `PlanActionSqlRepository implements PlanAction.Repository`, colonne `plan_action_tache.id_solution`.

**Reprise de données : aucune.** `appJeuneActif` est à `false` en production et la base y est vide (H3 de la spec, confirmé). Les données de recette sont jetables.

- [ ] **Step 1 : Écrire la migration**

`src/infrastructure/sequelize/migrations/20260923000000-basculer-plan-action-sur-referentiel-grist.js` :

```js
'use strict'

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('plan_action_tache', null, {})
    await queryInterface.bulkDelete('plan_action_objectif', null, {})
    await queryInterface.bulkDelete('plan_action', null, {})

    await queryInterface.removeColumn('plan_action_tache', 'id_tache_referentiel')
    await queryInterface.addColumn('plan_action_tache', 'id_solution', {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: 'referentiel_plan_action_solution',
        key: 'id'
      }
    })

    await queryInterface.dropTable('referentiel_plan_action_tache')
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('referentiel_plan_action_tache', {
      id: { type: Sequelize.STRING, primaryKey: true, allowNull: false },
      label: { type: Sequelize.STRING, allowNull: false },
      type: { type: Sequelize.STRING, allowNull: false },
      deeplink: { type: Sequelize.STRING, allowNull: true },
      url: { type: Sequelize.STRING, allowNull: true },
      nom_service: { type: Sequelize.STRING, allowNull: true },
      nom_description: { type: Sequelize.STRING, allowNull: true }
    })

    await queryInterface.bulkDelete('plan_action_tache', null, {})
    await queryInterface.removeColumn('plan_action_tache', 'id_solution')
    await queryInterface.addColumn('plan_action_tache', 'id_tache_referentiel', {
      type: Sequelize.STRING,
      allowNull: false,
      references: {
        model: 'referentiel_plan_action_tache',
        key: 'id'
      }
    })
  }
}
```

> La purge des trois tables en tête du `up` est ce qui rend la bascule possible : une colonne `NOT NULL` avec clé étrangère ne peut pas être ajoutée à des lignes existantes sans valeur. C'est autorisé **parce que** la production est vide ; le `down` purge symétriquement.

- [ ] **Step 2 : Adapter les modèles Sequelize**

Dans `src/infrastructure/sequelize/models/plan-action-tache.sql-model.ts`, remplacer le champ référentiel :

```ts
  @ForeignKey(() => ReferentielPlanActionSolutionSqlModel)
  @Column({ field: 'id_solution', type: DataType.STRING })
  idSolution: string
```

et l'association :

```ts
  @BelongsTo(() => ReferentielPlanActionSolutionSqlModel)
  solution: ReferentielPlanActionSolutionSqlModel
```

L'import passe de `./referentiel-plan-action-tache.sql-model` à `./referentiel-plan-action-solution.sql-model`.

Supprimer `src/infrastructure/sequelize/models/referentiel-plan-action-tache.sql-model.ts`, et retirer son import **et** son entrée du tableau dans `src/infrastructure/sequelize/models/index.ts`.

- [ ] **Step 3 : Écrire les tests du repository**

Réécrire `test/infrastructure/repositories/plan-action/plan-action-sql.repository.db.test.ts`.

⚠️ **Le constructeur change** : `PlanActionSqlRepository` perd `IdService` et `DateService` (les identifiants et les dates viennent de la factory). L'instanciation du `beforeEach` passe donc de trois arguments à un seul :

```ts
    planActionSqlRepository = new PlanActionSqlRepository(database.sequelize)
```

`idService` reste nécessaire au `beforeEach` pour construire le `JeuneSqlRepository`, mais n'est plus passé au repository sous test. La création du conseiller puis du jeune est conservée telle quelle ; il faut en plus insérer une solution de référentiel, puisque `id_solution` est une clé étrangère.

```ts
  async function insererSolution(id: string): Promise<void> {
    await ReferentielPlanActionSolutionSqlModel.create({
      id,
      type: 'LIEN',
      libelle: 'Je consulte des sites',
      situations: [],
      authentifications: [],
      territoires: [],
      active: true,
      dateMaj: maintenant.toJSDate()
    })
  }

  function unPlan(
    override: Partial<PlanAction> = {}
  ): PlanAction {
    return {
      id: 'plan-1',
      idJeune: 'jeune-1',
      dateCreation: maintenant,
      objectifs: [
        {
          id: 'objectif-1',
          titre: 'Trouver une alternance',
          theme: 'apprenticeship',
          taches: [
            {
              id: 'tache-1',
              idSolution: 'p-2',
              terminee: false,
              dateCreation: maintenant
            }
          ]
        }
      ],
      ...override
    }
  }

  describe('save', () => {
    it('persiste le plan, ses objectifs et ses tâches', async () => {
      // Given
      await insererSolution('p-2')

      // When
      await planActionSqlRepository.save(unPlan())

      // Then
      const planSql = await PlanActionSqlModel.findByPk('plan-1')
      expect(planSql!.idJeune).to.equal('jeune-1')
      const tacheSql = await PlanActionTacheSqlModel.findByPk('tache-1')
      expect(tacheSql!.idSolution).to.equal('p-2')
      expect(tacheSql!.terminee).to.equal(false)
    })

    it("n'écrit rien dans le référentiel", async () => {
      // Given
      await insererSolution('p-2')

      // When
      await planActionSqlRepository.save(unPlan())

      // Then
      const nbSolutions = await ReferentielPlanActionSolutionSqlModel.count()
      expect(nbSolutions).to.equal(1)
    })
  })

  describe('getDernierPlan', () => {
    it('rend le plan le plus récent du jeune', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())
      await planActionSqlRepository.save(
        unPlan({
          id: 'plan-2',
          dateCreation: maintenant.plus({ days: 1 }),
          objectifs: [
            {
              id: 'objectif-2',
              titre: 'Objectif récent',
              theme: 'employment',
              taches: [
                {
                  id: 'tache-2',
                  idSolution: 'p-2',
                  terminee: false,
                  dateCreation: maintenant.plus({ days: 1 })
                }
              ]
            }
          ]
        })
      )

      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan!.id).to.equal('plan-2')
      expect(plan!.objectifs[0].titre).to.equal('Objectif récent')
    })

    it('rend le plan avec ses identifiants de solution', async () => {
      // Given
      await insererSolution('p-2')
      await planActionSqlRepository.save(unPlan())

      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan!.objectifs[0].taches[0]).to.deep.equal({
        id: 'tache-1',
        idSolution: 'p-2',
        terminee: false,
        dateCreation: maintenant
      })
    })

    it("rend undefined quand le jeune n'a pas de plan", async () => {
      // When
      const plan = await planActionSqlRepository.getDernierPlan('jeune-1')

      // Then
      expect(plan).to.equal(undefined)
    })
  })
```

- [ ] **Step 4 : Migrer la base de test et vérifier l'échec**

`yarn migration` lit `DATABASE_URL` (`src/infrastructure/sequelize/database.js`) et retombe sinon sur la base de **développement** (port 55432). La base de **test** est sur le port 56432 : il faut surcharger la variable.

```bash
yarn db:test
DATABASE_URL=postgresql://test:test@localhost:56432/test yarn migration
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/infrastructure/repositories/plan-action/plan-action-sql.repository.db.test.ts' --exit --timeout 20000
```

Attendu : ÉCHEC — le repository ne respecte pas encore la nouvelle interface.

- [ ] **Step 5 : Réécrire le repository**

`src/infrastructure/repositories/plan-action/plan-action-sql.repository.db.ts` — remplacer intégralement le contenu de la classe :

```ts
@Injectable()
export class PlanActionSqlRepository implements PlanAction.Repository {
  constructor(
    @Inject(SequelizeInjectionToken)
    private readonly sequelize: Sequelize
  ) {}

  async save(plan: PlanAction): Promise<void> {
    await this.sequelize.transaction(async transaction => {
      await PlanActionSqlModel.create(
        {
          id: plan.id,
          idJeune: plan.idJeune,
          dateCreation: plan.dateCreation.toJSDate(),
          dateMaj: plan.dateCreation.toJSDate()
        },
        { transaction }
      )

      await PlanActionObjectifSqlModel.bulkCreate(
        plan.objectifs.map(objectif => ({
          id: objectif.id,
          idPlanAction: plan.id,
          titre: objectif.titre,
          theme: objectif.theme
        })),
        { transaction }
      )

      await PlanActionTacheSqlModel.bulkCreate(
        plan.objectifs.flatMap(objectif =>
          objectif.taches.map(tache => ({
            id: tache.id,
            idObjectif: objectif.id,
            idSolution: tache.idSolution,
            terminee: tache.terminee,
            dateCreation: tache.dateCreation.toJSDate(),
            dateTerminee: tache.dateTerminee?.toJSDate() ?? null
          }))
        ),
        { transaction }
      )
    })
  }

  async getDernierPlan(idJeune: string): Promise<PlanAction | undefined> {
    const planSql = await PlanActionSqlModel.findOne({
      where: { idJeune },
      order: [['dateCreation', 'DESC']],
      include: [
        {
          model: PlanActionObjectifSqlModel,
          include: [PlanActionTacheSqlModel]
        }
      ]
    })
    if (!planSql) return undefined

    return {
      id: planSql.id,
      idJeune: planSql.idJeune,
      dateCreation: DateTime.fromJSDate(planSql.dateCreation),
      objectifs: planSql.objectifs.map(objectifSql => ({
        id: objectifSql.id,
        titre: objectifSql.titre,
        theme: objectifSql.theme,
        taches: objectifSql.taches.map(toTache)
      }))
    }
  }
}

function toTache(tacheSql: PlanActionTacheSqlModel): PlanAction.Tache {
  return {
    id: tacheSql.id,
    idSolution: tacheSql.idSolution,
    terminee: tacheSql.terminee,
    dateCreation: DateTime.fromJSDate(tacheSql.dateCreation),
    ...(tacheSql.dateTerminee
      ? { dateTerminee: DateTime.fromJSDate(tacheSql.dateTerminee) }
      : {})
  }
}
```

`IdService` et `DateService` disparaissent du constructeur : les identifiants et les dates viennent désormais de la factory. Les fonctions `referentielFromAction` et `actionFromReferentiel` sont supprimées avec l'upsert.

- [ ] **Step 6 : Lancer, vérifier, commit**

```bash
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/infrastructure/repositories/plan-action/*.db.test.ts' --exit --timeout 20000
npx eslint --fix src/infrastructure/sequelize src/infrastructure/repositories/plan-action test/infrastructure/repositories/plan-action
```

Attendu : les tests du référentiel (étape 1) et ceux du plan passent. `tsc` échoue encore sur les handlers — attendu, la tâche 4 les réécrit.

```bash
git add src/infrastructure/sequelize src/infrastructure/repositories/plan-action test/infrastructure/repositories/plan-action
git commit -m "feat(plan-action): basculer les taches sur le referentiel grist"
```

---

### Task 4 : Les handlers, le contrat HTTP et le câblage

Le point d'arrivée : les trois étapes du command handler, la query qui compose deux lectures, et le contrat mobile élargi à cinq destinations.

**Files:**
- Modify: `src/application/queries/query-models/plan-action.query-model.ts`
- Create: `src/application/queries/query-mappers/plan-action.query-mapper.ts`
- Modify: `src/application/commands/generer-plan-action.command.handler.ts`
- Modify: `src/application/queries/recuperer-plan-action.query.handler.ts`
- Delete: `src/application/commands/mappers/plan-action.mapper.ts`
- Modify: `src/infrastructure/routes/jeunes.controller.ts`
- Modify: `src/app.module.ts`
- Test: `test/application/commands/generer-plan-action.command.handler.test.ts`
- Test: `test/application/queries/recuperer-plan-action.query.handler.test.ts`
- Test: `test/application/queries/query-mappers/plan-action.query-mapper.test.ts`

**Interfaces:**
- Consumes: tout ce que les tâches 1 à 3 produisent, plus `ReferentielPlanAction.Repository.trouverSolutions` (étape 1).
- Produces: contrat HTTP inchangé dans ses noms de champs, avec `DestinationActionPlan` à 5 valeurs.

- [ ] **Step 1 : Élargir le contrat et écrire le query mapper**

Dans `src/application/queries/query-models/plan-action.query-model.ts`, `DestinationActionPlan` passe à :

```ts
export enum DestinationActionPlan {
  OFFRES_ALTERNANCE = 'OFFRES_ALTERNANCE',
  OFFRES_SERVICE_CIVIQUE = 'OFFRES_SERVICE_CIVIQUE',
  OFFRES_EMPLOI = 'OFFRES_EMPLOI',
  ALLER_VERS = 'ALLER_VERS',
  EVENEMENTS = 'EVENEMENTS'
}
```

`src/application/queries/query-mappers/plan-action.query-mapper.ts` :

```ts
import { PlanAction } from '../../../domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../domain/plan-action/referentiel-plan-action'
import {
  ActionPlanQueryModel,
  DestinationActionPlan,
  PlanActionConnecteQueryModel,
  PlanActionQueryModel,
  TypeActionPlan
} from '../query-models/plan-action.query-model'

export function toPlanActionQueryModel(
  plan: PlanAction,
  solutions: ReferentielPlanAction.Solution[],
  suggestion: PlanAction.Suggestion
): PlanActionQueryModel {
  return {
    id: plan.id,
    accroche: suggestion.accroche,
    genereLe: suggestion.genereLe.toISO()!,
    generateur: suggestion.generateur,
    objectives: toObjectives(plan, solutions)
  }
}

export function toPlanActionConnecteQueryModel(
  plan: PlanAction,
  solutions: ReferentielPlanAction.Solution[]
): PlanActionConnecteQueryModel {
  return {
    id: plan.id,
    objectives: toObjectives(plan, solutions)
  }
}

function toObjectives(
  plan: PlanAction,
  solutions: ReferentielPlanAction.Solution[]
): PlanActionQueryModel['objectives'] {
  const parId = new Map(solutions.map(solution => [solution.id, solution]))

  return plan.objectifs.map(objectif => ({
    id: objectif.id,
    titre: objectif.titre,
    theme: objectif.theme,
    actions: objectif.taches
      .map(tache => {
        const solution = parId.get(tache.idSolution)
        return solution ? toAction(tache.id, solution) : undefined
      })
      .filter((action): action is ActionPlanQueryModel => action !== undefined)
  }))
}

function toAction(
  idTache: string,
  solution: ReferentielPlanAction.Solution
): ActionPlanQueryModel {
  return {
    id: idTache,
    libelle: solution.libelle,
    type: solution.type as unknown as TypeActionPlan,
    ...(solution.url ? { url: solution.url } : {}),
    ...(solution.ecranApp
      ? { destination: solution.ecranApp as unknown as DestinationActionPlan }
      : {}),
    ...(solution.service ? { nomService: solution.service.nom } : {}),
    ...(solution.service?.description
      ? { descriptionService: solution.service.description }
      : {})
  }
}
```

> **`id` est celui de la tâche, pas celui de la solution.** C'est le correctif de fond de l'étape 2 : le mobile adresse désormais une tâche, ce qui rend le cochage possible. Les `as unknown as` traduisent deux énumérations dont les valeurs coïncident ; garde-les explicites plutôt que d'introduire un `any`.

- [ ] **Step 2 : Écrire les tests du query mapper**

`test/application/queries/query-mappers/plan-action.query-mapper.test.ts` — au minimum :

```ts
  it("expose l'identifiant de la tâche, jamais celui de la solution", () => {
    // When
    const queryModel = toPlanActionConnecteQueryModel(unPlan(), [
      uneSolution('p-2')
    ])

    // Then
    expect(queryModel.objectives[0].actions[0].id).to.equal('tache-1')
  })

  it('matérialise le libellé et le service depuis le référentiel', () => {
    // When
    const queryModel = toPlanActionConnecteQueryModel(unPlan(), [
      uneSolution('p-2')
    ])

    // Then
    expect(queryModel.objectives[0].actions[0].libelle).to.equal(
      'Je consulte des sites'
    )
    expect(queryModel.objectives[0].actions[0].nomService).to.equal('ONISEP')
  })

  it('omet une tâche dont la solution a disparu du référentiel', () => {
    // When
    const queryModel = toPlanActionConnecteQueryModel(unPlan(), [])

    // Then
    expect(queryModel.objectives[0].actions).to.deep.equal([])
  })
```

Réutilise les fabriques `unPlan()` et `uneSolution()` de la tâche 3 en les recopiant localement — ne crée pas de fixture partagée pour trois tests.

- [ ] **Step 3 : Réécrire le command handler**

`src/application/commands/generer-plan-action.command.handler.ts`, méthode `handle` :

```ts
  async handle(
    command: GenererPlanActionCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result<PlanActionQueryModel>> {
    const profil = toProfil(command.payload, utilisateur.profil.structure)

    const suggestion = await this.generateur.genererPlan(profil)
    if (isFailure(suggestion)) return suggestion

    const idsSolutions = suggestion.data.objectifs.flatMap(
      objectif => objectif.idsSolutions
    )
    const solutions = await this.referentielRepository.trouverSolutions(
      idsSolutions
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
      toPlanActionQueryModel(plan.data, solutions, suggestion.data)
    )
  }
```

Le constructeur injecte `@Inject(GenerateurDePlanActionToken) generateur: PlanAction.Generateur`, `@Inject(ReferentielPlanActionRepositoryToken) referentielRepository`, `@Inject(PlanActionRepositoryToken) planActionRepository`, `PlanAction.Factory`, plus les autorisateurs, `EvenementService` et `ConfigService` déjà présents.

Le `try/catch` qui transformait un échec de `save()` en `ErreurHttp 500` disparaît : une panne de persistance est un vrai 500, pas un cas métier.

`toProfil` est une fonction locale au fichier du handler. Les valeurs de `GoalPayload` et de `PlanAction.Besoin` coïncident exactement (11 contre 11), de même que `ObstaclePayload` et `PlanAction.Contrainte` à l'exception de `AUTRE` et `RIEN_NE_ME_BLOQUE`, qui ne correspondent à aucune contrainte de solution et sont donc écartés :

```ts
function toProfil(
  payload: GenererPlanActionPayload,
  structure: Profil.Structure
): PlanAction.Profil {
  const dateNaissance = payload.dateNaissance
    ? DateTime.fromISO(payload.dateNaissance, { setZone: true })
    : undefined

  return {
    structure,
    situation: payload.situation,
    besoins: payload.goals.map(goal => goal as unknown as PlanAction.Besoin),
    contraintes: toContraintes(payload.obstacles ?? []),
    ...(dateNaissance?.isValid ? { dateNaissance } : {}),
    ...(payload.domaine !== undefined ? { domaine: payload.domaine } : {}),
    ...(payload.habitation ? { habitation: payload.habitation } : {}),
    ...(payload.villeRecherche
      ? { villeRecherche: payload.villeRecherche }
      : {}),
    ...(payload.rayonKm !== undefined ? { rayonKm: payload.rayonKm } : {})
  }
}

function toContraintes(
  obstacles: ObstaclePayload[]
): PlanAction.Contrainte[] {
  const contraintesConnues = new Set(Object.values(PlanAction.Contrainte))

  return Array.from(new Set(obstacles))
    .map(obstacle => obstacle as unknown as PlanAction.Contrainte)
    .filter(contrainte => contraintesConnues.has(contrainte))
}
```

> `AUTRE` et `RIEN_NE_ME_BLOQUE` sont filtrés ici et non plus traités comme un cas exclusif : c'est l'adaptateur POC qui porte désormais la règle d'exclusivité propre au service externe, s'il en a besoin. Vérifie dans le test du handler qu'un payload ne portant que `RIEN_NE_ME_BLOQUE` produit `contraintes: []` sans échouer.

- [ ] **Step 4 : Réécrire la query handler**

`src/application/queries/recuperer-plan-action.query.handler.ts`, méthode `handle` :

```ts
  async handle(
    query: RecupererPlanActionQuery
  ): Promise<Result<PlanActionConnecteQueryModel>> {
    const plan = await this.planActionRepository.getDernierPlan(query.idJeune)

    if (!plan) {
      return failure(new NonTrouveError('PlanAction', query.idJeune))
    }

    const idsSolutions = plan.objectifs.flatMap(objectif =>
      objectif.taches.map(tache => tache.idSolution)
    )
    const solutions = await this.referentielRepository.trouverSolutions(
      idsSolutions
    )

    return success(toPlanActionConnecteQueryModel(plan, solutions))
  }
```

`authorize`, `monitor` et `profilsAutorises` sont inchangés.

- [ ] **Step 5 : Adapter les tests des deux handlers**

Dans `test/application/commands/generer-plan-action.command.handler.test.ts`, le `beforeEach` devient :

```ts
  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    generateur = stubInterface(sandbox)
    referentielRepository = stubInterface(sandbox)
    planActionRepository = stubInterface(sandbox)
    planActionFactory = stubClass(PlanAction.Factory)
    evenementService = stubClass(EvenementService)

    handler = new GenererPlanActionCommandHandler(
      jeuneAuthorizer,
      jeuneInviteAuthorizer,
      generateur,
      referentielRepository,
      planActionRepository,
      planActionFactory,
      evenementService,
      testConfig()
    )
  })
```

L'ordre des arguments doit suivre celui du constructeur que tu écris à l'étape 3 de cette tâche. Couvre au minimum :
- les trois étapes s'enchaînent et le query model est rendu ;
- un échec du générateur est remonté tel quel, sans appeler le référentiel ;
- un `failure` de la factory est remonté, sans appeler `save` ;
- l'invité n'est **pas** persisté mais reçoit bien son plan.

Dans `test/application/queries/recuperer-plan-action.query.handler.test.ts`, les stubs deviennent `PlanAction.Repository` et `ReferentielPlanAction.Repository`. Couvre : la composition des deux lectures, l'absence de plan → `NonTrouveError`, et une tâche dont la solution a disparu du référentiel.

- [ ] **Step 6 : Supprimer le mapper mort et câbler**

Supprimer `src/application/commands/mappers/plan-action.mapper.ts` et son test. Tout ce qui servait à fabriquer un affichage depuis le payload POC (`toPlanActionQueryModel`, `degraderEnConseil`, `deepLinkVersDestination`, `kindVersType`) n'a plus d'objet : le référentiel fait foi.

Dans `src/app.module.ts`, ajouter aux providers :

```ts
    PlanAction.Factory,
    {
      provide: GenerateurDePlanActionToken,
      useClass: PlanActionClient
    },
    {
      provide: PlanActionRepositoryToken,
      useClass: PlanActionSqlRepository
    },
```

`PlanActionClient` reste par ailleurs enregistré comme provider concret. `PlanActionSqlRepository` cesse de l'être directement : seul le token le fournit.

- [ ] **Step 7 : Vérifier l'ensemble**

```bash
npx tsc --noEmit -p tsconfig.json
npx eslint --fix src test
yarn test:local:unit
TZ=UTC DATABASE_URL=postgresql://test:test@localhost:56432/test npx mocha 'test/**/*.db.test.ts' --exit --timeout 20000
```

`tsc` doit désormais être **propre** : c'est la tâche qui referme les erreurs laissées ouvertes par les tâches 2 et 3. La suite unitaire ne doit pas régresser. La suite base de données porte 4 échecs préexistants et sans rapport (3 sur `InitialiserLaVueDemarchesIAJobHandler`, faute de vues analytics dans la base locale, 1 sur `CacheApiPartenaireService`, sensible au temps) : ne les corrige pas, vérifie seulement qu'il n'y en a pas de nouveaux.

- [ ] **Step 8 : Commit**

```bash
git add src test
git commit -m "feat(plan-action): brancher les handlers sur le domaine et le referentiel"
```

---

## Après l'étape 2

1. **Vérifier l'hypothèse la plus structurante du design** : générer un plan sur staging et comparer les identifiants rendus par le POC à ceux de `referentiel_plan_action_solution`. Si des identifiants sont inconnus, la factory les écarte et le plan s'appauvrit — c'est le moment où ça se voit, et H4 n'a encore jamais été mesurée.
2. **Mettre à jour `pass-emploi-tools/docs/app-jeune/plan-action.md`**, périmé sur trois points désormais : la persistance, le backlog de recette, et le fait que le référentiel ne vient plus du POC.
3. **Annoncer au mobile** les deux changements de contrat : `id` d'action devient l'identifiant de tâche, et `DestinationActionPlan` passe à cinq valeurs.
4. **Le cochage d'une tâche** devient possible (la tâche est adressable) — endpoint à écrire, hors de ce plan.
5. **La conversion d'une tâche en Démarche France Travail ou en Action MILO** : les données sont déjà importées et portées par le domaine depuis l'étape 1, aucun cas d'usage ne les consomme.
