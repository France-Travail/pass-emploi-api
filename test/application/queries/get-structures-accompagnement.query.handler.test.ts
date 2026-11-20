import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import { GetStructuresAccompagnementQueryHandler } from '../../../src/application/queries/get-structures-accompagnement.query.handler'
import { TypeStructureAccompagnement } from '../../../src/application/queries/query-models/structures-accompagnement.query-model'
import { ErreurHttp } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  success
} from '../../../src/building-blocks/types/result'
import { TOUT_INVITE } from '../../../src/domain/profil'
import { ApprentissageClient } from '../../../src/infrastructure/clients/apprentissage-client'
import { CommuneApprentissageDto } from '../../../src/infrastructure/clients/dto/apprentissage.dto'
import { AgenceFTDto } from '../../../src/infrastructure/clients/dto/pole-emploi.dto'
import { PoleEmploiClient } from '../../../src/infrastructure/clients/pole-emploi-client'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unProfilInvite } from '../../fixtures/profil.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

function uneAgence(libelleEtendu: string): AgenceFTDto {
  return {
    code: 'OCC0075',
    codeSafir: '31037',
    libelle: libelleEtendu,
    libelleEtendu,
    type: 'APE',
    contact: { telephonePublic: '39-49' },
    adressePrincipale: {
      ligne4: '2 AVENUE DE L URSS',
      ligne6: '31400 TOULOUSE',
      communeImplantation: '31555',
      bureauDistributeur: '31400'
    }
  }
}

function uneCommune(
  insee: string,
  nomMissionLocale: string | null
): CommuneApprentissageDto {
  return {
    nom: insee,
    code: { insee, postaux: ['69003'] },
    mission_locale: nomMissionLocale
      ? {
          nom: nomMissionLocale,
          localisation: { adresse: '1 rue', cp: '69003', ville: 'LYON' },
          contact: { telephone: '04 00 00 00 00' }
        }
      : null
  }
}

describe('GetStructuresAccompagnementQueryHandler', () => {
  let handler: GetStructuresAccompagnementQueryHandler
  let apprentissageClient: StubbedClass<ApprentissageClient>
  let poleEmploiClient: StubbedClass<PoleEmploiClient>
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>

  beforeEach(() => {
    apprentissageClient = stubClass(ApprentissageClient)
    poleEmploiClient = stubClass(PoleEmploiClient)
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    handler = new GetStructuresAccompagnementQueryHandler(
      apprentissageClient,
      poleEmploiClient,
      jeuneInviteAuthorizer
    )
  })

  describe('handle FRANCE_TRAVAIL', () => {
    const queryToulouse = {
      type: TypeStructureAccompagnement.FRANCE_TRAVAIL,
      codeInsee: '31555',
      codePostal: '31000'
    }

    it('renvoie toutes les agences FT de la commune dans leur ordre', async () => {
      // Given
      poleEmploiClient.getAgencesFTParCommune
        .withArgs('31555')
        .resolves(success([uneAgence('Agence A'), uneAgence('Agence B')]))

      // When
      const result = await handler.handle(queryToulouse)

      // Then
      expect(result).to.deep.equal(
        success([
          {
            nom: 'Agence A',
            adresse: {
              ligne: '2 AVENUE DE L URSS',
              codePostal: '31400',
              ville: 'TOULOUSE'
            },
            telephone: '39-49',
            horaires: []
          },
          {
            nom: 'Agence B',
            adresse: {
              ligne: '2 AVENUE DE L URSS',
              codePostal: '31400',
              ville: 'TOULOUSE'
            },
            telephone: '39-49',
            horaires: []
          }
        ])
      )
    })

    it("appelle FT avec le code d'arrondissement pour Paris", async () => {
      // Given
      poleEmploiClient.getAgencesFTParCommune.resolves(success([]))

      // When
      await handler.handle({
        type: TypeStructureAccompagnement.FRANCE_TRAVAIL,
        codeInsee: '75056',
        codePostal: '75011'
      })

      // Then
      expect(
        poleEmploiClient.getAgencesFTParCommune
      ).to.have.been.calledOnceWithExactly('75111')
    })

    it('renvoie une liste vide sans appeler FT quand le code postal parisien est inconnu', async () => {
      // When
      const result = await handler.handle({
        type: TypeStructureAccompagnement.FRANCE_TRAVAIL,
        codeInsee: '75056',
        codePostal: '75000'
      })

      // Then
      expect(result).to.deep.equal(success([]))
      expect(poleEmploiClient.getAgencesFTParCommune).not.to.have.been.called()
    })

    it('retire les agences sans nom', async () => {
      // Given
      poleEmploiClient.getAgencesFTParCommune
        .withArgs('31555')
        .resolves(success([uneAgence(''), uneAgence('Agence B')]))

      // When
      const result = await handler.handle(queryToulouse)

      // Then
      expect(result._isSuccess && result.data.map(s => s.nom)).to.deep.equal([
        'Agence B'
      ])
    })

    it("remonte l'échec de FT", async () => {
      // Given
      const echec = failure(new ErreurHttp('requête invalide', 400))
      poleEmploiClient.getAgencesFTParCommune.withArgs('31555').resolves(echec)

      // When
      const result = await handler.handle(queryToulouse)

      // Then
      expect(result).to.deep.equal(echec)
    })

    it("remonte un refus d'accès de FT en 502 pour ne pas déconnecter l'invité", async () => {
      // Given
      poleEmploiClient.getAgencesFTParCommune
        .withArgs('31555')
        .resolves(failure(new ErreurHttp('refus', 403)))

      // When
      const result = await handler.handle(queryToulouse)

      // Then
      expect(result).to.deep.equal(failure(new ErreurHttp('refus', 502)))
    })
  })

  describe('handle MILO', () => {
    const queryLyon = {
      type: TypeStructureAccompagnement.MILO,
      codeInsee: '69123',
      codePostal: '69003'
    }

    it('ne garde que la mission locale de la commune du code INSEE', async () => {
      // Given
      apprentissageClient.rechercherCommunes
        .withArgs('69003')
        .resolves(
          success([
            uneCommune('69003', 'PLATEAU NORD VAL DE SAONE'),
            uneCommune('69123', 'DE LYON')
          ])
        )

      // When
      const result = await handler.handle(queryLyon)

      // Then
      expect(result).to.deep.equal(
        success([
          {
            nom: 'Mission Locale DE LYON',
            adresse: { ligne: '1 rue', codePostal: '69003', ville: 'LYON' },
            telephone: '04 00 00 00 00',
            horaires: null
          }
        ])
      )
    })

    it('renvoie une liste vide quand aucune commune ne correspond', async () => {
      // Given
      apprentissageClient.rechercherCommunes
        .withArgs('69003')
        .resolves(success([uneCommune('69003', 'PLATEAU NORD VAL DE SAONE')]))

      // When
      const result = await handler.handle(queryLyon)

      // Then
      expect(result).to.deep.equal(success([]))
    })

    it("renvoie une liste vide quand la commune n'a pas de mission locale", async () => {
      // Given
      apprentissageClient.rechercherCommunes
        .withArgs('69003')
        .resolves(success([uneCommune('69123', null)]))

      // When
      const result = await handler.handle(queryLyon)

      // Then
      expect(result).to.deep.equal(success([]))
    })

    it("remonte un refus d'accès de l'API Apprentissage en 502 pour ne pas déconnecter l'invité", async () => {
      // Given
      apprentissageClient.rechercherCommunes
        .withArgs('69003')
        .resolves(failure(new ErreurHttp('clé invalide', 401)))

      // When
      const result = await handler.handle(queryLyon)

      // Then
      expect(result).to.deep.equal(failure(new ErreurHttp('clé invalide', 502)))
    })
  })

  describe('authorize', () => {
    it("délègue l'autorisation à l'authorizer invité", async () => {
      // Given
      const utilisateur = unUtilisateurJeune({
        id: 'un-invite',
        profil: unProfilInvite()
      })
      jeuneInviteAuthorizer.autoriserLInvite
        .withArgs('un-invite', utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(
        {
          type: TypeStructureAccompagnement.MILO,
          codeInsee: '31555',
          codePostal: '31000'
        },
        utilisateur
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })

    it('est réservé aux invités', () => {
      expect(handler.profilsAutorises).to.equal(TOUT_INVITE)
    })
  })
})
