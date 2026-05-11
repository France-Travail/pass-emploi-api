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

      attachExternalApiLogger(instance, emit)

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
      expect(obj.err).to.equal(undefined)
    })
  })

  describe('appel sortant failure 4xx', () => {
    it('emit error avec outcome=failure et err propagé', async () => {
      const instance = axios.create()
      const axiosError = Object.assign(new Error('boom'), {
        name: 'AxiosError',
        isAxiosError: true,
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: {},
          headers: {},
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

      attachExternalApiLogger(instance, emit)

      try {
        await instance.get('https://api.example.com/secret')
      } catch {
        // attendu
      }

      expect(emit.calledOnce).to.equal(true)
      const [level, obj] = emit.firstCall.args
      expect(level).to.equal('error')
      expect(obj.event).to.deep.include({
        action: 'external_api_call',
        outcome: 'failure'
      })
      expect(obj.http).to.deep.equal({
        request: { method: 'GET' },
        response: { status_code: 401 }
      })
      expect(obj.err).to.equal(axiosError)
    })
  })

  describe('appel sortant network failure (sans response)', () => {
    it('emit error sans http.response.status_code', async () => {
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

      attachExternalApiLogger(instance, emit)

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
    })
  })
})
