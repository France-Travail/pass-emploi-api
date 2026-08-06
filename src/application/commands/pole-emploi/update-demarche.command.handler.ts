import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { CommandHandler } from '../../../building-blocks/types/command-handler'
import { Command } from '../../../building-blocks/types/command'
import { Result, isFailure } from '../../../building-blocks/types/result'
import { Authentification } from '../../../domain/authentification'
import { Demarche, DemarcheRepositoryToken } from '../../../domain/demarche'
import { Profil } from '../../../domain/profil'
import { Evenement, EvenementService } from '../../../domain/evenement'
import { JeuneAuthorizer } from '../../authorizers/jeune-authorizer'

export interface UpdateStatutDemarcheCommand extends Command {
  idJeune: string
  accessToken: string
  idDemarche: string
  dateDebut?: DateTime
  dateFin: DateTime
  statut: Demarche.Statut
}

@Injectable()
export class UpdateStatutDemarcheCommandHandler extends CommandHandler<
  UpdateStatutDemarcheCommand,
  Demarche
> {
  readonly profilsAutorises = [
    Profil.Jeune.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
    Profil.Jeune.FT_DEMANDEUR_EMPLOI,
    Profil.Jeune.CONSEIL_DEPT
  ]

  constructor(
    private jeuneAuthorizer: JeuneAuthorizer,
    private evenementService: EvenementService,
    private demarcheFactory: Demarche.Factory,
    @Inject(DemarcheRepositoryToken)
    private demarcheRepository: Demarche.Repository
  ) {
    super('UpdateStatutDemarcheCommandHandler')
  }

  async authorize(
    command: UpdateStatutDemarcheCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(command.idJeune, utilisateur)
  }

  async handle(
    command: UpdateStatutDemarcheCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result<Demarche>> {
    const result = this.demarcheFactory.mettreAJourLeStatut(
      command.idDemarche,
      command.statut,
      command.dateFin,
      command.dateDebut
    )

    if (isFailure(result)) {
      return result
    }

    return this.demarcheRepository.update(
      result.data,
      command.accessToken,
      utilisateur.structure
    )
  }

  async monitor(utilisateur: Authentification.Utilisateur): Promise<void> {
    await this.evenementService.creer(
      Evenement.Code.ACTION_STATUT_MODIFIE,
      utilisateur
    )
  }
}
