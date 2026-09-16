import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { PlanAction } from '../../src/domain/plan-action'
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
    category: 'ALTERNANCE',
    blocker: null,
    situations: [],
    auth: [],
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

function unProfil(
  args: Partial<PlanAction.ProfilJeune> = {}
): PlanAction.ProfilJeune {
  return {
    authProvider: 'guest',
    situation: 'LYCEE',
    goals: ['ALTERNANCE'],
    obstacles: [],
    ...args
  }
}

describe('PlanAction', () => {
  describe('filtrerSolutionsEligibles', () => {
    function filtrer(
      profil: PlanAction.ProfilJeune,
      solutions: PlanAction.Solution[]
    ): string[] {
      return PlanAction.filtrerSolutionsEligibles({
        profil,
        solutions,
        maintenant
      }).map(solution => solution.id)
    }

    it("garde les solutions dont l'envie ou le blocage est dans le profil, jette les autres", () => {
      // Given
      const solutions = [
        uneSolution({ id: 'envie-choisie', category: 'ALTERNANCE' }),
        uneSolution({ id: 'envie-non-choisie', category: 'EMPLOI' }),
        uneSolution({
          id: 'blocage-coche',
          category: null,
          blocker: 'PAS_DE_TRANSPORT'
        }),
        uneSolution({
          id: 'blocage-non-coche',
          category: null,
          blocker: 'SANTE'
        })
      ]

      // When
      const ids = filtrer(
        unProfil({ goals: ['ALTERNANCE'], obstacles: ['PAS_DE_TRANSPORT'] }),
        solutions
      )

      // Then
      expect(ids).to.deep.equal(['envie-choisie', 'blocage-coche'])
    })

    it("filtre sur l'authentification quand la solution en exige une, liste vide = pas de filtre", () => {
      // Given
      const solutions = [
        uneSolution({ id: 'reservee-milo', auth: ['mission-locale'] }),
        uneSolution({ id: 'ouverte-a-tous', auth: [] })
      ]

      // When
      const ids = filtrer(unProfil({ authProvider: 'guest' }), solutions)

      // Then
      expect(ids).to.deep.equal(['ouverte-a-tous'])
    })

    it('filtre sur la situation quand la solution en exige une', () => {
      // Given
      const solutions = [
        uneSolution({ id: 'lyceens', situations: ['LYCEE'] }),
        uneSolution({ id: 'salaries', situations: ['EMPLOI'] }),
        uneSolution({ id: 'toutes-situations', situations: [] })
      ]

      // When
      const ids = filtrer(unProfil({ situation: 'LYCEE' }), solutions)

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
          unProfil({ dateNaissance: '2008-09-01' }),
          solutions
        )

        // Then
        expect(ids).to.deep.equal(['mineurs', 'sans-borne'])
      })

      it("compte l'anniversaire du jour comme âge atteint", () => {
        // When : 18 ans jour pour jour
        const ids = filtrer(
          unProfil({ dateNaissance: '2008-08-27' }),
          solutions
        )

        // Then
        expect(ids).to.deep.equal(['majeurs', 'sans-borne'])
      })

      it('ignore les bornes quand la date de naissance est absente', () => {
        // When
        const ids = filtrer(unProfil(), solutions)

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
          unProfil({
            habitation: { codeInsee: '76540', nom: 'Rouen' },
            villeRecherche: { codeInsee: '75101', nom: 'Paris 1er' }
          }),
          solutions
        )
        const idsSansRecherche = filtrer(
          unProfil({ habitation: { codeInsee: '76540', nom: 'Rouen' } }),
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
          unProfil({ habitation: { codeInsee: '2A004', nom: 'Ajaccio' } }),
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
          unProfil({
            habitation: { codeInsee: '97209', nom: 'Fort-de-France' }
          }),
          solutions
        )
        const idsMetropole = filtrer(
          unProfil({ habitation: { codeInsee: '75101', nom: 'Paris 1er' } }),
          solutions
        )

        // Then
        expect(idsMartinique).to.deep.equal(['dom'])
        expect(idsMetropole).to.deep.equal([])
      })

      it("exclut une solution territorialisée quand le profil n'a pas de localisation", () => {
        // Given
        const solutions = [uneSolution({ id: 'paris', territory: '75' })]

        // When
        const ids = filtrer(unProfil(), solutions)

        // Then
        expect(ids).to.deep.equal([])
      })
    })
  })

  describe('construirePlan', () => {
    function construire(
      profil: PlanAction.ProfilJeune,
      solutionsEligibles: PlanAction.Solution[]
    ): PlanAction.Plan {
      return PlanAction.construirePlan({
        profil,
        solutionsEligibles,
        id: 'plan-1'
      })
    }

    it("construit un objectif par envie puis par blocage, dans l'ordre du profil, avec les titres fixes et les solutions dans l'ordre du référentiel", () => {
      // Given
      const alternance1 = uneSolution({
        id: 'alternance-1',
        category: 'ALTERNANCE'
      })
      const former1 = uneSolution({ id: 'former-1', category: 'FORMER' })
      const transport1 = uneSolution({
        id: 'transport-1',
        category: null,
        blocker: 'PAS_DE_TRANSPORT'
      })
      const alternance2 = uneSolution({
        id: 'alternance-2',
        category: 'ALTERNANCE'
      })

      // When
      const plan = construire(
        unProfil({
          goals: ['FORMER', 'ALTERNANCE'],
          obstacles: ['PAS_DE_TRANSPORT']
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
            theme: 'FORMER',
            solutions: [former1]
          },
          {
            id: 'objective-2',
            titre: 'Trouver une alternance',
            theme: 'ALTERNANCE',
            solutions: [alternance1, alternance2]
          },
          {
            id: 'objective-3',
            titre: 'Me déplacer plus facilement',
            theme: 'PAS_DE_TRANSPORT',
            solutions: [transport1]
          }
        ]
      })
    })

    it('saute les thèmes sans solution éligible', () => {
      // When
      const plan = construire(
        unProfil({ goals: ['FORMER'], obstacles: ['SANTE'] }),
        []
      )

      // Then
      expect(plan.objectifs).to.deep.equal([])
    })

    it("ne construit qu'un objectif par thème quand le profil répète une envie", () => {
      // When
      const plan = construire(
        unProfil({ goals: ['ALTERNANCE', 'ALTERNANCE'] }),
        [uneSolution({ id: 'alternance-1', category: 'ALTERNANCE' })]
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
        category: 'ALTERNANCE'
      })
      catalogue.getSolutions.returns([
        alternance,
        uneSolution({ id: 'emploi-1', category: 'EMPLOI' }),
        uneSolution({
          id: 'alternance-majeurs',
          category: 'ALTERNANCE',
          minAge: 18
        })
      ])

      // When
      const plan = service.genererPlan(
        unProfil({ dateNaissance: '2010-01-01' })
      )

      // Then
      expect(plan).to.deep.equal({
        id: 'un-uuid',
        objectifs: [
          {
            id: 'objective-1',
            titre: 'Trouver une alternance',
            theme: 'ALTERNANCE',
            solutions: [alternance]
          }
        ]
      })
    })
  })
})
