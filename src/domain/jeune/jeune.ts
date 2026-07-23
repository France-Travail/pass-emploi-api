import { Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { Brand } from '../../building-blocks/types/brand'
import { DateService } from '../../utils/date-service'
import { IdService } from '../../utils/id-service'
import { Core, estMilo } from '../core'
import * as _ConfigurationApplication from './configuration-application'
import { TIMEZONE_PAR_DEFAUT } from './configuration-application'
import * as _PoleEmploi from './jeune.pole-emploi'

export const JeuneRepositoryToken = 'JeuneRepositoryToken'
export const JeuneConfigurationApplicationRepositoryToken =
  'JeuneConfigurationApplicationRepositoryToken'
export const JeunePoleEmploiRepositoryToken = 'JeunePoleEmploiRepositoryToken'

export interface Jeune {
  id: string
  firstName: string
  lastName: string
  creationDate: DateTime
  datePremiereConnexion?: DateTime
  dateDerniereConnexion?: DateTime
  dateFinCEJ?: DateTime
  structure: Core.Structure
  isActivated: boolean
  conseiller?: Jeune.Conseiller
  conseillerInitial?: Jeune.ConseillerInitial
  email?: string
  idPartenaire?: string
  configuration: Jeune.ConfigurationApplication
  preferences: Jeune.Preferences
  dateSignatureCGU?: DateTime
  dispositif?: Jeune.Dispositif
  peutVoirLeComptageDesHeures?: boolean
}

export namespace Jeune {
  export import ConfigurationApplication = _ConfigurationApplication.ConfigurationApplication

  export import Preferences = _ConfigurationApplication.ConfigurationApplication.Preferences

  export import PoleEmploi = _PoleEmploi.JeunePoleEmploi
  import Structure = Core.Structure

  export interface Conseiller {
    id: string
    firstName: string
    lastName: string
    email?: string
    idAgence?: string
  }

  export interface ConseillerInitial {
    id: string
  }

  export enum TypeTransfert {
    DEFINITIF = 'DEFINITIF',
    TEMPORAIRE = 'TEMPORAIRE',
    DEFINITIF_SUPPORT = 'DEFINITIF_SUPPORT',
    TEMPORAIRE_SUPPORT = 'TEMPORAIRE_SUPPORT',
    RECUPERATION = 'RECUPERATION'
  }

  export enum Dispositif {
    CEJ = 'CEJ',
    PACEA = 'PACEA',
    BRSA = 'BRSA',
    AIJ = 'AIJ',
    CONSEIL_DEPT = 'CONSEIL_DEPT',
    AVENIR_PRO = 'AVENIR_PRO',
    ACCOMPAGNEMENT_INTENSIF = 'ACCOMPAGNEMENT_INTENSIF',
    ACCOMPAGNEMENT_GLOBAL = 'ACCOMPAGNEMENT_GLOBAL',
    EQUIP_EMPLOI_RECRUT = 'EQUIP_EMPLOI_RECRUT'
  }

  export type Id = Brand<string, 'JeuneId'>

  export function mettreAJourIdPartenaire(
    jeune: Jeune,
    idPartenaire: string
  ): Jeune {
    return {
      ...jeune,
      idPartenaire
    }
  }

  function autoriseAVoirLeComptage(
    structure: Structure,
    dispositif?: Dispositif
  ): boolean {
    return estMilo(structure) && dispositif === Jeune.Dispositif.CEJ
  }

  export function mettreAJourDispositif(
    jeune: Jeune,
    dispositif: Dispositif
  ): Jeune {
    return {
      ...jeune,
      dispositif,
      peutVoirLeComptageDesHeures: autoriseAVoirLeComptage(
        jeune.structure,
        dispositif
      )
        ? jeune.peutVoirLeComptageDesHeures
        : false
    }
  }

  export function reinitialiserPourChangementDispositif(
    jeune: Jeune,
    dispositif: Dispositif,
    dateFinAccompagnement: DateTime
  ): Jeune {
    const jeuneAvecNouveauDispositif = mettreAJourDispositif(jeune, dispositif)
    return {
      ...jeuneAvecNouveauDispositif,
      creationDate: dateFinAccompagnement,
      configuration: {
        ...jeune.configuration
      }
    }
  }

  export function mettreAJourPeutVoirComptageDesHeures(
    jeune: Jeune,
    peutVoirLeComptageDesHeures: boolean
  ): Jeune {
    if (!autoriseAVoirLeComptage(jeune.structure, jeune.dispositif))
      return jeune
    return {
      ...jeune,
      peutVoirLeComptageDesHeures: peutVoirLeComptageDesHeures
    }
  }

  export interface Repository {
    get(id: string): Promise<Jeune | undefined>

    findAll(ids: string[]): Promise<Jeune[]>

    existe(id: string): Promise<boolean>

    getByEmail(
      email: string,
      options?: { includeConseiller: boolean }
    ): Promise<Jeune | undefined>

    save(jeune: Jeune): Promise<void>

    findAllJeunesByConseiller(idConseiller: string): Promise<Jeune[]>

    findAllJeunesByIdsAndConseiller(
      idsJeunes: string[],
      idConseiller: string
    ): Promise<Jeune[]>

    findAllJeunesByIdsAuthentificationAndStructures(
      idsAuthentificationJeunes: string[],
      structures: Core.Structure[]
    ): Promise<Array<Jeune & { idAuthentification: string }>>

    findAllJeunesByConseillerInitial(idConseiller: string): Promise<Jeune[]>

    findAllByIdStructureMilo(idStructureMilo: string): Promise<Jeune[]>

    supprimer(idJeune: Jeune.Id): Promise<void>

    transferAndSaveAll(
      jeunes: Jeune[],
      idConseillerCible: string,
      idConseillerSource: string,
      idConseillerQuiTransfert: string,
      typeTransfert: Jeune.TypeTransfert
    ): Promise<void>

    saveAllJeuneTransferes(jeunes: Jeune[]): Promise<void>

    reinitialiserDatePremiereConnexion(idJeune: string): Promise<void>
  }

  @Injectable()
  export class Factory {
    constructor(
      private dateService: DateService,
      private idService: IdService
    ) {}

    creer(jeuneACreer: Factory.ACreer): Jeune {
      const id = this.idService.uuid()
      return {
        id: id,
        firstName: jeuneACreer.prenom,
        lastName: jeuneACreer.nom,
        email: jeuneACreer.email,
        isActivated: false,
        creationDate: this.dateService.now(),
        conseiller: {
          id: jeuneACreer.conseiller.id,
          lastName: jeuneACreer.conseiller.lastName,
          firstName: jeuneACreer.conseiller.firstName,
          email: jeuneACreer.conseiller.email
        },
        structure: jeuneACreer.structure,
        preferences: {
          partageFavoris: true,
          alertesOffres: true,
          messages: true,
          creationActionConseiller: true,
          rendezVousSessions: true,
          rappelActions: true,
          actualitesMilo: true
        },
        idPartenaire: jeuneACreer.idPartenaire,
        configuration: {
          idJeune: id,
          fuseauHoraire: TIMEZONE_PAR_DEFAUT
        },
        dispositif: jeuneACreer.dispositif,
        peutVoirLeComptageDesHeures: jeuneACreer.peutVoirLeCompteurDesHeures
      }
    }

    creerSansConseiller(jeuneACreer: Factory.ACreerSansConseiller): Jeune {
      const id = this.idService.uuid()
      const maintenant = this.dateService.now()
      return {
        id: id,
        firstName: jeuneACreer.prenom,
        lastName: jeuneACreer.nom,
        email: jeuneACreer.email,
        isActivated: true,
        creationDate: maintenant,
        datePremiereConnexion: maintenant,
        dateDerniereConnexion: maintenant,
        structure: jeuneACreer.structure,
        preferences: {
          partageFavoris: true,
          alertesOffres: true,
          messages: false,
          creationActionConseiller: false,
          rendezVousSessions: true,
          rappelActions: true,
          actualitesMilo: false
        },
        configuration: {
          idJeune: id,
          fuseauHoraire: TIMEZONE_PAR_DEFAUT
        }
      }
    }
  }

  export namespace Factory {
    export interface ACreer {
      prenom: string
      nom: string
      email: string
      conseiller: Conseiller
      structure: Core.Structure
      idPartenaire?: string
      dispositif: Jeune.Dispositif
      peutVoirLeCompteurDesHeures?: boolean
    }

    export interface ACreerSansConseiller {
      prenom: string
      nom: string
      email?: string
      structure: Core.Structure
    }
  }

  export function changerDeConseiller(
    jeunes: Jeune[],
    conseillerCible: Conseiller,
    idConseillerSource: string,
    estTemporaire: boolean
  ): Jeune[] {
    return jeunes.map(jeune => ({
      ...jeune,
      conseiller: {
        id: conseillerCible.id,
        firstName: conseillerCible.firstName,
        lastName: conseillerCible.lastName,
        email: conseillerCible.email
      },
      conseillerInitial: mapConseillerInitial(
        jeune,
        idConseillerSource,
        conseillerCible.id,
        estTemporaire
      )
    }))
  }

  export function recupererLesJeunes(
    jeunes: Jeune[],
    conseillerCible: Conseiller
  ): Jeune[] {
    return jeunes.map(jeune => ({
      ...jeune,
      conseiller: {
        id: conseillerCible.id,
        firstName: conseillerCible.firstName,
        lastName: conseillerCible.lastName,
        email: conseillerCible.email
      },
      conseillerInitial: undefined
    }))
  }

  export function separerLesJeunesParConseillerActuel(
    jeunes: Jeune[]
  ): Record<string, Jeune[]> {
    return jeunes.reduce(
      (res, jeuneActuel) => {
        if (res[jeuneActuel.conseiller!.id]) {
          res[jeuneActuel.conseiller!.id].push(jeuneActuel)
        } else {
          res[jeuneActuel.conseiller!.id] = [jeuneActuel]
        }
        return res
      },
      {} as Record<string, Jeune[]>
    )
  }

  export function estSuiviTemporairement(jeune: Jeune): boolean {
    return Boolean(jeune.conseillerInitial)
  }
}

function mapConseillerInitial(
  jeune: Jeune,
  idConseillerSource: string,
  idConseillerCible: string,
  estTemporaire: boolean
): Jeune.ConseillerInitial | undefined {
  if (idConseillerCible === jeune.conseillerInitial?.id) {
    return undefined
  }
  if (estTemporaire) {
    return jeune.conseillerInitial ?? { id: idConseillerSource }
  }
  return undefined
}
