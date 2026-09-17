import { Injectable } from '@nestjs/common'
import { PlanAction } from '../../domain/plan-action'
import { REFERENTIEL_SOLUTIONS } from './referentiel-solutions'

// Catalogue in-memory : référentiel embarqué au build, provisoire avant passage en base
@Injectable()
export class CatalogueSolutionsStatique
  implements PlanAction.CatalogueRepository
{
  getSolutions(): PlanAction.Solution[] {
    return REFERENTIEL_SOLUTIONS
  }
}
