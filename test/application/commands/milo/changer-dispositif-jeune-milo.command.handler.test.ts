import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox, SinonStub, stub } from 'sinon'
import { ConseillerAuthorizer } from '../../../../src/application/authorizers/conseiller-authorizer'
import { FonctionnaliteAuthorizer } from '../../../../src/application/authorizers/fonctionnalite-authorizer'
import {
  ChangerDispositifJeuneMiloCommand,
  ChangerDispositifJeuneMiloCommandHandler
} from '../../../../src/application/commands/milo/changer-dispositif-jeune-milo.command.handler'
import {
  DroitsInsuffisants,
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../../src/building-blocks/types/result'
import { ArchiveJeune } from '../../../../src/domain/archive-jeune'
import { Evenement, EvenementService } from '../../../../src/domain/evenement'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { DateService } from '../../../../src/utils/date-service'
import { rootLogger } from '../../../../src/utils/logger.module'
import { unUtilisateurConseiller } from '../../../fixtures/authentification.fixture'
import { uneAutreDate, uneDate } from '../../../fixtures/date.fixture'
import { unJeune } from '../../../fixtures/jeune.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'
import { Profil, TOUT_MILO } from '../../../../src/domain/profil'

describe('ChangerDispositifJeuneMiloCommandHandler', () => {
  let handler: ChangerDispositifJeuneMiloCommandHandler
  let jeuneRepository: StubbedType<Jeune.Repository>
  let archiveJeuneRepository: StubbedType<ArchiveJeune.Repository>
  let evenementService: StubbedClass<EvenementService>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  let dateService: StubbedClass<DateService>
  let fonctionnaliteAuthorizer: StubbedClass<FonctionnaliteAuthorizer>

  const dateFinAccompagnement = uneAutreDate()
  const utilisateur = unUtilisateurConseiller()
  const jeune = unJeune({
    structure: Profil.Structure.MILO,
    dispositif: Profil.Dispositif.CEJ
  })
  const command: ChangerDispositifJeuneMiloCommand = {
    idJeune: jeune.id,
    dispositif: Profil.Dispositif.PACEA,
    motif: ArchiveJeune.MotifSuppression.CHANGEMENT_ACCOMPAGNEMENT,
    dateFinAccompagnement
  }

  beforeEach(() => {
    jeuneRepository = stubInterface(createSandbox())
    archiveJeuneRepository = stubInterface(createSandbox())
    evenementService = stubClass(EvenementService)
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    dateService = stubClass(DateService)
    fonctionnaliteAuthorizer = stubClass(FonctionnaliteAuthorizer)
    fonctionnaliteAuthorizer.autoriserLeDispositifPourLeConseiller.resolves(
      emptySuccess()
    )

    dateService.nowJs.returns(uneDate())

    handler = new ChangerDispositifJeuneMiloCommandHandler(
      jeuneRepository,
      archiveJeuneRepository,
      evenementService,
      conseillerAuthorizer,
      dateService,
      fonctionnaliteAuthorizer
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

    it('refuse le dispositif Autre quand la fonctionnalité est inactive pour le conseiller', async () => {
      // Given
      conseillerAuthorizer.autoriserConseillerPourSonJeune.resolves(
        emptySuccess()
      )
      fonctionnaliteAuthorizer.autoriserLeDispositifPourLeConseiller
        .withArgs(utilisateur.id, Profil.Dispositif.AUTRE)
        .resolves(failure(new DroitsInsuffisants()))

      // When
      const result = await handler.authorize(
        { ...command, dispositif: Profil.Dispositif.AUTRE },
        utilisateur,
        jeune
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
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
          structure: Profil.Structure.MILO,
          dispositif: jeune.dispositif ?? undefined,
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
          dispositif: Profil.Dispositif.PACEA,
          peutVoirLeComptageDesHeures: false,
          creationDate: DateTime.fromJSDate(dateFinAccompagnement)
        }
        expect(jeuneRepository.save).to.have.been.calledOnceWithExactly(
          jeuneAttendu
        )
        expect(
          jeuneRepository.reinitialiserDatePremiereConnexion
        ).not.to.have.been.called()
        expect(result).to.deep.equal(emptySuccess())
      })
    })

    it('bascule un bénéficiaire Mission Locale vers le dispositif Autre sans compteur des heures', async () => {
      // Given
      const jeuneAvecCompteur = unJeune({
        structure: Profil.Structure.MILO,
        dispositif: Profil.Dispositif.CEJ,
        peutVoirLeComptageDesHeures: true
      })
      archiveJeuneRepository.archiverSansDonnees.resolves(emptySuccess())

      // When
      const result = await handler.handle(
        { ...command, dispositif: Profil.Dispositif.AUTRE },
        utilisateur,
        jeuneAvecCompteur
      )

      // Then
      expect(jeuneRepository.save).to.have.been.calledOnceWithExactly({
        ...jeuneAvecCompteur,
        dispositif: Profil.Dispositif.AUTRE,
        peutVoirLeComptageDesHeures: false,
        creationDate: DateTime.fromJSDate(dateFinAccompagnement)
      })
      expect(result).to.deep.equal(emptySuccess())
    })

    it("refuse le changement pour un bénéficiaire qui n'est pas suivi par une Mission Locale", async () => {
      // Given
      const jeuneFT = unJeune({
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.AIJ
      })

      // When
      const result = await handler.handle(
        { ...command, dispositif: Profil.Dispositif.CEJ },
        utilisateur,
        jeuneFT
      )

      // Then
      expect(
        archiveJeuneRepository.archiverSansDonnees
      ).not.to.have.been.called()
      expect(jeuneRepository.save).not.to.have.been.called()
      expect(result).to.deep.equal(
        failure(
          new MauvaiseCommandeError(
            "Ce bénéficiaire n'est pas suivi par une Mission Locale"
          )
        )
      )
    })

    describe("quand le jeune n'est pas activé", () => {
      it("ne crée pas d'archive mais réinitialise le compte et bascule le dispositif", async () => {
        // Given
        const jeuneNonActive = unJeune({
          structure: Profil.Structure.MILO,
          dispositif: Profil.Dispositif.CEJ,
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
          dispositif: Profil.Dispositif.PACEA,
          peutVoirLeComptageDesHeures: false,
          creationDate: DateTime.fromJSDate(dateFinAccompagnement)
        }
        expect(jeuneRepository.save).to.have.been.calledOnceWithExactly(
          jeuneAttendu
        )
        expect(
          jeuneRepository.reinitialiserDatePremiereConnexion
        ).not.to.have.been.called()
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

  describe('execute — labels de handler_executed', () => {
    let logInfo: SinonStub

    beforeEach(() => {
      logInfo = stub(rootLogger, 'info')
      jeuneRepository.get.withArgs(jeune.id).resolves(jeune)
      conseillerAuthorizer.autoriserConseillerPourSonJeune.resolves(
        emptySuccess()
      )
      archiveJeuneRepository.archiverSansDonnees.resolves(emptySuccess())
    })

    afterEach(() => {
      logInfo.restore()
    })

    it("trace le dispositif de départ, celui d'arrivée et le motif", async () => {
      // When
      await handler.execute(command, utilisateur)

      // Then
      expect(logInfo).to.have.been.calledWithMatch({
        context: 'ChangerDispositifJeuneMiloCommandHandler',
        event: { action: 'handler_executed', outcome: 'success' },
        labels: {
          dispositif_depart: Profil.Dispositif.CEJ,
          dispositif_arrivee: Profil.Dispositif.PACEA,
          motif_fin_accompagnement:
            ArchiveJeune.MotifSuppression.CHANGEMENT_ACCOMPAGNEMENT
        }
      })
    })
  })

  it('est réservé aux conseillers Mission Locale', () => {
    expect(handler.profilsAutorises).to.equal(TOUT_MILO)
  })
})
