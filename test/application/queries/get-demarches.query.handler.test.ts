import { ForbiddenException } from '@nestjs/common'
import {
  GetDemarchesQuery,
  GetDemarchesQueryHandler
} from 'src/application/queries/get-demarches.query.handler'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { GetDemarchesQueryGetter } from '../../../src/application/queries/query-getters/pole-emploi/get-demarches.query.getter'
import { TOUT_CONSEIL_DEPARTEMENTAL, Profil } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, expect, stubClass } from '../../utils'
import { unProfilMilo } from '../../fixtures/profil.fixture'

describe('GetDemarchesQueryHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let getDemarchesQueryGetter: StubbedClass<GetDemarchesQueryGetter>
  let getDemarchesQueryHandler: GetDemarchesQueryHandler

  before(() => {
    getDemarchesQueryGetter = stubClass(GetDemarchesQueryGetter)
    jeuneAuthorizer = stubClass(JeuneAuthorizer)

    getDemarchesQueryHandler = new GetDemarchesQueryHandler(
      getDemarchesQueryGetter,
      jeuneAuthorizer
    )
  })

  describe('handle', () => {
    it('retourne le résultat du DemarcheQueryGetter', () => {
      // When
      getDemarchesQueryHandler.handle({
        idJeune: 'idJeune',
        accessToken: 'token'
      })

      // Then
      expect(getDemarchesQueryGetter.handle).to.have.been.calledWith({
        idJeune: 'idJeune',
        accessToken: 'token',
        tri: GetDemarchesQueryGetter.Tri.parSatutEtDateFin
      })
    })
  })

  describe('authorize', () => {
    it('authorise le jeune', async () => {
      // Given
      const query: GetDemarchesQuery = {
        idJeune: 'ABCDE',
        accessToken: 'token'
      }
      const utilisateur = unUtilisateurJeune()

      // When
      await getDemarchesQueryHandler.authorize(query, utilisateur)
      // Then
      expect(jeuneAuthorizer.autoriserLeJeune).to.have.been.calledWithExactly(
        query.idJeune,
        utilisateur
      )
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(getDemarchesQueryHandler.profilsAutorises).to.deep.equal([
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

  describe('execute', () => {
    it("rejette un profil sans la capacité SERVICES_FT sans appeler l'authorizer ni le partenaire", async () => {
      // Given
      const jeuneAuthorizerLocal = stubClass(JeuneAuthorizer)
      const getDemarchesQueryGetterLocal = stubClass(GetDemarchesQueryGetter)
      const handlerLocal = new GetDemarchesQueryHandler(
        getDemarchesQueryGetterLocal,
        jeuneAuthorizerLocal
      )
      const query: GetDemarchesQuery = {
        idJeune: 'ABCDE',
        accessToken: 'token'
      }
      const utilisateurMilo = unUtilisateurJeune({
        profil: unProfilMilo()
      })

      // When
      const promise = handlerLocal.execute(query, utilisateurMilo)

      // Then
      await expect(promise).to.be.rejectedWith(ForbiddenException)
      expect(jeuneAuthorizerLocal.autoriserLeJeune).not.to.have.been.called()
      expect(getDemarchesQueryGetterLocal.handle).not.to.have.been.called()
    })
  })
})
