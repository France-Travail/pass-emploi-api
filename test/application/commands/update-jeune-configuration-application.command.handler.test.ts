import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { Core } from 'src/domain/core'
import { Jeune } from 'src/domain/jeune/jeune'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import {
  UpdateJeuneConfigurationApplicationCommand,
  UpdateJeuneConfigurationApplicationCommandHandler
} from '../../../src/application/commands/update-jeune-configuration-application.command.handler'
import { isFailure, isSuccess } from '../../../src/building-blocks/types/result'
import { DateService } from '../../../src/utils/date-service'
import { Profil } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { uneDatetime } from '../../fixtures/date.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import ConfigurationApplication = Jeune.ConfigurationApplication

describe('UpdateJeuneConfigurationApplicationCommand', () => {
  let updateJeuneConfigurationApplicationCommandHandler: UpdateJeuneConfigurationApplicationCommandHandler
  let jeuneConfigurationApplicationRepository: StubbedType<Jeune.ConfigurationApplication.Repository>
  let jeuneInviteConfigurationApplicationRepository: StubbedType<Jeune.ConfigurationApplication.Repository>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>

  beforeEach(() => {
    const sandbox: SinonSandbox = createSandbox()
    jeuneConfigurationApplicationRepository = stubInterface(sandbox)
    jeuneInviteConfigurationApplicationRepository = stubInterface(sandbox)
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    const dateService: StubbedClass<DateService> = stubClass(DateService)
    dateService.nowJs.returns(uneDatetime().toJSDate())

    const configurationApplicationFactory =
      new ConfigurationApplication.Factory(dateService)

    updateJeuneConfigurationApplicationCommandHandler =
      new UpdateJeuneConfigurationApplicationCommandHandler(
        jeuneConfigurationApplicationRepository,
        jeuneInviteConfigurationApplicationRepository,
        jeuneAuthorizer,
        jeuneInviteAuthorizer,
        configurationApplicationFactory
      )
  })

  describe('handle', () => {
    describe('quand le jeune existe', () => {
      it("met à jour la configuration de l'application du jeune", async () => {
        // Given
        const command: UpdateJeuneConfigurationApplicationCommand = {
          idJeune: 'idJeune',
          pushNotificationToken: 'leNouveauToken',
          appVersion: 'laNouvelleVersion',
          installationId: 'uneInstallationId',
          instanceId: 'uneInstanceId',
          fuseauHoraire: 'Europe/Paris'
        }
        jeuneConfigurationApplicationRepository.get
          .withArgs('idJeune')
          .resolves({
            idJeune: 'idJeune',
            pushNotificationToken: 'leToken',
            appVersion: 'laVersion',
            installationId: 'uneInstallationId',
            instanceId: 'uneInstanceId',
            dateDerniereActualisationToken: uneDatetime()
              .minus({ day: 1 })
              .toJSDate(),
            fuseauHoraire: 'Europe/London'
          })

        // When
        const result =
          await updateJeuneConfigurationApplicationCommandHandler.handle(
            command,
            unUtilisateurJeune()
          )

        // Then
        const configurationApplicationMisAJour: Jeune.ConfigurationApplication =
          {
            idJeune: 'idJeune',
            pushNotificationToken: 'leNouveauToken',
            appVersion: 'laNouvelleVersion',
            installationId: 'uneInstallationId',
            instanceId: 'uneInstanceId',
            fuseauHoraire: 'Europe/Paris',
            dateDerniereActualisationToken: uneDatetime().toJSDate()
          }
        expect(
          jeuneConfigurationApplicationRepository.save
        ).to.have.been.calledWithExactly(configurationApplicationMisAJour)
        expect(isSuccess(result)).to.equal(true)
      })
    })

    describe("quand le jeune n'existe pas", () => {
      it('renvoie une erreur', async () => {
        // Given
        const command: UpdateJeuneConfigurationApplicationCommand = {
          idJeune: 'idJeune',
          pushNotificationToken: 'leNouveauToken'
        }
        jeuneConfigurationApplicationRepository.get
          .withArgs('idJeune')
          .resolves(undefined)

        // When
        const result =
          await updateJeuneConfigurationApplicationCommandHandler.handle(
            command,
            unUtilisateurJeune()
          )

        // Then
        expect(isFailure(result)).to.equal(true)
      })
    })

    describe("quand c'est un invité", () => {
      const utilisateurInvite = unUtilisateurJeune({
        id: 'idInvite',
        structure: Core.Structure.INVITE
      })

      it('écrit dans jeune_invite et rafraîchit la date du token', async () => {
        // Given
        const command: UpdateJeuneConfigurationApplicationCommand = {
          idJeune: 'idInvite',
          pushNotificationToken: 'leNouveauToken',
          appVersion: 'laNouvelleVersion'
        }
        jeuneInviteConfigurationApplicationRepository.get
          .withArgs('idInvite')
          .resolves({
            idJeune: 'idInvite',
            pushNotificationToken: 'leToken',
            appVersion: 'laVersion',
            fuseauHoraire: 'Europe/Paris',
            dateDerniereActualisationToken: uneDatetime()
              .minus({ day: 1 })
              .toJSDate()
          })

        // When
        const result =
          await updateJeuneConfigurationApplicationCommandHandler.handle(
            command,
            utilisateurInvite
          )

        // Then : c'est ce champ qui sert de signal d'activité pour la purge
        expect(
          jeuneInviteConfigurationApplicationRepository.save
        ).to.have.been.calledWithExactly({
          idJeune: 'idInvite',
          pushNotificationToken: 'leNouveauToken',
          appVersion: 'laNouvelleVersion',
          installationId: undefined,
          instanceId: undefined,
          fuseauHoraire: 'Europe/Paris',
          dateDerniereActualisationToken: uneDatetime().toJSDate()
        })
        // et surtout : on ne touche pas à la table jeune
        expect(
          jeuneConfigurationApplicationRepository.save
        ).not.to.have.been.called()
        expect(isSuccess(result)).to.equal(true)
      })

      it("renvoie une erreur quand l'invité n'existe pas", async () => {
        // Given
        jeuneInviteConfigurationApplicationRepository.get
          .withArgs('idInvite')
          .resolves(undefined)

        // When
        const result =
          await updateJeuneConfigurationApplicationCommandHandler.handle(
            { idJeune: 'idInvite', pushNotificationToken: 'token' },
            utilisateurInvite
          )

        // Then
        expect(isFailure(result)).to.equal(true)
      })
    })
  })

  describe('authorize', () => {
    it("passe par l'authorizer invité quand c'est un invité", async () => {
      // Given
      const command: UpdateJeuneConfigurationApplicationCommand = {
        idJeune: 'idInvite',
        pushNotificationToken: 'leNouveauToken'
      }
      const utilisateur = unUtilisateurJeune({
        id: 'idInvite',
        structure: Core.Structure.INVITE
      })

      // When
      await updateJeuneConfigurationApplicationCommandHandler.authorize(
        command,
        utilisateur
      )

      // Then
      expect(
        jeuneInviteAuthorizer.autoriserLInvite
      ).to.have.been.calledWithExactly(command.idJeune, utilisateur)
      expect(jeuneAuthorizer.autoriserLeJeune).not.to.have.been.called()
    })

    it('authorise un jeune ou conseiller à modifier une action', async () => {
      // Given
      const command: UpdateJeuneConfigurationApplicationCommand = {
        idJeune: 'idJeune',
        pushNotificationToken: 'leNouveauToken'
      }

      const utilisateur = unUtilisateurJeune()

      // When
      await updateJeuneConfigurationApplicationCommandHandler.authorize(
        command,
        utilisateur
      )

      // Then
      expect(jeuneAuthorizer.autoriserLeJeune).to.have.been.calledWithExactly(
        command.idJeune,
        utilisateur
      )
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(
        updateJeuneConfigurationApplicationCommandHandler.profilsAutorises
      ).to.deep.equal([
        Profil.MILO,
        Profil.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
        Profil.FT_DEMANDEUR_EMPLOI,
        Profil.CONSEIL_DEPT,
        Profil.INVITE
      ])
    })
  })
})
