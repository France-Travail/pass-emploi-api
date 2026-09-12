import { DateTime } from 'luxon'
import { Core } from '../../../src/domain/core'
import { FonctionnaliteSqlRepository } from '../../../src/infrastructure/repositories/fonctionnalite.repository.db'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { FonctionnaliteConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/fonctionnalite-conseiller.sql-model'
import { FonctionnaliteSqlModel } from '../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { expect } from '../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../utils/database-for-testing'

describe('FonctionnaliteSqlRepository', () => {
  const maintenant = DateTime.fromISO('2026-09-11T12:00:00.000Z')

  let databaseForTesting: DatabaseForTesting
  let repo: FonctionnaliteSqlRepository

  before(async () => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    repo = new FonctionnaliteSqlRepository(databaseForTesting.sequelize)

    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: 'conseillerSansDate',
        structure: Core.Structure.POLE_EMPLOI,
        email: 'conseillerSansDate@email.com'
      }),
      unConseillerDto({
        id: 'conseillerDateAVenir',
        email: 'conseillerDateAVenir@email.com'
      }),
      unConseillerDto({
        id: 'conseillerDatePassee',
        email: 'conseillerDatePassee@email.com'
      }),
      unConseillerDto({
        id: 'conseillerSansFonctionnalite',
        email: 'conseillerSansFonctionnalite@email.com'
      })
    ])

    await JeuneSqlModel.bulkCreate([
      unJeuneDto({
        id: 'jeuneSansDate',
        idConseiller: 'conseillerSansDate',
        idConseillerInitial: undefined
      }),
      unJeuneDto({
        id: 'jeuneDateAVenir',
        idConseiller: 'conseillerDateAVenir',
        idConseillerInitial: undefined
      }),
      unJeuneDto({
        id: 'jeuneDatePassee',
        idConseiller: 'conseillerDatePassee',
        idConseillerInitial: undefined
      }),
      unJeuneDto({
        id: 'jeuneTransfere',
        idConseiller: 'conseillerSansFonctionnalite',
        idConseillerInitial: 'conseillerSansDate'
      }),
      unJeuneDto({
        id: 'jeuneSansFonctionnalite',
        idConseiller: 'conseillerSansFonctionnalite',
        idConseillerInitial: undefined
      })
    ])

    await FonctionnaliteSqlModel.bulkCreate([
      { id: 'PLAN_D_ACTION' },
      { id: 'PHASE_A' },
      { id: 'PHASE_B' }
    ])

    await FonctionnaliteConseillerSqlModel.bulkCreate([
      {
        idFonctionnalite: 'PLAN_D_ACTION',
        emailConseiller: 'conseillerSansDate@email.com',
        dateActivation: null
      },
      {
        idFonctionnalite: 'PHASE_A',
        emailConseiller: 'conseillerSansDate@email.com',
        dateActivation: null
      },
      {
        idFonctionnalite: 'PHASE_B',
        emailConseiller: 'conseillerDateAVenir@email.com',
        dateActivation: maintenant.plus({ days: 1 }).toJSDate()
      },
      {
        idFonctionnalite: 'PHASE_A',
        emailConseiller: 'conseillerDatePassee@email.com',
        dateActivation: maintenant.minus({ days: 1 }).toJSDate()
      }
    ])
  })

  describe('getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire', () => {
    it("rend actives les fonctionnalités sans date d'activation", async () => {
      // When
      const ids =
        await repo.getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire(
          'jeuneSansDate',
          maintenant
        )

      // Then
      expect(ids).to.have.members(['PLAN_D_ACTION', 'PHASE_A'])
    })

    it("rend active une fonctionnalité dont la date d'activation est passée", async () => {
      // When
      const ids =
        await repo.getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire(
          'jeuneDatePassee',
          maintenant
        )

      // Then
      expect(ids).to.deep.equal(['PHASE_A'])
    })

    it("ne rend pas active une fonctionnalité dont la date d'activation est à venir", async () => {
      // When
      const ids =
        await repo.getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire(
          'jeuneDateAVenir',
          maintenant
        )

      // Then
      expect(ids).to.deep.equal([])
    })

    it('prend les fonctionnalités du conseiller initial quand le jeune est transféré', async () => {
      // When
      const ids =
        await repo.getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire(
          'jeuneTransfere',
          maintenant
        )

      // Then
      expect(ids).to.have.members(['PLAN_D_ACTION', 'PHASE_A'])
    })

    it("renvoie une liste vide quand le conseiller n'a aucune fonctionnalité", async () => {
      // When
      const ids =
        await repo.getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire(
          'jeuneSansFonctionnalite',
          maintenant
        )

      // Then
      expect(ids).to.deep.equal([])
    })

    it("renvoie une liste vide quand l'id jeune n'existe pas", async () => {
      // When
      const ids =
        await repo.getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire(
          'id-inexistant',
          maintenant
        )

      // Then
      expect(ids).to.deep.equal([])
    })
  })
})
