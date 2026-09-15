import { Injectable } from '@nestjs/common'
import { v4 as uuidV4, v5 as uuidV5 } from 'uuid'

// Namespace fixe pour dériver un uuid déterministe depuis une chaîne (ex : id d'authentification)
const NAMESPACE_DETERMINISTE = 'b1f7c0de-4a2e-5c8b-9d3f-6a1e2b3c4d5e'

@Injectable()
export class IdService {
  uuid(): string {
    return uuidV4()
  }

  // Même entrée -> même uuid : rend idempotente une création concurrente
  uuidDepuis(graine: string): string {
    return uuidV5(graine, NAMESPACE_DETERMINISTE)
  }
}
