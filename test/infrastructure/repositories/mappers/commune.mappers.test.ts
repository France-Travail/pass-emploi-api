import { Commune } from '../../../../src/infrastructure/repositories/mappers/commune.mappers'
import { expect } from '../../../utils'

describe('Commune', () => {
  describe('codeInseeArrondissement', () => {
    it('renvoie le code INSEE tel quel hors Paris, Lyon, Marseille', () => {
      expect(Commune.codeInseeArrondissement('31555', '31000')).to.equal(
        '31555'
      )
    })

    it("déduit le code d'arrondissement parisien du code postal", () => {
      expect(Commune.codeInseeArrondissement('75056', '75011')).to.equal(
        '75111'
      )
      expect(Commune.codeInseeArrondissement('75056', '75020')).to.equal(
        '75120'
      )
      expect(Commune.codeInseeArrondissement('75056', '75116')).to.equal(
        '75116'
      )
    })

    it("déduit le code d'arrondissement de Lyon et Marseille du code postal", () => {
      expect(Commune.codeInseeArrondissement('69123', '69003')).to.equal(
        '69383'
      )
      expect(Commune.codeInseeArrondissement('13055', '13016')).to.equal(
        '13216'
      )
    })

    it('ne renvoie rien quand le code postal ne correspond à aucun arrondissement', () => {
      expect(
        Commune.codeInseeArrondissement('75056', '75000')
      ).to.be.undefined()
      expect(
        Commune.codeInseeArrondissement('13055', '13100')
      ).to.be.undefined()
    })

    it('couvre le premier et le dernier arrondissement de chaque ville', () => {
      expect(Commune.codeInseeArrondissement('75056', '75001')).to.equal(
        '75101'
      )
      expect(Commune.codeInseeArrondissement('69123', '69001')).to.equal(
        '69381'
      )
      expect(Commune.codeInseeArrondissement('69123', '69009')).to.equal(
        '69389'
      )
      expect(Commune.codeInseeArrondissement('13055', '13001')).to.equal(
        '13201'
      )
    })

    it("ne renvoie rien quand le code postal est celui d'une autre ville", () => {
      expect(
        Commune.codeInseeArrondissement('69123', '75116')
      ).to.be.undefined()
      expect(
        Commune.codeInseeArrondissement('13055', '75011')
      ).to.be.undefined()
    })

    it('renvoie un code INSEE corse tel quel', () => {
      expect(Commune.codeInseeArrondissement('2A004', '20000')).to.equal(
        '2A004'
      )
    })
  })
})
