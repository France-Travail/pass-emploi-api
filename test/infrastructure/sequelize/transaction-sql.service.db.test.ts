import { NonTrouveError } from 'src/building-blocks/types/domain-error'
import { emptySuccess, failure, Result } from 'src/building-blocks/types/result'
import { ReferentielPlanActionSolutionSqlModel } from 'src/infrastructure/sequelize/models/referentiel-plan-action-solution.sql-model'
import { TransactionSqlService } from 'src/infrastructure/sequelize/transaction-sql.service.db'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { expect } from 'test/utils'
import {
  DatabaseForTesting,
  getDatabase
} from 'test/utils/database-for-testing'

describe('TransactionSqlService', () => {
  let database: DatabaseForTesting
  let transactionService: TransactionSqlService

  before(() => {
    database = getDatabase()
  })

  beforeEach(async () => {
    await database.cleanPG()
    transactionService = new TransactionSqlService(database.sequelize)
  })

  async function insererSolution(): Promise<void> {
    await ReferentielPlanActionSolutionSqlModel.create({
      id: 'p-1',
      type: 'LIEN',
      libelle: 'Je consulte des sites',
      situations: [],
      authentifications: [],
      territoires: [],
      active: true,
      dateMaj: uneDatetime().toJSDate()
    })
  }

  async function compterSolutions(): Promise<number> {
    return ReferentielPlanActionSolutionSqlModel.count()
  }

  it("valide les écritures quand l'opération réussit", async () => {
    // When
    const result = await transactionService.executer(async () => {
      await insererSolution()
      return emptySuccess()
    })

    // Then
    expect(result).to.deep.equal(emptySuccess())
    expect(await compterSolutions()).to.equal(1)
  })

  it("annule les écritures et rend l'échec quand l'opération échoue", async () => {
    // Given
    const echec = failure(new NonTrouveError('Jeune', 'id-jeune'))

    // When
    const result = await transactionService.executer(
      async (): Promise<Result> => {
        await insererSolution()
        return echec
      }
    )

    // Then
    expect(result).to.deep.equal(echec)
    expect(await compterSolutions()).to.equal(0)
  })

  it("annule les écritures et relance l'exception levée par l'opération", async () => {
    // Given
    const erreur = new Error('panne')

    // When
    const promesse = transactionService.executer(async () => {
      await insererSolution()
      throw erreur
    })

    // Then
    await expect(promesse).to.be.rejectedWith(erreur)
    expect(await compterSolutions()).to.equal(0)
  })
})
