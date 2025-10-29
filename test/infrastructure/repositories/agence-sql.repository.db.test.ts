import { Core } from '../../../src/domain/core'
import { AgenceSqlRepository } from '../../../src/infrastructure/repositories/agence-sql.repository.db'
import {
  AgenceDto,
  AgenceSqlModel
} from '../../../src/infrastructure/sequelize/models/agence.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { expect } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'
import Structure = Core.Structure

describe('AgenceSqlRepository', () => {
  let agenceSqlRepository: AgenceSqlRepository
  const agenceMilo: Partial<AgenceDto> = {
    id: 'Bonjour je suis un id milo',
    nomAgence: 'Bonjour je suis une agence',
    structure: Structure.MILO,
    codeDepartement: '45',
    nomRegion: 'yolo',
    timezone: 'Paris'
  }
  const agencePE: Partial<AgenceDto> = {
    id: 'Bonjour je suis un id pe',
    nomAgence: 'Bonjour je suis une agence',
    structure: Structure.POLE_EMPLOI,
    codeDepartement: '45',
    nomRegion: 'yolo',
    timezone: 'Paris'
  }

  beforeEach(async () => {
    await getDatabase().cleanPG()
    agenceSqlRepository = new AgenceSqlRepository()
  })

  describe('get', () => {
    it('Retourne undefined qd aucune agence trouvee', async () => {
      // When
      const result = await agenceSqlRepository.get(
        'Bonjour je suis un id pe',
        Structure.POLE_EMPLOI
      )

      // Then
      expect(result).to.be.undefined()
    })
    it("Retourne l'agence correspondante quand la base contient des agences", async () => {
      //Given
      await AgenceSqlModel.create(agenceMilo)
      await AgenceSqlModel.create(agencePE)
      // When
      const result = await agenceSqlRepository.get(
        'Bonjour je suis un id pe',
        Structure.POLE_EMPLOI
      )

      // Then
      expect(result).to.deep.equal({
        id: 'Bonjour je suis un id pe',
        nom: 'Bonjour je suis une agence'
      })
    })
  })

  describe('findAllConseillersByAgence', () => {
    it('Retourne tableau vide quand agence inexistante', async () => {
      // When
      const result = await agenceSqlRepository.findAllConseillersByAgence(
        'et si tu nexistais pas'
      )

      // Then
      expect(result).to.deep.equal([])
    })
    it('Retourne tableau vide quand agence sans conseillers', async () => {
      //Given
      await AgenceSqlModel.create(agenceMilo)

      // When
      const result = await agenceSqlRepository.findAllConseillersByAgence(
        agenceMilo.id!
      )

      // Then
      expect(result).to.deep.equal([])
    })
    it('Retourne tableau conseillers quand agence avec conseillers', async () => {
      //Given
      await AgenceSqlModel.create(agenceMilo)
      const conseiller = unConseillerDto({ idAgence: agenceMilo.id! })
      await ConseillerSqlModel.create(conseiller)

      // When
      const result = await agenceSqlRepository.findAllConseillersByAgence(
        agenceMilo.id!
      )

      // Then
      expect(result).to.deep.equal([
        {
          id: conseiller.id,
          firstName: conseiller.prenom,
          lastName: conseiller.nom,
          structure: conseiller.structure,
          email: conseiller.email,
          notificationsSonores: conseiller.notificationsSonores,
          agence: {
            id: conseiller.idAgence!,
            nom: undefined
          }
        }
      ])
    })
  })
})
