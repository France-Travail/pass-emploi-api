import { Injectable } from '@nestjs/common'
import { PlanAction } from '../../domain/plan-action'
import { REFERENTIEL_SOLUTIONS } from './referentiel-solutions'

// Catalogue en mémoire : le référentiel est embarqué au build (voir
// referentiel-solutions.ts), sa mise à jour passe par une régénération du
// fichier et une release de l'API
@Injectable()
export class CatalogueSolutionsStatique
  implements PlanAction.CatalogueRepository
{
  getSolutions(): PlanAction.Solution[] {
    return REFERENTIEL_SOLUTIONS
  }
}
