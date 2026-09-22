import { Injectable } from '@nestjs/common'
import { Op } from 'sequelize'
import { PlanAction } from '../../../domain/plan-action/plan-action'
import { ReferentielPlanAction } from '../../../domain/plan-action/referentiel-plan-action'
import { Profil } from '../../../domain/profil'
import { ReferentielPlanActionServiceSqlModel } from '../../sequelize/models/referentiel-plan-action-service.sql-model'
import { ReferentielPlanActionSolutionSqlModel } from '../../sequelize/models/referentiel-plan-action-solution.sql-model'
import { DateService } from '../../../utils/date-service'

@Injectable()
export class ReferentielPlanActionSqlRepository
  implements ReferentielPlanAction.Repository
{
  constructor(private readonly dateService: DateService) {}

  async remplacer(
    services: ReferentielPlanAction.Service[],
    solutions: ReferentielPlanAction.Solution[],
    plafond: ReferentielPlanAction.PlafondDesactivations
  ): Promise<ReferentielPlanAction.Diff> {
    const maintenant = this.dateService.now().toJSDate()

    const idsRecus = solutions.map(solution => solution.id)
    const existantes = await ReferentielPlanActionSolutionSqlModel.findAll({
      attributes: ['id', 'active']
    })
    const idsExistants = new Set(existantes.map(solution => solution.id))

    const actives = existantes.filter(solution => solution.active)
    const idsRecusSet = new Set(idsRecus)
    const aDesactiver = actives.filter(
      solution => !idsRecusSet.has(solution.id)
    )
    const plafondCalcule = Math.max(
      plafond.nombreMin,
      Math.floor((actives.length * plafond.pourcentageMax) / 100)
    )
    if (aDesactiver.length > plafondCalcule) {
      throw new Error(
        `Plafond de désactivations dépassé : ${aDesactiver.length} > ${plafondCalcule}`
      )
    }

    await ReferentielPlanActionServiceSqlModel.bulkCreate(
      services.map(service => ({
        id: service.id,
        nom: service.nom,
        description: service.description ?? null
      })),
      { updateOnDuplicate: ['nom', 'description'] }
    )

    await ReferentielPlanActionSolutionSqlModel.bulkCreate(
      solutions.map(solution => ({
        id: solution.id,
        besoin: solution.besoin ?? null,
        contrainte: solution.contrainte ?? null,
        sousCategorie: solution.sousCategorie ?? null,
        besoinExprime: solution.besoinExprime ?? null,
        type: solution.type,
        libelle: solution.libelle,
        url: solution.url ?? null,
        ecranApp: solution.ecranApp ?? null,
        idService: solution.service?.id ?? null,
        situations: solution.situations,
        authentifications: solution.authentifications,
        territoires: solution.territoires,
        ageMin: solution.ageMin ?? null,
        ageMax: solution.ageMax ?? null,
        domaine: solution.domaine ?? null,
        conversionFtThematique: solution.conversionFT?.thematique ?? null,
        conversionFtDemarche: solution.conversionFT?.demarche ?? null,
        conversionFtCodePourquoi: solution.conversionFT?.codePourquoi ?? null,
        conversionFtCodeQuoi: solution.conversionFT?.codeQuoi ?? null,
        conversionMlCategorie: solution.conversionML?.categorie ?? null,
        conversionMlCodeCategorie: solution.conversionML?.codeCategorie ?? null,
        conversionMlAction: solution.conversionML?.action ?? null,
        conversionMlOrigine: solution.conversionML?.origine ?? null,
        active: true,
        dateMaj: maintenant
      })),
      {
        updateOnDuplicate: [
          'besoin',
          'contrainte',
          'sousCategorie',
          'besoinExprime',
          'type',
          'libelle',
          'url',
          'ecranApp',
          'idService',
          'situations',
          'authentifications',
          'territoires',
          'ageMin',
          'ageMax',
          'domaine',
          'conversionFtThematique',
          'conversionFtDemarche',
          'conversionFtCodePourquoi',
          'conversionFtCodeQuoi',
          'conversionMlCategorie',
          'conversionMlCodeCategorie',
          'conversionMlAction',
          'conversionMlOrigine',
          'active',
          'dateMaj'
        ]
      }
    )

    const [nbDesactivees] = await ReferentielPlanActionSolutionSqlModel.update(
      { active: false },
      {
        where: {
          active: true,
          ...(idsRecus.length ? { id: { [Op.notIn]: idsRecus } } : {})
        }
      }
    )

    const nbCreees = idsRecus.filter(id => !idsExistants.has(id)).length

    return {
      nbCreees,
      nbMisesAJour: idsRecus.length - nbCreees,
      nbDesactivees
    }
  }

  async trouverSolutions(
    ids: string[]
  ): Promise<ReferentielPlanAction.Solution[]> {
    if (!ids.length) return []

    const solutionsSql = await ReferentielPlanActionSolutionSqlModel.findAll({
      where: { id: { [Op.in]: ids }, active: true },
      include: [ReferentielPlanActionServiceSqlModel]
    })

    return solutionsSql.map(toSolution)
  }
}

function toSolution(
  solutionSql: ReferentielPlanActionSolutionSqlModel
): ReferentielPlanAction.Solution {
  return {
    id: solutionSql.id,
    ...optionnel('besoin', solutionSql.besoin as PlanAction.Besoin | null),
    ...optionnel(
      'contrainte',
      solutionSql.contrainte as PlanAction.Contrainte | null
    ),
    ...optionnel('sousCategorie', solutionSql.sousCategorie),
    ...optionnel('besoinExprime', solutionSql.besoinExprime),
    type: solutionSql.type as PlanAction.TypeTache,
    libelle: solutionSql.libelle,
    ...optionnel('url', solutionSql.url),
    ...optionnel(
      'ecranApp',
      solutionSql.ecranApp as PlanAction.Destination | null
    ),
    ...optionnel('service', toService(solutionSql.service)),
    situations: solutionSql.situations,
    authentifications: solutionSql.authentifications as Profil.Structure[],
    territoires: solutionSql.territoires,
    ...optionnel('ageMin', solutionSql.ageMin),
    ...optionnel('ageMax', solutionSql.ageMax),
    ...optionnel('domaine', solutionSql.domaine),
    ...optionnel('conversionFT', toConversionFT(solutionSql)),
    ...optionnel('conversionML', toConversionML(solutionSql))
  }
}

function toService(
  serviceSql: ReferentielPlanActionServiceSqlModel | undefined | null
): ReferentielPlanAction.Service | undefined {
  if (!serviceSql) return undefined
  return {
    id: serviceSql.id,
    nom: serviceSql.nom,
    ...optionnel('description', serviceSql.description)
  }
}

function toConversionFT(
  solutionSql: ReferentielPlanActionSolutionSqlModel
): ReferentielPlanAction.ConversionFT | undefined {
  const conversion: ReferentielPlanAction.ConversionFT = {
    ...optionnel('thematique', solutionSql.conversionFtThematique),
    ...optionnel('demarche', solutionSql.conversionFtDemarche),
    ...optionnel('codePourquoi', solutionSql.conversionFtCodePourquoi),
    ...optionnel('codeQuoi', solutionSql.conversionFtCodeQuoi)
  }
  return Object.keys(conversion).length ? conversion : undefined
}

function toConversionML(
  solutionSql: ReferentielPlanActionSolutionSqlModel
): ReferentielPlanAction.ConversionML | undefined {
  const conversion: ReferentielPlanAction.ConversionML = {
    ...optionnel('categorie', solutionSql.conversionMlCategorie),
    ...optionnel('codeCategorie', solutionSql.conversionMlCodeCategorie),
    ...optionnel('action', solutionSql.conversionMlAction),
    ...optionnel('origine', solutionSql.conversionMlOrigine)
  }
  return Object.keys(conversion).length ? conversion : undefined
}

function optionnel<K extends string, V>(
  cle: K,
  valeur: V | null | undefined
): { [P in K]?: V } {
  return valeur === null || valeur === undefined
    ? {}
    : ({ [cle]: valeur } as { [P in K]?: V })
}
