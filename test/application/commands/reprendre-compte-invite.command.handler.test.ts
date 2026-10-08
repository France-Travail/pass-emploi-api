import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { ConfigService } from '@nestjs/config'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import {
  ReprendreCompteInviteCommand,
  ReprendreCompteInviteCommandHandler
} from '../../../src/application/commands/reprendre-compte-invite.command.handler'
import { Transaction } from '../../../src/building-blocks/transaction'
import {
  DroitsInsuffisants,
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../../src/building-blocks/types/result'
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { JeuneInvite } from '../../../src/domain/jeune/jeune-invite'
import { Profil, TOUT_PROFIL_SAUF_INVITE } from '../../../src/domain/profil'
import { JwtService } from '../../../src/infrastructure/auth/jwt.service'
import { DateService } from '../../../src/utils/date-service'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { uneDatetime } from '../../fixtures/date.fixture'
import { unProfilMilo } from '../../fixtures/profil.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'

describe('ReprendreCompteInviteCommandHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let jwtService: StubbedClass<JwtService>
  let jeuneInviteRepository: StubbedType<JeuneInvite.Repository>
  let jeuneRepository: StubbedType<Jeune.Repository>
  let evenementService: StubbedClass<EvenementService>
  let dateService: StubbedClass<DateService>
  let transactionService: StubbedType<Transaction.Service>
  let handler: ReprendreCompteInviteCommandHandler

  const maintenant = uneDatetime()
  const dateCreationInvite = maintenant.minus({ days: 12 })
  const idJeune = 'id-jeune'
  const idInvite = 'id-invite'
  const utilisateur = unUtilisateurJeune({
    id: idJeune,
    profil: unProfilMilo(Profil.Dispositif.CEJ)
  })
  const command: ReprendreCompteInviteCommand = {
    idJeune,
    jetonInvite: 'jeton-invite'
  }
  const payloadInvite = {
    userId: idInvite,
    userProfile: { structure: Profil.Structure.INVITE, dispositif: null }
  }

  function construireHandler(configService: ConfigService): void {
    handler = new ReprendreCompteInviteCommandHandler(
      jeuneAuthorizer,
      jwtService,
      jeuneInviteRepository,
      jeuneRepository,
      evenementService,
      dateService,
      transactionService,
      configService
    )
  }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    jwtService = stubClass(JwtService)
    jeuneInviteRepository = stubInterface(sandbox)
    jeuneRepository = stubInterface(sandbox)
    evenementService = stubClass(EvenementService)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    transactionService = stubInterface(sandbox)
    transactionService.executer.callsFake((operation: () => Promise<Result>) =>
      operation()
    )
    construireHandler(testConfig())
  })

  describe('authorize', () => {
    it('autorise le jeune connecté sur son propre compte', async () => {
      // Given
      jeuneAuthorizer.autoriserLeJeune
        .withArgs(idJeune, utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(command, utilisateur)

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })

    it("refuse quand l'app jeune est désactivée", async () => {
      // Given
      construireHandler(new ConfigService({ appJeuneActif: false }))

      // When
      const result = await handler.authorize(command, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
      expect(jeuneAuthorizer.autoriserLeJeune).not.to.have.been.called()
    })

    it('est réservé aux comptes connectés, pas aux invités', () => {
      expect(handler.profilsAutorises).to.deep.equal([
        ...TOUT_PROFIL_SAUF_INVITE
      ])
    })
  })

  describe('handle', () => {
    it("rattache l'invité au jeune et conserve sa date de première utilisation", async () => {
      // Given
      jwtService.verifyTokenAndGetJwt
        .withArgs('jeton-invite')
        .resolves(payloadInvite)
      jeuneInviteRepository.recupererPourReprise
        .withArgs(idInvite)
        .resolves({ id: idInvite, dateCreation: dateCreationInvite })

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(transactionService.executer).to.have.been.calledOnce()
      expect(
        jeuneRepository.enregistrerPremiereUtilisationInvite
      ).to.have.been.calledOnceWithExactly(idJeune, dateCreationInvite)
      expect(
        jeuneInviteRepository.marquerRepris
      ).to.have.been.calledOnceWithExactly(idInvite, idJeune, maintenant)
      expect(evenementService.creer).to.have.been.calledOnceWithExactly(
        Evenement.Code.COMPTE_INVITE_REPRIS,
        utilisateur
      )
    })

    it('refuse un jeton invalide', async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.rejects(new Error('signature invalide'))

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(result).to.deep.equal(
        failure(new MauvaiseCommandeError('Jeton invité invalide'))
      )
      expect(
        jeuneInviteRepository.recupererPourReprise
      ).not.to.have.been.called()
      expect(jeuneInviteRepository.marquerRepris).not.to.have.been.called()
    })

    it("refuse un jeton qui n'est pas celui d'un invité", async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.resolves({
        userId: 'un-autre-jeune',
        userProfile: {
          structure: Profil.Structure.MILO,
          dispositif: Profil.Dispositif.CEJ
        }
      })

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(result).to.deep.equal(
        failure(new MauvaiseCommandeError('Jeton invité invalide'))
      )
      expect(jeuneInviteRepository.marquerRepris).not.to.have.been.called()
    })

    it("échoue quand l'invité n'existe plus", async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.resolves(payloadInvite)
      jeuneInviteRepository.recupererPourReprise.resolves(undefined)

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('JeuneInvite', idInvite))
      )
      expect(jeuneInviteRepository.marquerRepris).not.to.have.been.called()
    })

    it("ne refait rien quand l'invité a déjà été repris par ce jeune", async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.resolves(payloadInvite)
      jeuneInviteRepository.recupererPourReprise.resolves({
        id: idInvite,
        dateCreation: dateCreationInvite,
        idJeuneRepreneur: idJeune
      })

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(transactionService.executer).not.to.have.been.called()
      expect(evenementService.creer).not.to.have.been.called()
    })

    it("refuse quand l'invité a déjà été repris par un autre jeune", async () => {
      // Given
      jwtService.verifyTokenAndGetJwt.resolves(payloadInvite)
      jeuneInviteRepository.recupererPourReprise.resolves({
        id: idInvite,
        dateCreation: dateCreationInvite,
        idJeuneRepreneur: 'un-autre-jeune'
      })

      // When
      const result = await handler.handle(command, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
      expect(transactionService.executer).not.to.have.been.called()
    })
  })
})
