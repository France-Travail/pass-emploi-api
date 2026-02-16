import { expect } from 'chai'
import { SituationsMiloSqlModel } from 'src/infrastructure/sequelize/models/situations-milo.sql-model'
import { DateService } from 'src/utils/date-service'
import { IdService } from 'src/utils/id-service'
import { uneSituationsMilo } from 'test/fixtures/milo.fixture'
import { NonTrouveError } from '../../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../../src/building-blocks/types/result'
import { Core } from '../../../../src/domain/core'
import { JeuneMilo } from '../../../../src/domain/milo/jeune.milo'
import { FirebaseClient } from '../../../../src/infrastructure/clients/firebase-client'
import { ConseillerSqlRepository } from '../../../../src/infrastructure/repositories/conseiller-sql.repository.db'
import { MiloJeuneHttpSqlRepository } from '../../../../src/infrastructure/repositories/milo/jeune-milo-http-sql.repository.db'
import { JeuneSqlRepository } from '../../../../src/infrastructure/repositories/jeune/jeune-sql.repository.db'
import { JeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { StructureMiloSqlModel } from '../../../../src/infrastructure/sequelize/models/structure-milo.sql-model'
import { unConseiller } from '../../../fixtures/conseiller.fixture'
import { uneDatetime } from '../../../fixtures/date.fixture'
import {
  uneConfiguration,
  unJeune,
  unJeuneSansConseiller
} from '../../../fixtures/jeune.fixture'
import { unJeuneDto } from '../../../fixtures/sql-models/jeune.sql-model'
import { StubbedClass, stubClass } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'
import { MiloClient } from '../../../../src/infrastructure/clients/milo/milo-client'

describe('JeuneMiloHttpRepository', () => {
  let databaseForTesting: DatabaseForTesting
  let miloHttpSqlRepository: MiloJeuneHttpSqlRepository
  let miloClient: StubbedClass<MiloClient>
  const jeune = unJeune({ email: 'john@doe.io' })
  let idService: IdService
  let dateService: DateService
  const conseiller = unConseiller()

  before(() => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    const conseillerSqlRepository = new ConseillerSqlRepository()
    await conseillerSqlRepository.save(conseiller)
    const firebaseClient = stubClass(FirebaseClient)
    const jeuneSqlRepository = new JeuneSqlRepository(
      databaseForTesting.sequelize,
      firebaseClient,
      idService,
      dateService
    )
    await jeuneSqlRepository.save(jeune)

    miloClient = stubClass(MiloClient)
    miloHttpSqlRepository = new MiloJeuneHttpSqlRepository(miloClient)
  })

  describe('get', () => {
    describe('quand le jeune existe', () => {
      it('retourne le jeune', async () => {
        // Given
        const jeuneMilo: JeuneMilo = {
          ...unJeune({
            id: 'milo',
            configuration: uneConfiguration({ idJeune: 'milo' })
          }),
          peutVoirLeComptageDesHeures: undefined,
          dateSignatureCGU: undefined
        }
        jeuneMilo.idStructureMilo = 'test'

        await StructureMiloSqlModel.create({
          id: jeuneMilo.idStructureMilo,
          nomOfficiel: 'test',
          timezone: 'Europe/Paris'
        })
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: jeuneMilo.id,
            idConseiller: conseiller.id,
            dateCreation: jeuneMilo.creationDate.toJSDate(),
            datePremiereConnexion: jeuneMilo.datePremiereConnexion!.toJSDate(),
            idStructureMilo: jeuneMilo.idStructureMilo
          })
        )

        // When
        const result = await miloHttpSqlRepository.get(jeuneMilo.id)

        // Then
        jeuneMilo.conseiller!.idAgence = undefined
        expect(result).to.deep.equal(success(jeuneMilo))
      })
    })

    describe("quand le jeune n'existe pas", () => {
      it('retourne une failure', async () => {
        // When
        const result = await miloHttpSqlRepository.get('ZIZOU')

        // Then
        expect(result).to.deep.equal(
          failure(new NonTrouveError('Jeune', 'ZIZOU'))
        )
      })
    })
  })

  describe('getDossier', () => {
    it('délègue à MiloClient.getDossier', async () => {
      // Given
      const dossierAttendu: JeuneMilo.Dossier = {
        email: 'test@example.com',
        id: '1',
        nom: 'PEREZ',
        prenom: 'Olivier',
        codePostal: '65410',
        dateDeNaissance: '1997-05-08',
        dateFinCEJ: undefined,
        situations: [],
        codeStructure: '65440S00'
      }
      miloClient.getDossier.resolves(success(dossierAttendu))

      // When
      const result = await miloHttpSqlRepository.getDossier('1')

      // Then
      expect(miloClient.getDossier).to.have.been.calledOnceWithExactly('1')
      expect(result).to.deep.equal(success(dossierAttendu))
    })
  })

  describe('getByIdDossier', () => {
    describe('quand un jeune existe avec cet id dossier', () => {
      it('retourne le jeune avec sa structure Milo', async () => {
        // Given
        const idDossier = 'test-id-dossier'
        const idStructure = 'test2'
        const idJeuneAvecDossier = 'test2'

        const jeuneAttendu: JeuneMilo = {
          ...unJeuneSansConseiller(),
          id: idJeuneAvecDossier,
          idPartenaire: idDossier,
          configuration: uneConfiguration({
            idJeune: idJeuneAvecDossier,
            dateDerniereActualisationToken: uneDatetime().toJSDate()
          }),
          idStructureMilo: idStructure,
          peutVoirLeComptageDesHeures: undefined,
          dateSignatureCGU: undefined
        }
        await StructureMiloSqlModel.create({
          id: idStructure,
          nomOfficiel: 'test',
          timezone: 'Europe/Paris'
        })
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneAvecDossier,
            idConseiller: undefined,
            dateCreation: jeuneAttendu.creationDate.toJSDate(),
            pushNotificationToken: 'token',
            dateDerniereActualisationToken: uneDatetime().toJSDate(),
            idPartenaire: idDossier,
            datePremiereConnexion: uneDatetime().plus({ day: 1 }).toJSDate(),
            installationId: '123456',
            instanceId: 'abcdef',
            appVersion: '1.8.1',
            timezone: 'Europe/Paris',
            idStructureMilo: idStructure
          })
        )

        // When
        const result = await miloHttpSqlRepository.getByIdDossier(idDossier)

        // Then
        expect(result).to.deep.equal(success(jeuneAttendu))
      })
    })

    describe("quand aucun jeune n'existe avec cet id dossier", () => {
      it('retourne undefined', async () => {
        // When
        const jeune = await miloHttpSqlRepository.getByIdDossier(
          'test-id-dossier-inconnu'
        )

        // Then
        expect(jeune).to.deep.equal(
          failure(new NonTrouveError('Dossier Milo', 'test-id-dossier-inconnu'))
        )
      })
    })
  })

  describe('creerJeune', () => {
    it('délègue à MiloClient.creerJeune', async () => {
      // Given
      const resultatAttendu = success({
        idAuthentification: 'sub-id',
        existeDejaChezMilo: false
      })
      miloClient.creerJeune.resolves(resultatAttendu)

      // When
      const result = await miloHttpSqlRepository.creerJeune('1', 'idpToken')

      // Then
      expect(miloClient.creerJeune).to.have.been.calledOnceWithExactly(
        '1',
        'idpToken',
        undefined
      )
      expect(result).to.deep.equal(resultatAttendu)
    })

    it('passe le flag surcharge à MiloClient', async () => {
      // Given
      const resultatAttendu = success({
        idAuthentification: 'sub-id',
        existeDejaChezMilo: false
      })
      miloClient.creerJeune.resolves(resultatAttendu)

      // When
      await miloHttpSqlRepository.creerJeune('1', 'idpToken', true)

      // Then
      expect(miloClient.creerJeune).to.have.been.calledOnceWithExactly(
        '1',
        'idpToken',
        true
      )
    })
  })

  describe('getJeunesMiloAvecIdDossier', () => {
    const idJeuneTest = 'jeune-a-retrouver'

    beforeEach(async () => {
      // Given
      await StructureMiloSqlModel.create({
        id: 'test',
        nomOfficiel: 'test',
        timezone: 'Europe/Paris'
      })
      await JeuneSqlModel.bulkCreate([
        unJeuneDto({
          id: 'jeune-pas-milo',
          idConseiller: undefined,
          structure: Core.Structure.POLE_EMPLOI,
          idPartenaire: undefined
        }),
        unJeuneDto({
          id: 'jeune-sans-id-dossier',
          idConseiller: undefined,
          structure: Core.Structure.MILO,
          idPartenaire: undefined
        }),
        unJeuneDto({
          id: idJeuneTest,
          idConseiller: undefined,
          structure: Core.Structure.MILO,
          idPartenaire: 'test-id-dossier',
          idStructureMilo: 'test'
        })
      ])
    })

    describe('quand un jeune Milo existe avec id dossier', () => {
      it('retourne les jeunes', async () => {
        // When
        const result = await miloHttpSqlRepository.getJeunesMiloAvecIdDossier(
          0,
          10
        )

        // Then
        expect(result.length).to.equal(2)
        expect(result[1].id).to.equal(idJeuneTest)
        expect(result[1].idStructureMilo).to.equal('test')
      })
    })
    describe('quand la pagination atteint la limite', () => {
      it('retourne liste vide', async () => {
        // When
        const result = await miloHttpSqlRepository.getJeunesMiloAvecIdDossier(
          2,
          1
        )

        // Then
        expect(result).to.deep.equal([])
      })
    })
  })

  describe('saveSituationsJeune', () => {
    describe("quand le jeune n'a pas de situations", () => {
      it('sauvegarde les nouvelles situations', async () => {
        // Given
        const situationsMilo = uneSituationsMilo({ idJeune: jeune.id })

        // When
        await miloHttpSqlRepository.saveSituationsJeune(situationsMilo)

        // Then
        const result = await SituationsMiloSqlModel.findAll({
          where: { idJeune: jeune.id }
        })
        expect(result.length).to.equal(1)
        expect(result[0].idJeune).to.equal(jeune.id)
        expect(result[0].situationCourante).to.deep.equal(
          situationsMilo.situationCourante
        )
        expect(result[0].situations).to.deep.equal(situationsMilo.situations)
      })
    })
    describe('quand le jeune a deja des situations', () => {
      it('met à jour les situations', async () => {
        // Given
        const situationsMilo = uneSituationsMilo({ idJeune: jeune.id })

        // When
        await miloHttpSqlRepository.saveSituationsJeune(situationsMilo)
        situationsMilo.situations = []
        await miloHttpSqlRepository.saveSituationsJeune(situationsMilo)

        // Then
        const result = await SituationsMiloSqlModel.findAll({
          where: { idJeune: jeune.id }
        })
        expect(result.length).to.equal(1)
        expect(result[0].idJeune).to.equal(jeune.id)
        expect(result[0].situations).to.deep.equal(situationsMilo.situations)
      })
    })
  })

  describe('save', () => {
    it('sauvegarde la structure du jeune quand trouvée', async () => {
      // Given
      const codeStructure = 'structure-du-jeune'
      await StructureMiloSqlModel.create({
        id: codeStructure,
        nomOfficiel: 'test',
        timezone: 'Europe/Paris'
      })

      // When
      await miloHttpSqlRepository.save(jeune, codeStructure)

      // Then
      const jeuneTrouve = await JeuneSqlModel.findByPk(jeune.id)

      expect(jeuneTrouve?.idStructureMilo).to.equal(codeStructure)
    })
    it('met à null la dateFinCEJ et structure du jeune', async () => {
      // Given
      const codeStructure = 'structure-du-jeune'
      await StructureMiloSqlModel.create({
        id: codeStructure,
        nomOfficiel: 'test',
        timezone: 'Europe/Paris'
      })
      await JeuneSqlModel.update(
        {
          dateFinCEJ: uneDatetime().toJSDate(),
          idStructureMilo: codeStructure
        },
        { where: { id: jeune.id } }
      )

      // When
      await miloHttpSqlRepository.save(
        { ...jeune, dateFinCEJ: uneDatetime(), idStructureMilo: codeStructure },
        null,
        null
      )

      // Then
      const jeuneTrouve = await JeuneSqlModel.findByPk(jeune.id)

      expect(jeuneTrouve?.dateFinCEJ).to.equal(null)
      expect(jeuneTrouve?.idStructureMilo).to.equal(null)
    })
    it('ne modifie aucune donnée du Jeune Milo', async () => {
      // Given
      const codeStructure = 'structure-du-jeune'
      await StructureMiloSqlModel.create({
        id: codeStructure,
        nomOfficiel: 'test',
        timezone: 'Europe/Paris'
      })
      await JeuneSqlModel.update(
        {
          dateFinCEJ: uneDatetime().toJSDate(),
          idStructureMilo: codeStructure
        },
        { where: { id: jeune.id } }
      )

      // When
      await miloHttpSqlRepository.save(
        { ...jeune, dateFinCEJ: uneDatetime(), idStructureMilo: codeStructure },
        undefined,
        undefined
      )

      // Then
      const jeuneTrouve = await JeuneSqlModel.findByPk(jeune.id)

      expect(jeuneTrouve?.dateFinCEJ).to.deep.equal(uneDatetime().toJSDate())
      expect(jeuneTrouve?.idStructureMilo).to.equal(codeStructure)
    })
    it('ne sauvegarde pas la structure du jeune quand non trouvée', async () => {
      // Given
      const codeStructure = 'structure-du-jeune'
      await StructureMiloSqlModel.create({
        id: 'structure-pas-du-jeune',
        nomOfficiel: 'test',
        timezone: 'Europe/Paris'
      })

      // When
      await miloHttpSqlRepository.save(jeune, codeStructure)

      // Then
      const jeuneTrouve = await JeuneSqlModel.findByPk(jeune.id)

      expect(jeuneTrouve?.idStructureMilo).to.be.null()
    })
  })

  describe('getSituationsByJeune', () => {
    it('recupere les situations', async () => {
      // Given
      const situationsMilo = uneSituationsMilo({ idJeune: jeune.id })
      await SituationsMiloSqlModel.create({ ...situationsMilo })

      // When
      const result = await miloHttpSqlRepository.getSituationsByJeune(jeune.id)

      // Then
      expect(result).to.deep.equal(situationsMilo)
    })
  })
})
