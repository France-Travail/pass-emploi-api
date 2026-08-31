import { expect } from 'chai'
import * as sinon from 'sinon'
import axios, { AxiosError, AxiosResponse } from 'axios'
import { attachExternalApiLogger } from 'src/utils/external-api-logger.service'

type EmitArgs = ['info' | 'error', Record<string, unknown>, string]

describe('attachExternalApiLogger', () => {
  let emit: sinon.SinonSpy<EmitArgs>

  beforeEach(() => {
    emit = sinon.spy() as sinon.SinonSpy<EmitArgs>
  })

  describe('appel sortant success', () => {
    it('emit info "external_api_call" avec event/http/url ECS et durée', async () => {
      const instance = axios.create()
      instance.defaults.adapter = (config): Promise<AxiosResponse> =>
        Promise.resolve({
          status: 200,
          statusText: 'OK',
          data: { ok: true },
          headers: {},
          config
        })

      attachExternalApiLogger(instance, emit, () => false)

      await instance.get('https://api.example.com/foo/bar')

      expect(emit.calledOnce).to.equal(true)
      const [level, obj, msg] = emit.firstCall.args
      expect(level).to.equal('info')
      expect(msg).to.equal('external_api_call')
      expect(obj.event).to.deep.include({
        action: 'external_api_call',
        outcome: 'success'
      })
      expect((obj.event as { duration: number }).duration).to.be.a('number')
      expect(obj.http).to.deep.equal({
        request: { method: 'GET' },
        response: { status_code: 200 }
      })
      expect(obj.url).to.deep.equal({
        path: '/foo/bar',
        domain: 'api.example.com'
      })
      expect(obj.error).to.equal(undefined)
    })
  })

  describe('appel sortant failure 4xx', () => {
    it('emit info (échec géré) ECS avec error.* et http.response.body.content', async () => {
      const instance = axios.create()
      const axiosError = Object.assign(new Error('boom'), {
        name: 'AxiosError',
        isAxiosError: true,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: { code: 'INVALID_TOKEN', message: 'token expiré' },
          headers: {
            'WWW-Authenticate': 'Bearer error="invalid_token"',
            'set-cookie': 'secret=should-not-be-logged'
          },
          config: {
            method: 'get',
            url: 'https://api.example.com/secret'
          }
        },
        config: {
          method: 'get',
          url: 'https://api.example.com/secret',
          headers: {}
        },
        toJSON: (): Record<string, unknown> => ({})
      }) as unknown as AxiosError
      instance.defaults.adapter = sinon.stub().rejects(axiosError)

      attachExternalApiLogger(instance, emit, () => false)

      try {
        await instance.get('https://api.example.com/secret')
      } catch {
        // attendu
      }

      expect(emit.calledOnce).to.equal(true)
      const [level, obj] = emit.firstCall.args
      // 4xx = échec géré → info/failure (5xx + réseau → error, cf. isCrash)
      expect(level).to.equal('info')
      expect(obj.event).to.deep.include({
        action: 'external_api_call',
        outcome: 'failure'
      })
      // www-authenticate capturé (cause du 401) ; set-cookie ignoré (hors allowlist)
      expect(obj.http).to.deep.equal({
        request: { method: 'GET' },
        response: {
          status_code: 401,
          body: {
            content: '{"code":"INVALID_TOKEN","message":"token expiré"}'
          },
          headers: { www_authenticate: 'Bearer error="invalid_token"' }
        }
      })
      expect(obj.error).to.deep.include({
        type: 'AxiosError',
        message: 'boom'
      })
      expect((obj.error as { stack_trace?: string }).stack_trace).to.be.a(
        'string'
      )
    })

    it('tronque le body de réponse au-delà de la limite', async () => {
      const instance = axios.create()
      const longBody = 'x'.repeat(5000)
      const axiosError = Object.assign(new Error('boom'), {
        name: 'AxiosError',
        isAxiosError: true,
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: longBody,
          headers: {},
          config: { method: 'get', url: 'https://api.example.com/big' }
        },
        config: {
          method: 'get',
          url: 'https://api.example.com/big',
          headers: {}
        },
        toJSON: (): Record<string, unknown> => ({})
      }) as unknown as AxiosError
      instance.defaults.adapter = sinon.stub().rejects(axiosError)

      attachExternalApiLogger(instance, emit, () => false)

      try {
        await instance.get('https://api.example.com/big')
      } catch {
        // attendu
      }

      const [, obj] = emit.firstCall.args
      const body = (obj.http as { response: { body: { content: string } } })
        .response.body.content
      expect(body.endsWith('...[truncated]')).to.equal(true)
      expect(body.length).to.equal(4096 + '...[truncated]'.length)
    })
  })

  describe('appel sortant network failure (sans response)', () => {
    it('emit error.* ECS sans http.response', async () => {
      const instance = axios.create()
      const netError = Object.assign(new Error('ENOTFOUND'), {
        name: 'AxiosError',
        isAxiosError: true,
        code: 'ENOTFOUND',
        config: {
          method: 'get',
          url: 'https://nope.invalid/x',
          headers: {}
        },
        toJSON: (): Record<string, unknown> => ({})
      }) as unknown as AxiosError
      instance.defaults.adapter = sinon.stub().rejects(netError)

      attachExternalApiLogger(instance, emit, () => false)

      try {
        await instance.get('https://nope.invalid/x')
      } catch {
        // attendu
      }

      const [level, obj] = emit.firstCall.args
      expect(level).to.equal('error')
      expect(obj.http).to.deep.equal({ request: { method: 'GET' } })
      expect(obj.url).to.deep.equal({
        path: '/x',
        domain: 'nope.invalid'
      })
      expect(obj.error).to.deep.include({
        type: 'AxiosError',
        message: 'ENOTFOUND'
      })
    })
  })

  describe('appel sortant transport failure sur status 200', () => {
    it('emit error/failure quand axios rejette malgré un status < 400 (body tronqué)', async () => {
      const instance = axios.create()
      const abortError = Object.assign(new Error('aborted'), {
        name: 'Error',
        isAxiosError: true,
        code: 'ECONNRESET',
        config: {
          method: 'get',
          url: 'https://api.i-milo.fr/dossiers/1',
          headers: {}
        },
        response: { status: 200, data: undefined },
        toJSON: (): Record<string, unknown> => ({})
      }) as unknown as AxiosError
      instance.defaults.adapter = sinon.stub().rejects(abortError)

      attachExternalApiLogger(instance, emit, () => false)

      try {
        await instance.get('https://api.i-milo.fr/dossiers/1')
      } catch {
        // attendu
      }

      const [level, obj] = emit.firstCall.args
      // status 200 mais err présent = panne de transport → error, pas info
      expect(level).to.equal('error')
      expect(obj.event).to.deep.include({
        action: 'external_api_call',
        outcome: 'failure'
      })
      expect(obj.http).to.deep.include({
        response: { status_code: 200 }
      })
      expect(obj.error).to.deep.include({
        type: 'Error',
        message: 'aborted'
      })
    })
  })
})
