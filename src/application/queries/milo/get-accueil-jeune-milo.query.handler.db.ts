import { Inject, Injectable } from '@nestjs/common'

import { DateTime } from 'luxon'
import { Op, QueryTypes, Sequelize } from 'sequelize'
import { JeuneAuthorizer } from 'src/application/authorizers/jeune-authorizer'
import { GetFavorisAccueilQueryGetter } from 'src/application/queries/query-getters/accueil/get-favoris.query.getter.db'
import { GetRecherchesSauvegardeesQueryGetter } from 'src/application/queries/query-getters/accueil/get-recherches-sauvegardees.query.getter.db'
import { GetCampagneQueryGetter } from 'src/application/queries/query-getters/get-campagne.query.getter.db'
import { GetSessionsVisiblesPourLeJeuneMiloQueryGetter } from 'src/application/queries/query-getters/milo/get-sessions-visibles-pour-jeune.milo.query.getter.db'
import {
  JeuneMiloSansIdDossier,
  NonTrouveError
} from 'src/building-blocks/types/domain-error'
import { Query } from 'src/building-blocks/types/query'
import { QueryHandler } from 'src/building-blocks/types/query-handler'
import {
  failure,
  isSuccess,
  Result,
  success
} from 'src/building-blocks/types/result'
import { Action } from 'src/domain/action/action'
import { Authentification } from 'src/domain/authentification'
import { estMilo } from 'src/domain/core'
import { SessionMilo } from 'src/domain/milo/session.milo'
import { TYPES_ANIMATIONS_COLLECTIVES } from 'src/domain/rendez-vous/rendez-vous'
import { ActionSqlModel } from 'src/infrastructure/sequelize/models/action.sql-model'
import { ConseillerSqlModel } from 'src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from 'src/infrastructure/sequelize/models/jeune.sql-model'
import { RendezVousSqlModel } from 'src/infrastructure/sequelize/models/rendez-vous.sql-model'
import { SequelizeInjectionToken } from '../../../infrastructure/sequelize/providers'
import { buildError } from '../../../utils/logger.module'
import {
  fromSqlToRendezVousDetailJeuneQueryModel,
  fromSqlToRendezVousJeuneQueryModel
} from '../query-mappers/rendez-vous-milo.mappers'
import { AccueilJeuneMiloQueryModel } from '../query-models/jeunes.milo.query-model'
import { SessionJeuneMiloQueryModel } from '../query-models/sessions.milo.query.model'

export interface GetAccueilJeuneMiloQuery extends Query {
  idJeune: string
  maintenant: string
  accessToken: string
}

@Injectable()
export class GetAccueilJeuneMiloQueryHandler extends QueryHandler<
  GetAccueilJeuneMiloQuery,
  Result<AccueilJeuneMiloQueryModel>
> {
  constructor(
    private readonly jeuneAuthorizer: JeuneAuthorizer,
    private readonly getSessionsQueryGetter: GetSessionsVisiblesPourLeJeuneMiloQueryGetter,
    private readonly getRecherchesSauvegardeesQueryGetter: GetRecherchesSauvegardeesQueryGetter,
    private readonly getFavorisAccueilQueryGetter: GetFavorisAccueilQueryGetter,
    private readonly getCampagneQueryGetter: GetCampagneQueryGetter,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {
    super('GetAccueilJeuneMiloQueryHandler')
  }
  async handle(
    query: GetAccueilJeuneMiloQuery
  ): Promise<Result<AccueilJeuneMiloQueryModel>> {
    const maintenant = DateTime.fromISO(query.maintenant, {
      setZone: true
    })

    const dateDebutDeSemaine = maintenant.startOf('week')
    const dateFinDeSemaine = maintenant.endOf('week')
    const datePlus30Jours = maintenant.plus({ days: 30 }).endOf('day')
    const { idJeune } = query

    const jeuneSqlModel = await JeuneSqlModel.findByPk(query.idJeune, {
      attributes: ['id', 'idPartenaire', 'peutVoirLeComptageDesHeures'],
      include: [
        {
          model: ConseillerSqlModel,
          required: true,
          attributes: ['id', 'idAgence']
        }
      ]
    })

    if (!jeuneSqlModel) {
      return failure(new NonTrouveError('Jeune', query.idJeune))
    }

    if (!jeuneSqlModel.idPartenaire) {
      return failure(new JeuneMiloSansIdDossier(query.idJeune))
    }

    const [
      rendezVousSqlModelsCount,
      rendezVousSqlModelsProchainRdv,
      countActions,
      evenementSqlModelAVenir,
      recherchesQueryModels,
      favorisQueryModels,
      campagneQueryModel,
      resultatSessionsMilo
    ] = await Promise.all([
      this.countRendezVousSemaine(maintenant, dateFinDeSemaine, idJeune),
      this.prochainRendezVous(maintenant, idJeune),
      this.countActions(
        idJeune,
        maintenant,
        dateDebutDeSemaine,
        dateFinDeSemaine
      ),
      this.evenementsAVenir(jeuneSqlModel, maintenant),
      this.getRecherchesSauvegardeesQueryGetter.handle({
        idJeune
      }),
      this.getFavorisAccueilQueryGetter.handle({ idJeune }),
      this.getCampagneQueryGetter.handle({ idJeune }),
      this.recupererSessions(
        maintenant,
        dateFinDeSemaine,
        datePlus30Jours,
        query,
        jeuneSqlModel
      )
    ])

    return success({
      cetteSemaine: {
        nombreRendezVous:
          rendezVousSqlModelsCount +
          resultatSessionsMilo.sessionsInscritCetteSemaine.length,
        nombreActionsDemarchesEnRetard: countActions.enRetard,
        nombreActionsDemarchesARealiser: countActions.aRealiser,
        nombreActionsDemarchesAFaireSemaineCalendaire: countActions.aFaire
      },
      prochainRendezVous: rendezVousSqlModelsProchainRdv
        ? fromSqlToRendezVousJeuneQueryModel(
            rendezVousSqlModelsProchainRdv,
            Authentification.Type.JEUNE,
            idJeune
          )
        : undefined,
      prochaineSessionMilo: resultatSessionsMilo.sessionsInscritAVenir[0],
      evenementsAVenir: evenementSqlModelAVenir.map(acSql =>
        fromSqlToRendezVousDetailJeuneQueryModel(
          acSql,
          idJeune,
          Authentification.Type.JEUNE
        )
      ),
      sessionsMiloAVenir: resultatSessionsMilo.sessionsNonInscrit.slice(0, 3),
      mesAlertes: recherchesQueryModels,
      mesFavoris: favorisQueryModels,
      campagne: campagneQueryModel,
      peutVoirLeComptageDesHeures: Boolean(
        jeuneSqlModel.peutVoirLeComptageDesHeures
      )
    })
  }

  async authorize(
    query: GetAccueilJeuneMiloQuery,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.jeuneAuthorizer.autoriserLeJeune(
      query.idJeune,
      utilisateur,
      estMilo(utilisateur.structure)
    )
  }

  async monitor(): Promise<void> {
    return
  }

  private async countActions(
    idJeune: string,
    maintenant: DateTime,
    dateDebutDeSemaine: DateTime,
    dateFinDeSemaine: DateTime
  ): Promise<{ enRetard: number; aRealiser: number; aFaire: number }> {
    return ActionSqlModel.findOne({
      where: {
        idJeune,
        statut: {
          [Op.in]: [Action.Statut.EN_COURS, Action.Statut.PAS_COMMENCEE]
        }
      },
      attributes: [
        [
          Sequelize.fn(
            'COUNT',
            Sequelize.literal(`
            CASE 
              WHEN "date_echeance" < :dateDebutDuJour
              THEN 1 
            END
          `)
          ),
          'enRetard'
        ],
        [
          Sequelize.fn(
            'COUNT',
            Sequelize.literal(`
            CASE 
              WHEN "date_echeance" BETWEEN :maintenant AND :dateFinDeSemaine
              THEN 1 
            END
          `)
          ),
          'aRealiser'
        ],
        [
          Sequelize.fn(
            'COUNT',
            Sequelize.literal(`
            CASE 
              WHEN "date_echeance" BETWEEN :dateDebutDeSemaine AND :dateFinDeSemaine 
              THEN 1 
            END
          `)
          ),
          'aFaire'
        ]
      ],
      replacements: {
        maintenant: maintenant.toUTC().toISO(),
        dateDebutDuJour: maintenant.startOf('day').toUTC().toISO(),
        dateDebutDeSemaine: dateDebutDeSemaine.toUTC().toISO(),
        dateFinDeSemaine: dateFinDeSemaine.toUTC().toISO()
      }
    }).then(result => {
      return {
        enRetard: Number(result?.get('enRetard')) || 0,
        aRealiser: Number(result?.get('aRealiser')) || 0,
        aFaire: Number(result?.get('aFaire')) || 0
      }
    })
  }

  private async prochainRendezVous(
    maintenant: DateTime,
    idJeune: string
  ): Promise<RendezVousSqlModel | null> {
    interface RendezVousIdResult {
      id: string
    }

    /* Requête en 2 temps pour optimiser la requête :
     * 1. Requête SQL literal pour trouver le prochain rdv
     * 2. Chargement du modèle RendezVousSqlModel via Sequelize
     */
    const result: RendezVousIdResult[] = await this.sequelize.query(
      `
          SELECT rv.id
          FROM rendez_vous rv
                   INNER JOIN rendez_vous_jeune_association rvja
                              ON rvja.id_rendez_vous = rv.id
          WHERE rvja.id_jeune = :idJeune
            AND rv.annule = false
            AND rv.date >= :maintenant
          ORDER BY rv.date ASC LIMIT 1
      `,
      {
        replacements: {
          idJeune,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )

    if (!result.length) {
      return null
    }

    const rendezVousId = result[0].id

    return RendezVousSqlModel.findByPk(rendezVousId, {
      include: [
        {
          model: JeuneSqlModel,
          required: true,
          where: { id: idJeune },
          include: [
            {
              model: ConseillerSqlModel,
              required: true
            }
          ]
        }
      ]
    })
  }

  private async countRendezVousSemaine(
    maintenant: DateTime,
    dateFinDeSemaine: DateTime,
    idJeune: string
  ): Promise<number> {
    const result = (await RendezVousSqlModel.sequelize?.query(
      `
      SELECT COUNT(DISTINCT rv.id) as count
      FROM rendez_vous rv
      INNER JOIN rendez_vous_jeune_association rja
        ON rv.id = rja.id_rendez_vous
        AND rja.id_jeune = :idJeune
      WHERE rv.date BETWEEN :dateDebut AND :dateFin
        AND rv.annule = false
      `,
      {
        replacements: {
          idJeune,
          dateDebut: maintenant.toJSDate(),
          dateFin: dateFinDeSemaine.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )) as Array<{ count: string }>

    return Number.parseInt(result[0].count, 10)
  }

  private evenementsAVenir(
    jeuneSqlModel: JeuneSqlModel,
    maintenant: DateTime
  ): Promise<RendezVousSqlModel[]> {
    return RendezVousSqlModel.findAll({
      where: {
        idAgence: jeuneSqlModel.conseiller?.idAgence,
        date: { [Op.gte]: maintenant.toJSDate() },
        annule: false,
        type: {
          [Op.in]: TYPES_ANIMATIONS_COLLECTIVES
        },
        [Op.and]: this.sequelize.literal(`
        NOT EXISTS (
          SELECT 1
          FROM rendez_vous_jeune_association rvja
          WHERE rvja.id_rendez_vous = "RendezVousSqlModel"."id"
          AND rvja.id_jeune = ${this.sequelize.escape(jeuneSqlModel.id)}
        )
      `)
      },
      order: [['date', 'ASC']],
      limit: 3
    })
  }

  private async recupererSessions(
    maintenant: DateTime,
    dateFinDeSemaine: DateTime,
    datePlus30Jours: DateTime,
    query: GetAccueilJeuneMiloQuery,
    jeuneSqlModel: JeuneSqlModel
  ): Promise<ResultatSessionsMilo> {
    let sessionsInscrit: SessionJeuneMiloQueryModel[] = []
    let sessionsInscritAVenir: SessionJeuneMiloQueryModel[] = []
    let sessionsInscritCetteSemaine: SessionJeuneMiloQueryModel[] = []
    let sessionsNonInscrit: SessionJeuneMiloQueryModel[] = []

    if (jeuneSqlModel.idPartenaire) {
      try {
        const prochainesSessionsDepuisAujourdhuiModel =
          await this.getSessionsQueryGetter.handle(
            query.idJeune,
            Authentification.Type.JEUNE,
            query.accessToken,
            { debut: maintenant, fin: datePlus30Jours }
          )
        if (isSuccess(prochainesSessionsDepuisAujourdhuiModel)) {
          sessionsInscrit = prochainesSessionsDepuisAujourdhuiModel.data.filter(
            session => SessionMilo.Inscription.aEteInscrit(session.inscription)
          )
          sessionsInscritAVenir = sessionsInscrit.filter(
            session => DateTime.fromISO(session.dateHeureFin) >= maintenant
          )
          sessionsInscritCetteSemaine = sessionsInscrit.filter(session => {
            const dateDebutSession = DateTime.fromISO(session.dateHeureDebut)
            return dateDebutSession < dateFinDeSemaine
          })
          sessionsNonInscrit =
            prochainesSessionsDepuisAujourdhuiModel.data.filter(
              session =>
                !SessionMilo.Inscription.aEteInscrit(session.inscription)
            )
        }
      } catch (e) {
        this.logger.error(
          buildError(
            `La récupération des sessions de l'accueil du jeune ${query.idJeune} a échoué`,
            e
          )
        )
      }
    }

    return {
      sessionsInscritAVenir: sessionsInscritAVenir,
      sessionsInscritCetteSemaine: sessionsInscritCetteSemaine,
      sessionsNonInscrit: sessionsNonInscrit
    }
  }
}

class ResultatSessionsMilo {
  sessionsInscritAVenir: SessionJeuneMiloQueryModel[]
  sessionsInscritCetteSemaine: SessionJeuneMiloQueryModel[]
  sessionsNonInscrit: SessionJeuneMiloQueryModel[]
}
