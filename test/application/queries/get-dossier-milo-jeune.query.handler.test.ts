import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import {
  GetDossierMiloJeuneQuery,
  GetDossierMiloJeuneQueryHandler
} from '../../../src/application/queries/get-dossier-milo-jeune.query.handler'
import { JeuneMilo } from '../../../src/domain/milo/jeune.milo'
import { Profil } from '../../../src/domain/profil'
import { OidcClient } from '../../../src/infrastructure/clients/oidc-client.db'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { unDossierMilo } from '../../fixtures/milo.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'

describe('GetDossierMiloJeuneQueryHandler', () => {
  let miloRepository: StubbedType<JeuneMilo.Repository>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let oidcClient: StubbedClass<OidcClient>
  let getDossierMiloJeuneQueryHandler: GetDossierMiloJeuneQueryHandler
  let sandbox: SinonSandbox

  before(() => {
    sandbox = createSandbox()
    miloRepository = stubInterface(sandbox)
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    oidcClient = stubClass(OidcClient)

    getDossierMiloJeuneQueryHandler = new GetDossierMiloJeuneQueryHandler(
      miloRepository,
      conseillerAuthorizer,
      oidcClient
    )
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    it('retourne le dossier', async () => {
      // Given
      const idDossier = '1'
      const getDossierMiloJeuneQuery: GetDossierMiloJeuneQuery = {
        idDossier,
        accessToken: 'accessToken'
      }

      oidcClient.exchangeToken
        .withArgs('accessToken', Profil.Structure.MILO)
        .resolves('idpToken')
      miloRepository.getDossier
        .withArgs(idDossier, 'idpToken')
        .resolves(unDossierMilo())

      // When
      const actual = await getDossierMiloJeuneQueryHandler.handle(
        getDossierMiloJeuneQuery
      )

      // Then
      expect(actual).to.deep.equal(unDossierMilo())
    })
  })

  describe('authorize', () => {
    it('autorise tout conseiller MILO', async () => {
      // Given
      const utilisateur = unUtilisateurConseiller()

      const query: GetDossierMiloJeuneQuery = {
        idDossier: '1',
        accessToken: 'accessToken'
      }

      // When
      await getDossierMiloJeuneQueryHandler.authorize(query, utilisateur)

      // Then
      expect(
        conseillerAuthorizer.autoriserToutConseiller
      ).to.have.been.calledOnceWithExactly(utilisateur)
    })
  })
})
