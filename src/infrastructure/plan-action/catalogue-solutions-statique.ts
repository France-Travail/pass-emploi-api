import { Injectable } from '@nestjs/common'
import { PlanAction } from '../../domain/plan-action'
import { REFERENTIEL_SOLUTIONS } from './referentiel-solutions'

// Catalogue en mémoire : le référentiel est embarqué au build, sa mise à
// jour passe par la régénération de referentiel-solutions.ts et une release
@Injectable()
export class CatalogueSolutionsStatique
  implements PlanAction.CatalogueRepository
{
  getSolutions(): PlanAction.Solution[] {
    return REFERENTIEL_SOLUTIONS
  }
}
