import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import {
  ModifierJeuneDuConseillerCommand,
  ModifierJeuneDuConseillerCommandHandler
} from '../../../src/application/commands/modifier-jeune-du-conseiller.command.handler'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../src/building-blocks/types/result'
import { Authentification } from '../../../src/domain/authentification'
import { Jeune } from '../../../src/domain/jeune/jeune'
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

  const jeune = unJeune({ structure: Profil.Structure.FRANCE_TRAVAIL })
  const command: ModifierJeuneDuConseillerCommand = {
    idJeune: jeune.id,
    idPartenaire: 'id-nouveau'
  }

  beforeEach(() => {
    conseillerForJeuneAuthorizer = stubClass(ConseillerAuthorizer)
    jeuneRepository = stubInterface(createSandbox())
    authentificationRepository = stubInterface(createSandbox())
    modifierJeuneDuConseillerCommandHandler =
      new ModifierJeuneDuConseillerCommandHandler(
        jeuneRepository,
        authentificationRepository,
        conseillerForJeuneAuthorizer
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
        conseillerPE
      )

      // Then
      expect(
        conseillerForJeuneAuthorizer.autoriserConseillerPourSonJeune
      ).to.have.been.calledOnceWithExactly(command.idJeune, conseillerPE)
    })
  })

  describe('handle', () => {
    describe('quand le jeune existe', () => {
      it('met à jour son id partenaire', async () => {
        // Given
        jeuneRepository.get.withArgs(jeune.id).resolves(jeune)

        // When
        const result =
          await modifierJeuneDuConseillerCommandHandler.handle(command)

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
        jeuneRepository.get.withArgs(jeune.id).resolves(jeune)
        const command: ModifierJeuneDuConseillerCommand = {
          idJeune: jeune.id,
          peutVoirLeComptageDesHeures: false
        }

        // When
        const result =
          await modifierJeuneDuConseillerCommandHandler.handle(command)

        // Then
        const expected: Jeune = {
          ...jeune,
          peutVoirLeComptageDesHeures: command.peutVoirLeComptageDesHeures
        }
        expect(jeuneRepository.save).to.have.been.calledWithExactly(expected)
        expect(result).to.deep.equal(emptySuccess())
      })
      it('met à jour dispositif CEJ vers PACEA et modifie peutVoirLeComptageDesHeures à false ', async () => {
        const jeune = unJeune({
          structure: Profil.Structure.MILO,
          dispositif: Profil.Dispositif.CEJ
        })
        jeuneRepository.get.withArgs(jeune.id).resolves(jeune)
        const command: ModifierJeuneDuConseillerCommand = {
          idJeune: jeune.id,
          dispositif: Profil.Dispositif.PACEA
        }

        const result =
          await modifierJeuneDuConseillerCommandHandler.handle(command)

        const expected: Jeune = {
          ...jeune,
          dispositif: Profil.Dispositif.PACEA,
          peutVoirLeComptageDesHeures: false
        }
        expect(jeuneRepository.save).to.have.been.calledWithExactly(expected)
        expect(result).to.deep.equal(emptySuccess())
      })
      it('met à jour le dispositif d’un bénéficiaire France Travail', async () => {
        // Given
        const jeuneFT = unJeune({
          structure: Profil.Structure.FRANCE_TRAVAIL,
          dispositif: Profil.Dispositif.CEJ
        })
        jeuneRepository.get.withArgs(jeuneFT.id).resolves(jeuneFT)

        // When
        const result = await modifierJeuneDuConseillerCommandHandler.handle({
          idJeune: jeuneFT.id,
          dispositif: Profil.Dispositif.BRSA
        })

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
        jeuneRepository.get.withArgs(jeuneFT.id).resolves(jeuneFT)

        // When
        const result = await modifierJeuneDuConseillerCommandHandler.handle({
          idJeune: jeuneFT.id,
          dispositif: Profil.Dispositif.CEJ
        })

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
        jeuneRepository.get.withArgs(jeuneFT.id).resolves(jeuneFT)

        // When
        const result = await modifierJeuneDuConseillerCommandHandler.handle({
          idJeune: jeuneFT.id,
          dispositif: Profil.Dispositif.PACEA
        })

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

    describe("quand le jeune n'existe pas", () => {
      it('renvoie une erreur', async () => {
        // Given
        jeuneRepository.get.withArgs(jeune.id).resolves(undefined)

        // When
        const result =
          await modifierJeuneDuConseillerCommandHandler.handle(command)

        // Then
        expect(jeuneRepository.save).not.to.have.been.called()
        expect(result).to.deep.equal(
          failure(new NonTrouveError('Jeune', command.idJeune))
        )
      })
    })
  })
})
