import { ForbiddenException } from '@nestjs/common'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import { GetCommunicationsConseillerQueryHandler } from '../../../src/application/queries/get-communications-conseiller.query.handler'
import { success } from '../../../src/building-blocks/types/result'
import { Communication } from '../../../src/domain/communication'
import { Core } from '../../../src/domain/core'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { DISPOSITIFS_ACCOMPAGNES, Profil } from '../../../src/domain/profil'
import { CommunicationSqlRepository } from '../../../src/infrastructure/repositories/communication.repository.db'
import { ConseillerSqlRepository } from '../../../src/infrastructure/repositories/conseiller-sql.repository.db'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { PopulationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { DateService } from '../../../src/utils/date-service'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('GetCommunicationsConseillerQueryHandler (use case)', () => {
  const maintenant = DateTime.fromISO('2026-10-01T12:00:00.000Z')
  const hier = maintenant.minus({ days: 1 }).toJSDate()
  const demain = maintenant.plus({ days: 1 }).toJSDate()
  const dansUneSemaine = maintenant.plus({ weeks: 1 }).toJSDate()

  let handler: GetCommunicationsConseillerQueryHandler
  let dateService: StubbedClass<DateService>
  let jeuneRepository: StubbedType<Jeune.Repository>
  const conseillerCite = unUtilisateurConseiller({ id: 'conseillerCite' })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    jeuneRepository = stubInterface(createSandbox())
    handler = new GetCommunicationsConseillerQueryHandler(
      new CommunicationSqlRepository(getDatabase().sequelize),
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
        id: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI,
        email: 'ftcej@ft.fr'
      }),
      unConseillerDto({
        id: 'conseillerHors',
        structure: Core.Structure.MILO,
        email: 'hors@milo.fr'
      })
    ])
    await PopulationSqlModel.bulkCreate([
      { id: 'PILOTE', description: null },
      { id: 'FT_CEJ', description: null }
    ])
    await PopulationConseillerSqlModel.create({
      idPopulation: 'PILOTE',
      emailConseiller: 'cite@milo.fr'
    })
    await PopulationProfilSqlModel.create({
      idPopulation: 'FT_CEJ',
      structure: Profil.Structure.FRANCE_TRAVAIL,
      dispositif: Profil.Dispositif.CEJ
    })
  })

  function uneCommunication(surcharge: {
    titre: string
    idPopulation?: string
    destinataire?: Communication.Destinataire
    type?: Communication.Type
    dateDebut?: Date
    dateFin?: Date
  }): {
    idPopulation: string
    destinataire: Communication.Destinataire
    type: Communication.Type
    dateDebut: Date
    dateFin: Date
    titre: string
    contenu: string
  } {
    return {
      idPopulation: 'PILOTE',
      destinataire: Communication.Destinataire.CONSEILLER,
      type: Communication.Type.IN_APP,
      dateDebut: hier,
      dateFin: demain,
      contenu: 'Contenu',
      ...surcharge
    }
  }

  async function communicationsDe(
    idConseiller: string
  ): Promise<{ id: number; titre: string; contenu: string } | undefined> {
    const result = await handler.execute(
      { idConseiller },
      unUtilisateurConseiller({ id: idConseiller })
    )
    expect(result._isSuccess).to.equal(true)
    return result._isSuccess ? result.data.messageInformatif : undefined
  }

  it('est ouvert aux dispositifs accompagnés', () => {
    expect(handler.profilsAutorises).to.equal(DISPOSITIFS_ACCOMPAGNES)
  })

  it('affiche au conseiller cité dans la population la communication en cours qui lui est destinée', async () => {
    // Given
    await CommunicationSqlModel.create(
      uneCommunication({ titre: 'Votre application évolue' })
    )

    // When
    const message = await communicationsDe('conseillerCite')

    // Then
    expect(message).to.deep.include({
      titre: 'Votre application évolue',
      contenu: 'Contenu'
    })
  })

  it('affiche la communication au conseiller dont le profil correspond à la population', async () => {
    // Given
    await CommunicationSqlModel.create(
      uneCommunication({ titre: 'Pour les FT CEJ', idPopulation: 'FT_CEJ' })
    )

    // When / Then
    expect(await communicationsDe('conseillerFtCej')).to.deep.include({
      titre: 'Pour les FT CEJ'
    })
    expect(await communicationsDe('conseillerCite')).to.equal(undefined)
  })

  it("n'affiche rien à un conseiller hors de toute population", async () => {
    // Given
    await CommunicationSqlModel.create(uneCommunication({ titre: 'Pilote' }))

    // When / Then
    expect(await communicationsDe('conseillerHors')).to.equal(undefined)
  })

  it("n'affiche pas une communication avant sa date de début ni à partir de sa date de fin", async () => {
    // Given
    await CommunicationSqlModel.bulkCreate([
      uneCommunication({
        titre: 'Prévue',
        dateDebut: demain,
        dateFin: dansUneSemaine
      }),
      uneCommunication({
        titre: 'Terminée',
        dateDebut: maintenant.minus({ weeks: 1 }).toJSDate(),
        dateFin: maintenant.toJSDate()
      })
    ])

    // When / Then
    expect(await communicationsDe('conseillerCite')).to.equal(undefined)
  })

  it("n'affiche ni les communications destinées aux jeunes ni les notifications", async () => {
    // Given
    await CommunicationSqlModel.bulkCreate([
      uneCommunication({
        titre: 'Pour les jeunes',
        destinataire: Communication.Destinataire.JEUNE
      }),
      uneCommunication({
        titre: 'Notification',
        type: Communication.Type.NOTIFICATION
      })
    ])

    // When / Then
    expect(await communicationsDe('conseillerCite')).to.equal(undefined)
  })

  it('affiche une seule communication à la fois : celle qui se termine le plus tôt', async () => {
    // Given
    await CommunicationSqlModel.bulkCreate([
      uneCommunication({ titre: 'Longue', dateFin: dansUneSemaine }),
      uneCommunication({ titre: 'Courte', dateFin: demain })
    ])

    // When / Then
    expect(await communicationsDe('conseillerCite')).to.deep.include({
      titre: 'Courte'
    })
  })

  it('renvoie un objet vide quand rien ne concerne le conseiller', async () => {
    // When
    const result = await handler.execute(
      { idConseiller: 'conseillerCite' },
      conseillerCite
    )

    // Then
    expect(result).to.deep.equal(success({}))
  })

  it("interdit à un conseiller de lire les communications d'un autre", async () => {
    // When
    const appel = handler.execute(
      { idConseiller: 'conseillerFtCej' },
      conseillerCite
    )

    // Then
    await expect(appel).to.be.rejectedWith(ForbiddenException)
  })
})
