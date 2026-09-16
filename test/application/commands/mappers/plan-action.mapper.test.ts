import {
  toPlanActionQueryModel,
  toProfilJeune
} from '../../../../src/application/commands/mappers/plan-action.mapper'
import { TypeActionPlan } from '../../../../src/application/queries/query-models/plan-action.query-model'
import { PlanAction } from '../../../../src/domain/plan-action'
import { Profil } from '../../../../src/domain/profil'
import {
  CommunePayload,
  GenererPlanActionPayload,
  GoalPayload,
  ObstaclePayload,
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
  describe('toProfilJeune', () => {
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
          const profil = toProfilJeune(
            unPayload({ situation }),
            Profil.Structure.INVITE
          )

          // Then
          expect(profil.situation).to.equal(attendu)
        })
      })
    })

    describe('goals', () => {
      it('mappe chaque envie du questionnaire vers le vocabulaire du référentiel', () => {
        // When
        const profil = toProfilJeune(
          unPayload({ goals: Object.values(GoalPayload) }),
          Profil.Structure.INVITE
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
      it('mappe chaque frein du questionnaire vers le vocabulaire du référentiel', () => {
        // Given
        const freins = Object.values(ObstaclePayload).filter(
          obstacle => obstacle !== ObstaclePayload.RIEN_NE_ME_BLOQUE
        )

        // When
        const profil = toProfilJeune(
          unPayload({ obstacles: freins }),
          Profil.Structure.INVITE
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
        const profil = toProfilJeune(
          unPayload({
            obstacles: [
              ObstaclePayload.RIEN_NE_ME_BLOQUE,
              ObstaclePayload.PAS_DE_TRANSPORT
            ]
          }),
          Profil.Structure.INVITE
        )

        // Then
        expect(profil.obstacles).to.deep.equal(['RIEN_NE_ME_BLOQUE'])
      })

      it('dédoublonne les freins', () => {
        // When
        const profil = toProfilJeune(
          unPayload({
            obstacles: [
              ObstaclePayload.PAS_DE_TRANSPORT,
              ObstaclePayload.PAS_DE_TRANSPORT
            ]
          }),
          Profil.Structure.INVITE
        )

        // Then
        expect(profil.obstacles).to.deep.equal(['PAS_DE_TRANSPORT'])
      })

      it('produit un tableau vide quand le champ est absent', () => {
        // When
        const profil = toProfilJeune(unPayload(), Profil.Structure.INVITE)

        // Then
        expect(profil.obstacles).to.deep.equal([])
      })
    })

    describe('dateNaissance', () => {
      it('relaie la date de naissance', () => {
        // When
        const profil = toProfilJeune(
          unPayload({ dateNaissance: '2006-05-12' }),
          Profil.Structure.INVITE
        )

        // Then
        expect(profil.dateNaissance).to.equal('2006-05-12')
      })

      it('tronque un ISO complet en date civile, sans glissement de fuseau', () => {
        // When
        const profil = toProfilJeune(
          unPayload({ dateNaissance: '2006-05-12T00:00:00+02:00' }),
          Profil.Structure.INVITE
        )

        // Then
        expect(profil.dateNaissance).to.equal('2006-05-12')
      })

      it('ne produit pas dateNaissance quand elle est absente', () => {
        // When
        const profil = toProfilJeune(unPayload(), Profil.Structure.INVITE)

        // Then
        expect(profil.dateNaissance).to.be.undefined()
      })
    })

    describe('localisation', () => {
      const rouen: CommunePayload = { codeInsee: '76540', nom: 'Rouen' }
      const fortDeFrance: CommunePayload = {
        codeInsee: '97209',
        nom: 'Fort-de-France'
      }

      it('relaie les deux communes', () => {
        // When
        const profil = toProfilJeune(
          unPayload({ habitation: fortDeFrance, villeRecherche: rouen }),
          Profil.Structure.INVITE
        )

        // Then
        expect(profil.habitation).to.deep.equal(fortDeFrance)
        expect(profil.villeRecherche).to.deep.equal(rouen)
      })

      it('relaie une seule commune quand le jeune ne renseigne que celle-là', () => {
        // When
        const profil = toProfilJeune(
          unPayload({ habitation: rouen }),
          Profil.Structure.INVITE
        )

        // Then
        expect(profil.habitation).to.deep.equal(rouen)
        expect(profil.villeRecherche).to.be.undefined()
      })

      it("ne produit aucune localisation quand rien n'est renseigné", () => {
        // When
        const profil = toProfilJeune(unPayload(), Profil.Structure.INVITE)

        // Then
        expect(profil.habitation).to.be.undefined()
        expect(profil.villeRecherche).to.be.undefined()
      })
    })

    describe('authProvider', () => {
      const cas: Array<[Profil.Structure, string]> = [
        [Profil.Structure.INVITE, 'guest'],
        [Profil.Structure.MILO, 'mission-locale'],
        [Profil.Structure.FRANCE_TRAVAIL, 'france-travail'],
        [Profil.Structure.CONSEIL_DEPARTEMENTAL, 'france-travail']
      ]
      cas.forEach(([structure, attendu]) => {
        it(`dérive ${attendu} de la structure ${structure}`, () => {
          // When
          const profil = toProfilJeune(unPayload(), structure)

          // Then
          expect(profil.authProvider).to.equal(attendu)
        })
      })
    })
  })

  describe('toPlanActionQueryModel', () => {
    function uneSolution(
      args: Partial<PlanAction.Solution> = {}
    ): PlanAction.Solution {
      return {
        id: 'p-1',
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

    function unPlan(solutions: PlanAction.Solution[]): PlanAction.Plan {
      return {
        id: 'plan-1',
        objectifs: [
          {
            id: 'objective-1',
            titre: 'Trouver une alternance',
            theme: 'ALTERNANCE',
            solutions
          }
        ]
      }
    }

    it("recopie l'id du plan et les objectifs (id, titre, theme)", () => {
      // When
      const queryModel = toPlanActionQueryModel(unPlan([]))

      // Then
      expect(queryModel).to.deep.equal({
        id: 'plan-1',
        objectives: [
          {
            id: 'objective-1',
            titre: 'Trouver une alternance',
            theme: 'ALTERNANCE',
            actions: []
          }
        ]
      })
    })

    it('mappe link vers LIEN avec url et service', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan([
          uneSolution({
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

    it('mappe app vers NAVIGATION', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan([uneSolution({ kind: 'app' })])
      )

      // Then
      expect(queryModel.objectives[0].actions[0].type).to.equal(
        TypeActionPlan.NAVIGATION
      )
    })

    it('mappe advice vers CONSEIL, sans url ni service quand la solution n’en a pas', () => {
      // When
      const queryModel = toPlanActionQueryModel(
        unPlan([uneSolution({ kind: 'advice' })])
      )

      // Then
      expect(queryModel.objectives[0].actions[0]).to.deep.equal({
        id: 'p-1',
        libelle: 'Je fais une action',
        type: TypeActionPlan.CONSEIL
      })
    })
  })
})
