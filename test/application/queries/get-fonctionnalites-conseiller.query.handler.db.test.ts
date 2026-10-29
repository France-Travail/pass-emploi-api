import { ForbiddenException } from '@nestjs/common'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import { GetFonctionnalitesConseillerQueryHandler } from '../../../src/application/queries/get-fonctionnalites-conseiller.query.handler'
import { Core } from '../../../src/domain/core'
import { Deploiement } from '../../../src/domain/deploiement'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { DISPOSITIFS_ACCOMPAGNES } from '../../../src/domain/profil'
import { FonctionnaliteSqlRepository } from '../../../src/infrastructure/repositories/fonctionnalite.repository.db'
import { PopulationSqlRepository } from '../../../src/infrastructure/repositories/population.repository.db'
import { ConseillerSqlRepository } from '../../../src/infrastructure/repositories/conseiller-sql.repository.db'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { DeploiementSqlModel } from '../../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { FonctionnaliteSqlModel } from '../../../src/infrastructure/sequelize/models/fonctionnalite.sql-model'
import { PopulationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { DateService } from '../../../src/utils/date-service'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('GetFonctionnalitesConseillerQueryHandler (use case)', () => {
  const maintenant = DateTime.fromISO('2026-10-16T12:00:00.000Z')
  const hier = maintenant.minus({ days: 1 }).toJSDate()
  const demain = maintenant.plus({ days: 1 }).toJSDate()

  let handler: GetFonctionnalitesConseillerQueryHandler
  let dateService: StubbedClass<DateService>
  let jeuneRepository: StubbedType<Jeune.Repository>

  beforeEach(async () => {
    await getDatabase().cleanPG()
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    jeuneRepository = stubInterface(createSandbox())
    handler = new GetFonctionnalitesConseillerQueryHandler(
      new PopulationSqlRepository(getDatabase().sequelize),
      new FonctionnaliteSqlRepository(getDatabase().sequelize),
      dateService,
      new ConseillerAuthorizer(new ConseillerSqlRepository(), jeuneRepository)
    )

    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: 'conseillerCite',
        structure: Core.Structure.MILO,
        email: 'cite@milo.fr'
      }),
      unConseillerDto({
        id: 'conseillerHors',
        structure: Core.Structure.MILO,
        email: 'hors@milo.fr'
      })
    ])
    await FonctionnaliteSqlModel.bulkCreate([
      { id: 'DISPOSITIF_AUTRE' },
      { id: 'QCM' }
    ])
    await PopulationSqlModel.create({ id: 'PILOTE', description: null })
    await PopulationConseillerSqlModel.create({
      idPopulation: 'PILOTE',
      emailConseiller: 'cite@milo.fr'
    })
    await DeploiementSqlModel.bulkCreate([
      {
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'DISPOSITIF_AUTRE',
        dateActivation: hier
      },
      {
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE',
        idFonctionnalite: 'QCM',
        dateActivation: demain
      }
    ])
  })

  async function fonctionnalitesDe(idConseiller: string): Promise<string[]> {
    const result = await handler.execute(
      { idConseiller },
      unUtilisateurConseiller({ id: idConseiller })
    )
    expect(result._isSuccess).to.equal(true)
    return result._isSuccess ? result.data.fonctionnalites : []
  }

  it('est ouvert aux dispositifs accompagnés', () => {
    expect(handler.profilsAutorises).to.equal(DISPOSITIFS_ACCOMPAGNES)
  })

  it('renvoie les fonctionnalités déployées sur une population qui cite le conseiller', async () => {
    // When
    const fonctionnalites = await fonctionnalitesDe('conseillerCite')

    // Then
    expect(fonctionnalites).to.deep.equal(['DISPOSITIF_AUTRE'])
  })

  it('ne renvoie rien au conseiller hors de la population', async () => {
    // When
    const fonctionnalites = await fonctionnalitesDe('conseillerHors')

    // Then
    expect(fonctionnalites).to.deep.equal([])
  })

  it("interdit à un conseiller de lire les fonctionnalités d'un autre", async () => {
    // When
    const appel = handler.execute(
      { idConseiller: 'conseillerHors' },
      unUtilisateurConseiller({ id: 'conseillerCite' })
    )

    // Then
    await expect(appel).to.be.rejectedWith(ForbiddenException)
  })
})
