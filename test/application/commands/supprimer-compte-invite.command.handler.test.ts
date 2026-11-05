import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
import {
  SupprimerCompteInviteCommand,
  SupprimerCompteInviteCommandHandler
} from '../../../src/application/commands/supprimer-compte-invite.command.handler'
import {
  DroitsInsuffisants,
  NonTrouveError
} from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../src/building-blocks/types/result'
import { Authentification } from '../../../src/domain/authentification'
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { JeuneInvite } from '../../../src/domain/jeune/jeune-invite'
import { TOUT_INVITE } from '../../../src/domain/profil'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unProfilInvite } from '../../fixtures/profil.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'

describe('SupprimerCompteInviteCommandHandler', () => {
  let jeuneInviteRepository: StubbedType<JeuneInvite.Repository>
  let authentificationRepository: StubbedType<Authentification.Repository>
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>
  let evenementService: StubbedClass<EvenementService>
  let handler: SupprimerCompteInviteCommandHandler

  const idInvite = 'id-invite'
  const utilisateur = unUtilisateurJeune({
    id: idInvite,
    profil: unProfilInvite()
  })
  const command: SupprimerCompteInviteCommand = { idJeune: idInvite }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneInviteRepository = stubInterface(sandbox)
    authentificationRepository = stubInterface(sandbox)
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    evenementService = stubClass(EvenementService)
    handler = new SupprimerCompteInviteCommandHandler(
      jeuneInviteRepository,
      authentificationRepository,
      jeuneInviteAuthorizer,
      evenementService
    )
  })

  describe('authorize', () => {
    it("autorise l'invité sur son propre compte", async () => {
      // Given
      jeuneInviteAuthorizer.autoriserLInvite
        .withArgs(idInvite, utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(command, utilisateur)

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })

    it("refuse quand l'authorizer refuse", async () => {
      // Given
      jeuneInviteAuthorizer.autoriserLInvite
        .withArgs(idInvite, utilisateur)
        .resolves(failure(new DroitsInsuffisants()))

      // When
      const result = await handler.authorize(command, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })

    it('est réservé aux invités', () => {
      expect(handler.profilsAutorises).to.deep.equal(TOUT_INVITE)
    })
  })

  describe('handle', () => {
    it("supprime le compte côté IDP puis l'invité", async () => {
      // Given
      const invite = unInviteASupprimer({ estRepris: false })

      // When
      const result = await handler.handle(command, utilisateur, invite)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        authentificationRepository.supprimerCompteIdp
      ).to.have.been.calledOnceWithExactly('sub-invite')
      expect(
        jeuneInviteRepository.supprimerPlusieurs
      ).to.have.been.calledOnceWithExactly([idInvite])
      expect(
        authentificationRepository.supprimerCompteIdp
      ).to.have.been.calledBefore(jeuneInviteRepository.supprimerPlusieurs)
    })

    it("ne supprime pas l'invité si la suppression côté IDP échoue", async () => {
      // Given
      const invite = unInviteASupprimer({ estRepris: false })
      authentificationRepository.supprimerCompteIdp.rejects(
        new Error('connect injoignable')
      )

      // When
      const promesse = handler.handle(command, utilisateur, invite)

      // Then
      await expect(promesse).to.be.rejectedWith('connect injoignable')
      expect(jeuneInviteRepository.supprimerPlusieurs).not.to.have.been.called()
    })

    it('laisse à la purge un invité déjà repris', async () => {
      // Given
      const invite = unInviteASupprimer({ estRepris: true })

      // When
      const result = await handler.handle(command, utilisateur, invite)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        authentificationRepository.supprimerCompteIdp
      ).not.to.have.been.called()
      expect(jeuneInviteRepository.supprimerPlusieurs).not.to.have.been.called()
    })

    it("renvoie une erreur si l'invité n'existe pas", async () => {
      // Given
      // When
      const result = await handler.handle(command, utilisateur, undefined)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Jeune invité', idInvite))
      )
      expect(
        authentificationRepository.supprimerCompteIdp
      ).not.to.have.been.called()
    })
  })

  describe('monitor', () => {
    it("crée l'événement de suppression quand l'invité a été supprimé", async () => {
      // When
      await handler.monitor(
        utilisateur,
        command,
        unInviteASupprimer({ estRepris: false })
      )

      // Then
      expect(evenementService.creer).to.have.been.calledOnceWithExactly(
        Evenement.Code.COMPTE_SUPPRIME,
        utilisateur
      )
    })

    it("ne crée pas d'événement pour un invité déjà repris", async () => {
      // When
      await handler.monitor(
        utilisateur,
        command,
        unInviteASupprimer({ estRepris: true })
      )

      // Then
      expect(evenementService.creer).not.to.have.been.called()
    })
  })

  describe('getAggregate', () => {
    it("charge l'invité à supprimer", async () => {
      // Given
      const invite = unInviteASupprimer({ estRepris: false })
      jeuneInviteRepository.recupererPourSuppression
        .withArgs(idInvite)
        .resolves(invite)

      // When
      const aggregate = await handler.getAggregate(command)

      // Then
      expect(aggregate).to.deep.equal(invite)
    })
  })

  function unInviteASupprimer({
    estRepris
  }: {
    estRepris: boolean
  }): JeuneInvite.PourSuppression {
    return { id: idInvite, idAuthentification: 'sub-invite', estRepris }
  }
})
