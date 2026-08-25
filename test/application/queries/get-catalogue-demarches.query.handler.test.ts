import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'

import { GetCatalogueDemarchesQueryHandler } from 'src/application/queries/get-catalogue-demarches.query.handler'
import { TOUT_CONSEIL_DEPARTEMENTAL, Profil } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, expect, stubClass } from '../../utils'

xdescribe('GetCatalogueQueryHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let handler: GetCatalogueDemarchesQueryHandler

  beforeEach(() => {
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    handler = new GetCatalogueDemarchesQueryHandler(jeuneAuthorizer)
  })

  describe('handle', () => {
    beforeEach(() => {})
    it('renvoie le catalogue au bon format', async () => {
      // Given

      // When
      const result = await handler.handle({
        accessToken: 'un token',
        structure: Profil.Structure.FRANCE_TRAVAIL
      })

      // Then
      expect(result).to.deep.equal([
        {
          code: 'P03',
          libelle: 'Mes candidatures',
          demarches: [
            {
              codePourquoi: 'P03',
              codeQuoi: 'Q11',
              comment: [
                {
                  code: 'C11.05',
                  label: "Avec l'aide d'une personne ou d'une structure"
                }
              ],
              commentObligatoire: true,
              libellePourquoi: 'Mes candidatures',
              libelleQuoi:
                'Préparation de ses candidatures (CV, lettre de motivation, book)'
            }
          ]
        },
        {
          code: 'P02',
          libelle: 'Ma formation professionnelle',
          demarches: []
        }
      ])
    })
  })

  describe('authorize', () => {
    it('autorise un jeune pôle emploi', async () => {
      // Given
      const utilisateur = unUtilisateurJeune()

      // When
      await handler.authorize(
        { accessToken: 'un token', structure: utilisateur.profil.structure },
        utilisateur
      )

      // Then
      expect(
        jeuneAuthorizer.autoriserLeJeune
      ).to.have.been.calledOnceWithExactly(utilisateur.id, utilisateur)
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(handler.profilsAutorises).to.deep.equal([
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
