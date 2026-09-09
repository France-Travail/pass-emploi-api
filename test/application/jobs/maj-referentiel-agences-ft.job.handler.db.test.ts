import { ConfigService } from '@nestjs/config'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import {
  MajReferentielAgencesFTJobHandler,
  StatsMajAgencesFT
} from 'src/application/jobs/maj-referentiel-agences-ft.job.handler.db'
import { success } from 'src/building-blocks/types/result'
import { Profil } from 'src/domain/profil'
import { SuiviJob } from 'src/domain/suivi-job'
import { PoleEmploiClient } from 'src/infrastructure/clients/pole-emploi-client'
import { AgenceSqlModel } from 'src/infrastructure/sequelize/models/agence.sql-model'
import { CommuneSqlModel } from 'src/infrastructure/sequelize/models/commune.sql-model'
import { ConseillerSqlModel } from 'src/infrastructure/sequelize/models/conseiller.sql-model'
import { RegionSqlModel } from 'src/infrastructure/sequelize/models/region.sql-model'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { uneAgenceDto } from 'test/fixtures/sql-models/agence.sql-model'
import { uneCommuneDto } from 'test/fixtures/sql-models/commune.sql-model'
import { unConseillerDto } from 'test/fixtures/sql-models/conseiller.sql-model'
import { uneRegionDto } from 'test/fixtures/sql-models/region.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('MajReferentielAgencesFTJobHandler', () => {
  let handler: MajReferentielAgencesFTJobHandler
  let poleEmploiClient: StubbedClass<PoleEmploiClient>
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let configService: StubbedClass<ConfigService>

  const agenceFTPornic = {
    code: 'PDL0093',
    codeSafir: '44163',
    libelle: 'PORNIC',
    libelleEtendu: 'Agence France Travail PORNIC',
    type: 'APE',
    codeRegionINSEE: '52',
    adressePrincipale: { communeImplantation: '44131' }
  }

  const agenceFTNouvelle = {
    code: 'PDL0092',
    codeSafir: '44155',
    libelle: 'NANTES MALAKOFF',
    libelleEtendu: 'Agence France Travail NANTES MALAKOFF',
    type: 'APE',
    codeRegionINSEE: '52',
    adressePrincipale: { communeImplantation: '44109' }
  }

  beforeEach(async () => {
    await getDatabase().cleanPG()
    const sandbox = createSandbox()
    poleEmploiClient = stubClass(PoleEmploiClient)
    dateService = stubClass(DateService)
    suiviJobService = stubInterface(sandbox)
    configService =
      stubClass<ConfigService<Record<string | symbol, unknown>>>(ConfigService)
    dateService.now.returns(uneDatetime())
    configService.get.returns({
      majAgencesFT: {
        dryRun: false,
        pourcentageSuppressionsMax: '2',
        nombreSuppressionsMin: '5'
      }
    })

    await RegionSqlModel.create(
      uneRegionDto({ code: '52', libelle: 'Pays de la Loire' })
    )
    await CommuneSqlModel.create(
      uneCommuneDto({ id: '44131-44210', code: '44131', codeDepartement: '44' })
    )
    await CommuneSqlModel.create(
      uneCommuneDto({ id: '44109-44000', code: '44109', codeDepartement: '44' })
    )
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '458',
        nomAgence: 'Agence France Travail PORNIC',
        codeDepartement: '44',
        codeSafir: '44163'
      })
    )

    handler = new MajReferentielAgencesFTJobHandler(
      poleEmploiClient,
      getDatabase().sequelize,
      suiviJobService,
      dateService,
      configService
    )
  })

  it('cree une agence inconnue avec son code safir comme identifiant', async () => {
    // Given
    poleEmploiClient.getAgencesFT.resolves(
      success([agenceFTPornic, agenceFTNouvelle])
    )

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbCreees).to.equal(1)

    const creee = await AgenceSqlModel.findByPk('44155')
    expect(creee!.nomAgence).to.equal('Agence France Travail NANTES MALAKOFF')
    expect(creee!.codeDepartement).to.equal('44')
    expect(creee!.nomRegion).to.equal('Pays de la Loire')
    expect(creee!.structure).to.equal(Profil.Structure.FRANCE_TRAVAIL)
  })

  it('renomme sans supprimer quand seul le libelle change', async () => {
    // Given
    poleEmploiClient.getAgencesFT.resolves(
      success([
        { ...agenceFTPornic, libelleEtendu: 'Agence France Travail PORNIC SUD' }
      ])
    )

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbSupprimees).to.equal(0)
    expect(stats.nbMisesAJour).to.equal(1)
    const agence = await AgenceSqlModel.findByPk('458')
    expect(agence!.nomAgence).to.equal('Agence France Travail PORNIC SUD')
  })

  it('supprime une agence disparue et detache ses conseillers', async () => {
    // Given
    await ConseillerSqlModel.create(
      unConseillerDto({ id: 'CONSEILLER-1', idAgence: '458' })
    )
    poleEmploiClient.getAgencesFT.resolves(success([agenceFTNouvelle]))

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbSupprimees).to.equal(1)
    expect(stats.nbConseillersDetaches).to.equal(1)

    const conseiller = await ConseillerSqlModel.findByPk('CONSEILLER-1')
    expect(conseiller!.idAgence).to.equal(null)
    expect(await AgenceSqlModel.findByPk('458')).to.equal(null)
  })

  it('abandonne sans rien ecrire quand le plafond de suppressions est depasse', async () => {
    // Given
    for (const codeSafir of ['1', '2', '3', '4', '5', '6']) {
      await AgenceSqlModel.create(
        uneAgenceDto({
          id: `agence-${codeSafir}`,
          nomAgence: `Agence France Travail ${codeSafir}`,
          codeDepartement: '44',
          codeSafir
        })
      )
    }
    poleEmploiClient.getAgencesFT.resolves(success([agenceFTPornic]))

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(false)
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbSupprimees).to.equal(0)
    expect(await AgenceSqlModel.findByPk('agence-1')).not.to.equal(null)
  })

  it("rattache les conseillers d'une agence fusionnee a son successeur", async () => {
    // Given
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '527',
        nomAgence: 'Agence France Travail CHAMBERY MUDRY',
        codeDepartement: '73',
        codeSafir: 'ANCIEN-73'
      })
    )
    await ConseillerSqlModel.create(
      unConseillerDto({ id: 'CONSEILLER-73', idAgence: '527' })
    )
    await CommuneSqlModel.create(
      uneCommuneDto({ id: '73065-73000', code: '73065', codeDepartement: '73' })
    )
    poleEmploiClient.getAgencesFT.resolves(
      success([
        agenceFTPornic,
        {
          code: 'ARA0204',
          codeSafir: '73014',
          libelle: 'CHAMBERY',
          libelleEtendu: 'Agence France Travail CHAMBERY',
          type: 'APE',
          codeRegionINSEE: '52',
          adressePrincipale: { communeImplantation: '73065' }
        }
      ])
    )

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbConseillersReaffectes).to.equal(1)
    expect(stats.nbConseillersDetaches).to.equal(0)

    const conseiller = await ConseillerSqlModel.findByPk('CONSEILLER-73')
    expect(conseiller!.idAgence).to.equal('73014')
    expect(await AgenceSqlModel.findByPk('527')).to.equal(null)
  })

  it('detache les conseillers quand la fermeture est sans successeur', async () => {
    // Given
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '556',
        nomAgence: 'Agence France Travail MIRIBEL',
        codeDepartement: '01',
        codeSafir: 'ANCIEN-01'
      })
    )
    await ConseillerSqlModel.create(
      unConseillerDto({ id: 'CONSEILLER-01', idAgence: '556' })
    )
    poleEmploiClient.getAgencesFT.resolves(success([agenceFTPornic]))

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbConseillersReaffectes).to.equal(0)
    expect(stats.nbConseillersDetaches).to.equal(1)

    const conseiller = await ConseillerSqlModel.findByPk('CONSEILLER-01')
    expect(conseiller!.idAgence).to.equal(null)
  })

  it('supprime et detache une agence sans code safir comme une agence disparue', async () => {
    // Given
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '999',
        nomAgence: 'Agence Pôle emploi NON RECONCILIEE',
        codeDepartement: '44',
        codeSafir: null
      })
    )
    await ConseillerSqlModel.create(
      unConseillerDto({ id: 'CONSEILLER-2', idAgence: '999' })
    )
    poleEmploiClient.getAgencesFT.resolves(success([agenceFTPornic]))

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(true)
    expect(poleEmploiClient.getAgencesFT).to.have.been.called()

    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbSupprimees).to.equal(1)
    expect(stats.nbConseillersDetaches).to.equal(1)

    const conseiller = await ConseillerSqlModel.findByPk('CONSEILLER-2')
    expect(conseiller!.idAgence).to.equal(null)
    expect(await AgenceSqlModel.findByPk('999')).to.equal(null)
  })

  it('calcule les stats en dry-run sans rien ecrire', async () => {
    // Given
    configService.get.returns({
      majAgencesFT: {
        dryRun: true,
        pourcentageSuppressionsMax: '2',
        nombreSuppressionsMin: '5'
      }
    })
    await AgenceSqlModel.update(
      { nomAgence: 'Agence Pôle emploi PORNIC (avant maj)' },
      { where: { id: '458' } }
    )
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '999',
        nomAgence: 'Agence Pôle emploi NON RECONCILIEE',
        codeDepartement: '44',
        codeSafir: null
      })
    )
    await ConseillerSqlModel.create(
      unConseillerDto({ id: 'CONSEILLER-3', idAgence: '999' })
    )
    poleEmploiClient.getAgencesFT.resolves(
      success([agenceFTPornic, agenceFTNouvelle])
    )

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(true)
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbMisesAJour).to.equal(1)
    expect(stats.nbCreees).to.equal(1)
    expect(stats.nbSupprimees).to.equal(1)
    expect(stats.nbConseillersDetaches).to.equal(1)
    expect(stats.nbConseillersReaffectes).to.equal(0)

    const agencePornic = await AgenceSqlModel.findByPk('458')
    expect(agencePornic!.nomAgence).to.equal(
      'Agence Pôle emploi PORNIC (avant maj)'
    )
    expect(await AgenceSqlModel.findByPk('999')).not.to.equal(null)
    expect(await AgenceSqlModel.findByPk('44155')).to.equal(null)

    const conseiller = await ConseillerSqlModel.findByPk('CONSEILLER-3')
    expect(conseiller!.idAgence).to.equal('999')
  })
})
