import {
  toPlanActionQueryModel,
  toProfileDto
} from '../../../../src/application/commands/mappers/plan-action.mapper'
import {
  DestinationActionPlan,
  TypeActionPlan
} from '../../../../src/application/queries/query-models/plan-action.query-model'
import { Core } from '../../../../src/domain/core'
import {
  ActionDto,
  PlanDto
} from '../../../../src/infrastructure/clients/dto/plan-action.dto'
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
  describe('toProfileDto', () => {
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
          const profile = toProfileDto(
            unPayload({ situation }),
            Core.Structure.INVITE
          )

          // Then
          expect(profile.situation).to.equal(attendu)
        })
      })
    })

    describe('goals', () => {
      it('mappe chaque objectif du questionnaire vers le référentiel du service', () => {
        // When
        const profile = toProfileDto(
          unPayload({ goals: Object.values(GoalPayload) }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.goals).to.deep.equal([
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
      it('mappe chaque frein du questionnaire vers le référentiel du service', () => {
        // Given
        const freins = Object.values(ObstaclePayload).filter(
          obstacle => obstacle !== ObstaclePayload.RIEN_NE_ME_BLOQUE
        )

        // When
        const profile = toProfileDto(
          unPayload({ obstacles: freins }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.obstacles).to.deep.equal([
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
        const profile = toProfileDto(
          unPayload({
            obstacles: [
              ObstaclePayload.RIEN_NE_ME_BLOQUE,
              ObstaclePayload.PAS_DE_TRANSPORT
            ]
          }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.obstacles).to.deep.equal(['RIEN_NE_ME_BLOQUE'])
      })

      it('dédoublonne les freins', () => {
        // When
        const profile = toProfileDto(
          unPayload({
            obstacles: [
              ObstaclePayload.PAS_DE_TRANSPORT,
              ObstaclePayload.PAS_DE_TRANSPORT
            ]
          }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.obstacles).to.deep.equal(['PAS_DE_TRANSPORT'])
      })

      it('envoie un tableau vide quand le champ est absent', () => {
        // When
        const profile = toProfileDto(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profile.obstacles).to.deep.equal([])
      })
    })

    describe('dateNaissance', () => {
      it('relaie la date de naissance', () => {
        // When
        const profile = toProfileDto(
          unPayload({ dateNaissance: '2006-05-12' }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.dateNaissance).to.equal('2006-05-12')
      })

      it('tronque un ISO complet en date civile, sans glissement de fuseau', () => {
        // When
        const profile = toProfileDto(
          unPayload({ dateNaissance: '2006-05-12T00:00:00+02:00' }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.dateNaissance).to.equal('2006-05-12')
      })

      it("n'envoie pas dateNaissance quand elle est absente", () => {
        // When
        const profile = toProfileDto(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profile.dateNaissance).to.be.undefined()
      })
    })

    describe('domaine', () => {
      it('relaie le domaine renseigné', () => {
        // When
        const profile = toProfileDto(
          unPayload({ domaine: 'mécanique' }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.domaine).to.equal('mécanique')
      })

      it('relaie null quand le jeune ne sait pas', () => {
        // When
        const profile = toProfileDto(
          unPayload({ domaine: null }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.domaine).to.be.null()
      })

      it("n'envoie pas domaine quand il n'est pas renseigné", () => {
        // When
        const profile = toProfileDto(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profile.domaine).to.be.undefined()
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
        const profile = toProfileDto(
          unPayload({
            habitation: fortDeFrance,
            villeRecherche: rouen,
            rayonKm: 30
          }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.habitation).to.deep.equal(fortDeFrance)
        expect(profile.villeRecherche).to.deep.equal(rouen)
        expect(profile.rayonKm).to.equal(30)
      })

      it('relaie une seule commune quand le jeune ne renseigne que celle-là', () => {
        // When
        const profile = toProfileDto(
          unPayload({ habitation: rouen }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.habitation).to.deep.equal(rouen)
        expect(profile.villeRecherche).to.be.undefined()
      })

      it("n'envoie aucune localisation quand rien n'est renseigné", () => {
        // When
        const profile = toProfileDto(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profile.habitation).to.be.undefined()
        expect(profile.villeRecherche).to.be.undefined()
        expect(profile.rayonKm).to.be.undefined()
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
          const profile = toProfileDto(unPayload(), structure)

          // Then
          expect(profile.authProvider).to.equal(attendu)
        })
      })
    })
  })

  describe('toPlanActionQueryModel', () => {
    function uneAction(args: Partial<ActionDto> = {}): ActionDto {
      return {
        id: 'p-1',
        label: 'Je fais une action',
        kind: 'advice',
        done: false,
        ...args
      }
    }

    function unPlan(actions: ActionDto[]): PlanDto {
      return {
        id: 'plan-1',
        greeting: 'Salut !',
        generatedAt: '2026-07-20T22:03:52.448Z',
        generator: 'fallback',
        objectives: [
          {
            id: 'objective-1',
            title: 'Trouver une alternance',
            theme: 'apprenticeship',
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
      expect(queryModel.objectives[0].theme).to.equal('apprenticeship')
    })

    it('ne relaie jamais le champ done', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan([uneAction({ kind: 'advice' })])
      )

      // Then
      expect(queryModel.objectives[0].actions[0]).to.not.have.property('done')
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
              // valeur non documentée par le POC
              kind: 'unknown-kind' as ActionDto['kind']
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
              kind: 'unknown-kind' as ActionDto['kind'],
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
      const cas: Array<[ActionDto['deepLink'], DestinationActionPlan]> = [
        ['apprenticeship-offers', DestinationActionPlan.OFFRES_ALTERNANCE],
        ['civic-service-offers', DestinationActionPlan.OFFRES_SERVICE_CIVIQUE],
        ['events', DestinationActionPlan.EVENEMENTS]
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

      it('dégrade un deepLink inconnu en CONSEIL en conservant le libellé', () => {
        // When
        const queryModel = toPlanActionQueryModel(
          unPlan([
            uneAction({
              kind: 'app',
              deepLink: 'unknown-deeplink' as ActionDto['deepLink'],
              label: 'Je consulte les offres'
            })
          ])
        )

        // Then
        const action = queryModel.objectives[0].actions[0]
        expect(action.type).to.equal(TypeActionPlan.CONSEIL)
        expect(action.libelle).to.equal('Je consulte les offres')
      })
    })
  })
})
