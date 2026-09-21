import { Logger } from '@nestjs/common'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'

// Lance scripts/analytics/0_db_dump_restore.sh ; renvoie la sortie d'erreur du script, s'il y en a une.
export async function dumperEtRestaurer(
  logger: Logger,
  env: Record<string, string> = {}
): Promise<string | undefined> {
  const { stdout, stderr } = await promisify(exec)('yarn run dump-restore-db', {
    env: { ...process.env, ...env }
  })
  if (stdout) {
    logger.log(stdout)
  }
  if (stderr) {
    logger.error(stderr)
    return stderr
  }
  return undefined
}
