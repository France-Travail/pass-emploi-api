import { AxiosInstance } from 'axios'
import { ExternalApiLoggerService } from '../../utils/external-api-logger.service'

/**
 * Classe de base pour tout client HTTP appelant une API externe.
 *
 * Impose qu'un nom de cible (`target`) soit fourni à la construction : ce nom
 * apparaît dans `log.logger`/`context` des logs ECS émis automatiquement par
 * l'instance Axios. Empêche d'instancier un client sans instrumentation.
 */
export abstract class ExternalApiClient {
  protected readonly axios: AxiosInstance

  protected constructor(
    target: string,
    externalApiLogger: ExternalApiLoggerService
  ) {
    this.axios = externalApiLogger.createAxios(target)
  }
}
