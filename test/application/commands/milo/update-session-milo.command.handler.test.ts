import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { ConseillerAuthorizer } from 'src/application/authorizers/conseiller-authorizer'
import { emptySuccess, success } from 'src/building-blocks/types/result'
import { Authentification } from 'src/domain/authentification'
import { EvenementService } from 'src/domain/evenement'
import { Conseiller } from 'src/domain/milo/conseiller'
import { SessionMilo } from 'src/domain/milo/session.milo'
import { Notification } from 'src/domain/notification/notification'
import { OidcClient } from 'src/infrastructure/clients/oidc-client.db'
import { DateService } from 'src/utils/date-service'
import { resoudreDateMilo } from 'src/utils/milo-date'
import { unUtilisateurConseiller } from 'test/fixtures/authentification.fixture'
import { unConseillerMilo } from 'test/fixtures/conseiller-milo.fixture'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { uneSessionMilo } from 'test/fixtures/sessions.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from 'test/utils'
import {
  EnvoyerEmailActivationCommand,
  EnvoyerEmailActivationCommandHandler
} from '../../../../src/application/commands/milo/envoyer-email-activation.command.handler'
import {
  UpdateSessionMiloCommand,
  UpdateSessionMiloCommandHandler
} from '../../../../src/application/commands/milo/update-session-milo.command.handler'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { MiloClient } from '../../../../src/infrastructure/clients/milo/milo-client'
import { unJeune } from '../../../fixtures/jeune.fixture'
import Utilisateur = Authentification.Utilisateur

describe('EnvoyerEmailActivationCommandHandler', () => {
  let envoyerEmailActivationCommandHandler: EnvoyerEmailActivationCommandHandler
  let conseillerRepository: StubbedType<Conseiller.Repository>
  let jeuneRepository: StubbedType<Jeune.Repository>
  let oidcClient: StubbedClass<OidcClient>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let miloClient: StubbedClass<MiloClient>

  const utilisateur: Utilisateur = unUtilisateurConseiller()
  const idpToken = 'ok'
  const jeune = unJeune()
  const command: EnvoyerEmailActivationCommand = {
    idJeune: jeune.id,
    idConseiller: 'con',
    accessToken: 'token'
  }

  beforeEach(async () => {
    const sandbox: SinonSandbox = createSandbox()
    conseillerRepository = stubInterface(sandbox)
    jeuneRepository = stubInterface(sandbox)
    oidcClient = stubClass(OidcClient)
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    miloClient = stubClass(MiloClient)
    oidcClient.exchangeToken.resolves(idpToken)
    envoyerEmailActivationCommandHandler =
      new EnvoyerEmailActivationCommandHandler(
        conseillerRepository,
        jeuneRepository,
        conseillerAuthorizer,
        miloClient,
        oidcClient
      )
  })

  describe('handle', () => {
    it('envoie le mail', async () => {
      // Given
      conseillerRepository.get
        .withArgs(command.idConseiller)
        .resolves(unConseillerMilo())
      jeuneRepository.get.withArgs(command.idJeune).resolves(jeune)
      miloClient.envoyerEmailActivation.resolves(emptySuccess())

      // When
      const result = await envoyerEmailActivationCommandHandler.handle(command)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        miloClient.envoyerEmailActivation
      ).to.have.been.calledOnceWithExactly(idpToken, jeune.email)
    })
  })

  describe('authorize', () => {
    it('authorize le conseiller pour son jeune', async () => {
      // When
      await envoyerEmailActivationCommandHandler.authorize(command, utilisateur)

      // Then
      expect(
        conseillerAuthorizer.autoriserLeConseillerPourSonJeune
      ).to.have.been.calledWithExactly(
        command.idConseiller,
        command.idJeune,
        utilisateur
      )
    })
  })
})

describe('UpdateSessionMiloCommandHandler', () => {
  let handler: UpdateSessionMiloCommandHandler
  let conseillerMiloRepository: StubbedType<Conseiller.Milo.Repository>
  let sessionMiloRepository: StubbedType<SessionMilo.Repository>
  let jeuneRepository: StubbedType<Jeune.Repository>
  let oidcClient: StubbedClass<OidcClient>
  let dateService: StubbedClass<DateService>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let notificationService: StubbedClass<Notification.Service>
  let evenementService: StubbedClass<EvenementService>

  const utilisateur: Utilisateur = unUtilisateurConseiller()

  beforeEach(() => {
    const sandbox: SinonSandbox = createSandbox()
    conseillerMiloRepository = stubInterface(sandbox)
    sessionMiloRepository = stubInterface(sandbox)
    jeuneRepository = stubInterface(sandbox)
    oidcClient = stubClass(OidcClient)
    dateService = stubClass(DateService)
    dateService.now.returns(uneDatetime())
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    notificationService = stubClass(Notification.Service)
    evenementService = stubClass(EvenementService)
    oidcClient.exchangeToken.resolves('idpToken')

    handler = new UpdateSessionMiloCommandHandler(
      conseillerMiloRepository,
      sessionMiloRepository,
      jeuneRepository,
      oidcClient,
      dateService,
      conseillerAuthorizer,
      notificationService,
      evenementService
    )
  })

  describe('handle', () => {
    it("notifie l'inscription des jeunes inscrits", async () => {
      // Given
      const conseiller = unConseillerMilo({
        structure: { id: '1', timezone: 'America/Cayenne' }
      })
      // debut est construit comme le fait getForConseiller : resoudreDateMilo(...).toUTC()
      const session = uneSessionMilo({
        debut: resoudreDateMilo(
          '2020-04-06 22:00:00',
          conseiller.structure.timezone
        ).toUTC()
      })
      const jeune = unJeune()

      conseillerMiloRepository.get.resolves(success(conseiller))
      sessionMiloRepository.getForConseiller.resolves(success(session))
      sessionMiloRepository.save.resolves(emptySuccess())
      jeuneRepository.findAll.resolves([])
      jeuneRepository.findAll.withArgs(['id-luna']).resolves([jeune])

      const commandInscription: UpdateSessionMiloCommand = {
        idSession: session.id,
        idConseiller: conseiller.id,
        accessToken: 'token',
        inscriptions: [
          {
            idJeune: 'id-luna',
            statut: SessionMilo.Modification.StatutInscription.INSCRIT
          }
        ]
      }

      // When
      const result = await handler.handle(commandInscription, utilisateur)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        notificationService.notifierInscriptionSession
      ).to.have.been.calledOnceWithExactly(
        session.id,
        session.nom,
        session.debut,
        [jeune]
      )
    })
  })
})
