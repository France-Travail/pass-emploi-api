import { HttpStatus, INestApplication } from '@nestjs/common'
import * as request from 'supertest'
import { getApplicationWithStubbedDependencies } from '../../utils/module-for-testing'

describe('AdminController', () => {
  let app: INestApplication

  before(async () => {
    app = await getApplicationWithStubbedDependencies()
  })

  describe('GET /admin/chat/:idJeune', () => {
    describe('quand la feature est inactive', () => {
      it('retourne une 403', async () => {
        // When
        await request(app.getHttpServer())
          .get('/admin/chat/test')
          .set({ 'X-API-KEY': 'api-key-admin' })
          // Then
          .expect(HttpStatus.FORBIDDEN)
      })
    })
  })
})
