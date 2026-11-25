import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
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
import { StructureAccompagnement } from '../../../src/domain/structure-accompagnement'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unProfilInvite } from '../../fixtures/profil.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

function uneStructure(nom: string): StructureAccompagnement {
  return {
    nom,
    adresse: { ligne: '1 rue', codePostal: '69003', ville: 'LYON' },
    telephone: '04 00 00 00 00',
    horaires: null,
    horairesAlt: null
  }
}

describe('GetStructuresAccompagnementQueryHandler', () => {
  let handler: GetStructuresAccompagnementQueryHandler
  let structureAccompagnementRepository: StubbedType<StructureAccompagnement.Repository>
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>

  beforeEach(() => {
    structureAccompagnementRepository = stubInterface(createSandbox())
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    handler = new GetStructuresAccompagnementQueryHandler(
      structureAccompagnementRepository,
      jeuneInviteAuthorizer
    )
  })

  describe('handle FRANCE_TRAVAIL', () => {
    it('renvoie les agences FT de la commune', async () => {
      // Given
      const agences = [uneStructure('Agence A'), uneStructure('Agence B')]
      structureAccompagnementRepository.findAllAgencesFranceTravail
        .withArgs('31555', '31000')
        .resolves(success(agences))

      // When
      const result = await handler.handle({
        type: TypeStructureAccompagnement.FRANCE_TRAVAIL,
        codeInsee: '31555',
        codePostal: '31000'
      })

      // Then
      expect(result).to.deep.equal(success(agences))
    })
  })

  describe('handle MILO', () => {
    const queryLyon = {
      type: TypeStructureAccompagnement.MILO,
      codeInsee: '69123',
      codePostal: '69003'
    }

    it('renvoie la mission locale de la commune', async () => {
      // Given
      const missionLocale = uneStructure('Mission Locale DE LYON')
      structureAccompagnementRepository.findMissionLocale
        .withArgs('69123', '69003')
        .resolves(success(missionLocale))

      // When
      const result = await handler.handle(queryLyon)

      // Then
      expect(result).to.deep.equal(success([missionLocale]))
    })

    it("renvoie une liste vide quand il n'y a pas de mission locale", async () => {
      // Given
      structureAccompagnementRepository.findMissionLocale
        .withArgs('69123', '69003')
        .resolves(success(undefined))

      // When
      const result = await handler.handle(queryLyon)

      // Then
      expect(result).to.deep.equal(success([]))
    })

    it("remonte l'échec du repository", async () => {
      // Given
      const echec = failure(new ErreurHttp('indisponible', 502))
      structureAccompagnementRepository.findMissionLocale
        .withArgs('69123', '69003')
        .resolves(echec)

      // When
      const result = await handler.handle(queryLyon)

      // Then
      expect(result).to.deep.equal(echec)
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
