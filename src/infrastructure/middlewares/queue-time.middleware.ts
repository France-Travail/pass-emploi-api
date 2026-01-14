import { Injectable, NestMiddleware, Logger } from '@nestjs/common'
import { Request, Response, NextFunction } from 'express'
import * as apm from 'elastic-apm-node'

@Injectable()
export class QueueTimeMiddleware implements NestMiddleware {
  private readonly logger = new Logger(QueueTimeMiddleware.name)

  use(req: Request, _res: Response, next: NextFunction): void {
    const xRequestStart = req.get('X-Request-Start')

    if (xRequestStart && apm.currentTransaction) {
      try {
        // Format: "t=1693406590.527" (Unix timestamp avec millisecondes)
        const requestStartMatch = new RegExp(/t=(\d+\.?\d*)/).exec(
          xRequestStart
        )

        if (requestStartMatch) {
          // Convertir en millisecondes
          const requestStartMs = Number.parseFloat(requestStartMatch[1]) * 1000
          const nowMs = Date.now()

          const queueTimeMs = Math.max(0, nowMs - requestStartMs)

          apm.currentTransaction.setLabel('queue_time_ms', queueTimeMs, false)
          apm.currentTransaction.setLabel(
            'request_start_timestamp',
            requestStartMs,
            false
          )
        }
      } catch (error) {
        this.logger.error('Error calculating queue time:', error)
      }
    }

    next()
  }
}
