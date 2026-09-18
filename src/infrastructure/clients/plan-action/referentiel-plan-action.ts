// Référentiel « services et solutions » embarqué au build, copie provisoire
// de apps/api/data/solutions.json du POC bayesimpact/1jeune-des-solutions
// (sync Grist du 2026-09-16), réduite aux colonnes utilisées. Sera remplacé
// par un référentiel en base. L'ordre des lignes est l'ordre du référentiel,
// servi tel quel aux jeunes.
import { PlanAction } from '../../../domain/plan-action'
import { Profil } from '../../../domain/profil'

export const REFERENTIEL_PLAN_ACTION: PlanAction.Solution[] = [
  {
    id: 'p-2',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je consulte des sites d'orientation",
    url: 'https://www.onisep.fr/',
    serviceName: 'ONISEP'
  },
  {
    id: 'p-3',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je consulte des sites d'orientation",
    url: 'https://www.cidj.com/',
    serviceName: 'CIDJ'
  },
  {
    id: 'p-4',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: "Je participe à un forum d'orientation ou de formation",
    url: null,
    serviceName: null
  },
  {
    id: 'p-5',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je prends contact avec le Centre d'Information et d'Orientation le plus proche de mon domicile",
    url: 'https://lannuaire.service-public.gouv.fr/navigation/cio',
    serviceName: 'CIO'
  },
  {
    id: 'p-6',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [PlanAction.Situation.COLLEGE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche un métier selon mes goûts',
    url: 'https://www.onisep.fr/metier/les-quiz-de-l-onisep/quiz-quels-metiers-selon-mes-gouts',
    serviceName: 'ONISEP'
  },
  {
    id: 'p-7',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [PlanAction.Situation.COLLEGE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur la voie professionnelle',
    url: 'https://www.onisep.fr/formation/apres-la-3-la-voie-professionnelle/qu-est-ce-que-la-voie-professionnelle',
    serviceName: 'ONISEP'
  },
  {
    id: 'p-8',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [PlanAction.Situation.COLLEGE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je consulte les diplôme de la voie professionnelle au lycée',
    url: 'https://www.onisep.fr/formation/apres-la-3-la-voie-professionnelle/les-diplomes-de-la-voie-pro',
    serviceName: 'ONISEP'
  },
  {
    id: 'p-9',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je fais le point sur mes compétences professionnelles et personnelles',
    url: 'https://plateforme.diagoriente.fr/appli-brillo/',
    serviceName: 'Diagoriente'
  },
  {
    id: 'p-10',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je fais le point sur mes intérêts',
    url: 'https://plateforme.diagoriente.fr/appli-inspi/my-interests',
    serviceName: 'Diagoriente'
  },
  {
    id: 'p-11',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je fais le point sur mes intérêts professionnels',
    url: 'https://plateforme.diagoriente.fr/appli-inspi/riasec/wizard/jeunes/test',
    serviceName: 'Diagoriente'
  },
  {
    id: 'p-12',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je recherche un métier en fonction de mes centres d'intérêts",
    url: 'https://candidat.francetravail.fr/metierscope/centres-interet',
    serviceName: 'Diagoriente'
  },
  {
    id: 'p-13',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je consulte une liste de métiers par secteur d'activité",
    url: 'https://candidat.francetravail.fr/metierscope/secteurs-activite',
    serviceName: 'Metierscope'
  },
  {
    id: 'p-14',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je consulte des fiches métiers',
    url: 'https://candidat.francetravail.fr/metierscope/metiers',
    serviceName: 'Metierscope'
  },
  {
    id: 'p-15',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je consulte des vidéos en lien avec les métiers qui m'intéressent",
    url: null,
    serviceName: null
  },
  {
    id: 'p-16',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "J'échange avec des proches ou des professionnels du secteur d'activité qui m'intéresse",
    url: null,
    serviceName: null
  },
  {
    id: 'p-17',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je recherche une entreprise en lien avec le métier qui m'intéresse",
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-18',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.AUTRE,
      PlanAction.Situation.EMPLOI
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je postule pour effectuer un stage auprès d'une entreprise",
    url: null,
    serviceName: null
  },
  {
    id: 'p-19',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je postule pour effectuer une immersion de quelques jours auprès d'une entreprise",
    url: 'https://immersion-facile.beta.gouv.fr/',
    serviceName: 'Immersion Facilitée'
  },
  {
    id: 'p-20',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "J'effectue une immersion en entreprise",
    url: null,
    serviceName: null
  },
  {
    id: 'p-21',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me renseigne sur l'alternance",
    url: 'https://labonnealternance.apprentissage.beta.gouv.fr/guide-alternant',
    serviceName: 'La bonne alternance'
  },
  {
    id: 'p-22',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: "Je consulte des offres en alternance sur l'Application 1J1S",
    url: null,
    serviceName: null
  },
  {
    id: 'p-23',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label:
      "Je recherche un forum d'orientation ou de formation organisé près de chez moi",
    url: null,
    serviceName: null
  },
  {
    id: 'p-24',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je consulte une liste de métiers par secteur d'activité",
    url: 'https://candidat.francetravail.fr/metierscope/secteurs-activite',
    serviceName: 'Metierscope'
  },
  {
    id: 'p-25',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je consulte des fiches métiers',
    url: 'https://candidat.francetravail.fr/metierscope/metiers',
    serviceName: 'Metierscope'
  },
  {
    id: 'p-26',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je consulte des vidéos en lien avec les métiers qui m'intéressent",
    url: null,
    serviceName: null
  },
  {
    id: 'p-27',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "J'échange avec des proches ou des professionnels du secteur d'activité qui m'intéresse",
    url: null,
    serviceName: null
  },
  {
    id: 'p-28',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je recherche une entreprise en lien avec le métier qui m'intéresse",
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-29',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je postule pour effectuer un stage auprès d'une entreprise",
    url: null,
    serviceName: null
  },
  {
    id: 'p-30',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je postule pour effectuer une immersion auprès d'une entreprise",
    url: 'https://immersion-facile.beta.gouv.fr/',
    serviceName: 'Immersion Facilitée'
  },
  {
    id: 'p-31',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "J'effectue une immersion en entreprise",
    url: null,
    serviceName: null
  },
  {
    id: 'p-32',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me renseigne sur l'alternance",
    url: 'https://labonnealternance.apprentissage.beta.gouv.fr/guide-alternant',
    serviceName: 'La bonne alternance'
  },
  {
    id: 'p-33',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: "Je consulte des offres en alternance sur l'Application Jeunes",
    url: null,
    serviceName: null
  },
  {
    id: 'p-34',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je prends connaissance du calendrier Parcoursup',
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-35',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "J'explore les formations Post-Bac",
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-36',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je découvre les filières, les écoles et les débouchés',
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-37',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me renseigne sur les journées portes ouvertes et visites d'écoles",
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-38',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je participe à des journées portes ouvertes et visites d'écoles",
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-39',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je choisis mes vœux',
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-40',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je rédige mes lettres de motivation',
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-41',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je remplis mon dossier pour les vœux que j'ai sélectionnés",
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-42',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je prends connaissance du calendrier Mon Master',
    url: 'https://monmaster.gouv.fr/formation',
    serviceName: 'Mon Master'
  },
  {
    id: 'p-43',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "J'explore les formations proposés en Master",
    url: 'https://monmaster.gouv.fr/formation',
    serviceName: 'Mon Master'
  },
  {
    id: 'p-44',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je découvre les filières, les écoles et les débouchés en Master',
    url: 'https://monmaster.gouv.fr/formation',
    serviceName: 'Mon Master'
  },
  {
    id: 'p-45',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je participe à des journées portes ouvertes et visites de Master',
    url: null,
    serviceName: null
  },
  {
    id: 'p-46',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je rédige mes lettres de motivation',
    url: null,
    serviceName: null
  },
  {
    id: 'p-47',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je choisis mes vœux de Master',
    url: 'https://monmaster.gouv.fr/formation',
    serviceName: 'Mon Master'
  },
  {
    id: 'p-48',
    category: PlanAction.Objectif.ORIENTER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je remplis mon dossier pour les vœux de Masters que j'ai sélectionnés",
    url: 'https://monmaster.gouv.fr/formation',
    serviceName: 'Mon Master'
  },
  {
    id: 'p-50',
    category: PlanAction.Objectif.DECOUVRIR_METIERS,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label:
      "Je recherche un forum d'orientation ou de formation organisé près de chez moi",
    url: null,
    serviceName: null
  },
  {
    id: 'p-53',
    category: PlanAction.Objectif.DECOUVRIR_METIERS,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je consulte des fiches métiers',
    url: 'https://candidat.francetravail.fr/metierscope/',
    serviceName: 'Metierscope'
  },
  {
    id: 'p-54',
    category: PlanAction.Objectif.DECOUVRIR_METIERS,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "Je consulte des vidéos sur les métiers qui m'intéresse (YouTube, tiktok)",
    url: null,
    serviceName: null
  },
  {
    id: 'p-55',
    category: PlanAction.Objectif.DECOUVRIR_METIERS,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "J'échange avec des proches qui connaissent ou exercent ce métier",
    url: null,
    serviceName: null
  },
  {
    id: 'p-56',
    category: PlanAction.Objectif.DECOUVRIR_METIERS,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "J'échange avec des professionnels qui travaillent dans ce secteur d'activité",
    url: null,
    serviceName: null
  },
  {
    id: 'p-57',
    category: PlanAction.Objectif.DECOUVRIR_METIERS,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je recherche une entreprise succeptible de m'interesser",
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-58',
    category: PlanAction.Objectif.DECOUVRIR_METIERS,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je recherche une immersion pour découvrir un métier quelques jours dans une entreprise',
    url: 'https://immersion-facile.beta.gouv.fr/',
    serviceName: 'Immersion Facilitée'
  },
  {
    id: 'p-59',
    category: PlanAction.Objectif.DECOUVRIR_METIERS,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "J'effectue une immersion en entreprise",
    url: null,
    serviceName: null
  },
  {
    id: 'p-63',
    category: PlanAction.Objectif.DECOUVRIR_METIERS,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je me renseigne sur l'alternance",
    url: null,
    serviceName: null
  },
  {
    id: 'p-64',
    category: PlanAction.Objectif.DECOUVRIR_METIERS,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: 'Je consulte des offres en alternance',
    url: null,
    serviceName: null
  },
  {
    id: 'p-66',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je consulte des sites d'orientation",
    url: 'https://www.onisep.fr/',
    serviceName: 'ONISEP'
  },
  {
    id: 'p-67',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label:
      "Je recherche un forum d'orientation ou de formation près de chez moi",
    url: null,
    serviceName: null
  },
  {
    id: 'p-68',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je prends contact avec le Centre d'Information et d'Orientation le plus proche de mon domicile",
    url: 'https://lannuaire.service-public.gouv.fr/navigation/cio',
    serviceName: 'CIO'
  },
  {
    id: 'p-69',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des informations sur une formation',
    url: 'https://www.francetravail.fr/candidat/vos-services-en-ligne/applications-mobiles/application-mobile-formation.html',
    serviceName: 'Ma formation France Travail'
  },
  {
    id: 'p-70',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des informations sur une formation',
    url: 'https://www.intercariforef.org/formations/recherche-formations.html',
    serviceName: 'Intercarif-oref'
  },
  {
    id: 'p-71',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des informations sur une formation à distance',
    url: 'https://www.intercariforef.org/formations/recherche-avancee-formations.html',
    serviceName: 'Intercarif-oref'
  },
  {
    id: 'p-72',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des informations sur une formation',
    url: 'https://www.onisep.fr/recherche/formations',
    serviceName: 'ONISEP'
  },
  {
    id: 'p-73',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des informations sur une formation',
    url: 'https://www.moncompteformation.gouv.fr/espace-prive/html/#/formation/recherche',
    serviceName: 'MonCompteFormation'
  },
  {
    id: 'p-75',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me renseigne sur l'alternance",
    url: 'https://labonnealternance.apprentissage.beta.gouv.fr/guide-alternant',
    serviceName: 'La bonne alternance'
  },
  {
    id: 'p-76',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je consulte des offres en alternance',
    url: 'https://labonnealternance.apprentissage.beta.gouv.fr/recherche',
    serviceName: 'La bonne alternance'
  },
  {
    id: 'p-77',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: 'Je consulte des offres en alternance',
    url: null,
    serviceName: null
  },
  {
    id: 'p-78',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "J'effectue des candidatures spontanées en entreprise",
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'g-312',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche un organisme de formation en alternance',
    url: 'https://labonnealternance.apprentissage.beta.gouv.fr/recherche?mode=formations',
    serviceName: 'La bonne alternance'
  },
  {
    id: 'p-79',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      'Je me renseigne sur les centres de formation qui prépare au BAFA ou au BAFD',
    url: null,
    serviceName: null
  },
  {
    id: 'p-80',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "Je me renseigne sur les aides financières existantes pour m'aider à financer mon BAFA ou mon BAFD",
    url: null,
    serviceName: null
  },
  {
    id: 'p-81',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur la POE',
    url: 'https://www.francetravail.fr/candidat/en-formation/mes-aides-financieres/la-preparation-operationnelle-a.html',
    serviceName: 'POE'
  },
  {
    id: 'p-82',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: 25,
    territory: "Territoires d'Outre-mer",
    kind: 'link',
    label:
      "Je vis dans un territoire d'Outre-mer et je me renseigne sur le Service Militaire Adapté",
    url: 'https://www.le-sma.com/',
    serviceName: 'Service Militaire Adapté'
  },
  {
    id: 'p-83',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 18,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur le Service Militaire Volontaire',
    url: 'https://www.le-smv.gouv.fr/',
    serviceName: 'Service Militaire Volontaire'
  },
  {
    id: 'p-84',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "Je prends contact avec l'organisme qui dispense la formation que je souhaite effectuer",
    url: null,
    serviceName: null
  },
  {
    id: 'p-85',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je constitue le dossier de candidature pour intégrer la formation',
    url: null,
    serviceName: null
  },
  {
    id: 'p-86',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je passe les test d'entrée ou entretien pour intégrer la formation",
    url: null,
    serviceName: null
  },
  {
    id: 'p-87',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je me renseigne sur les financements auxquels je peux prétendre',
    url: null,
    serviceName: null
  },
  {
    id: 'p-88',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur les financements auxquels je peux prétendre',
    url: 'https://www.moncompteformation.gouv.fr/espace-prive/html/#/droits',
    serviceName: 'MonCompteFormation'
  },
  {
    id: 'p-89',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je monte le dossier de financement de la formation',
    url: null,
    serviceName: null
  },
  {
    id: 'p-90',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      'Je mets à jour mon CV avec mes nouvelles compétences acquises lors de la formation',
    url: null,
    serviceName: null
  },
  {
    id: 'p-91',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je me renseigne sur les aides financières pour faire garder mes enfants',
    url: 'https://www.francetravail.fr/candidat/en-formation/les-dispositifs/formation---laide-a-la-garde-den.html',
    serviceName: "Aide à la garde d'enfants France Travail"
  },
  {
    id: 'p-92',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je simule mes droits à une allocation formation',
    url: 'https://candidat.francetravail.fr/portail-simulateurs/allocations-et-aides/parcours/votre-situation',
    serviceName: 'Allocation formation'
  },
  {
    id: 'p-93',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je prends connaissance du calendrier Parcoursup',
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-94',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "J'explore les formations Post-Bac",
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-95',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je découvre les filières, les écoles et les débouchés',
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-96',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me renseigne sur les journées portes ouvertes et visites d'écoles",
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-97',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je participe à des journées portes ouvertes et visites d'écoles",
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-98',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je choisis mes vœux',
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-99',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je rédige mes lettres de motivation',
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-100',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je remplis mon dossier pour les vœux que j'ai sélectionnés",
    url: 'https://www.parcoursup.gouv.fr/',
    serviceName: 'Parcoursup'
  },
  {
    id: 'p-101',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je prends connaissance du calendrier Mon Master',
    url: 'https://monmaster.gouv.fr/formation',
    serviceName: 'Mon Master'
  },
  {
    id: 'p-102',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "J'explore les formations proposés en Master",
    url: 'https://monmaster.gouv.fr/formation',
    serviceName: 'Mon Master'
  },
  {
    id: 'p-103',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je découvre les filières, les écoles et les débouchés en Master',
    url: 'https://monmaster.gouv.fr/formation',
    serviceName: 'Mon Master'
  },
  {
    id: 'p-104',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je participe à des journées portes ouvertes et visites de Master',
    url: null,
    serviceName: null
  },
  {
    id: 'p-105',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je rédige mes lettres de motivation',
    url: null,
    serviceName: null
  },
  {
    id: 'p-106',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je choisis mes vœux de Master',
    url: 'https://monmaster.gouv.fr/formation',
    serviceName: 'Mon Master'
  },
  {
    id: 'p-107',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je remplis mon dossier pour les vœux de Masters que j'ai sélectionnés",
    url: 'https://monmaster.gouv.fr/formation',
    serviceName: 'Mon Master'
  },
  {
    id: 'p-108',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [PlanAction.Situation.EMPLOI, PlanAction.Situation.AUTRE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur la VAE',
    url: 'https://vae.gouv.fr/espace-candidat/',
    serviceName: 'France VAE'
  },
  {
    id: 'p-109',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [PlanAction.Situation.EMPLOI, PlanAction.Situation.AUTRE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je recherche le diplôme qui correspond à mon expérience professionnelle',
    url: 'https://vae.gouv.fr/espace-candidat/',
    serviceName: 'France VAE'
  },
  {
    id: 'p-110',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je teste mes compétences numériques',
    url: 'https://pix.fr/',
    serviceName: 'PIX'
  },
  {
    id: 'p-111',
    category: PlanAction.Objectif.FORMER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me former au numérique',
    url: 'https://pix.fr/',
    serviceName: 'PIX'
  },
  {
    id: 'p-113',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.COLLEGE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des propositions de stage de 3eme',
    url: 'https://www.1eleve1stage.education.gouv.fr/eleves',
    serviceName: '1 Jeune 1 Stage'
  },
  {
    id: 'p-114',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.COLLEGE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des propositions de stage de 3eme',
    url: 'https://www.jobirl.com/stages-alternance/stage-decouverte',
    serviceName: 'Jobirl'
  },
  {
    id: 'p-115',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.COLLEGE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je consulte une liste d'entreprises",
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-116',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.COLLEGE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je prépare ma candidature',
    url: 'https://cvdesignr.com/fr/cv-curriculum-vitae',
    serviceName: 'CV Designer'
  },
  {
    id: 'p-117',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.LYCEE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des propositions de stage de seconde',
    url: 'https://www.1eleve1stage.education.gouv.fr/eleves?grade_id=1',
    serviceName: '1 Jeune 1 Stage'
  },
  {
    id: 'p-118',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.LYCEE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des propositions de stage de seconde',
    url: 'https://www.hellowork.com/fr-fr/stage/mot-cle_seconde.html',
    serviceName: 'Hellowork'
  },
  {
    id: 'p-119',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.LYCEE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des propositions de stage de seconde',
    url: 'https://www.jobirl.com/stages-alternance/stage-seconde',
    serviceName: 'Jobirl'
  },
  {
    id: 'p-120',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.LYCEE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je consulte une liste d'entreprises pour envoyer ma candidature",
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-121',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.LYCEE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je prépare ma candidature',
    url: 'https://cvdesignr.com/fr/cv-curriculum-vitae',
    serviceName: 'CV Designer'
  },
  {
    id: 'p-122',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.ETUDES_SUPERIEURES],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des propositions de stage',
    url: 'https://www.hellowork.com/fr-fr/stage.html',
    serviceName: 'Hellowork'
  },
  {
    id: 'p-123',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.ETUDES_SUPERIEURES],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je consulte une liste d'entreprises pour envoyer des candidatures spontanées",
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-124',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.ETUDES_SUPERIEURES],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je prépare mon CV',
    url: 'https://cvdesignr.com/fr/cv-curriculum-vitae',
    serviceName: 'CV Designer'
  },
  {
    id: 'g-313',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [PlanAction.Situation.ETUDES_SUPERIEURES],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je prépare ma lettre de motivation',
    url: 'https://france-travail.convertigo.net/convertigo/projects/generateur_lettre_motivation_poleemploi/DisplayObjects/mobile/accueil',
    serviceName: 'Lettre de motivation en ligne'
  },
  {
    id: 'p-125',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je consulte les propositions d'immersion",
    url: 'https://immersion-facile.beta.gouv.fr/',
    serviceName: 'Immersion Facilitée'
  },
  {
    id: 'p-126',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je postule à une immersion',
    url: 'https://immersion-facile.beta.gouv.fr/',
    serviceName: 'Immersion Facilitée'
  },
  {
    id: 'p-127',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je consulte la Bonne Boite et faire des candidatures spontanées',
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-128',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "J'entame les démarches avec l'employeur pour effectuer mon immersion",
    url: null,
    serviceName: null
  },
  {
    id: 'p-129',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je m'assure que l'employeur à valider ma demande d'immersion",
    url: null,
    serviceName: null
  },
  {
    id: 'p-130',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je réalise mon immersion',
    url: null,
    serviceName: null
  },
  {
    id: 'p-131',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je remplis le bilan de l'immersion avec l'employeur",
    url: 'https://immersion-facile.beta.gouv.fr/',
    serviceName: 'Immersion Facilitée'
  },
  {
    id: 'p-132',
    category: PlanAction.Objectif.STAGE_IMMERSION,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je mets à jour mon CV en indiquant ma période d'immersion",
    url: null,
    serviceName: null
  },
  {
    id: 'p-134',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me renseigne sur l'alternance",
    url: 'https://labonnealternance.apprentissage.beta.gouv.fr/guide-alternant',
    serviceName: 'La bonne alternance'
  },
  {
    id: 'p-135',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je consulte des offres en alternance',
    url: 'https://labonnealternance.apprentissage.beta.gouv.fr/recherche',
    serviceName: 'La bonne alternance'
  },
  {
    id: 'p-136',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: 'Je consulte des offres en alternance',
    url: null,
    serviceName: null
  },
  {
    id: 'p-137',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je recherche des entreprises pour effectuer des candidatures spontanées en alternance',
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-138',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je recherche des entreprises pour envoyer des candidatures spontanées',
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-139',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "J'envoie une candidature spontanée à une entreprise",
    url: null,
    serviceName: null
  },
  {
    id: 'p-140',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me prépare à mon entretien d'embauche",
    url: 'https://www.emploi-store.fr/static/esu/services/ENTRETIEN/index.html',
    serviceName: 'B A-BA entretien'
  },
  {
    id: 'p-141',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      'Je remercie un employeur après un entretien et confirme mon intérêt pour le poste',
    url: null,
    serviceName: null
  },
  {
    id: 'p-142',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je crée un tableau de suivi de mes candidatures',
    url: null,
    serviceName: null
  },
  {
    id: 'p-143',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je relance un employeur au sujet de ma candidature',
    url: null,
    serviceName: null
  },
  {
    id: 'p-144',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je suis un atelier en ligne pour m'aider à créer un CV",
    url: 'https://france-travail.convertigo.net/convertigo/projects/generateur_lettre_motivation_poleemploi/DisplayObjects/mobile/accueil',
    serviceName: 'B A-BA CV'
  },
  {
    id: 'p-145',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [PlanAction.Situation.EMPLOI, PlanAction.Situation.AUTRE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: 'Je recherche un atelier pour créer mon CV',
    url: null,
    serviceName: null
  },
  {
    id: 'p-146',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je crée mon CV',
    url: 'https://plateforme.diagoriente.fr/appli-cv/',
    serviceName: 'Diagoriente'
  },
  {
    id: 'p-147',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je crée mon CV',
    url: 'https://cvdesignr.com/fr',
    serviceName: 'CV Designer'
  },
  {
    id: 'p-148',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je suis un MOOC pour m'aider à créer une lettre de motivation",
    url: null,
    serviceName: null
  },
  {
    id: 'p-149',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je crée ma lettre de motivation en ligne',
    url: 'https://france-travail.convertigo.net/convertigo/projects/generateur_lettre_motivation_poleemploi/DisplayObjects/mobile/accueil',
    serviceName: 'Lettre de motivation en ligne'
  },
  {
    id: 'p-150',
    category: PlanAction.Objectif.ALTERNANCE,
    blocker: null,
    situations: [PlanAction.Situation.EMPLOI, PlanAction.Situation.AUTRE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je recherche un atelier pour écrire une lettre de motivation',
    url: null,
    serviceName: null
  },
  {
    id: 'p-152',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: "J'effectue une recherche d'emploi sur mon application",
    url: null,
    serviceName: null
  },
  {
    id: 'p-153',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "J'effectue une recherche d'emploi sur Le bon Coin",
    url: 'https://www.leboncoin.fr/c/offres_d_emploi',
    serviceName: 'Le Bon Coin'
  },
  {
    id: 'p-154',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "J'effectue une recherche d'emploi sur Welcome to the jungle",
    url: 'https://www.welcometothejungle.com/fr/jobs',
    serviceName: 'Welcome to the Jungle'
  },
  {
    id: 'p-155',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je recherche des entreprises pour envoyer des candidatures spontanées',
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-156',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "J'envoie une candidature spontanée à une entreprise",
    url: null,
    serviceName: null
  },
  {
    id: 'p-157',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me prépare à mon entretien d'embauche",
    url: 'https://www.emploi-store.fr/static/esu/services/ENTRETIEN/index.html',
    serviceName: 'B A-BA entretien'
  },
  {
    id: 'p-158',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      'Je remercie un employeur après un entretien et confirme mon intérêt pour le poste',
    url: null,
    serviceName: null
  },
  {
    id: 'p-159',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je crée un tableau de suivi de mes candidatures',
    url: null,
    serviceName: null
  },
  {
    id: 'p-160',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je relance un employeur au sujet de ma candidature',
    url: null,
    serviceName: null
  },
  {
    id: 'p-161',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je suis un atelier en ligne pour m'aider à créer un CV",
    url: 'https://france-travail.convertigo.net/convertigo/projects/generateur_lettre_motivation_poleemploi/DisplayObjects/mobile/accueil',
    serviceName: 'B A-BA CV'
  },
  {
    id: 'p-162',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [PlanAction.Situation.EMPLOI, PlanAction.Situation.AUTRE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: 'Je recherche un atelier pour créer mon CV',
    url: null,
    serviceName: null
  },
  {
    id: 'p-163',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je crée mon CV',
    url: 'https://plateforme.diagoriente.fr/appli-cv/',
    serviceName: 'Diagoriente'
  },
  {
    id: 'p-164',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je crée mon CV',
    url: 'https://cvdesignr.com/fr',
    serviceName: 'CV Designer'
  },
  {
    id: 'p-165',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je suis un MOOC pour m'aider à créer un CV",
    url: null,
    serviceName: null
  },
  {
    id: 'p-166',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je crée ma lettre de motivation en ligne',
    url: 'https://france-travail.convertigo.net/convertigo/projects/generateur_lettre_motivation_poleemploi/DisplayObjects/mobile/accueil',
    serviceName: 'Lettre de motivation en ligne'
  },
  {
    id: 'p-167',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [PlanAction.Situation.EMPLOI, PlanAction.Situation.AUTRE],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je recherche un atelier pour écrire une lettre de motivation',
    url: null,
    serviceName: null
  },
  {
    id: 'p-169',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je crée un profil sur LinkedIn',
    url: 'https://www.linkedin.com/',
    serviceName: 'LinkedIn'
  },
  {
    id: 'p-170',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      'Je personnalise mon CV et ma lettre de motivation en fonction du poste auquel je postule',
    url: null,
    serviceName: null
  },
  {
    id: 'p-171',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je me prépare à un entretien de recrutement',
    url: null,
    serviceName: null
  },
  {
    id: 'p-172',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label:
      'Je consulte les offres de Missions Intérimaires sur mon application',
    url: null,
    serviceName: null
  },
  {
    id: 'p-173',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "Je m'inscris sur les sites des agences intérimaires (exemple : Manpower, Randstad, Synergie, Proman, CRIT…)",
    url: null,
    serviceName: null
  },
  {
    id: 'p-174',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je consulte les offres sur les sites des agences intérimaires',
    url: null,
    serviceName: null
  },
  {
    id: 'p-175',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je postule à une offre sur les sites des agences intérimaires',
    url: null,
    serviceName: null
  },
  {
    id: 'p-176',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je me présente auprès de l'agence intérimaire",
    url: null,
    serviceName: null
  },
  {
    id: 'p-177',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "Je contacte l'agence intérimaire pour lui faire part de mon intérêt pour une offre",
    url: null,
    serviceName: null
  },
  {
    id: 'p-178',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: 'Je recherche un forum pour les emplois saisonniers',
    url: null,
    serviceName: null
  },
  {
    id: 'p-179',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'app',
    label: 'Je consulte les offres avec le filtre saisonnier',
    url: null,
    serviceName: null
  },
  {
    id: 'p-180',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      'Je recherche des entreprises pour effectuer des candidatures spontanées en emploi saisonnier',
    url: null,
    serviceName: null
  },
  {
    id: 'p-181',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je remercie un employeur et je confirme mon intérêt pour un poste',
    url: null,
    serviceName: null
  },
  {
    id: 'p-182',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "J'effectue le suivi de mes candidatures",
    url: null,
    serviceName: null
  },
  {
    id: 'p-183',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je relance un employeur au sujet de ma candidature',
    url: null,
    serviceName: null
  },
  {
    id: 'p-184',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je signe mon contrat (CDD,CDI, intérim, alternance etc..)',
    url: null,
    serviceName: null
  },
  {
    id: 'p-185',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je consulte les propositions d'immersion",
    url: 'https://immersion-facile.beta.gouv.fr/',
    serviceName: 'Immersion Facilitée'
  },
  {
    id: 'p-186',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je postule à une immersion',
    url: 'https://immersion-facile.beta.gouv.fr/',
    serviceName: 'Immersion Facilitée'
  },
  {
    id: 'p-187',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Consulter la Bonne Boite et faire des candidatures spontanées',
    url: 'https://labonneboite.francetravail.fr/',
    serviceName: 'La Bonne Boîte'
  },
  {
    id: 'p-188',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "J'entame les démarches avec l'employeur pour effectuer mon immersion",
    url: null,
    serviceName: null
  },
  {
    id: 'p-189',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je m'assure que l'employeur à valider ma demande d'immersion",
    url: null,
    serviceName: null
  },
  {
    id: 'p-190',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je réalise mon immersion',
    url: null,
    serviceName: null
  },
  {
    id: 'p-191',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je remplis le bilan de l'immersion avec l'employeur",
    url: 'https://immersion-facile.beta.gouv.fr/',
    serviceName: 'Immersion Facilitée'
  },
  {
    id: 'p-192',
    category: PlanAction.Objectif.EMPLOI,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je mets à jour mon CV en indiquant ma période d'immersion",
    url: null,
    serviceName: null
  },
  {
    id: 'p-194',
    category: PlanAction.Objectif.ENGAGER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label: 'Je consulte les offres de bénévolat',
    url: 'https://www.jeveuxaider.gouv.fr/',
    serviceName: 'JeVeuxAider'
  },
  {
    id: 'p-195',
    category: PlanAction.Objectif.ENGAGER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: 25,
    territory: null,
    kind: 'app',
    label: 'Je consulte les offres de service civique',
    url: null,
    serviceName: null
  },
  {
    id: 'p-196',
    category: PlanAction.Objectif.ENGAGER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: 25,
    territory: null,
    kind: 'app',
    label: "Je m'inscrit sur la plateforme de service civique",
    url: null,
    serviceName: null
  },
  {
    id: 'p-197',
    category: PlanAction.Objectif.ENGAGER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: 25,
    territory: null,
    kind: 'advice',
    label: 'Je postule à une offre de service civique',
    url: null,
    serviceName: null
  },
  {
    id: 'p-199',
    category: PlanAction.Objectif.ENGAGER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur le site 1 Jeune 1 Mentor',
    url: 'https://www.1jeune1mentor.fr/',
    serviceName: '1 Jeune 1 mentor'
  },
  {
    id: 'p-200',
    category: PlanAction.Objectif.ENGAGER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je dépose ma candidature sur le Site 1 Jeune 1 Mentor',
    url: 'https://www.1jeune1mentor.fr/',
    serviceName: '1 Jeune 1 mentor'
  },
  {
    id: 'p-201',
    category: PlanAction.Objectif.ENGAGER,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je commence ma mission de mentorat',
    url: null,
    serviceName: null
  },
  {
    id: 'p-204',
    category: PlanAction.Objectif.MOBILITE_INTERNATIONALE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je consulte les offres d'empoi à l'étranger",
    url: 'https://europa.eu/eures/portal/jv-se/home?lang=fr',
    serviceName: 'EURES'
  },
  {
    id: 'p-205',
    category: PlanAction.Objectif.MOBILITE_INTERNATIONALE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur Erasmus +',
    url: 'https://agence.erasmusplus.fr/',
    serviceName: 'Erasmus +'
  },
  {
    id: 'p-206',
    category: PlanAction.Objectif.MOBILITE_INTERNATIONALE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 18,
    maxAge: 30,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur le Corps Volontaire de Solidarité',
    url: 'https://www.corpseuropeensolidarite.fr/',
    serviceName: 'Corps Européen de solidarité'
  },
  {
    id: 'p-207',
    category: PlanAction.Objectif.MOBILITE_INTERNATIONALE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 18,
    maxAge: 28,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur le Volontariat International (VIE et VIA)',
    url: 'https://mon-vie-via.businessfrance.fr/',
    serviceName: 'VIE et VIA'
  },
  {
    id: 'p-208',
    category: PlanAction.Objectif.MOBILITE_INTERNATIONALE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 18,
    maxAge: 28,
    territory: null,
    kind: 'link',
    label: 'Je dépose un dossier VIE/VIA',
    url: 'https://mon-vie-via.businessfrance.fr/',
    serviceName: 'VIE et VIA'
  },
  {
    id: 'p-209',
    category: PlanAction.Objectif.MOBILITE_INTERNATIONALE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 18,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur le Permis Vacances Travail (PVT/WHV)',
    url: 'https://working-holiday-visas.com/',
    serviceName: 'PVT/WHV'
  },
  {
    id: 'p-211',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je prends contact avec le Centre d'Information et d'Orientation le plus proche de mon domicile pour être aidé dans mon orientation",
    url: 'https://lannuaire.service-public.gouv.fr/navigation/cio',
    serviceName: 'CIO'
  },
  {
    id: 'p-212',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [Profil.Structure.INVITE],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'app',
    label:
      "Je prends contact avec l'agence France Travail ou la Mission Locale la plus proche de mon domicile",
    url: null,
    serviceName: null
  },
  {
    id: 'p-213',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label:
      "Je me renseigne sur le Contrat d'Engagement Jeunes pour être accompagné par un conseiller",
    url: 'https://www.1jeune1solution.gouv.fr/contrat-engagement-jeune',
    serviceName: 'Contrat Engagement Jeunes'
  },
  {
    id: 'p-214',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne pour être accompagné par un mentor',
    url: 'https://www.1jeune1mentor.fr/pourquoi-etre-mentore#pourquoi-trouver-un-mentor',
    serviceName: '1 Jeune 1 mentor'
  },
  {
    id: 'p-215',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je m'inscrits pour être mis en contact avec un mentor",
    url: 'https://www.1jeune1mentor.fr/formulaire-jeune',
    serviceName: '1 Jeune 1 mentor'
  },
  {
    id: 'p-217',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je recherche une Maison France Service près de chez moi pour être aidé dans mes démarches administratives',
    url: 'https://www.france-services.gouv.fr/',
    serviceName: 'Maison France Service'
  },
  {
    id: 'p-218',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label:
      'Je me renseigne sur les Ecoles de la 2eme Chance pour suivre une formation',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2039',
    serviceName: 'Ecoles de la 2eme Chance'
  },
  {
    id: 'p-219',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label:
      "Je cherche l'Ecole de la 2ème chance la plus proche de mon domicile",
    url: 'https://reseau-e2c.fr/cartographie-des-e2c',
    serviceName: 'Ecoles de la 2eme Chance'
  },
  {
    id: 'p-220',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: 25,
    territory: null,
    kind: 'advice',
    label: 'Je prends contact avec une Ecole de la 2eme chance',
    url: null,
    serviceName: null
  },
  {
    id: 'p-221',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 17,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur les Epide',
    url: 'https://travail-emploi.gouv.fr/letablissement-pour-linsertion-dans-lemploi-epide',
    serviceName: 'Epide'
  },
  {
    id: 'p-222',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 17,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label: "Je recherche l'Epide le plus proche de mon domicile",
    url: 'https://www.epide.fr/',
    serviceName: 'Epide'
  },
  {
    id: 'p-223',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 17,
    maxAge: 25,
    territory: null,
    kind: 'advice',
    label: 'Je prends contact avec un Epide',
    url: null,
    serviceName: null
  },
  {
    id: 'p-224',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: 25,
    territory: "Territoires d'Outre-mer",
    kind: 'link',
    label:
      "Je vis dans un territoire d'Outre-mer et je me renseigne sur le Service Militaire Adapté",
    url: 'https://www.le-sma.com/',
    serviceName: 'Service Militaire Adapté'
  },
  {
    id: 'p-225',
    category: PlanAction.Objectif.ACCOMPAGNE,
    blocker: null,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 18,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur le Service Militaire Volontaire',
    url: 'https://www.le-smv.gouv.fr/',
    serviceName: 'Service Militaire Volontaire'
  },
  {
    id: 'p-229',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [Profil.Structure.INVITE],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'app',
    label:
      "Je contact L'agence France Travail ou la Mission Locale la plus proche de chez moi pour être accompagné par un conseiller",
    url: null,
    serviceName: null
  },
  {
    id: 'p-231',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je recherche le meilleur réseau d'accompagnement selon mes besoins",
    url: 'https://bpifrance-creation.fr/boiteaoutils/infographie-entrepreneurs-trouvez-bon-reseau-daccompagnement-vos-besoins',
    serviceName: 'BPI France'
  },
  {
    id: 'p-232',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      "Je prends contact avec le réseau d'accompagnement qui convient le mieux à mon projet de création",
    url: null,
    serviceName: null
  },
  {
    id: 'p-233',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je travaille mon business plan et mon étude de marché',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F35965',
    serviceName: 'Service Public Entreprendre'
  },
  {
    id: 'p-234',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me renseigne sur l'ACRE (Aide à la Création ou à la Reprise d'Entreprise",
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F11677',
    serviceName: 'Service Public Entreprendre'
  },
  {
    id: 'p-235',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je fais une demande d'ACRE",
    url: null,
    serviceName: null
  },
  {
    id: 'p-236',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je suis indemnisé par France Travail et je me renseigne sur l'ARCE",
    url: 'https://www.francetravail.fr/candidat/je-creereprends-une-entreprise/les-aides-financieres-creation-d/aide-a-la-reprise-et-a-la-creati.html',
    serviceName: 'ARCE France Travail'
  },
  {
    id: 'p-237',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me renseigne sur les microcrédits de l'ADIE",
    url: 'https://www.adie.org/',
    serviceName: 'ADIE'
  },
  {
    id: 'p-238',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me renseigne sur le prêt d'honneur Initiative",
    url: 'https://www.initiative-france.fr/nos-solutions/financement-le-pret-d-honneur.html',
    serviceName: 'Initiative France'
  },
  {
    id: 'p-239',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sue les financements France Active',
    url: 'https://www.franceactive.org/accelerer-votre-reussite/vous-etes-pret-e-s-a-creer-votre-entreprise/',
    serviceName: 'France Active'
  },
  {
    id: 'p-240',
    category: PlanAction.Objectif.CREER_ACTIVITE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 16,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "J'explore les différents statuts d'entreprises",
    url: 'https://bpifrance-creation.fr/encyclopedie/structures-juridiques/choix-du-statut-generalites/quel-statut-juridique-choisir-son',
    serviceName: 'BPI France'
  },
  {
    id: 'g-311',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je simule l'ensemble des aides auxquelles je peux prétendre",
    url: 'https://mes-aides.1jeune1solution.beta.gouv.fr/',
    serviceName: 'Aides Jeunes'
  },
  {
    id: 'p-243',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je consulte les aides financières auxquelles j'ai droit pour faire du sport",
    url: 'https://pass.sport.gouv.fr',
    serviceName: 'Pass Sport'
  },
  {
    id: 'p-244',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE,
      PlanAction.Situation.COLLEGE
    ],
    structures: [],
    minAge: 15,
    maxAge: 21,
    territory: null,
    kind: 'link',
    label:
      "Je consulte les aides financières auxquelles j'ai droit pour ma culture et mes loisirs",
    url: 'https://pass.culture.fr',
    serviceName: 'Pass culture'
  },
  {
    id: 'p-245',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: 18,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label:
      "Je me renseigne sur l'aide au départ en vacances pour les 18-25 ans",
    url: 'https://depart1825.com/cest-quoi/',
    serviceName: 'Aide départ 18/25'
  },
  {
    id: 'p-246',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me rapproche d'une association pour bénéficier d'une aide alimentaire",
    url: 'https://episol.net',
    serviceName: 'Epiceries solidaires'
  },
  {
    id: 'p-247',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me rapproche d'une association pour bénéficier d'une aide alimentaire",
    url: 'https://banquealimentaire.fr',
    serviceName: 'Banques alimentaires'
  },
  {
    id: 'p-248',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me rapproche d'une association pour bénéficier d'une aide alimentaire",
    url: 'https://restoducoeur.org',
    serviceName: 'Resto du cœur'
  },
  {
    id: 'p-249',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me renseigne sur l'offre coup de pouce internet pour bénéficier un accès Internet-TV-Téléphone fixe, un ordinateur reconditionné et un accompagnement au numérique à prix solidaire",
    url: 'https://boutique.orange.fr/informations/offre-sociale/',
    serviceName: 'Forfait coup de pouce Orange'
  },
  {
    id: 'p-250',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE,
      PlanAction.Situation.LYCEE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je recherche une Maison France Service près de chez moi pour être aidé dans mes démarches administratives',
    url: 'https://www.france-services.gouv.fr/',
    serviceName: 'Maison France Service'
  },
  {
    id: 'p-251',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "J'effectue ma demande en ligne d'inscription sur les listes electorales",
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/R16396',
    serviceName: 'Listes électoales'
  },
  {
    id: 'p-252',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "J'effectue ma demande en ligne de recensement citoyen obligatoire",
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/R2054',
    serviceName: 'Recencement citoyen obligatoire'
  },
  {
    id: 'p-253',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE,
      PlanAction.Situation.ETUDES_SUPERIEURES
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur la journée défense et citoyenneté',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F871',
    serviceName: 'Journée défense et citoyenneté'
  },
  {
    id: 'p-254',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE,
      PlanAction.Situation.LYCEE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me renseigne sur l'aide juridictionnelle (aide financière pour prise en charge des frais de justice)",
    url: 'https://www.aidejuridictionnelle.justice.fr/',
    serviceName: 'Aide juridictionnelle'
  },
  {
    id: 'p-255',
    category: PlanAction.Objectif.VIE_QUOTIDIENNE,
    blocker: null,
    situations: [
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE,
      PlanAction.Situation.LYCEE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je recherche les coordonnées du point-justice le plus proche de mon domicile pour bénéficier d'un conseil juridique ou d'accès aux droits",
    url: 'https://www.justice.gouv.fr/annuaire/lieux-daccueil-dinformation/point-justice',
    serviceName: 'Point-justice'
  },
  {
    id: 'p-259',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_PERMIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur les aides au permis',
    url: 'https://mes-aides.francetravail.fr/mobilite/financer-vos-permis',
    serviceName: 'Mes aides France Travail'
  },
  {
    id: 'p-260',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_PERMIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche une auto-école proche de mon domicile',
    url: 'https://autoecoles.securite-routiere.gouv.fr/#/',
    serviceName: 'Mes aides France Travail'
  },
  {
    id: 'p-261',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_PERMIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je fais une demande de devis dans une auto-école',
    url: null,
    serviceName: null
  },
  {
    id: 'p-262',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_PERMIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur le permis à 1 euro',
    url: 'https://www.securite-routiere.gouv.fr/passer-son-permis-de-conduire/financement-du-permis-de-conduire/permis-1-eu-par-jour/definition-du-permis-1-eu-par-jour',
    serviceName: 'Permis à 1 euro'
  },
  {
    id: 'p-263',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_PERMIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je m'inscris dans une auto-école",
    url: null,
    serviceName: null
  },
  {
    id: 'p-264',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_PERMIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je prépare le code la route',
    url: null,
    serviceName: null
  },
  {
    id: 'p-265',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_PERMIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je passe l'examen du code de la route",
    url: null,
    serviceName: null
  },
  {
    id: 'p-266',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_PERMIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je suis ma première leçon de conduite',
    url: null,
    serviceName: null
  },
  {
    id: 'p-267',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_PERMIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "Je passe l'examen du permis de conduire",
    url: null,
    serviceName: null
  },
  {
    id: 'p-275',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_TRANSPORT,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur les garages solidaires',
    url: 'https://mes-aides.francetravail.fr/transport/reparer-votre-vehicule',
    serviceName: 'Mes aides France Travail'
  },
  {
    id: 'p-276',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_TRANSPORT,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me renseigne sur les aides à la location d'un véhicule",
    url: 'https://mes-aides.francetravail.fr/transport/acheter-ou-louer-un-vehicule',
    serviceName: 'Mes aides France Travail'
  },
  {
    id: 'p-277',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_TRANSPORT,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me renseigne sur les aides à la l'achat d'un vélo",
    url: 'https://mes-aides.francetravail.fr/transport/acheter-ou-louer-un-vehicule',
    serviceName: 'Mes aides France Travail'
  },
  {
    id: 'p-278',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_TRANSPORT,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur le covoiturage',
    url: 'https://mes-aides.francetravail.fr/transport/covoiturage-autopartage',
    serviceName: 'Mes aides France Travail'
  },
  {
    id: 'p-279',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_TRANSPORT,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me renseigne sur l'autopartage",
    url: 'https://mes-aides.francetravail.fr/transport/covoiturage-autopartage',
    serviceName: 'Mes aides France Travail'
  },
  {
    id: 'p-281',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "J'effectue une demande de domiciliation pour avoir une adresse et recevoir mon courrier",
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F17317',
    serviceName: 'Service-public.gouv.fr'
  },
  {
    id: 'p-282',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je consulte des sites de location de logements en ligne',
    url: null,
    serviceName: null
  },
  {
    id: 'p-283',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je me rends dans une agence immobilière',
    url: null,
    serviceName: null
  },
  {
    id: 'p-284',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je me renseigne sur la garantie visale comme garant pour mon nouveau logement',
    url: 'https://www.visale.fr/visale-pour-les-locataires/demarches/',
    serviceName: 'Garantie Visale'
  },
  {
    id: 'p-285',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je remploi le dossier pour obtenir une garantie pour mon nouveau logement',
    url: 'https://www.visale.fr/visale-pour-les-locataires/demarches/',
    serviceName: 'Garantie Visale'
  },
  {
    id: 'p-286',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je prépare un dossier en ligne certifié et sécurisé pour déposer une demande de logement',
    url: 'https://www.dossierfacile.logement.gouv.fr/',
    serviceName: 'Dossier Facile'
  },
  {
    id: 'p-287',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je fais une demande de logement CROUS',
    url: 'https://messervices.etudiant.gouv.fr/',
    serviceName: 'Mes services étudiants'
  },
  {
    id: 'p-288',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je fais une demande de logement CROUS',
    url: 'https://www.lokaviz.fr/',
    serviceName: 'Lokaviz'
  },
  {
    id: 'p-289',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je fais une demande de logement CROUS',
    url: 'https://trouverunlogement.lescrous.fr/',
    serviceName: 'Dossier Social Etudiant'
  },
  {
    id: 'p-290',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je fais une demande de logement CROUS',
    url: 'https://monlogementetudiant.beta.gouv.fr/',
    serviceName: 'MonLogementEtudiant'
  },
  {
    id: 'p-291',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: "J'entame des démarches auprès de Foyers Jeunes Travailleurs",
    url: null,
    serviceName: null
  },
  {
    id: 'p-292',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je consulte des hébergements du parc privé',
    url: null,
    serviceName: null
  },
  {
    id: 'p-293',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label:
      'Je fais une demande de prêt à 0% pour payer le dépôt de garantie de mon logemet',
    url: null,
    serviceName: null
  },
  {
    id: 'p-294',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur les aides personnelles au logement',
    url: 'https://www.caf.fr/allocataires/aides-et-demarches/droits-et-prestations/logement/les-aides-personnelles-au-logement',
    serviceName: 'CAF.fr'
  },
  {
    id: 'p-295',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "J'effectue une simulation puis une demande d'aide personnelle au logement",
    url: 'https://wwwd.caf.fr/wps/portal/caffr/aidesetdemarches/mesdemarches/faireunesimulation/lelogement#/preparation',
    serviceName: 'CAF.fr'
  },
  {
    id: 'p-296',
    category: null,
    blocker: PlanAction.Obstacle.PAS_DE_LOGEMENT,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche un logement saisonnier',
    url: 'https://mes-aides.francetravail.fr/logement/trouver-un-logement-saisonnier-ou-temporaire',
    serviceName: 'Mes aides France Travail'
  },
  {
    id: 'p-298',
    category: null,
    blocker: PlanAction.Obstacle.MANQUE_CONFIANCE,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur le mentorat',
    url: 'https://www.1jeune1mentor.fr/pourquoi-etre-mentore#pourquoi-trouver-un-mentor',
    serviceName: '1 Jeune 1 mentor'
  },
  {
    id: 'p-299',
    category: null,
    blocker: PlanAction.Obstacle.MANQUE_CONFIANCE,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je m'inscrits pour être mis en contact avec un mentor",
    url: 'https://www.1jeune1mentor.fr/formulaire-jeune',
    serviceName: '1 Jeune 1 mentor'
  },
  {
    id: 'p-300',
    category: null,
    blocker: PlanAction.Obstacle.MANQUE_CONFIANCE,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'advice',
    label: 'Je commence à être accompagné par un mentor',
    url: null,
    serviceName: null
  },
  {
    id: 'p-302',
    category: null,
    blocker: PlanAction.Obstacle.FIN_DE_MOIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je simule l'ensemble des aides auxquelles je peux prétendre",
    url: 'https://mes-aides.1jeune1solution.beta.gouv.fr/',
    serviceName: 'Aides Jeunes'
  },
  {
    id: 'p-304',
    category: null,
    blocker: PlanAction.Obstacle.FIN_DE_MOIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me rapproche d'une association pour bénéficier d'une aide alimentaire",
    url: 'https://episol.net',
    serviceName: 'Epiceries solidaires'
  },
  {
    id: 'p-305',
    category: null,
    blocker: PlanAction.Obstacle.FIN_DE_MOIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me rapproche d'une association pour bénéficier d'une aide alimentaire",
    url: 'https://banquealimentaire.fr',
    serviceName: 'Banques alimentaires'
  },
  {
    id: 'p-306',
    category: null,
    blocker: PlanAction.Obstacle.FIN_DE_MOIS,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je me rapproche d'une association pour bénéficier d'une aide alimentaire",
    url: 'https://restoducoeur.org',
    serviceName: 'Resto du cœur'
  },
  {
    id: 'p-312',
    category: null,
    blocker: PlanAction.Obstacle.HANDICAP,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      "Je consulte un site d'information, d'orientation et de services à destination des personnes en situation de handicap",
    url: 'https://www.monparcourshandicap.gouv.fr',
    serviceName: 'Mon parcours handicap'
  },
  {
    id: 'p-313',
    category: null,
    blocker: PlanAction.Obstacle.HANDICAP,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je consulte un site qui propose des solutions pour concilier emploi et handicap',
    url: 'https://www.agefiph.fr/personne-en-situation-de-handicap',
    serviceName: 'AGEFIPH'
  },
  {
    id: 'p-314',
    category: null,
    blocker: PlanAction.Obstacle.HANDICAP,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je cherche la maison départementale des personnes handicapées (MDPH) la plus proche de mon domicile',
    url: 'https://lannuaire.service-public.gouv.fr/navigation/maison_handicapees',
    serviceName: 'Service-public.gouv.fr'
  },
  {
    id: 'p-315',
    category: null,
    blocker: PlanAction.Obstacle.HANDICAP,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je me rensigne sur la reconnaissance en qualité de travailleur handicapé (RQTH)',
    url: 'https://www.monparcourshandicap.gouv.fr/aides/la-reconnaissance-de-la-qualite-de-travailleur-handicape-rqth',
    serviceName: 'Mon parcours handicap'
  },
  {
    id: 'p-316',
    category: null,
    blocker: PlanAction.Obstacle.HANDICAP,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: "Je me rensigne sur l'Allocation Adulte Handicapé (AAH)",
    url: 'https://www.monparcourshandicap.gouv.fr/aides/lallocation-aux-adultes-handicapes-aah',
    serviceName: 'Mon parcours handicap'
  },
  {
    id: 'p-317',
    category: null,
    blocker: PlanAction.Obstacle.HANDICAP,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je consulte de la diocumentation sur les aides dont je peux bénéficier en fonction de mon handicap',
    url: 'https://www.monparcourshandicap.gouv.fr/documentation/facile-lire-et-comprendre',
    serviceName: 'Mon parcours handicap'
  },
  {
    id: 'p-318',
    category: null,
    blocker: PlanAction.Obstacle.HANDICAP,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je suis en situation de handicap et je souhaite intégrer la fonction publique',
    url: 'https://www.fiphfp.fr/personnes-en-situation-de-handicap/evoluer-dans-la-fonction-publique/integrer-la-fonction-publique',
    serviceName: 'FIPHFP'
  },
  {
    id: 'p-320',
    category: null,
    blocker: PlanAction.Obstacle.SANTE,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label: 'Je prends soin de ma santé sur le site Fil Santé Jeunes',
    url: 'https://www.filsantejeunes.com/#',
    serviceName: 'Fil Santé Jeunes'
  },
  {
    id: 'p-321',
    category: null,
    blocker: PlanAction.Obstacle.SANTE,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: 25,
    territory: null,
    kind: 'link',
    label: 'Je prends en compte mes addictions',
    url: 'https://www.filsantejeunes.com/#',
    serviceName: 'Fil Santé Jeunes'
  },
  {
    id: 'p-322',
    category: null,
    blocker: PlanAction.Obstacle.SANTE,
    situations: [PlanAction.Situation.ETUDES_SUPERIEURES],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je me renseigne sur la prise en charge de séances avec un psychologue',
    url: 'https://santepsy.etudiant.gouv.fr/',
    serviceName: 'Santé Psy étudiant'
  },
  {
    id: 'p-323',
    category: null,
    blocker: PlanAction.Obstacle.SANTE,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me renseigne sur les aides pour une complémentaire santé',
    url: 'https://mes-aides.francetravail.fr/sante/acces-aux-soins/l-assurance-maladie/complementaire-sante-solidairec2s-',
    serviceName: 'Complémentaire santé universelle'
  },
  {
    id: 'p-326',
    category: null,
    blocker: PlanAction.Obstacle.GARDE_ENFANT,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je recherche le Relais Petite Enfance le plus proche de mon domicile pour me renseigner sur les différents modes de garde pour mon enfant',
    url: 'https://monenfant.fr/que-recherchez-vous',
    serviceName: 'Monenfant.fr'
  },
  {
    id: 'p-327',
    category: null,
    blocker: PlanAction.Obstacle.GARDE_ENFANT,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je rerecherche un mode de garde pour mon enfant',
    url: 'https://monenfant.fr/que-recherchez-vous',
    serviceName: 'Monenfant.fr'
  },
  {
    id: 'p-328',
    category: null,
    blocker: PlanAction.Obstacle.GARDE_ENFANT,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label:
      'Je me renseigne sur les aides financières pour faire garder mes enfants',
    url: 'https://www.francetravail.fr/candidat/en-formation/les-dispositifs/formation---laide-a-la-garde-den.html',
    serviceName: "Aide à la garde d'enfants France Travail"
  },
  {
    id: 'p-330',
    category: null,
    blocker: PlanAction.Obstacle.NUMERIQUE,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je teste mes compétences numériques',
    url: 'https://pix.fr/',
    serviceName: 'PIX'
  },
  {
    id: 'p-331',
    category: null,
    blocker: PlanAction.Obstacle.NUMERIQUE,
    situations: [
      PlanAction.Situation.COLLEGE,
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je me forme au numérique',
    url: 'https://pix.fr/',
    serviceName: 'PIX'
  },
  {
    id: 'g-309',
    category: null,
    blocker: PlanAction.Obstacle.FRANCAIS,
    situations: [
      PlanAction.Situation.LYCEE,
      PlanAction.Situation.ETUDES_SUPERIEURES,
      PlanAction.Situation.EMPLOI,
      PlanAction.Situation.AUTRE
    ],
    structures: [],
    minAge: null,
    maxAge: null,
    territory: null,
    kind: 'link',
    label: 'Je recherche des informations pour les primo-arrivants',
    url: 'https://refugies.info',
    serviceName: 'Réfugiés.infos'
  }
]
