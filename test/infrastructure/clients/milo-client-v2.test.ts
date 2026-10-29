import axios from 'axios'
import { expect } from 'chai'
import * as nock from 'nock'
import { isSuccess } from 'src/building-blocks/types/result'
import { MiloClientV2 } from 'src/infrastructure/clients/milo/milo-client-v2'
import { MiloClientUtils } from 'src/infrastructure/clients/milo/milo-client-utils'
import { testConfig } from 'test/utils/module-for-testing'
import { DateService } from '../../../src/utils/date-service'
import { ExternalApiLoggerService } from '../../../src/utils/external-api-logger.service'
import { RateLimiterService } from '../../../src/utils/rate-limiter.service'
import { stubClass } from '../../utils'

describe('MiloClientV2', () => {
  const configService = testConfig()
  const rateLimiterService = new RateLimiterService(configService)
  const MILO_BASE_URL = 'https://milo.com'
  let miloClient: MiloClientV2

  beforeEach(() => {
    const externalApiLogger = stubClass(ExternalApiLoggerService)
    externalApiLogger.createAxios.returns(axios.create())
    miloClient = new MiloClientV2(
      new MiloClientUtils(configService, externalApiLogger),
      configService,
      rateLimiterService,
      stubClass(DateService)
    )
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('getDossier', () => {
    const idDossier = '123456'
    const dossierDto = {
      idDossier: 123456,
      idJeune: 'id',
      numeroDE: 'num',
      nomNaissance: 'N',
      nomUsage: 'N',
      prenom: 'P',
      dateNaissance: '2000-01-01',
      mail: null,
      accompagnementCEJ: {
        accompagnementCEJ: true,
        dateDebut: null,
        dateFinPrevue: null,
        dateFinReelle: null,
        premierAccompagnement: null
      },
      situationsCEJ: []
    }

    it('appelle la route JWT avec la clé JWT et le token quand un token est fourni', async () => {
      const scope = nock(MILO_BASE_URL)
        .get(`/api-dossiers-cej/dossiers/${idDossier}/jwt`)
        .matchHeader('X-Gravitee-Api-Key', 'apiKeyJwtDossierCej')
        .matchHeader('Authorization', 'Bearer idpToken')
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, dossierDto)

      const result = await miloClient.getDossier(
        idDossier,
        async () => 'idpToken'
      )

      expect(scope.isDone()).to.equal(true)
      expect(isSuccess(result)).to.be.true()
    })

    it("appelle la route sans JWT avec la clé API seule quand aucun token n'est fourni", async () => {
      const scope = nock(MILO_BASE_URL, {
        badheaders: ['Authorization']
      })
        .get(`/api-dossiers-cej/dossiers/${idDossier}`)
        .matchHeader('X-Gravitee-Api-Key', 'apiKeyDossierCej')
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, dossierDto)

      const result = await miloClient.getDossier(idDossier)

      expect(scope.isDone()).to.equal(true)
      expect(isSuccess(result)).to.be.true()
    })
  })

  describe('creerSituationDossier', () => {
    it('appelle la route JWT avec la clé API et le token', async () => {
      const body = {
        dateDebut: '2024-06-01',
        dateFinReelle: '2024-06-02',
        commentaire: 'Informations complémentaires',
        mesure: 'PROJET_PROFESSIONNEL',
        loginConseiller: 'j.doe'
      }
      const scope = nock(MILO_BASE_URL)
        .post('/api-dossiers/dossiers/123456/JWT/situation', body)
        .matchHeader('X-Gravitee-Api-Key', 'apiKeyJwtDossier')
        .matchHeader('Authorization', 'Bearer idpToken')
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(201)

      const result = await miloClient.creerSituationDossier(
        '123456',
        body,
        async () => 'idpToken'
      )

      expect(scope.isDone()).to.equal(true)
      expect(isSuccess(result)).to.be.true()
    })
  })

  describe('creerJeune', () => {
    it('crée le compte jeune en POST avec la clé JWT et le token', async () => {
      const scope = nock(MILO_BASE_URL)
        .post('/api-jeune/compte-jeune/123456')
        .matchHeader('X-Gravitee-Api-Key', 'apiKeyJwtJeune')
        .matchHeader('Authorization', 'Bearer idpToken')
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, 'idAuthentification')

      const result = await miloClient.creerJeune('123456', 'idpToken')

      expect(scope.isDone()).to.equal(true)
      expect(result).to.deep.equal({
        _isSuccess: true,
        data: {
          idAuthentification: 'idAuthentification',
          existeDejaChezMilo: false
        }
      })
    })

    it('surcharge le compte jeune en PUT sans body avec la clé JWT et le token', async () => {
      const scope = nock(MILO_BASE_URL)
        .put('/api-jeune/sue/compte-jeune/123456')
        .matchHeader('X-Gravitee-Api-Key', 'apiKeyJwtJeune')
        .matchHeader('Authorization', 'Bearer idpToken')
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, 'idAuthentification')

      const result = await miloClient.creerJeune('123456', 'idpToken', true)

      expect(scope.isDone()).to.equal(true)
      expect(result).to.deep.equal({
        _isSuccess: true,
        data: {
          idAuthentification: 'idAuthentification',
          existeDejaChezMilo: false
        }
      })
    })
  })

  describe('getInstanceSession', () => {
    it('appelle la route api-sessions avec la clé API seule', async () => {
      const scope = nock(MILO_BASE_URL, {
        badheaders: ['Authorization']
      })
        .get('/api-sessions/dossiers/1234/sessions/5678')
        .matchHeader('X-Gravitee-Api-Key', 'apiKeySessions')
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, { id: '5678' })

      const result = await miloClient.getInstanceSession('5678', '1234')

      expect(scope.isDone()).to.equal(true)
      expect(isSuccess(result)).to.be.true()
    })
  })

  describe('getRendezVous', () => {
    it('appelle la route api-rdv avec la clé API seule', async () => {
      const scope = nock(MILO_BASE_URL, {
        badheaders: ['Authorization']
      })
        .get('/api-rdv/dossiers/1234/rdv/5678')
        .matchHeader('X-Gravitee-Api-Key', 'apiKeyRdv')
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, { id: 5678 })

      const result = await miloClient.getRendezVous('1234', '5678')

      expect(scope.isDone()).to.equal(true)
      expect(isSuccess(result)).to.be.true()
    })
  })
})
