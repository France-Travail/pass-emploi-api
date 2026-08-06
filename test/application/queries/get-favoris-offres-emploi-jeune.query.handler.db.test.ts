import { ForbiddenException } from '@nestjs/common'
import { DateTime } from 'luxon'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { GetFavorisOffresEmploiJeuneQueryHandler } from '../../../src/application/queries/get-favoris-offres-emploi-jeune.query.handler.db'
import { emptySuccess } from '../../../src/building-blocks/types/result'
import { Core } from '../../../src/domain/core'
import { Offre } from '../../../src/domain/offre/offre'
import { Profil } from '../../../src/domain/profil'
import { OffresEmploiHttpSqlRepository } from '../../../src/infrastructure/repositories/offre/offre-emploi-http-sql.repository.db'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { uneOffreEmploi } from '../../fixtures/offre-emploi.fixture'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('GetFavorisOffresEmploiJeuneQueryHandler', () => {
  let offresEmploiHttpSqlRepository: Offre.Favori.Emploi.Repository
  let getFavorisOffresEmploiJeuneQueryHandler: GetFavorisOffresEmploiJeuneQueryHandler
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>

  beforeEach(async () => {
    await getDatabase().cleanPG()

    offresEmploiHttpSqlRepository = new OffresEmploiHttpSqlRepository()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    getFavorisOffresEmploiJeuneQueryHandler =
      new GetFavorisOffresEmploiJeuneQueryHandler(jeuneAuthorizer)
  })

  it('renvoie la liste des favoris', async () => {
    // Given
    const now = DateTime.now()

    await ConseillerSqlModel.creer(unConseillerDto({ id: 'ZIDANE' }))
    await JeuneSqlModel.creer(
      unJeuneDto({
        id: 'ABCDE',
        idConseiller: 'ZIDANE'
      })
    )
    const offreEmploi = uneOffreEmploi()
    const favori: Offre.Favori<Offre.Favori.Emploi> = {
      idBeneficiaire: 'ABCDE',
      offre: offreEmploi,
      dateCreation: now,
      dateCandidature: now
    }
    await offresEmploiHttpSqlRepository.save(favori)

    // When
    const favoris = await getFavorisOffresEmploiJeuneQueryHandler.handle({
      idJeune: 'ABCDE'
    })

    // Then
    expect(favoris).to.deep.equal([
      {
        id: '123DXPM',
        dateCreation: now.toISO(),
        dateCandidature: now.toISO()
      }
    ])
  })

  describe('profilsAutorises', () => {
    it('autorise les profils MiLo, France Travail et Conseil départemental', () => {
      expect(
        getFavorisOffresEmploiJeuneQueryHandler.profilsAutorises
      ).to.deep.equal([
        Profil.MILO,
        Profil.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
        Profil.FT_DEMANDEUR_EMPLOI,
        Profil.CONSEIL_DEPT
      ])
    })
  })

  describe('execute', () => {
    it('autorise un bénéficiaire MiLo', async () => {
      // Given
      const jeuneAuthorizerLocal = stubClass(JeuneAuthorizer)
      jeuneAuthorizerLocal.autoriserLeJeune.resolves(emptySuccess())
      const handlerLocal = new GetFavorisOffresEmploiJeuneQueryHandler(
        jeuneAuthorizerLocal
      )
      const utilisateurMilo = unUtilisateurJeune({
        structure: Core.Structure.MILO
      })

      // When
      const favoris = await handlerLocal.execute(
        { idJeune: 'ABCDE' },
        utilisateurMilo
      )

      // Then
      expect(favoris).to.deep.equal([])
      expect(jeuneAuthorizerLocal.autoriserLeJeune).to.have.been.calledWith(
        'ABCDE',
        utilisateurMilo
      )
    })

    it("rejette un bénéficiaire INVITE sans appeler l'authorizer", async () => {
      // Given
      const jeuneAuthorizerLocal = stubClass(JeuneAuthorizer)
      const handlerLocal = new GetFavorisOffresEmploiJeuneQueryHandler(
        jeuneAuthorizerLocal
      )
      const utilisateurInvite = unUtilisateurJeune({
        structure: Core.Structure.INVITE
      })

      // When
      const promise = handlerLocal.execute(
        { idJeune: 'ABCDE' },
        utilisateurInvite
      )

      // Then
      await expect(promise).to.be.rejectedWith(ForbiddenException)
      expect(jeuneAuthorizerLocal.autoriserLeJeune).not.to.have.been.called()
    })
  })
})
