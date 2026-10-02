import { ForbiddenException } from '@nestjs/common'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { GetCommunicationsJeuneQueryHandler } from '../../../src/application/queries/get-communications-jeune.query.handler'
import { success } from '../../../src/building-blocks/types/result'
import { Communication } from '../../../src/domain/communication'
import { Core } from '../../../src/domain/core'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { Profil, TOUT_PROFIL_SAUF_INVITE } from '../../../src/domain/profil'
import { CommunicationSqlRepository } from '../../../src/infrastructure/repositories/communication.repository.db'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { DateService } from '../../../src/utils/date-service'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('GetCommunicationsJeuneQueryHandler (use case)', () => {
  const maintenant = DateTime.fromISO('2026-10-01T12:00:00.000Z')
  const hier = maintenant.minus({ days: 1 }).toJSDate()
  const demain = maintenant.plus({ days: 1 }).toJSDate()
  const dansUneSemaine = maintenant.plus({ days: 7 }).toJSDate()

  let handler: GetCommunicationsJeuneQueryHandler
  let dateService: StubbedClass<DateService>
  let jeuneRepository: StubbedType<Jeune.Repository>
  const jeuneUtilisateur = unUtilisateurJeune({ id: 'jeuneDuConseillerCite' })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    jeuneRepository = stubInterface(createSandbox())
    jeuneRepository.existe.resolves(true)
    handler = new GetCommunicationsJeuneQueryHandler(
      new CommunicationSqlRepository(getDatabase().sequelize),
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
        id: 'jeuneDuConseillerCite',
        idConseiller: 'conseillerCite',
        structure: Core.Structure.POLE_EMPLOI_AIJ
      })
    )
    await PopulationSqlModel.create({ id: 'PILOTE', description: null })
    await PopulationConseillerSqlModel.create({
      idPopulation: 'PILOTE',
      emailConseiller: 'cite@ft.fr'
    })
  })

  function uneCommunicationJeune(surcharge: {
    titre: string
    idPopulation?: string
    type?: Communication.Type
    dateDebut?: Date
    dateFin?: Date | null
    ctaLabel?: string | null
    ctaUrlAndroid?: string | null
    ctaUrlIos?: string | null
  }): {
    idPopulation: string
    destinataire: Communication.Destinataire
    type: Communication.Type
    dateDebut: Date
    dateFin: Date | null
    titre: string
    contenu: string
    ctaLabel: string | null
    ctaUrlAndroid: string | null
    ctaUrlIos: string | null
  } {
    return {
      idPopulation: 'PILOTE',
      destinataire: Communication.Destinataire.JEUNE,
      type: Communication.Type.IN_APP,
      dateDebut: hier,
      dateFin: demain,
      contenu: 'Contenu',
      ctaLabel: null,
      ctaUrlAndroid: null,
      ctaUrlIos: null,
      ...surcharge
    }
  }

  async function communicationsDe(idJeune: string): Promise<{
    messageInformatif?: {
      id: number
      titre: string
      contenu: string
      cta?: { label: string; urlAndroid: string; urlIos: string }
    }
  }> {
    const result = await handler.execute(
      { idJeune },
      unUtilisateurJeune({ id: idJeune })
    )
    expect(result._isSuccess).to.equal(true)
    return result._isSuccess ? result.data : {}
  }

  it('est ouvert à tous les profils sauf invité', () => {
    expect(handler.profilsAutorises).to.equal(TOUT_PROFIL_SAUF_INVITE)
  })

  it('affiche au jeune dont le conseiller de référence est cité la communication en cours qui lui est destinée', async () => {
    // Given
    await CommunicationSqlModel.create(
      uneCommunicationJeune({ titre: 'Votre application évolue' })
    )

    // When
    const message = await communicationsDe('jeuneDuConseillerCite')

    // Then
    expect(message.messageInformatif).to.deep.include({
      titre: 'Votre application évolue',
      contenu: 'Contenu'
    })
  })

  it('affiche au jeune sans conseiller dont le profil est ciblé la communication qui lui est destinée', async () => {
    // Given
    await JeuneSqlModel.create(
      unJeuneDto({
        id: 'jeuneSansConseiller',
        idConseiller: undefined,
        structure: Core.Structure.FT_ESPACE_CANDIDAT
      })
    )
    await PopulationSqlModel.create({
      id: 'ESPACE_CANDIDAT',
      description: null
    })
    await PopulationProfilSqlModel.create({
      idPopulation: 'ESPACE_CANDIDAT',
      structure: Profil.Structure.FRANCE_TRAVAIL,
      dispositif: Profil.Dispositif.ESPACE_CANDIDAT
    })
    await CommunicationSqlModel.create(
      uneCommunicationJeune({
        titre: 'Pour l’Espace candidat',
        idPopulation: 'ESPACE_CANDIDAT'
      })
    )

    // When
    const message = await communicationsDe('jeuneSansConseiller')

    // Then
    expect(message.messageInformatif).to.deep.include({
      titre: 'Pour l’Espace candidat'
    })
  })

  it("n'affiche pas une communication avant sa date de début ni à partir de sa date de fin", async () => {
    // Given
    await CommunicationSqlModel.bulkCreate([
      uneCommunicationJeune({
        titre: 'Prévue',
        dateDebut: demain,
        dateFin: dansUneSemaine
      }),
      uneCommunicationJeune({
        titre: 'Terminée',
        dateDebut: maintenant.minus({ weeks: 1 }).toJSDate(),
        dateFin: maintenant.toJSDate()
      })
    ])

    // When / Then
    expect(await communicationsDe('jeuneDuConseillerCite')).to.deep.equal({})
  })

  it('affiche la communication dès sa date de début', async () => {
    // Given
    await CommunicationSqlModel.create(
      uneCommunicationJeune({
        titre: 'Disponible',
        dateDebut: maintenant.toJSDate(),
        dateFin: demain
      })
    )

    // When
    const message = await communicationsDe('jeuneDuConseillerCite')

    // Then
    expect(message.messageInformatif).to.deep.include({ titre: 'Disponible' })
  })

  it("n'affiche ni les communications destinées aux conseillers ni les notifications", async () => {
    // Given
    await CommunicationSqlModel.bulkCreate([
      {
        idPopulation: 'PILOTE',
        destinataire: Communication.Destinataire.CONSEILLER,
        type: Communication.Type.IN_APP,
        dateDebut: hier,
        dateFin: demain,
        titre: 'Pour les conseillers',
        contenu: 'Contenu'
      },
      uneCommunicationJeune({
        titre: 'Notification',
        type: Communication.Type.NOTIFICATION
      })
    ])

    // When / Then
    expect(await communicationsDe('jeuneDuConseillerCite')).to.deep.equal({})
  })

  it('affiche une seule communication à la fois : celle qui se termine le plus tôt', async () => {
    // Given
    await CommunicationSqlModel.bulkCreate([
      uneCommunicationJeune({ titre: 'Longue', dateFin: dansUneSemaine }),
      uneCommunicationJeune({ titre: 'Courte', dateFin: demain })
    ])

    // When
    const message = await communicationsDe('jeuneDuConseillerCite')

    // Then
    expect(message.messageInformatif).to.deep.include({ titre: 'Courte' })
  })

  it('affiche le cta quand la communication en a un', async () => {
    // Given
    await CommunicationSqlModel.create(
      uneCommunicationJeune({
        titre: 'Avec CTA',
        ctaLabel: 'Télécharger',
        ctaUrlAndroid: 'https://android',
        ctaUrlIos: 'https://ios'
      })
    )

    // When
    const message = await communicationsDe('jeuneDuConseillerCite')

    // Then
    expect(message.messageInformatif!.cta).to.deep.equal({
      label: 'Télécharger',
      urlAndroid: 'https://android',
      urlIos: 'https://ios'
    })
  })

  it('reste visible sans date de fin', async () => {
    // Given
    await CommunicationSqlModel.create(
      uneCommunicationJeune({ titre: 'Indéfinie', dateFin: null })
    )

    // When
    const message = await communicationsDe('jeuneDuConseillerCite')

    // Then
    expect(message.messageInformatif).to.deep.include({ titre: 'Indéfinie' })
  })

  it('priorise une communication avec une échéance sur une communication sans date de fin', async () => {
    // Given
    await CommunicationSqlModel.bulkCreate([
      uneCommunicationJeune({ titre: 'Indéfinie', dateFin: null }),
      uneCommunicationJeune({ titre: 'Urgente', dateFin: demain })
    ])

    // When
    const message = await communicationsDe('jeuneDuConseillerCite')

    // Then
    expect(message.messageInformatif).to.deep.include({ titre: 'Urgente' })
  })

  it("renvoie un objet vide quand il n'y a rien à afficher", async () => {
    // When
    const result = await handler.execute(
      { idJeune: 'jeuneDuConseillerCite' },
      jeuneUtilisateur
    )

    // Then
    expect(result).to.deep.equal(success({}))
  })

  it("interdit à un jeune de lire les communications d'un autre", async () => {
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
