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

export function reconcilierReferentiel(
  servicesGrist: Array<GristRecordDto<GristServiceFieldsDto>>,
  solutionsGrist: Array<GristRecordDto<GristSolutionFieldsDto>>
): ReferentielPlanAction.Reconciliation {
  const anomalies: ReferentielPlanAction.Anomalies = {
    nbServicesNonResolus: 0,
    nbDoublonsServices: 0,
    nbDoublonsSolutions: 0,
    nbSolutionsEcartees: 0
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

    if (serviceParNom.has(service.nom)) {
      anomalies.nbDoublonsServices++
      logAnomalie('referentiel_service_en_doublon', {
        nom: service.nom,
        idRetenu: serviceParNom.get(service.nom)!.id,
        idIgnore: service.id
      })
      continue
    }
    serviceParNom.set(service.nom, service)
  }

  const solutions: ReferentielPlanAction.Solution[] = []
  const idsVus = new Set<string>()

  for (const record of [...solutionsGrist].sort((a, b) => a.id - b.id)) {
    const fields = record.fields

    if (idsVus.has(fields.Id_technique)) {
      anomalies.nbDoublonsSolutions++
      logAnomalie('referentiel_solution_en_doublon', {
        idTechnique: fields.Id_technique,
        ligneGrist: record.id
      })
      continue
    }
    idsVus.add(fields.Id_technique)

    const type = typeParLibelle[fields.Type]
    if (!type) {
      anomalies.nbSolutionsEcartees++
      logAnomalie('referentiel_solution_ecartee', {
        idTechnique: fields.Id_technique,
        raison: 'type_inconnu',
        valeur: fields.Type
      })
      continue
    }

    const ecranApp = destination(fields.Ecran_de_l_app)
    if (type === PlanAction.TypeTache.NAVIGATION && !ecranApp) {
      anomalies.nbSolutionsEcartees++
      logAnomalie('referentiel_solution_ecartee', {
        idTechnique: fields.Id_technique,
        raison: 'navigation_sans_ecran',
        valeur: fields.Ecran_de_l_app
      })
      continue
    }

    const nomService = texte(fields.Service)
    const service = nomService ? serviceParNom.get(nomService) : undefined
    if (nomService && !service) {
      anomalies.nbServicesNonResolus++
      logAnomalie('referentiel_service_non_resolu', {
        idTechnique: fields.Id_technique,
        nomCherche: nomService
      })
    }

    solutions.push({
      id: fields.Id_technique,
      ...optionnel('besoin', besoinParLibelle[fields.Envie]),
      ...optionnel('contrainte', contrainteParLibelle[fields.Blocage]),
      ...optionnel('sousCategorie', texte(fields.Sous_categorie)),
      ...optionnel('besoinExprime', texte(fields.Besoin_exprime_par_le_jeune)),
      type,
      libelle: fields.Action_affichee_au_jeune,
      ...optionnel('url', texte(fields.URL)),
      ...optionnel('ecranApp', ecranApp),
      ...optionnel('service', service),
      situations: liste(fields.Situations),
      authentifications: liste(fields.Authentification)
        .map(libelle => structureParLibelle[libelle])
        .filter((structure): structure is Profil.Structure =>
          Boolean(structure)
        ),
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

function destination(valeur: string): PlanAction.Destination | undefined {
  const propre = texte(valeur)
  if (!propre) return undefined
  const connues = Object.values(PlanAction.Destination) as string[]
  return connues.includes(propre)
    ? (propre as PlanAction.Destination)
    : undefined
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
  action: string,
  details: Record<string, string | number>
): void {
  rootLogger.info(
    { context: CONTEXT, event: { action, outcome: 'failure' }, ...details },
    action
  )
}
