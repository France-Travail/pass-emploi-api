import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { PlanAction } from '../../src/domain/plan-action'
import { Profil } from '../../src/domain/profil'
import { DateService } from '../../src/utils/date-service'
import { IdService } from '../../src/utils/id-service'
import { createSandbox, expect, StubbedClass, stubClass } from '../utils'

const maintenant = DateTime.fromISO('2026-08-27T10:00:00.000Z', {
  zone: 'utc'
})

function uneSolution(
  args: Partial<PlanAction.Solution> = {}
): PlanAction.Solution {
  return {
    id: 's-1',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je fais une action',
    url: null,
    serviceName: null,
    ...args
  }
}

function unQuestionnaire(
  args: Partial<PlanAction.QuestionnaireJeune> = {}
): PlanAction.QuestionnaireJeune {
  return {
    structure: Profil.Structure.INVITE,
    situation: PlanAction.Situation.LYCEE,
    objectifs: [PlanAction.Objectif.ALTERNANCE],
    obstacles: [],
    ...args
  }
}

describe('PlanAction', () => {
  describe('filtrerSolutionsEligibles', () => {
    function filtrer(
      questionnaire: PlanAction.QuestionnaireJeune,
      solutions: PlanAction.Solution[]
    ): string[] {
      return PlanAction.filtrerSolutionsEligibles({
        questionnaire,
        solutions,
        maintenant
      }).map(solution => solution.id)
    }

    it("garde les solutions dont l'objectif ou le obstacle est dans le questionnaire, jette les autres", () => {
      // Given
      const solutions = [
        uneSolution({
          id: 'objectif-choisie',
          category: PlanAction.Objectif.ALTERNANCE
        }),
        uneSolution({
          id: 'objectif-non-choisie',
          category: PlanAction.Objectif.EMPLOI
        }),
        uneSolution({
          id: 'obstacle-coche',
          category: null,
          blocker: PlanAction.Obstacle.PAS_DE_TRANSPORT
        }),
        uneSolution({
          id: 'obstacle-non-coche',
          category: null,
          blocker: PlanAction.Obstacle.SANTE
        })
      ]

      // When
      const ids = filtrer(
        unQuestionnaire({
          objectifs: [PlanAction.Objectif.ALTERNANCE],
          obstacles: [PlanAction.Obstacle.PAS_DE_TRANSPORT]
        }),
        solutions
      )

      // Then
      expect(ids).to.deep.equal(['objectif-choisie', 'obstacle-coche'])
    })

    it('filtre sur la structure quand la solution en exige une, liste vide = pas de filtre', () => {
      // Given
      const solutions = [
        uneSolution({
          id: 'reservee-milo',
          structures: [Profil.Structure.MILO]
        }),
        uneSolution({ id: 'ouverte-a-tous', structures: [] })
      ]

      // When
      const ids = filtrer(
        unQuestionnaire({ structure: Profil.Structure.INVITE }),
        solutions
      )

      // Then
      expect(ids).to.deep.equal(['ouverte-a-tous'])
    })

    it('filtre sur la situation quand la solution en exige une', () => {
      // Given
      const solutions = [
        uneSolution({
          id: 'lyceens',
          situations: [PlanAction.Situation.LYCEE]
        }),
        uneSolution({
          id: 'salaries',
          situations: [PlanAction.Situation.EMPLOI]
        }),
        uneSolution({ id: 'toutes-situations', situations: [] })
      ]

      // When
      const ids = filtrer(
        unQuestionnaire({ situation: PlanAction.Situation.LYCEE }),
        solutions
      )

      // Then
      expect(ids).to.deep.equal(['lyceens', 'toutes-situations'])
    })

    describe('âge', () => {
      const solutions = [
        uneSolution({ id: 'majeurs', minAge: 18 }),
        uneSolution({ id: 'mineurs', maxAge: 17 }),
        uneSolution({ id: 'sans-borne' })
      ]

      it("applique les bornes d'âge à partir de la date de naissance", () => {
        // When : 17 ans, anniversaire dans quelques jours
        const ids = filtrer(
          unQuestionnaire({ dateNaissance: DateTime.fromISO('2008-09-01') }),
          solutions
        )

        // Then
        expect(ids).to.deep.equal(['mineurs', 'sans-borne'])
      })

      it("compte l'anniversaire du jour comme âge atteint", () => {
        // When : 18 ans jour pour jour
        const ids = filtrer(
          unQuestionnaire({ dateNaissance: DateTime.fromISO('2008-08-27') }),
          solutions
        )

        // Then
        expect(ids).to.deep.equal(['majeurs', 'sans-borne'])
      })

      it('ignore les bornes quand la date de naissance est absente', () => {
        // When
        const ids = filtrer(unQuestionnaire(), solutions)

        // Then
        expect(ids).to.deep.equal(['majeurs', 'mineurs', 'sans-borne'])
      })
    })

    describe('territoire', () => {
      it('matche le département dérivé du code INSEE, ville de recherche prioritaire', () => {
        // Given
        const solutions = [uneSolution({ id: 'paris', territory: '75' })]

        // When
        const idsAvecRecherche = filtrer(
          unQuestionnaire({
            communeResidence: { codeInsee: '76540', nom: 'Rouen' },
            communeRecherche: { codeInsee: '75101', nom: 'Paris 1er' }
          }),
          solutions
        )
        const idsSansRecherche = filtrer(
          unQuestionnaire({
            communeResidence: { codeInsee: '76540', nom: 'Rouen' }
          }),
          solutions
        )

        // Then
        expect(idsAvecRecherche).to.deep.equal(['paris'])
        expect(idsSansRecherche).to.deep.equal([])
      })

      it('gère la Corse (2A/2B) et les listes de départements', () => {
        // Given
        const solutions = [
          uneSolution({ id: 'corse-et-paca', territory: '2A, 2B; 13' })
        ]

        // When
        const ids = filtrer(
          unQuestionnaire({
            communeResidence: { codeInsee: '2A004', nom: 'Ajaccio' }
          }),
          solutions
        )

        // Then
        expect(ids).to.deep.equal(['corse-et-paca'])
      })

      it("matche l'outre-mer sur les codes 97x/98x", () => {
        // Given
        const solutions = [
          uneSolution({ id: 'dom', territory: "Territoires d'Outre-mer" })
        ]

        // When
        const idsMartinique = filtrer(
          unQuestionnaire({
            communeResidence: { codeInsee: '97209', nom: 'Fort-de-France' }
          }),
          solutions
        )
        const idsMetropole = filtrer(
          unQuestionnaire({
            communeResidence: { codeInsee: '75101', nom: 'Paris 1er' }
          }),
          solutions
        )

        // Then
        expect(idsMartinique).to.deep.equal(['dom'])
        expect(idsMetropole).to.deep.equal([])
      })

      it("exclut une solution territorialisée quand le questionnaire n'a pas de localisation", () => {
        // Given
        const solutions = [uneSolution({ id: 'paris', territory: '75' })]

        // When
        const ids = filtrer(unQuestionnaire(), solutions)

        // Then
        expect(ids).to.deep.equal([])
      })
    })
  })

  describe('construirePlan', () => {
    function construire(
      questionnaire: PlanAction.QuestionnaireJeune,
      solutionsEligibles: PlanAction.Solution[]
    ): PlanAction.Plan {
      return PlanAction.construirePlan({
        questionnaire,
        solutionsEligibles,
        id: 'plan-1'
      })
    }

    it("construit un objectif par objectif puis par obstacle, dans l'ordre du questionnaire, avec les titres fixes et les solutions dans l'ordre du référentiel", () => {
      // Given
      const alternance1 = uneSolution({
        id: 'alternance-1',
        category: PlanAction.Objectif.ALTERNANCE
      })
      const former1 = uneSolution({
        id: 'former-1',
        category: PlanAction.Objectif.FORMER
      })
      const transport1 = uneSolution({
        id: 'transport-1',
        category: null,
        blocker: PlanAction.Obstacle.PAS_DE_TRANSPORT
      })
      const alternance2 = uneSolution({
        id: 'alternance-2',
        category: PlanAction.Objectif.ALTERNANCE
      })

      // When
      const plan = construire(
        unQuestionnaire({
          objectifs: [
            PlanAction.Objectif.FORMER,
            PlanAction.Objectif.ALTERNANCE
          ],
          obstacles: [PlanAction.Obstacle.PAS_DE_TRANSPORT]
        }),
        [alternance1, former1, transport1, alternance2]
      )

      // Then
      expect(plan).to.deep.equal({
        id: 'plan-1',
        objectifs: [
          {
            id: 'objective-1',
            titre: 'Me former, me qualifier',
            theme: PlanAction.Objectif.FORMER,
            solutions: [former1]
          },
          {
            id: 'objective-2',
            titre: 'Trouver une alternance',
            theme: PlanAction.Objectif.ALTERNANCE,
            solutions: [alternance1, alternance2]
          },
          {
            id: 'objective-3',
            titre: 'Me déplacer plus facilement',
            theme: PlanAction.Obstacle.PAS_DE_TRANSPORT,
            solutions: [transport1]
          }
        ]
      })
    })

    it('saute les thèmes sans solution éligible', () => {
      // When
      const plan = construire(
        unQuestionnaire({
          objectifs: [PlanAction.Objectif.FORMER],
          obstacles: [PlanAction.Obstacle.SANTE]
        }),
        []
      )

      // Then
      expect(plan.objectifs).to.deep.equal([])
    })

    it("ne construit qu'un objectif par thème quand le questionnaire répète une objectif", () => {
      // When
      const plan = construire(
        unQuestionnaire({
          objectifs: [
            PlanAction.Objectif.ALTERNANCE,
            PlanAction.Objectif.ALTERNANCE
          ]
        }),
        [
          uneSolution({
            id: 'alternance-1',
            category: PlanAction.Objectif.ALTERNANCE
          })
        ]
      )

      // Then
      expect(plan.objectifs.map(objectif => objectif.id)).to.deep.equal([
        'objective-1'
      ])
    })
  })

  describe('Service', () => {
    let catalogue: StubbedType<PlanAction.CatalogueRepository>
    let idService: StubbedClass<IdService>
    let dateService: StubbedClass<DateService>
    let service: PlanAction.Service

    beforeEach(() => {
      catalogue = stubInterface<PlanAction.CatalogueRepository>(createSandbox())
      idService = stubClass(IdService)
      dateService = stubClass(DateService)
      idService.uuid.returns('un-uuid')
      dateService.now.returns(maintenant)
      service = new PlanAction.Service(catalogue, idService, dateService)
    })

    it('génère le plan sur les seules solutions éligibles du catalogue à la date du jour, avec un uuid', () => {
      // Given
      const alternance = uneSolution({
        id: 'alternance-1',
        category: PlanAction.Objectif.ALTERNANCE
      })
      catalogue.getSolutions.returns([
        alternance,
        uneSolution({ id: 'emploi-1', category: PlanAction.Objectif.EMPLOI }),
        uneSolution({
          id: 'alternance-majeurs',
          category: PlanAction.Objectif.ALTERNANCE,
          minAge: 18
        })
      ])

      // When
      const plan = service.genererPlan(
        unQuestionnaire({ dateNaissance: DateTime.fromISO('2010-01-01') })
      )

      // Then
      expect(plan).to.deep.equal({
        id: 'un-uuid',
        objectifs: [
          {
            id: 'objective-1',
            titre: 'Trouver une alternance',
            theme: PlanAction.Objectif.ALTERNANCE,
            solutions: [alternance]
          }
        ]
      })
    })
  })
})
