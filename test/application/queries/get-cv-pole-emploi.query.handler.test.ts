import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import {
  GetCVPoleEmploiQuery,
  GetCVPoleEmploiQueryHandler
} from '../../../src/application/queries/get-cv-pole-emploi.query.handler'
import { CVPoleEmploiQueryModel } from '../../../src/application/queries/query-models/jeunes.pole-emploi.query-model'
import { ErreurHttp } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  success
} from '../../../src/building-blocks/types/result'
import { failureApi } from '../../../src/building-blocks/types/result-api'
import { Profil, TOUT_CONSEIL_DEPARTEMENTAL } from '../../../src/domain/profil'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { DocumentPoleEmploiDto } from '../../../src/infrastructure/clients/dto/pole-emploi.dto'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { PoleEmploiPartenaireClient } from '../../../src/infrastructure/clients/pole-emploi-partenaire-client.db'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unJeune } from '../../fixtures/jeune.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'

describe('GetCVPoleEmploiQueryHandler', () => {
  let getCVPoleEmploiQueryHandler: GetCVPoleEmploiQueryHandler
  let poleEmploiPartenaireClient: StubbedClass<PoleEmploiPartenaireClient>
  let oidcClient: StubbedClass<OidcClient>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let jeuneRepository: StubbedType<Jeune.Repository>

  let query: GetCVPoleEmploiQuery

  const jeune = unJeune()

  beforeEach(async () => {
    const sandbox = createSandbox()
    poleEmploiPartenaireClient = stubClass(PoleEmploiPartenaireClient)
    oidcClient = stubClass(OidcClient)
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    jeuneRepository = stubInterface(sandbox)
    jeuneRepository.get.resolves(jeune)

    getCVPoleEmploiQueryHandler = new GetCVPoleEmploiQueryHandler(
      jeuneRepository,
      poleEmploiPartenaireClient,
      oidcClient,
      jeuneAuthorizer
    )

    query = {
      idJeune: 'un-id-jeune',
      accessToken: 'bearer coucou'
    }
  })

  describe('handle', () => {
    describe('quand le client répond avec succès', () => {
      it('récupère le token et retourne la liste des CV du jeune', async () => {
        // Given
        const unCVPoleEmploiDto: DocumentPoleEmploiDto = {
          titre: 'un-titre-cv',
          nomFichier: 'un-nom-cv.pdf',
          format: 'DOCUMENT',
          url: 'un-url-cv',
          type: {
            libelle: 'CV',
            code: 'CV'
          }
        }
        const uneLMPoleEmploiDto: DocumentPoleEmploiDto = {
          titre: 'un-titre-lm',
          nomFichier: 'un-nom-fichier.pdf',
          format: 'DOCUMENT',
          url: 'un-url-lm',
          type: {
            libelle: 'Lettre de motivation',
            code: 'LM'
          }
        }
        const unCVQueryModel: CVPoleEmploiQueryModel = {
          nomFichier: unCVPoleEmploiDto.nomFichier,
          titre: unCVPoleEmploiDto.titre,
          url: unCVPoleEmploiDto.url
        }

        oidcClient.exchangeToken
          .withArgs(query.accessToken, jeune.structure)
          .resolves('idpToken')
        poleEmploiPartenaireClient.getDocuments
          .withArgs('idpToken')
          .resolves(success([unCVPoleEmploiDto, uneLMPoleEmploiDto]))

        // When
        const result = await getCVPoleEmploiQueryHandler.handle(query)

        // Then
        expect(result._isSuccess && result.data).to.deep.equal([unCVQueryModel])
      })
    })
    describe('quand une erreur client se produit', () => {
      it('renvoie une Failure', async () => {
        // Given
        oidcClient.exchangeToken.resolves('un-idp-token')
        poleEmploiPartenaireClient.getDocuments.resolves(
          failureApi(new ErreurHttp('erreur', 400))
        )

        // When
        const result = await getCVPoleEmploiQueryHandler.handle(query)

        // Then
        expect(!result._isSuccess && result.error).to.be.an.instanceOf(
          ErreurHttp
        )
      })
    })
  })

  describe('authorize', () => {
    it('autorise un utilisateur Pôle Emploi', async () => {
      // Given
      const utilisateur = unUtilisateurJeune()
      jeuneAuthorizer.autoriserLeJeune
        .withArgs(query.idJeune, utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await getCVPoleEmploiQueryHandler.authorize(
        query,
        utilisateur
      )

      // Then
      expect(result._isSuccess).to.be.true()
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(getCVPoleEmploiQueryHandler.profilsAutorises).to.deep.equal([
        {
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositifs: [
            Profil.Dispositif.CEJ,
            Profil.Dispositif.BRSA,
            Profil.Dispositif.AIJ,
            Profil.Dispositif.AVENIR_PRO,
            Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF,
            Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL,
            Profil.Dispositif.EQUIP_EMPLOI_RECRUT,
            Profil.Dispositif.DEMANDEUR_D_EMPLOI
          ]
        },
        TOUT_CONSEIL_DEPARTEMENTAL
      ])
    })
  })
})
