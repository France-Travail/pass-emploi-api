import { ConfigService } from '@nestjs/config'
import { FeatureFlip, PhaseDeMigration } from '../../src/domain/feature-flip'
import { Core } from '../../src/domain/core'
import { FeatureFlipSqlRepository } from '../../src/infrastructure/repositories/feature-flip.repository.db'
import { ConseillerSqlModel } from '../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../src/infrastructure/sequelize/models/jeune.sql-model'
import { FeatureFlipSqlModel } from '../../src/infrastructure/sequelize/models/feature-flip.sql-model'
import { unConseillerDto } from '../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../fixtures/sql-models/jeune.sql-model'
import { expect, stubClass } from '../utils'
import { DatabaseForTesting, getDatabase } from '../utils/database-for-testing'
import { Authentification } from '../../src/domain/authentification'
import Type = Authentification.Type
import { DateTime } from 'luxon'
import { DateService } from '../../src/utils/date-service'
import { uneDate } from '../fixtures/date.fixture'

describe('FeatureFlip.Service', () => {
  let databaseForTesting: DatabaseForTesting
  let featureFlipRepository: FeatureFlipSqlRepository
  let configService: ConfigService
  let service: FeatureFlip.Service
  let dateDeMigration: DateTime
  const dateService = stubClass(DateService)
  const maintenant = DateService.fromJSDateToDateTime(uneDate())!
  dateService.nowJs.returns(maintenant.toJSDate())
  dateService.now.returns(maintenant)

  // Conseillers
  const conseillerMigrant = unConseillerDto({
    id: 'conseiller-migrant',
    structure: Core.Structure.POLE_EMPLOI,
    email: 'conseiller.migrant@email.com'
  })
  const conseillerMigrant2 = unConseillerDto({
    id: 'conseiller-migrant-2',
    structure: Core.Structure.POLE_EMPLOI_AIJ,
    email: 'conseiller.migrant2@email.com'
  })
  const conseillerNonMigrant = unConseillerDto({
    id: 'conseiller-non-migrant',
    structure: Core.Structure.POLE_EMPLOI,
    email: 'conseiller.non-migrant@email.com'
  })
  const conseillerNonMigrant2 = unConseillerDto({
    id: 'conseiller-non-migrant-2',
    structure: Core.Structure.POLE_EMPLOI_AIJ,
    email: 'conseiller.non-migrant2@email.com'
  })

  // Règle 1: bénéficiaire avec conseiller migrant → concerné
  const beneficiaireConseillerMigrant = unJeuneDto({
    id: 'regle-1',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerMigrant.id,
    idConseillerInitial: undefined
  })

  // Règle 2: bénéficiaire avec conseiller ne migrant pas → non concerné
  const beneficiaireConseillerNonMigrant = unJeuneDto({
    id: 'regle-2',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerNonMigrant.id,
    idConseillerInitial: undefined
  })

  // Règle 3: conseiller initial migrant + conseiller temporaire ne migrant pas → concerné
  const beneficiaireInitialMigrantTmpNonMigrant = unJeuneDto({
    id: 'regle-3',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerNonMigrant.id,
    idConseillerInitial: conseillerMigrant.id
  })

  // Règle 4: conseiller initial migrant + conseiller temporaire migrant → concerné
  const beneficiaireInitialMigrantTmpMigrant = unJeuneDto({
    id: 'regle-4',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerMigrant2.id,
    idConseillerInitial: conseillerMigrant.id
  })

  // Règle 5: conseiller initial ne migrant pas + conseiller temporaire migrant → non concerné
  const beneficiaireInitialNonMigrantTmpMigrant = unJeuneDto({
    id: 'regle-5',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerMigrant.id,
    idConseillerInitial: conseillerNonMigrant.id
  })

  // Règle 6: conseiller initial ne migrant pas + conseiller temporaire ne migrant pas → non concerné
  const beneficiaireInitialNonMigrantTmpNonMigrant = unJeuneDto({
    id: 'regle-6',
    structure: Core.Structure.POLE_EMPLOI,
    idConseiller: conseillerNonMigrant2.id,
    idConseillerInitial: conseillerNonMigrant.id
  })

  // Cas supplémentaires pour vérifier que la structure n'est plus un critère
  const beneficiaireAijConseillerMigrant = unJeuneDto({
    id: 'aij-conseiller-migrant',
    structure: Core.Structure.POLE_EMPLOI_AIJ,
    idConseiller: conseillerMigrant.id,
    idConseillerInitial: undefined
  })

  before(async () => {
    databaseForTesting = getDatabase()
    await databaseForTesting.cleanPG()

    featureFlipRepository = new FeatureFlipSqlRepository(
      databaseForTesting.sequelize
    )

    configService = {
      get: (key: string) => {
        if (key === 'features.dateDeMigrationPhaseA') {
          return '2025-11-20'
        }
        return undefined
      }
    } as ConfigService
    dateDeMigration = DateTime.fromISO('2025-11-20').startOf('day')

    service = new FeatureFlip.Service(
      featureFlipRepository,
      configService,
      dateService
    )

    await ConseillerSqlModel.bulkCreate([
      conseillerMigrant,
      conseillerMigrant2,
      conseillerNonMigrant,
      conseillerNonMigrant2
    ])

    await FeatureFlipSqlModel.bulkCreate([
      {
        featureTag: FeatureFlip.Tag.MIGRATION_PHASE_A,
        emailConseiller: conseillerMigrant.email
      },
      {
        featureTag: FeatureFlip.Tag.MIGRATION_PHASE_A,
        emailConseiller: conseillerMigrant2.email
      },
      {
        featureTag: FeatureFlip.Tag.DEMARCHES_IA,
        emailConseiller: conseillerNonMigrant.email
      },
      {
        featureTag: FeatureFlip.Tag.DEMARCHES_IA,
        emailConseiller: conseillerNonMigrant2.email
      }
    ])

    await JeuneSqlModel.bulkCreate([
      beneficiaireConseillerMigrant,
      beneficiaireConseillerNonMigrant,
      beneficiaireInitialMigrantTmpNonMigrant,
      beneficiaireInitialMigrantTmpMigrant,
      beneficiaireInitialNonMigrantTmpMigrant,
      beneficiaireInitialNonMigrantTmpNonMigrant,
      beneficiaireAijConseillerMigrant
    ])
  })

  describe('recupererIdsDesBeneficiaireAMigrer', () => {
    it('renvoie les ids des bénéficiaires dont le conseiller de rattachement migre vers Parcours Emploi', async () => {
      // When
      const result = await service.recupererIdsDesBeneficiaireAMigrer(
        PhaseDeMigration.PHASE_A
      )

      // Then
      expect(result).to.have.members([
        beneficiaireConseillerMigrant.id, // Règle 1
        beneficiaireInitialMigrantTmpNonMigrant.id, // Règle 3
        beneficiaireInitialMigrantTmpMigrant.id, // Règle 4
        beneficiaireAijConseillerMigrant.id // La structure du bénéficiaire n'est plus un critère
      ])
    })
  })

  describe('recupererDateDeMigrationSiLUtilisateurDoitMigrer', () => {
    describe('pour les bénéficiaires', () => {
      it('Règle 1: bénéficiaire avec conseiller migrant → concerné', async () => {
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: beneficiaireConseillerMigrant.id,
            type: Type.JEUNE
          })
        expect(result).to.deep.equal(dateDeMigration)
      })

      it('Règle 2: bénéficiaire avec conseiller ne migrant pas → non concerné', async () => {
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: beneficiaireConseillerNonMigrant.id,
            type: Type.JEUNE
          })
        expect(result).to.be.undefined()
      })

      it('Règle 3: conseiller initial migrant + conseiller temporaire ne migrant pas → concerné', async () => {
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: beneficiaireInitialMigrantTmpNonMigrant.id,
            type: Type.JEUNE
          })
        expect(result).to.deep.equal(dateDeMigration)
      })

      it('Règle 4: conseiller initial migrant + conseiller temporaire migrant → concerné', async () => {
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: beneficiaireInitialMigrantTmpMigrant.id,
            type: Type.JEUNE
          })
        expect(result).to.deep.equal(dateDeMigration)
      })

      it('Règle 5: conseiller initial ne migrant pas + conseiller temporaire migrant → non concerné', async () => {
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: beneficiaireInitialNonMigrantTmpMigrant.id,
            type: Type.JEUNE
          })
        expect(result).to.be.undefined()
      })

      it('Règle 6: conseiller initial ne migrant pas + conseiller temporaire ne migrant pas → non concerné', async () => {
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: beneficiaireInitialNonMigrantTmpNonMigrant.id,
            type: Type.JEUNE
          })
        expect(result).to.be.undefined()
      })

      it('bénéficiaire AIJ avec conseiller migrant → concerné (structure bénéficiaire non critère)', async () => {
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: beneficiaireAijConseillerMigrant.id,
            type: Type.JEUNE
          })
        expect(result).to.deep.equal(dateDeMigration)
      })
    })

    describe('pour les conseillers', () => {
      it('renvoie la date de migration si le conseiller migre vers Parcours Emploi', async () => {
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: conseillerMigrant.id,
            type: Type.CONSEILLER
          })
        expect(result).to.deep.equal(dateDeMigration)
      })

      it('renvoie undefined si le conseiller ne migre pas', async () => {
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: conseillerNonMigrant.id,
            type: Type.CONSEILLER
          })
        expect(result).to.be.undefined()
      })

      it('conseiller AIJ migrant → concerné (structure conseiller non critère)', async () => {
        const result =
          await service.recupererDateDeMigrationSiLUtilisateurDoitMigrer({
            id: conseillerMigrant2.id,
            type: Type.CONSEILLER
          })
        expect(result).to.deep.equal(dateDeMigration)
      })
    })
  })
})
