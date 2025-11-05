import { ArchiveJeune } from 'src/domain/archive-jeune'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { Jeune } from '../../src/domain/jeune/jeune'
import { Chat } from '../../src/domain/chat'
import { Mail } from '../../src/domain/mail'
import { Authentification } from 'src/domain/authentification'
import { DateService } from 'src/utils/date-service'
import { createSandbox } from 'sinon'
import { emptySuccess, failure } from '../../src/building-blocks/types/result'
import { NonTrouveError } from 'src/building-blocks/types/domain-error'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { unJeune } from '../fixtures/jeune.fixture'
import { Core } from '../../src/domain/core'
import MotifSuppressionSupport = ArchiveJeune.MotifSuppressionSupport

describe('ArchiveJeuneService', () => {
  let archiverJeuneService: ArchiveJeune.Service
  let jeuneRepository: StubbedType<Jeune.Repository>
  let archivageJeuneRepository: StubbedType<ArchiveJeune.Repository>
  let chatRepository: StubbedType<Chat.Repository>
  let authentificationRepository: StubbedType<Authentification.Repository>
  let dateService: StubbedClass<DateService>
  let mailService: StubbedType<Mail.Service>

  const maintenant = new Date('2022-03-01T03:24:00Z')

  beforeEach(() => {
    const sandbox = createSandbox()
    jeuneRepository = stubInterface(sandbox)
    archivageJeuneRepository = stubInterface(sandbox)
    chatRepository = stubInterface(sandbox)
    authentificationRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    dateService.nowJs.returns(maintenant)
    mailService = stubInterface(sandbox)

    archiverJeuneService = new ArchiveJeune.Service(
      jeuneRepository,
      archivageJeuneRepository,
      chatRepository,
      authentificationRepository,
      dateService,
      mailService
    )
  })

  describe('archiver', () => {
    const idJeune = 'idJeune'

    describe('quand le jeune existe', () => {
      const jeune = unJeune({ id: idJeune })

      it('archive le jeune après une suppresion support', async () => {
        // Given
        const commentaireSuppressionSupport =
          "Pour des raisons techniques nous avons procédé à l'archivage de votre compte."
        const motifSuppression = MotifSuppressionSupport.SUPPORT
        jeuneRepository.get.withArgs(idJeune).resolves(jeune)

        // When
        const result = await archiverJeuneService.archiver(
          idJeune,
          commentaireSuppressionSupport,
          motifSuppression
        )

        // Then
        const metadonneesArchive: ArchiveJeune.Metadonnees = {
          idJeune: idJeune,
          email: jeune.email,
          prenomJeune: jeune.firstName,
          nomJeune: jeune.lastName,
          structure: Core.Structure.MILO,
          dispositif: Jeune.Dispositif.CEJ,
          dateCreation: jeune.creationDate.toJSDate(),
          datePremiereConnexion: jeune.creationDate.plus({ day: 1 }).toJSDate(),
          motif: motifSuppression,
          commentaire: commentaireSuppressionSupport,
          dateArchivage: maintenant
        }

        expect(result).to.deep.equal(emptySuccess())
        expect(
          archivageJeuneRepository.archiver
        ).to.have.been.calledWithExactly(metadonneesArchive)
        expect(
          authentificationRepository.deleteUtilisateurIdp
        ).to.have.been.calledWithExactly(idJeune)
        expect(jeuneRepository.supprimer).to.have.been.calledWithExactly(
          idJeune
        )
        expect(chatRepository.supprimerChat).to.have.been.calledWithExactly(
          idJeune
        )
        expect(mailService.envoyerEmailJeuneArchive).to.have.been.calledWith(
          jeune,
          motifSuppression,
          commentaireSuppressionSupport
        )
      })
      it('archive le jeune après la migration', async () => {
        // Given
        const commentaireSuppressionMigration =
          "Pour des raisons techniques nous avons procédé à l'archivage de votre compte."
        const motifSuppressionMigration = MotifSuppressionSupport.MIGRATION
        jeuneRepository.get.withArgs(idJeune).resolves(jeune)

        // When
        const result = await archiverJeuneService.archiver(
          idJeune,
          commentaireSuppressionMigration,
          motifSuppressionMigration
        )

        // Then
        const metadonneesArchive: ArchiveJeune.Metadonnees = {
          idJeune: idJeune,
          email: jeune.email,
          prenomJeune: jeune.firstName,
          nomJeune: jeune.lastName,
          structure: Core.Structure.MILO,
          dispositif: Jeune.Dispositif.CEJ,
          dateCreation: jeune.creationDate.toJSDate(),
          datePremiereConnexion: jeune.creationDate.plus({ day: 1 }).toJSDate(),
          motif: motifSuppressionMigration,
          commentaire: commentaireSuppressionMigration,
          dateArchivage: maintenant
        }

        expect(result).to.deep.equal(emptySuccess())
        expect(
          archivageJeuneRepository.archiver
        ).to.have.been.calledWithExactly(metadonneesArchive)
        expect(
          authentificationRepository.deleteUtilisateurIdp
        ).to.have.been.calledWithExactly(idJeune)
        expect(jeuneRepository.supprimer).to.have.been.calledWithExactly(
          idJeune
        )
        expect(chatRepository.supprimerChat).to.have.been.calledWithExactly(
          idJeune
        )
        expect(mailService.envoyerEmailJeuneArchive).to.have.been.calledWith(
          jeune,
          motifSuppressionMigration,
          commentaireSuppressionMigration
        )
      })
    })

    describe("quand le jeune n'existe pas", () => {
      it('retourne une erreur NonTrouveError', async () => {
        // Given
        const commentaireSuppressionSupport =
          "Pour des raisons techniques nous avons procédé à l'archivage de votre compte."
        const motifSuppression = MotifSuppressionSupport.SUPPORT
        jeuneRepository.get.withArgs(idJeune).resolves(null)

        // When
        const result = await archiverJeuneService.archiver(
          idJeune,
          commentaireSuppressionSupport,
          motifSuppression
        )

        // Then
        expect(result).to.deep.equal(
          failure(new NonTrouveError('Jeune', idJeune))
        )
      })
    })
  })
})
