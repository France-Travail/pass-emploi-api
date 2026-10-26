import { ArchiveJeune } from 'src/domain/archive-jeune'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Jeune } from '../../src/domain/jeune/jeune'
import { Chat } from '../../src/domain/chat'
import { Mail } from '../../src/domain/mail'
import { Authentification } from 'src/domain/authentification'
import { DateService } from 'src/utils/date-service'
import * as sinon from 'sinon'
import { createSandbox } from 'sinon'
import { emptySuccess, failure } from '../../src/building-blocks/types/result'
import {
  ArchivageJeuneErreur,
  NonTrouveError
} from 'src/building-blocks/types/domain-error'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { uneConfiguration, unJeune } from '../fixtures/jeune.fixture'
import MotifSuppressionSupport = ArchiveJeune.MotifSuppressionSupport
import { Profil } from '../../src/domain/profil'
import { Transaction } from '../../src/building-blocks/transaction'

describe('ArchiveJeuneService', () => {
  let archiverJeuneService: ArchiveJeune.Service
  let jeuneRepository: StubbedType<Jeune.Repository>
  let archivageJeuneRepository: StubbedType<ArchiveJeune.Repository>
  let chatRepository: StubbedType<Chat.Repository>
  let authentificationRepository: StubbedType<Authentification.Repository>
  let dateService: StubbedClass<DateService>
  let mailService: StubbedType<Mail.Service>
  let transactionService: StubbedType<Transaction.Service>

  const maintenant = new Date('2022-03-01T03:24:00Z')
  const commentaire =
    "Pour des raisons de migration nous avons procédé à l'archivage de votre compte."
  const motif = MotifSuppressionSupport.MIGRATION

  const jeuneActif = unJeune({ id: 'jeune-actif' })
  const jeuneInactif = unJeune({
    id: 'jeune-inactif',
    configuration: uneConfiguration({ dateDerniereActivite: undefined })
  })
  const archiveDuJeuneActif: ArchiveJeune.ArchiveConstruite = {
    metadonnees: {
      idJeune: jeuneActif.id,
      prenomJeune: jeuneActif.firstName,
      nomJeune: jeuneActif.lastName,
      structure: jeuneActif.structure,
      dateCreation: jeuneActif.creationDate.toJSDate(),
      motif,
      dateArchivage: maintenant
    },
    idStructureMilo: null,
    idAuthentification: null,
    idConseiller: null,
    donnees: {
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
  }

  const archiveDuJeuneInactif: ArchiveJeune.ArchiveConstruite = {
    ...archiveDuJeuneActif,
    metadonnees: {
      ...archiveDuJeuneActif.metadonnees,
      idJeune: jeuneInactif.id
    }
  }
  const messages: ArchiveJeune.Message[] = [
    {
      contenu: 'Bonjour',
      date: '2022-02-01T09:00:00.000Z',
      envoyePar: 'jeune',
      type: 'MESSAGE'
    }
  ]

  function uneArchiveANettoyer(
    args: Partial<ArchiveJeune.ArchiveANettoyer> = {}
  ): ArchiveJeune.ArchiveANettoyer {
    return {
      id: 1,
      idJeune: 'jeune-1',
      idAuthentification: 'sub-1',
      idPopulation: 'pop-1',
      nettoyageIdp: 'A_REVOQUER',
      nettoyageChat: 'A_ARCHIVER',
      ...args
    }
  }

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneRepository = stubInterface(sandbox)
    archivageJeuneRepository = stubInterface(sandbox)
    chatRepository = stubInterface(sandbox)
    authentificationRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.nowJs.returns(maintenant)
    mailService = stubInterface(sandbox)
    transactionService = stubInterface(sandbox)
    transactionService.executer.callsFake(operation => operation())

    jeuneRepository.findAll.resolves([jeuneActif, jeuneInactif])
    jeuneRepository.supprimerEnMasse.callsFake(async ids => ids)
    archivageJeuneRepository.construireArchives.resolves([
      archiveDuJeuneActif,
      archiveDuJeuneInactif
    ])
    archivageJeuneRepository.enregistrerArchives.resolves([11, 12])
    archivageJeuneRepository.recupererArchivesANettoyer.resolves([])
    mailService.envoyerEmailJeuneArchive.resolves()

    archiverJeuneService = new ArchiveJeune.Service(
      jeuneRepository,
      archivageJeuneRepository,
      chatRepository,
      authentificationRepository,
      dateService,
      mailService,
      transactionService
    )
  })

  describe('archiverEnMasse', () => {
    const idsJeunes = [jeuneActif.id, jeuneInactif.id, 'jeune-absent']

    function metadonneesAttendues(jeune: Jeune): ArchiveJeune.Metadonnees {
      return {
        idJeune: jeune.id,
        email: jeune.email,
        prenomJeune: jeune.firstName,
        nomJeune: jeune.lastName,
        structure: Profil.Structure.MILO,
        dispositif: Profil.Dispositif.CEJ,
        dateCreation: jeune.creationDate.toJSDate(),
        datePremiereConnexion: jeune.creationDate.plus({ day: 1 }).toJSDate(),
        motif,
        commentaire,
        dateArchivage: maintenant,
        idPopulation: 'PHASE_A',
        nettoyageDiffere: true
      }
    }

    it('archive aussi les comptes inactifs', async () => {
      // When
      await archiverJeuneService.archiverEnMasse(
        idsJeunes,
        commentaire,
        motif,
        'PHASE_A'
      )

      // Then
      expect(jeuneRepository.findAll).to.have.been.calledOnceWithExactly(
        idsJeunes
      )
      expect(
        archivageJeuneRepository.construireArchives
      ).to.have.been.calledOnceWithExactly([
        metadonneesAttendues(jeuneActif),
        metadonneesAttendues(jeuneInactif)
      ])
    })

    it("n'appelle ni l'IdP ni le chat", async () => {
      // When
      await archiverJeuneService.archiverEnMasse(idsJeunes, commentaire, motif)

      // Then
      expect(
        authentificationRepository.supprimerCompteIdp
      ).not.to.have.been.called()
      expect(chatRepository.supprimerChat).not.to.have.been.called()
      expect(
        chatRepository.recupererMessagesAArchiver
      ).not.to.have.been.called()
    })

    it('supprime les jeunes trouvés et enregistre leurs archives dans une même transaction', async () => {
      // When
      await archiverJeuneService.archiverEnMasse(idsJeunes, commentaire, motif)

      // Then
      expect(transactionService.executer).to.have.been.calledOnce()
      expect(
        jeuneRepository.supprimerEnMasse
      ).to.have.been.calledOnceWithExactly([jeuneActif.id, jeuneInactif.id])
      expect(
        archivageJeuneRepository.enregistrerArchives
      ).to.have.been.calledOnceWithExactly([
        archiveDuJeuneActif,
        archiveDuJeuneInactif
      ])
    })

    it('renvoie les ids des archives créées', async () => {
      // When
      const resultat = await archiverJeuneService.archiverEnMasse(
        idsJeunes,
        commentaire,
        motif
      )

      // Then
      expect(resultat).to.deep.equal({
        idsJeunesArchives: [jeuneActif.id, jeuneInactif.id],
        idsArchives: [11, 12],
        nbEchecsMail: 0
      })
    })

    it("n'envoie le mail qu'aux comptes actifs archivés et compte ses échecs dans nbEchecsMail", async () => {
      // Given
      mailService.envoyerEmailJeuneArchive.rejects(new Error('Brevo en 500'))

      // When
      const resultat = await archiverJeuneService.archiverEnMasse(
        idsJeunes,
        commentaire,
        motif
      )

      // Then
      expect(
        mailService.envoyerEmailJeuneArchive
      ).to.have.been.calledOnceWithExactly(jeuneActif, motif, commentaire)
      expect(resultat.nbEchecsMail).to.equal(1)
      expect(resultat.idsJeunesArchives).to.deep.equal([
        jeuneActif.id,
        jeuneInactif.id
      ])
    })

    it("n'archive ni ne prévient un jeune déjà supprimé par un traitement concurrent", async () => {
      // Given
      jeuneRepository.supprimerEnMasse.resolves([jeuneInactif.id])

      // When
      const resultat = await archiverJeuneService.archiverEnMasse(
        idsJeunes,
        commentaire,
        motif
      )

      // Then
      expect(resultat.idsJeunesArchives).to.deep.equal([jeuneInactif.id])
      expect(
        archivageJeuneRepository.enregistrerArchives
      ).to.have.been.calledOnceWithExactly([archiveDuJeuneInactif])
      expect(mailService.envoyerEmailJeuneArchive).not.to.have.been.called()
    })

    it("ne prévient personne quand l'enregistrement des archives échoue", async () => {
      // Given
      archivageJeuneRepository.enregistrerArchives.rejects(
        new Error('Base indisponible')
      )

      // When
      const promesse = archiverJeuneService.archiverEnMasse(
        idsJeunes,
        commentaire,
        motif
      )

      // Then
      await expect(promesse).to.be.rejectedWith('Base indisponible')
      expect(mailService.envoyerEmailJeuneArchive).not.to.have.been.called()
    })

    it("ne fait rien quand aucun jeune n'existe", async () => {
      // Given
      jeuneRepository.findAll.resolves([])

      // When
      const resultat = await archiverJeuneService.archiverEnMasse(
        ['jeune-absent'],
        commentaire,
        motif
      )

      // Then
      expect(resultat).to.deep.equal({
        idsJeunesArchives: [],
        idsArchives: [],
        nbEchecsMail: 0
      })
      expect(transactionService.executer).not.to.have.been.called()
    })
  })

  describe('nettoyerLesArchives', () => {
    it("révoque l'IdP, verse les messages puis supprime le chat", async () => {
      // Given
      archivageJeuneRepository.recupererArchivesANettoyer
        .withArgs([1])
        .resolves([uneArchiveANettoyer()])
      chatRepository.recupererMessagesAArchiver
        .withArgs('jeune-1')
        .resolves(messages)

      // When
      const bilan = await archiverJeuneService.nettoyerLesArchives([1])

      // Then
      expect(
        authentificationRepository.supprimerCompteIdp
      ).to.have.been.calledOnceWithExactly('sub-1')
      expect(
        archivageJeuneRepository.marquerIdpRevoque
      ).to.have.been.calledOnceWithExactly(1)
      expect(
        archivageJeuneRepository.verserLesMessages
      ).to.have.been.calledOnceWithExactly(1, messages)
      expect(chatRepository.supprimerChat).to.have.been.calledOnceWithExactly(
        'jeune-1'
      )
      expect(
        archivageJeuneRepository.marquerChatSupprime
      ).to.have.been.calledOnceWithExactly(1)
      sinon.assert.callOrder(
        chatRepository.recupererMessagesAArchiver,
        archivageJeuneRepository.verserLesMessages,
        chatRepository.supprimerChat,
        archivageJeuneRepository.marquerChatSupprime
      )
      expect(bilan).to.deep.equal({
        nbTraites: 1,
        nbEchecs: 0,
        nbEchecsIdp: 0,
        nbEchecsChat: 0
      })
    })

    it('ne supprime pas le chat si sa lecture échoue', async () => {
      // Given
      archivageJeuneRepository.recupererArchivesANettoyer.resolves([
        uneArchiveANettoyer()
      ])
      chatRepository.recupererMessagesAArchiver.rejects(
        new Error('Firestore indisponible')
      )

      // When
      const bilan = await archiverJeuneService.nettoyerLesArchives([1])

      // Then
      expect(
        archivageJeuneRepository.verserLesMessages
      ).not.to.have.been.called()
      expect(chatRepository.supprimerChat).not.to.have.been.called()
      expect(bilan).to.deep.equal({
        nbTraites: 0,
        nbEchecs: 1,
        nbEchecsIdp: 0,
        nbEchecsChat: 1
      })
    })

    it("ne relit pas un chat déjà versé dans l'archive", async () => {
      // Given
      archivageJeuneRepository.recupererArchivesANettoyer.resolves([
        uneArchiveANettoyer({ nettoyageChat: 'A_SUPPRIMER' })
      ])

      // When
      await archiverJeuneService.nettoyerLesArchives([1])

      // Then
      expect(
        chatRepository.recupererMessagesAArchiver
      ).not.to.have.been.called()
      expect(
        archivageJeuneRepository.verserLesMessages
      ).not.to.have.been.called()
      expect(chatRepository.supprimerChat).to.have.been.calledOnceWithExactly(
        'jeune-1'
      )
      expect(
        archivageJeuneRepository.marquerChatSupprime
      ).to.have.been.calledOnceWithExactly(1)
    })

    it('nettoie le chat même si la révocation IdP échoue', async () => {
      // Given
      archivageJeuneRepository.recupererArchivesANettoyer.resolves([
        uneArchiveANettoyer()
      ])
      authentificationRepository.supprimerCompteIdp.rejects(
        new Error('connect indisponible')
      )

      // When
      const bilan = await archiverJeuneService.nettoyerLesArchives([1])

      // Then
      expect(
        archivageJeuneRepository.marquerIdpRevoque
      ).not.to.have.been.called()
      expect(chatRepository.supprimerChat).to.have.been.calledOnceWithExactly(
        'jeune-1'
      )
      expect(bilan).to.deep.equal({
        nbTraites: 0,
        nbEchecs: 1,
        nbEchecsIdp: 1,
        nbEchecsChat: 0
      })
    })

    it("n'appelle pas l'IdP quand l'étape IdP est déjà faite", async () => {
      // Given
      archivageJeuneRepository.recupererArchivesANettoyer.resolves([
        uneArchiveANettoyer({ nettoyageIdp: null })
      ])

      // When
      await archiverJeuneService.nettoyerLesArchives([1])

      // Then
      expect(
        authentificationRepository.supprimerCompteIdp
      ).not.to.have.been.called()
      expect(
        archivageJeuneRepository.marquerIdpRevoque
      ).not.to.have.been.called()
    })

    it('compte une archive en échec une seule fois même si ses deux étapes échouent', async () => {
      // Given
      archivageJeuneRepository.recupererArchivesANettoyer.resolves([
        uneArchiveANettoyer()
      ])
      authentificationRepository.supprimerCompteIdp.rejects(
        new Error('connect indisponible')
      )
      chatRepository.recupererMessagesAArchiver.rejects(
        new Error('Firestore indisponible')
      )

      // When
      const bilan = await archiverJeuneService.nettoyerLesArchives([1])

      // Then
      expect(bilan).to.deep.equal({
        nbTraites: 0,
        nbEchecs: 1,
        nbEchecsIdp: 1,
        nbEchecsChat: 1
      })
    })

    it('compte chaque archive parcourue soit traitée, soit en échec', async () => {
      // Given
      archivageJeuneRepository.recupererArchivesANettoyer.resolves([
        uneArchiveANettoyer({
          id: 1,
          idJeune: 'jeune-1',
          idAuthentification: 'sub-1'
        }),
        uneArchiveANettoyer({
          id: 2,
          idJeune: 'jeune-2',
          idAuthentification: 'sub-2'
        }),
        uneArchiveANettoyer({
          id: 3,
          idJeune: 'jeune-3',
          idAuthentification: 'sub-3'
        })
      ])
      authentificationRepository.supprimerCompteIdp
        .withArgs('sub-2')
        .rejects(new Error('connect indisponible'))
      chatRepository.supprimerChat
        .withArgs('jeune-3')
        .rejects(new Error('Firestore indisponible'))

      // When
      const bilan = await archiverJeuneService.nettoyerLesArchives([1, 2, 3])

      // Then
      expect(bilan).to.deep.equal({
        nbTraites: 1,
        nbEchecs: 2,
        nbEchecsIdp: 1,
        nbEchecsChat: 1
      })
      expect(bilan.nbTraites + bilan.nbEchecs).to.equal(3)
    })
  })

  describe('archiver', () => {
    it("archive puis nettoie l'archive créée dans la même exécution", async () => {
      // Given
      jeuneRepository.findAll.withArgs([jeuneActif.id]).resolves([jeuneActif])
      archivageJeuneRepository.construireArchives.resolves([
        archiveDuJeuneActif
      ])
      archivageJeuneRepository.enregistrerArchives.resolves([11])

      // When
      const result = await archiverJeuneService.archiver(
        jeuneActif.id,
        commentaire,
        motif
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        jeuneRepository.supprimerEnMasse
      ).to.have.been.calledOnceWithExactly([jeuneActif.id])
      expect(
        archivageJeuneRepository.recupererArchivesANettoyer
      ).to.have.been.calledOnceWithExactly([11])
      expect(
        archivageJeuneRepository.recupererArchivesANettoyer
      ).to.have.been.calledAfter(archivageJeuneRepository.enregistrerArchives)
    })

    it("réussit même quand le nettoyage lève une erreur, l'archive restant à nettoyer", async () => {
      // Given
      jeuneRepository.findAll.withArgs([jeuneActif.id]).resolves([jeuneActif])
      archivageJeuneRepository.recupererArchivesANettoyer.rejects(
        new Error('Base indisponible')
      )

      // When
      const result = await archiverJeuneService.archiver(
        jeuneActif.id,
        commentaire,
        motif
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })

    it("retourne une erreur NonTrouveError quand le jeune n'existe pas", async () => {
      // Given
      jeuneRepository.findAll.withArgs(['inconnu']).resolves([])

      // When
      const result = await archiverJeuneService.archiver(
        'inconnu',
        commentaire,
        motif
      )

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Jeune', 'inconnu'))
      )
    })

    it("retourne une erreur ArchivageJeuneErreur quand l'archivage échoue", async () => {
      // Given
      jeuneRepository.findAll.withArgs([jeuneActif.id]).resolves([jeuneActif])
      archivageJeuneRepository.enregistrerArchives.rejects(
        new Error('Base indisponible')
      )

      // When
      const result = await archiverJeuneService.archiver(
        jeuneActif.id,
        commentaire,
        motif
      )

      // Then
      expect(result).to.deep.equal(
        failure(new ArchivageJeuneErreur(jeuneActif.id))
      )
      expect(
        archivageJeuneRepository.recupererArchivesANettoyer
      ).not.to.have.been.called()
    })
  })
})
