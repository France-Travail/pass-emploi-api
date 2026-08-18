import { before } from 'mocha'
import {
  ModifierAgenceFTConseillerCommand,
  ModifierAgenceFTConseillerCommandHandler
} from '../../../../src/application/commands/support/modifier-agence-ft-conseiller.command.handler.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import { isSuccess } from '../../../../src/building-blocks/types/result'
import { Core } from '../../../../src/domain/core'
import { AgenceSqlModel } from '../../../../src/infrastructure/sequelize/models/agence.sql-model'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import {
  uneAgenceDto,
  uneAgenceMiloDto
} from '../../../fixtures/sql-models/agence.sql-model'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { expect } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'

describe('ModifierAgenceFTConseillerCommandHandler', () => {
  let databaseForTesting: DatabaseForTesting
  let handler: ModifierAgenceFTConseillerCommandHandler

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()

    await AgenceSqlModel.bulkCreate([
      uneAgenceDto({ id: 'agence-ft-1', nomAgence: 'Nice' }),
      uneAgenceDto({ id: 'agence-ft-2', nomAgence: 'Cannes' }),
      uneAgenceMiloDto({ id: 'agence-milo-1' })
    ])

    handler = new ModifierAgenceFTConseillerCommandHandler()
  })

  describe('handle', () => {
    it("rattache le conseiller FT à l'agence cible", async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({
          id: 'conseiller-ft',
          structure: Core.Structure.FT_ACCOMPAGNEMENT_INTENSIF,
          idAgence: 'agence-ft-1'
        })
      )
      const command: ModifierAgenceFTConseillerCommand = {
        idConseiller: 'conseiller-ft',
        idAgence: 'agence-ft-2'
      }

      // When
      const result = await handler.handle(command)

      // Then
      expect(isSuccess(result)).to.equal(true)
      const conseillerSql = await ConseillerSqlModel.findByPk('conseiller-ft')
      expect(conseillerSql?.idAgence).to.equal('agence-ft-2')
    })

    it("efface l'agence saisie manuellement du conseiller sans agence référencée", async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({
          id: 'conseiller-ft',
          structure: Core.Structure.POLE_EMPLOI,
          idAgence: null,
          nomManuelAgence: 'Agence saisie à la main'
        })
      )
      const command: ModifierAgenceFTConseillerCommand = {
        idConseiller: 'conseiller-ft',
        idAgence: 'agence-ft-1'
      }

      // When
      const result = await handler.handle(command)

      // Then
      expect(isSuccess(result)).to.equal(true)
      const conseillerSql = await ConseillerSqlModel.findByPk('conseiller-ft')
      expect(conseillerSql?.idAgence).to.equal('agence-ft-1')
      expect(conseillerSql?.nomManuelAgence).to.equal(null)
    })

    it("renvoie une failure quand le conseiller n'existe pas", async () => {
      // When
      const result = await handler.handle({
        idConseiller: 'conseiller-inconnu',
        idAgence: 'agence-ft-1'
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Conseiller', 'conseiller-inconnu')
      })
    })

    it("renvoie une failure quand le conseiller n'est pas France Travail", async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({
          id: 'conseiller-milo',
          structure: Core.Structure.MILO,
          idAgence: 'agence-milo-1'
        })
      )

      // When
      const result = await handler.handle({
        idConseiller: 'conseiller-milo',
        idAgence: 'agence-ft-1'
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new MauvaiseCommandeError(
          "Le conseiller n'est pas France Travail (structure MILO)"
        )
      })
      const conseillerSql = await ConseillerSqlModel.findByPk('conseiller-milo')
      expect(conseillerSql?.idAgence).to.equal('agence-milo-1')
    })

    it("renvoie une failure quand l'agence n'est pas dans le référentiel France Travail", async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({
          id: 'conseiller-ft',
          structure: Core.Structure.POLE_EMPLOI_AIJ,
          idAgence: 'agence-ft-1'
        })
      )

      // When
      const result = await handler.handle({
        idConseiller: 'conseiller-ft',
        idAgence: 'agence-milo-1'
      })

      // Then
      expect(result).to.deep.equal({
        _isSuccess: false,
        error: new NonTrouveError('Agence France Travail', 'agence-milo-1')
      })
      const conseillerSql = await ConseillerSqlModel.findByPk('conseiller-ft')
      expect(conseillerSql?.idAgence).to.equal('agence-ft-1')
    })
  })
})
