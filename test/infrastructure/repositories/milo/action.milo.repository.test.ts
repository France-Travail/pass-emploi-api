import { testConfig } from '../../../utils/module-for-testing'
import { HttpService } from '@nestjs/axios'
import { ActionMiloHttpRepository } from '../../../../src/infrastructure/repositories/milo/action.milo.repository'
import { expect } from '../../../utils'
import { uneActionMilo } from '../../../fixtures/action.fixture'
import {
  emptySuccess,
  failure
} from '../../../../src/building-blocks/types/result'
import { ErreurHttp } from '../../../../src/building-blocks/types/domain-error'
import * as nock from 'nock'
import { RateLimiterService } from '../../../../src/utils/rate-limiter.service'

describe('MiloHttpSqlRepository', () => {
  const configService = testConfig()
  const rateLimiterService = new RateLimiterService(configService)

  let repository: ActionMiloHttpRepository

  beforeEach(() => {
    const httpService = new HttpService()
    repository = new ActionMiloHttpRepository(
      httpService,
      configService,
      rateLimiterService
    )
  })

  describe('save', () => {
    describe('quand Milo renvoie une erreur 4XX', () => {
      it('renvoie une failure', async () => {
        // Given
        nock('https://milo.com')
          .post('/sue/dossiers/idDossier/situation')
          .reply(404, {
            message: 'un message'
          })
          .isDone()

        // When
        const result = await repository.save(
          uneActionMilo({ idJeune: 'id-jeune-avec-id-dossier' })
        )

        // Then
        expect(result).to.deep.equal(failure(new ErreurHttp('un message', 404)))
      })
    })

    describe('quand Milo renvoie une erreur 500', () => {
      it('throw une exception', async () => {
        // Given
        nock('https://milo.com')
          .post('/sue/dossiers/idDossier/situation')
          .reply(500, 'Internal Server Error')
          .isDone()

        // When
        const result = await repository.save(
          uneActionMilo({ idJeune: 'id-jeune-avec-id-dossier' })
        )

        // Then
        expect(result).to.deep.equal(
          failure(new ErreurHttp('Erreur API MILO qualification', 500))
        )
      })
    })

    describe('quand Milo est up and ready', () => {
      it('crée une SNP avec le bon body et le bon header', async () => {
        // Given
        const scope = nock('https://milo.com')
          .post('/sue/dossiers/idDossier/situation', {
            dateDebut: '2022-03-01',
            dateFinReelle: '2022-03-01',
            commentaire: 'Un commentaire',
            mesure: 'SANTE',
            loginConseiller: 'loginConseiller'
          })
          .matchHeader(
            'X-Gravitee-Api-Key',
            configService.get('milo').apiKeyDossier
          )
          .reply(201)

        // When
        const result = await repository.save(
          uneActionMilo({ idJeune: 'id-jeune-avec-id-dossier' })
        )

        // Then
        expect(scope.isDone()).to.equal(true)
        expect(result).to.deep.equal(emptySuccess())
      })
    })
  })
})
