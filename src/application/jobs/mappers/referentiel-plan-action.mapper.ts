import { PlanAction } from '../../../domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../domain/plan-action/referentiel-plan-action'
import { Profil } from '../../../domain/profil'
import {
  GristRecordDto,
  GristServiceFieldsDto,
  GristSolutionFieldsDto
} from '../../../infrastructure/clients/dto/grist.dto'
import { rootLogger } from '../../../utils/logger.module'

const CONTEXT = 'ReferentielPlanActionMapper'

const typeParLibelle: Record<string, PlanAction.TypeTache> = {
  'Lien web': PlanAction.TypeTache.LIEN,
  "Écran de l'app": PlanAction.TypeTache.NAVIGATION,
  Conseil: PlanAction.TypeTache.CONSEIL
}

const besoinParLibelle: Record<string, PlanAction.Besoin> = {
  "M'orienter": PlanAction.Besoin.ORIENTER,
  'Découvrir des métiers': PlanAction.Besoin.DECOUVRIR_METIERS,
  'Me former, me qualifier': PlanAction.Besoin.FORMER,
  'Trouver un stage, une immersion': PlanAction.Besoin.STAGE_IMMERSION,
  'Trouver une alternance': PlanAction.Besoin.ALTERNANCE,
  'Trouver un emploi': PlanAction.Besoin.EMPLOI,
  "M'engager": PlanAction.Besoin.ENGAGER,
  'Faire une mobilité internationale':
    PlanAction.Besoin.MOBILITE_INTERNATIONALE,
  'Être accompagné dans mes démarches': PlanAction.Besoin.ACCOMPAGNE,
  'Créer mon activité': PlanAction.Besoin.CREER_ACTIVITE,
  'Vie quotidienne': PlanAction.Besoin.VIE_QUOTIDIENNE
}

const contrainteParLibelle: Record<string, PlanAction.Contrainte> = {
  'Pas de permis': PlanAction.Contrainte.PAS_DE_PERMIS,
  'Pas de moyens de transport': PlanAction.Contrainte.PAS_DE_TRANSPORT,
  'Pas de logement stable': PlanAction.Contrainte.PAS_DE_LOGEMENT,
  'Manque de confiance': PlanAction.Contrainte.MANQUE_CONFIANCE,
  'Fin de mois difficile': PlanAction.Contrainte.FIN_DE_MOIS,
  'Situation de handicap': PlanAction.Contrainte.HANDICAP,
  'Un problème de santé': PlanAction.Contrainte.SANTE,
  "Garde d'enfant": PlanAction.Contrainte.GARDE_ENFANT,
  'Difficulté avec le numérique': PlanAction.Contrainte.NUMERIQUE,
  'Pas de diplôme': PlanAction.Contrainte.PAS_DE_DIPLOME,
  "Peu d'expérience professionnelle": PlanAction.Contrainte.PEU_EXPERIENCE,
  'Difficulté avec le français': PlanAction.Contrainte.FRANCAIS
}

const structureParLibelle: Record<string, Profil.Structure> = {
  'France Travail': Profil.Structure.FRANCE_TRAVAIL,
  'Mission Locale': Profil.Structure.MILO,
  Invité: Profil.Structure.INVITE
}

const destinationParValeur: Record<string, PlanAction.Destination> = {
  evenements: PlanAction.Destination.EVENEMENTS,
  'offres-alternance': PlanAction.Destination.OFFRES_ALTERNANCE,
  'offres-emploi': PlanAction.Destination.OFFRES_EMPLOI,
  'offres-services-civiques': PlanAction.Destination.OFFRES_SERVICE_CIVIQUE,
  'aller-vers': PlanAction.Destination.ALLER_VERS
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

  const services: ReferentielPlanAction.Service[] = []
  const serviceParNom = new Map<string, ReferentielPlanAction.Service>()

  for (const record of [...servicesGrist].sort((a, b) => a.id - b.id)) {
    const description = texte(record.fields.Description)
    const service: ReferentielPlanAction.Service = {
      id: String(record.id),
      nom: record.fields.Nom,
      ...optionnel('description', description)
    }
    services.push(service)

    const nomIndexe = record.fields.Nom.trim()
    if (serviceParNom.has(nomIndexe)) {
      anomalies.nbDoublonsServices++
      logAnomalie("Service Grist en doublon de nom, entrée d'index ignorée", {
        nom: nomIndexe,
        id_retenu: serviceParNom.get(nomIndexe)!.id,
        id_ignore: service.id
      })
      continue
    }
    serviceParNom.set(nomIndexe, service)
  }

  const solutions: ReferentielPlanAction.Solution[] = []
  const idsVus = new Set<string>()

  for (const record of [...solutionsGrist].sort((a, b) => a.id - b.id)) {
    const fields = record.fields

    if (idsVus.has(fields.Id_technique)) {
      anomalies.nbDoublonsSolutions++
      logAnomalie(
        "Solution Grist en doublon d'identifiant technique, ligne ignorée",
        {
          id_technique: fields.Id_technique,
          ligne_grist: record.id
        }
      )
      continue
    }
    idsVus.add(fields.Id_technique)

    const type = typeParLibelle[fields.Type]
    if (!type) {
      anomalies.nbSolutionsEcartees++
      logAnomalie('Solution Grist écartée : type de tâche inconnu', {
        id_technique: fields.Id_technique,
        raison: 'type_inconnu',
        valeur: fields.Type
      })
      continue
    }

    const valeurEcran = texte(fields.Ecran_de_l_app)
    const ecranApp = valeurEcran ? destinationParValeur[valeurEcran] : undefined
    if (type === PlanAction.TypeTache.NAVIGATION && !ecranApp) {
      anomalies.nbSolutionsEcartees++
      if (valeurEcran) {
        logAnomalie('Solution Grist écartée : écran de navigation inconnu', {
          id_technique: fields.Id_technique,
          raison: 'ecran_inconnu',
          valeur: valeurEcran
        })
      } else {
        logAnomalie(
          'Solution Grist écartée : navigation sans écran renseigné',
          {
            id_technique: fields.Id_technique,
            raison: 'navigation_sans_ecran'
          }
        )
      }
      continue
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

    const besoin = resoudreEnum(
      'Envie',
      fields.Envie,
      besoinParLibelle,
      fields.Id_technique,
      anomalies
    )
    const contrainte = resoudreEnum(
      'Blocage',
      fields.Blocage,
      contrainteParLibelle,
      fields.Id_technique,
      anomalies
    )
    const authentifications: Profil.Structure[] = []
    for (const libelleAuthentification of liste(fields.Authentification)) {
      const structure = structureParLibelle[libelleAuthentification]
      if (structure) {
        authentifications.push(structure)
      } else {
        anomalies.nbValeursNonReconnues++
        logAnomalie('Valeur Grist non reconnue, solution conservée', {
          id_technique: fields.Id_technique,
          colonne: 'Authentification',
          valeur: libelleAuthentification
        })
      }
    }

    solutions.push({
      id: fields.Id_technique,
      ...optionnel('besoin', besoin),
      ...optionnel('contrainte', contrainte),
      ...optionnel('sousCategorie', texte(fields.Sous_categorie)),
      ...optionnel('besoinExprime', texte(fields.Besoin_exprime_par_le_jeune)),
      type,
      libelle: fields.Action_affichee_au_jeune,
      ...optionnel('url', texte(fields.URL)),
      ...optionnel('ecranApp', ecranApp),
      ...optionnel('service', service),
      situations: liste(fields.Situations),
      authentifications,
      territoires: liste(fields.Territoire),
      ...optionnel('ageMin', entier(fields.Age_minimum)),
      ...optionnel('ageMax', entier(fields.Age_maximum)),
      ...optionnel('domaine', texte(fields.Domaine)),
      ...optionnel('conversionFT', conversionFT(fields)),
      ...optionnel('conversionML', conversionML(fields))
    })
  }

  return { services, solutions, anomalies }
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

function texte(valeur: string | null | undefined): string | undefined {
  const propre = valeur?.trim()
  return propre ? propre : undefined
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
