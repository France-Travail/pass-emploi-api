import { ConfigService } from '@nestjs/config'
import { GetReferentielRomePocOrientationQueryHandler } from '../../../src/application/queries/get-referentiel-rome-poc-orientation.query.handler'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { PoleEmploiClient } from '../../../src/infrastructure/clients/pole-emploi-client'
import { DateService } from '../../../src/utils/date-service'
import { uneDatetime } from '../../fixtures/date.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('GetReferentielRomePocOrientationQueryHandler', () => {
  let poleEmploiClient: StubbedClass<PoleEmploiClient>
  let dateService: StubbedClass<DateService>
  let handler: GetReferentielRomePocOrientationQueryHandler

  beforeEach(() => {
    poleEmploiClient = stubClass(PoleEmploiClient)
    dateService = stubClass(DateService)
    dateService.now.returns(uneDatetime())
    handler = new GetReferentielRomePocOrientationQueryHandler(
      poleEmploiClient,
      new ConfigService({ environment: 'staging' }),
      dateService
    )
  })

  describe('handle', () => {
    it('relaie la fiche métier demandée à ROME', async () => {
      // Given
      poleEmploiClient.getReferentielRome
        .withArgs('metier/D1102', undefined)
        .resolves(success({ code: 'D1102' }))

      // When
      const result = await handler.handle({
        ressource: 'FICHE_METIER',
        code: 'D1102'
      })

      // Then
      expect(result).to.deep.equal(success({ code: 'D1102' }))
    })

    it("demande les métiers d'un centre d'intérêt avec leurs codes et libellés", async () => {
      // Given
      poleEmploiClient.getReferentielRome.resolves(success({ metiers: [] }))

      // When
      await handler.handle({
        ressource: 'METIERS_DU_CENTRE_INTERET',
        code: '6'
      })

      // Then
      expect(
        poleEmploiClient.getReferentielRome
      ).to.have.been.calledOnceWithExactly(
        'centre-interet/6',
        'code,libelle,metiers(code,libelle)'
      )
    })

    it('garde la réponse de ROME pendant 24 h', async () => {
      // Given
      poleEmploiClient.getReferentielRome.resolves(success([{ code: '1' }]))
      await handler.handle({ ressource: 'CENTRES_INTERET' })
      dateService.now.returns(uneDatetime().plus({ hours: 23 }))

      // When
      const result = await handler.handle({ ressource: 'CENTRES_INTERET' })

      // Then
      expect(result).to.deep.equal(success([{ code: '1' }]))
      expect(poleEmploiClient.getReferentielRome).to.have.been.calledOnce()
    })

    it('redemande à ROME au-delà de 24 h', async () => {
      // Given
      poleEmploiClient.getReferentielRome.resolves(success([{ code: '1' }]))
      await handler.handle({ ressource: 'METIERS' })
      dateService.now.returns(uneDatetime().plus({ hours: 25 }))

      // When
      await handler.handle({ ressource: 'METIERS' })

      // Then
      expect(poleEmploiClient.getReferentielRome).to.have.been.calledTwice()
    })

    it('ne garde pas en mémoire un échec de ROME', async () => {
      // Given
      poleEmploiClient.getReferentielRome
        .onFirstCall()
        .resolves(failure(new NonTrouveError('Métier', 'D1102')))
      poleEmploiClient.getReferentielRome
        .onSecondCall()
        .resolves(success({ code: 'D1102' }))
      await handler.handle({ ressource: 'FICHE_METIER', code: 'D1102' })

      // When
      const result = await handler.handle({
        ressource: 'FICHE_METIER',
        code: 'D1102'
      })

      // Then
      expect(result).to.deep.equal(success({ code: 'D1102' }))
    })

    it('ne répond pas en prod', async () => {
      // Given
      const handlerEnProd = new GetReferentielRomePocOrientationQueryHandler(
        poleEmploiClient,
        new ConfigService({ environment: 'prod' }),
        dateService
      )

      // When
      const result = await handlerEnProd.handle({ ressource: 'METIERS' })

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('POC orientation'))
      )
      expect(poleEmploiClient.getReferentielRome).not.to.have.been.called()
    })
  })
})
