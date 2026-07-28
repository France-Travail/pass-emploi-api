import { DateTime } from 'luxon'
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
        [SituationPayload.COLLEGE, 'middle-school'],
        [SituationPayload.LYCEE, 'high-school'],
        [SituationPayload.ETUDES_SUPERIEURES, 'higher-education'],
        [SituationPayload.EMPLOI, 'employed'],
        [SituationPayload.AUTRE, 'other']
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
      const cas: Array<[GoalPayload, string]> = [
        [GoalPayload.ORIENTER, 'orientation'],
        [GoalPayload.DECOUVRIR_METIERS, 'discover-jobs'],
        [GoalPayload.FORMER, 'training'],
        [GoalPayload.STAGE_IMMERSION, 'internship-immersion'],
        [GoalPayload.ALTERNANCE, 'apprenticeship'],
        [GoalPayload.EMPLOI, 'job'],
        [GoalPayload.ENGAGER, 'civic-engagement'],
        [GoalPayload.MOBILITE_INTERNATIONALE, 'international-mobility'],
        [GoalPayload.ACCOMPAGNE, 'guidance-support'],
        [GoalPayload.CREER_ACTIVITE, 'start-business']
      ]
      cas.forEach(([objectif, attendu]) => {
        it(`mappe ${objectif} vers ${attendu}`, () => {
          // When
          const profile = toProfileDto(
            unPayload({ goals: [objectif] }),
            Core.Structure.INVITE
          )

          // Then
          expect(profile.goals).to.deep.equal([attendu])
        })
      })

      it('replie sur dont-know quand VIE_QUOTIDIENNE est le seul objectif coché', () => {
        // When
        const profile = toProfileDto(
          unPayload({ goals: [GoalPayload.VIE_QUOTIDIENNE] }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.goals).to.deep.equal(['dont-know'])
      })

      it('conserve les objectifs mappés aux côtés de ceux sans équivalent', () => {
        // When
        const profile = toProfileDto(
          unPayload({
            goals: [GoalPayload.ALTERNANCE, GoalPayload.VIE_QUOTIDIENNE]
          }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.goals).to.deep.equal(['apprenticeship'])
      })
    })

    describe('obstacles', () => {
      const cas: Array<[ObstaclePayload, string]> = [
        [ObstaclePayload.PAS_DE_TRANSPORT, 'transport'],
        [ObstaclePayload.PAS_DE_LOGEMENT, 'housing'],
        [ObstaclePayload.MANQUE_CONFIANCE, 'confidence'],
        [ObstaclePayload.FIN_DE_MOIS, 'money'],
        [ObstaclePayload.GARDE_ENFANT, 'childcare'],
        [ObstaclePayload.PAS_DE_DIPLOME, 'no-diploma'],
        [ObstaclePayload.NUMERIQUE, 'no-device'],
        [ObstaclePayload.HANDICAP, 'disability'],
        [ObstaclePayload.SANTE, 'health']
      ]
      cas.forEach(([obstacle, attendu]) => {
        it(`mappe ${obstacle} vers ${attendu}`, () => {
          // When
          const profile = toProfileDto(
            unPayload({ obstacles: [obstacle] }),
            Core.Structure.INVITE
          )

          // Then
          expect(profile.obstacles).to.deep.equal([attendu])
        })
      })

      it('mappe PAS_DE_PERMIS vers transport comme PAS_DE_TRANSPORT (collision assumée)', () => {
        // When
        const profile = toProfileDto(
          unPayload({ obstacles: [ObstaclePayload.PAS_DE_PERMIS] }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.obstacles).to.deep.equal(['transport'])
      })

      it('dédoublonne PAS_DE_TRANSPORT et PAS_DE_PERMIS', () => {
        // When
        const profile = toProfileDto(
          unPayload({
            obstacles: [
              ObstaclePayload.PAS_DE_TRANSPORT,
              ObstaclePayload.PAS_DE_PERMIS
            ]
          }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.obstacles).to.deep.equal(['transport'])
      })

      it('omet obstacles sans équivalent (PEU_EXPERIENCE, FRANCAIS, AUTRE)', () => {
        // When
        const profile = toProfileDto(
          unPayload({
            obstacles: [
              ObstaclePayload.PEU_EXPERIENCE,
              ObstaclePayload.FRANCAIS,
              ObstaclePayload.AUTRE
            ]
          }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.obstacles).to.be.undefined()
      })

      it('mappe RIEN_NE_ME_BLOQUE vers un tableau vide, même combiné à un autre obstacle', () => {
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
        expect(profile.obstacles).to.be.undefined()
      })

      it("n'envoie pas obstacles quand le champ est absent", () => {
        // When
        const profile = toProfileDto(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profile.obstacles).to.be.undefined()
      })
    })

    describe('age', () => {
      function ilYA(annees: number): string {
        return DateTime.now().minus({ years: annees }).toISODate()!
      }

      it('calcule un âge dans les bornes', () => {
        // When
        const profile = toProfileDto(
          unPayload({ dateNaissance: ilYA(20) }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.age).to.equal(20)
      })

      it('omet age quand dateNaissance est absente', () => {
        // When
        const profile = toProfileDto(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profile.age).to.be.undefined()
      })
      ;[13, 31].forEach(annees => {
        it(`omet age quand il est hors bornes 14-30 (${annees} ans)`, () => {
          // When
          const profile = toProfileDto(
            unPayload({ dateNaissance: ilYA(annees) }),
            Core.Structure.INVITE
          )

          // Then
          expect(profile.age).to.be.undefined()
        })
      })
      ;[14, 30].forEach(annees => {
        it(`conserve age aux bornes 14-30 (${annees} ans)`, () => {
          // When
          const profile = toProfileDto(
            unPayload({ dateNaissance: ilYA(annees) }),
            Core.Structure.INVITE
          )

          // Then
          expect(profile.age).to.equal(annees)
        })
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
        expect(profile.domain).to.equal('mécanique')
      })

      it('relaie null quand le jeune ne sait pas', () => {
        // When
        const profile = toProfileDto(
          unPayload({ domaine: null }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.domain).to.be.null()
      })

      it("n'envoie pas domain quand domaine n'est pas renseigné", () => {
        // When
        const profile = toProfileDto(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profile.domain).to.be.undefined()
      })
    })

    describe('location', () => {
      const rouen: CommunePayload = { codeInsee: '76540', nom: 'Rouen' }
      const fortDeFrance: CommunePayload = {
        codeInsee: '97209',
        nom: 'Fort-de-France'
      }

      it('compose city/radiusKm depuis villeRecherche et territory depuis habitation', () => {
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
        expect(profile.location).to.deep.equal({
          city: 'Rouen',
          radiusKm: 30,
          territory: '972'
        })
      })

      it('replie sur habitation quand villeRecherche est absente', () => {
        // When
        const profile = toProfileDto(
          unPayload({ habitation: rouen }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.location).to.deep.equal({
          city: 'Rouen',
          territory: '76'
        })
      })

      it('replie sur villeRecherche quand habitation est absente', () => {
        // When
        const profile = toProfileDto(
          unPayload({ villeRecherche: fortDeFrance }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.location).to.deep.equal({
          city: 'Fort-de-France',
          territory: '972'
        })
      })

      it("n'envoie pas location quand aucune commune n'est renseignée", () => {
        // When
        const profile = toProfileDto(unPayload(), Core.Structure.INVITE)

        // Then
        expect(profile.location).to.be.undefined()
      })

      it('dérive un département métropolitain sur 2 caractères', () => {
        // When
        const profile = toProfileDto(
          unPayload({ habitation: { codeInsee: '75056', nom: 'Paris' } }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.location?.territory).to.equal('75')
      })

      it('dérive un département ultramarin sur 3 caractères', () => {
        // When
        const profile = toProfileDto(
          unPayload({ habitation: fortDeFrance }),
          Core.Structure.INVITE
        )

        // Then
        expect(profile.location?.territory).to.equal('972')
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
