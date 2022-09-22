import { Suggestion } from '../../../../../domain/offre/recherche/suggestion/suggestion'
import { PoleEmploiPartenaireClient } from '../../../../clients/pole-emploi-partenaire-client'
import {
  isFailure,
  Result,
  success
} from '../../../../../building-blocks/types/result'
import { Injectable } from '@nestjs/common'
import { SuggestionDto } from '../../../../clients/dto/pole-emploi.dto'

const CODE_TYPE_LIEU_DEPARTEMENT = '4'
const CODE_TYPE_LIEU_COMMUNE = '5'
const CODE_UNITE_RAYON_KM = 'KM'

@Injectable()
export class SuggestionPeHttpRepository
  implements Suggestion.PoleEmploi.Repository
{
  constructor(private client: PoleEmploiPartenaireClient) {}

  async findAll(token: string): Promise<Result<Suggestion.PoleEmploi[]>> {
    const suggestionsDtoResult = await this.client.getSuggestionsRecherches(
      token
    )

    if (isFailure(suggestionsDtoResult)) {
      return suggestionsDtoResult
    }

    const suggestions = suggestionsDtoResult.data
      .filter(
        suggestion =>
          suggestion.mobilites?.length &&
          (suggestion.mobilites[0].lieu.type.code ===
            CODE_TYPE_LIEU_DEPARTEMENT ||
            suggestion.mobilites[0].lieu.type.code ===
              CODE_TYPE_LIEU_COMMUNE) &&
          suggestion.rome?.code &&
          suggestion.rome.libelle &&
          suggestion.appellation?.libelle
      )
      .map(toSuggestionPoleEmploi)

    return success(suggestions)
  }
}

function toSuggestionPoleEmploi(
  suggestion: SuggestionDto
): Suggestion.PoleEmploi {
  return {
    informations: {
      titre: suggestion.appellation!.libelle,
      metier: suggestion.rome!.libelle,
      localisation: suggestion.mobilites![0].lieu.libelle
    },
    texteRecherche: suggestion.appellation?.libelle || suggestion.rome?.libelle,
    rome: suggestion.rome!.code,
    localisation: {
      code: suggestion.mobilites![0].lieu.code,
      type:
        suggestion.mobilites![0].lieu.type.code === CODE_TYPE_LIEU_COMMUNE
          ? Suggestion.TypeLocalisation.COMMUNE
          : Suggestion.TypeLocalisation.DEPARTEMENT,
      rayon:
        suggestion.mobilites![0].unite?.code == CODE_UNITE_RAYON_KM
          ? suggestion.mobilites![0].rayon
          : undefined
    }
  }
}
