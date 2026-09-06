import { Inject, Injectable } from '@nestjs/common'
import { Op, Sequelize } from 'sequelize'
import { Jeune, JeuneNonAccompagne } from '../../../domain/jeune/jeune'
import { DateService } from '../../../utils/date-service'
import { IdService } from '../../../utils/id-service'
import { FirebaseClient } from '../../clients/firebase-client'
import { ConseillerSqlModel } from '../../sequelize/models/conseiller.sql-model'
import { JeuneDto, JeuneSqlModel } from '../../sequelize/models/jeune.sql-model'
import { RendezVousJeuneAssociationSqlModel } from '../../sequelize/models/rendez-vous-jeune-association.sql-model'
import { RendezVousSqlModel } from '../../sequelize/models/rendez-vous.sql-model'
import { TYPES_ANIMATIONS_COLLECTIVES } from '../../../domain/rendez-vous/rendez-vous'
import { TransfertConseillerSqlModel } from '../../sequelize/models/transfert-conseiller.sql-model'
import { SequelizeInjectionToken } from '../../sequelize/providers'
import { AsSql } from '../../sequelize/types'
import {
  fromSqlToJeune,
  fromSqlToJeuneOuNonAccompagne
} from '../mappers/jeunes.mappers'

@Injectable()
export class JeuneSqlRepository implements Jeune.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    private firebaseClient: FirebaseClient,
    private idService: IdService,
    private dateService: DateService
  ) {}

  async get(id: string): Promise<Jeune | undefined> {
    const jeuneSqlModel = await JeuneSqlModel.findByPk(id, {
      include: [ConseillerSqlModel]
    })
    if (!jeuneSqlModel) {
      return undefined
    }
    return fromSqlToJeune(jeuneSqlModel)
  }

  async findAll(ids: string[]): Promise<Jeune[]> {
    const jeunesSqlModels = await JeuneSqlModel.findAll({
      where: {
        id: {
          [Op.in]: ids
        }
      },
      include: [ConseillerSqlModel]
    })
    return jeunesSqlModels.map(fromSqlToJeune)
  }

  async existe(id: string): Promise<boolean> {
    const exists = (await this.sequelize.query(
      `select exists(select 1 from jeune where id = :idJeune)`,
      {
        replacements: { idJeune: id }
      }
    )) as Array<Array<{ exists: boolean }>>
    return Boolean(exists[0][0].exists)
  }

  async getByEmail(
    email: string,
    options?: { includeConseiller: boolean }
  ): Promise<Jeune | JeuneNonAccompagne | undefined> {
    const normalizedEmail = email.trim().toLowerCase()
    const jeuneSqlModel = await JeuneSqlModel.findOne({
      where: this.sequelize.where(
        this.sequelize.fn(
          'LOWER',
          this.sequelize.fn('TRIM', this.sequelize.col('JeuneSqlModel.email'))
        ),
        normalizedEmail
      ),
      ...(options?.includeConseiller && { include: [ConseillerSqlModel] })
    })
    if (!jeuneSqlModel) {
      return undefined
    }
    return fromSqlToJeuneOuNonAccompagne(jeuneSqlModel)
  }

  async transferAndSaveAll(
    jeunes: Jeune[],
    idConseillerCible: string,
    idConseillerSource: string,
    idConseillerQuiTransfert: string,
    typeTransfert: Jeune.TypeTransfert
  ): Promise<void> {
    const idsJeunes = jeunes.map(jeune => jeune.id)
    await this.firebaseClient.transfererChat(idConseillerCible, idsJeunes)
    await Promise.all([
      this.creerTransferts(
        jeunes,
        idConseillerSource,
        idConseillerCible,
        idConseillerQuiTransfert,
        typeTransfert
      ),
      this.saveAllJeuneTransferes(jeunes)
    ])
  }

  async findAllJeunesByConseiller(idConseiller: string): Promise<Jeune[]> {
    const jeunesSqlModel = await JeuneSqlModel.findAll({
      where: {
        idConseiller
      }
    })
    return jeunesSqlModel.map(fromSqlToJeune)
  }

  async findAllJeunesByIdsAndConseiller(
    idsJeunes: string[],
    idConseiller: string
  ): Promise<Jeune[]> {
    const jeunesSqlModel = await JeuneSqlModel.findAll({
      where: {
        id: {
          [Op.in]: idsJeunes
        },
        idConseiller
      }
    })
    return jeunesSqlModel.map(fromSqlToJeune)
  }

  async findAllByIdStructureMilo(idStructureMilo: string): Promise<Jeune[]> {
    const jeunesSqlModels = await JeuneSqlModel.findAll({
      where: { idStructureMilo }
    })
    return jeunesSqlModels.map(fromSqlToJeune)
  }

  async findAllJeunesByConseillerInitial(
    idConseiller: string
  ): Promise<Jeune[]> {
    const jeunesSqlModel = await JeuneSqlModel.findAll({
      where: {
        idConseillerInitial: idConseiller
      },
      order: [['id', 'ASC']],
      include: [ConseillerSqlModel]
    })
    return jeunesSqlModel.map(jeuneSqlModel => fromSqlToJeune(jeuneSqlModel))
  }

  async save(jeune: Jeune | JeuneNonAccompagne): Promise<void> {
    const jeuneDto: Partial<AsSql<JeuneDto>> = {
      id: jeune.id,
      nom: jeune.lastName,
      prenom: jeune.firstName,
      idConseiller: jeune.conseiller?.id,
      dateCreation: jeune.creationDate.toJSDate(),
      dateFinCEJ: jeune.dateFinCEJ?.toJSDate() ?? null,
      email: jeune.email ?? null,
      structure: jeune.structure,
      idPartenaire: jeune.idPartenaire ?? null,
      partageFavoris: jeune.preferences.partageFavoris,
      notificationsAlertesOffres: jeune.preferences.alertesOffres,
      notificationsMessages: jeune.preferences.messages,
      notificationsCreationActionConseiller:
        jeune.preferences.creationActionConseiller,
      notificationsRendezVousSessions: jeune.preferences.rendezVousSessions,
      notificationsRappelActions: jeune.preferences.rappelActions,
      notificationsActualitesMilo: jeune.preferences.actualitesMilo,
      appVersion: jeune.configuration.appVersion ?? null,
      pushNotificationToken: jeune.configuration.pushNotificationToken ?? null,
      installationId: jeune.configuration.installationId ?? null,
      instanceId: jeune.configuration.instanceId ?? null,
      timezone: jeune.configuration.fuseauHoraire ?? null,
      dateSignatureCGU: jeune.dateSignatureCGU?.toJSDate() ?? null,
      dispositif: jeune.dispositif ?? null,
      peutVoirLeComptageDesHeures: jeune.peutVoirLeComptageDesHeures ?? null
    }
    await JeuneSqlModel.upsert(jeuneDto)
  }

  async reinitialiserDatePremiereConnexion(idJeune: string): Promise<void> {
    await JeuneSqlModel.update(
      { datePremiereConnexion: null },
      { where: { id: idJeune } }
    )
  }

  async supprimer(idJeune: string): Promise<void> {
    await this.sequelize.transaction(async transaction => {
      const associations = await RendezVousJeuneAssociationSqlModel.findAll({
        attributes: ['idRendezVous'],
        where: { idJeune },
        transaction
      })
      const idsRendezVous = associations.map(
        association => association.idRendezVous
      )

      await JeuneSqlModel.destroy({ where: { id: idJeune }, transaction })

      if (idsRendezVous.length) {
        const associationsRestantes =
          await RendezVousJeuneAssociationSqlModel.findAll({
            attributes: ['idRendezVous'],
            where: { idRendezVous: { [Op.in]: idsRendezVous } },
            transaction
          })
        const idsRendezVousAvecParticipants = new Set(
          associationsRestantes.map(association => association.idRendezVous)
        )
        const idsRendezVousOrphelins = idsRendezVous.filter(
          idRendezVous => !idsRendezVousAvecParticipants.has(idRendezVous)
        )
        if (idsRendezVousOrphelins.length) {
          await RendezVousSqlModel.destroy({
            where: {
              id: { [Op.in]: idsRendezVousOrphelins },
              type: { [Op.notIn]: TYPES_ANIMATIONS_COLLECTIVES }
            },
            transaction
          })
        }
      }
    })
  }

  async saveAllJeuneTransferes(jeunes: Jeune[]): Promise<void> {
    for (const jeune of jeunes) {
      const jeuneTransfereSQL: Omit<
        AsSql<JeuneDto>,
        | 'idAuthentification'
        | 'datePremiereConnexion'
        | 'dateDerniereConnexion'
        | 'appVersion'
        | 'installationId'
        | 'instanceId'
        | 'pushNotificationToken'
        | 'dateDerniereActivite'
        | 'timezone'
        | 'idStructureMilo'
        | 'dateSignatureCGU'
        | 'peutVoirLeComptageDesHeures'
      > = {
        id: jeune.id,
        nom: jeune.lastName,
        prenom: jeune.firstName,
        idConseiller: jeune.conseiller?.id,
        idConseillerInitial: jeune.conseillerInitial?.id ?? null,
        dateCreation: jeune.creationDate.toJSDate(),
        dateFinCEJ: jeune.dateFinCEJ?.toJSDate() ?? null,
        email: jeune.email ?? null,
        structure: jeune.structure,
        idPartenaire: jeune.idPartenaire ?? null,
        partageFavoris: jeune.preferences.partageFavoris,
        notificationsAlertesOffres: jeune.preferences.alertesOffres,
        notificationsMessages: jeune.preferences.messages,
        notificationsCreationActionConseiller:
          jeune.preferences.creationActionConseiller,
        notificationsRendezVousSessions: jeune.preferences.rendezVousSessions,
        notificationsRappelActions: jeune.preferences.rappelActions,
        notificationsActualitesMilo: jeune.preferences.actualitesMilo,
        dispositif: jeune.dispositif ?? null
      }
      await JeuneSqlModel.upsert(jeuneTransfereSQL)
    }
  }

  private async creerTransferts(
    jeunes: Jeune[],
    idConseillerSource: string,
    idConseillerCible: string,
    idConseillerQuiTransfert: string,
    typeTransfert: Jeune.TypeTransfert
  ): Promise<void> {
    const dateTransfert = this.dateService.nowJs()
    await TransfertConseillerSqlModel.bulkCreate(
      jeunes.map(jeune => {
        return {
          id: this.idService.uuid(),
          idJeune: jeune.id,
          emailJeune: jeune.email,
          idConseillerSource,
          idConseillerCible,
          idConseillerQuiTransfert,
          dateTransfert,
          typeTransfert
        }
      })
    )
  }
}
