import { DateTime } from 'luxon'
import { before } from 'mocha'
import { Recherche } from 'src/domain/offre/recherche/recherche'
import { RechercheSqlModel } from 'src/infrastructure/sequelize/models/recherche.sql-model'
import { SuggestionSqlModel } from 'src/infrastructure/sequelize/models/suggestion.sql-model'
import { purgerLesRecherchesEnDoublon } from 'src/scripts/purger-recherches-doublons'
import { ConseillerSqlModel } from '../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../src/infrastructure/sequelize/models/jeune.sql-model'
import { uneDatetime } from '../fixtures/date.fixture'
import { unConseillerDto } from '../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../fixtures/sql-models/jeune.sql-model'
import { expect } from '../utils'
import { DatabaseForTesting, getDatabase } from '../utils/database-for-testing'

describe('purgerLesRecherchesEnDoublon', () => {
  let databaseForTesting: DatabaseForTesting

  const idJeune = 'ABCDE'
  const criteres = { q: 'Serveur', commune: '54323' }

  before(() => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    const conseillerDto = unConseillerDto()
    await ConseillerSqlModel.creer(conseillerDto)
    await JeuneSqlModel.creer(
      unJeuneDto({ id: idJeune, idConseiller: conseillerDto.id })
    )
  })

  const creerRecherche = async (
    id: string,
    dateCreation: DateTime,
    criteresRecherche: object = criteres
  ): Promise<void> => {
    await RechercheSqlModel.create({
      id,
      idJeune,
      type: Recherche.Type.OFFRES_EMPLOI,
      titre: 'Serveur',
      metier: null,
      localisation: null,
      criteres: criteresRecherche,
      dateCreation: dateCreation.toJSDate(),
      dateDerniereRecherche: dateCreation.toJSDate(),
      etatDerniereRecherche: Recherche.Etat.SUCCES
    })
  }

  const creerSuggestionSur = async (
    id: string,
    idRecherche: string
  ): Promise<void> => {
    await SuggestionSqlModel.create({
      id,
      idFonctionnel: `fonctionnel-${id}`,
      idJeune,
      type: Recherche.Type.OFFRES_EMPLOI,
      source: 'POLE_EMPLOI',
      titre: 'Serveur',
      metier: null,
      localisation: null,
      criteres,
      dateCreation: uneDatetime().toJSDate(),
      dateRafraichissement: uneDatetime().toJSDate(),
      idRecherche
    })
  }

  const idA = '11111111-1111-1111-1111-111111111111'
  const idB = '22222222-2222-2222-2222-222222222222'
  const idC = '33333333-3333-3333-3333-333333333333'

  describe('en mode simulation', () => {
    it('compte les doublons sans rien supprimer', async () => {
      // Given
      await creerRecherche(idA, uneDatetime().minus({ day: 2 }))
      await creerRecherche(idB, uneDatetime().minus({ day: 1 }))
      await creerRecherche(idC, uneDatetime())

      // When
      const stats = await purgerLesRecherchesEnDoublon(
        databaseForTesting.sequelize,
        { dryRun: true }
      )

      // Then
      expect(stats.groupesDupliques).to.equal(1)
      expect(stats.jeunesImpactes).to.equal(1)
      expect(stats.lignesEnTrop).to.equal(2)
      expect(stats.pireCas).to.equal(3)
      expect(stats.lignesSupprimees).to.equal(0)
      expect(await RechercheSqlModel.count()).to.equal(3)
    })
  })

  describe('en mode suppression', () => {
    it('garde la plus ancienne et supprime les autres', async () => {
      // Given
      await creerRecherche(idA, uneDatetime().minus({ day: 2 }))
      await creerRecherche(idB, uneDatetime().minus({ day: 1 }))
      await creerRecherche(idC, uneDatetime())

      // When
      const stats = await purgerLesRecherchesEnDoublon(
        databaseForTesting.sequelize,
        { dryRun: false }
      )

      // Then
      expect(stats.lignesSupprimees).to.equal(2)
      const restantes = await RechercheSqlModel.findAll({ raw: true })
      expect(restantes.length).to.equal(1)
      expect(restantes[0].id).to.equal(idA)
    })

    it('garde la ligne porteuse de suggestion même si elle est plus récente', async () => {
      // Given
      await creerRecherche(idA, uneDatetime().minus({ day: 2 }))
      await creerRecherche(idB, uneDatetime())
      await creerSuggestionSur('f781ae20-8838-49c7-aa2e-9b224318fb65', idB)

      // When
      const stats = await purgerLesRecherchesEnDoublon(
        databaseForTesting.sequelize,
        { dryRun: false }
      )

      // Then
      expect(stats.suggestionsPerdues).to.equal(0)
      expect(stats.lignesSupprimees).to.equal(1)
      const restantes = await RechercheSqlModel.findAll({ raw: true })
      expect(restantes.length).to.equal(1)
      expect(restantes[0].id).to.equal(idB)
      expect(await SuggestionSqlModel.count()).to.equal(1)
    })

    it('signale les suggestions perdues quand plusieurs doublons en portent', async () => {
      // Given
      await creerRecherche(idA, uneDatetime().minus({ day: 2 }))
      await creerRecherche(idB, uneDatetime())
      await creerSuggestionSur('f781ae20-8838-49c7-aa2e-9b224318fb65', idA)
      await creerSuggestionSur('f781ae20-8838-49c7-aa2e-9b224318fb66', idB)

      // When
      const stats = await purgerLesRecherchesEnDoublon(
        databaseForTesting.sequelize,
        { dryRun: false }
      )

      // Then
      expect(stats.suggestionsPerdues).to.equal(1)
      expect(await SuggestionSqlModel.count()).to.equal(1)
    })

    it('ne touche pas aux alertes aux critères différents', async () => {
      // Given
      await creerRecherche(idA, uneDatetime().minus({ day: 1 }))
      await creerRecherche(idB, uneDatetime(), { q: 'Serveur', commune: '75' })

      // When
      const stats = await purgerLesRecherchesEnDoublon(
        databaseForTesting.sequelize,
        { dryRun: false }
      )

      // Then
      expect(stats.groupesDupliques).to.equal(0)
      expect(stats.lignesSupprimees).to.equal(0)
      expect(await RechercheSqlModel.count()).to.equal(2)
    })

    it('est idempotent', async () => {
      // Given
      await creerRecherche(idA, uneDatetime().minus({ day: 1 }))
      await creerRecherche(idB, uneDatetime())
      await purgerLesRecherchesEnDoublon(databaseForTesting.sequelize, {
        dryRun: false
      })

      // When
      const stats = await purgerLesRecherchesEnDoublon(
        databaseForTesting.sequelize,
        { dryRun: false }
      )

      // Then
      expect(stats.lignesSupprimees).to.equal(0)
      expect(await RechercheSqlModel.count()).to.equal(1)
    })
  })
})
