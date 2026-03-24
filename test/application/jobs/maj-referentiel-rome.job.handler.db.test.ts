import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { failure, success } from 'src/building-blocks/types/result'
import { ErreurHttp } from 'src/building-blocks/types/domain-error'
import { MajReferentielRomeJobHandler } from 'src/application/jobs/maj-referentiel-rome.job.handler.db'
import { Planificateur } from 'src/domain/planificateur'
import { SuiviJob } from 'src/domain/suivi-job'
import { PoleEmploiClient } from 'src/infrastructure/clients/pole-emploi-client'
import { MetierRomeSqlModel } from 'src/infrastructure/sequelize/models/metier-rome.sql-model'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { unMetierRomeDto } from 'test/fixtures/sql-models/metier-rome.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('MajReferentielRomeJobHandler', () => {
  let handler: MajReferentielRomeJobHandler
  let poleEmploiClient: StubbedClass<PoleEmploiClient>
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>

  const maintenant = uneDatetime()
  const unJob: Planificateur.Job<void> = {
    dateExecution: maintenant.toJSDate(),
    type: Planificateur.JobType.MAJ_REFERENTIEL_ROME
  }

  beforeEach(async () => {
    await getDatabase().cleanPG()
    const sandbox = createSandbox()
    poleEmploiClient = stubClass(PoleEmploiClient)
    dateService = stubClass(DateService)
    suiviJobService = stubInterface(sandbox)

    dateService.now.returns(maintenant)

    handler = new MajReferentielRomeJobHandler(
      poleEmploiClient,
      getDatabase().sequelize,
      suiviJobService,
      dateService
    )
  })

  describe('handle', () => {
    describe('quand les deux APIs répondent avec succès', () => {
      it('remplace toutes les entrées de la table et retourne le nombre de métiers mis à jour', async () => {
        // Given
        await MetierRomeSqlModel.create(unMetierRomeDto({ id: 1 }))

        poleEmploiClient.getAppellationsRome.resolves(
          success([
            {
              code: '10438',
              libelle: "Agent / Agente de destruction d'insectes"
            },
            { code: '10439', libelle: 'Brasseur / Brasseuse de bière' }
          ])
        )
        poleEmploiClient.getMetiersRomeApi.resolves(
          success([
            { code: 'A1413', libelle: 'Brasseur / Brasseuse de bière' },
            { code: 'A1414', libelle: 'Horticulteur / Horticultrice' }
          ])
        )

        // When
        const result = await handler.handle(unJob)

        // Then
        expect(result.succes).to.be.true()
        expect(result.resultat).to.deep.equal({ nbMetiersMaj: 3 })

        const enregistres = await MetierRomeSqlModel.findAll({
          order: [['id', 'ASC']]
        })
        expect(enregistres).to.have.length(3)

        expect(enregistres[0].code).to.equal('A1413')
        expect(enregistres[0].libelle).to.equal('Brasseur / Brasseuse de bière')
        expect(enregistres[0].appellationCode).to.equal('10439')

        expect(enregistres[1].code).to.equal('A1414')
        expect(enregistres[1].libelle).to.equal('Horticulteur / Horticultrice')
        expect(enregistres[1].appellationCode).to.equal(null)

        expect(enregistres[2].code).to.equal('10438')
        expect(enregistres[2].libelle).to.equal(
          "Agent / Agente de destruction d'insectes"
        )
        expect(enregistres[2].appellationCode).to.equal('10438')
      })

      it('nettoie libelle_sanitized en retirant les accents', async () => {
        // Given
        poleEmploiClient.getAppellationsRome.resolves(success([]))
        poleEmploiClient.getMetiersRomeApi.resolves(
          success([{ code: 'A1414', libelle: 'Horticulteur / Horticultrice' }])
        )

        // When
        await handler.handle(unJob)

        // Then
        const enregistre = await MetierRomeSqlModel.findOne()
        expect(enregistre!.libelleSanitized).to.equal(
          'Horticulteur / Horticultrice'
        )
      })
    })

    describe("quand l'API appellations échoue", () => {
      it('retourne succes false sans modifier la table', async () => {
        // Given
        await MetierRomeSqlModel.create(unMetierRomeDto({ id: 1 }))

        poleEmploiClient.getAppellationsRome.resolves(
          failure(new ErreurHttp('Erreur API', 500))
        )
        poleEmploiClient.getMetiersRomeApi.resolves(
          success([{ code: 'A1413', libelle: 'Brasseur / Brasseuse de bière' }])
        )

        // When
        const result = await handler.handle(unJob)

        // Then
        expect(result.succes).to.equal(false)
        expect(result.nbErreurs).to.equal(1)
        const count = await MetierRomeSqlModel.count()
        expect(count).to.equal(1)
      })
    })

    describe("quand l'API métiers échoue", () => {
      it('retourne succes false sans modifier la table', async () => {
        // Given
        await MetierRomeSqlModel.create(unMetierRomeDto({ id: 1 }))

        poleEmploiClient.getAppellationsRome.resolves(
          success([
            {
              code: '10438',
              libelle: "Agent / Agente de destruction d'insectes"
            }
          ])
        )
        poleEmploiClient.getMetiersRomeApi.resolves(
          failure(new ErreurHttp('Erreur API', 500))
        )

        // When
        const result = await handler.handle(unJob)

        // Then
        expect(result.succes).to.equal(false)
        expect(result.nbErreurs).to.equal(1)
        const count = await MetierRomeSqlModel.count()
        expect(count).to.equal(1)
      })
    })
  })
})
