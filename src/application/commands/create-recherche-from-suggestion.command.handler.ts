import { Inject, Injectable } from '@nestjs/common'
import { DiagorienteLocation } from 'src/domain/offre/recherche/suggestion/diagoriente'
import { CommandHandler } from '../../building-blocks/types/command-handler'
import { Command } from '../../building-blocks/types/command'
import { MauvaiseCommandeError } from '../../building-blocks/types/domain-error'
import {
  Result,
  failure,
  isFailure,
  success
} from '../../building-blocks/types/result'
import { Authentification } from '../../domain/authentification'
import { PROFILS_JEUNES_ACCOMPAGNES } from '../../domain/profil'
import { EvenementService } from '../../domain/evenement'
import {
  Recherche,
  RecherchesRepositoryToken
} from '../../domain/offre/recherche/recherche'
import {
  Suggestion,
  SuggestionsRepositoryToken
} from '../../domain/offre/recherche/suggestion/suggestion'
import { SuggestionAuthorizer } from '../authorizers/suggestion-authorizer'

export interface CreateRechercheFromSuggestionCommand extends Command {
  idJeune: string
  idSuggestion: string
  location?: DiagorienteLocation
  rayon?: number
}

@Injectable()
export class CreateRechercheFromSuggestionCommandHandler extends CommandHandler<
  CreateRechercheFromSuggestionCommand,
  Recherche
> {
  readonly profilsAutorises = PROFILS_JEUNES_ACCOMPAGNES

  constructor(
    private suggestionAuthorizer: SuggestionAuthorizer,
    @Inject(SuggestionsRepositoryToken)
    private suggestionRepository: Suggestion.Repository,
    @Inject(RecherchesRepositoryToken)
    private rechercheRepository: Recherche.Repository,
    private rechercheFactory: Recherche.Factory,
    private suggestionFactory: Suggestion.Factory,
    private evenementService: EvenementService
  ) {
    super('CreateRechercheFromSuggestionCommandHandler')
  }

  async handle(
    command: CreateRechercheFromSuggestionCommand
  ): Promise<Result<Recherche>> {
    let suggestion = await this.suggestionRepository.get(command.idSuggestion)

    if (!suggestion) {
      return failure(new MauvaiseCommandeError('Suggestion non trouvée'))
    }
    if (suggestion.source === Suggestion.Source.DIAGORIENTE) {
      if (!command.location) {
        return failure(
          new MauvaiseCommandeError(
            'La localisation est nécessaire pour une suggestion DIAGORIENTE'
          )
        )
      }
      const criteresDiagoriente =
        this.suggestionFactory.construireCriteresSuggestionsDiagoriente(
          suggestion,
          { location: command.location, rayon: command.rayon ?? undefined }
        )

      suggestion = {
        ...suggestion,
        informations: {
          ...suggestion.informations,
          localisation: command.location.libelle
        },
        criteres: criteresDiagoriente
      }
    }

    const suggestionAccepteeResult = this.suggestionFactory.accepter(suggestion)
    if (isFailure(suggestionAccepteeResult)) {
      return suggestionAccepteeResult
    }

    const rechercheResult = this.rechercheFactory.buildRechercheFromSuggestion(
      suggestionAccepteeResult.data
    )
    if (isFailure(rechercheResult)) {
      return rechercheResult
    }

    const recherche: Recherche = {
      ...rechercheResult.data,
      criteres: Recherche.normaliserLesCriteres(
        rechercheResult.data.type,
        rechercheResult.data.criteres
      )
    }

    // Le jeune peut déjà avoir cette alerte, créée à la main ou via une autre
    // suggestion aux mêmes critères. On rattache alors la suggestion à
    // l'existante : en créer une seconde doublerait ses notifications
    const rechercheExistante =
      await this.rechercheRepository.trouverParCriteres(
        recherche.idJeune,
        recherche.type,
        recherche.criteres
      )

    if (rechercheExistante) {
      // idRecherche est une FK : la suggestion doit pointer vers une ligne
      // qui existe, donc vers l'alerte conservée et non vers l'id abandonné
      await this.suggestionRepository.save({
        ...suggestionAccepteeResult.data,
        idRecherche: rechercheExistante.id
      })
      return success(rechercheExistante)
    }

    await this.rechercheRepository.save(recherche)
    await this.suggestionRepository.save(suggestionAccepteeResult.data)

    return success(recherche)
  }

  async monitor(
    utilisateur: Authentification.Utilisateur,
    command: CreateRechercheFromSuggestionCommand
  ): Promise<void> {
    await this.evenementService.creerEvenementSuggestion(
      utilisateur,
      command.idSuggestion
    )
  }

  async authorize(
    command: CreateRechercheFromSuggestionCommand,
    utilisateur: Authentification.Utilisateur
  ): Promise<Result> {
    return this.suggestionAuthorizer.autoriserJeunePourSaSuggestion(
      command.idJeune,
      command.idSuggestion,
      utilisateur
    )
  }
}
