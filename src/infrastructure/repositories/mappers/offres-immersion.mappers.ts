import {
  ContactImmersionQueryModel,
  DetailOffreImmersionQueryModel,
  DetailOffreImmersionQueryModelV3,
  LocalisationQueryModel,
  OffreImmersionQueryModel,
  OffreImmersionQueryModelV3
} from '../../../application/queries/query-models/offres-immersion.query-model'
import { Offre } from '../../../domain/offre/offre'
import { FavoriOffreImmersionSqlModel } from '../../sequelize/models/favori-offre-immersion.sql-model'
import { PartenaireImmersion } from '../dto/immersion.dto'

const fromContactMode = {
  UNKNOWN: Offre.Immersion.MethodeDeContact.INCONNU,
  EMAIL: Offre.Immersion.MethodeDeContact.EMAIL,
  PHONE: Offre.Immersion.MethodeDeContact.TELEPHONE,
  IN_PERSON: Offre.Immersion.MethodeDeContact.PRESENTIEL
}

const fromRemoteWorkMode: Record<
  string,
  Offre.Immersion.ImmersionModeDistanciel
> = {
  FULL_REMOTE: Offre.Immersion.ImmersionModeDistanciel.FULL_REMOTE,
  HYBRID: Offre.Immersion.ImmersionModeDistanciel.HYBRID,
  ON_SITE: Offre.Immersion.ImmersionModeDistanciel.ON_SITE
}

const fromFitForDisabledWorkers: Record<
  string,
  Offre.Immersion.ImmersionAccessibleTravailleurHandicape
> = {
  'yes-ft-certified':
    Offre.Immersion.ImmersionAccessibleTravailleurHandicape.YES_FT_CERTIFIED,
  'yes-declared-only':
    Offre.Immersion.ImmersionAccessibleTravailleurHandicape.YES_DECLARED_ONLY,
  no: Offre.Immersion.ImmersionAccessibleTravailleurHandicape.NO
}

export function fromSqlToFavorisOffreImmersion(
  offreImmersionFavoriSql: FavoriOffreImmersionSqlModel
): Offre.Favori.Immersion {
  return {
    id: offreImmersionFavoriSql.idOffre,
    metier: offreImmersionFavoriSql.metier,
    nomEtablissement: offreImmersionFavoriSql.nomEtablissement,
    secteurActivite: offreImmersionFavoriSql.secteurActivite,
    ville: offreImmersionFavoriSql.ville
  }
}

export function toOffreImmersionQueryModelV3(
  offreImmersionDto: PartenaireImmersion.DtoV3
): OffreImmersionQueryModelV3 {
  const appellationCode =
    offreImmersionDto.appellations[0]?.appellationCode ?? ''
  const labelMetier = offreImmersionDto.appellations[0]?.appellationLabel ?? ''
  return {
    siret: offreImmersionDto.siret,
    metier: labelMetier,
    nomEtablissement:
      offreImmersionDto.customizedName ?? offreImmersionDto.name,
    secteurActivite: offreImmersionDto.nafLabel,
    ville: offreImmersionDto.address.city,
    locationId: offreImmersionDto.locationId,
    appellationCode
  }
}

export function toDetailOffreImmersionQueryModelV3(
  offreImmersionDto: PartenaireImmersion.DtoV3
): DetailOffreImmersionQueryModelV3 {
  const appellationCode =
    offreImmersionDto.appellations[0]?.appellationCode ?? ''
  const labelMetier = offreImmersionDto.appellations[0]?.appellationLabel ?? ''
  return {
    siret: offreImmersionDto.siret,
    metier: labelMetier,
    nomEtablissement:
      offreImmersionDto.customizedName ?? offreImmersionDto.name,
    secteurActivite: offreImmersionDto.nafLabel,
    ville: offreImmersionDto.address.city,
    adresse: buildAdresseV3(offreImmersionDto),
    contact: buildContactV3(offreImmersionDto),
    informationsComplementaires: offreImmersionDto.additionalInformation,
    siteWeb: offreImmersionDto.website,
    modeDistanciel: offreImmersionDto.remoteWorkMode
      ? { modeDistanciel: fromRemoteWorkMode[offreImmersionDto.remoteWorkMode] }
      : undefined,
    accessibleTravailleurHandicape: offreImmersionDto.fitForDisabledWorkers
      ? {
          accessibleTravailleurHandicape:
            fromFitForDisabledWorkers[offreImmersionDto.fitForDisabledWorkers]
        }
      : undefined,
    locationId: offreImmersionDto.locationId,
    appellationCode
  }
}

export function toOffreImmersionQueryModel(
  offreImmersionDto: PartenaireImmersion.DtoV2
): OffreImmersionQueryModel {
  const appellationCode =
    offreImmersionDto.appellations[0]?.appellationCode ?? ''
  const labelMetier = offreImmersionDto.appellations[0]?.appellationLabel ?? ''
  return {
    id: `${offreImmersionDto.siret}-${appellationCode}`,
    metier: labelMetier,
    nomEtablissement: offreImmersionDto.name,
    secteurActivite: offreImmersionDto.nafLabel,
    ville: offreImmersionDto.address.city,
    estVolontaire: offreImmersionDto.voluntaryToImmersion
  }
}

export function toDetailOffreImmersionQueryModel(
  offreImmersionDto: PartenaireImmersion.DtoV2
): DetailOffreImmersionQueryModel {
  const appellationCode =
    offreImmersionDto.appellations[0]?.appellationCode ?? ''
  const labelMetier = offreImmersionDto.appellations[0]?.appellationLabel ?? ''
  return {
    id: `${offreImmersionDto.siret}-${appellationCode}`,
    codeRome: offreImmersionDto.rome,
    siret: offreImmersionDto.siret,
    metier: labelMetier,
    nomEtablissement: offreImmersionDto.name,
    secteurActivite: offreImmersionDto.nafLabel,
    ville: offreImmersionDto.address.city,
    adresse: buildAdresse(offreImmersionDto),
    estVolontaire: offreImmersionDto.voluntaryToImmersion,
    localisation: buildLocalisation(offreImmersionDto),
    contact: buildContact(offreImmersionDto)
  }
}

export function buildLocalisation(
  offreImmpersionDto: PartenaireImmersion.DtoV2
): LocalisationQueryModel | undefined {
  if (!offreImmpersionDto.position) {
    return undefined
  }
  return {
    latitude: offreImmpersionDto.position.lat,
    longitude: offreImmpersionDto.position.lon
  }
}

export function buildContact(
  offreImmpersionDto: PartenaireImmersion.DtoV2
): ContactImmersionQueryModel | undefined {
  return {
    modeDeContact: offreImmpersionDto.contactMode
      ? fromContactMode[offreImmpersionDto.contactMode]
      : Offre.Immersion.MethodeDeContact.INCONNU
  }
}

export function buildAdresse(
  offreImmpersionDto: PartenaireImmersion.DtoV2
): string {
  const { streetNumberAndAddress, postcode, city } = offreImmpersionDto.address

  return streetNumberAndAddress + ' ' + postcode + ' ' + city
}

export function buildContactV3(
  offreImmpersionDto: PartenaireImmersion.DtoV3
): ContactImmersionQueryModel {
  return {
    modeDeContact: offreImmpersionDto.contactMode
      ? fromContactMode[offreImmpersionDto.contactMode]
      : Offre.Immersion.MethodeDeContact.INCONNU
  }
}

export function buildAdresseV3(
  offreImmpersionDto: PartenaireImmersion.DtoV3
): string {
  const { streetNumberAndAddress, postcode, city } = offreImmpersionDto.address

  return streetNumberAndAddress + ' ' + postcode + ' ' + city
}
