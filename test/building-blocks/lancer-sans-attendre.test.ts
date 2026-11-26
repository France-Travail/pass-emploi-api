import { LoggerService } from '@nestjs/common'
import * as sinon from 'sinon'
import { lancerSansAttendre } from '../../src/building-blocks/lancer-sans-attendre'
import { expect } from '../utils'

describe('lancerSansAttendre', () => {
  let logger: LoggerService & { error: sinon.SinonStub }
  let rejetsNonGeres: unknown[]
  const surRejetNonGere = (raison: unknown): void => {
    rejetsNonGeres.push(raison)
  }

  beforeEach(() => {
    logger = { log: sinon.stub(), warn: sinon.stub(), error: sinon.stub() }
    rejetsNonGeres = []
    process.on('unhandledRejection', surRejetNonGere)
  })

  afterEach(() => {
    process.off('unhandledRejection', surRejetNonGere)
  })

  it("logue l'échec de la tâche sans rejet non intercepté", async () => {
    // Given
    const erreur = new Error('canceling statement due to statement timeout')

    // When
    lancerSansAttendre(Promise.reject(erreur), logger, 'La tâche a échoué')
    await new Promise(resolve => setImmediate(resolve))

    // Then
    expect(logger.error).to.have.been.calledOnceWithExactly({
      message: 'La tâche a échoué',
      err: erreur
    })
    expect(rejetsNonGeres).to.be.empty()
  })

  it('ne logue rien quand la tâche réussit', async () => {
    // When
    lancerSansAttendre(Promise.resolve(), logger, 'La tâche a échoué')
    await new Promise(resolve => setImmediate(resolve))

    // Then
    expect(logger.error).not.to.have.been.called()
  })
})
