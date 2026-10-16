import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Command } from '../../../building-blocks/types/command'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { NonTrouveError } from '../../../building-blocks/types/domain-error'
import {
  Result,
  emptySuccess,
  failure,
  isFailure
} from '../../../building-blocks/types/result'
import {
  ArchiveJeune,
  ArchiveJeuneRepositoryToken
} from '../../../domain/archive-jeune'
import { Authentification } from '../../../domain/authentification'
import { Evenement, EvenementService } from '../../../domain/evenement'
import { Jeune, JeuneRepositoryToken } from '../../../domain/jeune/jeune'
import { JeuneMilo } from '../../../domain/milo/jeune.milo'
import { Profil, TOUT_MILO } from '../../../domain/profil'
import { DateService } from '../../../utils/date-service'
import { ConseillerAuthorizer } from '../../authorizers/conseiller-authorizer'
import { FonctionnaliteAuthorizer } from '../../authorizers/fonctionnalite-authorizer'

export interface ChangerDispositifJeuneMiloCommand extends Command {
  idJeune: string
  dispositif: Profil.DispositifMilo
  motif: ArchiveJeune.MotifSuppression
  dateFinAccompagnement: Date
}

@Injectable()
export class ChangerDispositifJeuneMiloCommandHandler extends CommandHandler<
  ChangerDispositifJeuneMiloCommand,
  void,
  Jeune
> {
  readonly profilsAutorises = TOUT_MILO

  constructor(
    @Inject(JeuneRepositoryToken)
    private readonly jeuneRepository: Jeune.Repository,
    @Inject(ArchiveJeuneRepositoryToken)
    private readonly archiveJeuneRepository: ArchiveJeune.Repository,
    private readonly evenementService: EvenementService,
    private readonly conseillerAuthorizer: ConseillerAuthorizer,
    private readonly dateService: DateService,
    private readonly fonctionnaliteAuthorizer: FonctionnaliteAuthorizer
  ) {
    super('ChangerDispositifJeuneMiloCommandHandler')
  }

  async getAggregate(
    command: ChangerDispositifJeuneMiloCommand
  ): Promise<Jeune | undefined> {
    return this.jeuneRepository.get(command.idJeune)
  }

  async authorize(
    command: ChangerDispositifJeuneMiloCommand,
    utilisateur: Authentification.Utilisateur,
    jeune: Jeune | undefined
  ): Promise<Result> {
    if (!jeune) {
      return failure(new NonTrouveError('Jeune', command.idJeune))
    }
    const resultConseiller =
      await this.conseillerAuthorizer.autoriserConseillerPourSonJeune(
        command.idJeune,
        utilisateur
      )
    if (isFailure(resultConseiller)) return resultConseiller

    return this.fonctionnaliteAuthorizer.autoriserLeDispositifPourLeConseiller(
      utilisateur.id,
      command.dispositif
    )
  }

  async handle(
    command: ChangerDispositifJeuneMiloCommand,
    _utilisateur: Authentification.Utilisateur,
    jeune: Jeune
  ): Promise<Result> {
    const resultJeuneMisAJour = JeuneMilo.changerDeDispositif(
      jeune,
      command.dispositif,
      DateTime.fromJSDate(command.dateFinAccompagnement)
    )
    if (isFailure(resultJeuneMisAJour)) return resultJeuneMisAJour

    if (jeune.isActivated) {
      const metadonnees: ArchiveJeune.Metadonnees = {
        idJeune: jeune.id,
        email: jeune.email,
        prenomJeune: jeune.firstName,
        nomJeune: jeune.lastName,
        structure: jeune.structure,
        dispositif: jeune.dispositif ?? undefined,
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

    await this.jeuneRepository.save(resultJeuneMisAJour.data)

    return emptySuccess()
  }

  async monitor(
    utilisateur: Authentification.Utilisateur,
    _command: ChangerDispositifJeuneMiloCommand,
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

  protected labelsDuLog(
    _result: Result,
    command?: ChangerDispositifJeuneMiloCommand,
    jeune?: Jeune
  ): Record<string, string> | undefined {
    if (!command) return undefined

    return {
      ...(jeune?.dispositif ? { dispositif_depart: jeune.dispositif } : {}),
      dispositif_arrivee: command.dispositif,
      motif_fin_accompagnement: command.motif
    }
  }
}
