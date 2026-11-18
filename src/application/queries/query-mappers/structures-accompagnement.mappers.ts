import { MissionLocaleApprentissageDto } from '../../../infrastructure/clients/dto/apprentissage.dto'
import {
  AgenceFTDto,
  HoraireAgenceFTDto
} from '../../../infrastructure/clients/dto/pole-emploi.dto'
import { isDefined } from '../../../utils/is-defined'
import { StructureAccompagnementQueryModel } from '../query-models/structures-accompagnement.query-model'

const LIBELLES_JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const FERME = 'O'

interface Amplitude {
  jour: number
  ouverture: number
  fermeture: number
}

export function resumerHorairesFT(
  horaires: HoraireAgenceFTDto[] | undefined
): string[] {
  const amplitudes = (horaires ?? [])
    .filter(horaire => estJourDeLaSemaine(horaire.jour))
    .sort((a, b) => a.jour - b.jour)
    .map(calculerAmplitude)
    .filter(isDefined)

  const groupes: Amplitude[][] = []
  for (const amplitude of amplitudes) {
    const groupeCourant = groupes.at(-1)
    const dernier = groupeCourant?.at(-1)
    if (
      groupeCourant &&
      dernier &&
      dernier.jour + 1 === amplitude.jour &&
      dernier.ouverture === amplitude.ouverture &&
      dernier.fermeture === amplitude.fermeture
    ) {
      groupeCourant.push(amplitude)
    } else {
      groupes.push([amplitude])
    }
  }

  return groupes.map(groupe => {
    const premier = groupe[0]
    const dernier = groupe.at(-1) ?? premier
    const jours =
      groupe.length === 1
        ? libelleJour(premier.jour)
        : `${libelleJour(premier.jour)}–${libelleJour(dernier.jour).toLowerCase()}`
    return `${jours} · ${formaterHeure(premier.ouverture)} – ${formaterHeure(
      premier.fermeture
    )}`
  })
}

function calculerAmplitude(horaire: HoraireAgenceFTDto): Amplitude | undefined {
  const accueilOuvert = horaire.horaireFerme !== FERME
  const rdvOuvert = horaire.horaireFermeRDV !== FERME
  const creneaux = [
    accueilOuvert && creneau(horaire.ouvertureMatin, horaire.fermetureMatin),
    accueilOuvert &&
      creneau(horaire.ouvertureApresMidi, horaire.fermetureApresMidi),
    rdvOuvert &&
      creneau(horaire.ouvertureApresMidiRDV, horaire.fermetureApresMidiRDV)
  ].filter((c): c is Creneau => Boolean(c))
  if (creneaux.length === 0) return undefined

  return {
    jour: horaire.jour,
    ouverture: Math.min(...creneaux.map(c => c.ouverture)),
    fermeture: Math.max(...creneaux.map(c => c.fermeture))
  }
}

interface Creneau {
  ouverture: number
  fermeture: number
}

function creneau(
  ouverture: string | undefined,
  fermeture: string | undefined
): Creneau | undefined {
  const minutesOuverture = minutesDepuisMinuit(ouverture)
  const minutesFermeture = minutesDepuisMinuit(fermeture)
  if (minutesOuverture === undefined || minutesFermeture === undefined) {
    return undefined
  }
  return { ouverture: minutesOuverture, fermeture: minutesFermeture }
}

function minutesDepuisMinuit(heure: string | undefined): number | undefined {
  const correspondance = /^(\d{1,2}):(\d{2})$/.exec(heure?.trim() ?? '')
  if (!correspondance) return undefined
  return Number(correspondance[1]) * 60 + Number(correspondance[2])
}

function estJourDeLaSemaine(jour: number): boolean {
  return Number.isInteger(jour) && jour >= 1 && jour <= LIBELLES_JOURS.length
}

function libelleJour(jour: number): string {
  return LIBELLES_JOURS[jour - 1]
}

function formaterHeure(minutesDepuisMinuit: number): string {
  const heures = Math.floor(minutesDepuisMinuit / 60)
  const minutes = minutesDepuisMinuit % 60
  return minutes === 0
    ? `${heures}h`
    : `${heures}h${String(minutes).padStart(2, '0')}`
}

export function toStructureAccompagnementFT(
  agence: AgenceFTDto
): StructureAccompagnementQueryModel | undefined {
  const nom = ouNull(agence.libelleEtendu)
  if (!nom) return undefined

  const adresse = agence.adressePrincipale
  return {
    nom,
    adresse: {
      ligne: ouNull([adresse.ligne4, adresse.ligne5].filter(Boolean).join(' ')),
      codePostal: ouNull(adresse.bureauDistributeur),
      ville: ouNull(adresse.ligne6?.replace(/^\d{5}\s+/, ''))
    },
    telephone: ouNull(agence.contact?.telephonePublic),
    horaires: resumerHorairesFT(agence.horaires)
  }
}

export function toStructureAccompagnementMilo(
  missionLocale: MissionLocaleApprentissageDto
): StructureAccompagnementQueryModel | undefined {
  const nom = ouNull(missionLocale.nom)
  if (!nom) return undefined

  return {
    nom: `Mission Locale ${nom}`,
    adresse: {
      ligne: ouNull(missionLocale.localisation?.adresse),
      codePostal: ouNull(missionLocale.localisation?.cp),
      ville: ouNull(missionLocale.localisation?.ville)
    },
    telephone: ouNull(missionLocale.contact?.telephone),
    horaires: null
  }
}

function ouNull(valeur: string | undefined): string | null {
  const valeurNettoyee = valeur?.trim()
  return valeurNettoyee || null
}
