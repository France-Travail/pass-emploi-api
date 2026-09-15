import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { QueryTypes, Sequelize } from 'sequelize'
import { Deploiement } from '../../domain/deploiement'
import { Fonctionnalite } from '../../domain/fonctionnalite'
import { SequelizeInjectionToken } from '../sequelize/providers'
import {
  sqlJeuneDansPopulation,
  sqlJoinConseillerDeReferenceDuJeune
} from './sql-helpers'

@Injectable()
export class FonctionnaliteSqlRepository implements Fonctionnalite.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async getIdsFonctionnalitesActivesDuJeune(
    idBeneficiaire: string,
    maintenant: DateTime
  ): Promise<string[]> {
    const rows = await this.sequelize.query<{ id_fonctionnalite: string }>(
      `
        SELECT DISTINCT d.id_fonctionnalite
        FROM deploiement d
        ${sqlJoinConseillerDeReferenceDuJeune()}
        WHERE d.nature = :nature
          AND d.date_activation <= :maintenant
          AND ${sqlJeuneDansPopulation('j', 'c', 'd.id_population')}
        ORDER BY d.id_fonctionnalite
      `,
      {
        replacements: {
          idJeune: idBeneficiaire,
          nature: Deploiement.Nature.FONCTIONNALITE,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )
    return rows.map(row => row.id_fonctionnalite)
  }
}
