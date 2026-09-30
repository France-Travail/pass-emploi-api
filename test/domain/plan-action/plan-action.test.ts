import { DateTime } from 'luxon'
import { PlanAction } from 'src/domain/plan-action/plan-action'
import { Questionnaire } from 'src/domain/plan-action/questionnaire'
import { ReferentielPlanAction } from 'src/domain/plan-action/referentiel-plan-action'
import { Profil } from 'src/domain/profil'
import { DateService } from 'src/utils/date-service'
import { IdService } from 'src/utils/id-service'
import { expect, StubbedClass, stubClass } from 'test/utils'

const maintenant = DateTime.fromISO('2026-08-27T10:00:00.000Z', {
  zone: 'utc'
})

function uneSolution(
  args: Partial<ReferentielPlanAction.Solution> = {}
): ReferentielPlanAction.Solution {
  return {
    id: 's-1',
    besoin: Questionnaire.Besoin.ALTERNANCE,
    type: ReferentielPlanAction.TypeSolution.CONSEIL,
    libelle: 'Je fais une action',
    situations: [],
    authentifications: [],
    territoires: [],
    ...args
  }
}

function unQuestionnaire(args: Partial<Questionnaire> = {}): Questionnaire {
  return {
    structure: Profil.Structure.INVITE,
    situation: Questionnaire.Situation.LYCEE,
    besoins: [Questionnaire.Besoin.ALTERNANCE],
    contraintes: [],
    ...args
  }
}

describe('PlanAction', () => {
  describe('filtrerSolutionsEligibles', () => {
    function filtrer(
      questionnaire: Questionnaire,
      solutions: ReferentielPlanAction.Solution[]
    ): string[] {
      return PlanAction.filtrerSolutionsEligibles({
        questionnaire,
        solutions,
        maintenant
      }).map(solution => solution.id)
    }

    it('garde les solutions dont le besoin ou la contrainte est dans le questionnaire, jette les autres', () => {
      // Given
      const solutions = [
        uneSolution({
          id: 'besoin-choisi',
          besoin: Questionnaire.Besoin.ALTERNANCE
        }),
        uneSolution({
          id: 'besoin-non-choisi',
          besoin: Questionnaire.Besoin.EMPLOI
        }),
        uneSolution({
          id: 'contrainte-cochee',
          besoin: undefined,
          contrainte: Questionnaire.Contrainte.PAS_DE_TRANSPORT
        }),
        uneSolution({
          id: 'contrainte-non-cochee',
          besoin: undefined,
          contrainte: Questionnaire.Contrainte.SANTE
        })
      ]

      // When
      const ids = filtrer(
        unQuestionnaire({
          besoins: [Questionnaire.Besoin.ALTERNANCE],
          contraintes: [Questionnaire.Contrainte.PAS_DE_TRANSPORT]
        }),
        solutions
      )

      // Then
      expect(ids).to.deep.equal(['besoin-choisi', 'contrainte-cochee'])
    })

    it('filtre sur la structure quand la solution en exige une, liste vide = pas de filtre', () => {
      // Given
      const solutions = [
        uneSolution({
          id: 'reservee-milo',
          authentifications: [Profil.Structure.MILO]
        }),
        uneSolution({ id: 'ouverte-a-tous', authentifications: [] })
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
          situations: [Questionnaire.Situation.LYCEE]
        }),
        uneSolution({
          id: 'salaries',
          situations: [Questionnaire.Situation.EMPLOI]
        }),
        uneSolution({ id: 'toutes-situations', situations: [] })
      ]

      // When
      const ids = filtrer(
        unQuestionnaire({ situation: Questionnaire.Situation.LYCEE }),
        solutions
      )

      // Then
      expect(ids).to.deep.equal(['lyceens', 'toutes-situations'])
    })

    describe('âge', () => {
      const solutions = [
        uneSolution({ id: 'majeurs', ageMin: 18 }),
        uneSolution({ id: 'mineurs', ageMax: 17 }),
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
        const solutions = [uneSolution({ id: 'paris', territoires: ['75'] })]

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

      it('gère la Corse (2A/2B) et les départements séparés par des virgules', () => {
        // Given
        const solutions = [
          uneSolution({ id: 'corse-et-paca', territoires: ['2A, 2B', '13'] })
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
          uneSolution({ id: 'dom', territoires: ["Territoires d'Outre-mer"] })
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
        const solutions = [uneSolution({ id: 'paris', territoires: ['75'] })]

        // When
        const ids = filtrer(unQuestionnaire(), solutions)

        // Then
        expect(ids).to.deep.equal([])
      })
    })
  })

  describe('Factory', () => {
    let factory: PlanAction.Factory
    let idService: StubbedClass<IdService>
    let dateService: StubbedClass<DateService>

    beforeEach(() => {
      idService = stubClass(IdService)
      dateService = stubClass(DateService)
      dateService.now.returns(maintenant)

      let compteur = 0
      idService.uuid.callsFake(() => `uuid-${compteur++}`)

      factory = new PlanAction.Factory(idService, dateService)
    })

    it("construit un objectif par besoin puis par contrainte, dans l'ordre du questionnaire, avec les titres fixes et les solutions dans l'ordre du référentiel", () => {
      // Given
      const referentiel = [
        uneSolution({
          id: 'alternance-1',
          besoin: Questionnaire.Besoin.ALTERNANCE
        }),
        uneSolution({ id: 'former-1', besoin: Questionnaire.Besoin.FORMER }),
        uneSolution({
          id: 'transport-1',
          besoin: undefined,
          contrainte: Questionnaire.Contrainte.PAS_DE_TRANSPORT
        }),
        uneSolution({
          id: 'alternance-2',
          besoin: Questionnaire.Besoin.ALTERNANCE
        })
      ]

      // When
      const plan = factory.creer(
        'jeune-1',
        unQuestionnaire({
          besoins: [
            Questionnaire.Besoin.FORMER,
            Questionnaire.Besoin.ALTERNANCE
          ],
          contraintes: [Questionnaire.Contrainte.PAS_DE_TRANSPORT]
        }),
        referentiel
      )

      // Then
      expect(
        plan.objectifs.map(objectif => ({
          titre: objectif.titre,
          theme: objectif.theme,
          idsSolutions: objectif.taches.map(tache => tache.idSolution)
        }))
      ).to.deep.equal([
        {
          titre: 'Me former, me qualifier',
          theme: Questionnaire.Besoin.FORMER,
          idsSolutions: ['former-1']
        },
        {
          titre: 'Trouver une alternance',
          theme: Questionnaire.Besoin.ALTERNANCE,
          idsSolutions: ['alternance-1', 'alternance-2']
        },
        {
          titre: 'Me déplacer plus facilement',
          theme: Questionnaire.Contrainte.PAS_DE_TRANSPORT,
          idsSolutions: ['transport-1']
        }
      ])
    })

    it('attribue nos propres identifiants au plan, aux objectifs et aux tâches', () => {
      // When
      const plan = factory.creer('jeune-1', unQuestionnaire(), [
        uneSolution({ id: 'p-2' })
      ])

      // Then
      expect(plan.id).to.equal('uuid-0')
      expect(plan.objectifs[0].id).to.equal('uuid-1')
      expect(plan.objectifs[0].taches[0].id).to.equal('uuid-2')
      expect(plan.objectifs[0].taches[0].idSolution).to.equal('p-2')
    })

    it('pose le jeune, la date de création et des tâches non terminées', () => {
      // When
      const plan = factory.creer('jeune-1', unQuestionnaire(), [uneSolution()])

      // Then
      expect(plan.idJeune).to.equal('jeune-1')
      expect(plan.dateCreation).to.deep.equal(maintenant)
      expect(plan.objectifs[0].taches[0].terminee).to.equal(false)
      expect(plan.objectifs[0].taches[0].dateTerminee).to.equal(undefined)
    })

    it('ne retient que les solutions éligibles à la date du jour', () => {
      // When
      const plan = factory.creer(
        'jeune-1',
        unQuestionnaire({ dateNaissance: DateTime.fromISO('2010-01-01') }),
        [
          uneSolution({ id: 'alternance-1' }),
          uneSolution({ id: 'emploi-1', besoin: Questionnaire.Besoin.EMPLOI }),
          uneSolution({ id: 'alternance-majeurs', ageMin: 18 })
        ]
      )

      // Then
      expect(
        plan.objectifs.flatMap(objectif =>
          objectif.taches.map(tache => tache.idSolution)
        )
      ).to.deep.equal(['alternance-1'])
    })

    it('saute les thèmes sans solution éligible', () => {
      // When
      const plan = factory.creer(
        'jeune-1',
        unQuestionnaire({
          besoins: [Questionnaire.Besoin.FORMER],
          contraintes: [Questionnaire.Contrainte.SANTE]
        }),
        []
      )

      // Then
      expect(plan.objectifs).to.deep.equal([])
    })

    it("ne construit qu'un objectif par thème quand le questionnaire répète un besoin", () => {
      // When
      const plan = factory.creer(
        'jeune-1',
        unQuestionnaire({
          besoins: [
            Questionnaire.Besoin.ALTERNANCE,
            Questionnaire.Besoin.ALTERNANCE
          ]
        }),
        [uneSolution()]
      )

      // Then
      expect(plan.objectifs).to.have.length(1)
    })

    describe('avec un plan précédent', () => {
      const dateCreationPrecedente = maintenant.minus({ days: 10 })
      const dateTermineePrecedente = maintenant.minus({ days: 5 })
      const dateSuppressionPrecedente = maintenant.minus({ days: 3 })

      function unPlanPrecedent(objectifs: PlanAction.Objectif[]): PlanAction {
        return {
          id: 'plan-precedent',
          idJeune: 'jeune-1',
          dateCreation: dateCreationPrecedente,
          objectifs
        }
      }

      function uneTachePrecedente(
        override: Partial<PlanAction.Tache> = {}
      ): PlanAction.Tache {
        return {
          id: 'tache-precedente',
          idSolution: 'alternance-1',
          terminee: false,
          dateCreation: dateCreationPrecedente,
          ...override
        }
      }

      it("reprend l'état d'une tâche de même solution sous un objectif de même thème, avec un nouvel identifiant", () => {
        // Given
        const planPrecedent = unPlanPrecedent([
          {
            id: 'objectif-precedent',
            titre: 'Trouver une alternance',
            theme: Questionnaire.Besoin.ALTERNANCE,
            taches: [
              uneTachePrecedente({
                terminee: true,
                dateTerminee: dateTermineePrecedente
              })
            ]
          }
        ])

        // When
        const plan = factory.creer(
          'jeune-1',
          unQuestionnaire(),
          [uneSolution({ id: 'alternance-1' })],
          planPrecedent
        )

        // Then
        expect(plan.objectifs[0].taches).to.deep.equal([
          {
            id: 'uuid-2',
            idSolution: 'alternance-1',
            terminee: true,
            dateCreation: dateCreationPrecedente,
            dateTerminee: dateTermineePrecedente
          }
        ])
      })

      it("garde supprimée une tâche supprimée d'un objectif toujours présent, et y ajoute les nouvelles solutions éligibles", () => {
        // Given
        const planPrecedent = unPlanPrecedent([
          {
            id: 'objectif-precedent',
            titre: 'Trouver une alternance',
            theme: Questionnaire.Besoin.ALTERNANCE,
            taches: [
              uneTachePrecedente({
                dateSuppression: dateSuppressionPrecedente
              })
            ]
          }
        ])

        // When
        const plan = factory.creer(
          'jeune-1',
          unQuestionnaire(),
          [
            uneSolution({ id: 'alternance-1' }),
            uneSolution({ id: 'alternance-nouvelle' })
          ],
          planPrecedent
        )

        // Then
        expect(plan.objectifs[0].taches).to.deep.equal([
          {
            id: 'uuid-2',
            idSolution: 'alternance-1',
            terminee: false,
            dateCreation: dateCreationPrecedente,
            dateSuppression: dateSuppressionPrecedente
          },
          {
            id: 'uuid-3',
            idSolution: 'alternance-nouvelle',
            terminee: false,
            dateCreation: maintenant
          }
        ])
      })

      it("ne reprend pas l'état d'une tâche de même solution rattachée à un autre thème", () => {
        // Given
        const planPrecedent = unPlanPrecedent([
          {
            id: 'objectif-precedent',
            titre: 'Trouver un emploi',
            theme: Questionnaire.Besoin.EMPLOI,
            taches: [
              uneTachePrecedente({
                terminee: true,
                dateTerminee: dateTermineePrecedente,
                dateSuppression: dateSuppressionPrecedente
              })
            ]
          }
        ])

        // When
        const plan = factory.creer(
          'jeune-1',
          unQuestionnaire(),
          [uneSolution({ id: 'alternance-1' })],
          planPrecedent
        )

        // Then
        expect(plan.objectifs[0].taches).to.deep.equal([
          {
            id: 'uuid-2',
            idSolution: 'alternance-1',
            terminee: false,
            dateCreation: maintenant
          }
        ])
      })
    })
  })
})
