import { RuntimeException } from '@nestjs/core/errors/exceptions/runtime.exception'
import axios from 'axios'
import * as nock from 'nock'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { ExternalApiLoggerService } from '../../../src/utils/external-api-logger.service'
import { expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { getDatabase } from '../../utils/database-for-testing'

describe('OidcClient', () => {
  let oidcClient: OidcClient
  const configService = testConfig()
  const issuerUrl = configService.get('oidc').issuerUrl
  const clientId = configService.get('oidc').clientId
  const clientSecret = configService.get('oidc').clientSecret

  beforeEach(async () => {
    const externalApiLogger = stubClass(ExternalApiLoggerService)
    externalApiLogger.createAxios.returns(axios.create())
    oidcClient = new OidcClient(configService, externalApiLogger)
  })

  describe('deleteUserByIdUser', () => {
    const apiUrl = configService.get('oidc').issuerApiUrl
    it('echoue lorsque la récupération du token est en erreur', async () => {
      // Given
      nock(issuerUrl)
        .post('/protocol/openid-connect/token', {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        })
        .reply(400)

      try {
        // When
        await oidcClient.deleteUserByIdUser('id')
        expect.fail(null, null, 'handle test did not reject with an error')
      } catch (e) {
        // Then
        expect(e).to.be.an.instanceOf(RuntimeException)
      }
    })
    it("echoue lorsque la récupération de l'utilisateur est en erreur", async () => {
      // Given
      const token = 'tok'
      nock(issuerUrl)
        .post('/protocol/openid-connect/token', {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        })
        .reply(200, { access_token: token })

      const idUser = 'id'
      nock(apiUrl).get(`/users?q=id_user:${idUser}`).reply(400)

      try {
        // When
        await oidcClient.deleteUserByIdUser(idUser)
        expect.fail(null, null, 'handle test did not reject with an error')
      } catch (e) {
        // Then
        expect(e).to.be.an.instanceOf(RuntimeException)
      }
    })
    it("passe lorsque la récupération de l'utilisateur est 404", async () => {
      // Given
      const token = 'tok'
      nock(issuerUrl)
        .post('/protocol/openid-connect/token', {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        })
        .reply(200, { access_token: token })

      const idUser = 'id'
      nock(apiUrl).get(`/users?q=id_user:${idUser}`).reply(404)

      try {
        // When
        await oidcClient.deleteUserByIdUser(idUser)
      } catch (_e) {
        // Then
        expect.fail(null, null, 'handle test rejected with an error')
      }
    })
    it("passe sans supprimer lorsque la récupération de l'utilisateur est vide", async () => {
      // Given
      const token = 'tok'
      nock(issuerUrl)
        .post('/protocol/openid-connect/token', {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        })
        .reply(200, { access_token: token })

      const idUser = 'id'
      nock(apiUrl).get(`/users?q=id_user:${idUser}`).reply(200, [])

      try {
        // When
        await oidcClient.deleteUserByIdUser(idUser)
      } catch (_e) {
        // Then
        expect.fail(null, null, 'handle test rejected with an error')
      }
    })
    it("echoue lorsque la suppression de l'utilisateur est en erreur", async () => {
      // Given
      const token = 'tok'
      nock(issuerUrl)
        .post('/protocol/openid-connect/token', {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        })
        .reply(200, { access_token: token })

      const idUser = 'id'
      const idAuth = 'idAuth'
      nock(apiUrl)
        .get(`/users?q=id_user:${idUser}`)
        .reply(200, [{ id: idAuth }])

      nock(apiUrl).delete(`/users/${idAuth}`).reply(400)

      try {
        // When
        await oidcClient.deleteUserByIdUser(idUser)
        expect.fail(null, null, 'handle test did not reject with an error')
      } catch (e) {
        // Then
        expect(e).to.be.an.instanceOf(RuntimeException)
      }
    })
    it("passe lorsque la suppression de l'utilisateur est 404", async () => {
      // Given
      const token = 'tok'
      nock(issuerUrl)
        .post('/protocol/openid-connect/token', {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        })
        .reply(200, { access_token: token })

      const idUser = 'id'
      const idAuth = 'idAuth'
      nock(apiUrl)
        .get(`/users?q=id_user:${idUser}`)
        .reply(200, [{ id: idAuth }])

      nock(apiUrl).delete(`/users/${idAuth}`).reply(404)

      try {
        // When
        await oidcClient.deleteUserByIdUser(idUser)
      } catch (_e) {
        // Then
        expect.fail(null, null, 'handle test rejected with an error')
      }
    })
    it("passe lorsque la suppression de l'utilisateur est ok", async () => {
      // Given
      const token = 'tok'
      nock(issuerUrl)
        .post('/protocol/openid-connect/token', {
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret
        })
        .reply(200, { access_token: token })

      const idUser = 'id'
      const idAuth = 'idAuth'
      nock(apiUrl)
        .get(`/users?q=id_user:${idUser}`)
        .reply(200, [{ id: idAuth }])

      nock(apiUrl).delete(`/users/${idAuth}`).reply(200)

      try {
        // When
        await oidcClient.deleteUserByIdUser(idUser)
      } catch (_e) {
        // Then
        expect.fail(null, null, 'handle test rejected with an error')
      }
    })
  })

  describe('deleteAccount', () => {
    const apiUrl = configService.get('oidc').issuerApiUrl
    beforeEach(async () => {
      await getDatabase().cleanPG()
    })

    it("passe lorsque l'appel d'api est ok avec user jeune", async () => {
      // Given
      const idAuthentification = 'idAuth'
      const id = 'idCejJeune'
      await ConseillerSqlModel.create(unConseillerDto())
      await JeuneSqlModel.create(unJeuneDto({ id, idAuthentification }))
      nock(apiUrl).delete('/accounts/idAuth').reply(204)

      try {
        // When
        await oidcClient.deleteAccount(id)
      } catch (_e) {
        // Then
        expect.fail(null, null, 'handle test rejected with an error')
      }
    })
    it("passe lorsque l'appel d'api est ok avec user conseiller", async () => {
      // Given
      const idAuthentification = 'idAuth'
      const id = 'idCejConseiller'
      await ConseillerSqlModel.create(
        unConseillerDto({ id, idAuthentification })
      )
      nock(apiUrl).delete('/accounts/idAuth').reply(204)

      try {
        // When
        await oidcClient.deleteAccount(id)
      } catch (_e) {
        // Then
        expect.fail(null, null, 'handle test rejected with an error')
      }
    })
    it("echoue lorsque l'appel d'api est ko", async () => {
      // Given
      nock(apiUrl).delete('/accounts/idAuth').reply(500)

      try {
        // When
        await oidcClient.deleteAccount('idAuth')
        expect.fail(null, null, 'handle test did not reject with an error')
      } catch (_e) {}
    })
  })

  describe('deleteAccountByIdAuth', () => {
    const apiUrl = configService.get('oidc').issuerApiUrl

    it("passe lorsque l'appel d'api est ok", async () => {
      // Given
      nock(apiUrl).delete('/accounts/idAuthInvite').reply(204)

      try {
        // When
        await oidcClient.deleteAccountByIdAuth('idAuthInvite')
      } catch (_e) {
        // Then
        expect.fail(null, null, 'handle test rejected with an error')
      }
    })

    it("passe (idempotence) lorsque l'appel d'api renvoie 404", async () => {
      // Given
      nock(apiUrl).delete('/accounts/idAuthInvite').reply(404)

      try {
        // When
        await oidcClient.deleteAccountByIdAuth('idAuthInvite')
      } catch (_e) {
        // Then
        expect.fail(null, null, 'handle test rejected with an error')
      }
    })

    it("echoue lorsque l'appel d'api est ko avec un code différent de 404", async () => {
      // Given
      nock(apiUrl).delete('/accounts/idAuthInvite').reply(500)

      try {
        // When
        await oidcClient.deleteAccountByIdAuth('idAuthInvite')
        expect.fail(null, null, 'handle test did not reject with an error')
      } catch (_e) {}
    })
  })
})
