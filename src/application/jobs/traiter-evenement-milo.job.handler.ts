import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { isFailure } from '../../building-blocks/types/result'
import { Jeune } from '../../domain/jeune/jeune'
import { EvenementMilo } from '../../domain/milo/evenement.milo'
import {
  JeuneMilo,
  JeuneMiloRepositoryToken
} from '../../domain/milo/jeune.milo'
import {
  RendezVousMilo,
  RendezVousMiloRepositoryToken
} from '../../domain/milo/rendez-vous.milo'
import {
  InstanceSessionMilo,
  SessionMilo,
  SessionMiloRepositoryToken
} from '../../domain/milo/session.milo'
import { Notification } from '../../domain/notification/notification'
import {
  Planificateur,
  PlanificateurService,
  planifierLesRappelsDeRendezVous,
  planifierRappelsInstanceSessionMilo,
  ProcessJobType,
  replanifierLesRappelsDeRendezVous,
  supprimerLesRappelsDeRendezVous,
  supprimerRappelsInstanceSessionMilo
} from '../../domain/planificateur'
import {
  RendezVous,
  RendezVousRepositoryToken
} from '../../domain/rendez-vous/rendez-vous'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'

@Injectable()
@ProcessJobType(Planificateur.JobType.TRAITER_EVENEMENT_MILO)
export class TraiterEvenementMiloJobHandler extends JobHandler<Planificateur.JobTraiterEvenementMilo> {
  constructor(
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    @Inject(JeuneMiloRepositoryToken)
    private readonly jeuneRepository: JeuneMilo.Repository,
    @Inject(RendezVousRepositoryToken)
    private readonly rendezVousRepository: RendezVous.Repository,
    @Inject(SessionMiloRepositoryToken)
    private readonly sessionMiloRepository: SessionMilo.Repository,
    @Inject(RendezVousMiloRepositoryToken)
    private readonly rendezVousMiloRepository: RendezVousMilo.Repository,
    private readonly rendezVousMiloFactory: RendezVousMilo.Factory,
    private readonly notificationService: Notification.Service,
    private readonly planificateurService: PlanificateurService,
    private readonly configuration: ConfigService
  ) {
    super(Planificateur.JobType.TRAITER_EVENEMENT_MILO, suiviJobService)
  }

  async handle(
    job: Planificateur.Job<Planificateur.JobTraiterEvenementMilo>
  ): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const notifierRdvMilo = this.configuration.get(
      'features.notifierRendezVousMilo'
    )

    const evenement: EvenementMilo = job.contenu!

    if (evenement.action === EvenementMilo.ActionEvenement.NON_TRAITABLE) {
      return this.buildSuiviJob(
        maintenant,
        Traitement.TYPE_EVENEMENT_NON_TRAITABLE
      )
    }
    if (evenement.objet === EvenementMilo.ObjetEvenement.NON_TRAITABLE) {
      return this.buildSuiviJob(
        maintenant,
        Traitement.OBJET_EVENEMENT_NON_TRAITABLE
      )
    }
    if (!evenement.idObjet) {
      return this.buildSuiviJob(maintenant, Traitement.ID_OBJET_VIDE)
    }

    const resultJeune = await this.jeuneRepository.getByIdDossier(
      evenement.idPartenaireBeneficiaire
    )
    if (isFailure(resultJeune)) {
      return this.buildSuiviJob(maintenant, Traitement.JEUNE_INEXISTANT)
    }

    switch (evenement.objet) {
      case EvenementMilo.ObjetEvenement.RENDEZ_VOUS: {
        const rendezVousMILO =
          await this.rendezVousMiloRepository.findRendezVousByEvenement(
            evenement
          )
        const rendezVousCEJExistant =
          await this.rendezVousRepository.getByIdPartenaire(
            evenement.idObjet,
            evenement.objet
          )

        switch (evenement.action) {
          case EvenementMilo.ActionEvenement.CREATE:
            return this.handleCreateRDV(
              resultJeune.data,
              maintenant,
              rendezVousMILO,
              notifierRdvMilo
            )
          case EvenementMilo.ActionEvenement.UPDATE:
            return this.handleUpdateRDV(
              resultJeune.data,
              maintenant,
              rendezVousMILO,
              rendezVousCEJExistant,
              notifierRdvMilo
            )
          case EvenementMilo.ActionEvenement.DELETE:
            return this.handleDeleteRDV(
              resultJeune.data,
              maintenant,
              rendezVousCEJExistant,
              notifierRdvMilo
            )
        }
      }
      case EvenementMilo.ObjetEvenement.SESSION: {
        const instanceSessionMilo =
          await this.sessionMiloRepository.findInstanceSession(
            evenement.idObjet,
            evenement.idPartenaireBeneficiaire
          )
        switch (evenement.action) {
          case EvenementMilo.ActionEvenement.CREATE:
            return this.handleCreateInstanceSession(
              resultJeune.data,
              maintenant,
              instanceSessionMilo,
              notifierRdvMilo
            )
          case EvenementMilo.ActionEvenement.UPDATE:
            return this.handleUpdateInstanceSession(
              resultJeune.data,
              maintenant,
              instanceSessionMilo,
              notifierRdvMilo
            )
          case EvenementMilo.ActionEvenement.DELETE:
            return this.handleDeleteInstanceSession(
              resultJeune.data,
              maintenant,
              evenement.idObjet,
              instanceSessionMilo,
              notifierRdvMilo
            )
        }
      }
    }
  }

  private async handleCreateRDV(
    jeune: JeuneMilo,
    maintenant: DateTime,
    rendezVousMilo?: RendezVousMilo,
    notifierRdvMilo?: boolean
  ): Promise<SuiviJob> {
    const nouveauRdvNonTraitable =
      !rendezVousMilo ||
      this.dateNonRecuperable(rendezVousMilo, jeune) ||
      RendezVousMilo.estAnnule(rendezVousMilo)

    if (nouveauRdvNonTraitable) {
      return this.buildSuiviJob(
        maintenant,
        Traitement.TRAITEMENT_CREATE_INCONNU,
        jeune.id
      )
    }

    const newRendezVousCEJ = this.rendezVousMiloFactory.createRendezVousCEJ(
      rendezVousMilo,
      jeune
    )
    await this.rendezVousRepository.save(newRendezVousCEJ)

    planifierLesRappelsDeRendezVous(
      newRendezVousCEJ,
      this.planificateurService,
      this.logger,
      this.apmService
    )

    this.notifierRDV(
      newRendezVousCEJ,
      maintenant,
      Notification.Type.NEW_RENDEZVOUS,
      notifierRdvMilo
    )
    return this.buildSuiviJob(
      maintenant,
      Traitement.RENDEZ_VOUS_AJOUTE,
      jeune.id,
      newRendezVousCEJ.id
    )
  }

  private async handleUpdateRDV(
    jeune: JeuneMilo,
    maintenant: DateTime,
    rendezVousMilo?: RendezVousMilo,
    rendezVousCEJExistant?: RendezVous,
    notifierRdvMilo?: boolean
  ): Promise<SuiviJob> {
    if (!rendezVousMilo) {
      return this.buildSuiviJob(
        maintenant,
        Traitement.TRAITEMENT_UPDATE_INCONNU,
        jeune.id
      )
    }

    if (!rendezVousCEJExistant) {
      return this.handleCreateRDV(
        jeune,
        maintenant,
        rendezVousMilo,
        notifierRdvMilo
      )
    }

    if (!this.dateRecuperable(rendezVousMilo, jeune)) {
      return this.handleDeleteRDV(
        jeune,
        maintenant,
        rendezVousCEJExistant,
        notifierRdvMilo
      )
    }

    const rendezVousCEJUpdated = this.rendezVousMiloFactory.updateRendezVousCEJ(
      rendezVousCEJExistant,
      rendezVousMilo
    )
    await this.rendezVousRepository.save(rendezVousCEJUpdated)

    if (RendezVousMilo.estAnnule(rendezVousMilo)) {
      supprimerLesRappelsDeRendezVous(
        rendezVousCEJExistant.id,
        this.planificateurService,
        this.logger,
        this.apmService
      )
      this.notifierRDV(
        rendezVousCEJUpdated,
        maintenant,
        Notification.Type.CANCELED_RENDEZVOUS,
        notifierRdvMilo
      )
      return this.buildSuiviJob(
        maintenant,
        Traitement.RENDEZ_VOUS_ANNULE,
        jeune.id,
        rendezVousCEJExistant.id
      )
    }

    replanifierLesRappelsDeRendezVous(
      rendezVousCEJUpdated,
      rendezVousCEJExistant,
      this.planificateurService,
      this.logger,
      this.apmService
    )
    this.notifierRDV(
      rendezVousCEJUpdated,
      maintenant,
      Notification.Type.UPDATED_RENDEZVOUS,
      notifierRdvMilo
    )
    return this.buildSuiviJob(
      maintenant,
      Traitement.RENDEZ_VOUS_MODIFIE,
      jeune.id,
      rendezVousCEJExistant.id
    )
  }

  private async handleDeleteRDV(
    jeune: JeuneMilo,
    maintenant: DateTime,
    rendezVousCEJExistant?: RendezVous,
    notifierRdvMilo?: boolean
  ): Promise<SuiviJob> {
    if (!rendezVousCEJExistant) {
      return this.buildSuiviJob(
        maintenant,
        Traitement.TRAITEMENT_DELETE_INCONNU,
        jeune.id
      )
    }
    await this.rendezVousRepository.delete(rendezVousCEJExistant.id)

    supprimerLesRappelsDeRendezVous(
      rendezVousCEJExistant.id,
      this.planificateurService,
      this.logger,
      this.apmService
    )
    this.notifierRDV(
      rendezVousCEJExistant,
      maintenant,
      Notification.Type.DELETED_RENDEZVOUS,
      notifierRdvMilo
    )

    return this.buildSuiviJob(
      maintenant,
      Traitement.RENDEZ_VOUS_SUPPRIME,
      jeune.id,
      rendezVousCEJExistant.id
    )
  }

  private async handleCreateInstanceSession(
    jeune: JeuneMilo,
    maintenant: DateTime,
    instanceSessionMilo?: InstanceSessionMilo,
    notifierRdvMilo?: boolean
  ): Promise<SuiviJob> {
    if (
      instanceSessionMilo &&
      this.dateRecuperable(instanceSessionMilo, jeune) &&
      this.isStatutInstanceSessionRecuperable(instanceSessionMilo)
    ) {
      this.notifierSession(
        instanceSessionMilo,
        maintenant,
        jeune,
        'create',
        notifierRdvMilo
      )
      return this.buildSuiviJob(
        maintenant,
        Traitement.NOTIFICATION_INSTANCE_SESSION_AJOUT,
        jeune.id,
        instanceSessionMilo.id
      )
    }
    return this.buildSuiviJob(
      maintenant,
      Traitement.TRAITEMENT_CREATE_INCONNU,
      jeune.id
    )
  }

  private async handleUpdateInstanceSession(
    jeune: JeuneMilo,
    maintenant: DateTime,
    instanceSessionMilo?: InstanceSessionMilo,
    notifierRdvMilo?: boolean
  ): Promise<SuiviJob> {
    if (instanceSessionMilo) {
      if (
        !this.isStatutInstanceSessionRecuperable(instanceSessionMilo) ||
        !this.dateRecuperable(instanceSessionMilo, jeune)
      ) {
        return this.handleDeleteInstanceSession(
          jeune,
          maintenant,
          instanceSessionMilo.id,
          instanceSessionMilo,
          notifierRdvMilo
        )
      }
      supprimerRappelsInstanceSessionMilo(
        instanceSessionMilo.id,
        this.planificateurService,
        this.logger,
        this.apmService
      )
      this.notifierSession(
        instanceSessionMilo,
        maintenant,
        jeune,
        'update',
        notifierRdvMilo
      )
      return this.buildSuiviJob(
        maintenant,
        Traitement.NOTIFICATION_INSTANCE_SESSION_MODIFICATION,
        jeune.id,
        instanceSessionMilo.id
      )
    }
    return this.buildSuiviJob(
      maintenant,
      Traitement.TRAITEMENT_UPDATE_INCONNU,
      jeune.id
    )
  }

  private async handleDeleteInstanceSession(
    jeune: JeuneMilo,
    maintenant: DateTime,
    idInstanceSessionMilo: string,
    instanceSessionMilo?: InstanceSessionMilo,
    notifierRdvMilo?: boolean
  ): Promise<SuiviJob> {
    supprimerRappelsInstanceSessionMilo(
      idInstanceSessionMilo,
      this.planificateurService,
      this.logger,
      this.apmService
    )
    if (instanceSessionMilo) {
      this.notifierSession(
        instanceSessionMilo,
        maintenant,
        jeune,
        'delete',
        notifierRdvMilo
      )
      return this.buildSuiviJob(
        maintenant,
        Traitement.NOTIFICATION_INSTANCE_SESSION_SUPPRESSION,
        jeune.id,
        instanceSessionMilo.id
      )
    }

    return this.buildSuiviJob(
      maintenant,
      Traitement.TRAITEMENT_DELETE_INCONNU,
      jeune.id
    )
  }

  private notifierRDV(
    rendezVousCEJ: RendezVous,
    maintenant: DateTime,
    typeNotification: Notification.TypeRdv,
    notifierRdvMilo?: boolean
  ): void {
    if (notifierRdvMilo) {
      const estRDVFutur = DateService.isGreater(
        DateService.fromJSDateToDateTime(rendezVousCEJ.date)!,
        maintenant
      )

      if (estRDVFutur) {
        this.notificationService.notifierLesJeunesDuRdv(
          rendezVousCEJ,
          typeNotification
        )
      }
    }
  }

  private notifierSession(
    instanceSessionMilo: InstanceSessionMilo,
    maintenant: DateTime,
    jeune: JeuneMilo,
    typeNotification: 'create' | 'update' | 'delete',
    notifierRdvMilo?: boolean
  ): void {
    if (notifierRdvMilo) {
      const dateSession = RendezVousMilo.timezonerDateMilo(
        instanceSessionMilo.dateHeureDebut,
        jeune.configuration.fuseauHoraire
      )
      const dansLeFutur = DateService.isGreater(dateSession, maintenant)
      const statutNotifiable =
        typeNotification === 'delete' ||
        this.isStatutInstanceSessionNotifiable(instanceSessionMilo)

      if (dansLeFutur && statutNotifiable) {
        const rappel = {
          idInstance: instanceSessionMilo.id,
          idDossier: instanceSessionMilo.idDossier,
          idSession: instanceSessionMilo.idSession,
          dateDebut: dateSession
        }

        switch (typeNotification) {
          case 'create':
            this.notificationService.notifierInscriptionSession(
              instanceSessionMilo.idSession,
              instanceSessionMilo.nom,
              instanceSessionMilo.dateHeureDebut,
              [jeune]
            )
            planifierRappelsInstanceSessionMilo(
              rappel,
              this.planificateurService,
              this.logger,
              this.apmService
            )
            break
          case 'update':
            this.notificationService.notifierModificationSession(
              instanceSessionMilo.idSession,
              instanceSessionMilo.nom,
              instanceSessionMilo.dateHeureDebut,
              [jeune]
            )
            planifierRappelsInstanceSessionMilo(
              rappel,
              this.planificateurService,
              this.logger,
              this.apmService
            )
            break
          case 'delete':
            this.notificationService.notifierDesinscriptionSession(
              instanceSessionMilo.idSession,
              instanceSessionMilo.nom,
              instanceSessionMilo.dateHeureDebut,
              [jeune]
            )
            break
        }
      }
    }
  }

  private buildSuiviJob(
    debut: DateTime,
    traitement: Traitement,
    idJeune?: string,
    idObjet?: string
  ): SuiviJob {
    return {
      jobType: this.jobType,
      dateExecution: debut,
      resultat: {
        traitement,
        idJeune,
        idObjet
      },
      succes: true,
      nbErreurs: 0,
      tempsExecution: DateService.calculerTempsExecution(debut)
    }
  }

  private dateRecuperable(
    rendezVousOuInstanceSessionMILO: RendezVousMilo | InstanceSessionMilo,
    jeune: Jeune
  ): boolean {
    const ilYa1An = this.dateService.now().minus({ year: 1 })
    const dans2Ans = this.dateService.now().plus({ year: 2 })
    const dateRdv = RendezVousMilo.timezonerDateMilo(
      rendezVousOuInstanceSessionMILO.dateHeureDebut,
      jeune.configuration.fuseauHoraire
    )
    return (
      DateService.isGreater(dateRdv, ilYa1An) &&
      DateService.isGreater(dans2Ans, dateRdv)
    )
  }
  private dateNonRecuperable(
    rendezVousOuInstanceSessionMILO: RendezVousMilo | InstanceSessionMilo,
    jeune: Jeune
  ): boolean {
    return !this.dateRecuperable(rendezVousOuInstanceSessionMILO, jeune)
  }

  private isStatutInstanceSessionRecuperable(
    instanceSessionMilo: InstanceSessionMilo
  ): boolean {
    return ![
      SessionMilo.StatutInstance.REFUS_JEUNE,
      SessionMilo.StatutInstance.REFUS_TIERS
    ].includes(instanceSessionMilo.statut as SessionMilo.StatutInstance)
  }

  private isStatutInstanceSessionNotifiable(
    instanceSessionMilo: InstanceSessionMilo
  ): boolean {
    return [SessionMilo.StatutInstance.PRESCRIT].includes(
      instanceSessionMilo.statut as SessionMilo.StatutInstance
    )
  }
}

export enum Traitement {
  RENDEZ_VOUS_SUPPRIME = 'RENDEZ_VOUS_SUPPRIME',
  RENDEZ_VOUS_AJOUTE = 'RENDEZ_VOUS_AJOUTE',
  RENDEZ_VOUS_MODIFIE = 'RENDEZ_VOUS_MODIFIE',
  RENDEZ_VOUS_ANNULE = 'RENDEZ_VOUS_ANNULE',
  NOTIFICATION_INSTANCE_SESSION_SUPPRESSION = 'NOTIFICATION_INSTANCE_SESSION_SUPPRESSION',
  NOTIFICATION_INSTANCE_SESSION_AJOUT = 'NOTIFICATION_INSTANCE_SESSION_AJOUT',
  NOTIFICATION_INSTANCE_SESSION_MODIFICATION = 'NOTIFICATION_INSTANCE_SESSION_MODIFICATION',
  RENDEZ_VOUS_INEXISTANT = 'RENDEZ_VOUS_INEXISTANT',
  INSTANCE_SESSION_INEXISTANTE = 'INSTANCE_SESSION_INEXISTANTE',
  JEUNE_INEXISTANT = 'JEUNE_INEXISTANT',
  TYPE_EVENEMENT_NON_TRAITABLE = 'TYPE_EVENEMENT_NON_TRAITABLE',
  OBJET_EVENEMENT_NON_TRAITABLE = 'OBJET_EVENEMENT_NON_TRAITABLE',
  TRAITEMENT_CREATE_INCONNU = 'TRAITEMENT_CREATE_INCONNU',
  TRAITEMENT_UPDATE_INCONNU = 'TRAITEMENT_UPDATE_INCONNU',
  TRAITEMENT_DELETE_INCONNU = 'TRAITEMENT_DELETE_INCONNU',
  ID_OBJET_VIDE = 'ID_OBJET_VIDE'
}
