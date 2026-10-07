import { Result } from './types/result'

export const TransactionServiceToken = 'Transaction.Service'

export namespace Transaction {
  export interface Service {
    executer<T>(operation: () => Promise<Result<T>>): Promise<Result<T>>
  }
}
