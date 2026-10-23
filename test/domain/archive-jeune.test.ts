import { ArchiveJeune } from 'src/domain/archive-jeune'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Jeune } from '../../src/domain/jeune/jeune'
import { Chat } from '../../src/domain/chat'
import { Mail } from '../../src/domain/mail'
import { Authentification } from 'src/domain/authentification'
import { DateService } from 'src/utils/date-service'
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
    authentificationRepository.recupererIdsAuthentificationDesJeunes.resolves(
      new Map([
        [jeuneActif.id, 'auth-actif'],
        [jeuneInactif.id, 'auth-inactif']
      ])
    )
    archivageJeuneRepository.construireArchives.resolves([archiveDuJeuneActif])

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

    it("ne construit d'archive que pour les comptes actifs", async () => {
      // When
      await archiverJeuneService.archiverEnMasse(
        idsJeunes,
        commentaire,
        motif,
        'PHASE_A'
      )

      // Then
      const metadonnees: ArchiveJeune.Metadonnees = {
        idJeune: jeuneActif.id,
        email: jeuneActif.email,
        prenomJeune: jeuneActif.firstName,
        nomJeune: jeuneActif.lastName,
        structure: Profil.Structure.MILO,
        dispositif: Profil.Dispositif.CEJ,
        dateCreation: jeuneActif.creationDate.toJSDate(),
        datePremiereConnexion: jeuneActif.creationDate
          .plus({ day: 1 })
          .toJSDate(),
        motif,
        commentaire,
        dateArchivage: maintenant,
        idPopulation: 'PHASE_A'
      }
      expect(jeuneRepository.findAll).to.have.been.calledOnceWithExactly(
        idsJeunes
      )
      expect(
        archivageJeuneRepository.construireArchives
      ).to.have.been.calledOnceWithExactly([metadonnees])
    })

    it('supprime les comptes IdP avant de supprimer les jeunes', async () => {
      // When
      await archiverJeuneService.archiverEnMasse(idsJeunes, commentaire, motif)

      // Then
      expect(
        authentificationRepository.supprimerCompteIdp
      ).to.have.been.calledWithExactly('auth-actif')
      expect(
        authentificationRepository.supprimerCompteIdp
      ).to.have.been.calledWithExactly('auth-inactif')
      expect(
        authentificationRepository.supprimerCompteIdp
      ).to.have.been.calledBefore(jeuneRepository.supprimerEnMasse)
    })

    it('supprime les jeunes trouvés et enregistre leurs archives dans une même transaction', async () => {
      // When
      const resultat = await archiverJeuneService.archiverEnMasse(
        idsJeunes,
        commentaire,
        motif
      )

      // Then
      expect(resultat).to.deep.equal({
        idsJeunesArchives: [jeuneActif.id, jeuneInactif.id],
        nbEchecsNettoyage: 0
      })
      expect(transactionService.executer).to.have.been.calledOnce()
      expect(
        jeuneRepository.supprimerEnMasse
      ).to.have.been.calledOnceWithExactly([jeuneActif.id, jeuneInactif.id])
      expect(
        archivageJeuneRepository.enregistrerArchives
      ).to.have.been.calledOnceWithExactly([archiveDuJeuneActif])
    })

    it('supprime les chats et ne prévient que les comptes actifs', async () => {
      // When
      await archiverJeuneService.archiverEnMasse(idsJeunes, commentaire, motif)

      // Then
      expect(chatRepository.supprimerChat).to.have.been.calledWithExactly(
        jeuneActif.id
      )
      expect(chatRepository.supprimerChat).to.have.been.calledWithExactly(
        jeuneInactif.id
      )
      expect(
        mailService.envoyerEmailJeuneArchive
      ).to.have.been.calledOnceWithExactly(jeuneActif, motif, commentaire)
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
      ).to.have.been.calledOnceWithExactly([])
      expect(chatRepository.supprimerChat).to.have.been.calledOnceWithExactly(
        jeuneInactif.id
      )
      expect(mailService.envoyerEmailJeuneArchive).not.to.have.been.called()
    })

    it('compte les échecs de nettoyage sans interrompre les autres jeunes', async () => {
      // Given
      authentificationRepository.supprimerCompteIdp
        .withArgs('auth-actif')
        .rejects(new Error('connect indisponible'))
      mailService.envoyerEmailJeuneArchive.rejects(new Error('mail en panne'))

      // When
      const resultat = await archiverJeuneService.archiverEnMasse(
        idsJeunes,
        commentaire,
        motif
      )

      // Then
      expect(resultat.nbEchecsNettoyage).to.equal(2)
      expect(jeuneRepository.supprimerEnMasse).to.have.been.calledOnce()
      expect(chatRepository.supprimerChat).to.have.been.calledTwice()
    })

    it("ne nettoie rien quand l'enregistrement des archives échoue", async () => {
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
      expect(chatRepository.supprimerChat).not.to.have.been.called()
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
        nbEchecsNettoyage: 0
      })
      expect(transactionService.executer).not.to.have.been.called()
    })
  })

  describe('archiver', () => {
    it('archive le jeune', async () => {
      // Given
      jeuneRepository.findAll.withArgs([jeuneActif.id]).resolves([jeuneActif])

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
    })
  })
})
