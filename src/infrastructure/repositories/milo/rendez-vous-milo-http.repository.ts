import { Injectable } from '@nestjs/common'
import { isFailure } from '../../../building-blocks/types/result'
import { EvenementMilo } from '../../../domain/milo/evenement.milo'
import { RendezVousMilo } from '../../../domain/milo/rendez-vous.milo'
import { MiloClient } from '../../clients/milo/milo-client'

@Injectable()
export class RendezVousMiloHttpRepository implements RendezVousMilo.Repository {
  constructor(private readonly miloClient: MiloClient) {}

  async findRendezVousByEvenement(
    evenement: EvenementMilo
  ): Promise<RendezVousMilo | undefined> {
    if (evenement.objet !== EvenementMilo.ObjetEvenement.RENDEZ_VOUS) {
      return undefined
    }
    if (!evenement.idObjet) {
      return undefined
    }

    const result = await this.miloClient.getRendezVous(
      evenement.idPartenaireBeneficiaire,
      evenement.idObjet
    )
    if (isFailure(result)) {
      return undefined
    }

    return {
      id: result.data.id.toString(),
      dateHeureDebut: result.data.dateHeureDebut,
      dateHeureFin: result.data.dateHeureFin,
      titre: result.data.objet,
      idPartenaireBeneficiaire: result.data.idDossier.toString(),
      commentaire: result.data.commentaire,
      adresse: result.data.lieu,
      statut: result.data.statut as RendezVousMilo.Statut
    }
  }
}
