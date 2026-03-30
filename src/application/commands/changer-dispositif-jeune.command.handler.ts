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

export interface ChangerDispositifJeuneCommand extends Command {
  idJeune: string
  dispositif: Jeune.Dispositif.CEJ | Jeune.Dispositif.PACEA
  motif: ArchiveJeune.MotifSuppression
  commentaire?: string
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
        commentaire: command.commentaire,
        dateArchivage: this.dateService.nowJs()
      }
      const resultArchive =
        await this.archiveJeuneRepository.archiverSansDonnees(metadonnees)
      if (isFailure(resultArchive)) return resultArchive
    }

    const maintenant = this.dateService.now()
    const jeuneMisAJour = Jeune.reinitialiserPourChangementDispositif(
      jeune,
      command.dispositif,
      maintenant
    )
    await this.jeuneRepository.save(jeuneMisAJour)
    await this.jeuneRepository.reinitialiserDatePremiereConnexion(jeune.id)

    return emptySuccess()
  }

  async monitor(
    utilisateur: Authentification.Utilisateur,
    _command: ChangerDispositifJeuneCommand,
    jeune: Jeune
  ): Promise<void> {
    if (jeune.isActivated) {
      await this.evenementService.creer(
        Evenement.Code.COMPTE_ARCHIVE,
        utilisateur
      )
    }
    await this.evenementService.creer(Evenement.Code.COMPTE_CREE, utilisateur)
  }
}
