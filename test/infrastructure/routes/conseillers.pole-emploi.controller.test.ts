import { HttpStatus, INestApplication } from '@nestjs/common'
import { success } from 'src/building-blocks/types/result'
import * as request from 'supertest'
import { StubbedClass, expect } from 'test/utils'
import { getApplicationWithStubbedDependencies } from 'test/utils/module-for-testing'
import { CreerJeunePoleEmploiCommandHandler } from '../../../src/application/commands/pole-emploi/creer-jeune-pole-emploi.command.handler'
import { VerifierEmailBeneficiaireQueryHandler } from '../../../src/application/queries/pole-emploi/verifier-email-beneficaire.query.handler'
import {
  CreateJeunePoleEmploiPayload,
  VerifierEmailBeneficiairePayload
} from '../../../src/infrastructure/routes/validation/conseillers.inputs'
import {
  unHeaderAuthorization,
  unUtilisateurDecode
} from '../../fixtures/authentification.fixture'
import { unJeune } from '../../fixtures/jeune.fixture'

describe('ConseillersPoleEmploiController', () => {
  let creerJeunePoleEmploiCommandHandler: StubbedClass<CreerJeunePoleEmploiCommandHandler>
  let verifierEmailBeneficiaireQueryHandler: StubbedClass<VerifierEmailBeneficiaireQueryHandler>
  let app: INestApplication
  before(async () => {
    app = await getApplicationWithStubbedDependencies()

    creerJeunePoleEmploiCommandHandler = app.get(
      CreerJeunePoleEmploiCommandHandler
    )
    verifierEmailBeneficiaireQueryHandler = app.get(
      VerifierEmailBeneficiaireQueryHandler
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
          idConseiller: 'bcd60403-5f10-4a16-a660-2099d79ebd66'
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

  describe('POST /conseillers/pole-emploi/verifier-email-beneficiaire', () => {
    describe('quand tout va bien', () => {
      it('vérifie si email est disponible et renvoie une 201', async () => {
        // Given
        const payload: VerifierEmailBeneficiairePayload = {
          email: 'test@test.com'
        }

        verifierEmailBeneficiaireQueryHandler.execute.resolves(
          success({ emailExistant: false })
        )

        // When - Then
        const response = await request(app.getHttpServer())
          .post('/conseillers/pole-emploi/verifier-email-beneficiaire')
          .set('authorization', unHeaderAuthorization())
          .send(payload)
          .expect(HttpStatus.OK)

        expect(response.body).to.deep.equal({ emailExistant: false })
        expect(
          verifierEmailBeneficiaireQueryHandler.execute
        ).to.have.been.calledWithExactly(payload, unUtilisateurDecode())
      })

      it('renvoie emailExistant true si email existe déjà', async () => {
        // Given
        const payload: VerifierEmailBeneficiairePayload = {
          email: 'existant@test.com'
        }

        verifierEmailBeneficiaireQueryHandler.execute.resolves(
          success({ emailExistant: true })
        )

        // When - Then
        const response = await request(app.getHttpServer())
          .post('/conseillers/pole-emploi/verifier-email-beneficiaire')
          .set('authorization', unHeaderAuthorization())
          .send(payload)
          .expect(HttpStatus.OK)

        expect(response.body).to.deep.equal({ emailExistant: true })
      })
    })

    describe('quand les inputs sont pas bons', () => {
      it('renvoie une 400 si email invalide', async () => {
        // Given
        const payload: VerifierEmailBeneficiairePayload = {
          email: 'pas-un-email'
        }

        // When - Then
        await request(app.getHttpServer())
          .post('/conseillers/pole-emploi/verifier-email-beneficiaire')
          .set('authorization', unHeaderAuthorization())
          .send(payload)
          .expect(HttpStatus.BAD_REQUEST)
      })
    })
  })
})
