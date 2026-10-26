import { expect } from '../../utils'
import { exigeTls } from '../../../src/infrastructure/sequelize/tls'

const urlAvec = (host: string, query = ''): string =>
  `postgresql://user:password@${host}:5432/db${query}`

describe('exigeTls', () => {
  const hoteDistant = 'my-app.postgresql.a.osc-fr1.scalingo-dbs.com'

  for (const sslmode of ['require', 'prefer', 'verify-ca', 'verify-full']) {
    it(`exige TLS pour sslmode=${sslmode} sur un hôte distant`, () => {
      expect(exigeTls(urlAvec(hoteDistant, `?sslmode=${sslmode}`))).to.be.true()
    })
  }

  it("n'exige pas TLS sans sslmode", () => {
    expect(exigeTls(urlAvec(hoteDistant))).to.be.false()
  })

  it("n'exige pas TLS pour sslmode=disable", () => {
    expect(exigeTls(urlAvec(hoteDistant, '?sslmode=disable'))).to.be.false()
  })

  for (const hoteLocal of ['localhost', '127.0.0.1']) {
    it(`n'exige jamais TLS sur ${hoteLocal}, même avec sslmode=require`, () => {
      expect(exigeTls(urlAvec(hoteLocal, '?sslmode=require'))).to.be.false()
    })
  }

  it("n'exige pas TLS sans URL", () => {
    expect(exigeTls(undefined)).to.be.false()
  })
})
