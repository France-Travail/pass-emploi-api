import { Inject, Injectable } from '@nestjs/common'
import { DateTime } from 'luxon'
import { QueryTypes, Sequelize } from 'sequelize'
import { Fonctionnalite } from '../../domain/fonctionnalite'
import { SequelizeInjectionToken } from '../sequelize/providers'

@Injectable()
export class FonctionnaliteSqlRepository implements Fonctionnalite.Repository {
  constructor(
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize
  ) {}

  async getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire(
    idBeneficiaire: string,
    maintenant: DateTime
  ): Promise<string[]> {
    // Le conseiller initial fait foi : en transfert temporaire il est dans
    // id_conseiller_initial, sinon dans id_conseiller.
    const rows = await this.sequelize.query<{ id_fonctionnalite: string }>(
      `
        SELECT DISTINCT fc.id_fonctionnalite
        FROM fonctionnalite_conseillers fc
               JOIN jeune j ON j.id = :idJeune
               JOIN conseiller c ON c.id = COALESCE(j.id_conseiller_initial, j.id_conseiller)
        WHERE fc.email_conseiller = c.email
          AND (fc.date_activation IS NULL OR fc.date_activation <= :maintenant)
        ORDER BY fc.id_fonctionnalite
      `,
      {
        replacements: {
          idJeune: idBeneficiaire,
          maintenant: maintenant.toJSDate()
        },
        type: QueryTypes.SELECT
      }
    )
    return rows.map(row => row.id_fonctionnalite)
  }
}
