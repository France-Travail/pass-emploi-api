import { Injectable } from '@nestjs/common'
import { isFailure, Result } from '../../../building-blocks/types/result'
import { EvenementMilo } from '../../../domain/milo/evenement.milo'
import { MiloClient } from '../../clients/milo/milo-client'

@Injectable()
export class EvenementMiloHttpRepository implements EvenementMilo.Repository {
  constructor(private readonly miloClient: MiloClient) {}

  async findAllEvenements(): Promise<EvenementMilo[]> {
    const result = await this.miloClient.getEvenements()
    if (isFailure(result)) {
      return []
    }
    return result.data.map(evenement => {
      return {
        id: evenement.identifiant,
        date: evenement.date,
        action: toActionEvenement(evenement.action),
        objet: toObjetEvenement(evenement.type),
        idObjet: evenement.idType?.toString() ?? null,
        idPartenaireBeneficiaire: evenement.idDossier.toString()
      }
    })
  }

  async acquitterEvenement(evenement: EvenementMilo): Promise<Result> {
    return await this.miloClient.acquitterEvenement(evenement.id)
  }
}

function toObjetEvenement(
  typeMilo: 'RDV' | 'SESSION' | string
): EvenementMilo.ObjetEvenement {
  switch (typeMilo) {
    case 'RDV':
      return EvenementMilo.ObjetEvenement.RENDEZ_VOUS
    case 'SESSION':
      return EvenementMilo.ObjetEvenement.SESSION
    default:
      return EvenementMilo.ObjetEvenement.NON_TRAITABLE
  }
}

function toActionEvenement(
  actionMilo: 'CREATE' | 'UPDATE' | 'DELETE' | string
): EvenementMilo.ActionEvenement {
  switch (actionMilo) {
    case 'CREATE':
      return EvenementMilo.ActionEvenement.CREATE
    case 'UPDATE':
      return EvenementMilo.ActionEvenement.UPDATE
    case 'DELETE':
      return EvenementMilo.ActionEvenement.DELETE
    default:
      return EvenementMilo.ActionEvenement.NON_TRAITABLE
  }
}
