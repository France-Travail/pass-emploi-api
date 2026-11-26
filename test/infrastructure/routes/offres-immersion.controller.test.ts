import { HttpStatus, INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import {
  NotifierNouvellesImmersionsCommand,
  NotifierNouvellesImmersionsCommandHandler
} from '../../../src/application/commands/notifier-nouvelles-immersions.command.handler'
import { success } from '../../../src/building-blocks/types/result'
import { StubbedClass, expect } from '../../utils'
import { getApplicationWithStubbedDependencies } from '../../utils/module-for-testing'

describe('OffresImmersionController', () => {
  let notifierNouvellesImmersionsCommandHandler: StubbedClass<NotifierNouvellesImmersionsCommandHandler>
  let app: INestApplication

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    notifierNouvellesImmersionsCommandHandler = app.get(
      NotifierNouvellesImmersionsCommandHandler
    )
  })

  describe('POST /offres-immersion', () => {
    // Given
    const uneNouvelleImmersion: NotifierNouvellesImmersionsCommand = {
      immersions: [
        {
          rome: 'unRome',
          location: {
            lon: 1.2,
            lat: 3.4
          },
          siret: '22334343'
        }
      ]
    }
    describe('quand le payload est bon', () => {
      it('appelle la commande et répond 202', async () => {
        // Given
        notifierNouvellesImmersionsCommandHandler.execute.resolves(
          success(undefined)
        )

        // When
        await request(app.getHttpServer())
          .post('/offres-immersion')
          .send(uneNouvelleImmersion)
          .set({ 'X-API-KEY': 'api-key-immersion' })
          // Then
          .expect(HttpStatus.ACCEPTED)

        expect(
          notifierNouvellesImmersionsCommandHandler.execute
        ).to.have.been.calledWithExactly(uneNouvelleImmersion)
      })
    })
    describe('quand la planification du job échoue', () => {
      it('répond 500 sans rejet non intercepté', async () => {
        // Given
        notifierNouvellesImmersionsCommandHandler.execute.rejects(
          new Error('canceling statement due to statement timeout')
        )
        const rejetsNonGeres: unknown[] = []
        const surRejetNonGere = (raison: unknown): void => {
          rejetsNonGeres.push(raison)
        }
        process.on('unhandledRejection', surRejetNonGere)

        // When
        const response = await request(app.getHttpServer())
          .post('/offres-immersion')
          .send(uneNouvelleImmersion)
          .set({ 'X-API-KEY': 'api-key-immersion' })
        await new Promise(resolve => setImmediate(resolve))
        process.off('unhandledRejection', surRejetNonGere)

        // Then
        expect(response.status).to.equal(HttpStatus.INTERNAL_SERVER_ERROR)
        expect(rejetsNonGeres).to.be.empty()
      })
    })
    describe('quand le payload est pas bon', () => {
      it('répond 400', async () => {
        // When
        await request(app.getHttpServer())
          .post('/offres-immersion')
          .send({ immersions: [{ plop: 'john' }] })
          .set({ 'X-API-KEY': 'api-key-immersion' })
          // Then
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
    describe("quand l'api key est pas bonne", () => {
      it('répond 401', async () => {
        // When
        await request(app.getHttpServer())
          .post('/offres-immersion')
          .send(uneNouvelleImmersion)
          .set({ 'X-API-KEY': 'ceci-est-une-mauvaise-api-key' })
          // Then
          .expect(HttpStatus.UNAUTHORIZED)
      })
    })
  })
})
