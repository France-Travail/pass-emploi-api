import {
  toPlanActionQueryModel,
  toProfil
} from '../../../../src/application/commands/mappers/plan-action.mapper'
import {
  DestinationActionPlan,
  TypeActionPlan
} from '../../../../src/application/queries/query-models/plan-action.query-model'
import { Core } from '../../../../src/domain/core'
import { PlanAction } from '../../../../src/domain/plan-action'
import {
  CommunePayload,
  ObstaclePayload,
  GenererPlanActionPayload,
  GoalPayload,
  SituationPayload
} from '../../../../src/infrastructure/routes/validation/plan-action.inputs'
import { expect } from '../../../utils'

function unPayload(
  args: Partial<GenererPlanActionPayload> = {}
): GenererPlanActionPayload {
  return {
    situation: SituationPayload.LYCEE,
    goals: [GoalPayload.ALTERNANCE],
    ...args
  }
}

describe('plan-action.mapper', () => {
  describe('toProfil', () => {
    describe('situation', () => {
      const cas: Array<[SituationPayload, string]> = [
        [SituationPayload.COLLEGE, 'COLLEGE'],
        [SituationPayload.LYCEE, 'LYCEE'],
        [SituationPayload.ETUDES_SUPERIEURES, 'ETUDES_SUPERIEURES'],
        [SituationPayload.EMPLOI, 'EMPLOI'],
        [SituationPayload.AUTRE, 'AUTRE']
      ]
      cas.forEach(([situation, attendu]) => {
        it(`mappe ${situation} vers ${attendu}`, () => {
          // When
          const profil = toProfil(
            unPayload({ situation }),
            Core.Structure.INVITE
          )

          // Then
          expect(profil.situation).to.equal(attendu)
        })
      })
    })

    describe('goals', () => {
      it('mappe chaque envie du questionnaire vers le vocabulaire du domaine', () => {
        // When
        const profil = toProfil(
          unPayload({ goals: Object.values(GoalPayload) }),
          Core.Structure.INVITE
        )

        // Then
        expect(profil.goals).to.deep.equal([
          'ORIENTER',
          'DECOUVRIR_METIERS',
          'FORMER',
          'STAGE_IMMERSION',
          'ALTERNANCE',
          'EMPLOI',
          'ENGAGER',
          'MOBILITE_INTERNATIONALE',
          'ACCOMPAGNE',
          'CREER_ACTIVITE',
          'VIE_QUOTIDIENNE'
        ])
      })
    })

    describe('obstacles', () => {
      it('mappe chaque frein du questionnaire vers le vocabulaire du domaine', () => {
        // Given
        const freins = Object.values(ObstaclePayload).filter(
          obstacle => obstacle !== ObstaclePayload.RIEN_NE_ME_BLOQUE
        )

        // When
        const profil = toProfil(
          unPayload({ obstacles: freins }),
          Core.Structure.INVITE
        )

        // Then
        expect(profil.obstacles).to.deep.equal([
          'PAS_DE_TRANSPORT',
          'PAS_DE_PERMIS',
          'PAS_DE_LOGEMENT',
          'MANQUE_CONFIANCE',
          'FIN_DE_MOIS',
          'GARDE_ENFANT',
          'PAS_DE_DIPLOME',
          'NUMERIQUE',
          'HANDICAP',
          'SANTE',
          'PEU_EXPERIENCE',
          'FRANCAIS',
          'AUTRE'
        ])
      })

      it('rend RIEN_NE_ME_BLOQUE exclusif quand il est combiné à un autre frein', () => {
        // When
        const profil = toProfil(
          unPayload({
            obstacles: [
              ObstaclePayload.RIEN_NE_ME_BLOQUE,
              ObstaclePayload.PAS_DE_TRANSPORT
            ]
          }),
          Core.Structure.INVITE
        )

        // Then
        expect(profil.obstacles).to.deep.equal(['RIEN_NE_ME_BLOQUE'])
      })

      it('dédoublonne les freins', () => {
        // When
        const profil = toProfil(
          unPayload({
            obstacles: [
              ObstaclePayload.PAS_DE_TRANSPORT,
              ObstaclePayload.PAS_DE_TRANSPORT
            ]
          }),
          Core.Structure.INVITE
        )

        // Then
        expect(profil.obstacles).to.deep.equal(['PAS_DE_TRANSPORT'])
      })

      it('produit un tableau vide quand le champ est absent', () => {
        // When
        const profil = toProfil(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profil.obstacles).to.deep.equal([])
      })
    })

    describe('dateNaissance', () => {
      it('relaie la date de naissance', () => {
        // When
        const profil = toProfil(
          unPayload({ dateNaissance: '2006-05-12' }),
          Core.Structure.INVITE
        )

        // Then
        expect(profil.dateNaissance).to.equal('2006-05-12')
      })

      it('tronque un ISO complet en date civile, sans glissement de fuseau', () => {
        // When
        const profil = toProfil(
          unPayload({ dateNaissance: '2006-05-12T00:00:00+02:00' }),
          Core.Structure.INVITE
        )

        // Then
        expect(profil.dateNaissance).to.equal('2006-05-12')
      })

      it('ne produit pas dateNaissance quand elle est absente', () => {
        // When
        const profil = toProfil(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profil.dateNaissance).to.be.undefined()
      })
    })

    describe('domaine', () => {
      it('relaie le domaine renseigné', () => {
        // When
        const profil = toProfil(
          unPayload({ domaine: 'mécanique' }),
          Core.Structure.INVITE
        )

        // Then
        expect(profil.domaine).to.equal('mécanique')
      })

      it('relaie null quand le jeune ne sait pas', () => {
        // When
        const profil = toProfil(
          unPayload({ domaine: null }),
          Core.Structure.INVITE
        )

        // Then
        expect(profil.domaine).to.be.null()
      })

      it("ne produit pas domaine quand il n'est pas renseigné", () => {
        // When
        const profil = toProfil(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profil.domaine).to.be.undefined()
      })
    })

    describe('localisation', () => {
      const rouen: CommunePayload = { codeInsee: '76540', nom: 'Rouen' }
      const fortDeFrance: CommunePayload = {
        codeInsee: '97209',
        nom: 'Fort-de-France'
      }

      it('relaie les deux communes et le rayon', () => {
        // When
        const profil = toProfil(
          unPayload({
            habitation: fortDeFrance,
            villeRecherche: rouen,
            rayonKm: 30
          }),
          Core.Structure.INVITE
        )

        // Then
        expect(profil.habitation).to.deep.equal(fortDeFrance)
        expect(profil.villeRecherche).to.deep.equal(rouen)
        expect(profil.rayonKm).to.equal(30)
      })

      it('relaie une seule commune quand le jeune ne renseigne que celle-là', () => {
        // When
        const profil = toProfil(
          unPayload({ habitation: rouen }),
          Core.Structure.INVITE
        )

        // Then
        expect(profil.habitation).to.deep.equal(rouen)
        expect(profil.villeRecherche).to.be.undefined()
      })

      it("ne produit aucune localisation quand rien n'est renseigné", () => {
        // When
        const profil = toProfil(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profil.habitation).to.be.undefined()
        expect(profil.villeRecherche).to.be.undefined()
        expect(profil.rayonKm).to.be.undefined()
      })
    })

    describe('authProvider', () => {
      const cas: Array<[Core.Structure, string]> = [
        [Core.Structure.INVITE, 'guest'],
        [Core.Structure.MILO, 'mission-locale'],
        [Core.Structure.POLE_EMPLOI, 'france-travail'],
        [Core.Structure.POLE_EMPLOI_BRSA, 'france-travail'],
        [Core.Structure.CONSEIL_DEPT, 'france-travail']
      ]
      cas.forEach(([structure, attendu]) => {
        it(`dérive ${attendu} de la structure ${structure}`, () => {
          // When
          const profil = toProfil(unPayload(), structure)

          // Then
          expect(profil.authProvider).to.equal(attendu)
        })
      })
    })
  })

  describe('toPlanActionQueryModel', () => {
    function uneAction(
      args: Partial<PlanAction.Action> = {}
    ): PlanAction.Action {
      return {
        id: 'p-1',
        label: 'Je fais une action',
        kind: 'advice',
        ...args
      }
    }

    function unPlan(actions: PlanAction.Action[]): PlanAction.Plan {
      return {
        id: 'plan-1',
        greeting: 'Salut !',
        generatedAt: '2026-07-20T22:03:52.448Z',
        generator: 'fallback',
        objectives: [
          {
            id: 'objective-1',
            title: 'Trouver une alternance',
            theme: 'ALTERNANCE',
            actions
          }
        ]
      }
    }

    it('recopie id, accroche, genereLe et generateur bruts', () => {
      // When
      const queryModel = toPlanActionQueryModel(unPlan([]))

      // Then
      expect(queryModel.id).to.equal('plan-1')
      expect(queryModel.accroche).to.equal('Salut !')
      expect(queryModel.genereLe).to.equal('2026-07-20T22:03:52.448Z')
      expect(queryModel.generateur).to.equal('fallback')
    })

    it('recopie theme brut, sans le traduire', () => {
      // When
      const queryModel = toPlanActionQueryModel(unPlan([]))

      // Then
      expect(queryModel.objectives[0].theme).to.equal('ALTERNANCE')
    })

    describe('kind', () => {
      it('mappe link vers LIEN avec url', () => {
        // When
        const queryModel = toPlanActionQueryModel(
          unPlan([
            uneAction({
              kind: 'link',
              url: 'https://exemple.fr',
              serviceName: 'Exemple'
            })
          ])
        )

        // Then
        expect(queryModel.objectives[0].actions[0]).to.deep.equal({
          id: 'p-1',
          libelle: 'Je fais une action',
          type: TypeActionPlan.LIEN,
          url: 'https://exemple.fr',
          nomService: 'Exemple'
        })
      })

      it('mappe advice vers CONSEIL', () => {
        // When
        const queryModel = toPlanActionQueryModel(
          unPlan([uneAction({ kind: 'advice' })])
        )

        // Then
        expect(queryModel.objectives[0].actions[0].type).to.equal(
          TypeActionPlan.CONSEIL
        )
      })

      it('dégrade un kind inconnu sans url en CONSEIL', () => {
        // When
        const queryModel = toPlanActionQueryModel(
          unPlan([
            uneAction({
              // valeur hors référentiel
              kind: 'unknown-kind' as PlanAction.TypeSolution
            })
          ])
        )

        // Then
        expect(queryModel.objectives[0].actions[0].type).to.equal(
          TypeActionPlan.CONSEIL
        )
      })

      it('ouvre quand même le lien pour un kind inconnu avec url exploitable', () => {
        // When
        const queryModel = toPlanActionQueryModel(
          unPlan([
            uneAction({
              kind: 'unknown-kind' as PlanAction.TypeSolution,
              url: 'https://exemple.fr'
            })
          ])
        )

        // Then
        expect(queryModel.objectives[0].actions[0].type).to.equal(
          TypeActionPlan.LIEN
        )
      })

      it('dégrade app sans deepLink en CONSEIL', () => {
        // When
        const queryModel = toPlanActionQueryModel(
          unPlan([uneAction({ kind: 'app' })])
        )

        // Then
        expect(queryModel.objectives[0].actions[0].type).to.equal(
          TypeActionPlan.CONSEIL
        )
      })
    })

    describe('deepLink', () => {
      // Valeurs réelles du référentiel Grist (écrans normalisés en français)
      const cas: Array<[string, DestinationActionPlan]> = [
        ['offres-alternance', DestinationActionPlan.OFFRES_ALTERNANCE],
        [
          'offres-services-civiques',
          DestinationActionPlan.OFFRES_SERVICE_CIVIQUE
        ],
        ['evenements', DestinationActionPlan.EVENEMENTS]
      ]
      cas.forEach(([deepLink, attendu]) => {
        it(`mappe ${deepLink} vers ${attendu}`, () => {
          // When
          const queryModel = toPlanActionQueryModel(
            unPlan([uneAction({ kind: 'app', deepLink })])
          )

          // Then
          const action = queryModel.objectives[0].actions[0]
          expect(action.type).to.equal(TypeActionPlan.NAVIGATION)
          expect(action.destination).to.equal(attendu)
        })
      })

      it("dégrade un écran sans destination dans l'app en CONSEIL en conservant le libellé", () => {
        // When : messagerie existe dans le référentiel mais pas dans l'app
        const queryModel = toPlanActionQueryModel(
          unPlan([
            uneAction({
              kind: 'app',
              deepLink: 'messagerie',
              label: 'Je contacte mon conseiller'
            })
          ])
        )

        // Then
        const action = queryModel.objectives[0].actions[0]
        expect(action.type).to.equal(TypeActionPlan.CONSEIL)
        expect(action.libelle).to.equal('Je contacte mon conseiller')
      })
    })
  })
})
