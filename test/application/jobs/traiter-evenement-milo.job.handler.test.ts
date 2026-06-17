import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import {
  Traitement,
  TraiterEvenementMiloJobHandler
} from '../../../src/application/jobs/traiter-evenement-milo.job.handler'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { EvenementMilo } from '../../../src/domain/milo/evenement.milo'
import { JeuneMilo } from '../../../src/domain/milo/jeune.milo'
import { RendezVousMilo } from '../../../src/domain/milo/rendez-vous.milo'
import { SessionMilo } from '../../../src/domain/milo/session.milo'
import { Notification } from '../../../src/domain/notification/notification'
import {
  Planificateur,
  PlanificateurService
} from '../../../src/domain/planificateur'
import { RendezVous } from '../../../src/domain/rendez-vous/rendez-vous'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { DateService } from '../../../src/utils/date-service'
import { uneDate, uneDatetime } from '../../fixtures/date.fixture'
import { unJeune } from '../../fixtures/jeune.fixture'
import {
  uneInstanceSessionMilo,
  unEvenementMilo,
  unRendezVousMilo
} from '../../fixtures/milo.fixture'
import { unRendezVous } from '../../fixtures/rendez-vous.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'
import { testConfig } from '../../utils/test-config'

describe('TraiterEvenementMiloJobHandler', () => {
  let handler: TraiterEvenementMiloJobHandler
  let suiviJobService: StubbedType<SuiviJob.Service>
  let dateService: StubbedClass<DateService>
  let jeuneRepository: StubbedType<JeuneMilo.Repository>
  let rendezVousRepository: StubbedType<RendezVous.Repository>
  let sessionMiloRepository: StubbedType<SessionMilo.Repository>
  let miloRendezVousRepository: StubbedType<RendezVousMilo.Repository>
  let rendezVousMiloFactory: StubbedClass<RendezVousMilo.Factory>
  let notificationService: StubbedClass<Notification.Service>
  let planificateurService: StubbedClass<PlanificateurService>

  const maintenant = uneDatetime()
  const idPartenaireBeneficiaire = '123456'
  const jeune: JeuneMilo = {
    ...unJeune(),
    idStructureMilo: 'id-structure-pas-ea'
  }

  const STATUTS_ACTIFS_RDV = [
    RendezVousMilo.Statut.RDV_ABSENT,
    RendezVousMilo.Statut.RDV_NON_PRECISE,
    RendezVousMilo.Statut.RDV_PLANIFIE,
    RendezVousMilo.Statut.RDV_PRESENT
  ]
  const STATUTS_ANNULATION_RDV = [
    RendezVousMilo.Statut.RDV_ANNULE,
    RendezVousMilo.Statut.RDV_REPORTE
  ]

  beforeEach(() => {
    const sandbox = createSandbox()
    suiviJobService = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    jeuneRepository = stubInterface(sandbox)
    rendezVousRepository = stubInterface(sandbox)
    sessionMiloRepository = stubInterface(sandbox)
    miloRendezVousRepository = stubInterface(sandbox)
    rendezVousMiloFactory = stubClass(RendezVousMilo.Factory)
    notificationService = stubClass(Notification.Service)
    planificateurService = stubClass(PlanificateurService)

    handler = new TraiterEvenementMiloJobHandler(
      suiviJobService,
      dateService,
      jeuneRepository,
      rendezVousRepository,
      sessionMiloRepository,
      miloRendezVousRepository,
      rendezVousMiloFactory,
      notificationService,
      planificateurService,
      testConfig()
    )
  })

  function unJob(
    evenement: EvenementMilo
  ): Planificateur.Job<Planificateur.JobTraiterEvenementMilo> {
    return {
      dateExecution: uneDate(),
      type: Planificateur.JobType.TRAITER_EVENEMENT_MILO,
      contenu: evenement
    }
  }

  describe('handle', () => {
    describe("quand l'événement n'est pas traitable", () => {
      it('ne fait rien quand le type est non traitable', async () => {
        const evenement = unEvenementMilo({
          idPartenaireBeneficiaire,
          action: EvenementMilo.ActionEvenement.NON_TRAITABLE
        })

        const result = await handler.handle(unJob(evenement))

        expect(result.resultat).to.deep.equal({
          traitement: Traitement.TYPE_EVENEMENT_NON_TRAITABLE,
          idJeune: undefined,
          idObjet: undefined
        })
        expect(rendezVousRepository.save).not.to.have.been.called()
      })

      it("ne fait rien quand l'objet est non traitable", async () => {
        const evenement = unEvenementMilo({
          idPartenaireBeneficiaire,
          objet: EvenementMilo.ObjetEvenement.NON_TRAITABLE
        })

        const result = await handler.handle(unJob(evenement))

        expect(result.resultat).to.deep.equal({
          traitement: Traitement.OBJET_EVENEMENT_NON_TRAITABLE,
          idJeune: undefined,
          idObjet: undefined
        })
        expect(rendezVousRepository.save).not.to.have.been.called()
      })

      it("ne fait rien quand l'id objet est absent", async () => {
        const evenement = unEvenementMilo({
          idPartenaireBeneficiaire,
          idObjet: null
        })

        const result = await handler.handle(unJob(evenement))

        expect(result.resultat).to.deep.equal({
          traitement: Traitement.ID_OBJET_VIDE,
          idJeune: undefined,
          idObjet: undefined
        })
        expect(jeuneRepository.getByIdDossier).not.to.have.been.called()
      })

      it("ne fait rien quand le jeune n'existe pas", async () => {
        const evenement = unEvenementMilo({ idPartenaireBeneficiaire })
        jeuneRepository.getByIdDossier
          .withArgs(idPartenaireBeneficiaire)
          .resolves(failure(new NonTrouveError('Dossier Milo')))

        const result = await handler.handle(unJob(evenement))

        expect(result.resultat).to.deep.equal({
          traitement: Traitement.JEUNE_INEXISTANT,
          idJeune: undefined,
          idObjet: undefined
        })
        expect(rendezVousRepository.save).not.to.have.been.called()
      })
    })

    describe('quand le jeune existe', () => {
      beforeEach(() => {
        jeuneRepository.getByIdDossier
          .withArgs(idPartenaireBeneficiaire)
          .resolves(success(jeune))
      })

      describe('RDV', () => {
        describe('CREATE', () => {
          const evenement = unEvenementMilo({
            idPartenaireBeneficiaire,
            objet: EvenementMilo.ObjetEvenement.RENDEZ_VOUS,
            action: EvenementMilo.ActionEvenement.CREATE
          })

          it("ne fait rien quand le RDV MILO n'existe pas", async () => {
            miloRendezVousRepository.findRendezVousByEvenement
              .withArgs(evenement)
              .resolves(undefined)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.TRAITEMENT_CREATE_INCONNU,
              idJeune: jeune.id,
              idObjet: undefined
            })
            expect(rendezVousRepository.save).not.to.have.been.called()
          })

          it('ne fait rien quand la date du RDV est trop ancienne', async () => {
            miloRendezVousRepository.findRendezVousByEvenement
              .withArgs(evenement)
              .resolves(
                unRendezVousMilo({
                  dateHeureDebut: maintenant.minus({ year: 1, days: 1 }).toISO()
                })
              )

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.TRAITEMENT_CREATE_INCONNU,
              idJeune: jeune.id,
              idObjet: undefined
            })
            expect(rendezVousRepository.save).not.to.have.been.called()
          })

          STATUTS_ANNULATION_RDV.forEach(statut => {
            it(`ne fait rien quand le statut est ${statut}`, async () => {
              miloRendezVousRepository.findRendezVousByEvenement
                .withArgs(evenement)
                .resolves(unRendezVousMilo({ statut }))

              const result = await handler.handle(unJob(evenement))

              expect(result.resultat).to.deep.equal({
                traitement: Traitement.TRAITEMENT_CREATE_INCONNU,
                idJeune: jeune.id,
                idObjet: undefined
              })
              expect(rendezVousRepository.save).not.to.have.been.called()
            })
          })

          STATUTS_ACTIFS_RDV.forEach(statut => {
            describe(`statut ${statut}`, () => {
              it('crée le RDV CEJ sans notifier quand le RDV est passé', async () => {
                const rendezVousMilo = unRendezVousMilo({ statut })
                miloRendezVousRepository.findRendezVousByEvenement
                  .withArgs(evenement)
                  .resolves(rendezVousMilo)
                const rdv = unRendezVous({
                  date: maintenant.minus({ days: 1 }).toJSDate()
                })
                rendezVousMiloFactory.createRendezVousCEJ
                  .withArgs(rendezVousMilo, jeune)
                  .returns(rdv)

                const result = await handler.handle(unJob(evenement))

                expect(result.resultat).to.deep.equal({
                  traitement: Traitement.RENDEZ_VOUS_AJOUTE,
                  idJeune: jeune.id,
                  idObjet: rdv.id
                })
                expect(
                  rendezVousRepository.save
                ).to.have.been.calledOnceWithExactly(rdv)
                expect(
                  planificateurService.planifierRappelsRendezVous
                ).to.have.been.calledOnceWithExactly(rdv)
                expect(
                  notificationService.notifierLesJeunesDuRdv
                ).not.to.have.been.called()
              })

              it('crée le RDV CEJ et notifie quand le RDV est futur', async () => {
                const rendezVousMilo = unRendezVousMilo({ statut })
                miloRendezVousRepository.findRendezVousByEvenement
                  .withArgs(evenement)
                  .resolves(rendezVousMilo)
                const rdv = unRendezVous()
                rendezVousMiloFactory.createRendezVousCEJ
                  .withArgs(rendezVousMilo, jeune)
                  .returns(rdv)

                const result = await handler.handle(unJob(evenement))

                expect(result.resultat).to.deep.equal({
                  traitement: Traitement.RENDEZ_VOUS_AJOUTE,
                  idJeune: jeune.id,
                  idObjet: rdv.id
                })
                expect(
                  rendezVousRepository.save
                ).to.have.been.calledOnceWithExactly(rdv)
                expect(
                  planificateurService.planifierRappelsRendezVous
                ).to.have.been.calledOnceWithExactly(rdv)
                expect(
                  notificationService.notifierLesJeunesDuRdv
                ).to.have.been.calledOnceWithExactly(
                  rdv,
                  Notification.Type.NEW_RENDEZVOUS
                )
              })
            })
          })
        })

        describe('UPDATE', () => {
          const evenement = unEvenementMilo({
            idPartenaireBeneficiaire,
            objet: EvenementMilo.ObjetEvenement.RENDEZ_VOUS,
            action: EvenementMilo.ActionEvenement.UPDATE
          })

          it("ne fait rien quand le RDV MILO n'existe pas", async () => {
            miloRendezVousRepository.findRendezVousByEvenement
              .withArgs(evenement)
              .resolves(undefined)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.TRAITEMENT_UPDATE_INCONNU,
              idJeune: jeune.id,
              idObjet: undefined
            })
            expect(rendezVousRepository.save).not.to.have.been.called()
          })

          describe("quand le RDV CEJ n'existe pas encore", () => {
            STATUTS_ACTIFS_RDV.forEach(statut => {
              it(`crée le RDV CEJ quand statut ${statut}`, async () => {
                const rendezVousMilo = unRendezVousMilo({ statut })
                miloRendezVousRepository.findRendezVousByEvenement
                  .withArgs(evenement)
                  .resolves(rendezVousMilo)
                const rdv = unRendezVous()
                rendezVousMiloFactory.createRendezVousCEJ
                  .withArgs(rendezVousMilo, jeune)
                  .returns(rdv)

                const result = await handler.handle(unJob(evenement))

                expect(result.resultat).to.deep.equal({
                  traitement: Traitement.RENDEZ_VOUS_AJOUTE,
                  idJeune: jeune.id,
                  idObjet: rdv.id
                })
                expect(
                  rendezVousRepository.save
                ).to.have.been.calledOnceWithExactly(rdv)
              })
            })
          })

          describe('quand le RDV CEJ existe', () => {
            let rdvCEJ: RendezVous

            beforeEach(() => {
              rdvCEJ = unRendezVous()
              rendezVousRepository.getByIdPartenaire
                .withArgs(evenement.idObjet, evenement.objet)
                .returns(rdvCEJ)
            })

            it('supprime le RDV CEJ et notifie quand la date est trop ancienne', async () => {
              miloRendezVousRepository.findRendezVousByEvenement
                .withArgs(evenement)
                .resolves(
                  unRendezVousMilo({
                    dateHeureDebut: maintenant
                      .minus({ year: 1, days: 1 })
                      .toISO()
                  })
                )

              const result = await handler.handle(unJob(evenement))

              expect(result.resultat).to.deep.equal({
                traitement: Traitement.RENDEZ_VOUS_SUPPRIME,
                idJeune: jeune.id,
                idObjet: rdvCEJ.id
              })
              expect(
                rendezVousRepository.delete
              ).to.have.been.calledOnceWithExactly(rdvCEJ.id)
              expect(rendezVousRepository.save).not.to.have.been.called()
              expect(
                planificateurService.supprimerRappelsParId
              ).to.have.been.calledOnceWithExactly(rdvCEJ.id)
              expect(
                notificationService.notifierLesJeunesDuRdv
              ).to.have.been.calledOnceWithExactly(
                rdvCEJ,
                Notification.Type.DELETED_RENDEZVOUS
              )
            })

            STATUTS_ANNULATION_RDV.forEach(statut => {
              it(`marque comme annulé, supprime les rappels et notifie quand statut ${statut}`, async () => {
                const rendezVousMilo = unRendezVousMilo({ statut })
                miloRendezVousRepository.findRendezVousByEvenement
                  .withArgs(evenement)
                  .resolves(rendezVousMilo)
                const rdvAnnule = unRendezVous({ annule: true })
                rendezVousMiloFactory.updateRendezVousCEJ
                  .withArgs(rdvCEJ, rendezVousMilo)
                  .returns(rdvAnnule)

                const result = await handler.handle(unJob(evenement))

                expect(result.resultat).to.deep.equal({
                  traitement: Traitement.RENDEZ_VOUS_ANNULE,
                  idJeune: jeune.id,
                  idObjet: rdvCEJ.id
                })
                expect(
                  rendezVousRepository.save
                ).to.have.been.calledOnceWithExactly(rdvAnnule)
                expect(
                  planificateurService.supprimerRappelsParId
                ).to.have.been.calledOnceWithExactly(rdvAnnule.id)
                expect(
                  notificationService.notifierLesJeunesDuRdv
                ).to.have.been.calledOnceWithExactly(
                  rdvAnnule,
                  Notification.Type.CANCELED_RENDEZVOUS
                )
              })
            })

            STATUTS_ACTIFS_RDV.forEach(statut => {
              it(`met à jour, replanifie et notifie quand statut ${statut}`, async () => {
                const rendezVousMilo = unRendezVousMilo({ statut })
                miloRendezVousRepository.findRendezVousByEvenement
                  .withArgs(evenement)
                  .resolves(rendezVousMilo)
                const rdvMisAJour = unRendezVous({
                  titre: 'mis à jour',
                  date: maintenant.plus({ days: 4 }).toJSDate()
                })
                rendezVousMiloFactory.updateRendezVousCEJ
                  .withArgs(rdvCEJ, rendezVousMilo)
                  .returns(rdvMisAJour)

                const result = await handler.handle(unJob(evenement))

                expect(result.resultat).to.deep.equal({
                  traitement: Traitement.RENDEZ_VOUS_MODIFIE,
                  idJeune: jeune.id,
                  idObjet: rdvCEJ.id
                })
                expect(
                  rendezVousRepository.save
                ).to.have.been.calledOnceWithExactly(rdvMisAJour)
                expect(
                  planificateurService.supprimerRappelsParId
                ).to.have.been.calledOnceWithExactly(rdvMisAJour.id)
                expect(
                  planificateurService.planifierRappelsRendezVous
                ).to.have.been.calledOnceWithExactly(rdvMisAJour)
                expect(
                  notificationService.notifierLesJeunesDuRdv
                ).to.have.been.calledOnceWithExactly(
                  rdvMisAJour,
                  Notification.Type.UPDATED_RENDEZVOUS
                )
              })
            })
          })

          describe("quand le RDV CEJ existant n'a plus de jeune associé (orphelin)", () => {
            let rdvCEJOrphelin: RendezVous

            beforeEach(() => {
              rdvCEJOrphelin = unRendezVous({ jeunes: [] })
              rendezVousRepository.getByIdPartenaire
                .withArgs(evenement.idObjet, evenement.objet)
                .returns(rdvCEJOrphelin)
            })

            STATUTS_ACTIFS_RDV.forEach(statut => {
              it(`supprime l'orphelin et recrée le RDV CEJ pour le jeune actuel quand statut ${statut}`, async () => {
                const rendezVousMilo = unRendezVousMilo({ statut })
                miloRendezVousRepository.findRendezVousByEvenement
                  .withArgs(evenement)
                  .resolves(rendezVousMilo)
                const rdvRecree = unRendezVous()
                rendezVousMiloFactory.createRendezVousCEJ
                  .withArgs(rendezVousMilo, jeune)
                  .returns(rdvRecree)

                const result = await handler.handle(unJob(evenement))

                expect(result.resultat).to.deep.equal({
                  traitement: Traitement.RENDEZ_VOUS_AJOUTE,
                  idJeune: jeune.id,
                  idObjet: rdvRecree.id
                })
                expect(
                  rendezVousRepository.delete
                ).to.have.been.calledOnceWithExactly(rdvCEJOrphelin.id)
                expect(
                  rendezVousRepository.save
                ).to.have.been.calledOnceWithExactly(rdvRecree)
                expect(
                  rendezVousMiloFactory.updateRendezVousCEJ
                ).not.to.have.been.called()
                expect(
                  planificateurService.planifierRappelsRendezVous
                ).to.have.been.calledOnceWithExactly(rdvRecree)
                expect(
                  notificationService.notifierLesJeunesDuRdv
                ).to.have.been.calledOnceWithExactly(
                  rdvRecree,
                  Notification.Type.NEW_RENDEZVOUS
                )
              })
            })
          })
        })

        describe('DELETE', () => {
          const evenement = unEvenementMilo({
            idPartenaireBeneficiaire,
            objet: EvenementMilo.ObjetEvenement.RENDEZ_VOUS,
            action: EvenementMilo.ActionEvenement.DELETE
          })

          it("ne fait rien quand le RDV CEJ n'existe pas", async () => {
            miloRendezVousRepository.findRendezVousByEvenement
              .withArgs(evenement)
              .resolves(undefined)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.TRAITEMENT_DELETE_INCONNU,
              idJeune: jeune.id,
              idObjet: undefined
            })
            expect(rendezVousRepository.delete).not.to.have.been.called()
          })

          describe('quand le RDV CEJ existe', () => {
            it('supprime le RDV CEJ et notifie', async () => {
              const rdvCEJ = unRendezVous()
              rendezVousRepository.getByIdPartenaire
                .withArgs(evenement.idObjet, evenement.objet)
                .returns(rdvCEJ)
              miloRendezVousRepository.findRendezVousByEvenement
                .withArgs(evenement)
                .resolves(unRendezVousMilo())

              const result = await handler.handle(unJob(evenement))

              expect(result.resultat).to.deep.equal({
                traitement: Traitement.RENDEZ_VOUS_SUPPRIME,
                idJeune: jeune.id,
                idObjet: rdvCEJ.id
              })
              expect(
                rendezVousRepository.delete
              ).to.have.been.calledOnceWithExactly(rdvCEJ.id)
              expect(
                planificateurService.supprimerRappelsParId
              ).to.have.been.calledOnceWithExactly(rdvCEJ.id)
              expect(
                notificationService.notifierLesJeunesDuRdv
              ).to.have.been.calledOnceWithExactly(
                rdvCEJ,
                Notification.Type.DELETED_RENDEZVOUS
              )
            })
          })
        })
      })

      describe('SESSION', () => {
        describe('CREATE', () => {
          const evenement = unEvenementMilo({
            idPartenaireBeneficiaire,
            objet: EvenementMilo.ObjetEvenement.SESSION,
            action: EvenementMilo.ActionEvenement.CREATE
          })

          it("ne fait rien quand la session n'existe pas", async () => {
            sessionMiloRepository.findInstanceSession
              .withArgs(evenement.idObjet, evenement.idPartenaireBeneficiaire)
              .resolves(undefined)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.TRAITEMENT_CREATE_INCONNU,
              idJeune: jeune.id,
              idObjet: undefined
            })
          })

          it('ne fait rien quand la date de la session est trop ancienne', async () => {
            sessionMiloRepository.findInstanceSession
              .withArgs(evenement.idObjet, evenement.idPartenaireBeneficiaire)
              .resolves(
                uneInstanceSessionMilo({
                  statut: SessionMilo.StatutInstance.PRESCRIT,
                  dateHeureDebut: maintenant.minus({ year: 1, days: 1 }).toISO()
                })
              )

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.TRAITEMENT_CREATE_INCONNU,
              idJeune: jeune.id,
              idObjet: undefined
            })
            expect(
              notificationService.notifierInscriptionSession
            ).not.to.have.been.called()
          })
          ;[
            SessionMilo.StatutInstance.REFUS_JEUNE,
            SessionMilo.StatutInstance.REFUS_TIERS
          ].forEach(statut => {
            it(`ne fait rien quand le statut est ${statut}`, async () => {
              sessionMiloRepository.findInstanceSession
                .withArgs(evenement.idObjet, evenement.idPartenaireBeneficiaire)
                .resolves(uneInstanceSessionMilo({ statut }))

              const result = await handler.handle(unJob(evenement))

              expect(result.resultat).to.deep.equal({
                traitement: Traitement.TRAITEMENT_CREATE_INCONNU,
                idJeune: jeune.id,
                idObjet: undefined
              })
              expect(
                notificationService.notifierInscriptionSession
              ).not.to.have.been.called()
            })
          })

          it('notifie inscription et planifie rappel quand statut Prescrit et session future', async () => {
            const instance = uneInstanceSessionMilo({
              statut: SessionMilo.StatutInstance.PRESCRIT
            })
            sessionMiloRepository.findInstanceSession
              .withArgs(evenement.idObjet, evenement.idPartenaireBeneficiaire)
              .resolves(instance)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.NOTIFICATION_INSTANCE_SESSION_AJOUT,
              idJeune: jeune.id,
              idObjet: instance.id
            })
            expect(
              notificationService.notifierInscriptionSession
            ).to.have.been.calledOnceWithExactly(
              instance.idSession,
              instance.nom,
              instance.dateHeureDebut,
              [jeune]
            )
            expect(
              planificateurService.planifierRappelsInstanceSessionMilo
            ).to.have.been.calledOnceWithExactly({
              idInstance: instance.id,
              idDossier: instance.idDossier,
              idSession: instance.idSession,
              dateDebut: RendezVousMilo.timezonerDateMilo(
                instance.dateHeureDebut,

                jeune.configuration.fuseauHoraire
              )
            })
          })

          it("n'envoie pas de notification quand statut Réalisé", async () => {
            const instance = uneInstanceSessionMilo({
              statut: SessionMilo.StatutInstance.REALISE
            })
            sessionMiloRepository.findInstanceSession
              .withArgs(evenement.idObjet, evenement.idPartenaireBeneficiaire)
              .resolves(instance)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.NOTIFICATION_INSTANCE_SESSION_AJOUT,
              idJeune: jeune.id,
              idObjet: instance.id
            })
            expect(
              notificationService.notifierInscriptionSession
            ).not.to.have.been.called()
          })
        })

        describe('UPDATE', () => {
          const evenement = unEvenementMilo({
            idPartenaireBeneficiaire,
            objet: EvenementMilo.ObjetEvenement.SESSION,
            action: EvenementMilo.ActionEvenement.UPDATE
          })

          it("ne fait rien quand la session n'existe pas", async () => {
            sessionMiloRepository.findInstanceSession
              .withArgs(evenement.idObjet, evenement.idPartenaireBeneficiaire)
              .resolves(undefined)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.TRAITEMENT_UPDATE_INCONNU,
              idJeune: jeune.id,
              idObjet: undefined
            })
          })
          ;[
            SessionMilo.StatutInstance.REFUS_JEUNE,
            SessionMilo.StatutInstance.REFUS_TIERS
          ].forEach(statut => {
            it(`notifie désinscription et supprime les rappels quand statut ${statut}`, async () => {
              const instance = uneInstanceSessionMilo({
                statut
              })
              sessionMiloRepository.findInstanceSession
                .withArgs(evenement.idObjet, evenement.idPartenaireBeneficiaire)
                .resolves(instance)

              const result = await handler.handle(unJob(evenement))

              expect(result.resultat).to.deep.equal({
                traitement:
                  Traitement.NOTIFICATION_INSTANCE_SESSION_SUPPRESSION,
                idJeune: jeune.id,
                idObjet: instance.id
              })
              expect(
                planificateurService.supprimerRappelsParId
              ).to.have.been.calledOnceWithExactly(
                `instance-session:${instance.id}`
              )
              expect(
                notificationService.notifierDesinscriptionSession
              ).to.have.been.calledOnceWithExactly(
                instance.idSession,
                instance.nom,
                instance.dateHeureDebut,
                [jeune]
              )
            })
          })

          it('notifie modification et replanifie les rappels quand statut Prescrit', async () => {
            const instance = uneInstanceSessionMilo({
              statut: SessionMilo.StatutInstance.PRESCRIT
            })
            sessionMiloRepository.findInstanceSession
              .withArgs(evenement.idObjet, evenement.idPartenaireBeneficiaire)
              .resolves(instance)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.NOTIFICATION_INSTANCE_SESSION_MODIFICATION,
              idJeune: jeune.id,
              idObjet: instance.id
            })
            expect(
              planificateurService.supprimerRappelsParId
            ).to.have.been.calledOnceWithExactly(
              `instance-session:${instance.id}`
            )
            expect(
              notificationService.notifierModificationSession
            ).to.have.been.calledOnceWithExactly(
              instance.idSession,
              instance.nom,
              instance.dateHeureDebut,
              [jeune]
            )
            expect(
              planificateurService.planifierRappelsInstanceSessionMilo
            ).to.have.been.calledOnceWithExactly({
              idInstance: instance.id,
              idDossier: instance.idDossier,
              idSession: instance.idSession,
              dateDebut: RendezVousMilo.timezonerDateMilo(
                instance.dateHeureDebut,
                jeune.configuration.fuseauHoraire
              )
            })
          })

          it("supprime les rappels mais n'envoie pas de notification quand statut Réalisé", async () => {
            const instance = uneInstanceSessionMilo({
              statut: SessionMilo.StatutInstance.REALISE
            })
            sessionMiloRepository.findInstanceSession
              .withArgs(evenement.idObjet, evenement.idPartenaireBeneficiaire)
              .resolves(instance)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.NOTIFICATION_INSTANCE_SESSION_MODIFICATION,
              idJeune: jeune.id,
              idObjet: instance.id
            })
            expect(
              planificateurService.supprimerRappelsParId
            ).to.have.been.calledOnceWithExactly(
              `instance-session:${instance.id}`
            )
            expect(
              notificationService.notifierModificationSession
            ).not.to.have.been.called()
          })
        })

        describe('DELETE', () => {
          const evenement = unEvenementMilo({
            idPartenaireBeneficiaire,
            objet: EvenementMilo.ObjetEvenement.SESSION,
            action: EvenementMilo.ActionEvenement.DELETE
          })

          it('supprime toujours les rappels', async () => {
            sessionMiloRepository.findInstanceSession.resolves(undefined)

            await handler.handle(unJob(evenement))

            expect(
              planificateurService.supprimerRappelsParId
            ).to.have.been.calledOnceWithExactly(
              `instance-session:${evenement.idObjet}`
            )
          })

          it("ne notifie pas quand la session n'existe pas", async () => {
            sessionMiloRepository.findInstanceSession.resolves(undefined)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.TRAITEMENT_DELETE_INCONNU,
              idJeune: jeune.id,
              idObjet: undefined
            })
            expect(
              notificationService.notifierDesinscriptionSession
            ).not.to.have.been.called()
          })

          it('notifie désinscription quand la session existe', async () => {
            const instance = uneInstanceSessionMilo()
            sessionMiloRepository.findInstanceSession
              .withArgs(evenement.idObjet, evenement.idPartenaireBeneficiaire)
              .resolves(instance)

            const result = await handler.handle(unJob(evenement))

            expect(result.resultat).to.deep.equal({
              traitement: Traitement.NOTIFICATION_INSTANCE_SESSION_SUPPRESSION,
              idJeune: jeune.id,
              idObjet: instance.id
            })
            expect(
              notificationService.notifierDesinscriptionSession
            ).to.have.been.calledOnceWithExactly(
              instance.idSession,
              instance.nom,
              instance.dateHeureDebut,
              [jeune]
            )
          })
        })
      })
    })
  })
})
