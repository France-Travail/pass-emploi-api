import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox, SinonStub, stub } from 'sinon'
import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import { FonctionnaliteAuthorizer } from '../../../src/application/authorizers/fonctionnalite-authorizer'
import {
  ModifierJeuneDuConseillerCommand,
  ModifierJeuneDuConseillerCommandHandler
} from '../../../src/application/commands/modifier-jeune-du-conseiller.command.handler'
import {
  DroitsInsuffisants,
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../src/building-blocks/types/result'
import { Authentification } from '../../../src/domain/authentification'
import { Jeune } from '../../../src/domain/jeune/jeune'
import { rootLogger } from '../../../src/utils/logger.module'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { unJeune } from '../../fixtures/jeune.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'
import { Profil } from '../../../src/domain/profil'
import { unProfilFT } from '../../fixtures/profil.fixture'

describe('ModifierJeuneDuConseillerCommandHandler', () => {
  let modifierJeuneDuConseillerCommandHandler: ModifierJeuneDuConseillerCommandHandler
  let conseillerForJeuneAuthorizer: StubbedClass<ConseillerAuthorizer>
  let jeuneRepository: StubbedType<Jeune.Repository>
  let authentificationRepository: StubbedType<Authentification.Repository>
  let fonctionnaliteAuthorizer: StubbedClass<FonctionnaliteAuthorizer>

  const jeune = unJeune({ structure: Profil.Structure.FRANCE_TRAVAIL })
  const utilisateur = unUtilisateurConseiller()
  const command: ModifierJeuneDuConseillerCommand = {
    idJeune: jeune.id,
    idPartenaire: 'id-nouveau'
  }

  beforeEach(() => {
    conseillerForJeuneAuthorizer = stubClass(ConseillerAuthorizer)
    jeuneRepository = stubInterface(createSandbox())
    authentificationRepository = stubInterface(createSandbox())
    fonctionnaliteAuthorizer = stubClass(FonctionnaliteAuthorizer)
    fonctionnaliteAuthorizer.autoriserLeDispositifPourLeConseiller.resolves(
      emptySuccess()
    )
    modifierJeuneDuConseillerCommandHandler =
      new ModifierJeuneDuConseillerCommandHandler(
        jeuneRepository,
        authentificationRepository,
        conseillerForJeuneAuthorizer,
        fonctionnaliteAuthorizer
      )
  })

  describe('authorize', () => {
    it('authorize un conseiller PE du jeune', async () => {
      // Given
      const conseillerPE = unUtilisateurConseiller({
        profil: unProfilFT()
      })
      conseillerForJeuneAuthorizer.autoriserConseillerPourSonJeune
        .withArgs(jeune.id, conseillerPE)
        .resolves(emptySuccess())

      // When
      await modifierJeuneDuConseillerCommandHandler.authorize(
        command,
        conseillerPE,
        jeune
      )

      // Then
      expect(
        conseillerForJeuneAuthorizer.autoriserConseillerPourSonJeune
      ).to.have.been.calledOnceWithExactly(command.idJeune, conseillerPE)
    })

    it('refuse le dispositif Autre quand la fonctionnalité est inactive pour le conseiller', async () => {
      // Given
      const conseillerMilo = unUtilisateurConseiller()
      const commandAutre: ModifierJeuneDuConseillerCommand = {
        idJeune: jeune.id,
        dispositif: Profil.Dispositif.AUTRE
      }
      conseillerForJeuneAuthorizer.autoriserConseillerPourSonJeune.resolves(
        emptySuccess()
      )
      fonctionnaliteAuthorizer.autoriserLeDispositifPourLeConseiller
        .withArgs(conseillerMilo.id, Profil.Dispositif.AUTRE)
        .resolves(failure(new DroitsInsuffisants()))

      // When
      const result = await modifierJeuneDuConseillerCommandHandler.authorize(
        commandAutre,
        conseillerMilo,
        jeune
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })

    it("retourne une erreur quand le jeune n'existe pas", async () => {
      // When
      const result = await modifierJeuneDuConseillerCommandHandler.authorize(
        command,
        unUtilisateurConseiller(),
        undefined
      )

      // Then
      expect(result).to.deep.equal(
        failure(new NonTrouveError('Jeune', command.idJeune))
      )
    })
  })

  describe('handle', () => {
    describe('quand le jeune existe', () => {
      it('met à jour son id partenaire', async () => {
        // When
        const result = await modifierJeuneDuConseillerCommandHandler.handle(
          command,
          utilisateur,
          jeune
        )

        // Then
        const expected: Jeune = {
          ...jeune,
          idPartenaire: command.idPartenaire
        }
        expect(jeuneRepository.save).to.have.been.calledWithExactly(expected)
        expect(result).to.deep.equal(emptySuccess())
      })
      it('met à jour comptage', async () => {
        // Given
        const jeune = unJeune({ structure: Profil.Structure.MILO })
        const command: ModifierJeuneDuConseillerCommand = {
          idJeune: jeune.id,
          peutVoirLeComptageDesHeures: false
        }

        // When
        const result = await modifierJeuneDuConseillerCommandHandler.handle(
          command,
          utilisateur,
          jeune
        )

        // Then
        const expected: Jeune = {
          ...jeune,
          peutVoirLeComptageDesHeures: command.peutVoirLeComptageDesHeures
        }
        expect(jeuneRepository.save).to.have.been.calledWithExactly(expected)
        expect(result).to.deep.equal(emptySuccess())
      })
      it('cumule les modifications quand plusieurs champs sont envoyés ensemble', async () => {
        // Given
        const jeuneFT = unJeune({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        })

        // When
        await modifierJeuneDuConseillerCommandHandler.handle(
          {
            idJeune: jeuneFT.id,
            idPartenaire: 'id-nouveau',
            dispositif: Profil.Dispositif.BRSA
          },
          utilisateur,
          jeuneFT
        )

        // Then
        expect(jeuneRepository.save).to.have.been.calledWithExactly({
          ...jeuneFT,
          idPartenaire: 'id-nouveau',
          dispositif: Profil.Dispositif.BRSA,
          peutVoirLeComptageDesHeures: false
        })
      })
      it('met à jour dispositif CEJ vers PACEA et modifie peutVoirLeComptageDesHeures à false ', async () => {
        const jeune = unJeune({
          structure: Profil.Structure.MILO,
          dispositif: Profil.Dispositif.CEJ
        })
        const command: ModifierJeuneDuConseillerCommand = {
          idJeune: jeune.id,
          dispositif: Profil.Dispositif.PACEA
        }

        const result = await modifierJeuneDuConseillerCommandHandler.handle(
          command,
          utilisateur,
          jeune
        )

        const expected: Jeune = {
          ...jeune,
          dispositif: Profil.Dispositif.PACEA,
          peutVoirLeComptageDesHeures: false
        }
        expect(jeuneRepository.save).to.have.been.calledWithExactly(expected)
        expect(result).to.deep.equal(emptySuccess())
      })
      it('met à jour dispositif CEJ vers Autre, retire le compteur des heures et ne déconnecte pas le bénéficiaire', async () => {
        const jeune = unJeune({
          structure: Profil.Structure.MILO,
          dispositif: Profil.Dispositif.CEJ,
          peutVoirLeComptageDesHeures: true
        })
        const command: ModifierJeuneDuConseillerCommand = {
          idJeune: jeune.id,
          dispositif: Profil.Dispositif.AUTRE
        }

        const result = await modifierJeuneDuConseillerCommandHandler.handle(
          command,
          utilisateur,
          jeune
        )

        const expected: Jeune = {
          ...jeune,
          dispositif: Profil.Dispositif.AUTRE,
          peutVoirLeComptageDesHeures: false
        }
        expect(jeuneRepository.save).to.have.been.calledWithExactly(expected)
        expect(
          authentificationRepository.deleteUtilisateurIdp
        ).not.to.have.been.called()
        expect(result).to.deep.equal(emptySuccess())
      })
      it('refuse le dispositif Autre pour un bénéficiaire France Travail', async () => {
        // Given
        const jeuneFT = unJeune({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        })

        // When
        const result = await modifierJeuneDuConseillerCommandHandler.handle(
          { idJeune: jeuneFT.id, dispositif: Profil.Dispositif.AUTRE },
          utilisateur,
          jeuneFT
        )

        // Then
        expect(jeuneRepository.save).not.to.have.been.called()
        expect(result).to.deep.equal(
          failure(
            new MauvaiseCommandeError(
              'Ce dispositif n’est pas proposé pour ce bénéficiaire'
            )
          )
        )
      })
      it('met à jour le dispositif d’un bénéficiaire France Travail', async () => {
        // Given
        const jeuneFT = unJeune({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        })

        // When
        const result = await modifierJeuneDuConseillerCommandHandler.handle(
          { idJeune: jeuneFT.id, dispositif: Profil.Dispositif.BRSA },
          utilisateur,
          jeuneFT
        )

        // Then
        expect(jeuneRepository.save).to.have.been.calledWithExactly({
          ...jeuneFT,
          dispositif: Profil.Dispositif.BRSA,
          peutVoirLeComptageDesHeures: false
        })
        expect(
          authentificationRepository.deleteUtilisateurIdp
        ).to.have.been.calledOnceWithExactly(jeuneFT.id)
        expect(result).to.deep.equal(emptySuccess())
      })
      it('ne déconnecte pas le bénéficiaire quand le dispositif ne change pas', async () => {
        // Given
        const jeuneFT = unJeune({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        })

        // When
        const result = await modifierJeuneDuConseillerCommandHandler.handle(
          { idJeune: jeuneFT.id, dispositif: Profil.Dispositif.CEJ },
          utilisateur,
          jeuneFT
        )

        // Then
        expect(
          authentificationRepository.deleteUtilisateurIdp
        ).not.to.have.been.called()
        expect(result).to.deep.equal(emptySuccess())
      })
      it('refuse un dispositif qui n’est pas proposé pour la structure du bénéficiaire', async () => {
        // Given
        const jeuneFT = unJeune({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        })

        // When
        const result = await modifierJeuneDuConseillerCommandHandler.handle(
          { idJeune: jeuneFT.id, dispositif: Profil.Dispositif.PACEA },
          utilisateur,
          jeuneFT
        )

        // Then
        expect(jeuneRepository.save).not.to.have.been.called()
        expect(result).to.deep.equal(
          failure(
            new MauvaiseCommandeError(
              'Ce dispositif n’est pas proposé pour ce bénéficiaire'
            )
          )
        )
      })
    })
  })

  describe('execute — labels de handler_executed', () => {
    let logInfo: SinonStub

    beforeEach(() => {
      logInfo = stub(rootLogger, 'info')
      conseillerForJeuneAuthorizer.autoriserConseillerPourSonJeune.resolves(
        emptySuccess()
      )
    })

    afterEach(() => {
      logInfo.restore()
    })

    it("trace le dispositif de départ et celui d'arrivée", async () => {
      // Given
      const jeuneMilo = unJeune({
        structure: Profil.Structure.MILO,
        dispositif: Profil.Dispositif.PACEA
      })
      jeuneRepository.get.withArgs(jeuneMilo.id).resolves(jeuneMilo)

      // When
      await modifierJeuneDuConseillerCommandHandler.execute(
        { idJeune: jeuneMilo.id, dispositif: Profil.Dispositif.AUTRE },
        utilisateur
      )

      // Then
      expect(logInfo).to.have.been.calledWithMatch({
        context: 'ModifierJeuneDuConseillerCommandHandler',
        event: { action: 'handler_executed', outcome: 'success' },
        labels: {
          dispositif_depart: Profil.Dispositif.PACEA,
          dispositif_arrivee: Profil.Dispositif.AUTRE
        }
      })
    })
  })
})
