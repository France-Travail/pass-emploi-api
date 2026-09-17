import { ConfigService } from '@nestjs/config'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import {
  ReconcilierAgencesFTJobHandler,
  StatsReconciliationAgencesFT
} from 'src/application/jobs/reconcilier-agences-ft.job.handler.db'
import { success } from 'src/building-blocks/types/result'
import { SuiviJob } from 'src/domain/suivi-job'
import { PoleEmploiClient } from 'src/infrastructure/clients/pole-emploi-client'
import { AgenceSqlModel } from 'src/infrastructure/sequelize/models/agence.sql-model'
import { CommuneSqlModel } from 'src/infrastructure/sequelize/models/commune.sql-model'
import { RegionSqlModel } from 'src/infrastructure/sequelize/models/region.sql-model'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import {
  uneAgenceDto,
  uneAgenceMiloDto
} from 'test/fixtures/sql-models/agence.sql-model'
import { uneCommuneDto } from 'test/fixtures/sql-models/commune.sql-model'
import { uneRegionDto } from 'test/fixtures/sql-models/region.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('ReconcilierAgencesFTJobHandler', () => {
  let handler: ReconcilierAgencesFTJobHandler
  let poleEmploiClient: StubbedClass<PoleEmploiClient>
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let configService: StubbedClass<ConfigService>

  const maintenant = uneDatetime()

  const agenceFT = {
    code: 'PDL0093',
    codeSafir: '44163',
    libelle: 'PORNIC',
    libelleEtendu: 'Agence France Travail PORNIC',
    type: 'APE',
    codeRegionINSEE: '52',
    adressePrincipale: { communeImplantation: '44131' }
  }

  beforeEach(async () => {
    await getDatabase().cleanPG()
    const sandbox = createSandbox()
    poleEmploiClient = stubClass(PoleEmploiClient)
    dateService = stubClass(DateService)
    suiviJobService = stubInterface(sandbox)
    configService =
      stubClass<ConfigService<Record<string | symbol, unknown>>>(ConfigService)
    dateService.now.returns(maintenant)
    configService.get.returns({
      reconciliationAgencesFT: { dryRun: false }
    })

    await RegionSqlModel.create(
      uneRegionDto({ code: '52', libelle: 'Pays de la Loire' })
    )
    await CommuneSqlModel.create(
      uneCommuneDto({ id: '44131-44210', code: '44131', codeDepartement: '44' })
    )
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '458',
        nomAgence: 'Agence Pôle emploi PORNIC',
        codeDepartement: '44',
        nomRegion: 'Pays de la Loire',
        codeSafir: null
      })
    )

    handler = new ReconcilierAgencesFTJobHandler(
      poleEmploiClient,
      getDatabase().sequelize,
      suiviJobService,
      dateService,
      configService
    )
  })

  it('ecrit le code safir et aligne le nom sans rien creer ni supprimer', async () => {
    // Given
    poleEmploiClient.getAgencesFT.resolves(success([agenceFT]))

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsReconciliationAgencesFT
    expect(stats.nbAppariees).to.equal(1)

    const agence = await AgenceSqlModel.findByPk('458')
    expect(agence!.codeSafir).to.equal('44163')
    expect(agence!.nomAgence).to.equal('Agence France Travail PORNIC')
    expect(agence!.codeRegion).to.equal('52')
  })

  it("n'ecrit rien en dry-run", async () => {
    // Given
    configService.get.returns({
      reconciliationAgencesFT: { dryRun: true }
    })
    poleEmploiClient.getAgencesFT.resolves(success([agenceFT]))

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsReconciliationAgencesFT
    expect(stats.nbAppariees).to.equal(1)
    const agence = await AgenceSqlModel.findByPk('458')
    expect(agence!.codeSafir).to.equal(null)
    expect(agence!.nomAgence).to.equal('Agence Pôle emploi PORNIC')
  })

  it('ne touche pas aux agences MILO', async () => {
    // Given
    await AgenceSqlModel.create(
      uneAgenceMiloDto({ id: 'MILO-1', nomAgence: 'Agence Pôle emploi PORNIC' })
    )
    poleEmploiClient.getAgencesFT.resolves(success([agenceFT]))

    // When
    await handler.handle()

    // Then
    const milo = await AgenceSqlModel.findByPk('MILO-1')
    expect(milo!.codeSafir).to.equal(null)
    expect(milo!.nomAgence).to.equal('Agence Pôle emploi PORNIC')
  })

  it("apparie via la table de correspondance quand le nom d'origine ne correspond plus", async () => {
    // Given
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '543',
        nomAgence: 'Agence Pôle emploi SAINT ETIENNE TERRASSE',
        codeDepartement: '42',
        codeSafir: null
      })
    )
    const agenceFTTechnopole = {
      code: 'ARA9999',
      codeSafir: '42135',
      libelle: 'ST ETIENNE TECHNOPOLE',
      libelleEtendu: 'Agence France Travail ST ETIENNE TECHNOPOLE',
      type: 'APE',
      codeRegionINSEE: '52',
      adressePrincipale: { communeImplantation: '44131' }
    }
    poleEmploiClient.getAgencesFT.resolves(
      success([agenceFT, agenceFTTechnopole])
    )

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsReconciliationAgencesFT
    expect(stats.nbAppariees).to.equal(2)
    expect(stats.nbOrphelinesFT).to.equal(0)
    expect(stats.nbOrphelinesBase).to.equal(0)

    const agence = await AgenceSqlModel.findByPk('543')
    expect(agence!.codeSafir).to.equal('42135')
    expect(agence!.nomAgence).to.equal(
      'Agence France Travail ST ETIENNE TECHNOPOLE'
    )
  })

  it('n’apparie qu’une seule des deux agences fusionnees via la table de correspondance', async () => {
    // Given
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '527',
        nomAgence: 'Agence Pôle emploi CHAMBERY MUDRY',
        codeDepartement: '73',
        codeSafir: null
      })
    )
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '529',
        nomAgence: 'Agence Pôle emploi CHAMBERY GD VERGER',
        codeDepartement: '73',
        codeSafir: null
      })
    )
    const agenceFTChambery = {
      code: 'ARA0204',
      codeSafir: '73014',
      libelle: 'CHAMBERY',
      libelleEtendu: 'Agence France Travail CHAMBERY',
      type: 'APE',
      codeRegionINSEE: '52',
      adressePrincipale: { communeImplantation: '44131' }
    }
    poleEmploiClient.getAgencesFT.resolves(success([agenceFTChambery]))

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsReconciliationAgencesFT
    expect(stats.nbAppariees).to.equal(1)
    expect(stats.nbOrphelinesFT).to.equal(0)
    expect(stats.nbOrphelinesBase).to.equal(2)

    const codeSafirs = await Promise.all(
      ['527', '529'].map(
        async id => (await AgenceSqlModel.findByPk(id))!.codeSafir
      )
    )
    expect(codeSafirs.filter(safir => safir === '73014').length).to.equal(1)
    expect(codeSafirs.filter(safir => safir === null).length).to.equal(1)
  })

  it('echoue sans rien ecrire quand le referentiel est vide', async () => {
    // Given
    poleEmploiClient.getAgencesFT.resolves(success([]))

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(false)
    const agence = await AgenceSqlModel.findByPk('458')
    expect(agence!.codeSafir).to.equal(null)
  })
})
