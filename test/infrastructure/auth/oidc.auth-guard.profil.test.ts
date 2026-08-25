import { INestApplication } from '@nestjs/common'
import { JWTPayload } from 'jose'
import * as request from 'supertest'
import { Profil } from '../../../src/domain/profil'
import { JwtService } from '../../../src/infrastructure/auth/jwt.service'
import {
  unHeaderAuthorization,
  unJwtPayloadValideJeunePEBRSA
} from '../../fixtures/authentification.fixture'
import { unProfilFT, unProfilMilo } from '../../fixtures/profil.fixture'
import { buildTestingModuleForHttpTesting, expect } from '../../utils'
import { FakeJwtService } from '../../utils/module-for-testing'

async function appAvecPayload(payload: JWTPayload): Promise<INestApplication> {
  const testingModule = await buildTestingModuleForHttpTesting()
    .overrideProvider(JwtService)
    .useValue(new FakeJwtService(true, payload))
    .compile()
  const app = testingModule.createNestApplication()
  await app.init()
  return app
}

describe('OidcAuthGuard — profil du claim', () => {
  it('lit le claim userProfile quand connect le fournit', async () => {
    // Given
    const app = await appAvecPayload({
      ...unJwtPayloadValideJeunePEBRSA(),
      userProfile: {
        structure: Profil.Structure.MILO,
        dispositif: Profil.Dispositif.PACEA
      }
    })

    // When
    const response = await request(app.getHttpServer())
      .get('/fake/utilisateur')
      .set('authorization', unHeaderAuthorization())

    // Then
    expect(response.body.profil).to.deep.equal(
      unProfilMilo(Profil.Dispositif.PACEA)
    )
    await app.close()
  })

  it('se replie sur userStructure (legacy) tant que le token ne porte pas de profil', async () => {
    // Given
    const app = await appAvecPayload(unJwtPayloadValideJeunePEBRSA())

    // When
    const response = await request(app.getHttpServer())
      .get('/fake/utilisateur')
      .set('authorization', unHeaderAuthorization())

    // Then
    expect(response.body.profil).to.deep.equal(
      unProfilFT(Profil.Dispositif.BRSA)
    )
    await app.close()
  })

  it('ignore un userProfile malformé et se replie sur userStructure', async () => {
    // Given
    const app = await appAvecPayload({
      ...unJwtPayloadValideJeunePEBRSA(),
      userProfile: { structure: 'N_IMPORTE_QUOI' }
    })

    // When
    const response = await request(app.getHttpServer())
      .get('/fake/utilisateur')
      .set('authorization', unHeaderAuthorization())

    // Then
    expect(response.body.profil).to.deep.equal(
      unProfilFT(Profil.Dispositif.BRSA)
    )
    await app.close()
  })
})
