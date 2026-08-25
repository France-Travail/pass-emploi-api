import { Injectable } from '@nestjs/common'
import { AsyncLocalStorage } from 'node:async_hooks'

export type ContextData = Map<ContextKey, unknown>

export enum ContextKey {
  UTILISATEUR = 'UTILISATEUR',
  HTTP_REQUEST_ID = 'HTTP_REQUEST_ID',
  USER_JOURNEY = 'USER_JOURNEY'
}

const asyncLocalStorage = new AsyncLocalStorage<ContextData>()

export function getContextValue<T>(key: ContextKey): T | undefined {
  return asyncLocalStorage.getStore()?.get(key) as T | undefined
}

@Injectable()
export class Context {
  start(): void {
    asyncLocalStorage.enterWith(new Map<ContextKey, unknown>())
  }

  get<T>(key: ContextKey): T | undefined {
    return getContextValue<T>(key)
  }

  set(key: ContextKey, value: unknown): void {
    asyncLocalStorage.getStore()?.set(key, value)
  }
}
