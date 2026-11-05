import { ForbiddenException } from '@nestjs/common'
import * as sinon from 'sinon'
import { DroitsInsuffisants } from '../../../src/building-blocks/types/domain-error'
import { QueryHandler } from '../../../src/building-blocks/types/query-handler'
import {
  emptySuccess,
  failure,
  Result,
  success
} from '../../../src/building-blocks/types/result'
import { TOUT_PROFIL } from '../../../src/domain/profil'
import { rootLogger } from '../../../src/utils/logger.module'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { expect } from '../../utils'

class UneQueryHandler extends QueryHandler<void, Result<string>> {
  autorisation: Result = emptySuccess()
  handle: () => Promise<Result<string>> = async () => success('ok')

  constructor(readonly profilsAutorises: typeof TOUT_PROFIL = TOUT_PROFIL) {
    super('UneQueryHandler')
  }

  async authorize(): Promise<Result> {
    return this.autorisation
  }

  async monitor(): Promise<void> {
    return
  }
}

describe('QueryHandler', () => {
  let logInfo: sinon.SinonStub
  let logError: sinon.SinonStub

  const logsHandlerExecuted = (stub: sinon.SinonStub): sinon.SinonSpyCall[] =>
    stub.getCalls().filter(call => call.args[1] === 'handler_executed')

  beforeEach(() => {
    logInfo = sinon.stub(rootLogger, 'info')
    logError = sinon.stub(rootLogger, 'error')
  })

  afterEach(() => {
    logInfo.restore()
    logError.restore()
  })

  it('logue un refus de profil une seule fois, en info', async () => {
    // Given
    const handler = new UneQueryHandler([])

    // When
    const execution = handler.execute(undefined, unUtilisateurJeune())

    // Then
    await expect(execution).to.be.rejectedWith(ForbiddenException)
    expect(logsHandlerExecuted(logInfo)).to.have.length(1)
    expect(logsHandlerExecuted(logError)).to.be.empty()
  })

  it("logue un refus de l'authorizer une seule fois, en info", async () => {
    // Given
    const handler = new UneQueryHandler()
    handler.autorisation = failure(new DroitsInsuffisants())

    // When
    const execution = handler.execute(undefined, unUtilisateurJeune())

    // Then
    await expect(execution).to.be.rejectedWith(ForbiddenException)
    expect(logsHandlerExecuted(logInfo)).to.have.length(1)
    expect(logsHandlerExecuted(logError)).to.be.empty()
  })

  it('logue en error une exception levée par le handler', async () => {
    // Given
    const handler = new UneQueryHandler()
    handler.handle = async (): Promise<Result<string>> => {
      throw new Error('boom')
    }

    // When
    const execution = handler.execute(undefined, unUtilisateurJeune())

    // Then
    await expect(execution).to.be.rejectedWith('boom')
    expect(logsHandlerExecuted(logError)).to.have.length(1)
    expect(logsHandlerExecuted(logInfo)).to.be.empty()
  })
})
