import { ConfigService } from '@nestjs/config'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox, SinonSandbox } from 'sinon'
import {
  PRENOM_INVITE_PAR_DEFAUT,
  UpdateUtilisateurInviteCommandHandler
} from '../../../src/application/commands/update-utilisateur-invite.command.handler'
import { DroitsInsuffisants } from '../../../src/building-blocks/types/domain-error'
import {
  failure,
  isSuccess,
  Success
} from '../../../src/building-blocks/types/result'
import { Authentification } from '../../../src/domain/authentification'
import { Core } from '../../../src/domain/core'
import { DateService } from '../../../src/utils/date-service'
import { IdService } from '../../../src/utils/id-service'
import { uneDate } from '../../fixtures/date.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'
import { unProfilInvite } from '../../fixtures/profil.fixture'

describe('UpdateUtilisateurInviteCommandHandler', () => {
  let sandbox: SinonSandbox
  let authentificationRepository: StubbedType<Authentification.Repository>
  let updateUtilisateurInviteCommandHandler: UpdateUtilisateurInviteCommandHandler
  let dateService: StubbedClass<DateService>

  const idGenere = 'id-en-base'
  const idService: IdService = {
    uuid: () => idGenere
  }
  const maintenant = uneDate()
  const idUtilisateurAuth = 'un-sub-invite'

  beforeEach(() => {
    sandbox = createSandbox()
    authentificationRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.nowJs.returns(maintenant)

    updateUtilisateurInviteCommandHandler =
      new UpdateUtilisateurInviteCommandHandler(
        authentificationRepository,
        idService,
        dateService,
        testConfig()
      )
  })

  afterEach(() => {
    sandbox.restore()
  })

  describe('handle', () => {
    describe('quand le mode app jeune est désactivé', () => {
      it('échoue sans chercher ni créer un utilisateur', async () => {
        // Given
        const handlerDesactive = new UpdateUtilisateurInviteCommandHandler(
          authentificationRepository,
          idService,
          dateService,
          new ConfigService({ appJeuneActif: false })
        )

        // When
        const result = await handlerDesactive.handle({ idUtilisateurAuth })

        // Then
        expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
        expect(
          authentificationRepository.getJeuneInvite
        ).not.to.have.been.called()
        expect(
          authentificationRepository.creerJeuneInvite
        ).not.to.have.been.called()
      })
    })

    describe("quand l'invité n'existe pas encore", () => {
      it('le crée avec un prénom par défaut et renvoie son id en base', async () => {
        // Given
        authentificationRepository.getJeuneInvite
          .withArgs(idUtilisateurAuth)
          .resolves(undefined)

        // When
        const result = await updateUtilisateurInviteCommandHandler.handle({
          idUtilisateurAuth
        })

        // Then
        expect(
          authentificationRepository.creerJeuneInvite
        ).to.have.been.calledOnceWithExactly({
          id: idGenere,
          idAuthentification: idUtilisateurAuth,
          prenom: PRENOM_INVITE_PAR_DEFAUT,
          dateCreation: maintenant
        })

        expect(isSuccess(result)).to.be.true()
        expect((result as Success<{ id: string }>).data).to.deep.equal({
          id: idGenere,
          prenom: PRENOM_INVITE_PAR_DEFAUT,
          nom: '',
          email: undefined,
          username: undefined,
          structure: Core.Structure.INVITE,
          profil: unProfilInvite(),
          type: Authentification.Type.JEUNE,
          roles: []
        })
      })
    })

    describe("quand l'invité existe déjà", () => {
      it("renvoie l'existant sans le recréer (idempotent)", async () => {
        // Given : le même sub rejoué
        const inviteExistant: Authentification.Utilisateur = {
          id: 'id-deja-en-base',
          idAuthentification: idUtilisateurAuth,
          prenom: 'Malek',
          nom: '',
          profil: unProfilInvite(),
          type: Authentification.Type.JEUNE,
          roles: []
        }
        authentificationRepository.getJeuneInvite
          .withArgs(idUtilisateurAuth)
          .resolves(inviteExistant)

        // When
        const result = await updateUtilisateurInviteCommandHandler.handle({
          idUtilisateurAuth
        })

        // Then
        expect(
          authentificationRepository.creerJeuneInvite
        ).not.to.have.been.called()

        expect(isSuccess(result)).to.be.true()
        // Le prénom choisi par l'invité est bien conservé
        expect(
          (result as Success<{ id: string; prenom: string }>).data.id
        ).to.equal('id-deja-en-base')
        expect(
          (result as Success<{ id: string; prenom: string }>).data.prenom
        ).to.equal('Malek')
      })
    })
  })
})
