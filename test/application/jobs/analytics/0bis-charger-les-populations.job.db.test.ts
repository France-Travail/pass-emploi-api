import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { QueryTypes } from 'sequelize'
import {
  ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME,
  ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME,
  ANALYTICS_POPULATION_MEMBRES_TABLE_NAME,
  ChargerLesPopulationsJobHandler
} from '../../../../src/application/jobs/analytics/0bis-charger-les-populations.job'
import { Communication } from '../../../../src/domain/communication'
import { Core } from '../../../../src/domain/core'
import { Deploiement } from '../../../../src/domain/deploiement'
import { Planificateur } from '../../../../src/domain/planificateur'
import { Profil } from '../../../../src/domain/profil'
import { SuiviJob } from '../../../../src/domain/suivi-job'
import { AgenceSqlModel } from '../../../../src/infrastructure/sequelize/models/agence.sql-model'
import { CommunicationSqlModel } from '../../../../src/infrastructure/sequelize/models/communication.sql-model'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { DeploiementSqlModel } from '../../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { JeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { CommunicationSqlRepository } from '../../../../src/infrastructure/repositories/communication.repository.db'
import { MigrationSqlRepository } from '../../../../src/infrastructure/repositories/migration.repository.db'
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

interface Utilisateur {
  type_utilisateur: string
  id_utilisateur: string
  email: string | null
  nom: string
  prenom: string
  structure: string
  dispositif: string | null
  agence: string | null
  date_calcul: Date
}

interface Membre extends Utilisateur {
  id_population: string
  email_conseiller_reference: string | null
  type_conseiller_reference: string | null
}

interface Destinataire extends Utilisateur {
  id_communication: string
  id_population: string
  destinataire: string
  type: string
  titre: string
  contenu: string
  date_debut: Date
  date_fin: Date
  statut: string
}

interface MembreDeploiement extends Utilisateur {
  id_deploiement: string
  id_population: string
  nature: string
  id_fonctionnalite: string | null
  date_activation: Date
  statut: string
}

describe('ChargerLesPopulationsJobHandler', () => {
  let handler: ChargerLesPopulationsJobHandler
  let suiviJobService: StubbedType<SuiviJob.Service>
  let dateService: StubbedClass<DateService>
  const maintenant = DateTime.fromISO('2026-09-17T03:00:00.000Z')
  const hier = maintenant.minus({ days: 1 }).toJSDate()
  const demain = maintenant.plus({ days: 1 }).toJSDate()
  const dansUneSemaine = maintenant.plus({ weeks: 1 }).toJSDate()

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
    await CommunicationSqlModel.bulkCreate([
      uneCommunication({
        id: 1,
        titre: 'Passée',
        dateDebut: maintenant.minus({ weeks: 1 }).toJSDate(),
        dateFin: hier
      }),
      uneCommunication({ id: 2, titre: 'En cours', dateDebut: hier }),
      uneCommunication({ id: 3, titre: 'Prévue', dateDebut: demain }),
      uneCommunication({
        id: 4,
        titre: 'Pour les jeunes',
        destinataire: Communication.Destinataire.JEUNE
      }),
      uneCommunication({ id: 5, titre: 'Personne', idPopulation: 'VIDE' })
    ])
    await FonctionnaliteSqlModel.create({ id: 'DEMARCHES_IA' })
    await DeploiementSqlModel.bulkCreate([
      {
        id: 10,
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PILOTE',
        idFonctionnalite: null,
        dateActivation: dansUneSemaine
      },
      {
        id: 11,
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'DEMARCHES_IA',
        dateActivation: hier
      },
      {
        id: 12,
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'VIDE',
        idFonctionnalite: null,
        dateActivation: dansUneSemaine
      }
    ])
  })

  after(async () => {
    await getDatabase().sequelize.query(`
      DROP TABLE IF EXISTS ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME};
      DROP TABLE IF EXISTS ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME};
      DROP TABLE IF EXISTS ${ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME};
    `)
  })

  function uneCommunication(surcharge: {
    id: number
    titre: string
    idPopulation?: string
    destinataire?: Communication.Destinataire
    dateDebut?: Date
    dateFin?: Date
  }): {
    id: number
    idPopulation: string
    destinataire: Communication.Destinataire
    type: Communication.Type
    dateDebut: Date
    dateFin: Date
    titre: string
    contenu: string
  } {
    return {
      idPopulation: 'PILOTE',
      destinataire: Communication.Destinataire.CONSEILLER,
      type: Communication.Type.IN_APP,
      dateDebut: hier,
      dateFin: dansUneSemaine,
      contenu: 'Contenu',
      ...surcharge
    }
  }

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
        nbJeunes: 4,
        nbDestinatairesCommunications: 6,
        nbMembresDeploiements: 4
      })
    })

    it('liste les conseillers de chaque population : cités par email ou dont le profil correspond', async () => {
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

    it("liste les jeunes de chaque population avec l'email de leur conseiller de référence, l'initial en cas de transfert", async () => {
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

    it('liste les conseillers destinataires de chaque communication, avec son statut figé à date_calcul', async () => {
      // Then
      const destinataires = await lignes<Destinataire>(
        ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME,
        'id_communication, id_utilisateur'
      )
      expect(
        destinataires.map(d => [d.id_communication, d.statut, d.id_utilisateur])
      ).to.deep.equal([
        ['1', 'PASSEE', 'conseillerCite'],
        ['1', 'PASSEE', 'conseillerFtCej'],
        ['2', 'EN_COURS', 'conseillerCite'],
        ['2', 'EN_COURS', 'conseillerFtCej'],
        ['3', 'PREVUE', 'conseillerCite'],
        ['3', 'PREVUE', 'conseillerFtCej']
      ])
      expect(destinataires[0]).to.deep.include({
        id_population: 'PILOTE',
        destinataire: 'CONSEILLER',
        type: 'IN_APP',
        titre: 'Passée',
        contenu: 'Contenu',
        date_fin: hier,
        type_utilisateur: 'CONSEILLER',
        email: 'cite@milo.fr',
        agence: 'ML Aubenas',
        date_calcul: maintenant.toJSDate()
      })
    })

    it('liste les conseillers concernés par chaque déploiement, avec son statut figé à date_calcul', async () => {
      // Then
      const membres = await lignes<MembreDeploiement>(
        ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME,
        'id_deploiement, id_utilisateur'
      )
      expect(
        membres.map(m => [
          m.id_deploiement,
          m.nature,
          m.id_fonctionnalite,
          m.statut,
          m.id_utilisateur
        ])
      ).to.deep.equal([
        ['10', 'MIGRATION', null, 'PREVU', 'conseillerCite'],
        ['10', 'MIGRATION', null, 'PREVU', 'conseillerFtCej'],
        ['11', 'FONCTIONNALITE', 'DEMARCHES_IA', 'ACTIF', 'conseillerCite'],
        ['11', 'FONCTIONNALITE', 'DEMARCHES_IA', 'ACTIF', 'conseillerFtCej']
      ])
      expect(membres[0]).to.deep.include({
        id_population: 'PILOTE',
        date_activation: dansUneSemaine,
        type_utilisateur: 'CONSEILLER',
        email: 'cite@milo.fr',
        agence: 'ML Aubenas',
        date_calcul: maintenant.toJSDate()
      })
    })

    it('montre pour un conseiller la communication en cours que la fonctionnalité lui affiche', async () => {
      // Given
      const communicationRepository = new CommunicationSqlRepository(
        getDatabase().sequelize
      )

      // When
      const affichee =
        await communicationRepository.getMessageInformatifDuConseiller(
          'conseillerCite',
          maintenant
        )
      const enCours = (
        await lignes<Destinataire>(
          ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME,
          'id_communication'
        )
      ).filter(
        d => d.id_utilisateur === 'conseillerCite' && d.statut === 'EN_COURS'
      )

      // Then
      expect(enCours.map(d => d.id_communication)).to.deep.equal([
        String(affichee?.id)
      ])
    })

    it('montre pour un conseiller la date de migration que la fonctionnalité lui annonce', async () => {
      // Given
      const migrationRepository = new MigrationSqlRepository(
        getDatabase().sequelize
      )

      // When
      const annoncee =
        await migrationRepository.getDateDeMigrationDuConseiller(
          'conseillerCite'
        )
      const migrations = (
        await lignes<MembreDeploiement>(
          ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME,
          'id_deploiement'
        )
      ).filter(
        m => m.id_utilisateur === 'conseillerCite' && m.nature === 'MIGRATION'
      )

      // Then
      expect(migrations.map(m => m.date_activation)).to.deep.equal([
        annoncee?.toJSDate()
      ])
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

async function lignes<T extends object>(
  table: string,
  ordre: string
): Promise<T[]> {
  return getDatabase().sequelize.query<T>(
    `SELECT * FROM ${table} ORDER BY ${ordre}`,
    { type: QueryTypes.SELECT }
  )
}
