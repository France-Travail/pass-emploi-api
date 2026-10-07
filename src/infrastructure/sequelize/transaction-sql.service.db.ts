import { Inject, Injectable } from '@nestjs/common'
import { Sequelize } from 'sequelize-typescript'
import { Transaction } from '../../building-blocks/transaction'
import { Failure, isFailure, Result } from '../../building-blocks/types/result'
import { SequelizeInjectionToken } from './providers'

class EchecAAnnuler extends Error {
  constructor(readonly echec: Failure) {
    super('Transaction annulée sur échec métier')
  }
}

@Injectable()
export class TransactionSqlService implements Transaction.Service {
  constructor(
    @Inject(SequelizeInjectionToken)
    private readonly sequelize: Sequelize
  ) {}

  async executer<T>(operation: () => Promise<Result<T>>): Promise<Result<T>> {
    try {
      return await this.sequelize.transaction(async () => {
        const resultat = await operation()
        if (isFailure(resultat)) throw new EchecAAnnuler(resultat)
        return resultat
      })
    } catch (e) {
      if (e instanceof EchecAAnnuler) return e.echec
      throw e
    }
  }
}
