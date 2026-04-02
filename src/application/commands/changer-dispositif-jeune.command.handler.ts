import { Inject, Injectable } from '@nestjs/common'
import { Command } from '../../building-blocks/types/command'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import {
  Result,
  emptySuccess,
  failure,
  isFailure
} from '../../building-blocks/types/result'
import {
  ArchiveJeune,
  ArchiveJeuneRepositoryToken
} from '../../domain/archive-jeune'
import { Authentification } from '../../domain/authentification'
import { Evenement, EvenementService } from '../../domain/evenement'
import { Jeune, JeuneRepositoryToken } from '../../domain/jeune/jeune'
import { DateService } from '../../utils/date-service'
import { ConseillerAuthorizer } from '../authorizers/conseiller-authorizer'
import { DateTime } from 'luxon'

export interface ChangerDispositifJeuneCommand extends Command {
  idJeune: string
  dispositif: Jeune.Dispositif.CEJ | Jeune.Dispositif.PACEA
  motif: ArchiveJeune.MotifSuppression
  dateFinAccompagnement: Date
}

@Injectable()
export class ChangerDispositifJeuneCommandHandler extends CommandHandler<
  ChangerDispositifJeuneCommand,
  void,
  Jeune
> {
  constructor(
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    @Inject(ArchiveJeuneRepositoryToken)
    private readonly archiveJeuneRepository: ArchiveJeune.Repository,
    private readonly evenementService: EvenementService,
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    private readonly dateService: DateService
  ) {
    super('ChangerDispositifJeuneCommandHandler')
  }

  async getAggregate(
    command: ChangerDispositifJeuneCommand
  ): Promise<Jeune | undefined> {
    return this.jeuneRepository.get(command.idJeune)
  }

  async authorize(
    command: ChangerDispositifJeuneCommand,
    utilisateur: Authentification.Utilisateur,
    jeune: Jeune | undefined
  ): Promise<Result> {
    if (!jeune) {
      return failure(new NonTrouveError('Jeune', command.idJeune))
    }
    return this.conseillerAuthorizer.autoriserConseillerPourSonJeune(
      command.idJeune,
      utilisateur
    )
  }

  async handle(
    command: ChangerDispositifJeuneCommand,
    _utilisateur: Authentification.Utilisateur,
    jeune: Jeune
  ): Promise<Result> {
    if (jeune.isActivated) {
      const metadonnees: ArchiveJeune.Metadonnees = {
        idJeune: jeune.id,
        email: jeune.email,
        prenomJeune: jeune.firstName,
        nomJeune: jeune.lastName,
        structure: jeune.structure,
        dispositif: jeune.dispositif,
        idPartenaire: jeune.idPartenaire,
        dateCreation: jeune.creationDate.toJSDate(),
        datePremiereConnexion: jeune.datePremiereConnexion?.toJSDate(),
        motif: command.motif,
        dateArchivage: this.dateService.nowJs(),
        dateFinAccompagnement: command.dateFinAccompagnement
      }
      const resultArchive =
        await this.archiveJeuneRepository.archiverSansDonnees(metadonnees)
      if (isFailure(resultArchive)) return resultArchive
    }

    const jeuneMisAJour = Jeune.reinitialiserPourChangementDispositif(
      jeune,
      command.dispositif,
      DateTime.fromJSDate(command.dateFinAccompagnement)
    )
    await this.jeuneRepository.save(jeuneMisAJour)

    return emptySuccess()
  }

  async monitor(
    utilisateur: Authentification.Utilisateur,
    _command: ChangerDispositifJeuneCommand,
    jeune: Jeune
  ): Promise<void> {
    const evenements = [
      this.evenementService.creer(Evenement.Code.COMPTE_CREE, utilisateur)
    ]
    if (jeune.isActivated) {
      evenements.push(
        this.evenementService.creer(Evenement.Code.COMPTE_ARCHIVE, utilisateur)
      )
    }
    await Promise.all(evenements)
  }
}
