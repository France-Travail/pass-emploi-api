import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { QueryTypes } from 'sequelize'
import { InitialiserLaVueDemarchesIAJobHandler } from '../../../../src/application/jobs/analytics/initialiser-la-vue-demarches-ia.job'
import { DATE_GENERALISATION_DEMARCHES_IA } from '../../../../src/application/jobs/analytics/vues/3-1bis-vue-fonctionnalites-demarches-ia'
import { Planificateur } from '../../../../src/domain/planificateur'
import { SuiviJob } from '../../../../src/domain/suivi-job'
import { DateService } from '../../../../src/utils/date-service'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'
import { getDatabase } from '../../../utils/database-for-testing'

const TABLES_EVENEMENTS = [
  'evenement_engagement_2022',
  'evenement_engagement_2023',
  'evenement_engagement_2024',
  'evenement_engagement'
]
const TABLES_VUES = [
  'analytics_fonctionnalites',
  'analytics_fonctionnalites_demarches_ia',
  'analytics_fonctionnalites_migration',
  'analytics_engagement',
  'analytics_engagement_national'
]

describe('InitialiserLaVueDemarchesIAJobHandler', () => {
  let handler: InitialiserLaVueDemarchesIAJobHandler
  let suiviJobService: StubbedType<SuiviJob.Service>
  let dateService: StubbedClass<DateService>
  const maintenant = DateTime.fromISO('2026-09-08')
  const semaineAvantGeneralisation = '2025-10-06'
  const semaineApresGeneralisation = '2026-08-31'

  before(async () => {
    await getDatabase().cleanPG()
    // La base analytics des jobs est la base de test
    process.env.DUMP_RESTORE_DB_TARGET =
      process.env.DATABASE_URL || 'postgresql://test:test@localhost:56432/test'

    const sandbox = createSandbox()
    suiviJobService = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    handler = new InitialiserLaVueDemarchesIAJobHandler(
      suiviJobService,
      dateService
    )

    const { sequelize } = getDatabase()
    for (const table of TABLES_EVENEMENTS) {
      await sequelize.query(`
        CREATE TABLE ${table} (
          id varchar, date_evenement timestamptz, categorie varchar, action varchar, nom varchar,
          id_utilisateur varchar, type_utilisateur varchar, structure varchar, dispositif varchar,
          code varchar, semaine date, jour date, agence varchar, departement varchar, region varchar
        );`)
    }
    await sequelize.query(`
      INSERT INTO evenement_engagement VALUES
        ('1', '${semaineAvantGeneralisation} 10:00+00', 'Action', 'Création', 'x', 'jeune-sans-ia', 'JEUNE', 'FRANCE_TRAVAIL', 'CEJ', 'ACTION_CREE', '${semaineAvantGeneralisation}', '${semaineAvantGeneralisation}', 'A', '75', 'IDF'),
        ('2', '${semaineAvantGeneralisation} 11:00+00', 'Démarche', 'IA', 'y', 'jeune-ia', 'JEUNE', 'FRANCE_TRAVAIL', 'BRSA', 'DEMARCHE_IA_CREEE', '${semaineAvantGeneralisation}', '${semaineAvantGeneralisation}', 'A', '75', 'IDF'),
        ('3', '${semaineApresGeneralisation} 10:00+00', 'Action', 'Création', 'x', 'jeune-sans-ia', 'JEUNE', 'FRANCE_TRAVAIL', 'CEJ', 'ACTION_CREE', '${semaineApresGeneralisation}', '${semaineApresGeneralisation}', 'A', '75', 'IDF'),
        ('4', '${semaineApresGeneralisation} 11:00+00', 'Message', 'Envoi', 'z', 'conseiller', 'CONSEILLER', 'MILO', NULL, 'MSG', '${semaineApresGeneralisation}', '${semaineApresGeneralisation}', 'B', '69', 'ARA');
    `)
  })

  after(async () => {
    const { sequelize } = getDatabase()
    for (const table of [...TABLES_EVENEMENTS, ...TABLES_VUES]) {
      await sequelize.query(`DROP TABLE IF EXISTS ${table};`)
    }
  })

  describe('handle', () => {
    let suiviJob: SuiviJob

    before(async () => {
      // When
      suiviJob = await handler.handle()
    })

    it('renvoie un suivi de job en succès', () => {
      // Then
      expect(suiviJob.succes).to.equal(true)
      expect(suiviJob.jobType).to.equal(
        Planificateur.JobType.INITIALISER_LA_VUE_DEMARCHES_IA
      )
    })

    it('ne garde que les bêta-testeurs avant la généralisation', async () => {
      // Then
      expect(
        semaineAvantGeneralisation < DATE_GENERALISATION_DEMARCHES_IA
      ).to.be.true()
      const lignes = await lignesDeLaVue(semaineAvantGeneralisation)
      expect(lignes).to.deep.equal([
        { structure: 'FRANCE_TRAVAIL', dispositif: 'BRSA', nb_users_total: 1 }
      ])
    })

    it('garde tous les bénéficiaires après la généralisation', async () => {
      // Then
      const lignes = await lignesDeLaVue(semaineApresGeneralisation)
      expect(lignes).to.deep.equal([
        { structure: 'FRANCE_TRAVAIL', dispositif: 'CEJ', nb_users_total: 1 }
      ])
    })
  })
})

async function lignesDeLaVue(
  semaine: string
): Promise<
  Array<{ structure: string; dispositif: string; nb_users_total: number }>
> {
  return getDatabase().sequelize.query(
    `SELECT structure, dispositif, nb_users_total
     FROM analytics_fonctionnalites_demarches_ia
     WHERE semaine = '${semaine}'
     ORDER BY structure, dispositif`,
    { type: QueryTypes.SELECT }
  )
}
