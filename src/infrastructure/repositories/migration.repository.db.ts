import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { QueryTypes, Sequelize } from 'sequelize'
import {
  BeneficiaireMigration,
  Migration,
  RebasculementOrphelin
} from '../../domain/migration'
import { MigrationSqlModel } from '../sequelize/models/migration.sql-model'
import { SequelizeInjectionToken } from '../sequelize/providers'

@Injectable()
export class MigrationSqlRepository implements Migration.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async existe(idMigration: string): Promise<boolean> {
    const migration = await MigrationSqlModel.findByPk(idMigration)
    return migration !== null
  }

  async getBeneficiairesDeLaMigrationDuConseillerInitial(
    idMigration: string
  ): Promise<BeneficiaireMigration[]> {
    // on veut que le conseiller initial : si on est dans un cas de transfert temporaire il est dans le champ id_conseiller_initial, sinon dans le champ id_conseiller
    const rows = await this.sequelize.query<{ id: string }>(
      `
      SELECT j.id
      FROM jeune j
      JOIN conseiller c ON c.id = COALESCE(j.id_conseiller_initial, j.id_conseiller)
      JOIN migration_conseillers mc ON mc.email_conseiller = c.email
      WHERE mc.id_migration = :idMigration
      `,
      {
        replacements: { idMigration },
        type: QueryTypes.SELECT
      }
    )
    return rows.map(row => new BeneficiaireMigration(row.id))
  }

  async rebasculerOrphelins(
    idMigration: string
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
      JOIN migration_conseillers mc ON mc.email_conseiller = c_actuel.email
                                   AND mc.id_migration = :idMigration
      WHERE c_actuel.id = jeune.id_conseiller
        AND jeune.id_conseiller_initial IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM conseiller c_initial
          JOIN migration_conseillers mc2 ON mc2.email_conseiller = c_initial.email
                                        AND mc2.id_migration = :idMigration
          WHERE c_initial.id = jeune.id_conseiller_initial
        )
      RETURNING
        jeune.id AS id_jeune,
        c_actuel.id AS ancien_id_conseiller,
        jeune.id_conseiller AS nouveau_id_conseiller
      `,
      {
        replacements: { idMigration },
        type: QueryTypes.SELECT
      }
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
    const rows = await this.sequelize.query<{ date_migration: Date | null }>(
      `
      SELECT MIN(mc.date_migration) AS date_migration
      FROM migration_conseillers mc
             JOIN conseiller c ON c.id = :idConseiller
      WHERE mc.email_conseiller = c.email
        AND mc.date_migration IS NOT NULL
      `,
      {
        replacements: { idConseiller },
        type: QueryTypes.SELECT
      }
    )
    return fromSqlToDateDeMigration(rows)
  }

  async getDateDeMigrationDuConseillerDuBeneficiaire(
    idBeneficiaire: string
  ): Promise<DateTime | undefined> {
    const rows = await this.sequelize.query<{ date_migration: Date | null }>(
      `
      SELECT MIN(mc.date_migration) AS date_migration
      FROM migration_conseillers mc
             JOIN jeune j ON j.id = :idJeune
             JOIN conseiller c ON c.id = COALESCE(j.id_conseiller_initial, j.id_conseiller)
      WHERE mc.email_conseiller = c.email
        AND mc.date_migration IS NOT NULL
      `,
      {
        replacements: { idJeune: idBeneficiaire },
        type: QueryTypes.SELECT
      }
    )
    return fromSqlToDateDeMigration(rows)
  }
}

// MIN sur un ensemble vide renvoie une ligne dont la date est nulle.
function fromSqlToDateDeMigration(
  rows: Array<{ date_migration: Date | null }>
): DateTime | undefined {
  const dateMigration = rows[0]?.date_migration
  return dateMigration ? DateTime.fromJSDate(dateMigration) : undefined
}
