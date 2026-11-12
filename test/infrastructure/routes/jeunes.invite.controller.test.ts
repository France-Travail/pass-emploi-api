import { HttpStatus, INestApplication } from '@nestjs/common'
import { UpdateCGUInviteCommandHandler } from 'src/application/commands/update-cgu-invite.command.handler'
import { GetCGUInviteQueryHandler } from 'src/application/queries/get-cgu-invite.query.handler'
import {
  DroitsInsuffisants,
  NonTrouveError
} from 'src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  success
} from 'src/building-blocks/types/result'
import * as request from 'supertest'
import {
  unHeaderAuthorization,
  unUtilisateurDecode
} from 'test/fixtures/authentification.fixture'
import { StubbedClass, expect } from 'test/utils'
import { ensureUserAuthenticationFailsIfInvalid } from 'test/utils/ensure-user-authentication-fails-if-invalid'
import { getApplicationWithStubbedDependencies } from 'test/utils/module-for-testing'

describe('JeunesInviteController', () => {
  let getCGUInviteQueryHandler: StubbedClass<GetCGUInviteQueryHandler>
  let updateCGUInviteCommandHandler: StubbedClass<UpdateCGUInviteCommandHandler>
  let app: INestApplication

  const idJeune = 'un-invite'

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    getCGUInviteQueryHandler = app.get(GetCGUInviteQueryHandler)
    updateCGUInviteCommandHandler = app.get(UpdateCGUInviteCommandHandler)
  })

  describe('GET /jeunes/:idJeune/invite/cgu', () => {
    it("renvoie la date de signature des CGU de l'invité", async () => {
      // Given
      getCGUInviteQueryHandler.execute
        .withArgs({ idJeune }, unUtilisateurDecode())
        .resolves(success({ dateSignatureCGU: '2026-10-10T12:00:00.000Z' }))

      // When
      await request(app.getHttpServer())
        .get(`/jeunes/${idJeune}/invite/cgu`)
        .set('authorization', unHeaderAuthorization())
        // Then
        .expect(HttpStatus.OK)
        .expect({ dateSignatureCGU: '2026-10-10T12:00:00.000Z' })
    })

    it("renvoie une 404 quand l'invité n'existe pas", async () => {
      // Given
      getCGUInviteQueryHandler.execute
        .withArgs({ idJeune }, unUtilisateurDecode())
        .resolves(failure(new NonTrouveError('Jeune invité', idJeune)))

      // When
      await request(app.getHttpServer())
        .get(`/jeunes/${idJeune}/invite/cgu`)
        .set('authorization', unHeaderAuthorization())
        // Then
        .expect(HttpStatus.NOT_FOUND)
    })

    it("renvoie une 403 quand l'utilisateur n'est pas cet invité", async () => {
      // Given
      getCGUInviteQueryHandler.execute
        .withArgs({ idJeune }, unUtilisateurDecode())
        .resolves(failure(new DroitsInsuffisants()))

      // When
      await request(app.getHttpServer())
        .get(`/jeunes/${idJeune}/invite/cgu`)
        .set('authorization', unHeaderAuthorization())
        // Then
        .expect(HttpStatus.FORBIDDEN)
    })

    ensureUserAuthenticationFailsIfInvalid('get', '/jeunes/1/invite/cgu')
  })

  describe('PUT /jeunes/:idJeune/invite/cgu', () => {
    it('enregistre la date de signature des CGU', async () => {
      // Given
      updateCGUInviteCommandHandler.execute.resolves(emptySuccess())

      // When
      await request(app.getHttpServer())
        .put(`/jeunes/${idJeune}/invite/cgu`)
        .set('authorization', unHeaderAuthorization())
        .send({ dateSignatureCGU: '2026-10-10T12:00:00.000Z' })
        // Then
        .expect(HttpStatus.NO_CONTENT)

      expect(
        updateCGUInviteCommandHandler.execute
      ).to.have.been.calledWithExactly(
        { idJeune, dateSignatureCGU: '2026-10-10T12:00:00.000Z' },
        unUtilisateurDecode()
      )
    })

    it("renvoie une 400 quand la date n'existe pas au calendrier", async () => {
      // When
      await request(app.getHttpServer())
        .put(`/jeunes/${idJeune}/invite/cgu`)
        .set('authorization', unHeaderAuthorization())
        .send({ dateSignatureCGU: '2026-02-30' })
        // Then
        .expect(HttpStatus.BAD_REQUEST)
    })

    it('renvoie une 400 quand la date est absente', async () => {
      // When
      await request(app.getHttpServer())
        .put(`/jeunes/${idJeune}/invite/cgu`)
        .set('authorization', unHeaderAuthorization())
        .send({})
        // Then
        .expect(HttpStatus.BAD_REQUEST)
    })

    it("renvoie une 404 quand l'invité n'existe pas", async () => {
      // Given
      updateCGUInviteCommandHandler.execute.resolves(
        failure(new NonTrouveError('Jeune invité', idJeune))
      )

      // When
      await request(app.getHttpServer())
        .put(`/jeunes/${idJeune}/invite/cgu`)
        .set('authorization', unHeaderAuthorization())
        .send({ dateSignatureCGU: '2026-10-10T12:00:00.000Z' })
        // Then
        .expect(HttpStatus.NOT_FOUND)
    })

    ensureUserAuthenticationFailsIfInvalid('put', '/jeunes/1/invite/cgu')
  })
})
