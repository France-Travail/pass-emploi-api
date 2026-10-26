import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { QueryTypes } from 'sequelize'
import { Sequelize } from 'sequelize-typescript'
import { Core } from '../../src/domain/core'
import { Chat, ChatIndividuel } from '../../src/domain/chat'
import { MigrationSqlRepository } from '../../src/infrastructure/repositories/migration.repository.db'
import { ArchiveJeuneSqlModel } from '../../src/infrastructure/sequelize/models/archive-jeune.sql-model'
import { ConseillerSqlModel } from '../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { DeploiementSqlModel } from '../../src/infrastructure/sequelize/models/deploiement.sql-model'
import { JeuneSqlModel } from '../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationConseillerSqlModel } from '../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationSqlModel } from '../../src/infrastructure/sequelize/models/population.sql-model'
import {
  etat,
  ID_POPULATION,
  nettoyer,
  semer
} from '../../src/scripts/population-fictive'
import { unConseillerDto } from '../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../fixtures/sql-models/jeune.sql-model'
import { createSandbox, expect } from '../utils'
import { getDatabase } from '../utils/database-for-testing'

describe('population-fictive (base)', () => {
  let sequelize: Sequelize
  let chatRepository: StubbedType<Chat.Repository>

  const idsCibles = [
    'demo-migr-000000',
    'demo-migr-000001',
    'demo-migr-000002',
    'demo-migr-000003'
  ]
  const idTemoin = 'demo-migr-temoin-000000'

  before(() => {
    sequelize = getDatabase().sequelize
  })

  beforeEach(async () => {
    await getDatabase().cleanPG()
    chatRepository = stubInterface(createSandbox())
    chatRepository.recupererConversationIndividuelle.resolves(undefined)
  })

  const idsJeunesEnBase = async (): Promise<string[]> =>
    (await JeuneSqlModel.findAll({ order: [['id', 'ASC']] })).map(
      jeune => jeune.id
    )

  const ciblesDeLArchivage = async (): Promise<string[]> =>
    (
      await new MigrationSqlRepository(
        sequelize
      ).getBeneficiairesAMigrerParProfilOuConseillerCite(ID_POPULATION)
    )
      .map(({ id }) => id)
      .sort((a, b) => a.localeCompare(b))

  const creerArchive = async (
    idJeune: string,
    colonnes: Partial<ArchiveJeuneSqlModel> = {}
  ): Promise<number> => {
    const archive = await ArchiveJeuneSqlModel.create({
      idJeune,
      prenom: 'Fictif',
      nom: 'Demo',
      motif: 'Migration',
      dateArchivage: new Date(),
      donnees: { messages: [] },
      ...colonnes
    })
    return archive.id
  }

  describe('semer', () => {
    it('cible les 4 jeunes fictifs par un déploiement MIGRATION, sans le témoin', async () => {
      // When
      await semer(sequelize, chatRepository, {})

      // Then
      expect(await idsJeunesEnBase()).to.deep.equal([...idsCibles, idTemoin])
      expect(await ciblesDeLArchivage()).to.deep.equal(idsCibles)
      const deploiement = await DeploiementSqlModel.findOne({
        where: { idPopulation: ID_POPULATION }
      })
      expect(deploiement?.nature).to.equal('MIGRATION')
    })

    it('rattache les jeunes à un conseiller fictif, avec leur id d’authentification', async () => {
      // When
      await semer(sequelize, chatRepository, {})

      // Then
      const jeune = await JeuneSqlModel.findByPk('demo-migr-000000')
      expect(jeune?.idConseiller).to.equal('demo-migr-conseiller')
      expect(jeune?.idAuthentification).to.equal('demo-migr-auth-000000')
      const temoin = await JeuneSqlModel.findByPk(idTemoin)
      expect(temoin?.idConseiller).to.equal('demo-migr-conseiller-temoin')
    })

    it('sème des jeunes inactifs par défaut', async () => {
      // When
      await semer(sequelize, chatRepository, {})

      // Then
      const [{ nb }] = await sequelize.query<{ nb: number }>(
        `SELECT count(*)::int AS nb FROM jeune
          WHERE date_derniere_activite IS NOT NULL OR date_derniere_connexion IS NOT NULL`,
        { type: QueryTypes.SELECT }
      )
      expect(nb).to.equal(0)
    })

    it('rend actifs les jeunes prévus avec --mails', async () => {
      // When
      await semer(sequelize, chatRepository, { mails: 'marie@exemple.fr' })

      // Then
      const jeune = await JeuneSqlModel.findByPk('demo-migr-000000')
      expect(jeune?.email).to.equal('marie+demo-migr-000000@exemple.fr')
      expect(jeune?.dateDerniereActivite).not.to.be.null()
      expect(jeune?.dateDerniereConnexion).not.to.be.null()
      const inactif = await JeuneSqlModel.findByPk('demo-migr-000002')
      expect(inactif?.dateDerniereConnexion).to.be.null()
    })

    it('sème un chat chiffré pour les jeunes prévus', async () => {
      // When
      await semer(sequelize, chatRepository, {})

      // Then
      expect(
        chatRepository.initializeChatIfNotExists.args.map(
          ([idJeune]) => idJeune
        )
      ).to.deep.equal(['demo-migr-000000', 'demo-migr-000002', idTemoin])
      expect(
        chatRepository.restaurerMessagesIndividuels
      ).to.have.been.calledWith('demo-migr-000000', 'demo-migr-conseiller')
      const messages =
        chatRepository.restaurerMessagesIndividuels.firstCall.args[2]
      expect(messages).to.have.length(3)
    })

    it('annule le semis si la population ciblerait un jeune réel', async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({
          id: 'homonyme-reel',
          email: 'demo-migr-conseiller@example.com'
        })
      )
      await JeuneSqlModel.creer(
        unJeuneDto({ id: 'jeune-reel', idConseiller: 'homonyme-reel' })
      )

      // When
      const promesse = semer(sequelize, chatRepository, {})

      // Then
      await expect(promesse).to.be.rejectedWith('jeune-reel')
      expect(await idsJeunesEnBase()).to.deep.equal(['jeune-reel'])
      expect(await PopulationSqlModel.count()).to.equal(0)
      expect(chatRepository.initializeChatIfNotExists).not.to.have.been.called()
    })

    it('est rejouable après un archivage', async () => {
      // Given
      await semer(sequelize, chatRepository, {})
      await JeuneSqlModel.destroy({ where: { id: 'demo-migr-000000' } })
      await creerArchive('demo-migr-000000')

      // When
      await semer(sequelize, chatRepository, {})

      // Then
      expect(await idsJeunesEnBase()).to.deep.equal([...idsCibles, idTemoin])
      expect(await ArchiveJeuneSqlModel.count()).to.equal(0)
      expect(chatRepository.supprimerChat).to.have.been.calledWith(
        'demo-migr-000000'
      )
    })

    describe('avec --email-conseiller (transfert temporaire)', () => {
      const emailConseiller = 'conseillere@exemple.fr'

      beforeEach(async () => {
        await ConseillerSqlModel.creer(
          unConseillerDto({
            id: 'conseillere-reelle',
            email: emailConseiller,
            structure: Core.Structure.POLE_EMPLOI
          })
        )
      })

      it('rattache les jeunes fictifs en transfert temporaire au conseiller de test', async () => {
        // When
        await semer(sequelize, chatRepository, { emailConseiller })

        // Then
        const jeune = await JeuneSqlModel.findByPk('demo-migr-000000')
        expect(jeune?.idConseiller).to.equal('conseillere-reelle')
        expect(jeune?.idConseillerInitial).to.equal('demo-migr-conseiller')
        expect(jeune?.structure).to.equal('FRANCE_TRAVAIL')
        expect(jeune?.dispositif).to.equal('CEJ')
      })

      it('crée le conseiller fictif et le cite dans la population, pas le conseiller de test', async () => {
        // When
        await semer(sequelize, chatRepository, { emailConseiller })

        // Then
        const conseillerFictif = await ConseillerSqlModel.findByPk(
          'demo-migr-conseiller'
        )
        expect(conseillerFictif).not.to.be.null()
        const citations = await PopulationConseillerSqlModel.findAll()
        expect(citations.map(c => c.emailConseiller)).to.deep.equal([
          'demo-migr-conseiller@example.com'
        ])
      })

      it('cible uniquement les jeunes fictifs, même si le conseiller de test suit des jeunes réels', async () => {
        // Given
        await JeuneSqlModel.creer(
          unJeuneDto({ id: 'jeune-reel', idConseiller: 'conseillere-reelle' })
        )

        // When
        await semer(sequelize, chatRepository, { emailConseiller })

        // Then
        expect(await ciblesDeLArchivage()).to.deep.equal(idsCibles)
        const jeuneReel = await JeuneSqlModel.findByPk('jeune-reel')
        expect(jeuneReel).not.to.be.null()
      })

      it('cible uniquement les jeunes fictifs, même si un jeune réel est en transfert temporaire chez le conseiller de test', async () => {
        // Given
        await ConseillerSqlModel.creer(unConseillerDto({ id: 'autre' }))
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: 'jeune-en-transfert-temporaire',
            idConseiller: 'conseillere-reelle',
            idConseillerInitial: 'autre'
          })
        )

        // When
        await semer(sequelize, chatRepository, { emailConseiller })

        // Then
        expect(await ciblesDeLArchivage()).to.deep.equal(idsCibles)
        const jeuneReel = await JeuneSqlModel.findByPk(
          'jeune-en-transfert-temporaire'
        )
        expect(jeuneReel).not.to.be.null()
      })

      it('refuse un conseiller inconnu', async () => {
        // When
        const promesse = semer(sequelize, chatRepository, {
          emailConseiller: 'inconnue@exemple.fr'
        })

        // Then
        await expect(promesse).to.be.rejectedWith('inconnue@exemple.fr')
        expect(await PopulationSqlModel.count()).to.equal(0)
      })

      it('refuse un email porté par plusieurs conseillers', async () => {
        // Given
        await ConseillerSqlModel.creer(
          unConseillerDto({ id: 'meme-email', email: emailConseiller })
        )

        // When
        const promesse = semer(sequelize, chatRepository, { emailConseiller })

        // Then
        await expect(promesse).to.be.rejectedWith('plusieurs')
        expect(await PopulationSqlModel.count()).to.equal(0)
      })
    })
  })

  describe('nettoyer', () => {
    beforeEach(async () => {
      await ConseillerSqlModel.creer(
        unConseillerDto({ id: 'conseiller-reel', email: 'reel@exemple.fr' })
      )
      await JeuneSqlModel.creer(
        unJeuneDto({ id: 'jeune-reel', idConseiller: 'conseiller-reel' })
      )
      await creerArchive('archive-reelle')
      await PopulationSqlModel.create({ id: 'population-reelle' })
      await DeploiementSqlModel.create({
        nature: 'MIGRATION',
        idPopulation: 'population-reelle',
        idFonctionnalite: null,
        dateActivation: new Date()
      })
    })

    it('supprime tout ce qui porte le préfixe et seulement ça', async () => {
      // Given
      await semer(sequelize, chatRepository, {})
      await JeuneSqlModel.destroy({ where: { id: 'demo-migr-000001' } })
      await creerArchive('demo-migr-000001')
      await creerArchive('demo-migr-000001')

      // When
      await nettoyer(sequelize, chatRepository)

      // Then
      expect(await idsJeunesEnBase()).to.deep.equal(['jeune-reel'])
      expect(
        (await ArchiveJeuneSqlModel.findAll()).map(({ idJeune }) => idJeune)
      ).to.deep.equal(['archive-reelle'])
      expect(
        (await ConseillerSqlModel.findAll()).map(({ id }) => id)
      ).to.deep.equal(['conseiller-reel'])
      expect(
        (await PopulationSqlModel.findAll()).map(({ id }) => id)
      ).to.deep.equal(['population-reelle'])
      expect(await DeploiementSqlModel.count()).to.equal(1)
    })

    it('supprime les chats des jeunes fictifs, en base ou archivés', async () => {
      // Given
      await creerArchive('demo-migr-000042')

      // When
      await nettoyer(sequelize, chatRepository)

      // Then
      const ids = chatRepository.supprimerChat.args
        .map(([id]) => id)
        .sort((a, b) => a.localeCompare(b))
      expect(ids).to.deep.equal([
        'demo-migr-000000',
        'demo-migr-000001',
        'demo-migr-000002',
        'demo-migr-000003',
        'demo-migr-000042',
        idTemoin
      ])
    })

    it('garde un conseiller fictif qui suit un jeune réel', async () => {
      // Given
      await semer(sequelize, chatRepository, {})
      await JeuneSqlModel.update(
        { idConseiller: 'demo-migr-conseiller' },
        { where: { id: 'jeune-reel' } }
      )

      // When
      const bilan = await nettoyer(sequelize, chatRepository)

      // Then
      expect(await idsJeunesEnBase()).to.deep.equal(['jeune-reel'])
      expect(
        await ConseillerSqlModel.findByPk('demo-migr-conseiller')
      ).not.to.be.null()
      expect(bilan.conseillersGardes).to.deep.equal(['demo-migr-conseiller'])
    })

    it('ne supprime jamais un conseiller de test, même après semis avec --email-conseiller', async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({
          id: 'conseillere-test',
          email: 'test@exemple.fr',
          structure: Core.Structure.POLE_EMPLOI
        })
      )
      await semer(sequelize, chatRepository, {
        emailConseiller: 'test@exemple.fr'
      })

      // When
      const bilan = await nettoyer(sequelize, chatRepository)

      // Then
      expect(
        await ConseillerSqlModel.findByPk('conseillere-test')
      ).not.to.be.null()
      expect(bilan.conseillersGardes).to.deep.equal([])
    })

    it('ne supprime pas les jeunes réels du conseiller de test après semis avec --email-conseiller', async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({
          id: 'conseillere-test',
          email: 'test@exemple.fr'
        })
      )
      await JeuneSqlModel.update(
        { idConseiller: 'conseillere-test' },
        { where: { id: 'jeune-reel' } }
      )
      await semer(sequelize, chatRepository, {
        emailConseiller: 'test@exemple.fr'
      })

      // When
      await nettoyer(sequelize, chatRepository)

      // Then
      expect(await idsJeunesEnBase()).to.deep.equal(['jeune-reel'])
      const jeuneReel = await JeuneSqlModel.findByPk('jeune-reel')
      expect(jeuneReel?.idConseiller).to.equal('conseillere-test')
    })
  })

  describe('etat', () => {
    it('dit pour chaque jeune fictif s’il est en base ou archivé, et où en est le nettoyage', async () => {
      // Given
      await semer(sequelize, chatRepository, {})
      await JeuneSqlModel.destroy({ where: { id: 'demo-migr-000000' } })
      const idArchive = await creerArchive('demo-migr-000000', {
        nettoyageIdp: null,
        nettoyageChat: 'A_SUPPRIMER',
        donnees: {
          messages: [{}, {}, {}]
        } as unknown as ArchiveJeuneSqlModel['donnees']
      })
      chatRepository.recupererConversationIndividuelle
        .withArgs('demo-migr-000000')
        .resolves({ id: 'chat-1' } as ChatIndividuel)

      // When
      const resultat = await etat(sequelize, chatRepository)

      // Then
      expect(resultat.jeunes[0]).to.deep.equal({
        id: 'demo-migr-000000',
        enBase: false,
        archives: [
          {
            id: idArchive,
            nettoyageIdp: null,
            nettoyageChat: 'A_SUPPRIMER',
            nbMessages: 3
          }
        ],
        chatFirestore: true
      })
      expect(resultat.jeunes[1]).to.deep.equal({
        id: 'demo-migr-000001',
        enBase: true,
        archives: [],
        chatFirestore: false
      })
      expect(resultat.ciblesHorsPrefixe).to.deep.equal([])
    })

    it('reste juste après un désarchivage puis un réarchivage', async () => {
      // Given
      await semer(sequelize, chatRepository, {})
      const premiere = await creerArchive('demo-migr-000003')
      const seconde = await creerArchive('demo-migr-000003', {
        nettoyageIdp: 'A_REVOQUER',
        nettoyageChat: 'A_ARCHIVER'
      })

      // When
      const resultat = await etat(sequelize, chatRepository)

      // Then
      const jeune = resultat.jeunes.find(({ id }) => id === 'demo-migr-000003')
      expect(jeune?.enBase).to.be.true()
      expect(jeune?.archives.map(({ id }) => id)).to.deep.equal([
        premiere,
        seconde
      ])
      expect(jeune?.archives[1].nettoyageIdp).to.equal('A_REVOQUER')
    })

    it('signale un jeune réel ciblé par la population (si manipulation manuelle)', async () => {
      // Given
      await semer(sequelize, chatRepository, {})
      await JeuneSqlModel.creer(
        unJeuneDto({ id: 'jeune-reel', idConseiller: 'demo-migr-conseiller' })
      )

      // When
      const resultat = await etat(sequelize, chatRepository)

      // Then
      expect(resultat.ciblesHorsPrefixe).to.deep.equal(['jeune-reel'])
    })

    it('ne signale pas un jeune réel du conseiller de test avec --email-conseiller', async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({ id: 'conseillere-test', email: 'test@exemple.fr' })
      )
      await JeuneSqlModel.creer(
        unJeuneDto({ id: 'jeune-reel', idConseiller: 'conseillere-test' })
      )
      await semer(sequelize, chatRepository, {
        emailConseiller: 'test@exemple.fr'
      })

      // When
      const resultat = await etat(sequelize, chatRepository)

      // Then
      expect(resultat.ciblesHorsPrefixe).to.deep.equal([])
    })
  })
})
