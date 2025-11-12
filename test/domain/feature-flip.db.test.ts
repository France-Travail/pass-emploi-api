import { ConfigService } from '@nestjs/config'
import { FeatureFlip } from '../../src/domain/feature-flip'
import { Core } from '../../src/domain/core'
import { FeatureFlipSqlRepository } from '../../src/infrastructure/repositories/feature-flip.repository.db'
import { ConseillerSqlModel } from '../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../src/infrastructure/sequelize/models/jeune.sql-model'
import { FeatureFlipSqlModel } from '../../src/infrastructure/sequelize/models/feature-flip.sql-model'
import { unConseillerDto } from '../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../fixtures/sql-models/jeune.sql-model'
import { expect } from '../utils'
import { DatabaseForTesting, getDatabase } from '../utils/database-for-testing'
import { Authentification } from '../../src/domain/authentification'
import Type = Authentification.Type
import { DateTime } from 'luxon'

describe('FeatureFlip.Service', () => {
  let databaseForTesting: DatabaseForTesting
  let featureFlipRepository: FeatureFlipSqlRepository
  let configService: ConfigService
  let service: FeatureFlip.Service
  let dateDeMigration: DateTime

  const conseillerFtCejMigrant = unConseillerDto({
    id: 'conseiller-ft-cej-migrant',
    structure: Core.Structure.POLE_EMPLOI,
    email: 'conseiller.ft-cej.migrantpe@email.com'
  })
  const conseillerAijMigrant = unConseillerDto({
    id: 'conseiller-aij-migrant',
    structure: Core.Structure.POLE_EMPLOI_AIJ,
    email: 'conseiller.aij.migrant@email.com'
  })
  const conseillerFtCejNonMigrant = unConseillerDto({
    id: 'conseiller-ft-cej-non-migrant',
    structure: Core.Structure.POLE_EMPLOI,
    email: 'conseiller.ft-cej.non-migrant@email.com'
  })
  const conseillerAijNonMigrant = unConseillerDto({
    id: 'conseiller-aij-non-migrant',
    structure: Core.Structure.POLE_EMPLOI_AIJ,
    email: 'conseiller.aij.non-migrant@email.com'
  })
  const jeuneCejConseillerCejMigrant = unJeuneDto({
    id: 'j1',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerFtCejMigrant.id,
    idConseillerInitial: undefined
  })
  const jeuneCejConseillerCejNonMigrant = unJeuneDto({
    id: 'j2',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerFtCejNonMigrant.id,
    idConseillerInitial: undefined
  })
  const jeuneCejTransfertTmpCejNonMigrant = unJeuneDto({
    id: 'j3',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerFtCejNonMigrant.id,
    idConseillerInitial: conseillerFtCejMigrant.id
  })
  const jeuneCejTransfertTmpAijNonMigrant = unJeuneDto({
    id: 'j4',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerAijNonMigrant.id,
    idConseillerInitial: conseillerFtCejMigrant.id
  })
  const jeuneCejTransfertDefinitifCejNonMigrant = unJeuneDto({
    id: 'j5',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerFtCejNonMigrant.id,
    idConseillerInitial: undefined
  })
  const jeuneCejTransfertDefinitifAijNonMigrant = unJeuneDto({
    id: 'j6',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerAijNonMigrant.id,
    idConseillerInitial: undefined
  })
  const jeuneAijConseillerAijNonMigrant = unJeuneDto({
    id: 'j7',
    structure: Core.Structure.POLE_EMPLOI_AIJ,
    idConseiller: conseillerAijNonMigrant.id,
    idConseillerInitial: undefined
  })
  const jeuneAijTransfertTmpCejMigrant = unJeuneDto({
    id: 'j8',
    structure: Core.Structure.POLE_EMPLOI_AIJ,
    idConseiller: conseillerFtCejMigrant.id,
    idConseillerInitial: conseillerAijNonMigrant.id
  })
  const jeuneAijConseillerCejMigrant = unJeuneDto({
    id: 'j9',
    structure: Core.Structure.POLE_EMPLOI_AIJ,
    idConseiller: conseillerFtCejMigrant.id,
    idConseillerInitial: undefined
  })
  const jeuneAijConseillerAijMigrant = unJeuneDto({
    id: 'j10',
    structure: Core.Structure.POLE_EMPLOI_AIJ,
    idConseiller: conseillerAijMigrant.id,
    idConseillerInitial: undefined
  })
  const jeuneCejConseillerCejMigrantTransfertTmpAijMigrant = unJeuneDto({
    id: 'j11',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerAijMigrant.id,
    idConseillerInitial: conseillerFtCejMigrant.id
  })
  const jeuneCejConseillerAijMigrantTransfertTmpCejMigrant = unJeuneDto({
    id: 'j12',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerFtCejMigrant.id,
    idConseillerInitial: conseillerAijMigrant.id
  })

  before(async () => {
    databaseForTesting = getDatabase()
    await databaseForTesting.cleanPG()

    featureFlipRepository = new FeatureFlipSqlRepository(
      databaseForTesting.sequelize
    )

    configService = {
      get: (key: string) => {
        if (key === 'features.dateDeMigration') {
          return '2025-11-20'
        }
        return undefined
      }
    } as ConfigService
    dateDeMigration = DateTime.fromISO('2025-11-20').startOf('day')

    service = new FeatureFlip.Service(featureFlipRepository, configService)

    await ConseillerSqlModel.bulkCreate([
      conseillerFtCejMigrant,
      conseillerAijMigrant,
      conseillerFtCejNonMigrant,
      conseillerAijNonMigrant
    ])

    await FeatureFlipSqlModel.bulkCreate([
      {
        featureTag: FeatureFlip.Tag.MIGRATION,
        emailConseiller: conseillerFtCejMigrant.email
      },
      {
        featureTag: FeatureFlip.Tag.MIGRATION,
        emailConseiller: conseillerAijMigrant.email
      },
      {
        featureTag: FeatureFlip.Tag.DEMARCHES_IA,
        emailConseiller: conseillerFtCejNonMigrant.email
      },
      {
        featureTag: FeatureFlip.Tag.DEMARCHES_IA,
        emailConseiller: conseillerAijNonMigrant.email
      }
    ])

    await JeuneSqlModel.bulkCreate([
      jeuneCejConseillerCejMigrant,
      jeuneCejConseillerCejNonMigrant,
      jeuneCejTransfertTmpCejNonMigrant,
      jeuneCejTransfertTmpAijNonMigrant,
      jeuneCejTransfertDefinitifCejNonMigrant,
      jeuneCejTransfertDefinitifAijNonMigrant,
      jeuneAijConseillerAijNonMigrant,
      jeuneAijTransfertTmpCejMigrant,
      jeuneAijConseillerCejMigrant,
      jeuneAijConseillerAijMigrant,
      jeuneCejConseillerCejMigrantTransfertTmpAijMigrant,
      jeuneCejConseillerAijMigrantTransfertTmpCejMigrant
    ])
  })

  describe('recupererIdsDesBeneficiaireAMigrer', () => {
    it('renvoie les ids des bénéficiaires FT CEJ devant migrer vers Parcours Emploi', async () => {
      // When
      const result = await service.recupererIdsDesBeneficiaireAMigrer()

      // Then
      expect(result).to.have.members([
        jeuneCejConseillerCejMigrant.id,
        jeuneCejTransfertTmpCejNonMigrant.id,
        jeuneCejTransfertTmpAijNonMigrant.id,
        //jeuneCejTransfertDefinitifCejNonMigrant.id, Impossible avec implem actuelle
        //jeuneCejTransfertDefinitifAijNonMigrant.id, Impossible avec implem actuelle
        jeuneCejConseillerCejMigrantTransfertTmpAijMigrant.id
      ])
    })
  })
  describe('recupererDateDeMigrationSiLUtilisateurDoitMigrer', () => {
    it('renvoie la date de migration si le bénéficiaire est FT CEJ et que son conseiller de rattachement est FT CEJ et doit migrer vers Parcours Emploi', async () => {
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneCejConseillerCejMigrant.id,
          type: Type.JEUNE
        })
      ).to.deep.equal(dateDeMigration)
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneCejConseillerCejNonMigrant.id,
          type: Type.JEUNE
        })
      ).to.be.undefined()
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneCejTransfertTmpCejNonMigrant.id,
          type: Type.JEUNE
        })
      ).to.deep.equal(dateDeMigration)
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneCejTransfertTmpAijNonMigrant.id,
          type: Type.JEUNE
        })
      ).to.deep.equal(dateDeMigration)
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneCejTransfertDefinitifCejNonMigrant.id,
          type: Type.JEUNE
        })
      ).to.be.undefined()
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneCejTransfertDefinitifAijNonMigrant.id,
          type: Type.JEUNE
        })
      ).to.be.undefined()
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneAijConseillerAijNonMigrant.id,
          type: Type.JEUNE
        })
      ).to.be.undefined()
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneAijTransfertTmpCejMigrant.id,
          type: Type.JEUNE
        })
      ).to.be.undefined()
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneAijConseillerCejMigrant.id,
          type: Type.JEUNE
        })
      ).to.be.undefined()
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneAijConseillerAijMigrant.id,
          type: Type.JEUNE
        })
      ).to.be.undefined()
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneCejConseillerCejMigrantTransfertTmpAijMigrant.id,
          type: Type.JEUNE
        })
      ).to.deep.equal(dateDeMigration)
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: jeuneCejConseillerAijMigrantTransfertTmpCejMigrant.id,
          type: Type.JEUNE
        })
      ).to.be.undefined()
    })

    it('renvoie la date de migration si le conseiller est FT CEJ et doit migrer vers Parcours Emploi', async () => {
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: conseillerFtCejMigrant.id,
          type: Type.CONSEILLER
        })
      ).to.deep.equal(dateDeMigration)
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: conseillerFtCejNonMigrant.id,
          type: Type.CONSEILLER
        })
      ).to.be.undefined()
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: conseillerAijMigrant.id,
          type: Type.CONSEILLER
        })
      ).to.be.undefined()
      expect(
        await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
          id: conseillerAijNonMigrant.id,
          type: Type.CONSEILLER
        })
      ).to.be.undefined()
    })
  })
})
