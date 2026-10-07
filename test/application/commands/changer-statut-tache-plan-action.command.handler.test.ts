import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { ChangerStatutTachePlanActionCommandHandler } from '../../../src/application/commands/changer-statut-tache-plan-action.command.handler'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { Transaction } from '../../../src/building-blocks/transaction'
import {
  DateNonAutoriseeError,
  DroitsInsuffisants,
  ErreurHttp,
  MauvaiseCommandeError,
  NonTrouveError,
  RessourceIndisponibleError
} from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result,
  success
} from '../../../src/building-blocks/types/result'
import { Action } from '../../../src/domain/action/action'
import { Demarche } from '../../../src/domain/demarche'
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { PlanAction } from '../../../src/domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../src/domain/plan-action/referentiel-plan-action'
import { Profil, TOUT_PROFIL_SAUF_INVITE } from '../../../src/domain/profil'
import { DateService } from '../../../src/utils/date-service'
import { uneAction } from '../../fixtures/action.fixture'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { uneDatetime } from '../../fixtures/date.fixture'
import { uneDemarche } from '../../fixtures/demarche.fixture'
import { unJeune } from '../../fixtures/jeune.fixture'
import {
  unProfilCD,
  unProfilFT,
  unProfilMilo
} from '../../fixtures/profil.fixture'
import { StubbedClass, createSandbox, expect, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'

describe('ChangerStatutTachePlanActionCommandHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let planActionRepository: StubbedType<PlanAction.Repository>
  let referentielRepository: StubbedType<ReferentielPlanAction.Repository>
  let jeuneRepository: StubbedType<Jeune.Repository>
  let actionRepository: StubbedType<Action.Repository>
  let actionFactory: StubbedClass<Action.Factory>
  let demarcheRepository: StubbedType<Demarche.Repository>
  let demarcheFactory: StubbedClass<Demarche.Factory>
  let evenementService: StubbedClass<EvenementService>
  let dateService: StubbedClass<DateService>
  let transactionService: StubbedType<Transaction.Service>
  let handler: ChangerStatutTachePlanActionCommandHandler

  const dateCreation = uneDatetime()
  const maintenant = dateCreation.plus({ days: 2 })
  const hier = maintenant.minus({ days: 1 })
  const idTache = '11111111-1111-1111-1111-111111111111'
  const accessToken = 'token'
  const jeuneMilo = unUtilisateurJeune({
    profil: unProfilMilo(Profil.Dispositif.CEJ)
  })
  const jeuneFT = unUtilisateurJeune({
    profil: unProfilFT(Profil.Dispositif.CEJ)
  })
  const jeuneEspaceCandidat = unUtilisateurJeune({
    profil: unProfilFT(Profil.Dispositif.ESPACE_CANDIDAT)
  })

  function uneTache(
    override: Partial<PlanAction.Tache> = {}
  ): PlanAction.Tache {
    return {
      id: idTache,
      idSolution: 'p-164',
      terminee: false,
      dateCreation,
      ...override
    }
  }

  function uneSolution(
    override: Partial<ReferentielPlanAction.Solution> = {}
  ): ReferentielPlanAction.Solution {
    return {
      id: 'p-164',
      type: ReferentielPlanAction.TypeSolution.CONSEIL,
      libelle: 'Je crée mon CV',
      situations: [],
      authentifications: [],
      territoires: [],
      conversionFT: {
        thematique: 'Mes candidatures',
        codePourquoi: 'P03',
        codeQuoi: 'Q12'
      },
      conversionML: { categorie: 'Emploi', codeCategorie: 'EMPLOI' },
      ...override
    }
  }

  function uneCommande(
    override: Partial<{
      idJeune: string
      terminee: boolean
      date: DateTime
      commentaire: string
    }> = {}
  ): {
    idJeune: string
    idTache: string
    terminee: boolean
    date?: DateTime
    commentaire?: string
    accessToken: string
  } {
    return {
      idJeune: jeuneMilo.id,
      idTache,
      terminee: true,
      date: hier,
      accessToken,
      ...override
    }
  }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    planActionRepository = stubInterface(sandbox)
    referentielRepository = stubInterface(sandbox)
    jeuneRepository = stubInterface(sandbox)
    actionRepository = stubInterface(sandbox)
    actionFactory = stubClass(Action.Factory)
    demarcheRepository = stubInterface(sandbox)
    demarcheFactory = stubClass(Demarche.Factory)
    evenementService = stubClass(EvenementService)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    transactionService = stubInterface(sandbox)
    transactionService.executer.callsFake((operation: () => Promise<Result>) =>
      operation()
    )
    referentielRepository.trouverSolutions
      .withArgs(['p-164'])
      .resolves([uneSolution()])
    handler = new ChangerStatutTachePlanActionCommandHandler(
      jeuneAuthorizer,
      planActionRepository,
      referentielRepository,
      jeuneRepository,
      actionRepository,
      actionFactory,
      demarcheRepository,
      demarcheFactory,
      evenementService,
      dateService,
      transactionService,
      testConfig()
    )
  })

  it("n'est pas ouvert à l'invité", () => {
    expect(handler.profilsAutorises).to.deep.equal([...TOUT_PROFIL_SAUF_INVITE])
  })

  describe('getAggregate', () => {
    it('charge la tâche dans le plan du jeune', async () => {
      // Given
      planActionRepository.getTache
        .withArgs(jeuneMilo.id, idTache)
        .resolves(uneTache())

      // When
      const tache = await handler.getAggregate(uneCommande())

      // Then
      expect(tache).to.deep.equal(uneTache())
    })
  })

  describe('authorize', () => {
    it('refuse quand le mode app jeune est désactivé', async () => {
      // Given
      const handlerDesactive = new ChangerStatutTachePlanActionCommandHandler(
        jeuneAuthorizer,
        planActionRepository,
        referentielRepository,
        jeuneRepository,
        actionRepository,
        actionFactory,
        demarcheRepository,
        demarcheFactory,
        evenementService,
        dateService,
        transactionService,
        new ConfigService({ appJeuneActif: false })
      )

      // When
      const result = await handlerDesactive.authorize(uneCommande(), jeuneMilo)

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })

    it("délègue à l'autorisation jeune standard", async () => {
      // Given
      jeuneAuthorizer.autoriserLeJeune
        .withArgs(jeuneMilo.id, jeuneMilo)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(uneCommande(), jeuneMilo)

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })

  describe('handle', () => {
    it("échoue quand la tâche n'appartient pas au plan du jeune", async () => {
      // When
      const result = await handler.handle(uneCommande(), jeuneMilo, undefined)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('TachePlanAction', idTache))
      )
      expect(planActionRepository.saveTache).not.to.have.been.called()
    })

    it('ne fait rien quand la tâche est déjà cochée', async () => {
      // When
      const result = await handler.handle(
        uneCommande({ terminee: true }),
        jeuneMilo,
        uneTache({ terminee: true, dateTerminee: dateCreation })
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(actionRepository.save).not.to.have.been.called()
      expect(planActionRepository.saveTache).not.to.have.been.called()
    })

    it('décoche sans rien créer', async () => {
      // When
      const result = await handler.handle(
        uneCommande({ terminee: false, date: undefined }),
        jeuneMilo,
        uneTache({ terminee: true, dateTerminee: dateCreation })
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(planActionRepository.saveTache).to.have.been.calledWithExactly(
        uneTache({ terminee: false })
      )
      expect(actionRepository.save).not.to.have.been.called()
      expect(demarcheRepository.save).not.to.have.been.called()
    })

    describe('jeune Mission Locale', () => {
      const commentaire = "J'ai refait mon CV avec ma conseillère"
      const jeune = unJeune()
      const action = uneAction()

      beforeEach(() => {
        jeuneRepository.get.withArgs(jeuneMilo.id).resolves(jeune)
        actionFactory.buildAction.returns(success(action))
      })

      it('coche la tâche à la date déclarée et crée une action terminée', async () => {
        // When
        const result = await handler.handle(
          uneCommande({ terminee: true, commentaire }),
          jeuneMilo,
          uneTache({ terminee: false })
        )

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(actionFactory.buildAction).to.have.been.calledWithExactly(
          {
            contenu: 'Je crée mon CV',
            idJeune: jeuneMilo.id,
            statut: Action.Statut.TERMINEE,
            commentaire,
            typeCreateur: Action.TypeCreateur.JEUNE,
            dateEcheance: hier,
            rappel: false,
            codeQualification: Action.Qualification.Code.EMPLOI
          },
          jeune
        )
        expect(actionRepository.save).to.have.been.calledWithExactly(action)
        expect(planActionRepository.saveTache).to.have.been.calledWithExactly(
          uneTache({ terminee: true, dateTerminee: hier })
        )
      })

      it("coche la tâche avant de créer l'action", async () => {
        // When
        await handler.handle(
          uneCommande({ terminee: true, commentaire }),
          jeuneMilo,
          uneTache({ terminee: false })
        )

        // Then
        expect(planActionRepository.saveTache).to.have.been.calledBefore(
          actionRepository.save
        )
      })

      it("coche la tâche et crée l'action dans une même transaction", async () => {
        // Given
        transactionService.executer.resolves(emptySuccess())

        // When
        await handler.handle(
          uneCommande({ terminee: true, commentaire }),
          jeuneMilo,
          uneTache({ terminee: false })
        )

        // Then
        expect(transactionService.executer).to.have.been.calledOnce()
        expect(planActionRepository.saveTache).not.to.have.been.called()
        expect(actionRepository.save).not.to.have.been.called()
      })

      it('crée une action sans qualification quand la catégorie est inconnue', async () => {
        // Given
        referentielRepository.trouverSolutions.withArgs(['p-164']).resolves([
          uneSolution({
            conversionML: { categorie: 'Autre', codeCategorie: 'INCONNU' }
          })
        ])

        // When
        await handler.handle(
          uneCommande({ commentaire }),
          jeuneMilo,
          uneTache()
        )

        // Then
        expect(
          actionFactory.buildAction.firstCall.args[0].codeQualification
        ).to.equal(undefined)
      })

      it("échoue quand le jeune n'existe pas", async () => {
        // Given
        jeuneRepository.get.withArgs(jeuneMilo.id).resolves(undefined)

        // When
        const result = await handler.handle(
          uneCommande({ commentaire }),
          jeuneMilo,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(
          failure(new NonTrouveError('Jeune', jeuneMilo.id))
        )
        expect(actionRepository.save).not.to.have.been.called()
      })

      it("renvoie l'échec de construction de l'action sans la sauvegarder", async () => {
        // Given
        const echec = failure(new MauvaiseCommandeError('x'))
        actionFactory.buildAction.returns(echec)

        // When
        const result = await handler.handle(
          uneCommande({ commentaire }),
          jeuneMilo,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(echec)
        expect(actionRepository.save).not.to.have.been.called()
      })

      it('refuse une déclaration sans commentaire', async () => {
        // When
        const result = await handler.handle(
          uneCommande({ commentaire: undefined }),
          jeuneMilo,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(
          failure(new MauvaiseCommandeError('Le commentaire est requis'))
        )
        expect(actionRepository.save).not.to.have.been.called()
        expect(planActionRepository.saveTache).not.to.have.been.called()
      })

      it("refuse une déclaration dont le commentaire n'est fait que d'espaces", async () => {
        // When
        const result = await handler.handle(
          uneCommande({ commentaire: '   ' }),
          jeuneMilo,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(
          failure(new MauvaiseCommandeError('Le commentaire est requis'))
        )
        expect(actionRepository.save).not.to.have.been.called()
        expect(planActionRepository.saveTache).not.to.have.been.called()
      })
    })

    describe('jeune France Travail ou Conseil départemental', () => {
      const demarcheCreee: Demarche.Creee = {
        statut: Demarche.Statut.REALISEE,
        dateCreation: maintenant,
        dateFin: hier,
        pourquoi: 'P03',
        quoi: 'Q12'
      }

      beforeEach(() => {
        demarcheFactory.creerDemarche.returns(success(demarcheCreee))
        demarcheRepository.save.resolves(success(uneDemarche()))
      })

      it('coche la tâche à la date déclarée et crée une démarche réalisée', async () => {
        // When
        const result = await handler.handle(
          uneCommande({ idJeune: jeuneFT.id, terminee: true }),
          jeuneFT,
          uneTache({ terminee: false })
        )

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(demarcheFactory.creerDemarche).to.have.been.calledWithExactly({
          dateFin: hier,
          pourquoi: 'P03',
          quoi: 'Q12',
          description: 'Je crée mon CV',
          realisee: true
        })
        expect(demarcheRepository.save).to.have.been.calledWithExactly(
          demarcheCreee,
          accessToken,
          Profil.Structure.FRANCE_TRAVAIL
        )
        expect(planActionRepository.saveTache).to.have.been.calledWithExactly(
          uneTache({ terminee: true, dateTerminee: hier })
        )
      })

      it('coche la tâche avant de créer la démarche', async () => {
        // When
        await handler.handle(
          uneCommande({ idJeune: jeuneFT.id, terminee: true }),
          jeuneFT,
          uneTache({ terminee: false })
        )

        // Then
        expect(planActionRepository.saveTache).to.have.been.calledBefore(
          demarcheRepository.save
        )
      })

      it('coche la tâche et crée la démarche dans une même transaction', async () => {
        // Given
        transactionService.executer.resolves(emptySuccess())

        // When
        await handler.handle(
          uneCommande({ idJeune: jeuneFT.id, terminee: true }),
          jeuneFT,
          uneTache({ terminee: false })
        )

        // Then
        expect(transactionService.executer).to.have.been.calledOnce()
        expect(planActionRepository.saveTache).not.to.have.been.called()
        expect(demarcheRepository.save).not.to.have.been.called()
      })

      it('crée la même démarche pour un jeune du Conseil départemental', async () => {
        // Given
        const jeuneCD = unUtilisateurJeune({ profil: unProfilCD() })

        // When
        await handler.handle(uneCommande(), jeuneCD, uneTache())

        // Then
        expect(demarcheRepository.save).to.have.been.calledWithExactly(
          demarcheCreee,
          accessToken,
          Profil.Structure.CONSEIL_DEPARTEMENTAL
        )
      })

      it('crée une démarche personnelle quand un code France Travail manque', async () => {
        // Given
        referentielRepository.trouverSolutions.withArgs(['p-164']).resolves([
          uneSolution({
            libelle: 'Je consulte les offres de bénévolat',
            conversionFT: { codePourquoi: 'P03' }
          })
        ])

        // When
        await handler.handle(uneCommande(), jeuneFT, uneTache())

        // Then
        expect(demarcheFactory.creerDemarche).to.have.been.calledWithExactly({
          dateFin: hier,
          pourquoi: 'P03',
          quoi: undefined,
          description: 'Je consulte les offres de bénévolat',
          realisee: true
        })
      })

      it('refuse une déclaration avec commentaire', async () => {
        // When
        const result = await handler.handle(
          uneCommande({ commentaire: 'un commentaire' }),
          jeuneFT,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(
          failure(
            new MauvaiseCommandeError(
              "Le commentaire n'est pas accepté pour une démarche"
            )
          )
        )
        expect(demarcheRepository.save).not.to.have.been.called()
      })

      it('accepte un commentaire vide pour une démarche', async () => {
        // When
        const result = await handler.handle(
          uneCommande({ idJeune: jeuneFT.id, commentaire: '' }),
          jeuneFT,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(demarcheRepository.save).to.have.been.calledOnce()
      })

      it("accepte un commentaire fait d'espaces pour une démarche", async () => {
        // When
        const result = await handler.handle(
          uneCommande({ idJeune: jeuneFT.id, commentaire: '  ' }),
          jeuneFT,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(demarcheRepository.save).to.have.been.calledOnce()
      })

      it("rend l'erreur de France Travail à la transaction pour annuler la coche", async () => {
        // Given
        const erreur = failure(new ErreurHttp('Service indisponible', 503))
        demarcheRepository.save.resolves(erreur)

        // When
        const result = await handler.handle(uneCommande(), jeuneFT, uneTache())

        // Then
        expect(result).to.deep.equal(erreur)
        expect(
          await transactionService.executer.firstCall.returnValue
        ).to.deep.equal(erreur)
      })
    })

    describe('jeune France Travail Espace candidat', () => {
      it('coche la tâche sans rien créer', async () => {
        // When
        const result = await handler.handle(
          uneCommande({ date: undefined }),
          jeuneEspaceCandidat,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(planActionRepository.saveTache).to.have.been.calledWithExactly(
          uneTache({ terminee: true, dateTerminee: maintenant })
        )
        expect(demarcheRepository.save).not.to.have.been.called()
        expect(actionRepository.save).not.to.have.been.called()
      })
    })

    describe('jeune France Travail Espace candidat avec date', () => {
      it('refuse une date future sans rien sauvegarder', async () => {
        // When
        const result = await handler.handle(
          uneCommande({ date: maintenant.plus({ days: 1 }) }),
          jeuneEspaceCandidat,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(failure(new DateNonAutoriseeError()))
        expect(planActionRepository.saveTache).not.to.have.been.called()
      })

      it('coche la tâche à la date fournie quand elle est passée', async () => {
        // When
        const result = await handler.handle(
          uneCommande(),
          jeuneEspaceCandidat,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(emptySuccess())
        expect(planActionRepository.saveTache).to.have.been.calledWithExactly(
          uneTache({ terminee: true, dateTerminee: hier })
        )
      })
    })

    describe('refus communs aux déclarations', () => {
      it('refuse une déclaration sans date', async () => {
        // When
        const result = await handler.handle(
          uneCommande({ date: undefined, commentaire: 'ok' }),
          jeuneMilo,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(
          failure(
            new MauvaiseCommandeError('La date de réalisation est requise')
          )
        )
        expect(planActionRepository.saveTache).not.to.have.been.called()
      })

      it('refuse une date future', async () => {
        // When
        const result = await handler.handle(
          uneCommande({
            date: maintenant.plus({ days: 1 }),
            commentaire: 'ok'
          }),
          jeuneMilo,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(failure(new DateNonAutoriseeError()))
        expect(planActionRepository.saveTache).not.to.have.been.called()
      })

      it('accepte la date du jour exprimée dans un autre fuseau', async () => {
        // Given
        jeuneRepository.get.withArgs(jeuneMilo.id).resolves(unJeune())
        actionFactory.buildAction.returns(success(uneAction()))
        const maintenantUtc = DateTime.fromISO('2026-10-01T22:30:00Z')
        dateService.now.returns(maintenantUtc)
        const aujourdhuiAParis = DateTime.fromISO('2026-10-02T00:00:00', {
          zone: 'Europe/Paris'
        })

        // When
        const result = await handler.handle(
          uneCommande({ date: aujourdhuiAParis, commentaire: 'ok' }),
          jeuneMilo,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(emptySuccess())
      })

      it("échoue quand la solution n'est plus au référentiel", async () => {
        // Given
        referentielRepository.trouverSolutions.withArgs(['p-164']).resolves([])

        // When
        const result = await handler.handle(
          uneCommande({ commentaire: 'ok' }),
          jeuneMilo,
          uneTache()
        )

        // Then
        expect(result).to.deep.equal(
          failure(
            new RessourceIndisponibleError(
              "La solution p-164 n'est plus proposée"
            )
          )
        )
        expect(actionRepository.save).not.to.have.been.called()
        expect(planActionRepository.saveTache).not.to.have.been.called()
      })
    })
  })

  describe('monitor', () => {
    it("trace la déclaration avec l'identifiant de la solution", async () => {
      // When
      await handler.monitor(jeuneMilo, uneCommande(), uneTache())

      // Then
      expect(evenementService.creer).to.have.been.calledWithExactly(
        Evenement.Code.ACTION_CREEE_PLAN_ACTION,
        jeuneMilo,
        'p-164'
      )
    })

    it('ne trace rien quand la tâche était déjà cochée', async () => {
      // When
      await handler.monitor(
        jeuneMilo,
        uneCommande({ terminee: true }),
        uneTache({ terminee: true, dateTerminee: dateCreation })
      )

      // Then
      expect(evenementService.creer).not.to.have.been.called()
    })

    it('ne trace rien quand on décoche la tâche', async () => {
      // When
      await handler.monitor(
        jeuneMilo,
        uneCommande({ terminee: false }),
        uneTache({ terminee: true, dateTerminee: dateCreation })
      )

      // Then
      expect(evenementService.creer).not.to.have.been.called()
    })

    it('ne trace rien quand on décoche une tâche déjà décochée', async () => {
      // When
      await handler.monitor(
        jeuneMilo,
        uneCommande({ terminee: false }),
        uneTache({ terminee: false })
      )

      // Then
      expect(evenementService.creer).not.to.have.been.called()
    })

    it('ne trace rien quand le profil ne déclare ni action ni démarche', async () => {
      // When
      await handler.monitor(
        jeuneEspaceCandidat,
        uneCommande({ terminee: true }),
        uneTache({ terminee: false })
      )

      // Then
      expect(evenementService.creer).not.to.have.been.called()
    })
  })
})
