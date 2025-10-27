import { HttpStatus, INestApplication } from '@nestjs/common'
import { success } from 'src/building-blocks/types/result'
import * as request from 'supertest'
import { StubbedClass, expect } from 'test/utils'
import { getApplicationWithStubbedDependencies } from 'test/utils/module-for-testing'
import { CreerJeunePoleEmploiCommandHandler } from '../../../src/application/commands/pole-emploi/creer-jeune-pole-emploi.command.handler'
import { CreateJeunePoleEmploiPayload } from '../../../src/infrastructure/routes/validation/conseillers.inputs'
import {
  unHeaderAuthorization,
  unUtilisateurDecode
} from '../../fixtures/authentification.fixture'
import { unJeune } from '../../fixtures/jeune.fixture'

describe('ConseillersPoleEmploiController', () => {
  let creerJeunePoleEmploiCommandHandler: StubbedClass<CreerJeunePoleEmploiCommandHandler>
  let app: INestApplication
  before(async () => {
    app = await getApplicationWithStubbedDependencies()

    creerJeunePoleEmploiCommandHandler = app.get(
      CreerJeunePoleEmploiCommandHandler
    )
  })

  describe('POST /conseillers/pole-emploi/jeunes', () => {
    describe('quand tout va bien', () => {
      it('crée le bénéficiaire et renvoie une 200', async () => {
        // Given
        const payload: CreateJeunePoleEmploiPayload = {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'test@test.com',
          idConseiller: 'id-conseiller-123'
        }
        const jeune = unJeune()

        creerJeunePoleEmploiCommandHandler.execute.resolves(success(jeune))

        // When - Then
        await request(app.getHttpServer())
          .post('/conseillers/pole-emploi/jeunes')
          .set('authorization', unHeaderAuthorization())
          .send(payload)
          .expect(HttpStatus.CREATED)

        expect(
          creerJeunePoleEmploiCommandHandler.execute
        ).to.have.been.calledWithExactly(payload, unUtilisateurDecode())
      })
    })
    describe('quand les inputs sont pas bons', () => {
      it('renvoie une 400', async () => {
        // Given
        const payload: CreateJeunePoleEmploiPayload = {
          firstName: 'Jean',
          lastName: 'Dupont',
          email: 'test',
          idConseiller: 'id-conseiller-123'
        }
        const jeune = unJeune()

        creerJeunePoleEmploiCommandHandler.execute.resolves(success(jeune))

        // When - Then
        await request(app.getHttpServer())
          .post('/conseillers/pole-emploi/jeunes')
          .set('authorization', unHeaderAuthorization())
          .send(payload)
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
  })
})
