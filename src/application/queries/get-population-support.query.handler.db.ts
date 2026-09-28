import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import {
  emptySuccess,
  failure,
  Result,
  success
} from '../../building-blocks/types/result'
import {
  Communication,
  CommunicationRepositoryToken
} from '../../domain/communication'
import { CommunicationSqlModel } from '../../infrastructure/sequelize/models/communication.sql-model'
import { DeploiementSqlModel } from '../../infrastructure/sequelize/models/deploiement.sql-model'
import { PopulationConseillerSqlModel } from '../../infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../infrastructure/sequelize/models/population.sql-model'
import {
  CommunicationSupportQueryModel,
  PopulationSupportQueryModel
} from './query-models/population-support.query-model'

export interface GetPopulationSupportQuery extends Query {
  idPopulation: string
}

// Lecture support : tout ce qui est monté sur une population, d'un coup.
@Injectable()
export class GetPopulationSupportQueryHandler extends QueryHandler<
  GetPopulationSupportQuery,
  Result<PopulationSupportQueryModel>
> {
  constructor(
    @Inject(CommunicationRepositoryToken)
    private readonly communicationRepository: Communication.Repository
  ) {
    super('GetPopulationSupportQueryHandler')
  }

  async handle(
    query: GetPopulationSupportQuery
  ): Promise<Result<PopulationSupportQueryModel>> {
    const population = await PopulationSqlModel.findByPk(query.idPopulation)
    if (!population) {
      return failure(new NonTrouveError('Population', query.idPopulation))
    }

    const where = { idPopulation: query.idPopulation }
    const [conseillers, profils, deploiements, communications] =
      await Promise.all([
        PopulationConseillerSqlModel.findAll({
          where,
          order: [['emailConseiller', 'ASC']]
        }),
        PopulationProfilSqlModel.findAll({ where, order: [['id', 'ASC']] }),
        DeploiementSqlModel.findAll({ where, order: [['id', 'ASC']] }),
        CommunicationSqlModel.findAll({ where, order: [['id', 'ASC']] })
      ])
    const envois = await Promise.all(
      communications.map(co => envoiDe(co, this.communicationRepository))
    )

    return success(
      toPopulationSupportQueryModel(
        population,
        conseillers,
        profils,
        deploiements,
        communications,
        envois
      )
    )
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

export async function envoiDe(
  co: CommunicationSqlModel,
  communicationRepository: Communication.Repository
): Promise<Pick<CommunicationSupportQueryModel, 'nbDestinataires' | 'envoi'>> {
  switch (co.statutEnvoi) {
    case Communication.StatutEnvoi.A_ENVOYER:
      return {
        nbDestinataires: await communicationRepository.compterDestinataires(
          co.idPopulation,
          co.push!
        )
      }
    case Communication.StatutEnvoi.EN_COURS:
      return {
        envoi: await communicationRepository.compterEnvois(co.id)
      }
    case Communication.StatutEnvoi.ENVOYEE:
    case Communication.StatutEnvoi.ANNULEE:
    case Communication.StatutEnvoi.EN_ERREUR:
      return {
        envoi: {
          envoyees: co.nbEnvoyees ?? 0,
          erreurs: co.nbErreurs ?? 0,
          tokensInvalides: co.nbTokensInvalides ?? 0
        }
      }
    default:
      return {}
  }
}

export function toPopulationSupportQueryModel(
  population: PopulationSqlModel,
  conseillers: PopulationConseillerSqlModel[],
  profils: PopulationProfilSqlModel[],
  deploiements: DeploiementSqlModel[],
  communications: CommunicationSqlModel[],
  envois: Array<
    Pick<CommunicationSupportQueryModel, 'nbDestinataires' | 'envoi'>
  >
): PopulationSupportQueryModel {
  return {
    id: population.id,
    description: population.description ?? undefined,
    conseillers: conseillers.map(c => c.emailConseiller),
    profils: profils.map(p => ({
      structure: p.structure,
      dispositif: p.dispositif ?? undefined
    })),
    deploiements: deploiements.map(d => ({
      id: d.id,
      nature: d.nature,
      idFonctionnalite: d.idFonctionnalite ?? undefined,
      dateActivation: DateTime.fromJSDate(d.dateActivation).toUTC().toISO()!
    })),
    communications: communications.map((co, index) => ({
      id: co.id,
      destinataire: co.destinataire,
      type: co.type,
      dateDebut: DateTime.fromJSDate(co.dateDebut).toUTC().toISO()!,
      dateFin: co.dateFin
        ? DateTime.fromJSDate(co.dateFin).toUTC().toISO()!
        : undefined,
      titre: co.titre,
      contenu: co.contenu,
      ctaLabel: co.ctaLabel ?? undefined,
      ctaUrlAndroid: co.ctaUrlAndroid ?? undefined,
      ctaUrlIos: co.ctaUrlIos ?? undefined,
      typeNotification: co.typeNotification ?? undefined,
      push: co.push ?? undefined,
      statutEnvoi: co.statutEnvoi ?? undefined,
      envoiTermineLe: co.envoiTermineLe
        ? DateTime.fromJSDate(co.envoiTermineLe).toUTC().toISO()!
        : undefined,
      ...envois[index]
    }))
  }
}
