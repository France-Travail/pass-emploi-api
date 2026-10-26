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
})
