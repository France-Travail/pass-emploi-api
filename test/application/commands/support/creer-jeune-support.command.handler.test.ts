import { createSandbox, SinonSandbox, SinonStub } from 'sinon'
import {
  CreateJeuneCommand,
  CreerJeunePoleEmploiCommandHandler
} from '../../../../src/application/commands/pole-emploi/creer-jeune-pole-emploi.command.handler'
import {
  CreerJeunePESupportCommand,
  CreerJeunePESupportCommandHandler
} from '../../../../src/application/commands/support/creer-jeune-pe-support-command-handler.service'
import { MauvaiseCommandeError } from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  isFailure,
  success
} from '../../../../src/building-blocks/types/result'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { unConseillerDuJeune, unJeune } from '../../../fixtures/jeune.fixture'
import { expect, stubClass } from '../../../utils'
import { rootLogger } from '../../../../src/utils/logger.module'

describe('CreerJeuneSupportCommandHandler', () => {
  let handler: CreerJeunePESupportCommandHandler
  let creerJeunePoleEmploiCommandHandler: CreerJeunePoleEmploiCommandHandler
  let logInfo: SinonStub
  const sandbox: SinonSandbox = createSandbox()

  beforeEach(() => {
    creerJeunePoleEmploiCommandHandler = stubClass(
      CreerJeunePoleEmploiCommandHandler
    )
    handler = new CreerJeunePESupportCommandHandler(
      creerJeunePoleEmploiCommandHandler
    )
    logInfo = sandbox.stub(rootLogger, 'info')
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('autorise : le profil support est déjà garanti par profilsAutorises', async () => {
    // When
    const result = await handler.authorize()

    // Then
    expect(result).to.deep.equal(emptySuccess())
  })

  it('crée un jeune avec la logique PE/FT et trace la création support', async () => {
    // Given
    const command: CreerJeunePESupportCommand = {
      idConseiller: 'id-conseiller',
      firstName: 'Prenom',
      lastName: 'Nom',
      email: 'JEUNE@EXAMPLE.COM',
      motif: 'Conseiller absent'
    }
    const jeune: Jeune = unJeune({
      id: 'id-jeune',
      conseiller: unConseillerDuJeune({ id: command.idConseiller })
    })
    const commandDelegue: CreateJeuneCommand = command
    const handleStub = creerJeunePoleEmploiCommandHandler.handle as SinonStub<
      [CreateJeuneCommand],
      Promise<ReturnType<typeof success<Jeune>>>
    >
    handleStub.withArgs(commandDelegue).resolves(success(jeune))

    // When
    const result = await handler.handle(command)

    // Then
    expect(result).to.deep.equal(success(jeune))
    expect(
      creerJeunePoleEmploiCommandHandler.handle
    ).to.have.been.calledOnceWithExactly(command)
    expect(logInfo).to.have.been.calledOnceWithExactly(
      {
        labels: {
          action: 'creation_jeune_support',
          id_conseiller: command.idConseiller,
          id_jeune: jeune.id,
          motif: command.motif
        }
      },
      'creation_jeune_support'
    )
  })

  it("échoue proprement quand le conseiller cible n'a pas une structure éligible", async () => {
    // Given
    const command: CreerJeunePESupportCommand = {
      idConseiller: 'id-conseiller-milo',
      firstName: 'Prenom',
      lastName: 'Nom',
      email: 'jeune@example.com'
    }
    const handleStub = creerJeunePoleEmploiCommandHandler.handle as SinonStub<
      [CreateJeuneCommand],
      Promise<ReturnType<typeof success<Jeune>>>
    >
    handleStub.rejects(new Error('structure non supportée'))

    // When
    const result = await handler.handle(command)

    // Then
    expect(isFailure(result)).to.equal(true)
    if (isFailure(result)) {
      expect(result.error).to.be.instanceOf(MauvaiseCommandeError)
    }
    expect(logInfo).not.to.have.been.called()
  })
})
