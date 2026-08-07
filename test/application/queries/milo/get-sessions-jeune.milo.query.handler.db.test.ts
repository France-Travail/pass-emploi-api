import { describe } from 'mocha'
import { createSandbox, SinonSandbox } from 'sinon'
import { JeuneAuthorizer } from 'src/application/authorizers/jeune-authorizer'
import {
  GetSessionsJeuneMiloQuery,
  GetSessionsJeuneMiloQueryHandler
} from 'src/application/queries/milo/get-sessions-jeune.milo.query.handler.db'
import { GetSessionsVisiblesPourLeJeuneMiloQueryGetter } from 'src/application/queries/query-getters/milo/get-sessions-visibles-pour-jeune.milo.query.getter.db'
import { GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter } from 'src/application/queries/query-getters/milo/get-sessions-jeune-inscrit.milo.query.getter.db'
import {
  JeuneMiloSansIdDossier,
  NonTrouveError
} from 'src/building-blocks/types/domain-error'
import { failure, success } from 'src/building-blocks/types/result'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune
} from 'test/fixtures/authentification.fixture'
import { uneSessionJeuneMiloQueryModel } from 'test/fixtures/sessions.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { ConseillerInterStructureMiloAuthorizer } from '../../../../src/application/authorizers/conseiller-inter-structure-milo-authorizer'
import { Authentification } from '../../../../src/domain/authentification'
import { Profil } from '../../../../src/domain/profil'
import { Core } from '../../../../src/domain/core'
import { SessionMilo } from '../../../../src/domain/milo/session.milo'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../../fixtures/sql-models/jeune.sql-model'
import { getDatabase } from '../../../utils/database-for-testing'

describe('GetSessionsJeuneMiloQueryHandler', () => {
  const query: GetSessionsJeuneMiloQuery = {
    idJeune: 'idJeune',
    accessToken: 'token'
  }
  const utilisateur = unUtilisateurJeune()

  let getSessionsQueryHandler: GetSessionsJeuneMiloQueryHandler
  let getSessionsPourLeJeuneQueryGetter: StubbedClass<GetSessionsVisiblesPourLeJeuneMiloQueryGetter>
  let getSessionsInscritQueryGetter: StubbedClass<GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter>
  let conseillerAuthorizer: StubbedClass<ConseillerInterStructureMiloAuthorizer>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let sandbox: SinonSandbox

  before(async () => {
    sandbox = createSandbox()
  })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    await ConseillerSqlModel.creer(unConseillerDto())

    getSessionsPourLeJeuneQueryGetter = stubClass(
      GetSessionsVisiblesPourLeJeuneMiloQueryGetter
    )
    getSessionsInscritQueryGetter = stubClass(
      GetSessionsAuxquellesLeJeuneEstInscritMiloQueryGetter
    )
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    conseillerAuthorizer = stubClass(ConseillerInterStructureMiloAuthorizer)

    getSessionsQueryHandler = new GetSessionsJeuneMiloQueryHandler(
      getSessionsPourLeJeuneQueryGetter,
      getSessionsInscritQueryGetter,
      jeuneAuthorizer,
      conseillerAuthorizer
    )
  })

  after(() => {
    sandbox.restore()
  })

  describe('authorize', () => {
    it('autorise un jeune Milo', () => {
      getSessionsQueryHandler.authorize(query, utilisateur)

      expect(jeuneAuthorizer.autoriserLeJeune).to.have.been.calledWithExactly(
        'idJeune',
        utilisateur
      )
    })

    it("autorise le conseiller d'un jeune Milo", () => {
      const utilisateurConseiller = unUtilisateurConseiller()

      getSessionsQueryHandler.authorize(query, utilisateurConseiller)

      expect(
        conseillerAuthorizer.autoriserConseillerAvecLaMemeStructureQueLeJeune
      ).to.have.been.calledWithExactly('idJeune', utilisateurConseiller)
    })
  })

  describe('profilsAutorises', () => {
    it('exige le profil MILO', () => {
      // Then
      expect(getSessionsQueryHandler.profilsAutorises).to.deep.equal([
        Profil.Jeune.MILO,
        Profil.Conseiller.MILO
      ])
    })
  })

  describe('handle', () => {
    describe("quand le jeune n'existe pas", () => {
      it('renvoie une failure', async () => {
        const result = await getSessionsQueryHandler.handle(query, utilisateur)

        expect(result).to.deep.equal(
          failure(new NonTrouveError('Jeune', query.idJeune))
        )
      })
    })

    describe('quand le jeune existe sans ID partenaire', () => {
      it('renvoie une failure', async () => {
        await JeuneSqlModel.creer({
          ...unJeuneDto({
            id: 'idJeune',
            structure: Core.Structure.MILO,
            instanceId: 'instanceId'
          }),
          idPartenaire: null
        })

        const result = await getSessionsQueryHandler.handle(query, utilisateur)

        expect(result).to.deep.equal(
          failure(new JeuneMiloSansIdDossier(query.idJeune))
        )
      })
    })

    describe('quand le jeune existe', () => {
      beforeEach(async () => {
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: 'idJeune',
            idPartenaire: 'idDossier',
            structure: Core.Structure.MILO,
            instanceId: 'instanceId'
          })
        )
      })

      it("utilise le getter sessions visibles quand c'est un jeune", async () => {
        const unSuccess = success([uneSessionJeuneMiloQueryModel()])
        getSessionsPourLeJeuneQueryGetter.handle
          .withArgs('idJeune', Authentification.Type.JEUNE, 'token')
          .resolves(unSuccess)

        const result = await getSessionsQueryHandler.handle(query, utilisateur)

        expect(result).to.deep.equal(unSuccess)
        expect(getSessionsInscritQueryGetter.handle).not.to.have.been.called()
      })

      it("utilise le getter sessions inscrites quand c'est un conseiller", async () => {
        const utilisateurConseiller = unUtilisateurConseiller()
        const unSuccess = success([
          uneSessionJeuneMiloQueryModel({
            inscription: SessionMilo.Inscription.Statut.INSCRIT
          })
        ])
        getSessionsInscritQueryGetter.handle
          .withArgs('idJeune', Authentification.Type.CONSEILLER, 'token')
          .resolves(unSuccess)

        const result = await getSessionsQueryHandler.handle(
          query,
          utilisateurConseiller
        )

        expect(result).to.deep.equal(unSuccess)
        expect(
          getSessionsPourLeJeuneQueryGetter.handle
        ).not.to.have.been.called()
      })

      it('renvoie la failure du getter', async () => {
        const uneFailure = failure(new NonTrouveError('Jeune', query.idJeune))
        getSessionsPourLeJeuneQueryGetter.handle
          .withArgs('idJeune', Authentification.Type.JEUNE, 'token')
          .resolves(uneFailure)

        const result = await getSessionsQueryHandler.handle(query, utilisateur)

        expect(result).to.deep.equal(uneFailure)
      })
    })
  })
})
