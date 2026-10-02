import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { QueryTypes } from 'sequelize'
import {
  ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME,
  ANALYTICS_COMMUNICATIONS_TABLE_NAME,
  ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME,
  ANALYTICS_POPULATION_MEMBRES_TABLE_NAME,
  ChargerLesPopulationsJobHandler
} from '../../../src/application/jobs/analytics/0bis-charger-les-populations.job'
import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { GetCommunicationsConseillerQueryHandler } from '../../../src/application/queries/get-communications-conseiller.query.handler'
import { GetCommunicationsJeuneQueryHandler } from '../../../src/application/queries/get-communications-jeune.query.handler'
import { GetFonctionnalitesJeuneQueryHandler } from '../../../src/application/queries/get-fonctionnalites-jeune.query.handler'
import { Communication } from '../../../src/domain/communication'
import { Core } from '../../../src/domain/core'
import { Deploiement } from '../../../src/domain/deploiement'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { Profil } from '../../../src/domain/profil'
import { SuiviJob } from '../../../src/domain/suivi-job'
import { AgenceSqlModel } from '../../../src/infrastructure/sequelize/models/agence.sql-model'
import { CommunicationEnvoiSqlModel } from '../../../src/infrastructure/sequelize/models/communication-envoi.sql-model'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { DeploiementSqlModel } from '../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationAgenceFTSqlModel } from '../../../src/infrastructure/sequelize/models/population-agence-ft.sql-model'
import { PopulationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationStructureMiloSqlModel } from '../../../src/infrastructure/sequelize/models/population-structure-milo.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { StructureMiloSqlModel } from '../../../src/infrastructure/sequelize/models/structure-milo.sql-model'
import { CommunicationSqlRepository } from '../../../src/infrastructure/repositories/communication.repository.db'
import { ConseillerSqlRepository } from '../../../src/infrastructure/repositories/conseiller-sql.repository.db'
import { FonctionnaliteSqlRepository } from '../../../src/infrastructure/repositories/fonctionnalite.repository.db'
import { MigrationSqlRepository } from '../../../src/infrastructure/repositories/migration.repository.db'
import { DateService } from '../../../src/utils/date-service'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune
} from '../../fixtures/authentification.fixture'
import { uneAgenceDto } from '../../fixtures/sql-models/agence.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { uneStructureMiloDto } from '../../fixtures/sql-models/structureMilo.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('Appartenance à une population', () => {
  const maintenant = DateTime.fromISO('2026-09-30T12:00:00.000Z')
  const hier = maintenant.minus({ days: 1 }).toJSDate()
  const demain = maintenant.plus({ days: 1 }).toJSDate()

  let dateService: StubbedClass<DateService>
  let jeuneRepository: StubbedType<Jeune.Repository>
  let suiviJobService: StubbedType<SuiviJob.Service>

  before(async () => {
    await getDatabase().cleanPG()

    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    const sandbox = createSandbox()
    jeuneRepository = stubInterface(sandbox)
    jeuneRepository.existe.resolves(true)
    suiviJobService = stubInterface(sandbox)

    await StructureMiloSqlModel.create(
      uneStructureMiloDto({
        id: 'SM-PILOTE',
        nomOfficiel: 'Structure MiLo Pilote'
      })
    )
    await StructureMiloSqlModel.create(
      uneStructureMiloDto({ id: 'SM-HORS', nomOfficiel: 'Structure MiLo Hors' })
    )
    await AgenceSqlModel.bulkCreate([
      uneAgenceDto({
        id: 'AG-SANS-RESTRICTION',
        nomAgence: 'Agence sans restriction'
      }),
      uneAgenceDto({
        id: 'AG-AIJ-SEULEMENT',
        nomAgence: 'Agence AIJ seulement'
      }),
      uneAgenceDto({ id: 'AG-HORS', nomAgence: 'Agence hors' })
    ])

    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: 'conseillerCiteParEmail',
        structure: Core.Structure.MILO,
        email: 'cite@milo.fr',
        idStructureMilo: 'SM-HORS'
      }),
      unConseillerDto({
        id: 'conseillerProfilFtCej',
        structure: Core.Structure.POLE_EMPLOI,
        email: 'profil-ft-cej@ft.fr',
        idAgence: 'AG-HORS'
      }),
      unConseillerDto({
        id: 'conseillerProfilCdBrsa',
        structure: Core.Structure.CONSEIL_DEPT,
        dispositif: Profil.Dispositif.BRSA,
        email: 'profil-cd-brsa@cd.fr'
      }),
      unConseillerDto({
        id: 'conseillerStructureMilo',
        structure: Core.Structure.MILO,
        email: 'structure-milo@milo.fr',
        idStructureMilo: 'SM-PILOTE'
      }),
      unConseillerDto({
        id: 'conseillerAgenceSansRestriction',
        structure: Core.Structure.POLE_EMPLOI,
        dispositif: Profil.Dispositif.BRSA,
        email: 'agence-sans-restriction@ft.fr',
        idAgence: 'AG-SANS-RESTRICTION'
      }),
      unConseillerDto({
        id: 'conseillerAgenceAij',
        structure: Core.Structure.POLE_EMPLOI,
        dispositif: Profil.Dispositif.AIJ,
        email: 'agence-aij@ft.fr',
        idAgence: 'AG-AIJ-SEULEMENT'
      }),
      unConseillerDto({
        id: 'conseillerMiloHorsStructure',
        structure: Core.Structure.MILO,
        email: 'milo-hors-structure@milo.fr',
        idStructureMilo: 'SM-HORS'
      }),
      unConseillerDto({
        id: 'conseillerAgenceAijMaisBrsa',
        structure: Core.Structure.POLE_EMPLOI,
        dispositif: Profil.Dispositif.BRSA,
        email: 'agence-aij-mais-brsa@ft.fr',
        idAgence: 'AG-AIJ-SEULEMENT'
      }),
      unConseillerDto({
        id: 'conseillerAgenceHors',
        structure: Core.Structure.POLE_EMPLOI,
        dispositif: Profil.Dispositif.AIJ,
        email: 'agence-hors@ft.fr',
        idAgence: 'AG-HORS'
      }),
      unConseillerDto({
        id: 'conseillerAucunCritere',
        structure: Core.Structure.MILO,
        email: 'aucun-critere@milo.fr',
        idStructureMilo: 'SM-HORS'
      })
    ])

    await JeuneSqlModel.bulkCreate([
      unJeuneDto({
        id: 'jeuneCiteParEmail',
        idConseiller: 'conseillerCiteParEmail',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneProfilFtCej',
        idConseiller: 'conseillerProfilFtCej',
        structure: Core.Structure.MILO
      }),
      unJeuneDto({
        id: 'jeuneProfilCdBrsa',
        idConseiller: 'conseillerProfilCdBrsa',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneStructureMilo',
        idConseiller: 'conseillerStructureMilo',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneAgenceSansRestriction',
        idConseiller: 'conseillerAgenceSansRestriction',
        structure: Core.Structure.MILO
      }),
      unJeuneDto({
        id: 'jeuneAgenceAij',
        idConseiller: 'conseillerAgenceAij',
        structure: Core.Structure.MILO
      }),
      unJeuneDto({
        id: 'jeuneTransfereInitialDedans',
        idConseiller: 'conseillerAucunCritere',
        idConseillerInitial: 'conseillerCiteParEmail',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneTransfereInitialHors',
        idConseiller: 'conseillerProfilFtCej',
        idConseillerInitial: 'conseillerAucunCritere',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneMiloHorsStructure',
        idConseiller: 'conseillerMiloHorsStructure',
        structure: Core.Structure.MILO
      }),
      unJeuneDto({
        id: 'jeuneNonAccompagneFranceTravailCej',
        idConseiller: undefined,
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneNonAccompagneDemandeurDEmploi',
        idConseiller: undefined,
        structure: Core.Structure.FT_DEMANDEUR_D_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneNonAccompagneEspaceCandidat',
        idConseiller: undefined,
        structure: Core.Structure.FT_ESPACE_CANDIDAT
      }),
      unJeuneDto({
        id: 'jeuneNonAccompagneConseilDepartemental',
        idConseiller: undefined,
        structure: Core.Structure.CONSEIL_DEPT
      })
    ])

    await PopulationSqlModel.create({
      id: 'PILOTE',
      description: 'Population pilote'
    })

    await PopulationConseillerSqlModel.create({
      idPopulation: 'PILOTE',
      emailConseiller: 'cite@milo.fr'
    })

    await PopulationProfilSqlModel.bulkCreate([
      {
        idPopulation: 'PILOTE',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.CEJ
      },
      {
        idPopulation: 'PILOTE',
        structure: Profil.Structure.CONSEIL_DEPARTEMENTAL,
        dispositif: null
      },
      {
        idPopulation: 'PILOTE',
        structure: Profil.Structure.MILO,
        dispositif: Profil.Dispositif.CEJ
      },
      {
        idPopulation: 'PILOTE',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.ESPACE_CANDIDAT
      }
    ])

    await PopulationStructureMiloSqlModel.create({
      idPopulation: 'PILOTE',
      idStructureMilo: 'SM-PILOTE'
    })

    await PopulationAgenceFTSqlModel.bulkCreate([
      {
        idPopulation: 'PILOTE',
        idAgence: 'AG-SANS-RESTRICTION',
        dispositifs: null
      },
      {
        idPopulation: 'PILOTE',
        idAgence: 'AG-AIJ-SEULEMENT',
        dispositifs: [Profil.Dispositif.AIJ]
      }
    ])

    await FonctionnaliteSqlModel.create({ id: 'FONC_PILOTE' })

    await DeploiementSqlModel.bulkCreate([
      {
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'FONC_PILOTE',
        dateActivation: hier
      },
      {
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PILOTE',
        dateActivation: hier
      }
    ])

    await CommunicationSqlModel.bulkCreate([
      {
        id: 1,
        idPopulation: 'PILOTE',
        destinataire: Communication.Destinataire.CONSEILLER,
        type: Communication.Type.IN_APP,
        titre: 'Communication conseiller',
        contenu: 'Contenu conseiller',
        dateDebut: hier,
        dateFin: demain
      },
      {
        id: 2,
        idPopulation: 'PILOTE',
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.IN_APP,
        titre: 'Communication jeune',
        contenu: 'Contenu jeune',
        dateDebut: hier,
        dateFin: demain
      },
      {
        id: 3,
        idPopulation: 'PILOTE',
        destinataire: Communication.Destinataire.JEUNE,
        type: Communication.Type.NOTIFICATION,
        push: false,
        statutEnvoi: Communication.StatutEnvoi.A_ENVOYER,
        titre: 'Notification jeune',
        contenu: 'Contenu notification',
        dateDebut: hier,
        dateFin: null
      }
    ])

    process.env.DUMP_RESTORE_DB_TARGET =
      process.env.DATABASE_URL || 'postgresql://test:test@localhost:56432/test'
  })

  after(async () => {
    await getDatabase().sequelize.query(`
      DROP TABLE IF EXISTS ${ANALYTICS_POPULATION_MEMBRES_TABLE_NAME};
      DROP TABLE IF EXISTS ${ANALYTICS_COMMUNICATIONS_TABLE_NAME};
      DROP TABLE IF EXISTS ${ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME};
      DROP TABLE IF EXISTS ${ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME};
    `)
  })

  it('active les fonctionnalités des jeunes dont le conseiller de référence est dans la population', async () => {
    const handler = new GetFonctionnalitesJeuneQueryHandler(
      new FonctionnaliteSqlRepository(getDatabase().sequelize),
      dateService,
      new JeuneAuthorizer(jeuneRepository)
    )

    const idsJeunesDans = [
      'jeuneCiteParEmail',
      'jeuneProfilFtCej',
      'jeuneProfilCdBrsa',
      'jeuneStructureMilo',
      'jeuneAgenceSansRestriction',
      'jeuneAgenceAij',
      'jeuneTransfereInitialDedans',
      'jeuneNonAccompagneFranceTravailCej',
      'jeuneNonAccompagneEspaceCandidat',
      'jeuneNonAccompagneConseilDepartemental'
    ]
    const idsJeunesHors = [
      'jeuneTransfereInitialHors',
      'jeuneMiloHorsStructure',
      'jeuneNonAccompagneDemandeurDEmploi'
    ]

    const resultats = await Promise.all(
      [...idsJeunesDans, ...idsJeunesHors].map(async idJeune => ({
        idJeune,
        result: await handler.execute(
          { idJeune },
          unUtilisateurJeune({ id: idJeune })
        )
      }))
    )

    const jeunesTouches = resultats
      .filter(
        r =>
          r.result._isSuccess &&
          r.result.data.fonctionnalites.includes('FONC_PILOTE')
      )
      .map(r => r.idJeune)

    expect(jeunesTouches).to.have.members(idsJeunesDans)
  })

  it('affiche le bandeau jeune aux jeunes dont le conseiller de référence est dans la population', async () => {
    const handler = new GetCommunicationsJeuneQueryHandler(
      new CommunicationSqlRepository(getDatabase().sequelize),
      dateService,
      new JeuneAuthorizer(jeuneRepository)
    )

    const idsJeunesDans = [
      'jeuneCiteParEmail',
      'jeuneProfilFtCej',
      'jeuneProfilCdBrsa',
      'jeuneStructureMilo',
      'jeuneAgenceSansRestriction',
      'jeuneAgenceAij',
      'jeuneTransfereInitialDedans',
      'jeuneNonAccompagneFranceTravailCej',
      'jeuneNonAccompagneEspaceCandidat',
      'jeuneNonAccompagneConseilDepartemental'
    ]
    const idsJeunesHors = [
      'jeuneTransfereInitialHors',
      'jeuneMiloHorsStructure',
      'jeuneNonAccompagneDemandeurDEmploi'
    ]

    const resultats = await Promise.all(
      [...idsJeunesDans, ...idsJeunesHors].map(async idJeune => ({
        idJeune,
        result: await handler.execute(
          { idJeune },
          unUtilisateurJeune({ id: idJeune })
        )
      }))
    )

    const jeunesTouches = resultats
      .filter(r => r.result._isSuccess && r.result.data.messageInformatif)
      .map(r => r.idJeune)

    expect(jeunesTouches).to.have.members(idsJeunesDans)
  })

  it('affiche le bandeau conseiller aux conseillers dans la population', async () => {
    const handler = new GetCommunicationsConseillerQueryHandler(
      new CommunicationSqlRepository(getDatabase().sequelize),
      dateService,
      new ConseillerAuthorizer(new ConseillerSqlRepository(), jeuneRepository)
    )

    const idsConseillersDans = [
      'conseillerCiteParEmail',
      'conseillerProfilFtCej',
      'conseillerProfilCdBrsa',
      'conseillerStructureMilo',
      'conseillerAgenceSansRestriction',
      'conseillerAgenceAij'
    ]
    const idsConseillersHors = [
      'conseillerMiloHorsStructure',
      'conseillerAgenceAijMaisBrsa',
      'conseillerAgenceHors',
      'conseillerAucunCritere'
    ]

    const resultats = await Promise.all(
      [...idsConseillersDans, ...idsConseillersHors].map(
        async idConseiller => ({
          idConseiller,
          result: await handler.execute(
            { idConseiller },
            unUtilisateurConseiller({ id: idConseiller })
          )
        })
      )
    )

    const conseillersTouches = resultats
      .filter(r => r.result._isSuccess && r.result.data.messageInformatif)
      .map(r => r.idConseiller)

    expect(conseillersTouches).to.have.members(idsConseillersDans)
  })

  it('renvoie la date de migration des conseillers dans la population', async () => {
    const repo = new MigrationSqlRepository(getDatabase().sequelize)

    const idsConseillersDans = [
      'conseillerCiteParEmail',
      'conseillerProfilFtCej',
      'conseillerProfilCdBrsa',
      'conseillerStructureMilo',
      'conseillerAgenceSansRestriction',
      'conseillerAgenceAij'
    ]
    const idsConseillersHors = [
      'conseillerMiloHorsStructure',
      'conseillerAgenceAijMaisBrsa',
      'conseillerAgenceHors',
      'conseillerAucunCritere'
    ]

    const resultats = await Promise.all(
      [...idsConseillersDans, ...idsConseillersHors].map(
        async idConseiller => ({
          idConseiller,
          date: await repo.getDateDeMigrationDuConseiller(idConseiller)
        })
      )
    )

    const conseillersTouches = resultats
      .filter(r => r.date !== undefined)
      .map(r => r.idConseiller)

    expect(conseillersTouches).to.have.members(idsConseillersDans)
  })

  it('renvoie la date de migration des jeunes dont le conseiller de référence est dans la population', async () => {
    const repo = new MigrationSqlRepository(getDatabase().sequelize)

    const idsJeunesDans = [
      'jeuneCiteParEmail',
      'jeuneProfilFtCej',
      'jeuneProfilCdBrsa',
      'jeuneStructureMilo',
      'jeuneAgenceSansRestriction',
      'jeuneAgenceAij',
      'jeuneTransfereInitialDedans',
      'jeuneNonAccompagneFranceTravailCej',
      'jeuneNonAccompagneEspaceCandidat',
      'jeuneNonAccompagneConseilDepartemental'
    ]
    const idsJeunesHors = [
      'jeuneTransfereInitialHors',
      'jeuneMiloHorsStructure',
      'jeuneNonAccompagneDemandeurDEmploi'
    ]

    const resultatsDate = await Promise.all(
      [...idsJeunesDans, ...idsJeunesHors].map(async idJeune => ({
        idJeune,
        date: await repo.getDateDeMigrationDuBeneficiaire(idJeune)
      }))
    )

    const jeunesAvecDate = resultatsDate
      .filter(r => r.date !== undefined)
      .map(r => r.idJeune)

    expect(jeunesAvecDate).to.have.members(idsJeunesDans)

    const beneficiaires =
      await repo.getBeneficiairesAMigrerParProfilOuConseillerCite('PILOTE')
    const idsBeneficiaires = beneficiaires.map(b => b.id)

    expect(idsBeneficiaires).to.have.members(idsJeunesDans)
  })

  it('compte et fige les jeunes destinataires de la notification selon leur conseiller de référence', async () => {
    const repo = new CommunicationSqlRepository(getDatabase().sequelize)

    const idsJeunesDans = [
      'jeuneCiteParEmail',
      'jeuneProfilFtCej',
      'jeuneProfilCdBrsa',
      'jeuneStructureMilo',
      'jeuneAgenceSansRestriction',
      'jeuneAgenceAij',
      'jeuneTransfereInitialDedans',
      'jeuneNonAccompagneFranceTravailCej',
      'jeuneNonAccompagneEspaceCandidat',
      'jeuneNonAccompagneConseilDepartemental'
    ]

    const compte = await repo.compterDestinataires('PILOTE', false)

    expect(compte).to.equal(idsJeunesDans.length)

    await repo.demarrerProchainEnvoi(maintenant)

    const envois = await CommunicationEnvoiSqlModel.findAll({
      where: { idCommunication: 3 }
    })
    const idsJeunesFiges = envois.map(e => e.idJeune)

    expect(idsJeunesFiges).to.have.members(idsJeunesDans)
  })

  it('remplit les tables analytics avec les membres des populations, déploiements et communications', async () => {
    const handler = new ChargerLesPopulationsJobHandler(
      suiviJobService,
      dateService
    )
    const conseillersDans = [
      'conseillerCiteParEmail',
      'conseillerProfilFtCej',
      'conseillerProfilCdBrsa',
      'conseillerStructureMilo',
      'conseillerAgenceSansRestriction',
      'conseillerAgenceAij'
    ]
    const jeunesDans = [
      'jeuneCiteParEmail',
      'jeuneProfilFtCej',
      'jeuneProfilCdBrsa',
      'jeuneStructureMilo',
      'jeuneAgenceSansRestriction',
      'jeuneAgenceAij',
      'jeuneTransfereInitialDedans',
      'jeuneNonAccompagneFranceTravailCej',
      'jeuneNonAccompagneEspaceCandidat',
      'jeuneNonAccompagneConseilDepartemental'
    ]

    // When
    const suiviJob = await handler.handle()

    // Then
    expect(suiviJob.succes).to.equal(true)
    const lire = async (table: string, filtre: string): Promise<string[]> => {
      const lignes = await getDatabase().sequelize.query<{
        id_utilisateur: string
      }>(`SELECT id_utilisateur FROM ${table} WHERE ${filtre}`, {
        type: QueryTypes.SELECT
      })
      return lignes.map(ligne => ligne.id_utilisateur)
    }
    expect(
      await lire(
        ANALYTICS_POPULATION_MEMBRES_TABLE_NAME,
        "id_population = 'PILOTE' AND type_utilisateur = 'CONSEILLER'"
      )
    ).to.have.members(conseillersDans)
    expect(
      await lire(
        ANALYTICS_POPULATION_MEMBRES_TABLE_NAME,
        "id_population = 'PILOTE' AND type_utilisateur = 'JEUNE'"
      )
    ).to.have.members(jeunesDans)
    expect(
      await lire(
        ANALYTICS_DEPLOIEMENT_MEMBRES_TABLE_NAME,
        "id_population = 'PILOTE'"
      )
    ).to.have.members([...conseillersDans, ...conseillersDans])
    expect(
      await lire(
        ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME,
        "id_communication = '1'"
      )
    ).to.have.members(conseillersDans)
    expect(
      await lire(
        ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME,
        "id_communication = '2'"
      )
    ).to.have.members(jeunesDans)
    expect(
      await lire(
        ANALYTICS_COMMUNICATION_DESTINATAIRES_TABLE_NAME,
        "id_communication = '3'"
      )
    ).to.have.members(jeunesDans)
  })
})
