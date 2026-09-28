import { Injectable } from '@nestjs/common'
import { PlanAction } from '../../../domain/plan-action'
import { REFERENTIEL_PLAN_ACTION } from './referentiel-plan-action'

// Catalogue in-memory : référentiel embarqué au build, provisoire avant passage en base
@Injectable()
export class ReferentielPlanActionStatique
  implements PlanAction.CatalogueRepository
{
  getSolutions(): PlanAction.Solution[] {
    return REFERENTIEL_PLAN_ACTION
  }
}
