import { DateTime } from 'luxon'
import { PlanAction } from '../../../domain/plan-action/plan-action'
import { estInvite, estMilo } from '../../../domain/profil'
import { Profil } from '../../../domain/profil'
import {
  AuthProviderDto,
  CommuneDto,
  GoalDto,
  ObstacleDto,
  PlanDto,
  ProfileDto,
  SituationDto
} from '../dto/plan-action.dto'

export function toSuggestion(plan: PlanDto): PlanAction.Suggestion {
  return {
    accroche: plan.greeting,
    genereLe: DateTime.fromISO(plan.generatedAt),
    generateur: plan.generator,
    objectifs: plan.objectives.map(objective => ({
      titre: objective.title,
      theme: objective.theme,
      idsSolutions: objective.actions.map(action => action.id)
    }))
  }
}

export function toProfileDto(profil: PlanAction.Profil): ProfileDto {
  const dateNaissance = profil.dateNaissance?.toISODate() ?? undefined

  return {
    authProvider: authProvider(profil.structure),
    situation: profil.situation as SituationDto,
    goals: profil.besoins as unknown as GoalDto[],
    obstacles: profil.contraintes as unknown as ObstacleDto[],
    ...(dateNaissance ? { dateNaissance } : {}),
    ...(profil.domaine !== undefined ? { domaine: profil.domaine } : {}),
    ...(profil.habitation
      ? { habitation: toCommuneDto(profil.habitation) }
      : {}),
    ...(profil.villeRecherche
      ? { villeRecherche: toCommuneDto(profil.villeRecherche) }
      : {}),
    ...(profil.rayonKm !== undefined ? { rayonKm: profil.rayonKm } : {})
  }
}

function authProvider(structure: Profil.Structure): AuthProviderDto {
  if (estInvite(structure)) return 'guest'
  if (estMilo(structure)) return 'mission-locale'
  return 'france-travail'
}

function toCommuneDto(commune: PlanAction.Commune): CommuneDto {
  return { codeInsee: commune.codeInsee, nom: commune.nom }
}
