import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { QueryTypes } from 'sequelize'
import {
  ANALYTICS_POPULATION_MEMBRES_TABLE_NAME,
  ChargerLesPopulationsJobHandler
} from '../../../../src/application/jobs/analytics/0bis-charger-les-populations.job'
import { Core } from '../../../../src/domain/core'
import { Planificateur } from '../../../../src/domain/planificateur'
import { Profil } from '../../../../src/domain/profil'
import { SuiviJob } from '../../../../src/domain/suivi-job'
import { AgenceSqlModel } from '../../../../src/infrastructure/sequelize/models/agence.sql-model'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../../src/infrastructure/sequelize/models/population.sql-model'
import { StructureMiloSqlModel } from '../../../../src/infrastructure/sequelize/models/structure-milo.sql-model'
import { DateService } from '../../../../src/utils/date-service'
import { uneAgenceDto } from '../../../fixtures/sql-models/agence.sql-model'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../../fixtures/sql-models/jeune.sql-model'
import { uneStructureMiloDto } from '../../../fixtures/sql-models/structureMilo.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from '../../../utils'
import { getDatabase } from '../../../utils/database-for-testing'

interface Membre {
  id_population: string
  type_utilisateur: string
  id_utilisateur: string
  email: string | null
  nom: string
  prenom: string
  structure: string
  dispositif: string | null
  agence: string | null
  email_conseiller_reference: string | null
  type_conseiller_reference: string | null
  date_calcul: Date
}

describe('ChargerLesPopulationsJobHandler', () => {
  let handler: ChargerLesPopulationsJobHandler
  let suiviJobService: StubbedType<SuiviJob.Service>
  let dateService: StubbedClass<DateService>
  const maintenant = DateTime.fromISO('2026-09-17T03:00:00.000Z')

  before(async () => {
    await getDatabase().cleanPG()
    // La base analytics des jobs est la base de test
    process.env.DUMP_RESTORE_DB_TARGET =
      process.env.DATABASE_URL || 'postgresql://test:test@localhost:56432/test'

    const sandbox = createSandbox()
    suiviJobService = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    handler = new ChargerLesPopulationsJobHandler(suiviJobService, dateService)

    await StructureMiloSqlModel.create(
      uneStructureMiloDto({ id: 'ML-07', nomOfficiel: 'ML Aubenas' })
    )
    await AgenceSqlModel.create(
      uneAgenceDto({ id: 'FT-06', nomAgence: 'Agence Nice' })
    )
    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: 'conseillerCite',
        structure: Core.Structure.MILO,
        email: 'cite@milo.fr',
        nom: 'Citee',
        prenom: 'Camille',
        idStructureMilo: 'ML-07'
      }),
      unConseillerDto({
        id: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI,
        email: 'ftcej@ft.fr',
        idAgence: 'FT-06'
      }),
      unConseillerDto({
        id: 'conseillerHors',
        structure: Core.Structure.MILO,
        email: 'hors@milo.fr'
      })
    ])
    // Le profil du jeune est le sien, pas celui de son conseiller : il est posé explicitement.
    await JeuneSqlModel.bulkCreate([
      unJeuneDto({
        id: 'jeuneCite',
        idConseiller: 'conseillerCite',
        structure: Core.Structure.MILO,
        email: 'jeune.cite@mail.fr',
        nom: 'Cite',
        prenom: 'Jean',
        idStructureMilo: 'ML-07'
      }),
      unJeuneDto({
        id: 'jeuneTransfere',
        idConseiller: 'conseillerHors',
        idConseillerInitial: 'conseillerCite',
        structure: Core.Structure.MILO
      }),
      unJeuneDto({
        id: 'jeuneFtCej',
        idConseiller: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneCejChezHors',
        idConseiller: 'conseillerHors',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneBrsaChezCej',
        idConseiller: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI_BRSA
      }),
      unJeuneDto({
        id: 'jeuneHors',
        idConseiller: 'conseillerHors',
        structure: Core.Structure.MILO
      })
    ])
    await PopulationSqlModel.bulkCreate([
      { id: 'PILOTE', description: 'Pilote' },
      { id: 'VIDE', description: 'Personne' }
    ])
    await PopulationConseillerSqlModel.create({
      idPopulation: 'PILOTE',
      emailConseiller: 'cite@milo.fr'
    })
    await PopulationProfilSqlModel.create({
      idPopulation: 'PILOTE',
      structure: Profil.Structure.FRANCE_TRAVAIL,
      dispositif: Profil.Dispositif.CEJ
    })
  })

  after(async () => {
    await getDatabase().sequelize.query(
      `DROP TABLE IF EXISTS ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME};`
    )
  })

  describe('handle', () => {
    let suiviJob: SuiviJob

    before(async () => {
      // Given : une ligne périmée qui doit disparaître au rebuild
      await handler.handle()
      await getDatabase().sequelize.query(`
        INSERT INTO ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
          (id_population, type_utilisateur, id_utilisateur, email, nom, prenom, structure, dispositif, agence, email_conseiller_reference, type_conseiller_reference, date_calcul)
        VALUES ('PILOTE', 'JEUNE', 'jeunePerime', NULL, 'Perime', 'Paul', 'MILO', NULL, NULL, NULL, NULL, '2026-01-01T00:00:00Z');
      `)

      // When
      suiviJob = await handler.handle()
    })

    it('renvoie un suivi de job en succès avec la volumétrie', () => {
      // Then
      expect(suiviJob.succes).to.equal(true)
      expect(suiviJob.jobType).to.equal(
        Planificateur.JobType.CHARGER_POPULATIONS_ANALYTICS
      )
      expect(suiviJob.resultat).to.deep.equal({
        nbPopulations: 2,
        nbConseillers: 2,
        nbJeunes: 4
      })
    })

    it('résout les conseillers via PopulationSqlRepository.getIdsDesConseillersParProfilOuConseillerCite', async () => {
      // Then
      const conseillers = await membres('CONSEILLER')
      expect(conseillers.map(m => m.id_utilisateur)).to.deep.equal([
        'conseillerCite',
        'conseillerFtCej'
      ])
      expect(conseillers[0]).to.deep.include({
        id_population: 'PILOTE',
        email: 'cite@milo.fr',
        nom: 'Citee',
        prenom: 'Camille',
        structure: 'MILO',
        agence: 'ML Aubenas',
        email_conseiller_reference: null,
        type_conseiller_reference: null,
        date_calcul: maintenant.toJSDate()
      })
      expect(conseillers[1]).to.deep.include({
        structure: 'FRANCE_TRAVAIL',
        dispositif: 'CEJ',
        agence: 'Agence Nice'
      })
    })

    it('résout les jeunes via PopulationSqlRepository.getIdsDesJeunesParProfilOuConseillerCite, avec leur conseiller de référence', async () => {
      // Then
      const jeunes = await membres('JEUNE')
      expect(
        jeunes.map(m => [
          m.id_utilisateur,
          m.email_conseiller_reference,
          m.type_conseiller_reference
        ])
      ).to.deep.equal([
        ['jeuneCejChezHors', 'hors@milo.fr', 'ACTUEL'],
        ['jeuneCite', 'cite@milo.fr', 'ACTUEL'],
        ['jeuneFtCej', 'ftcej@ft.fr', 'ACTUEL'],
        ['jeuneTransfere', 'cite@milo.fr', 'INITIAL']
      ])
      expect(jeunes.every(m => m.id_population === 'PILOTE')).to.equal(true)
    })

    it("renseigne l'identité et le lieu d'accompagnement du jeune, le sien sinon celui de son conseiller de référence", async () => {
      // Then
      const jeunes = await membres('JEUNE')
      expect(
        jeunes.find(m => m.id_utilisateur === 'jeuneCite')
      ).to.deep.include({
        email: 'jeune.cite@mail.fr',
        nom: 'Cite',
        prenom: 'Jean',
        structure: 'MILO',
        agence: 'ML Aubenas'
      })
      expect(
        jeunes.find(m => m.id_utilisateur === 'jeuneFtCej')
      ).to.deep.include({
        structure: 'FRANCE_TRAVAIL',
        dispositif: 'CEJ',
        agence: 'Agence Nice'
      })
    })

    it('repart de zéro à chaque run', async () => {
      // Then
      const lignes = await membres('JEUNE')
      expect(lignes.map(m => m.id_utilisateur)).not.to.include('jeunePerime')
      expect(
        lignes.every(m => m.date_calcul.getTime() === maintenant.toMillis())
      ).to.equal(true)
    })
  })
})

async function membres(typeUtilisateur: string): Promise<Membre[]> {
  return getDatabase().sequelize.query<Membre>(
    `SELECT * FROM ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME}
     WHERE type_utilisateur = '${typeUtilisateur}'
     ORDER BY id_utilisateur`,
    { type: QueryTypes.SELECT }
  )
}
