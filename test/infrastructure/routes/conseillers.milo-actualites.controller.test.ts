import { HttpStatus, INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { CreateActualiteMiloCommandHandler } from 'src/application/commands/milo/create-actualite-milo.command.handler'
import { UpdateActualiteMiloCommandHandler } from 'src/application/commands/milo/update-actualite-milo.command.handler'
import { DeleteActualiteMiloCommandHandler } from 'src/application/commands/milo/delete-actualite-milo.command.handler'
import {
  DroitsInsuffisants,
  NonTrouveError
} from 'src/building-blocks/types/domain-error'
import { failure, success } from 'src/building-blocks/types/result'
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
  let deleteActualiteMiloCommandHandler: StubbedClass<DeleteActualiteMiloCommandHandler>
  let app: INestApplication

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
    createActualiteMiloCommandHandler = app.get(
      CreateActualiteMiloCommandHandler
    )
    updateActualiteMiloCommandHandler = app.get(
      UpdateActualiteMiloCommandHandler
    )
    deleteActualiteMiloCommandHandler = app.get(
      DeleteActualiteMiloCommandHandler
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
    const unResultatCreation = {
      id: 'un-id-actualite',
      titre: payload.titre,
      contenu: payload.contenu,
      titreLien: payload.titreLien,
      lien: payload.lien,
      prenomNomConseiller: 'John Doe',
      dateCreation: '2021-01-01T00:00:00.000+01:00',
      proprietaire: true
    }

    it("crée une actualité et retourne 201 avec l'objet créé", async () => {
      // Given
      createActualiteMiloCommandHandler.execute.resolves(
        success(unResultatCreation)
      )

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payload)

      // Then
      expect(response.status).to.equal(HttpStatus.CREATED)
      expect(response.body).to.deep.equal(unResultatCreation)
    })

    it('appelle le command handler avec les bons paramètres', async () => {
      // Given
      createActualiteMiloCommandHandler.execute.resolves(
        success(unResultatCreation)
      )
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

    it('appelle le command handler avec un lien sans protocole', async () => {
      // Given
      createActualiteMiloCommandHandler.execute.resolves(
        success(unResultatCreation)
      )
      const utilisateur = unUtilisateurDecode()
      const payloadSansProtocole = {
        titre: 'Nouvelle actualité',
        contenu: 'Description de actualité',
        titreLien: 'En savoir plus',
        lien: 'example.com'
      }

      // When
      await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadSansProtocole)

      // Then
      expect(
        createActualiteMiloCommandHandler.execute
      ).to.have.been.calledWithMatch(
        {
          idConseiller,
          prenomNomConseiller: `${utilisateur.prenom} ${utilisateur.nom}`,
          titre: payloadSansProtocole.titre,
          contenu: payloadSansProtocole.contenu,
          titreLien: payloadSansProtocole.titreLien,
          lien: payloadSansProtocole.lien
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
      createActualiteMiloCommandHandler.execute.resolves(
        success(unResultatCreation)
      )

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadSansLien)

      // Then
      expect(response.status).to.equal(HttpStatus.CREATED)
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

    it('accepte un lien avec protocole https (https://example.com)', async () => {
      // Given
      createActualiteMiloCommandHandler.execute.resolves(
        success(unResultatCreation)
      )

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send({
          titre: 'Titre',
          contenu: 'Description',
          titreLien: 'Lien',
          lien: 'https://example.com'
        })

      // Then
      expect(response.status).to.equal(HttpStatus.CREATED)
    })

    it('accepte un lien avec protocole http (http://example.com)', async () => {
      // Given
      createActualiteMiloCommandHandler.execute.resolves(
        success(unResultatCreation)
      )

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send({
          titre: 'Titre',
          contenu: 'Description',
          titreLien: 'Lien',
          lien: 'http://example.com'
        })

      // Then
      expect(response.status).to.equal(HttpStatus.CREATED)
    })

    it('accepte un lien sans protocole (example.com)', async () => {
      // Given
      createActualiteMiloCommandHandler.execute.resolves(
        success(unResultatCreation)
      )

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send({
          titre: 'Titre',
          contenu: 'Description',
          titreLien: 'Lien',
          lien: 'example.com'
        })

      // Then
      expect(response.status).to.equal(HttpStatus.CREATED)
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

    it('retourne 400 si le lien utilise un protocole non autorisé (tcp://)', async () => {
      // Given
      const payloadInvalide = {
        titre: 'Titre',
        contenu: 'Description',
        titreLien: 'Lien',
        lien: 'tcp://something'
      }

      // When
      const response = await request(app.getHttpServer())
        .post(`/conseillers/milo/${idConseiller}/actualites`)
        .set('authorization', unHeaderAuthorization())
        .send(payloadInvalide)

      // Then
      expect(response.status).to.equal(HttpStatus.BAD_REQUEST)
    })

    it('retourne 400 si le lien utilise un protocole non autorisé (ftp://)', async () => {
      // Given
      const payloadInvalide = {
        titre: 'Titre',
        contenu: 'Description',
        titreLien: 'Lien',
        lien: 'ftp://example.com'
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
    const unResultatModification = {
      id: 'un-id-actualite',
      titre: payload.titre,
      contenu: payload.contenu,
      titreLien: payload.titreLien,
      lien: payload.lien,
      prenomNomConseiller: 'John Doe',
      dateCreation: '2021-01-01T00:00:00.000+01:00',
      dateModification: '2021-01-02T00:00:00.000+01:00',
      proprietaire: true
    }

    it("modifie l'actualité et retourne 200 avec l'objet entier", async () => {
      // Given
      updateActualiteMiloCommandHandler.execute.resolves(
        success(unResultatModification)
      )

      // When
      const response = await request(app.getHttpServer())
        .put(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())
        .send(payload)

      // Then
      expect(response.status).to.equal(HttpStatus.OK)
      expect(response.body).to.deep.equal(unResultatModification)
    })

    it('appelle le command handler avec les bons paramètres', async () => {
      // Given
      updateActualiteMiloCommandHandler.execute.resolves(
        success(unResultatModification)
      )
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
      updateActualiteMiloCommandHandler.execute.resolves(
        success(unResultatModification)
      )

      // When
      const response = await request(app.getHttpServer())
        .put(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())
        .send({ titre: 'Titre', contenu: 'Contenu' })

      // Then
      expect(response.status).to.equal(HttpStatus.OK)
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

    it("retourne 403 si le conseiller n'est pas propriétaire", async () => {
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
      '/conseillers/milo/conseiller-1/actualites/actualite-1'
    )
  })

  describe('DELETE /conseillers/milo/:idConseiller/actualites/:idActualite', () => {
    const idConseiller = 'conseiller-1'
    const idActualite = 'actualite-1'

    it("supprime l'actualité et retourne 200 avec la date de suppression", async () => {
      // Given
      const unResultatSuppression = {
        dateSuppression: '2026-03-17T10:00:00.000Z'
      }
      deleteActualiteMiloCommandHandler.execute.resolves(
        success(unResultatSuppression)
      )

      // When
      const response = await request(app.getHttpServer())
        .delete(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())

      // Then
      expect(response.status).to.equal(HttpStatus.OK)
      expect(response.body).to.deep.equal(unResultatSuppression)
    })

    it('appelle le command handler avec les bons paramètres', async () => {
      // Given
      deleteActualiteMiloCommandHandler.execute.resolves(
        success({ dateSuppression: '2026-03-17T10:00:00.000Z' })
      )
      const utilisateur = unUtilisateurDecode()

      // When
      await request(app.getHttpServer())
        .delete(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())

      // Then
      expect(
        deleteActualiteMiloCommandHandler.execute
      ).to.have.been.calledWithMatch({ idActualite, idConseiller }, utilisateur)
    })

    it("retourne 404 si l'actualité n'existe pas", async () => {
      // Given
      deleteActualiteMiloCommandHandler.execute.resolves(
        failure(new NonTrouveError('Actualite', idActualite))
      )

      // When
      const response = await request(app.getHttpServer())
        .delete(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())

      // Then
      expect(response.status).to.equal(HttpStatus.NOT_FOUND)
    })

    it("retourne 403 si le conseiller n'est pas propriétaire", async () => {
      // Given
      deleteActualiteMiloCommandHandler.execute.resolves(
        failure(new DroitsInsuffisants())
      )

      // When
      const response = await request(app.getHttpServer())
        .delete(`/conseillers/milo/${idConseiller}/actualites/${idActualite}`)
        .set('authorization', unHeaderAuthorization())

      // Then
      expect(response.status).to.equal(HttpStatus.FORBIDDEN)
    })

    ensureUserAuthenticationFailsIfInvalid(
      'delete',
      '/conseillers/milo/conseiller-1/actualites/actualite-1'
    )
  })
})
