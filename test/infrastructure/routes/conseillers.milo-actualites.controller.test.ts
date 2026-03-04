import { HttpStatus, INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { CreateActualiteMiloCommandHandler } from 'src/application/commands/milo/create-actualite-milo.command.handler'
import { UpdateActualiteMiloCommandHandler } from 'src/application/commands/milo/update-actualite-milo.command.handler'
import {
  DroitsInsuffisants,
  NonTrouveError
} from 'src/building-blocks/types/domain-error'
import { emptySuccess, failure } from 'src/building-blocks/types/result'
import {
  unHeaderAuthorization,
  unUtilisateurDecode
} from '../../fixtures/authentification.fixture'
import { expect, StubbedClass } from '../../utils'
import { ensureUserAuthenticationFailsIfInvalid } from '../../utils/ensure-user-authentication-fails-if-invalid'
import { getApplicationWithStubbedDependencies } from '../../utils/module-for-testing'

describe('ConseillersMiloController - Actualités', () => {
  let createActualiteMiloCommandHandler: StubbedClass<CreateActualiteMiloCommandHandler>
  let updateActualiteMiloCommandHandler: StubbedClass<UpdateActualiteMiloCommandHandler>
  let app: INestApplication

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    createActualiteMiloCommandHandler = app.get(
      CreateActualiteMiloCommandHandler
    )
    updateActualiteMiloCommandHandler = app.get(
      UpdateActualiteMiloCommandHandler
    )
  })

  describe('POST /conseillers/milo/:idConseiller/actualites', () => {
    const idConseiller = 'conseiller-1'
    const payload = {
      titre: 'Nouvelle actualité',
      contenu: 'Description de actualité',
      titreLien: 'En savoir plus',
      lien: 'https://example'
    }

    it('crée une actualité et retourne 204', async () => {
      // Given
      createActualiteMiloCommandHandler.execute.resolves(emptySuccess())

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payload)

      // Then
      expect(response.status).to.equal(HttpStatus.NO_CONTENT)
    })

    it('appelle le command handler avec les bons paramètres', async () => {
      // Given
      createActualiteMiloCommandHandler.execute.resolves(emptySuccess())
      const utilisateur = unUtilisateurDecode()

      // When
      await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payload)

      // Then
      expect(
        createActualiteMiloCommandHandler.execute
      ).to.have.been.calledWithMatch(
        {
          idConseiller,
          prenomNomConseiller: `${utilisateur.prenom} ${utilisateur.nom}`,
          titre: payload.titre,
          contenu: payload.contenu,
          titreLien: payload.titreLien,
          lien: payload.lien
        },
        utilisateur
      )
    })

    it('crée une actualité sans lien optionnel', async () => {
      // Given
      const payloadSansLien = {
        titre: 'Actualité sans lien',
        contenu: 'Description'
      }
      createActualiteMiloCommandHandler.execute.resolves(emptySuccess())

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadSansLien)

      // Then
      expect(response.status).to.equal(HttpStatus.NO_CONTENT)
    })

    it('retourne 400 si le titre est manquant', async () => {
      // Given
      const payloadInvalide = {
        contenu: 'Description'
      }

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadInvalide)

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it('retourne 400 si le contenu est manquant', async () => {
      // Given
      const payloadInvalide = {
        titre: 'Titre'
      }

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadInvalide)

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it('retourne 400 si le titre dépasse 100 caractères', async () => {
      // Given
      const payloadInvalide = {
        titre: 'a'.repeat(101),
        contenu: 'Description'
      }

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadInvalide)

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it('retourne 400 si le contenu dépasse 500 caractères', async () => {
      // Given
      const payloadInvalide = {
        titre: 'Titre',
        contenu: 'a'.repeat(501)
      }

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadInvalide)

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it('retourne 400 si le titre du lien dépasse 50 caractères', async () => {
      // Given
      const payloadInvalide = {
        titre: 'Titre',
        contenu: 'Description',
        titreLien: 'a'.repeat(51),
        lien: 'https://example.com'
      }

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadInvalide)

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it("retourne 400 si le lien n'est pas une URL valide (http://)", async () => {
      // Given
      const payloadInvalide = {
        titre: 'Titre',
        contenu: 'Description',
        titreLien: 'Lien',
        lien: 'http://'
      }

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadInvalide)

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it("retourne 400 si le lien n'est pas une URL valide (mauvais-lien)", async () => {
      // Given
      const payloadInvalide = {
        titre: 'Titre',
        contenu: 'Description',
        titreLien: 'Lien',
        lien: 'mauvais-lien'
      }

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadInvalide)

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it('retourne 400 si le titre du lien est fourni sans lien', async () => {
      // Given
      const payloadInvalide = {
        titre: 'Titre',
        contenu: 'Contenu',
        titreLien: 'Voir plus'
      }

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadInvalide)

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it("retourne 404 si le conseiller n'existe pas", async () => {
      // Given
      createActualiteMiloCommandHandler.execute.resolves(
        failure(new NonTrouveError('Conseiller', idConseiller))
      )

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payload)

      // Then
      expect(response.status).to.equal(HttpStatus.NOT_FOUND)
    })

    ensureUserAuthenticationFailsIfInvalid(
      'post',
      '/conseillers/milo/conseiller-1/actualites'
    )
  })

  describe('PUT /conseillers/milo/:idConseiller/actualites/:idActualite', () => {
    const idConseiller = 'conseiller-1'
    const idActualite = 'actualite-1'
    const payload = {
      titre: 'Titre modifié',
      contenu: 'Contenu modifié',
      titreLien: 'En savoir plus',
      lien: 'https://example.com'
    }

    it("modifie l'actualité et retourne 204", async () => {
      // Given
      updateActualiteMiloCommandHandler.execute.resolves(emptySuccess())

      // When
      const response = await request(app.getHttpServer())
        .put(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())
        .send(payload)

      // Then
      expect(response.status).to.equal(HttpStatus.NO_CONTENT)
    })

    it('appelle le command handler avec les bons paramètres', async () => {
      // Given
      updateActualiteMiloCommandHandler.execute.resolves(emptySuccess())
      const utilisateur = unUtilisateurDecode()

      // When
      await request(app.getHttpServer())
        .put(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())
        .send(payload)

      // Then
      expect(
        updateActualiteMiloCommandHandler.execute
      ).to.have.been.calledWithMatch(
        {
          idActualite,
          idConseiller,
          titre: payload.titre,
          contenu: payload.contenu,
          titreLien: payload.titreLien,
          lien: payload.lien
        },
        utilisateur
      )
    })

    it('accepte un payload sans lien optionnel', async () => {
      // Given
      updateActualiteMiloCommandHandler.execute.resolves(emptySuccess())

      // When
      const response = await request(app.getHttpServer())
        .put(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())
        .send({ titre: 'Titre', contenu: 'Contenu' })

      // Then
      expect(response.status).to.equal(HttpStatus.NO_CONTENT)
    })

    it('retourne 400 si le titre est manquant', async () => {
      // When
      const response = await request(app.getHttpServer())
        .put(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())
        .send({ contenu: 'Contenu' })

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it('retourne 400 si le contenu est manquant', async () => {
      // When
      const response = await request(app.getHttpServer())
        .put(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())
        .send({ titre: 'Titre' })

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it('retourne 400 si le titre du lien est fourni sans lien', async () => {
      // When
      const response = await request(app.getHttpServer())
        .put(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())
        .send({ titre: 'Titre', contenu: 'Contenu', titreLien: 'Voir plus' })

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it("retourne 404 si l'actualité n'existe pas", async () => {
      // Given
      updateActualiteMiloCommandHandler.execute.resolves(
        failure(new NonTrouveError('Actualite', idActualite))
      )

      // When
      const response = await request(app.getHttpServer())
        .put(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())
        .send(payload)

      // Then
      expect(response.status).to.equal(HttpStatus.NOT_FOUND)
    })

    it("retourne 403 si le conseiller n'est pas propriétaire de l'actualité", async () => {
      // Given
      updateActualiteMiloCommandHandler.execute.resolves(
        failure(new DroitsInsuffisants())
      )

      // When
      const response = await request(app.getHttpServer())
        .put(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())
        .send(payload)

      // Then
      expect(response.status).to.equal(HttpStatus.FORBIDDEN)
    })

    ensureUserAuthenticationFailsIfInvalid(
      'put',
      `/conseillers/milo/conseiller-1/actualites/actualite-1`
    )
  })
})
