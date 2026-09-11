import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { QueryTypes, Sequelize } from 'sequelize'
import { Deploiement } from '../../domain/deploiement'
import { Fonctionnalite } from '../../domain/fonctionnalite'
import { SequelizeInjectionToken } from '../sequelize/providers'
import { sqlConseillerDansPopulation } from './population.repository.db'

// Jointure du jeune `:idJeune` vers son conseiller de référence `c` : l'initial en cas de transfert temporaire, sinon le courant.
export const SQL_JOIN_CONSEILLER_DE_REFERENCE_DU_JEUNE = `
  JOIN jeune j ON j.id = :idJeune
  JOIN conseiller c ON c.id = COALESCE(j.id_conseiller_initial, j.id_conseiller)`

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
        ${SQL_JOIN_CONSEILLER_DE_REFERENCE_DU_JEUNE}
        WHERE d.nature = :nature
          AND d.date_activation <= :maintenant
          AND ${sqlConseillerDansPopulation('c', 'd.id_population')}
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
