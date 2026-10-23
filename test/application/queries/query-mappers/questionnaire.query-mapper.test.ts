import { DateTime } from 'luxon'
import { toQuestionnaireQueryModel } from 'src/application/queries/query-mappers/questionnaire.query-mapper'
import { Questionnaire } from 'src/domain/plan-action/questionnaire'
import { Profil } from 'src/domain/profil'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { expect } from 'test/utils'

describe('toQuestionnaireQueryModel', () => {
  function unQuestionnaire(): Questionnaire.Enregistre {
    return {
      idJeune: 'jeune-1',
      dateCreation: uneDatetime(),
      structure: Profil.Structure.MILO,
      situation: Questionnaire.Situation.LYCEE,
      besoins: [Questionnaire.Besoin.ALTERNANCE],
      contraintes: [Questionnaire.Contrainte.PAS_DE_PERMIS]
    }
  }

  it('renvoie les réponses dans le vocabulaire du contrat mobile', () => {
    // Given
    const questionnaire: Questionnaire.Enregistre = {
      ...unQuestionnaire(),
      dateNaissance: DateTime.fromISO('2005-03-14'),
      communeResidence: { codeInsee: '75056', nom: 'Paris' },
      communeRecherche: { codeInsee: '69123', nom: 'Lyon' },
      domaineProfessionnelVise: 'informatique',
      rayonKm: 30
    }

    // When
    const queryModel = toQuestionnaireQueryModel(questionnaire)

    // Then
    expect(queryModel).to.deep.equal({
      situation: Questionnaire.Situation.LYCEE,
      goals: [Questionnaire.Besoin.ALTERNANCE],
      obstacles: [Questionnaire.Contrainte.PAS_DE_PERMIS],
      dateNaissance: '2005-03-14',
      habitation: { codeInsee: '75056', nom: 'Paris' },
      villeRecherche: { codeInsee: '69123', nom: 'Lyon' },
      domaine: 'informatique',
      rayonKm: 30
    })
  })

  it('omet les réponses vides', () => {
    // When
    const queryModel = toQuestionnaireQueryModel(unQuestionnaire())

    // Then
    expect(queryModel).to.deep.equal({
      situation: Questionnaire.Situation.LYCEE,
      goals: [Questionnaire.Besoin.ALTERNANCE],
      obstacles: [Questionnaire.Contrainte.PAS_DE_PERMIS]
    })
  })

  it('omet une date de naissance invalide au lieu de renvoyer null', () => {
    // Given
    const questionnaire: Questionnaire.Enregistre = {
      ...unQuestionnaire(),
      dateNaissance: DateTime.fromISO('pas-une-date')
    }

    // When
    const queryModel = toQuestionnaireQueryModel(questionnaire)

    // Then
    expect(queryModel).not.to.have.property('dateNaissance')
  })
})
