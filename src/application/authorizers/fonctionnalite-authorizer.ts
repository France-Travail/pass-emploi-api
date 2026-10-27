import { Inject, Injectable } from '@nestjs/common'
import { DroitsInsuffisants } from '../../building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  Result
} from '../../building-blocks/types/result'
import {
  Fonctionnalite,
  FonctionnaliteRepositoryToken
} from '../../domain/fonctionnalite'
import { Population, PopulationRepositoryToken } from '../../domain/population'
import { Profil } from '../../domain/profil'
import { DateService } from '../../utils/date-service'

@Injectable()
export class FonctionnaliteAuthorizer {
  constructor(
    @Inject(PopulationRepositoryToken)
    private readonly populationRepository: Population.Repository,
    @Inject(FonctionnaliteRepositoryToken)
    private readonly fonctionnaliteRepository: Fonctionnalite.Repository,
    private readonly dateService: DateService
  ) {}

  async autoriserLeDispositifPourLeConseiller(
    idConseiller: string,
    dispositif: Profil.Dispositif | undefined
  ): Promise<Result> {
    if (dispositif !== Profil.Dispositif.AUTRE) return emptySuccess()

    const idsPopulations =
      await this.populationRepository.getIdsPopulationsDuConseiller(
        idConseiller
      )
    const fonctionnalitesActives =
      await this.fonctionnaliteRepository.getIdsFonctionnalitesActives(
        idsPopulations,
        this.dateService.now()
      )
    if (fonctionnalitesActives.includes(Fonctionnalite.Id.DISPOSITIF_AUTRE)) {
      return emptySuccess()
    }
    return failure(new DroitsInsuffisants())
  }
}
