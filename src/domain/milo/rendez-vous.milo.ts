import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { IdService } from '../../utils/id-service'
import {
  CodeTypeRendezVous,
  JeuneDuRendezVous,
  RendezVous
} from '../rendez-vous/rendez-vous'
import { EvenementMilo } from './evenement.milo'
import Source = RendezVous.Source

export const RendezVousMiloRepositoryToken = 'RendezVousMiloRepositoryToken'

export interface RendezVousMilo {
  id: string
  dateHeureDebut: DateTime
  dateHeureFin?: DateTime
  titre: string
  idPartenaireBeneficiaire: string
  commentaire?: string
  modalite?: string
  adresse?: string
  statut: RendezVousMilo.Statut
}

export namespace RendezVousMilo {
  export enum Statut {
    RDV_ABSENT = 'Absent',
    RDV_ANNULE = 'Annulé',
    RDV_NON_PRECISE = 'Non précisé',
    RDV_PLANIFIE = 'Planifié',
    RDV_PRESENT = 'Présent',
    RDV_REPORTE = 'Reporté'
  }

  export interface Repository {
    findRendezVousByEvenement(
      evenement: EvenementMilo,
      timezoneStructureMilo: string
    ): Promise<RendezVousMilo | undefined>
  }

  export function estAnnule(rendezVousMilo: RendezVousMilo): boolean {
    return (
      rendezVousMilo.statut === RendezVousMilo.Statut.RDV_ANNULE ||
      rendezVousMilo.statut === RendezVousMilo.Statut.RDV_REPORTE
    )
  }

  @Injectable()
  export class Factory {
    constructor(private idService: IdService) {}

    createRendezVousCEJ(
      rendezVousMilo: RendezVousMilo,
      jeune: JeuneDuRendezVous
    ): RendezVous {
      const { dateTimeDebut, duree } = this.getDateEtDuree(rendezVousMilo)
      return {
        id: this.idService.uuid(),
        source: Source.MILO,
        titre: rendezVousMilo.titre,
        sousTitre: '',
        date: dateTimeDebut.toJSDate(),
        duree,
        jeunes: [
          this.mapPresenceToJeuneDuRendezVous(jeune, rendezVousMilo.statut)
        ],
        type: CodeTypeRendezVous.RENDEZ_VOUS_MILO,
        presenceConseiller: true,
        commentaire: rendezVousMilo.commentaire,
        adresse: rendezVousMilo.adresse,
        modalite: rendezVousMilo.modalite,
        createur: { id: '', nom: '', prenom: '' },
        informationsPartenaire: {
          id: rendezVousMilo.id,
          type: EvenementMilo.ObjetEvenement.RENDEZ_VOUS
        },
        annule: estAnnule(rendezVousMilo)
      }
    }

    updateRendezVousCEJ(
      rendezVousCEJ: RendezVous,
      rendezVousMilo: RendezVousMilo
    ): RendezVous {
      const { dateTimeDebut, duree } = this.getDateEtDuree(rendezVousMilo)
      return {
        ...rendezVousCEJ,
        titre: rendezVousMilo.titre,
        date: dateTimeDebut.toJSDate(),
        duree,
        commentaire: rendezVousMilo.commentaire,
        adresse: rendezVousMilo.adresse,
        modalite: rendezVousMilo.modalite,
        jeunes: rendezVousCEJ.jeunes.map(jeune =>
          this.mapPresenceToJeuneDuRendezVous(jeune, rendezVousMilo.statut)
        ),
        annule: estAnnule(rendezVousMilo)
      }
    }

    private getDateEtDuree(rendezVousMilo: RendezVousMilo): {
      dateTimeDebut: DateTime
      duree: number
    } {
      const dateTimeDebut = rendezVousMilo.dateHeureDebut
      let duree = 0
      if (rendezVousMilo.dateHeureFin) {
        duree = rendezVousMilo.dateHeureFin
          .diff(dateTimeDebut, 'minutes')
          .get('minutes')
      }
      return { dateTimeDebut, duree }
    }

    private mapPresenceToJeuneDuRendezVous(
      jeune: JeuneDuRendezVous,
      statutRdvMilo: string
    ): JeuneDuRendezVous {
      return {
        id: jeune.id,
        firstName: jeune.firstName,
        lastName: jeune.lastName,
        email: jeune.email,
        configuration: jeune.configuration,
        conseiller: jeune.conseiller,
        preferences: jeune.preferences,
        present: this.calculerPresence(statutRdvMilo)
      }
    }

    private calculerPresence(statut: string): boolean | undefined {
      switch (statut) {
        case Statut.RDV_PRESENT:
          return true
        case Statut.RDV_ABSENT:
          return false
        default:
          return undefined
      }
    }
  }
}
