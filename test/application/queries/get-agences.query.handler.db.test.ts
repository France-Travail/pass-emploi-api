import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import { GetAgencesQueryHandler } from '../../../src/application/queries/get-agences.query.handler.db'
import { AgenceSqlModel } from '../../../src/infrastructure/sequelize/models/agence.sql-model'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { StubbedClass, expect, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'
import { Profil } from '../../../src/domain/profil'

describe('GetAgencesQueryHandler', () => {
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let handler: GetAgencesQueryHandler

  beforeEach(async () => {
    await getDatabase().cleanPG()
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    handler = new GetAgencesQueryHandler(conseillerAuthorizer)
  })

  describe('authorize', () => {
    it("autorise l'utilisateur conseiller de la bonne structure", async () => {
      // When
      await handler.authorize(
        { structure: Profil.Structure.MILO },
        unUtilisateurConseiller()
      )

      expect(
        conseillerAuthorizer.autoriserToutConseiller
      ).to.have.been.calledOnceWithExactly(unUtilisateurConseiller(), true)
    })
  })
  describe('handle', () => {
    it("renvoie les agences en filtrant l'agence du CEJ", async () => {
      // Given
      await AgenceSqlModel.bulkCreate([
        {
          id: '9999',
          nomAgence: 'Agence Du CEJ MILO',
          nomRegion: 'Pays de la Loire',
          structure: 'MILO',
          codeDepartement: 44,
          timezone: 'Paris'
        },
        {
          id: '1',
          nomAgence: 'Agence normale',
          nomRegion: 'Limousin',
          structure: 'FRANCE_TRAVAIL',
          codeDepartement: 87,
          timezone: 'Paris'
        }
      ])

      // When
      const result = await handler.handle({
        structure: Profil.Structure.FRANCE_TRAVAIL
      })

      // Then
      expect(result).to.deep.equal([
        {
          id: '1',
          nom: 'Agence normale',
          codeDepartement: '87'
        }
      ])
    })
  })
})
