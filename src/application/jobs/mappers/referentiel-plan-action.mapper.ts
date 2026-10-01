import { Questionnaire } from '../../../domain/plan-action/questionnaire'
import { ReferentielPlanAction } from '../../../domain/plan-action/referentiel-plan-action'
import { Profil } from '../../../domain/profil'
import {
  GristRecordDto,
  GristServiceFieldsDto,
  GristSolutionFieldsDto
} from '../../../infrastructure/clients/dto/grist.dto'
import { rootLogger } from '../../../utils/logger.module'

const CONTEXT = 'ReferentielPlanActionMapper'

const typeParLibelle: Record<string, ReferentielPlanAction.TypeSolution> = {
  'Lien web': ReferentielPlanAction.TypeSolution.LIEN,
  "Écran de l'app": ReferentielPlanAction.TypeSolution.NAVIGATION,
  Conseil: ReferentielPlanAction.TypeSolution.CONSEIL
}

const besoinParLibelle: Record<string, Questionnaire.Besoin> = {
  "M'orienter": Questionnaire.Besoin.ORIENTER,
  'Découvrir des métiers': Questionnaire.Besoin.DECOUVRIR_METIERS,
  'Me former, me qualifier': Questionnaire.Besoin.FORMER,
  'Trouver un stage, une immersion': Questionnaire.Besoin.STAGE_IMMERSION,
  'Trouver une alternance': Questionnaire.Besoin.ALTERNANCE,
  'Trouver un emploi': Questionnaire.Besoin.EMPLOI,
  "M'engager": Questionnaire.Besoin.ENGAGER,
  'Faire une mobilité internationale':
    Questionnaire.Besoin.MOBILITE_INTERNATIONALE,
  'Être accompagné dans mes démarches': Questionnaire.Besoin.ACCOMPAGNE,
  'Créer mon activité': Questionnaire.Besoin.CREER_ACTIVITE,
  'Vie quotidienne': Questionnaire.Besoin.VIE_QUOTIDIENNE
}

const contrainteParLibelle: Record<string, Questionnaire.Contrainte> = {
  'Pas de permis': Questionnaire.Contrainte.PAS_DE_PERMIS,
  'Pas de moyens de transport': Questionnaire.Contrainte.PAS_DE_TRANSPORT,
  'Pas de logement stable': Questionnaire.Contrainte.PAS_DE_LOGEMENT,
  'Manque de confiance': Questionnaire.Contrainte.MANQUE_CONFIANCE,
  'Fin de mois difficile': Questionnaire.Contrainte.FIN_DE_MOIS,
  'Situation de handicap': Questionnaire.Contrainte.HANDICAP,
  'Un problème de santé': Questionnaire.Contrainte.SANTE,
  "Garde d'enfant": Questionnaire.Contrainte.GARDE_ENFANT,
  'Difficulté avec le numérique': Questionnaire.Contrainte.NUMERIQUE,
  'Pas de diplôme': Questionnaire.Contrainte.PAS_DE_DIPLOME,
  "Peu d'expérience professionnelle": Questionnaire.Contrainte.PEU_EXPERIENCE,
  'Difficulté avec le français': Questionnaire.Contrainte.FRANCAIS
}

const situationParLibelle: Record<string, Questionnaire.Situation> = {
  'Au collège': Questionnaire.Situation.COLLEGE,
  'Au lycée': Questionnaire.Situation.LYCEE,
  'En études supérieures': Questionnaire.Situation.ETUDES_SUPERIEURES,
  'En emploi': Questionnaire.Situation.EMPLOI,
  'Autre situation': Questionnaire.Situation.AUTRE
}

// La colonne porte le mode d'authentification : FT Connect sert aussi le
// Conseil départemental
const structuresParLibelle: Record<string, Profil.Structure[]> = {
  'France Travail': [
    Profil.Structure.FRANCE_TRAVAIL,
    Profil.Structure.CONSEIL_DEPARTEMENTAL
  ],
  'Mission Locale': [Profil.Structure.MILO],
  Invité: [Profil.Structure.INVITE]
}

const destinationParValeur: Record<string, ReferentielPlanAction.Destination> =
  {
    evenements: ReferentielPlanAction.Destination.EVENEMENTS,
    'offres-alternance': ReferentielPlanAction.Destination.OFFRES_ALTERNANCE,
    'offres-emploi': ReferentielPlanAction.Destination.OFFRES_EMPLOI,
    'offres-services-civiques':
      ReferentielPlanAction.Destination.OFFRES_SERVICE_CIVIQUE,
    'aller-vers': ReferentielPlanAction.Destination.ALLER_VERS
  }

export function reconcilierReferentiel(
  servicesGrist: Array<GristRecordDto<GristServiceFieldsDto>>,
  solutionsGrist: Array<GristRecordDto<GristSolutionFieldsDto>>
): ReferentielPlanAction.Reconciliation {
  const anomalies: ReferentielPlanAction.Anomalies = {
    nbServicesNonResolus: 0,
    nbDoublonsServices: 0,
    nbDoublonsSolutions: 0,
    nbSolutionsEcartees: 0,
    nbValeursNonReconnues: 0
  }

  const { services, serviceParNom } = indexerServices(servicesGrist, anomalies)

  const solutions: ReferentielPlanAction.Solution[] = []
  const idsVus = new Set<string>()

  for (const record of [...solutionsGrist].sort((a, b) => a.id - b.id)) {
    const idTechnique = record.fields.Id_technique
    if (!texte(idTechnique)) {
      anomalies.nbSolutionsEcartees++
      logAnomalie('Solution Grist écartée : identifiant technique manquant', {
        raison: 'id_manquant',
        ligne_grist: record.id
      })
      continue
    }
    if (idsVus.has(idTechnique)) {
      anomalies.nbDoublonsSolutions++
      logAnomalie(
        "Solution Grist en doublon d'identifiant technique, ligne ignorée",
        {
          id_technique: idTechnique,
          ligne_grist: record.id
        }
      )
      continue
    }
    idsVus.add(idTechnique)

    const solution = construireSolution(record, serviceParNom, anomalies)
    if (solution) solutions.push(solution)
  }

  return { services, solutions, anomalies }
}

// Les services sont indexés par nom : c'est la seule clé dont disposent les
// solutions du Grist pour les désigner
function indexerServices(
  servicesGrist: Array<GristRecordDto<GristServiceFieldsDto>>,
  anomalies: ReferentielPlanAction.Anomalies
): {
  services: ReferentielPlanAction.Service[]
  serviceParNom: Map<string, ReferentielPlanAction.Service>
} {
  const services: ReferentielPlanAction.Service[] = []
  const serviceParNom = new Map<string, ReferentielPlanAction.Service>()

  for (const record of [...servicesGrist].sort((a, b) => a.id - b.id)) {
    const service: ReferentielPlanAction.Service = {
      id: String(record.id),
      nom: record.fields.Nom,
      ...optionnel('description', texte(record.fields.Description))
    }
    services.push(service)

    const nomIndexe = record.fields.Nom.trim()
    const dejaIndexe = serviceParNom.get(nomIndexe)
    if (dejaIndexe) {
      anomalies.nbDoublonsServices++
      logAnomalie("Service Grist en doublon de nom, entrée d'index ignorée", {
        nom: nomIndexe,
        id_retenu: dejaIndexe.id,
        id_ignore: service.id
      })
      continue
    }
    serviceParNom.set(nomIndexe, service)
  }

  return { services, serviceParNom }
}

// Rend undefined quand la ligne n'est pas exploitable, après avoir compté
// l'anomalie correspondante
function construireSolution(
  record: GristRecordDto<GristSolutionFieldsDto>,
  serviceParNom: Map<string, ReferentielPlanAction.Service>,
  anomalies: ReferentielPlanAction.Anomalies
): ReferentielPlanAction.Solution | undefined {
  const fields = record.fields

  const type = typeParLibelle[fields.Type]
  if (!type) {
    anomalies.nbSolutionsEcartees++
    logAnomalie('Solution Grist écartée : type de tâche inconnu', {
      id_technique: fields.Id_technique,
      raison: 'type_inconnu',
      valeur: fields.Type
    })
    return undefined
  }

  const valeurEcran = texte(fields.Ecran_de_l_app)
  const ecranApp = valeurEcran ? destinationParValeur[valeurEcran] : undefined
  if (type === ReferentielPlanAction.TypeSolution.NAVIGATION && !ecranApp) {
    anomalies.nbSolutionsEcartees++
    logAnomalie(
      valeurEcran
        ? 'Solution Grist écartée : écran de navigation inconnu'
        : 'Solution Grist écartée : navigation sans écran renseigné',
      {
        id_technique: fields.Id_technique,
        raison: valeurEcran ? 'ecran_inconnu' : 'navigation_sans_ecran',
        ...optionnel('valeur', valeurEcran)
      }
    )
    return undefined
  }

  const nomService = texte(fields.Service)
  const service = nomService ? serviceParNom.get(nomService) : undefined
  if (nomService && !service) {
    anomalies.nbServicesNonResolus++
    logAnomalie('Service Grist non résolu pour une solution', {
      id_technique: fields.Id_technique,
      nom_cherche: nomService
    })
  }

  return {
    id: fields.Id_technique,
    ...optionnel(
      'besoin',
      resoudreEnum(
        'Envie',
        fields.Envie,
        besoinParLibelle,
        fields.Id_technique,
        anomalies
      )
    ),
    ...optionnel(
      'contrainte',
      resoudreEnum(
        'Blocage',
        fields.Blocage,
        contrainteParLibelle,
        fields.Id_technique,
        anomalies
      )
    ),
    ...optionnel('sousCategorie', texte(fields.Sous_categorie)),
    ...optionnel('besoinExprime', texte(fields.Besoin_exprime_par_le_jeune)),
    type,
    libelle: fields.Action_affichee_au_jeune,
    ...optionnel('url', texte(fields.URL)),
    ...optionnel('ecranApp', ecranApp),
    ...optionnel('service', service),
    situations: resoudreListe(
      'Situations',
      fields.Situations,
      situationParLibelle,
      fields.Id_technique,
      anomalies
    ),
    authentifications: resoudreListe(
      'Authentification',
      fields.Authentification,
      structuresParLibelle,
      fields.Id_technique,
      anomalies
    ).flat(),
    territoires: liste(fields.Territoire),
    ...optionnel('ageMin', entier(fields.Age_minimum)),
    ...optionnel('ageMax', entier(fields.Age_maximum)),
    ...optionnel('domaine', texte(fields.Domaine)),
    ...optionnel('conversionFT', conversionFT(fields)),
    ...optionnel('conversionML', conversionML(fields))
  }
}

function resoudreEnum<V>(
  colonne: string,
  valeurGrist: string,
  table: Record<string, V>,
  idTechnique: string,
  anomalies: ReferentielPlanAction.Anomalies
): V | undefined {
  const propre = texte(valeurGrist)
  if (!propre) return undefined
  const resolu = table[propre]
  if (!resolu) {
    anomalies.nbValeursNonReconnues++
    logAnomalie('Valeur Grist non reconnue, solution conservée', {
      id_technique: idTechnique,
      colonne,
      valeur: propre
    })
  }
  return resolu
}

function resoudreListe<V>(
  colonne: string,
  valeurGrist: string | null | undefined,
  table: Record<string, V>,
  idTechnique: string,
  anomalies: ReferentielPlanAction.Anomalies
): V[] {
  const resolues: V[] = []
  for (const libelle of liste(valeurGrist)) {
    const resolu = table[libelle]
    if (resolu) {
      resolues.push(resolu)
    } else {
      anomalies.nbValeursNonReconnues++
      logAnomalie('Valeur Grist non reconnue, solution conservée', {
        id_technique: idTechnique,
        colonne,
        valeur: libelle
      })
    }
  }
  return resolues
}

function texte(valeur: string | null | undefined): string | undefined {
  const propre = valeur?.trim()
  return propre || undefined
}

function liste(valeur: string | null | undefined): string[] {
  return (valeur ?? '')
    .split(';')
    .map(element => element.trim())
    .filter(element => element.length > 0)
}

function entier(valeur: number | null): number | undefined {
  return valeur === null || valeur === undefined
    ? undefined
    : Math.trunc(valeur)
}

function conversionFT(
  fields: GristSolutionFieldsDto
): ReferentielPlanAction.ConversionFT | undefined {
  const conversion: ReferentielPlanAction.ConversionFT = {
    ...optionnel('thematique', texte(fields.Conversion_FT_Thematique)),
    ...optionnel('demarche', texte(fields.Conversion_FT_Demarche)),
    ...optionnel('codePourquoi', texte(fields.Conversion_FT_Code_pourquoi)),
    ...optionnel('codeQuoi', texte(fields.Conversion_FT_Code_quoi))
  }
  return Object.keys(conversion).length ? conversion : undefined
}

function conversionML(
  fields: GristSolutionFieldsDto
): ReferentielPlanAction.ConversionML | undefined {
  const conversion: ReferentielPlanAction.ConversionML = {
    ...optionnel('categorie', texte(fields.Conversion_ML_Categorie)),
    ...optionnel('codeCategorie', texte(fields.Conversion_ML_Code_categorie)),
    ...optionnel('action', texte(fields.Conversion_ML_Action)),
    ...optionnel('origine', texte(fields.Conversion_ML_Origine_de_l_action))
  }
  return Object.keys(conversion).length ? conversion : undefined
}

function optionnel<K extends string, V>(
  cle: K,
  valeur: V | undefined
): { [P in K]?: V } {
  return valeur === undefined ? {} : ({ [cle]: valeur } as { [P in K]?: V })
}

function logAnomalie(
  message: string,
  labels: Record<string, string | number>
): void {
  rootLogger.info({ context: CONTEXT, labels }, message)
}
