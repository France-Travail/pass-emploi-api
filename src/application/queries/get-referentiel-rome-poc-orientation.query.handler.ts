import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { NonTrouveError } from '../../building-blocks/types/domain-error'
import { Query } from '../../building-blocks/types/query'
import { QueryHandler } from '../../building-blocks/types/query-handler'
import {
  emptySuccess,
  failure,
  isFailure,
  Result,
  success
} from '../../building-blocks/types/result'
import { TOUT_PROFIL } from '../../domain/profil'
import { PoleEmploiClient } from '../../infrastructure/clients/pole-emploi-client'
import { DateService } from '../../utils/date-service'

export type RessourceRomePocOrientation =
  'CENTRES_INTERET' | 'METIERS_DU_CENTRE_INTERET' | 'METIERS' | 'FICHE_METIER'

export interface GetReferentielRomePocOrientationQuery extends Query {
  ressource: RessourceRomePocOrientation
  code?: string
}

// POC orientation de l'app jeune, hors prod : relaie ROME 4.0 – Métiers tel que France Travail le renvoie.
// Le référentiel ne change que deux fois par an et ROME limite chaque application à un appel par seconde :
// les réponses sont gardées 24 h en mémoire.
@Injectable()
export class GetReferentielRomePocOrientationQueryHandler extends QueryHandler<
  GetReferentielRomePocOrientationQuery,
  Result<unknown>
> {
  readonly profilsAutorises = TOUT_PROFIL
  private readonly cache = new Map<
    string,
    { valeur: unknown; expiration: DateTime }
  >()

  constructor(
    private readonly poleEmploiClient: PoleEmploiClient,
    private readonly configService: ConfigService,
    private readonly dateService: DateService
  ) {
    super('GetReferentielRomePocOrientationQueryHandler')
  }

  async handle(
    query: GetReferentielRomePocOrientationQuery
  ): Promise<Result<unknown>> {
    if (this.configService.get('environment') === 'prod') {
      return failure(new NonTrouveError('POC orientation'))
    }

    const { chemin, champs } = cheminRome(query)
    const enCache = this.cache.get(chemin)
    if (enCache && enCache.expiration > this.dateService.now()) {
      return success(enCache.valeur)
    }

    const result = await this.poleEmploiClient.getReferentielRome(
      chemin,
      champs
    )
    if (isFailure(result)) return result
    this.cache.set(chemin, {
      valeur: result.data,
      expiration: this.dateService.now().plus({ hours: 24 })
    })
    return result
  }

  async authorize(): Promise<Result> {
    return emptySuccess()
  }

  async monitor(): Promise<void> {
    return
  }
}

function cheminRome(query: GetReferentielRomePocOrientationQuery): {
  chemin: string
  champs?: string
} {
  switch (query.ressource) {
    case 'CENTRES_INTERET':
      return { chemin: 'centre-interet', champs: 'code,libelle' }
    case 'METIERS_DU_CENTRE_INTERET':
      return {
        chemin: `centre-interet/${query.code}`,
        champs: 'code,libelle,metiers(code,libelle)'
      }
    case 'METIERS':
      return {
        chemin: 'metier',
        champs:
          'code,libelle,riasecMajeur,riasecMineur,domaineProfessionnel(libelle,grandDomaine(code,libelle))'
      }
    case 'FICHE_METIER':
      return { chemin: `metier/${query.code}` }
  }
}
