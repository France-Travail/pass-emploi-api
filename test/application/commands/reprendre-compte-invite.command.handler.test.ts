import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { ConfigService } from '@nestjs/config'
import { JeuneInviteAuthorizer } from '../../../src/application/authorizers/jeune-invite-authorizer'
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
import { Authentification } from '../../../src/domain/authentification'
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { JeuneInvite } from '../../../src/domain/jeune/jeune-invite'
import { PlanAction } from '../../../src/domain/plan-action/plan-action'
import { Questionnaire } from '../../../src/domain/plan-action/questionnaire'
import { ReferentielPlanAction } from '../../../src/domain/plan-action/referentiel-plan-action'
import { Profil, TOUT_INVITE } from '../../../src/domain/profil'
import { DateService } from '../../../src/utils/date-service'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { uneDatetime } from '../../fixtures/date.fixture'
import { unProfilInvite, unProfilMilo } from '../../fixtures/profil.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'

describe('ReprendreCompteInviteCommandHandler', () => {
  let jeuneInviteAuthorizer: StubbedClass<JeuneInviteAuthorizer>
  let jetonService: StubbedType<Authentification.JetonService>
  let jeuneInviteRepository: StubbedType<JeuneInvite.Repository>
  let jeuneRepository: StubbedType<Jeune.Repository>
  let planActionRepository: StubbedType<PlanAction.Repository>
  let referentielRepository: StubbedType<ReferentielPlanAction.Repository>
  let evenementService: StubbedClass<EvenementService>
  let dateService: StubbedClass<DateService>
  let transactionService: StubbedType<Transaction.Service>
  let handler: ReprendreCompteInviteCommandHandler

  const maintenant = uneDatetime()
  const dateCreationInvite = maintenant.minus({ days: 12 })
  const idJeuneConnecte = 'id-jeune-connecte'
  const jeuneConnecte = unUtilisateurJeune({
    id: idJeuneConnecte,
    profil: unProfilMilo(Profil.Dispositif.CEJ)
  })
  const idInvite = 'id-invite'
  const utilisateur = unUtilisateurJeune({
    id: idInvite,
    profil: unProfilInvite()
  })
  const command: ReprendreCompteInviteCommand = {
    idInvite,
    jetonConnecte: 'jeton-connecte'
  }

  function construireHandler(configService: ConfigService): void {
    handler = new ReprendreCompteInviteCommandHandler(
      jeuneInviteAuthorizer,
      jetonService,
      jeuneInviteRepository,
      jeuneRepository,
      planActionRepository,
      referentielRepository,
      evenementService,
      dateService,
      transactionService,
      configService
    )
  }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneInviteAuthorizer = stubClass(JeuneInviteAuthorizer)
    jetonService = stubInterface(sandbox)
    jeuneInviteRepository = stubInterface(sandbox)
    jeuneRepository = stubInterface(sandbox)
    planActionRepository = stubInterface(sandbox)
    referentielRepository = stubInterface(sandbox)
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

    it("refuse quand l'app jeune est désactivée", async () => {
      // Given
      construireHandler(new ConfigService({ appJeuneActif: false }))

      // When
      const result = await handler.authorize(command, utilisateur)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
      expect(jeuneInviteAuthorizer.autoriserLInvite).not.to.have.been.called()
    })

    it('est réservé aux invités', () => {
      expect(handler.profilsAutorises).to.deep.equal([TOUT_INVITE])
    })
  })

  describe('handle', () => {
    it("rattache l'invité au jeune et conserve sa date de première utilisation", async () => {
      // Given
      jetonService.jeuneDuJeton
        .withArgs('jeton-connecte')
        .resolves(jeuneConnecte)
      jeuneRepository.existe.withArgs(idJeuneConnecte).resolves(true)
      jeuneInviteRepository.recupererPourReprise
        .withArgs(idInvite)
        .resolves({ id: idInvite, dateCreation: dateCreationInvite })
      jeuneInviteRepository.marquerRepris.resolves(true)

      // When
      const result = await handler.handle(command)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(transactionService.executer).to.have.been.calledOnce()
      expect(
        jeuneRepository.enregistrerPremiereUtilisationInvite
      ).to.have.been.calledOnceWithExactly(idJeuneConnecte, dateCreationInvite)
      expect(
        jeuneInviteRepository.marquerRepris
      ).to.have.been.calledOnceWithExactly(idInvite, maintenant)
    })

    it('refuse un jeton invalide', async () => {
      // Given
      jetonService.jeuneDuJeton.resolves(undefined)

      // When
      const result = await handler.handle(command)

      // Then
      expect(result).to.deep.equal(
        failure(new MauvaiseCommandeError('Jeton compte connecté invalide'))
      )
      expect(jeuneRepository.existe).not.to.have.been.called()
      expect(
        jeuneInviteRepository.recupererPourReprise
      ).not.to.have.been.called()
      expect(jeuneInviteRepository.marquerRepris).not.to.have.been.called()
    })

    it("échoue quand le jeune connecté n'existe pas", async () => {
      // Given
      jetonService.jeuneDuJeton.resolves(jeuneConnecte)
      jeuneRepository.existe.withArgs(idJeuneConnecte).resolves(false)

      // When
      const result = await handler.handle(command)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Jeune', idJeuneConnecte))
      )
      expect(
        jeuneInviteRepository.recupererPourReprise
      ).not.to.have.been.called()
      expect(jeuneInviteRepository.marquerRepris).not.to.have.been.called()
    })

    it("échoue quand l'invité n'existe plus", async () => {
      // Given
      jetonService.jeuneDuJeton.resolves(jeuneConnecte)
      jeuneRepository.existe.withArgs(idJeuneConnecte).resolves(true)
      jeuneInviteRepository.recupererPourReprise.resolves(undefined)

      // When
      const result = await handler.handle(command)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('JeuneInvite', idInvite))
      )
      expect(jeuneInviteRepository.marquerRepris).not.to.have.been.called()
    })

    it("ne refait rien quand l'invité a déjà été repris", async () => {
      // Given
      jetonService.jeuneDuJeton.resolves(jeuneConnecte)
      jeuneRepository.existe.withArgs(idJeuneConnecte).resolves(true)
      jeuneInviteRepository.recupererPourReprise.resolves({
        id: idInvite,
        dateCreation: dateCreationInvite,
        dateReprise: maintenant
      })

      // When
      const result = await handler.handle(command)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(transactionService.executer).not.to.have.been.called()
    })

    it('remonte une panne technique de vérification du jeton au lieu de refuser la preuve', async () => {
      // Given
      jetonService.jeuneDuJeton.rejects(new Error('connect injoignable'))

      // When
      const promesse = handler.handle(command)

      // Then
      await expect(promesse).to.be.rejectedWith('connect injoignable')
      expect(jeuneInviteRepository.marquerRepris).not.to.have.been.called()
    })

    describe("quand un autre appel a repris l'invité entre la lecture et l'écriture", () => {
      beforeEach(() => {
        jetonService.jeuneDuJeton.resolves(jeuneConnecte)
        jeuneRepository.existe.withArgs(idJeuneConnecte).resolves(true)
        jeuneInviteRepository.recupererPourReprise
          .onFirstCall()
          .resolves({ id: idInvite, dateCreation: dateCreationInvite })
        jeuneInviteRepository.marquerRepris.resolves(false)
      })

      it('répond comme un rejeu sans écrire la date', async () => {
        // Given
        jeuneInviteRepository.recupererPourReprise.onSecondCall().resolves({
          id: idInvite,
          dateCreation: dateCreationInvite,
          dateReprise: maintenant
        })

        // When
        const result = await handler.handle(command)

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(
          jeuneRepository.enregistrerPremiereUtilisationInvite
        ).not.to.have.been.called()
      })

      it("échoue en introuvable si l'invité a été purgé entre-temps", async () => {
        // Given
        jeuneInviteRepository.recupererPourReprise
          .onSecondCall()
          .resolves(undefined)

        // When
        const result = await handler.handle(command)

        // Then
        expect(result).to.deep.equal(
          failure(new NonTrouveError('JeuneInvite', idInvite))
        )
      })
    })

    describe('avec un plan fourni', () => {
      const idSolution1 = 'solution-1'
      const idSolution2 = 'solution-2'
      const idSolutionInconnue = 'solution-inconnue'
      const commandAvecPlan: ReprendreCompteInviteCommand = {
        ...command,
        plan: {
          id: 'plan-id',
          objectifs: [
            {
              id: 'objectif-1',
              titre: "M'orienter",
              theme: Questionnaire.Besoin.ORIENTER,
              taches: [
                { id: 'action-1', idSolution: idSolution1, terminee: true },
                { id: 'action-2', idSolution: idSolution2, terminee: false }
              ]
            },
            {
              id: 'objectif-2',
              titre: 'Passer mon permis',
              theme: Questionnaire.Contrainte.PAS_DE_PERMIS,
              taches: [
                {
                  id: 'action-3',
                  idSolution: idSolutionInconnue,
                  terminee: false
                }
              ]
            }
          ]
        }
      }

      beforeEach(() => {
        jetonService.jeuneDuJeton
          .withArgs('jeton-connecte')
          .resolves(jeuneConnecte)
        jeuneRepository.existe.withArgs(idJeuneConnecte).resolves(true)
        jeuneInviteRepository.recupererPourReprise
          .withArgs(idInvite)
          .resolves({ id: idInvite, dateCreation: dateCreationInvite })
        jeuneInviteRepository.marquerRepris.resolves(true)
      })

      it('stocke le plan fourni avec les ids du client, en écartant les solutions inconnues et les objectifs vides', async () => {
        // Given
        referentielRepository.trouverSolutions
          .withArgs([idSolution1, idSolution2, idSolutionInconnue])
          .resolves([
            { id: idSolution1 } as ReferentielPlanAction.Solution,
            { id: idSolution2 } as ReferentielPlanAction.Solution
          ])

        // When
        const result = await handler.handle(commandAvecPlan)

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(planActionRepository.save).to.have.been.calledOnceWithExactly({
          id: 'plan-id',
          idJeune: idJeuneConnecte,
          dateCreation: maintenant,
          objectifs: [
            {
              id: 'objectif-1',
              titre: "M'orienter",
              theme: Questionnaire.Besoin.ORIENTER,
              taches: [
                {
                  id: 'action-1',
                  idSolution: idSolution1,
                  terminee: true,
                  dateCreation: maintenant,
                  dateTerminee: maintenant
                },
                {
                  id: 'action-2',
                  idSolution: idSolution2,
                  terminee: false,
                  dateCreation: maintenant
                }
              ]
            }
          ]
        })
      })

      describe('avec le questionnaire fourni', () => {
        const commandAvecQuestionnaire: ReprendreCompteInviteCommand = {
          ...commandAvecPlan,
          questionnaire: {
            situation: Questionnaire.Situation.EMPLOI,
            besoins: [Questionnaire.Besoin.ORIENTER],
            contraintes: [
              Questionnaire.Contrainte.PAS_DE_PERMIS,
              Questionnaire.Contrainte.RIEN_NE_ME_BLOQUE
            ],
            communeResidence: { codeInsee: '75056', nom: 'Paris' },
            domaineProfessionnelInconnu: true
          }
        }

        it('stocke le plan avec son questionnaire, rattaché au profil du jeune connecté', async () => {
          // Given
          referentielRepository.trouverSolutions.resolves([
            { id: idSolution1 } as ReferentielPlanAction.Solution
          ])

          // When
          const result = await handler.handle(commandAvecQuestionnaire)

          // Then
          expect(result).to.deep.equal(emptySuccess())
          expect(
            planActionRepository.save.firstCall.args[0].questionnaire
          ).to.deep.equal({
            structure: jeuneConnecte.profil.structure,
            situation: Questionnaire.Situation.EMPLOI,
            besoins: [Questionnaire.Besoin.ORIENTER],
            contraintes: [Questionnaire.Contrainte.RIEN_NE_ME_BLOQUE],
            communeResidence: { codeInsee: '75056', nom: 'Paris' },
            domaineProfessionnelInconnu: true
          })
        })
      })

      it('ne stocke pas le plan quand toutes les solutions sont inconnues', async () => {
        // Given
        referentielRepository.trouverSolutions.resolves([])

        // When
        const result = await handler.handle(commandAvecPlan)

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(planActionRepository.save).not.to.have.been.called()
      })

      it('ne stocke pas le plan quand le compte connecté a déjà un plan', async () => {
        // Given
        planActionRepository.existePourJeune
          .withArgs(idJeuneConnecte)
          .resolves(true)

        // When
        const result = await handler.handle(commandAvecPlan)

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(planActionRepository.save).not.to.have.been.called()
        expect(
          jeuneRepository.enregistrerPremiereUtilisationInvite
        ).to.have.been.calledOnce()
      })

      it('ne stocke pas le plan en rejeu (invité déjà repris)', async () => {
        // Given
        jeuneInviteRepository.recupererPourReprise.withArgs(idInvite).resolves({
          id: idInvite,
          dateCreation: dateCreationInvite,
          dateReprise: maintenant
        })

        // When
        const result = await handler.handle(commandAvecPlan)

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(planActionRepository.save).not.to.have.been.called()
      })

      it('ne stocke pas le plan en concurrence perdue', async () => {
        // Given
        jeuneInviteRepository.marquerRepris.resolves(false)
        jeuneInviteRepository.recupererPourReprise.onSecondCall().resolves({
          id: idInvite,
          dateCreation: dateCreationInvite,
          dateReprise: maintenant
        })

        // When
        const result = await handler.handle(commandAvecPlan)

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(planActionRepository.save).not.to.have.been.called()
      })
    })

    it("ne stocke pas de plan quand il n'est pas fourni", async () => {
      // Given
      jetonService.jeuneDuJeton
        .withArgs('jeton-connecte')
        .resolves(jeuneConnecte)
      jeuneRepository.existe.withArgs(idJeuneConnecte).resolves(true)
      jeuneInviteRepository.recupererPourReprise
        .withArgs(idInvite)
        .resolves({ id: idInvite, dateCreation: dateCreationInvite })
      jeuneInviteRepository.marquerRepris.resolves(true)

      // When
      const result = await handler.handle(command)

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(planActionRepository.save).not.to.have.been.called()
      expect(referentielRepository.trouverSolutions).not.to.have.been.called()
    })
  })

  describe('monitor', () => {
    it('trace la reprise pour le jeune connecté', async () => {
      // Given
      jetonService.jeuneDuJeton
        .withArgs('jeton-connecte')
        .resolves(jeuneConnecte)

      // When
      await handler.monitor(utilisateur, command)

      // Then
      expect(evenementService.creer).to.have.been.calledOnceWithExactly(
        Evenement.Code.COMPTE_INVITE_REPRIS,
        jeuneConnecte
      )
    })

    it('ne trace rien si le jeton ne désigne plus de jeune', async () => {
      // Given
      jetonService.jeuneDuJeton.resolves(undefined)

      // When
      await handler.monitor(utilisateur, command)

      // Then
      expect(evenementService.creer).not.to.have.been.called()
    })
  })
})
