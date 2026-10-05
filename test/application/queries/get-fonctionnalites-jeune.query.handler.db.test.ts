import { ForbiddenException } from '@nestjs/common'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { GetFonctionnalitesJeuneQueryHandler } from '../../../src/application/queries/get-fonctionnalites-jeune.query.handler'
import { success } from '../../../src/building-blocks/types/result'
import { Core } from '../../../src/domain/core'
import { Deploiement } from '../../../src/domain/deploiement'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { Profil, TOUT_PROFIL_SAUF_INVITE } from '../../../src/domain/profil'
import { FonctionnaliteSqlRepository } from '../../../src/infrastructure/repositories/fonctionnalite.repository.db'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { DeploiementSqlModel } from '../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { DateService } from '../../../src/utils/date-service'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('GetFonctionnalitesJeuneQueryHandler (use case)', () => {
  const maintenant = DateTime.fromISO('2026-09-14T12:00:00.000Z')
  const hier = maintenant.minus({ days: 1 }).toJSDate()
  const demain = maintenant.plus({ days: 1 }).toJSDate()

  let handler: GetFonctionnalitesJeuneQueryHandler
  let dateService: StubbedClass<DateService>
  let jeuneRepository: StubbedType<Jeune.Repository>
  const jeuneUtilisateur = unUtilisateurJeune({ id: 'jeuneCite' })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    jeuneRepository = stubInterface(createSandbox())
    jeuneRepository.existe.resolves(true)
    handler = new GetFonctionnalitesJeuneQueryHandler(
      new FonctionnaliteSqlRepository(getDatabase().sequelize),
      dateService,
      new JeuneAuthorizer(jeuneRepository)
    )

    await ConseillerSqlModel.create(
      unConseillerDto({
        id: 'conseillerCite',
        structure: Core.Structure.POLE_EMPLOI,
        dispositif: Profil.Dispositif.AIJ,
        email: 'cite@ft.fr'
      })
    )
    await JeuneSqlModel.create(
      unJeuneDto({
        id: 'jeuneCite',
        idConseiller: 'conseillerCite',
        structure: Core.Structure.POLE_EMPLOI_AIJ
      })
    )
    await FonctionnaliteSqlModel.create({ id: 'PLAN_D_ACTION' })
    await PopulationSqlModel.create({ id: 'PILOTE', description: null })
    await PopulationConseillerSqlModel.create({
      idPopulation: 'PILOTE',
      emailConseiller: 'cite@ft.fr'
    })
    await DeploiementSqlModel.create({
      nature: Deploiement.Nature.FONCTIONNALITE,
      idPopulation: 'PILOTE',
      idFonctionnalite: 'PLAN_D_ACTION',
      dateActivation: hier
    })
  })

  async function fonctionnalitesDe(
    idJeune: string
  ): Promise<{ fonctionnalites: string[] }> {
    const result = await handler.execute(
      { idJeune },
      unUtilisateurJeune({ id: idJeune })
    )
    expect(result._isSuccess).to.equal(true)
    return result._isSuccess ? result.data : { fonctionnalites: [] }
  }

  it('est ouvert à tous les profils sauf invité', () => {
    expect(handler.profilsAutorises).to.equal(TOUT_PROFIL_SAUF_INVITE)
  })

  it('active une fonctionnalité déployée sur une population qui cite le conseiller', async () => {
    // When
    const result = await fonctionnalitesDe('jeuneCite')

    // Then
    expect(result.fonctionnalites).to.deep.equal(['PLAN_D_ACTION'])
  })

  it("n'active pas une fonctionnalité dont la date n'est pas atteinte", async () => {
    // Given
    await FonctionnaliteSqlModel.create({ id: 'QCM' })
    await DeploiementSqlModel.create({
      nature: Deploiement.Nature.FONCTIONNALITE,
      idPopulation: 'PILOTE',
      idFonctionnalite: 'QCM',
      dateActivation: demain
    })

    // When
    const result = await fonctionnalitesDe('jeuneCite')

    // Then
    expect(result.fonctionnalites).to.deep.equal(['PLAN_D_ACTION'])
  })

  it("renvoie une liste vide quand l'id jeune n'existe pas", async () => {
    // When
    const result = await handler.execute(
      { idJeune: 'id-inexistant' },
      unUtilisateurJeune({ id: 'id-inexistant' })
    )

    // Then
    expect(result).to.deep.equal(success({ fonctionnalites: [] }))
  })

  it("interdit à un jeune de lire les fonctionnalités d'un autre", async () => {
    // Given
    await JeuneSqlModel.create(
      unJeuneDto({
        id: 'autreJeune',
        idConseiller: 'conseillerCite',
        structure: Core.Structure.POLE_EMPLOI_AIJ
      })
    )

    // When
    const appel = handler.execute({ idJeune: 'autreJeune' }, jeuneUtilisateur)

    // Then
    await expect(appel).to.be.rejectedWith(ForbiddenException)
  })
})
