import { Injectable, Logger } from '@nestjs/common'
import { ErreurHttp } from '../../building-blocks/types/domain-error'
import { failure, Result } from '../../building-blocks/types/result'
import { PlanAction } from '../../domain/plan-action'

// Générateur LLM du plan d'action — NON BRANCHÉ. Tant qu'il renvoie une
// failure, PlanAction.Service produit systématiquement le plan de secours
// déterministe (generator: 'fallback'), qui suffit fonctionnellement.
//
// Pour le brancher, implémenter generer() avec un appel LLM en sortie
// structurée validée sur le schéma d'Ebauche (greeting, objectives[{title,
// theme, solutionIds}]), construit à partir du profil et du catalogue des
// solutions éligibles. Le prompt de référence (système + compactage du
// catalogue en lignes `id | thème | sous-catégorie | besoin | action |
// service`) vit dans le POC bayesimpact/1jeune-des-solutions,
// apps/api/src/infrastructure/llm/prompt.ts. Aucune protection à ajouter
// ici : les ids inventés, doublons et débordements sont neutralisés par
// PlanAction.materialiserPlan, et toute failure retombe sur le secours.
@Injectable()
export class GenerateurPlanActionLlm implements PlanAction.Generateur {
  private readonly logger = new Logger('GenerateurPlanActionLlm')

  async generer(_args: {
    profil: PlanAction.Profil
    solutionsEligibles: PlanAction.Solution[]
  }): Promise<Result<PlanAction.Ebauche>> {
    this.logger.log(
      'Générateur LLM non branché, le plan de secours déterministe sera servi'
    )
    return failure(
      new ErreurHttp("Génération LLM du plan d'action non branchée", 501)
    )
  }
}
