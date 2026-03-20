import {
  ContactImmersionQueryModel,
  DetailOffreImmersionQueryModel,
  LocalisationQueryModel,
  OffreImmersionQueryModel
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

export function toOffreImmersionQueryModel(
  offreImmersionDto: PartenaireImmersion.DtoV3
): OffreImmersionQueryModel {
  const appellationCode =
    offreImmersionDto.appellations[0]?.appellationCode ?? ''
  const labelMetier = offreImmersionDto.appellations[0]?.appellationLabel ?? ''
  return {
    id: `${offreImmersionDto.siret}-${appellationCode}`,
    metier: labelMetier,
    nomEtablissement:
      offreImmersionDto.customizedName ?? offreImmersionDto.name,
    secteurActivite: offreImmersionDto.nafLabel,
    ville: offreImmersionDto.address.city,
    estVolontaire: offreImmersionDto.voluntaryToImmersion,
    locationId: offreImmersionDto.locationId
  }
}

export function toDetailOffreImmersionQueryModel(
  offreImmersionDto: PartenaireImmersion.DtoV3
): DetailOffreImmersionQueryModel {
  const appellationCode =
    offreImmersionDto.appellations[0]?.appellationCode ?? ''
  const labelMetier = offreImmersionDto.appellations[0]?.appellationLabel ?? ''
  return {
    id: `${offreImmersionDto.siret}-${appellationCode}`,
    codeRome: offreImmersionDto.rome,
    siret: offreImmersionDto.siret,
    metier: labelMetier,
    nomEtablissement:
      offreImmersionDto.customizedName ?? offreImmersionDto.name,
    secteurActivite: offreImmersionDto.nafLabel,
    ville: offreImmersionDto.address.city,
    adresse: buildAdresse(offreImmersionDto),
    estVolontaire: offreImmersionDto.voluntaryToImmersion,
    localisation: buildLocalisation(offreImmersionDto),
    contact: buildContact(offreImmersionDto),
    informationsComplementaires: offreImmersionDto.additionalInformation,
    siteWeb: offreImmersionDto.website,
    modeDistanciel: offreImmersionDto.remoteWorkMode,
    accessibleTravailleurHandicape: offreImmersionDto.fitForDisabledWorkers,
    locationId: offreImmersionDto.locationId
  }
}

export function buildLocalisation(
  offreImmpersionDto: PartenaireImmersion.DtoV3
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
  offreImmpersionDto: PartenaireImmersion.DtoV3
): ContactImmersionQueryModel | undefined {
  return {
    modeDeContact: offreImmpersionDto.contactMode
      ? fromContactMode[offreImmpersionDto.contactMode]
      : Offre.Immersion.MethodeDeContact.INCONNU
  }
}

export function buildAdresse(
  offreImmpersionDto: PartenaireImmersion.DtoV3
): string {
  const { streetNumberAndAddress, postcode, city } = offreImmpersionDto.address

  return streetNumberAndAddress + ' ' + postcode + ' ' + city
}
