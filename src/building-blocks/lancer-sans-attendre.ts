import { LoggerService } from '@nestjs/common'
import { getAPMInstance } from '../infrastructure/monitoring/apm.init'
import { buildError } from '../utils/logger.module'

export function lancerSansAttendre(
  tache: Promise<unknown>,
  logger: LoggerService,
  messageEchec: string
): void {
  // Promise.resolve : dans les tests, un stub non configuré renvoie undefined au lieu d'une promesse.
  Promise.resolve(tache).catch(e => {
    logger.error(buildError(messageEchec, e))
    getAPMInstance().captureError(e)
  })
}
