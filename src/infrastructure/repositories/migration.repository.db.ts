import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { QueryTypes, Sequelize } from 'sequelize'
import { Deploiement } from '../../domain/deploiement'
import {
  BeneficiaireMigration,
  Migration,
  RebasculementOrphelin
} from '../../domain/migration'
import { DeploiementSqlModel } from '../sequelize/models/deploiement.sql-model'
import { SequelizeInjectionToken } from '../sequelize/providers'
import {
  sqlConseillerDansPopulation,
  sqlJeuneDansPopulation,
  sqlJoinConseillerDeReference,
  sqlJoinConseillersConcernes,
  sqlJoinConseillerDeReferenceDuJeune
} from './sql-helpers'

@Injectable()
export class MigrationSqlRepository implements Migration.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async populationConcerneeParUneMigration(
    idPopulation: string
  ): Promise<boolean> {
    const deploiement = await DeploiementSqlModel.findOne({
      where: { idPopulation, nature: Deploiement.Nature.MIGRATION }
    })
    return deploiement !== null
  }

  async getBeneficiairesAMigrerParProfilOuConseillerCite(
    idPopulation: string
  ): Promise<BeneficiaireMigration[]> {
    const rows = await this.sequelize.query<{ id: string }>(
      `
        SELECT j.id
        FROM jeune j
        ${sqlJoinConseillerDeReference('j', 'c')}
        WHERE ${sqlJeuneDansPopulation('j', 'c', ':idPopulation')}
      `,
      { replacements: { idPopulation }, type: QueryTypes.SELECT }
    )
    return rows.map(row => new BeneficiaireMigration(row.id))
  }

  async rebasculerOrphelins(
    idPopulation: string
  ): Promise<RebasculementOrphelin[]> {
    const rows = await this.sequelize.query<{
      id_jeune: string
      ancien_id_conseiller: string
      nouveau_id_conseiller: string
    }>(
      `
        UPDATE jeune
        SET id_conseiller = jeune.id_conseiller_initial,
            id_conseiller_initial = NULL
        FROM conseiller c_actuel
        WHERE c_actuel.id = jeune.id_conseiller
          AND jeune.id_conseiller_initial IS NOT NULL
          AND ${sqlConseillerDansPopulation('c_actuel', ':idPopulation')}
          AND NOT EXISTS (
            SELECT 1
            FROM conseiller c_initial
            WHERE c_initial.id = jeune.id_conseiller_initial
              AND ${sqlConseillerDansPopulation('c_initial', ':idPopulation')}
          )
        RETURNING
          jeune.id AS id_jeune,
          c_actuel.id AS ancien_id_conseiller,
          jeune.id_conseiller AS nouveau_id_conseiller
      `,
      { replacements: { idPopulation }, type: QueryTypes.SELECT }
    )
    return rows.map(row => ({
      idJeune: row.id_jeune,
      ancienIdConseiller: row.ancien_id_conseiller,
      nouveauIdConseiller: row.nouveau_id_conseiller
    }))
  }

  async getDateDeMigrationDuConseiller(
    idConseiller: string
  ): Promise<DateTime | undefined> {
    const rows = await this.sequelize.query<{ date_activation: Date | null }>(
      `
        SELECT MIN(d.date_activation) AS date_activation
        FROM deploiement d
        ${sqlJoinConseillersConcernes('d', 'c')}
        WHERE c.id = :idConseiller
          AND d.nature = :nature
      `,
      {
        replacements: { idConseiller, nature: Deploiement.Nature.MIGRATION },
        type: QueryTypes.SELECT
      }
    )
    return fromSqlToDateDeMigration(rows)
  }

  async getDateDeMigrationDuBeneficiaire(
    idBeneficiaire: string
  ): Promise<DateTime | undefined> {
    const rows = await this.sequelize.query<{ date_activation: Date | null }>(
      `
        SELECT MIN(d.date_activation) AS date_activation
        FROM deploiement d
        ${sqlJoinConseillerDeReferenceDuJeune()}
        WHERE d.nature = :nature
          AND ${sqlJeuneDansPopulation('j', 'c', 'd.id_population')}
      `,
      {
        replacements: {
          idJeune: idBeneficiaire,
          nature: Deploiement.Nature.MIGRATION
        },
        type: QueryTypes.SELECT
      }
    )
    return fromSqlToDateDeMigration(rows)
  }
}

// MIN sur un ensemble vide renvoie une ligne dont la date est nulle.
function fromSqlToDateDeMigration(
  rows: Array<{ date_activation: Date | null }>
): DateTime | undefined {
  const dateActivation = rows[0]?.date_activation
  return dateActivation ? DateTime.fromJSDate(dateActivation) : undefined
}
