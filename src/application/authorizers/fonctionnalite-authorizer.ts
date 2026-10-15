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
import { Profil } from '../../domain/profil'
import { DateService } from '../../utils/date-service'

@Injectable()
export class FonctionnaliteAuthorizer {
  constructor(
    @Inject(FonctionnaliteRepositoryToken)
    private readonly fonctionnaliteRepository: Fonctionnalite.Repository,
    private readonly dateService: DateService
  ) {}

  async autoriserLeDispositifPourLeConseiller(
    idConseiller: string,
    dispositif: Profil.Dispositif | undefined
  ): Promise<Result> {
    if (dispositif !== Profil.Dispositif.AUTRE) return emptySuccess()

    const fonctionnalitesActives =
      await this.fonctionnaliteRepository.getIdsFonctionnalitesActivesDuConseiller(
        idConseiller,
        this.dateService.now()
      )
    if (fonctionnalitesActives.includes(Fonctionnalite.Id.DISPOSITIF_AUTRE)) {
      return emptySuccess()
    }
    return failure(new DroitsInsuffisants())
  }
}
