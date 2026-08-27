import { DateTime } from 'luxon'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { failure, success } from '../../src/building-blocks/types/result'
import { ErreurHttp } from '../../src/building-blocks/types/domain-error'
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
    subCategory: null,
    blocker: null,
    need: null,
    situations: [],
    auth: [],
    minAge: null,
    maxAge: null,
    territory: null,
    domain: null,
    kind: 'advice',
    label: 'Je fais une action',
    url: null,
    deepLink: null,
    serviceName: null,
    serviceDescription: null,
    ...args
  }
}

function unProfil(args: Partial<PlanAction.Profil> = {}): PlanAction.Profil {
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
      profil: PlanAction.Profil,
      solutions: PlanAction.Solution[]
    ): string[] {
      return PlanAction.filtrerSolutionsEligibles({
        profil,
        solutions,
        maintenant
      }).map(s => s.id)
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

      it('exclut une solution territorialisée quand le profil n’a pas de localisation', () => {
        // Given
        const solutions = [uneSolution({ id: 'paris', territory: '75' })]

        // When
        const ids = filtrer(unProfil(), solutions)

        // Then
        expect(ids).to.deep.equal([])
      })
    })
  })

  describe('construireEbaucheDeSecours', () => {
    it('construit un objectif par envie puis par blocage, dans l’ordre du profil, avec les titres fixes', () => {
      // Given
      const solutionsEligibles = [
        uneSolution({ id: 'alternance-1', category: 'ALTERNANCE' }),
        uneSolution({ id: 'former-1', category: 'FORMER' }),
        uneSolution({
          id: 'transport-1',
          category: null,
          blocker: 'PAS_DE_TRANSPORT'
        }),
        uneSolution({ id: 'alternance-2', category: 'ALTERNANCE' })
      ]

      // When
      const ebauche = PlanAction.construireEbaucheDeSecours({
        profil: unProfil({
          goals: ['FORMER', 'ALTERNANCE'],
          obstacles: ['PAS_DE_TRANSPORT']
        }),
        solutionsEligibles
      })

      // Then
      expect(ebauche.objectives).to.deep.equal([
        {
          title: 'Me former, me qualifier',
          theme: 'FORMER',
          solutionIds: ['former-1']
        },
        {
          title: 'Trouver une alternance',
          theme: 'ALTERNANCE',
          solutionIds: ['alternance-1', 'alternance-2']
        },
        {
          title: 'Me déplacer plus facilement',
          theme: 'PAS_DE_TRANSPORT',
          solutionIds: ['transport-1']
        }
      ])
      expect(ebauche.model).to.be.undefined()
    })

    it('saute les thèmes sans solution éligible', () => {
      // When
      const ebauche = PlanAction.construireEbaucheDeSecours({
        profil: unProfil({ goals: ['FORMER'], obstacles: ['SANTE'] }),
        solutionsEligibles: []
      })

      // Then
      expect(ebauche.objectives).to.deep.equal([])
    })
  })

  describe('materialiserPlan', () => {
    const catalogue = [
      uneSolution({
        id: 'premiere',
        label: 'Première action',
        kind: 'link',
        url: 'https://exemple.fr',
        serviceName: 'Exemple'
      }),
      uneSolution({ id: 'deuxieme', label: 'Deuxième action' }),
      uneSolution({ id: 'troisieme', label: 'Troisième action' })
    ]

    function materialiser(
      ebauche: PlanAction.Ebauche,
      profil = unProfil()
    ): PlanAction.Plan {
      return PlanAction.materialiserPlan({
        ebauche,
        solutionsEligibles: catalogue,
        profil,
        generateur: 'llm',
        idPlan: 'plan-1',
        genereLe: '2026-08-27T10:00:00.000Z'
      })
    }

    it('jette les ids inventés et re-trie les actions dans l’ordre du référentiel', () => {
      // Given : le générateur renvoie un id inventé et un ordre fantaisiste
      const ebauche: PlanAction.Ebauche = {
        greeting: 'Salut !',
        objectives: [
          {
            title: 'Trouver une alternance',
            theme: 'ALTERNANCE',
            solutionIds: ['troisieme', 'id-invente', 'premiere']
          }
        ]
      }

      // When
      const plan = materialiser(ebauche)

      // Then
      expect(plan.objectives).to.have.length(1)
      expect(plan.objectives[0].actions).to.deep.equal([
        {
          id: 'premiere',
          label: 'Première action',
          kind: 'link',
          url: 'https://exemple.fr',
          serviceName: 'Exemple'
        },
        { id: 'troisieme', label: 'Troisième action', kind: 'advice' }
      ])
    })

    it('dédoublonne les solutions entre objectifs et supprime les objectifs vides', () => {
      // Given
      const ebauche: PlanAction.Ebauche = {
        greeting: 'Salut !',
        objectives: [
          {
            title: 'Premier objectif',
            theme: 'ALTERNANCE',
            solutionIds: ['premiere']
          },
          {
            title: 'Doublon',
            theme: 'FORMER',
            solutionIds: ['premiere']
          }
        ]
      }

      // When
      const plan = materialiser(
        ebauche,
        unProfil({ goals: ['ALTERNANCE', 'FORMER'] })
      )

      // Then
      expect(plan.objectives).to.have.length(1)
      expect(plan.objectives[0].title).to.equal('Premier objectif')
    })

    it('plafonne le nombre d’objectifs au nombre d’envies plus blocages du profil', () => {
      // Given : une seule envie, pas de blocage → un seul objectif possible
      const ebauche: PlanAction.Ebauche = {
        greeting: 'Salut !',
        objectives: [
          {
            title: 'Premier',
            theme: 'ALTERNANCE',
            solutionIds: ['premiere']
          },
          {
            title: 'De trop',
            theme: 'FORMER',
            solutionIds: ['deuxieme']
          }
        ]
      }

      // When
      const plan = materialiser(ebauche, unProfil({ goals: ['ALTERNANCE'] }))

      // Then
      expect(plan.objectives).to.have.length(1)
    })

    it('remplace un titre vide et une accroche vide par les valeurs par défaut', () => {
      // Given
      const ebauche: PlanAction.Ebauche = {
        greeting: '   ',
        objectives: [
          { title: '  ', theme: 'ALTERNANCE', solutionIds: ['premiere'] }
        ]
      }

      // When
      const plan = materialiser(ebauche)

      // Then
      expect(plan.greeting).to.equal(
        "Salut ! Voici ton plan d'action, coche les actions au fur et à mesure."
      )
      expect(plan.objectives[0].title).to.equal('Mes prochaines actions')
    })

    it('relaie le modèle sur un plan llm, jamais sur un plan de secours', () => {
      // Given
      const ebauche: PlanAction.Ebauche = {
        greeting: 'Salut !',
        model: 'un-modele',
        objectives: [
          { title: 'Titre', theme: 'ALTERNANCE', solutionIds: ['premiere'] }
        ]
      }

      // When
      const planLlm = materialiser(ebauche)
      const planSecours = PlanAction.materialiserPlan({
        ebauche,
        solutionsEligibles: catalogue,
        profil: unProfil(),
        generateur: 'fallback',
        idPlan: 'plan-1',
        genereLe: '2026-08-27T10:00:00.000Z'
      })

      // Then
      expect(planLlm.model).to.equal('un-modele')
      expect(planSecours.model).to.be.undefined()
    })
  })

  describe('Service', () => {
    let catalogue: StubbedType<PlanAction.CatalogueRepository>
    let generateur: StubbedType<PlanAction.Generateur>
    let idService: StubbedClass<IdService>
    let dateService: StubbedClass<DateService>
    let service: PlanAction.Service

    const solutions = [
      uneSolution({ id: 'alternance-1', category: 'ALTERNANCE' }),
      uneSolution({ id: 'emploi-1', category: 'EMPLOI' })
    ]

    beforeEach(() => {
      const sandbox = createSandbox()
      catalogue = stubInterface<PlanAction.CatalogueRepository>(sandbox)
      generateur = stubInterface<PlanAction.Generateur>(sandbox)
      idService = stubClass(IdService)
      dateService = stubClass(DateService)
      catalogue.getSolutions.returns(solutions)
      idService.uuid.returns('un-uuid')
      dateService.now.returns(maintenant)
      service = new PlanAction.Service(
        catalogue,
        generateur,
        idService,
        dateService
      )
    })

    it('sert le plan du générateur LLM quand il répond, sur les seules solutions éligibles', async () => {
      // Given
      generateur.generer.resolves(
        success({
          greeting: 'Salut, ravi de t’accompagner !',
          model: 'un-modele',
          objectives: [
            {
              title: 'Trouver une alternance',
              theme: 'ALTERNANCE',
              solutionIds: ['alternance-1']
            }
          ]
        })
      )

      // When
      const plan = await service.genererPlan(unProfil())

      // Then
      expect(generateur.generer).to.have.been.calledWithMatch({
        solutionsEligibles: [solutions[0]]
      })
      expect(plan.id).to.equal('un-uuid')
      expect(plan.generatedAt).to.equal(maintenant.toISO())
      expect(plan.generator).to.equal('llm')
      expect(plan.model).to.equal('un-modele')
      expect(plan.greeting).to.equal('Salut, ravi de t’accompagner !')
      expect(plan.objectives[0].actions.map(a => a.id)).to.deep.equal([
        'alternance-1'
      ])
    })

    it('retombe sur le plan de secours déterministe quand le générateur échoue', async () => {
      // Given
      generateur.generer.resolves(
        failure(new ErreurHttp('LLM indisponible', 501))
      )

      // When
      const plan = await service.genererPlan(unProfil())

      // Then
      expect(plan.generator).to.equal('fallback')
      expect(plan.model).to.be.undefined()
      expect(plan.objectives).to.have.length(1)
      expect(plan.objectives[0].theme).to.equal('ALTERNANCE')
      expect(plan.objectives[0].actions.map(a => a.id)).to.deep.equal([
        'alternance-1'
      ])
    })

    it('retombe sur le plan de secours quand le générateur ne renvoie que des ids inventés', async () => {
      // Given
      generateur.generer.resolves(
        success({
          greeting: 'Salut !',
          objectives: [
            {
              title: 'Trouver une alternance',
              theme: 'ALTERNANCE',
              solutionIds: ['id-invente']
            }
          ]
        })
      )

      // When
      const plan = await service.genererPlan(unProfil())

      // Then
      expect(plan.generator).to.equal('fallback')
      expect(plan.objectives).to.have.length(1)
      expect(plan.objectives[0].actions.map(a => a.id)).to.deep.equal([
        'alternance-1'
      ])
    })
  })
})
