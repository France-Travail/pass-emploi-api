import { ConfigService } from '@nestjs/config'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { MajReferentielPlanActionJobHandler } from 'src/application/jobs/maj-referentiel-plan-action.job.handler.db'
import { failure, success } from 'src/building-blocks/types/result'
import { ErreurHttp } from 'src/building-blocks/types/domain-error'
import { ReferentielPlanAction } from 'src/domain/plan-action/referentiel-plan-action'
import { Planificateur } from 'src/domain/planificateur'
import { SuiviJob } from 'src/domain/suivi-job'
import { GristClient } from 'src/infrastructure/clients/grist-client'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { createSandbox, expect, StubbedClass, stubClass } from 'test/utils'

describe('MajReferentielPlanActionJobHandler', () => {
  let handler: MajReferentielPlanActionJobHandler
  let gristClient: StubbedClass<GristClient>
  let repository: StubbedType<ReferentielPlanAction.Repository>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let dateService: StubbedClass<DateService>

  const job: Planificateur.Job<void> = {
    dateExecution: uneDatetime().toJSDate(),
    type: Planificateur.JobType.MAJ_REFERENTIEL_PLAN_ACTION,
    contenu: undefined
  }

  const serviceGrist = {
    id: 1,
    fields: { Nom: 'ONISEP', Description: 'site' }
  }

  const solutionGrist = {
    id: 1,
    fields: {
      Id_technique: 'p-2',
      Envie: "M'orienter",
      Blocage: '',
      Sous_categorie: '',
      Besoin_exprime_par_le_jeune: '',
      Type: 'Lien web',
      Action_affichee_au_jeune: 'Je consulte des sites',
      URL: 'https://www.onisep.fr/',
      Ecran_de_l_app: '',
      Service: 'ONISEP',
      Situations: 'Au collège',
      Authentification: 'France Travail',
      Age_minimum: null,
      Age_maximum: null,
      Territoire: '',
      Domaine: '',
      Conversion_FT_Thematique: '',
      Conversion_FT_Demarche: '',
      Conversion_FT_Code_pourquoi: '',
      Conversion_FT_Code_quoi: '',
      Conversion_ML_Categorie: '',
      Conversion_ML_Code_categorie: '',
      Conversion_ML_Action: '',
      Conversion_ML_Origine_de_l_action: ''
    }
  }

  function unConfigService(dryRun = false): ConfigService {
    return new ConfigService({
      jobs: {
        majReferentielPlanAction: {
          dryRun,
          pourcentageDesactivationsMax: '10',
          nombreDesactivationsMin: '5'
        }
      }
    })
  }

  beforeEach(() => {
    const sandbox = createSandbox()
    gristClient = stubClass(GristClient)
    repository = stubInterface(sandbox)
    suiviJobService = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(uneDatetime())

    handler = new MajReferentielPlanActionJobHandler(
      gristClient,
      repository,
      suiviJobService,
      dateService,
      unConfigService()
    )
  })

  it('importe le référentiel et remonte les compteurs', async () => {
    // Given
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(success([solutionGrist]))
    repository.remplacer.resolves({
      nbCreees: 1,
      nbMisesAJour: 0,
      nbDesactivees: 0
    })

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(suiviJob.succes).to.equal(true)
    expect(suiviJob.resultat).to.deep.equal({
      dryRun: false,
      nbServices: 1,
      nbSolutions: 1,
      nbCreees: 1,
      nbMisesAJour: 0,
      nbDesactivees: 0,
      nbServicesNonResolus: 0,
      nbDoublonsServices: 0,
      nbDoublonsSolutions: 0,
      nbSolutionsEcartees: 0,
      nbValeursNonReconnues: 0
    })
    expect(repository.remplacer.firstCall.args[3]).to.deep.equal({
      dryRun: false
    })
  })

  it('échoue sans rien écrire quand la lecture des services échoue', async () => {
    // Given
    gristClient.recupererServices.resolves(
      failure(new ErreurHttp('grist ko', 502))
    )
    gristClient.recupererSolutions.resolves(success([solutionGrist]))

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(suiviJob.succes).to.equal(false)
    expect(repository.remplacer).not.to.have.been.called()
  })

  it('échoue sans rien écrire quand le Grist ne rend aucune solution', async () => {
    // Given
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(success([]))

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(suiviJob.succes).to.equal(false)
    expect(repository.remplacer).not.to.have.been.called()
  })

  it('échoue en nommant la vraie cause quand la réconciliation écarte toutes les solutions', async () => {
    // Given
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(
      success([{ id: 1, fields: { ...solutionGrist.fields, Type: 'Podcast' } }])
    )

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(suiviJob.succes).to.equal(false)
    expect(repository.remplacer).not.to.have.been.called()
    expect(suiviJob.erreur?.message).to.contain(
      'Aucune solution exploitable après réconciliation'
    )
    expect(
      (suiviJob.resultat as { nbSolutionsEcartees: number }).nbSolutionsEcartees
    ).to.equal(1)
  })

  it('appelle remplacer en dryRun sans rien changer côté lecture', async () => {
    // Given
    handler = new MajReferentielPlanActionJobHandler(
      gristClient,
      repository,
      suiviJobService,
      dateService,
      unConfigService(true)
    )
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(success([solutionGrist]))
    repository.remplacer.resolves({
      nbCreees: 1,
      nbMisesAJour: 0,
      nbDesactivees: 0
    })

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(repository.remplacer.firstCall.args[3]).to.deep.equal({
      dryRun: true
    })
    expect(suiviJob.succes).to.equal(true)
    expect((suiviJob.resultat as { dryRun: boolean }).dryRun).to.equal(true)
    expect((suiviJob.resultat as { nbCreees: number }).nbCreees).to.equal(1)
  })

  it('remonte les services non résolus dans le résultat', async () => {
    // Given
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(
      success([
        solutionGrist,
        {
          id: 2,
          fields: {
            ...solutionGrist.fields,
            Id_technique: 'p-3',
            Service: 'INCONNU'
          }
        }
      ])
    )
    repository.remplacer.resolves({
      nbCreees: 2,
      nbMisesAJour: 0,
      nbDesactivees: 0
    })

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(
      (suiviJob.resultat as { nbServicesNonResolus: number })
        .nbServicesNonResolus
    ).to.equal(1)
  })

  it('remonte les doublons de solutions dans le résultat', async () => {
    // Given
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(
      success([solutionGrist, { id: 2, fields: { ...solutionGrist.fields } }])
    )
    repository.remplacer.resolves({
      nbCreees: 1,
      nbMisesAJour: 0,
      nbDesactivees: 0
    })

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(
      (suiviJob.resultat as { nbDoublonsSolutions: number }).nbDoublonsSolutions
    ).to.equal(1)
  })

  it('renseigne erreur.message quand remplacer échoue, en préservant les compteurs', async () => {
    // Given
    gristClient.recupererServices.resolves(success([serviceGrist]))
    gristClient.recupererSolutions.resolves(success([solutionGrist]))
    repository.remplacer.rejects(new Error('Plafond de désactivations dépassé'))

    // When
    const suiviJob = await handler.handle(job)

    // Then
    expect(suiviJob.succes).to.equal(false)
    expect(suiviJob.erreur?.message).to.equal(
      'Plafond de désactivations dépassé'
    )
    expect(
      (suiviJob.resultat as { nbServices: number; nbSolutions: number })
        .nbServices
    ).to.equal(1)
    expect(
      (suiviJob.resultat as { nbServices: number; nbSolutions: number })
        .nbSolutions
    ).to.equal(1)
  })
})
