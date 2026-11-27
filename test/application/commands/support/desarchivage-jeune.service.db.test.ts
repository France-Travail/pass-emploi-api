import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { before } from 'mocha'
import { createSandbox } from 'sinon'
import { DesarchivageJeuneService } from '../../../../src/application/commands/support/desarchivage-jeune.service.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import {
  failure,
  isSuccess
} from '../../../../src/building-blocks/types/result'
import { Action } from '../../../../src/domain/action/action'
import { ArchiveJeune } from '../../../../src/domain/archive-jeune'
import { Chat } from '../../../../src/domain/chat'
import { Core } from '../../../../src/domain/core'
import { CodeTypeRendezVous } from '../../../../src/domain/rendez-vous/rendez-vous'
import { ActionSqlModel } from '../../../../src/infrastructure/sequelize/models/action.sql-model'
import { ArchiveJeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/archive-jeune.sql-model'
import { CommentaireSqlModel } from '../../../../src/infrastructure/sequelize/models/commentaire.sql-model'
import { ConseillerSqlModel } from '../../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { FavoriOffreEmploiSqlModel } from '../../../../src/infrastructure/sequelize/models/favori-offre-emploi.sql-model'
import { FavoriOffreEngagementSqlModel } from '../../../../src/infrastructure/sequelize/models/favori-offre-engagement.sql-model'
import { FavoriOffreImmersionSqlModel } from '../../../../src/infrastructure/sequelize/models/favori-offre-immersion.sql-model'
import { JeuneSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { RechercheSqlModel } from '../../../../src/infrastructure/sequelize/models/recherche.sql-model'
import { RendezVousJeuneAssociationSqlModel } from '../../../../src/infrastructure/sequelize/models/rendez-vous-jeune-association.sql-model'
import { RendezVousSqlModel } from '../../../../src/infrastructure/sequelize/models/rendez-vous.sql-model'
import { Migration } from '../../../../src/domain/migration'
import { FirebaseClient } from '../../../../src/infrastructure/clients/firebase-client'
import { ConseillerSqlRepository } from '../../../../src/infrastructure/repositories/conseiller-sql.repository.db'
import { JeuneSqlRepository } from '../../../../src/infrastructure/repositories/jeune/jeune-sql.repository.db'
import { DateService } from '../../../../src/utils/date-service'
import { IdService } from '../../../../src/utils/id-service'
import { uneDatetime } from '../../../fixtures/date.fixture'
import { uneRecherche } from '../../../fixtures/recherche.fixture'
import { uneActionDto } from '../../../fixtures/sql-models/action.sql-model'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../../fixtures/sql-models/jeune.sql-model'
import { unRendezVousDto } from '../../../fixtures/sql-models/rendez-vous.sql-model'
import { expect, StubbedClass, stubClass } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'
import { Profil } from '../../../../src/domain/profil'

describe('DesarchivageJeuneService', () => {
  let databaseForTesting: DatabaseForTesting
  let service: DesarchivageJeuneService
  let chatRepository: StubbedType<Chat.Repository>

  const idJeune = 'jeune-archive'
  const idConseiller = 'conseiller-cible'
  let migrationService: StubbedClass<Migration.Service>

  const donnees: ArchiveJeune = {
    rendezVous: [
      {
        titre: 'RDV conseiller',
        sousTitre: 'avec Nils',
        modalite: 'En agence',
        date: new Date('2023-05-10T10:00:00.000Z'),
        duree: 30,
        type: CodeTypeRendezVous.ENTRETIEN_INDIVIDUEL_CONSEILLER,
        presenceConseiller: true
      },
      {
        titre: 'Atelier CV',
        sousTitre: 'collectif',
        date: new Date('2023-05-11T14:00:00.000Z'),
        duree: 60,
        type: CodeTypeRendezVous.ATELIER,
        presenceConseiller: true
      }
    ],
    actions: [
      {
        statut: 'in_progress',
        contenu: 'Faire mon CV',
        description: 'Avec le modèle fourni',
        dateCreation: new Date('2023-04-01T08:00:00.000Z'),
        dateActualisation: new Date('2023-04-02T08:00:00.000Z'),
        dateEcheance: new Date('2023-06-01T08:00:00.000Z'),
        creePar: 'JEUNE',
        commentaires: [
          {
            date: new Date('2023-04-03T08:00:00.000Z'),
            message: 'Bien avancé',
            creePar: 'CONSEILLER'
          }
        ]
      }
    ],
    favoris: {
      offresEmploi: [
        {
          id: 'offre-emploi-1',
          titre: 'Vendeur',
          typeContrat: 'CDI',
          localisation: { nom: 'Paris', codePostal: '75017', commune: '75117' }
        }
      ],
      offresImmersions: [
        {
          id: 'offre-immersion-1',
          metier: 'Boulanger',
          nomEtablissement: 'Paul',
          secteurActivite: 'Alimentaire',
          ville: 'Paris'
        }
      ],
      offresServiceCivique: [
        {
          id: 'offre-sc-1',
          domaine: 'solidarite',
          titre: 'Aide aux devoirs'
        }
      ]
    },
    recherches: [uneRecherche({ idJeune })],
    dernierConseiller: { nom: 'Tavernier', prenom: 'Nils' },
    historiqueConseillers: [],
    messages: [
      {
        contenu: 'coucou',
        date: '2023-05-01T10:00:00.000Z',
        envoyePar: 'JEUNE',
        type: 'MESSAGE'
      }
    ]
  }

  before(() => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()

    const sandbox = createSandbox()
    chatRepository = stubInterface<Chat.Repository>(sandbox)
    migrationService = stubClass(Migration.Service)
    migrationService.recupererMigrationDeLUtilisateur.resolves(undefined)
    service = new DesarchivageJeuneService(
      databaseForTesting.sequelize,
      chatRepository,
      new IdService(),
      migrationService,
      new JeuneSqlRepository(
        databaseForTesting.sequelize,
        stubClass(FirebaseClient),
        new IdService(),
        new DateService()
      ),
      new ConseillerSqlRepository()
    )

    await ConseillerSqlModel.creer(unConseillerDto({ id: idConseiller }))
  })

  async function creerArchive(
    args: Partial<{
      idJeune: string
      idConseiller?: string
      structure: Profil.Structure
      email: string | null
      donnees: ArchiveJeune | null
      idAuthentification: string | null
      nettoyageIdp: ArchiveJeune.EtapeNettoyageIdp | null
      nettoyageChat: ArchiveJeune.EtapeNettoyageChat | null
    }> = {}
  ): Promise<ArchiveJeuneSqlModel> {
    return ArchiveJeuneSqlModel.create({
      idJeune: args.idJeune ?? idJeune,
      idConseiller: args.idConseiller ?? null,
      motif: ArchiveJeune.MotifSuppressionSupport.SUPPORT,
      commentaire: 'Archivage support',
      prenom: 'John',
      nom: 'Doe',
      structure: args.structure ?? Profil.Structure.MILO,
      dispositif: Profil.Dispositif.CEJ,
      idStructureMilo: null,
      idPartenaire: '12345',
      dateCreation: new Date('2022-01-01T08:00:00.000Z'),
      datePremiereConnexion: new Date('2022-01-02T08:00:00.000Z'),
      dateDerniereConnexion: new Date('2023-05-15T08:00:00.000Z'),
      dateFinAccompagnement: null,
      email: args.email !== undefined ? args.email : 'john.doe@plop.io',
      dateArchivage: new Date('2023-06-01T08:00:00.000Z'),
      donnees: args.donnees !== undefined ? args.donnees : donnees,
      idAuthentification: args.idAuthentification ?? 'id-auth-archive',
      nettoyageIdp: args.nettoyageIdp ?? null,
      nettoyageChat: args.nettoyageChat ?? null
    })
  }

  describe('trouverLeConseiller', () => {
    it('refuse un conseiller encore dans une population de migration', async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({ id: 'conseiller-migre', email: 'migre@example.com' })
      )
      migrationService.recupererMigrationDeLUtilisateur.resolves({
        idPopulation: 'population-migration',
        dateActivation: uneDatetime()
      })

      // When
      const result = await service.trouverLeConseiller('migre@example.com')

      // Then
      expect(isSuccess(result)).to.be.false()
      expect(!isSuccess(result) && result.error.message).to.include(
        'population-migration'
      )
    })

    it('trouve le conseiller insensible à la casse', async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({
          id: 'conseiller-trouve',
          email: 'conseiller@example.com'
        })
      )

      // When
      const result = await service.trouverLeConseiller('CONSEILLER@EXAMPLE.COM')

      // Then
      expect(isSuccess(result)).to.be.true()
      expect(isSuccess(result) && result.data).to.equal('conseiller-trouve')
    })

    it('retourne NonTrouveError si aucun conseiller trouvé', async () => {
      // When
      const result = await service.trouverLeConseiller('inexistant@example.com')

      // Then
      expect(result).to.deep.equal(
        failure(
          new NonTrouveError(
            "Conseiller avec l'email",
            'inexistant@example.com'
          )
        )
      )
    })

    it('retourne MauvaiseCommandeError si deux conseillers ont le même email', async () => {
      // Given
      await ConseillerSqlModel.creer(
        unConseillerDto({
          id: 'conseiller-1',
          email: 'dupli@example.com',
          structure: Core.Structure.MILO
        })
      )
      await ConseillerSqlModel.creer(
        unConseillerDto({
          id: 'conseiller-2',
          email: 'dupli@example.com',
          structure: Core.Structure.POLE_EMPLOI
        })
      )

      // When
      const result = await service.trouverLeConseiller('dupli@example.com')

      // Then
      expect(isSuccess(result)).to.be.false()
      if (!isSuccess(result)) {
        expect(result.error).to.be.instanceOf(MauvaiseCommandeError)
        expect(result.error.message).to.include('conseiller-1')
        expect(result.error.message).to.include('conseiller-2')
      }
    })
  })

  describe('desarchiver', () => {
    describe("quand l'archive n'existe pas", () => {
      it('retourne une NonTrouveError', async () => {
        // When
        const result = await service.desarchiver(999, idConseiller)

        // Then
        expect(result).to.deep.equal(
          failure(new NonTrouveError('ArchiveJeune', '999'))
        )
      })
    })

    describe("quand le nettoyage de l'archive est en attente", () => {
      const messagesDuChatConserve: ArchiveJeune.Message[] = [
        {
          contenu: 'toujours dans Firebase',
          date: '2023-05-20T10:00:00.000Z',
          envoyePar: 'CONSEILLER',
          type: 'MESSAGE'
        }
      ]

      describe('en recréation', () => {
        it('conserve le chat non archivé en le rattachant au conseiller, sans rien restaurer', async () => {
          // Given
          const archive = await creerArchive({ nettoyageChat: 'A_ARCHIVER' })

          // When
          const result = await service.desarchiver(archive.id, idConseiller)

          // Then
          expect(
            chatRepository.transfererChat
          ).to.have.been.calledOnceWithExactly(idConseiller, [idJeune])
          expect(
            chatRepository.initializeChatIfNotExists
          ).to.have.been.calledOnceWithExactly(idJeune, idConseiller)
          expect(chatRepository.supprimerChat).not.to.have.been.called()
          expect(
            chatRepository.restaurerMessagesIndividuels
          ).not.to.have.been.called()
          expect(isSuccess(result) && result.data.messagesRestaures).to.equal(0)
        })

        it("termine la suppression d'un chat déjà archivé puis le restaure depuis l'archive", async () => {
          // Given
          const archive = await creerArchive({ nettoyageChat: 'A_SUPPRIMER' })

          // When
          const result = await service.desarchiver(archive.id, idConseiller)

          // Then
          expect(
            chatRepository.supprimerChat
          ).to.have.been.calledOnceWithExactly(idJeune)
          expect(chatRepository.supprimerChat).to.have.been.calledBefore(
            chatRepository.restaurerMessagesIndividuels
          )
          expect(
            chatRepository.restaurerMessagesIndividuels
          ).to.have.been.calledOnceWithExactly(
            idJeune,
            idConseiller,
            donnees.messages
          )
          expect(isSuccess(result) && result.data.messagesRestaures).to.equal(1)
        })

        it('annule le nettoyage restant pour ne pas toucher au jeune restauré', async () => {
          // Given
          const archive = await creerArchive({
            nettoyageIdp: 'A_REVOQUER',
            nettoyageChat: 'A_ARCHIVER'
          })

          // When
          await service.desarchiver(archive.id, idConseiller)

          // Then
          const archiveApres = await ArchiveJeuneSqlModel.findByPk(archive.id)
          expect(archiveApres?.nettoyageIdp).to.be.null()
          expect(archiveApres?.nettoyageChat).to.be.null()
        })

        it("reprend le compte IDP s'il n'a pas encore été révoqué", async () => {
          // Given
          const archive = await creerArchive({ nettoyageIdp: 'A_REVOQUER' })

          // When
          await service.desarchiver(archive.id, idConseiller)

          // Then
          const jeune = await JeuneSqlModel.findByPk(idJeune)
          expect(jeune?.idAuthentification).to.equal('id-auth-archive')
        })
      })

      describe('en fusion', () => {
        const idJeuneExistant = 'jeune-existant'

        beforeEach(async () => {
          await JeuneSqlModel.creer(
            unJeuneDto({
              id: idJeuneExistant,
              idConseiller,
              structure: Core.Structure.MILO,
              email: 'john.doe@plop.io'
            })
          )
        })

        it('reprend les messages du chat non archivé depuis Firebase', async () => {
          // Given
          const archive = await creerArchive({ nettoyageChat: 'A_ARCHIVER' })
          chatRepository.recupererMessagesAArchiver
            .withArgs(idJeune)
            .resolves(messagesDuChatConserve)

          // When
          const result = await service.desarchiver(archive.id, idConseiller)

          // Then
          expect(
            chatRepository.restaurerMessagesIndividuels
          ).to.have.been.calledOnceWithExactly(
            idJeuneExistant,
            idConseiller,
            messagesDuChatConserve
          )
          expect(chatRepository.supprimerChat).not.to.have.been.called()
          expect(isSuccess(result) && result.data.messagesRestaures).to.equal(1)
        })

        it("restaure depuis l'archive un chat déjà archivé", async () => {
          // Given
          const archive = await creerArchive({ nettoyageChat: 'A_SUPPRIMER' })

          // When
          await service.desarchiver(archive.id, idConseiller)

          // Then
          expect(
            chatRepository.recupererMessagesAArchiver
          ).not.to.have.been.called()
          expect(
            chatRepository.restaurerMessagesIndividuels
          ).to.have.been.calledOnceWithExactly(
            idJeuneExistant,
            idConseiller,
            donnees.messages
          )
        })

        it("laisse le nettoyage de l'ancien compte au cron", async () => {
          // Given
          const archive = await creerArchive({
            nettoyageIdp: 'A_REVOQUER',
            nettoyageChat: 'A_ARCHIVER'
          })

          // When
          await service.desarchiver(archive.id, idConseiller)

          // Then
          const archiveApres = await ArchiveJeuneSqlModel.findByPk(archive.id)
          expect(archiveApres?.nettoyageIdp).to.equal('A_REVOQUER')
          expect(archiveApres?.nettoyageChat).to.equal('A_ARCHIVER')
        })

        it("annule la révocation de l'authentification quand le compte existant porte la même", async () => {
          // Given
          await JeuneSqlModel.update(
            { idAuthentification: 'id-auth-archive' },
            { where: { id: idJeuneExistant } }
          )
          const archive = await creerArchive({ nettoyageIdp: 'A_REVOQUER' })

          // When
          await service.desarchiver(archive.id, idConseiller)

          // Then
          const archiveApres = await ArchiveJeuneSqlModel.findByPk(archive.id)
          expect(archiveApres?.nettoyageIdp).to.be.null()
        })
      })
    })

    describe('quand un jeune avec le même email existe déjà en base', () => {
      const idJeuneExistant = 'jeune-existant'
      const idConseillerExistant = 'conseiller-existant'

      beforeEach(async () => {
        await ConseillerSqlModel.creer(
          unConseillerDto({
            id: idConseillerExistant,
            email: 'autre.conseiller@example.com'
          })
        )
      })

      it('fusionne les données avec ce compte quand il est chez le conseiller cible', async () => {
        // Given
        const archive = await creerArchive()
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneExistant,
            idConseiller,
            structure: Core.Structure.MILO,
            email: 'john.doe@plop.io'
          })
        )

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result) && result.data.idJeune).to.equal(
          idJeuneExistant
        )
        expect(
          isSuccess(result) && result.data.fusionAvecCompteRecree
        ).to.equal(true)
        expect(await JeuneSqlModel.findByPk(idJeune)).to.be.null()

        const actions = await ActionSqlModel.findAll({
          where: { idJeune: idJeuneExistant }
        })
        expect(actions).to.have.length(1)
      })

      it("détecte le compte même si l'email de l'archive est en majuscules", async () => {
        // Given
        const archive = await creerArchive({ email: 'JOHN.DOE@PLOP.IO' })
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneExistant,
            idConseiller,
            structure: Core.Structure.MILO,
            email: 'john.doe@plop.io'
          })
        )

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result) && result.data.idJeune).to.equal(
          idJeuneExistant
        )
        expect(
          isSuccess(result) && result.data.fusionAvecCompteRecree
        ).to.equal(true)
      })

      it("détecte le compte dont l'email a une autre casse ou des espaces", async () => {
        // Given
        const archive = await creerArchive({ email: 'john.doe@plop.io' })
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneExistant,
            idConseiller,
            structure: Core.Structure.MILO,
            email: ' John.Doe@Plop.io '
          })
        )

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result) && result.data.idJeune).to.equal(
          idJeuneExistant
        )
      })

      it("reprend en accompagnement un compte non accompagné, comme à la création d'un jeune par un conseiller FT", async () => {
        // Given
        const idConseillerFT = 'conseiller-ft'
        await ConseillerSqlModel.creer(
          unConseillerDto({
            id: idConseillerFT,
            email: 'conseiller.ft@example.com',
            structure: Core.Structure.POLE_EMPLOI
          })
        )
        const archive = await creerArchive({
          structure: Profil.Structure.FRANCE_TRAVAIL
        })
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneExistant,
            idConseiller: undefined,
            structure: Core.Structure.FT_DEMANDEUR_D_EMPLOI,
            email: 'john.doe@plop.io',
            notificationsMessages: false,
            notificationsCreationActionConseiller: false
          })
        )

        // When
        const result = await service.desarchiver(archive.id, idConseillerFT)

        // Then
        expect(isSuccess(result) && result.data.rattacheAuConseiller).to.equal(
          true
        )
        const jeune = await JeuneSqlModel.findByPk(idJeuneExistant)
        expect(jeune?.idConseiller).to.equal(idConseillerFT)
        expect(jeune?.dispositif).to.equal(Profil.Dispositif.CEJ)
        expect(jeune?.notificationsMessages).to.be.true()
        expect(jeune?.notificationsCreationActionConseiller).to.be.true()
      })

      it("retourne MauvaiseCommandeError quand le conseiller n'est pas de la structure de l'archive", async () => {
        // Given
        const archive = await creerArchive({
          structure: Profil.Structure.FRANCE_TRAVAIL
        })

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(result).to.deep.equal(
          failure(
            new MauvaiseCommandeError(
              `Le conseiller ${idConseiller} est de structure MILO, incompatible avec l'archive (FRANCE_TRAVAIL)`
            )
          )
        )
        expect(await JeuneSqlModel.findByPk(idJeune)).to.be.null()
      })

      it('retourne MauvaiseCommandeError quand le compte existe chez un autre conseiller', async () => {
        // Given
        const archive = await creerArchive()
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneExistant,
            idConseiller: idConseillerExistant,
            structure: Core.Structure.MILO,
            email: 'john.doe@plop.io'
          })
        )

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result)).to.be.false()
        if (!isSuccess(result)) {
          expect(result.error).to.be.instanceOf(MauvaiseCommandeError)
        }
        const actions = await ActionSqlModel.findAll({
          where: { idJeune: idJeuneExistant }
        })
        expect(actions).to.have.length(0)
      })

      it('retourne MauvaiseCommandeError quand le compte existe dans une autre structure', async () => {
        // Given
        const archive = await creerArchive()
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneExistant,
            idConseiller,
            structure: Core.Structure.POLE_EMPLOI,
            email: 'john.doe@plop.io'
          })
        )

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result)).to.be.false()
        if (!isSuccess(result)) {
          expect(result.error).to.be.instanceOf(MauvaiseCommandeError)
        }
      })

      it('retourne MauvaiseCommandeError quand plusieurs comptes ont le même email', async () => {
        // Given
        const archive = await creerArchive()
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: 'jeune-1',
            idConseiller,
            structure: Core.Structure.MILO,
            email: 'john.doe@plop.io'
          })
        )
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: 'jeune-2',
            idConseiller,
            structure: Core.Structure.MILO,
            email: 'john.doe@plop.io'
          })
        )

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result)).to.be.false()
        if (!isSuccess(result)) {
          expect(result.error).to.be.instanceOf(MauvaiseCommandeError)
        }
      })
    })

    describe('quand la commande est valide', () => {
      let archive: ArchiveJeuneSqlModel

      beforeEach(async () => {
        archive = await creerArchive()
      })

      it('recrée le jeune rattaché au conseiller avec les métadonnées archivées', async () => {
        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result)).to.equal(true)
        const jeune = await JeuneSqlModel.findByPk(idJeune)
        expect(jeune?.nom).to.equal('Doe')
        expect(jeune?.prenom).to.equal('John')
        expect(jeune?.email).to.equal('john.doe@plop.io')
        expect(jeune?.idConseiller).to.equal(idConseiller)
        expect(jeune?.structure).to.equal(Core.Structure.MILO)
        expect(jeune?.dispositif).to.equal(Profil.Dispositif.CEJ)
        expect(jeune?.idPartenaire).to.equal('12345')
        expect(jeune?.dateDerniereConnexion).to.deep.equal(
          new Date('2023-05-15T08:00:00.000Z')
        )
        expect(jeune?.idAuthentification).to.be.null()
      })

      it('restaure les actions avec leurs commentaires', async () => {
        // When
        await service.desarchiver(archive.id, idConseiller)

        // Then
        const actions = await ActionSqlModel.findAll({ where: { idJeune } })
        expect(actions).to.have.length(1)
        expect(actions[0].contenu).to.equal('Faire mon CV')
        expect(actions[0].statut).to.equal('in_progress')
        expect(actions[0].idCreateur).to.equal(idJeune)
        expect(actions[0].typeCreateur).to.equal(Action.TypeCreateur.JEUNE)

        const commentaires = await CommentaireSqlModel.findAll({
          where: { idAction: actions[0].id }
        })
        expect(commentaires).to.have.length(1)
        expect(commentaires[0].message).to.equal('Bien avancé')
        expect(commentaires[0].createur.id).to.equal(idConseiller)
        expect(commentaires[0].createur.type).to.equal(
          Action.TypeCreateur.CONSEILLER
        )
      })

      it('restaure les rendez-vous individuels mais pas les animations collectives', async () => {
        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        const associations = await RendezVousJeuneAssociationSqlModel.findAll({
          where: { idJeune }
        })
        expect(associations).to.have.length(1)
        const rendezVous = await RendezVousSqlModel.findByPk(
          associations[0].idRendezVous
        )
        expect(rendezVous?.titre).to.equal('RDV conseiller')
        expect(rendezVous?.type).to.equal(
          CodeTypeRendezVous.ENTRETIEN_INDIVIDUEL_CONSEILLER
        )
        expect(rendezVous?.createur.id).to.equal(idConseiller)

        expect(isSuccess(result) && result.data.rendezVousRestaures).to.equal(1)
        expect(
          isSuccess(result) && result.data.animationsCollectivesNonRestaurees
        ).to.equal(1)
      })

      it('restaure les favoris et les recherches sauvegardées', async () => {
        // When
        await service.desarchiver(archive.id, idConseiller)

        // Then
        const favorisEmploi = await FavoriOffreEmploiSqlModel.findAll({
          where: { idJeune }
        })
        expect(favorisEmploi).to.have.length(1)
        expect(favorisEmploi[0].idOffre).to.equal('offre-emploi-1')

        const favorisImmersion = await FavoriOffreImmersionSqlModel.findAll({
          where: { idJeune }
        })
        expect(favorisImmersion).to.have.length(1)
        expect(favorisImmersion[0].idOffre).to.equal('offre-immersion-1')

        const favorisServiceCivique =
          await FavoriOffreEngagementSqlModel.findAll({ where: { idJeune } })
        expect(favorisServiceCivique).to.have.length(1)
        expect(favorisServiceCivique[0].idOffre).to.equal('offre-sc-1')

        const recherches = await RechercheSqlModel.findAll({
          where: { idJeune }
        })
        expect(recherches).to.have.length(1)
        expect(recherches[0].id).to.equal(donnees.recherches[0].id)
        expect(recherches[0].titre).to.equal(donnees.recherches[0].titre)
      })

      it('initialise le chat et retourne le résumé de la restauration', async () => {
        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(
          chatRepository.initializeChatIfNotExists
        ).to.have.been.calledOnceWithExactly(idJeune, idConseiller)
        expect(
          chatRepository.restaurerMessagesIndividuels
        ).to.have.been.calledOnceWithExactly(
          idJeune,
          idConseiller,
          donnees.messages
        )
        expect(isSuccess(result) && result.data).to.deep.equal({
          idJeune,
          fusionAvecCompteRecree: false,
          rattacheAuConseiller: false,
          actionsRestaurees: 1,
          rendezVousRestaures: 1,
          actionsIgnoreesDoublon: 0,
          rendezVousIgnoresDoublon: 0,
          animationsCollectivesNonRestaurees: 1,
          favorisRestaures: 3,
          recherchesRestaurees: 1,
          messagesRestaures: 1
        })
      })

      it('reste en succès avec 0 message restauré quand la restauration du chat échoue', async () => {
        // Given
        chatRepository.restaurerMessagesIndividuels.rejects(
          new Error('firebase KO')
        )

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result) && result.data.messagesRestaures).to.equal(0)
        const jeune = await JeuneSqlModel.findByPk(idJeune)
        expect(jeune).not.to.be.null()
      })

      it("conserve l'archive pour vérification", async () => {
        // When
        await service.desarchiver(archive.id, idConseiller)

        // Then
        const archiveApres = await ArchiveJeuneSqlModel.findByPk(archive.id)
        expect(archiveApres).not.to.be.null()
      })

      it('relancé sur une archive déjà restaurée, fusionne avec le jeune recréé sans rien dupliquer', async () => {
        // Given
        await service.desarchiver(archive.id, idConseiller)

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result) && result.data).to.deep.include({
          idJeune,
          fusionAvecCompteRecree: true,
          actionsRestaurees: 0,
          rendezVousRestaures: 0
        })
        expect(await ActionSqlModel.count({ where: { idJeune } })).to.equal(1)
        expect(await CommentaireSqlModel.count()).to.equal(1)
        expect(
          await RendezVousJeuneAssociationSqlModel.count({ where: { idJeune } })
        ).to.equal(1)
        expect(
          await FavoriOffreEmploiSqlModel.count({ where: { idJeune } })
        ).to.equal(1)
        expect(await RechercheSqlModel.count({ where: { idJeune } })).to.equal(
          1
        )
      })

      it('ne duplique pas une action déjà re-saisie sur le compte existant', async () => {
        // Given
        const idJeuneExistant = 'jeune-existant'
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneExistant,
            idConseiller,
            structure: Core.Structure.MILO,
            email: 'john.doe@plop.io'
          })
        )
        await ActionSqlModel.creer(
          uneActionDto({
            idJeune: idJeuneExistant,
            contenu: 'Faire mon CV',
            dateCreation: new Date('2026-01-05T08:00:00.000Z'),
            dateEcheance: new Date('2023-06-01T08:00:00.000Z')
          })
        )

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result) && result.data.actionsRestaurees).to.equal(0)
        expect(
          isSuccess(result) && result.data.actionsIgnoreesDoublon
        ).to.equal(1)
        const actions = await ActionSqlModel.findAll({
          where: { idJeune: idJeuneExistant }
        })
        expect(actions).to.have.length(1)
      })

      it('ne duplique pas un rendez-vous déjà re-saisi sur le compte existant', async () => {
        // Given
        const idJeuneExistant = 'jeune-existant'
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneExistant,
            idConseiller,
            structure: Core.Structure.MILO,
            email: 'john.doe@plop.io'
          })
        )
        const rendezVousDto = unRendezVousDto({
          date: new Date('2023-05-10T10:00:00.000Z'),
          type: CodeTypeRendezVous.ENTRETIEN_INDIVIDUEL_CONSEILLER
        })
        await RendezVousSqlModel.create(rendezVousDto)
        await RendezVousJeuneAssociationSqlModel.create({
          idRendezVous: rendezVousDto.id,
          idJeune: idJeuneExistant
        })

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result) && result.data.rendezVousRestaures).to.equal(0)
        expect(
          isSuccess(result) && result.data.rendezVousIgnoresDoublon
        ).to.equal(1)
        const associations = await RendezVousJeuneAssociationSqlModel.findAll({
          where: { idJeune: idJeuneExistant }
        })
        expect(associations).to.have.length(1)
      })

      it('ne duplique pas un favori déjà présent sur le compte existant', async () => {
        // Given
        const idJeuneExistant = 'jeune-existant'
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneExistant,
            idConseiller,
            structure: Core.Structure.MILO,
            email: 'john.doe@plop.io'
          })
        )
        await FavoriOffreEmploiSqlModel.create({
          idJeune: idJeuneExistant,
          idOffre: 'offre-emploi-1',
          titre: 'Vendeur',
          typeContrat: 'CDI',
          nomEntreprise: null,
          duree: null,
          isAlternance: null,
          nomLocalisation: null,
          codePostalLocalisation: null,
          communeLocalisation: null,
          dateCreation: new Date('2026-01-05T08:00:00.000Z'),
          dateCandidature: null,
          origineNom: null,
          origineLogoUrl: null
        })

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result)).to.equal(true)
        const favoris = await FavoriOffreEmploiSqlModel.findAll({
          where: { idJeune: idJeuneExistant }
        })
        expect(favoris).to.have.length(1)
      })
    })

    describe("quand l'archive ne contient que des données vides", () => {
      it("retourne MauvaiseCommandeError quand l'email est manquant", async () => {
        // Given
        const donneesVides: ArchiveJeune = {
          rendezVous: [],
          actions: [],
          favoris: {
            offresEmploi: [],
            offresImmersions: [],
            offresServiceCivique: []
          },
          recherches: [],
          dernierConseiller: { nom: '', prenom: '' },
          historiqueConseillers: [],
          messages: []
        }
        const archive = await creerArchive({
          donnees: donneesVides,
          email: null
        })

        // When
        const result = await service.desarchiver(archive.id, idConseiller)

        // Then
        expect(isSuccess(result)).to.be.false()
        if (!isSuccess(result)) {
          expect(result.error).to.be.instanceOf(MauvaiseCommandeError)
        }
        const jeune = await JeuneSqlModel.findByPk(idJeune)
        expect(jeune).to.be.null()
      })
    })
  })
})
