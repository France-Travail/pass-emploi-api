import { expect } from '../utils'
import {
  nettoyerNumeroTelephone,
  normaliserNumeroTelephone
} from '../../src/utils/telephone'

describe('telephone', () => {
  describe('nettoyerNumeroTelephone', () => {
    it('retire espaces, points et tirets', () => {
      expect(nettoyerNumeroTelephone('06 92.03-63 76')).to.equal('0692036376')
    })
  })

  describe('normaliserNumeroTelephone', () => {
    const cas: Array<[string, string, string]> = [
      ['mobile métropole', '0606060606', '0606060606'],
      ['mobile métropole avec séparateurs', '06 06 06 06 06', '0606060606'],
      ['fixe métropole', '0140000000', '0140000000'],
      ['déjà international', '+33606060606', '+33606060606'],
      ['préfixe 00', '0033606060606', '+33606060606'],
      ['mobile La Réunion', '0692036376', '+262692036376'],
      ['mobile La Réunion avec points', '06.92.03.63.76', '+262692036376'],
      ['fixe La Réunion', '0262123456', '+262262123456'],
      ['mobile Mayotte', '0639691234', '+262639691234'],
      ['mobile Guadeloupe', '0690123456', '+590690123456'],
      ['fixe Guadeloupe', '0590123456', '+590590123456'],
      ['mobile Martinique', '0696123456', '+596696123456'],
      ['mobile Guyane', '0694123456', '+594694123456'],
      ['numéro hors format national', '0692', '0692']
    ]
    for (const [libelle, entree, attendu] of cas) {
      it(`${libelle} : ${entree} -> ${attendu}`, () => {
        expect(normaliserNumeroTelephone(entree)).to.equal(attendu)
      })
    }
  })
})
