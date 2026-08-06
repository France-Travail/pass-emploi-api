import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import {
  isFailure,
  failure,
  Result,
  success
} from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { Profil } from '../../../domain/profil'
import { estMilo } from '../../../domain/core'
import { Evenement, EvenementService } from '../../../domain/evenement'
import {
  ActualiteMilo,
  ActualiteMiloRepositoryToken
} from '../../../domain/milo/actualite.milo'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import {
  ConseillerMilo,
  ConseillerMiloRepositoryToken
} from '../../../domain/milo/conseiller.milo.db'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  Planificateur,
  PlanificateurRepositoryToken
} from '../../../domain/planificateur'
import { DateService } from '../../../utils/date-service'
import { ActualiteMiloConseillerQueryModel } from '../../queries/query-models/actualites-milo.query-model'

export interface CreateActualiteMiloCommand extends Command {
  idConseiller: string
  prenomNomConseiller: string
  titre: string
  contenu: string
  titreLien?: string
  lien?: string
}

@Injectable()
export class CreateActualiteMiloCommandHandler extends CommandHandler<
  CreateActualiteMiloCommand,
  ActualiteMiloConseillerQueryModel
> {
  readonly profilsAutorises = [Profil.CONSEILLER]

  constructor(
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    @Inject(ActualiteMiloRepositoryToken)
    private readonly actualiteMiloRepository: ActualiteMilo.Repository,
    private readonly actualiteMiloFactory: ActualiteMilo.Factory,
    private readonly evenementService: EvenementService,
    @Inject(ConseillerMiloRepositoryToken)
    private readonly conseillerMiloRepository: ConseillerMilo.Repository,
    @Inject(PlanificateurRepositoryToken)
    private readonly planificateurRepository: Planificateur.Repository,
    private readonly dateService: DateService
  ) {
    super('CreateActualiteMiloCommandHandler')
  }

  async authorize(
    command: CreateActualiteMiloCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.conseillerAuthorizer.autoriserLeConseiller(
      command.idConseiller,
      utilisateur,
      estMilo(utilisateur.structure)
    )
  }

  async handle(
    command: CreateActualiteMiloCommand
  ): Promise<Result<ActualiteMiloConseillerQueryModel>> {
    const resultConseiller = await this.conseillerMiloRepository.get(
      command.idConseiller
    )
    if (isFailure(resultConseiller)) {
      return failure(new NonTrouveError('Conseiller', command.idConseiller))
    }

    const conseiller = resultConseiller.data

    const actualite = this.actualiteMiloFactory.creer({
      idStructureMilo: conseiller.structure.id,
      idConseiller: command.idConseiller,
      prenomNomConseiller: command.prenomNomConseiller,
      titre: command.titre,
      contenu: command.contenu,
      titreLien: command.titreLien,
      lien: command.lien
    })

    await this.actualiteMiloRepository.save(actualite)

    await this.planificateurRepository.ajouterJob<Planificateur.JobNotifierNouvelleActualiteMilo>(
      {
        dateExecution: this.dateService.nowJs(),
        type: Planificateur.JobType.NOTIFIER_NOUVELLE_ACTUALITE_MILO,
        contenu: {
          idStructureMilo: conseiller.structure.id,
          idActualite: actualite.id
        }
      }
    )

    return success({
      id: actualite.id,
      titre: actualite.titre,
      contenu: actualite.contenu,
      titreLien: actualite.titreLien,
      lien: actualite.lien,
      prenomNomConseiller: actualite.prenomNomConseiller,
      dateCreation: actualite.dateCreation.toISO(),
      proprietaire: true
    })
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.ACTUALITE_MILO_CREEE,
      utilisateur
    )
  }
}
