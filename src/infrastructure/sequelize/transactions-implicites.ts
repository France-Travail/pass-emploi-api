import { AsyncLocalStorage } from 'node:async_hooks'
import { Sequelize } from 'sequelize-typescript'

type ContexteTransaction = Map<string, unknown>

const contexteTransaction = new AsyncLocalStorage<ContexteTransaction>()

const espaceDeNomsCLS = {
  run<R>(operation: (contexte: ContexteTransaction) => R): R {
    const contexte: ContexteTransaction = new Map()
    return contexteTransaction.run(contexte, () => operation(contexte))
  },
  get(cle: string): unknown {
    return contexteTransaction.getStore()?.get(cle)
  },
  set(cle: string, valeur: unknown): void {
    contexteTransaction.getStore()?.set(cle, valeur)
  },
  bind<F>(fonction: F): F {
    return fonction
  }
}

export function activerTransactionsImplicites(): void {
  Sequelize.useCLS(espaceDeNomsCLS)
}
