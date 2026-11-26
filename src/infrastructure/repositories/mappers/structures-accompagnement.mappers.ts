import { MissionLocaleApprentissageDto } from '../../clients/dto/apprentissage.dto'
import {
  AgenceFTDto,
  HoraireAgenceFTDto
} from '../../clients/dto/pole-emploi.dto'
import { isDefined } from '../../../utils/is-defined'
import { StructureAccompagnement } from '../../../domain/structure-accompagnement'

const LIBELLES_JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

const NOMS_JOURS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche'
]

const FERME = 'O'

interface Creneau {
  ouverture: number
  fermeture: number
  surRdv: boolean
}

interface HorairesDuJour {
  jour: number
  creneaux: Creneau[]
  libelle: string
}

interface GroupeDeJours {
  premierJour: number
  dernierJour: number
  creneaux: Creneau[]
  libelle: string
}

export function resumerHorairesFT(
  horaires: HoraireAgenceFTDto[] | undefined
): string[] {
  return grouperJoursConsecutifs(horaires).map(groupe => {
    const jours =
      groupe.premierJour === groupe.dernierJour
        ? libelleJour(groupe.premierJour)
        : `${libelleJour(groupe.premierJour)}–${libelleJour(
            groupe.dernierJour
          ).toLowerCase()}`
    return `${jours} · ${groupe.libelle}`
  })
}

export function decrireHorairesFT(
  horaires: HoraireAgenceFTDto[] | undefined
): string | null {
  const descriptions = grouperJoursConsecutifs(horaires).map(groupe => {
    const jours =
      groupe.premierJour === groupe.dernierJour
        ? nomJour(groupe.premierJour)
        : `${nomJour(groupe.premierJour)} à ${nomJour(groupe.dernierJour)}`
    return `${jours} ouvert ${decrireCreneaux(groupe.creneaux)}`
  })
  if (descriptions.length === 0) return null

  const phrase = joindreEnFrancais(descriptions, ', et ')
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`
}

function grouperJoursConsecutifs(
  horaires: HoraireAgenceFTDto[] | undefined
): GroupeDeJours[] {
  const horairesParJour = (horaires ?? [])
    .filter(horaire => estJourDeLaSemaine(horaire.jour))
    .sort((a, b) => a.jour - b.jour)
    .map(resumerJour)
    .filter(isDefined)

  const groupes: GroupeDeJours[] = []
  for (const horairesDuJour of horairesParJour) {
    const groupeCourant = groupes.at(-1)
    if (
      groupeCourant &&
      groupeCourant.dernierJour + 1 === horairesDuJour.jour &&
      groupeCourant.libelle === horairesDuJour.libelle
    ) {
      groupeCourant.dernierJour = horairesDuJour.jour
    } else {
      groupes.push({
        premierJour: horairesDuJour.jour,
        dernierJour: horairesDuJour.jour,
        creneaux: horairesDuJour.creneaux,
        libelle: horairesDuJour.libelle
      })
    }
  }
  return groupes
}

function decrireCreneaux(creneaux: Creneau[]): string {
  const melangeLibreEtRdv =
    creneaux.some(c => c.surRdv) && creneaux.some(c => !c.surRdv)

  const series: Creneau[][] = []
  for (const creneau of creneaux) {
    const serieCourante = series.at(-1)
    if (serieCourante && serieCourante[0].surRdv === creneau.surRdv) {
      serieCourante.push(creneau)
    } else {
      series.push([creneau])
    }
  }

  return series
    .map(serie => {
      const plages = serie
        .map(
          c =>
            `de ${formaterHeure(c.ouverture)} à ${formaterHeure(c.fermeture)}`
        )
        .join(' et ')
      if (serie[0].surRdv) return `${plages} sur rendez-vous`
      return melangeLibreEtRdv ? `${plages} en accès libre` : plages
    })
    .join(' et ')
}

function joindreEnFrancais(
  elements: string[],
  dernierSeparateur: string
): string {
  if (elements.length <= 1) return elements.join('')
  return `${elements.slice(0, -1).join(', ')}${dernierSeparateur}${elements.at(
    -1
  )}`
}

function resumerJour(horaire: HoraireAgenceFTDto): HorairesDuJour | undefined {
  const accueilOuvert = horaire.horaireFerme !== FERME
  const rdvOuvert = horaire.horaireFermeRDV !== FERME
  const creneaux = [
    accueilOuvert &&
      creneau(horaire.ouvertureMatin, horaire.fermetureMatin, false),
    accueilOuvert &&
      creneau(horaire.ouvertureApresMidi, horaire.fermetureApresMidi, false),
    rdvOuvert &&
      creneau(
        horaire.ouvertureApresMidiRDV,
        horaire.fermetureApresMidiRDV,
        true
      )
  ]
    .filter((c): c is Creneau => Boolean(c))
    .sort((a, b) => a.ouverture - b.ouverture)
  if (creneaux.length === 0) return undefined

  return {
    jour: horaire.jour,
    creneaux,
    libelle: creneaux.map(formaterCreneau).join(', ')
  }
}

function creneau(
  ouverture: string | undefined,
  fermeture: string | undefined,
  surRdv: boolean
): Creneau | undefined {
  const minutesOuverture = minutesDepuisMinuit(ouverture)
  const minutesFermeture = minutesDepuisMinuit(fermeture)
  if (minutesOuverture === undefined || minutesFermeture === undefined) {
    return undefined
  }
  return { ouverture: minutesOuverture, fermeture: minutesFermeture, surRdv }
}

function formaterCreneau(creneau: Creneau): string {
  const plage = `${formaterHeure(creneau.ouverture)}-${formaterHeure(
    creneau.fermeture
  )}`
  return creneau.surRdv ? `${plage} sur RDV` : plage
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

function nomJour(jour: number): string {
  return NOMS_JOURS[jour - 1]
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
): StructureAccompagnement | undefined {
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
    horaires: resumerHorairesFT(agence.horaires),
    horairesAlt: decrireHorairesFT(agence.horaires)
  }
}

export function toStructureAccompagnementMilo(
  missionLocale: MissionLocaleApprentissageDto
): StructureAccompagnement | undefined {
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
    horaires: null,
    horairesAlt: null
  }
}

function ouNull(valeur: string | undefined): string | null {
  const valeurNettoyee = valeur?.trim()
  return valeurNettoyee || null
}
