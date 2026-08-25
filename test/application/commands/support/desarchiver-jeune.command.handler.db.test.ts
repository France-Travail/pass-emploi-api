import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { before } from 'mocha'
import { createSandbox } from 'sinon'
import {
  DesarchiverJeuneCommand,
  DesarchiverJeuneCommandHandler
} from '../../../../src/application/commands/support/desarchiver-jeune.command.handler.db'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
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
import { IdService } from '../../../../src/utils/id-service'
import { uneRecherche } from '../../../fixtures/recherche.fixture'
import { uneActionDto } from '../../../fixtures/sql-models/action.sql-model'
import { unConseillerDto } from '../../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../../fixtures/sql-models/jeune.sql-model'
import { unRendezVousDto } from '../../../fixtures/sql-models/rendez-vous.sql-model'
import { expect } from '../../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../../utils/database-for-testing'
import { Profil } from '../../../../src/domain/profil'

describe('DesarchiverJeuneCommandHandler', () => {
  let databaseForTesting: DatabaseForTesting
  let handler: DesarchiverJeuneCommandHandler
  let chatRepository: StubbedType<Chat.Repository>

  const idJeune = 'jeune-archive'
  const idConseiller = 'conseiller-cible'

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
    handler = new DesarchiverJeuneCommandHandler(
      databaseForTesting.sequelize,
      chatRepository,
      new IdService()
    )

    await ConseillerSqlModel.creer(unConseillerDto({ id: idConseiller }))
  })

  async function creerArchive(
    args: Partial<{
      idJeune: string
      email: string | null
      donnees: ArchiveJeune | null
    }> = {}
  ): Promise<ArchiveJeuneSqlModel> {
    return ArchiveJeuneSqlModel.create({
      idJeune: args.idJeune ?? idJeune,
      motif: ArchiveJeune.MotifSuppressionSupport.SUPPORT,
      commentaire: 'Archivage support',
      prenom: 'John',
      nom: 'Doe',
      structure: Core.Structure.MILO,
      dispositif: Profil.Dispositif.CEJ,
      idStructureMilo: null,
      idPartenaire: '12345',
      dateCreation: new Date('2022-01-01T08:00:00.000Z'),
      datePremiereConnexion: new Date('2022-01-02T08:00:00.000Z'),
      dateFinAccompagnement: null,
      email: args.email !== undefined ? args.email : 'john.doe@plop.io',
      dateArchivage: new Date('2023-06-01T08:00:00.000Z'),
      donnees: args.donnees !== undefined ? args.donnees : donnees
    })
  }

  describe('authorize', () => {
    it('autorise : le profil support est déjà garanti par profilsAutorises', async () => {
      // When
      const result = await handler.authorize()

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })

  describe('handle', () => {
    describe("quand l'archive n'existe pas", () => {
      it('retourne une NonTrouveError', async () => {
        // When
        const result = await handler.handle({ idArchive: 999, idConseiller })

        // Then
        expect(result).to.deep.equal(
          failure(new NonTrouveError('ArchiveJeune', '999'))
        )
      })
    })

    describe('quand le jeune existe déjà en base', () => {
      it('retourne une MauvaiseCommandeError', async () => {
        // Given
        const archive = await creerArchive()
        await JeuneSqlModel.creer(unJeuneDto({ id: idJeune, idConseiller }))

        // When
        const result = await handler.handle({
          idArchive: archive.id,
          idConseiller
        })

        // Then
        expect(result).to.deep.equal(
          failure(
            new MauvaiseCommandeError(`Le jeune ${idJeune} existe déjà en base`)
          )
        )
      })
    })

    describe("quand le conseiller n'existe pas", () => {
      it('retourne une NonTrouveError', async () => {
        // Given
        const archive = await creerArchive()

        // When
        const result = await handler.handle({
          idArchive: archive.id,
          idConseiller: 'inconnu'
        })

        // Then
        expect(result).to.deep.equal(
          failure(new NonTrouveError('Conseiller', 'inconnu'))
        )
        const jeune = await JeuneSqlModel.findByPk(idJeune)
        expect(jeune).to.be.null()
      })
    })

    describe('quand ni idConseiller ni idJeuneRecree ne sont fournis', () => {
      it('retourne une MauvaiseCommandeError', async () => {
        // Given
        const archive = await creerArchive()

        // When
        const result = await handler.handle({ idArchive: archive.id })

        // Then
        expect(result).to.deep.equal(
          failure(
            new MauvaiseCommandeError(
              'Renseigner idConseiller pour recréer le jeune, ou idJeuneRecree pour fusionner avec un compte existant'
            )
          )
        )
      })
    })

    describe('quand le jeune s’est recréé un compte (fusion)', () => {
      const idJeuneRecree = 'jeune-recree'
      const idConseillerRecree = 'conseiller-recree'
      let archive: ArchiveJeuneSqlModel
      let command: DesarchiverJeuneCommand

      beforeEach(async () => {
        // Given
        await ConseillerSqlModel.creer(
          unConseillerDto({
            id: idConseillerRecree,
            email: 'conseiller.recree@passemploi.com',
            idAuthentification: 'id-auth-conseiller-recree'
          })
        )
        await JeuneSqlModel.creer(
          unJeuneDto({
            id: idJeuneRecree,
            idConseiller: idConseillerRecree,
            structure: Core.Structure.MILO,
            idAuthentification: 'nouvel-id-authentification'
          })
        )
        archive = await creerArchive()
        command = { idArchive: archive.id, idJeuneRecree }
      })

      it('rattache les données au compte recréé sans recréer le jeune archivé', async () => {
        // When
        const result = await handler.handle(command)

        // Then
        expect(isSuccess(result) && result.data.idJeune).to.equal(idJeuneRecree)
        expect(
          isSuccess(result) && result.data.fusionAvecCompteRecree
        ).to.equal(true)
        expect(await JeuneSqlModel.findByPk(idJeune)).to.be.null()

        const actions = await ActionSqlModel.findAll({
          where: { idJeune: idJeuneRecree }
        })
        expect(actions).to.have.length(1)
        expect(actions[0].idCreateur).to.equal(idJeuneRecree)

        const associations = await RendezVousJeuneAssociationSqlModel.findAll({
          where: { idJeune: idJeuneRecree }
        })
        expect(associations).to.have.length(1)

        const recherches = await RechercheSqlModel.findAll({
          where: { idJeune: idJeuneRecree }
        })
        expect(recherches).to.have.length(1)
      })

      it("préserve l'identité et l'authentification du compte recréé", async () => {
        // When
        await handler.handle(command)

        // Then
        const jeuneRecree = await JeuneSqlModel.findByPk(idJeuneRecree)
        expect(jeuneRecree?.idAuthentification).to.equal(
          'nouvel-id-authentification'
        )
        expect(jeuneRecree?.idConseiller).to.equal(idConseillerRecree)
      })

      it('restaure le chat sur le conseiller du compte recréé', async () => {
        // When
        await handler.handle(command)

        // Then
        expect(
          chatRepository.initializeChatIfNotExists
        ).to.have.been.calledOnceWithExactly(idJeuneRecree, idConseillerRecree)
        expect(
          chatRepository.restaurerMessagesIndividuels
        ).to.have.been.calledOnceWithExactly(
          idJeuneRecree,
          idConseillerRecree,
          donnees.messages
        )
      })

      it('ne duplique pas une action déjà re-saisie sur le compte recréé', async () => {
        // Given : même contenu et même échéance, re-saisie après l'archivage
        await ActionSqlModel.creer(
          uneActionDto({
            idJeune: idJeuneRecree,
            contenu: 'Faire mon CV',
            dateCreation: new Date('2026-01-05T08:00:00.000Z'),
            dateEcheance: new Date('2023-06-01T08:00:00.000Z')
          })
        )

        // When
        const result = await handler.handle(command)

        // Then
        expect(isSuccess(result) && result.data.actionsRestaurees).to.equal(0)
        expect(
          isSuccess(result) && result.data.actionsIgnoreesDoublon
        ).to.equal(1)
        const actions = await ActionSqlModel.findAll({
          where: { idJeune: idJeuneRecree }
        })
        expect(actions).to.have.length(1)
      })

      it('ne duplique pas un rendez-vous déjà re-saisi sur le compte recréé', async () => {
        // Given : même date et même type que le rendez-vous archivé
        const rendezVousDto = unRendezVousDto({
          date: new Date('2023-05-10T10:00:00.000Z'),
          type: CodeTypeRendezVous.ENTRETIEN_INDIVIDUEL_CONSEILLER
        })
        await RendezVousSqlModel.create(rendezVousDto)
        await RendezVousJeuneAssociationSqlModel.create({
          idRendezVous: rendezVousDto.id,
          idJeune: idJeuneRecree
        })

        // When
        const result = await handler.handle(command)

        // Then
        expect(isSuccess(result) && result.data.rendezVousRestaures).to.equal(0)
        expect(
          isSuccess(result) && result.data.rendezVousIgnoresDoublon
        ).to.equal(1)
        const associations = await RendezVousJeuneAssociationSqlModel.findAll({
          where: { idJeune: idJeuneRecree }
        })
        expect(associations).to.have.length(1)
      })

      it('ne duplique pas un favori déjà présent sur le compte recréé', async () => {
        // Given
        await FavoriOffreEmploiSqlModel.create({
          idJeune: idJeuneRecree,
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
        const result = await handler.handle(command)

        // Then
        expect(isSuccess(result)).to.equal(true)
        const favoris = await FavoriOffreEmploiSqlModel.findAll({
          where: { idJeune: idJeuneRecree }
        })
        expect(favoris).to.have.length(1)
      })

      it("retourne une NonTrouveError quand le compte recréé n'existe pas", async () => {
        // When
        const result = await handler.handle({
          idArchive: archive.id,
          idJeuneRecree: 'inconnu'
        })

        // Then
        expect(result).to.deep.equal(
          failure(new NonTrouveError('Jeune', 'inconnu'))
        )
      })

      it('retourne une MauvaiseCommandeError quand la structure du compte recréé diffère', async () => {
        // Given
        await JeuneSqlModel.update(
          { structure: Core.Structure.POLE_EMPLOI },
          { where: { id: idJeuneRecree } }
        )

        // When
        const result = await handler.handle(command)

        // Then
        expect(result).to.deep.equal(
          failure(
            new MauvaiseCommandeError(
              `Le jeune ${idJeuneRecree} est de structure POLE_EMPLOI, incompatible avec l'archive (MILO)`
            )
          )
        )
      })
    })

    describe('quand la commande est valide', () => {
      let archive: ArchiveJeuneSqlModel
      let command: DesarchiverJeuneCommand

      beforeEach(async () => {
        // Given
        archive = await creerArchive()
        command = { idArchive: archive.id, idConseiller }
      })

      it('recrée le jeune rattaché au conseiller avec les métadonnées archivées', async () => {
        // When
        const result = await handler.handle(command)

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
        expect(jeune?.idAuthentification).to.be.null()
      })

      it('restaure les actions avec leurs commentaires', async () => {
        // When
        await handler.handle(command)

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
        const result = await handler.handle(command)

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
        await handler.handle(command)

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
        const result = await handler.handle(command)

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
          emailRestaure: true,
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
        const result = await handler.handle(command)

        // Then
        expect(isSuccess(result) && result.data.messagesRestaures).to.equal(0)
        const jeune = await JeuneSqlModel.findByPk(idJeune)
        expect(jeune).not.to.be.null()
      })

      it("conserve l'archive pour vérification", async () => {
        // When
        await handler.handle(command)

        // Then
        const archiveApres = await ArchiveJeuneSqlModel.findByPk(archive.id)
        expect(archiveApres).not.to.be.null()
      })
    })

    describe('quand l’archive ne contient que des données vides', () => {
      it('recrée uniquement le jeune et signale un email manquant', async () => {
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
        const result = await handler.handle({
          idArchive: archive.id,
          idConseiller
        })

        // Then
        const jeune = await JeuneSqlModel.findByPk(idJeune)
        expect(jeune?.idConseiller).to.equal(idConseiller)
        expect(
          chatRepository.restaurerMessagesIndividuels
        ).not.to.have.been.called()
        expect(isSuccess(result) && result.data).to.deep.equal({
          idJeune,
          fusionAvecCompteRecree: false,
          emailRestaure: false,
          actionsRestaurees: 0,
          rendezVousRestaures: 0,
          actionsIgnoreesDoublon: 0,
          rendezVousIgnoresDoublon: 0,
          animationsCollectivesNonRestaurees: 0,
          favorisRestaures: 0,
          recherchesRestaurees: 0,
          messagesRestaures: 0
        })
      })
    })
  })
})
