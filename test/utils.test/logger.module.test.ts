import { expect } from 'chai'
import { IncomingMessage } from 'node:http'
import { pinoHttpOptions, pinoSerializers } from 'src/utils/logger.module'

describe('logger.module — pinoHttpOptions', () => {
  const req = {} as IncomingMessage

  describe('customLogLevel', () => {
    it('5xx → error', () => {
      expect(pinoHttpOptions.customLogLevel(req, { statusCode: 500 })).to.equal(
        'error'
      )
    })
    it('exception → error (même si statusCode < 500)', () => {
      expect(
        pinoHttpOptions.customLogLevel(req, { statusCode: 200 }, new Error('x'))
      ).to.equal('error')
    })
    it("4xx → info (la requête est traitée correctement, l'erreur vient du client)", () => {
      expect(pinoHttpOptions.customLogLevel(req, { statusCode: 401 })).to.equal(
        'info'
      )
    })
    it('2xx/3xx → info', () => {
      expect(pinoHttpOptions.customLogLevel(req, { statusCode: 200 })).to.equal(
        'info'
      )
    })
    it('aborted (statusCode null) → error', () => {
      expect(
        pinoHttpOptions.customLogLevel(req, {
          statusCode: null as unknown as number
        })
      ).to.equal('error')
    })
  })

  describe('messages ECS', () => {
    it('customSuccessMessage retourne "request_completed"', () => {
      expect(pinoHttpOptions.customSuccessMessage()).to.equal(
        'request_completed'
      )
    })
    it('customErrorMessage retourne "request_failed"', () => {
      expect(pinoHttpOptions.customErrorMessage()).to.equal('request_failed')
    })
  })

  describe('customSuccessObject / customErrorObject', () => {
    it('2xx injecte outcome=success', () => {
      const result = pinoHttpOptions.customSuccessObject(
        req,
        { statusCode: 200 },
        { foo: 1 }
      )
      expect(result).to.deep.include({
        foo: 1,
        event: { action: 'request_completed', outcome: 'success' }
      })
    })
    it('4xx injecte outcome=failure (erreur client, log.level reste info)', () => {
      const result = pinoHttpOptions.customSuccessObject(
        req,
        { statusCode: 404 },
        { foo: 1 }
      )
      expect(result).to.deep.include({
        event: { action: 'request_completed', outcome: 'failure' }
      })
    })
    it('aborted (statusCode null) injecte outcome=failure', () => {
      const result = pinoHttpOptions.customSuccessObject(
        req,
        { statusCode: null as unknown as number },
        { foo: 1 }
      )
      expect(result).to.deep.include({
        event: { action: 'request_completed', outcome: 'failure' }
      })
    })
    it('error injecte event.action=request_failed et outcome=failure', () => {
      const result = pinoHttpOptions.customErrorObject(
        req,
        {},
        new Error('boom'),
        { foo: 1 }
      )
      expect(result).to.deep.include({
        foo: 1,
        event: { action: 'request_failed', outcome: 'failure' }
      })
    })
  })

  describe('serializer req', () => {
    it('whitelist les headers et drop les autres', () => {
      const serialized = pinoSerializers.req({
        id: 'rid',
        method: 'GET',
        url: '/x',
        query: {},
        headers: {
          'user-agent': 'Mozilla',
          'x-real-ip': '1.2.3.4',
          'x-platform': 'ios',
          cookie: 'session=abc',
          'sec-fetch-mode': 'cors',
          host: 'api.example.com'
        }
      })
      expect(serialized).to.deep.equal({
        id: 'rid',
        method: 'GET',
        url: '/x',
        query: {},
        headers: {
          'user-agent': 'Mozilla',
          'x-real-ip': '1.2.3.4',
          'x-platform': 'ios'
        }
      })
    })
  })

  describe('serializer res', () => {
    it('ne garde que statusCode', () => {
      expect(pinoSerializers.res({ statusCode: 200 })).to.deep.equal({
        statusCode: 200
      })
    })
  })

  describe('serializer err', () => {
    it('ne garde que type/message/stack_trace pour une Error simple', () => {
      const err = new Error('boom')
      const serialized = pinoSerializers.err(err)
      expect(serialized).to.deep.equal({
        type: 'Error',
        message: 'boom',
        stack_trace: err.stack
      })
    })

    it('inclut code quand présent', () => {
      const err = Object.assign(new Error('ECONNREFUSED'), {
        code: 'ECONNREFUSED'
      })
      const serialized = pinoSerializers.err(err)
      expect(serialized).to.include({ code: 'ECONNREFUSED' })
    })

    it('drop config/request/response/isAxiosError sur une AxiosError-like', () => {
      const axiosLike = Object.assign(new Error('Request failed'), {
        name: 'AxiosError',
        isAxiosError: true,
        config: {
          headers: {
            Authorization: 'Bearer secret',
            'X-Gravitee-Api-Key': 'k'
          },
          data: '{"password":"x"}',
          url: 'https://api.i-milo.fr/x'
        },
        response: { status: 401, data: { token: 'leaked' } },
        request: { _currentRequest: { agent: { sockets: {} } } }
      })
      const serialized = pinoSerializers.err(axiosLike)
      expect(serialized).to.have.keys('type', 'message', 'stack_trace')
      expect(serialized).to.not.have.any.keys(
        'config',
        'response',
        'request',
        'isAxiosError'
      )
    })
  })
})
