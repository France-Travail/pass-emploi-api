import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import {
  ChangerDispositifJeuneCommand,
  ChangerDispositifJeuneCommandHandler
} from '../../../src/application/commands/changer-dispositif-jeune.command.handler'
import { NonTrouveError } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../src/building-blocks/types/result'
import { ArchiveJeune } from '../../../src/domain/archive-jeune'
import { Core } from '../../../src/domain/core'
import { Evenement, EvenementService } from '../../../src/domain/evenement'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { DateService } from '../../../src/utils/date-service'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { uneAutreDate, uneDate } from '../../fixtures/date.fixture'
import { unJeune } from '../../fixtures/jeune.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('ChangerDispositifJeuneCommandHandler', () => {
  let handler: ChangerDispositifJeuneCommandHandler
  let jeuneRepository: StubbedType<Jeune.Repository>
  let archiveJeuneRepository: StubbedType<ArchiveJeune.Repository>
  let evenementService: StubbedClass<EvenementService>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let dateService: StubbedClass<DateService>

  const dateFinAccompagnement = uneAutreDate()
  const utilisateur = unUtilisateurConseiller()
  const jeune = unJeune({
    structure: Core.Structure.MILO,
    dispositif: Jeune.Dispositif.CEJ
  })
  const command: ChangerDispositifJeuneCommand = {
    idJeune: jeune.id,
    dispositif: Jeune.Dispositif.PACEA,
    motif: ArchiveJeune.MotifSuppression.CHANGEMENT_ACCOMPAGNEMENT,
    dateFinAccompagnement
  }

  beforeEach(() => {
    jeuneRepository = stubInterface(createSandbox())
    archiveJeuneRepository = stubInterface(createSandbox())
    evenementService = stubClass(EvenementService)
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    dateService = stubClass(DateService)

    dateService.nowJs.returns(uneDate())

    handler = new ChangerDispositifJeuneCommandHandler(
      jeuneRepository,
      archiveJeuneRepository,
      evenementService,
      conseillerAuthorizer,
      dateService
    )
  })

  describe('authorize', () => {
    it('autorise le conseiller du jeune', async () => {
      // Given
      conseillerAuthorizer.autoriserConseillerPourSonJeune
        .withArgs(jeune.id, utilisateur)
        .resolves(emptySuccess())

      // When
      await handler.authorize(command, utilisateur, jeune)

      // Then
      expect(
        conseillerAuthorizer.autoriserConseillerPourSonJeune
      ).to.have.been.calledOnceWithExactly(command.idJeune, utilisateur)
    })

    it("retourne une erreur quand le jeune n'existe pas", async () => {
      // When
      const result = await handler.authorize(command, utilisateur, undefined)

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Jeune', command.idJeune))
      )
    })
  })

  describe('handle', () => {
    describe('quand le jeune est activé', () => {
      it("retourne l'erreur si l'archivage échoue", async () => {
        // Given
        const erreur = failure(new NonTrouveError('Jeune', jeune.id))
        archiveJeuneRepository.archiverSansDonnees.resolves(erreur)

        // When
        const result = await handler.handle(command, utilisateur, jeune)

        // Then
        expect(result).to.deep.equal(erreur)
        expect(jeuneRepository.save).not.to.have.been.called()
      })

      it('archive les métadonnées, réinitialise le compte et bascule le dispositif', async () => {
        // Given
        archiveJeuneRepository.archiverSansDonnees.resolves(emptySuccess())

        // When
        const result = await handler.handle(command, utilisateur, jeune)

        // Then
        const metadonneesAttendues: ArchiveJeune.Metadonnees = {
          idJeune: jeune.id,
          email: jeune.email,
          prenomJeune: jeune.firstName,
          nomJeune: jeune.lastName,
          structure: jeune.structure,
          dispositif: jeune.dispositif,
          idPartenaire: jeune.idPartenaire,
          dateCreation: jeune.creationDate.toJSDate(),
          datePremiereConnexion: jeune.datePremiereConnexion?.toJSDate(),
          motif: command.motif,
          dateArchivage: uneDate(),
          dateFinAccompagnement: command.dateFinAccompagnement
        }
        expect(
          archiveJeuneRepository.archiverSansDonnees
        ).to.have.been.calledOnceWithExactly(metadonneesAttendues)

        const jeuneAttendu: Jeune = {
          ...jeune,
          dispositif: Jeune.Dispositif.PACEA,
          peutVoirLeComptageDesHeures: false,
          creationDate: DateTime.fromJSDate(dateFinAccompagnement),
          datePremiereConnexion: undefined,
          isActivated: false,
          configuration: {
            ...jeune.configuration,
            pushNotificationToken: undefined,
            dateDerniereActualisationToken: undefined
          }
        }
        expect(jeuneRepository.save).to.have.been.calledOnceWithExactly(
          jeuneAttendu
        )
        expect(
          jeuneRepository.reinitialiserDatePremiereConnexion
        ).to.have.been.calledOnceWithExactly(jeune.id)
        expect(result).to.deep.equal(emptySuccess())
      })
    })

    describe("quand le jeune n'est pas activé", () => {
      it("ne crée pas d'archive mais réinitialise le compte et bascule le dispositif", async () => {
        // Given
        const jeuneNonActive = unJeune({
          structure: Core.Structure.MILO,
          dispositif: Jeune.Dispositif.CEJ,
          isActivated: false,
          datePremiereConnexion: undefined
        })

        // When
        const result = await handler.handle(
          command,
          utilisateur,
          jeuneNonActive
        )

        // Then
        expect(
          archiveJeuneRepository.archiverSansDonnees
        ).not.to.have.been.called()

        const jeuneAttendu: Jeune = {
          ...jeuneNonActive,
          dispositif: Jeune.Dispositif.PACEA,
          peutVoirLeComptageDesHeures: false,
          creationDate: DateTime.fromJSDate(dateFinAccompagnement),
          datePremiereConnexion: undefined,
          isActivated: false,
          configuration: {
            ...jeuneNonActive.configuration,
            pushNotificationToken: undefined,
            dateDerniereActualisationToken: undefined
          }
        }
        expect(jeuneRepository.save).to.have.been.calledOnceWithExactly(
          jeuneAttendu
        )
        expect(
          jeuneRepository.reinitialiserDatePremiereConnexion
        ).to.have.been.calledOnceWithExactly(jeuneNonActive.id)
        expect(result).to.deep.equal(emptySuccess())
      })
    })
  })

  describe('monitor', () => {
    it('émet COMPTE_ARCHIVE et COMPTE_CREE quand le jeune était activé', async () => {
      // When
      await handler.monitor(utilisateur, command, jeune)

      // Then
      expect(evenementService.creer).to.have.been.calledWith(
        Evenement.Code.COMPTE_ARCHIVE,
        utilisateur
      )
      expect(evenementService.creer).to.have.been.calledWith(
        Evenement.Code.COMPTE_CREE,
        utilisateur
      )
    })

    it("émet uniquement COMPTE_CREE quand le jeune n'était pas activé", async () => {
      // Given
      const jeuneNonActive = unJeune({ isActivated: false })

      // When
      await handler.monitor(utilisateur, command, jeuneNonActive)

      // Then
      expect(evenementService.creer).not.to.have.been.calledWith(
        Evenement.Code.COMPTE_ARCHIVE,
        utilisateur
      )
      expect(evenementService.creer).to.have.been.calledWith(
        Evenement.Code.COMPTE_CREE,
        utilisateur
      )
    })
  })
})
