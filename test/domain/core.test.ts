import {
  beneficiaireEstFTConnect,
  Core,
  estFranceTravail
} from '../../src/domain/core'
import { expect } from '../utils'

describe('Core', () => {
  describe('beneficiaireEstFTConnect', () => {
    it('inclut FT_DEMANDEUR_D_EMPLOI et FT_ESPACE_CANDIDAT', () => {
      expect(
        beneficiaireEstFTConnect(Core.Structure.FT_DEMANDEUR_D_EMPLOI)
      ).to.equal(true)
      expect(
        beneficiaireEstFTConnect(Core.Structure.FT_ESPACE_CANDIDAT)
      ).to.equal(true)
    })
  })

  describe('estFranceTravail', () => {
    it('inclut les deux nouvelles structures', () => {
      expect(estFranceTravail(Core.Structure.FT_DEMANDEUR_D_EMPLOI)).to.equal(
        true
      )
      expect(estFranceTravail(Core.Structure.FT_ESPACE_CANDIDAT)).to.equal(true)
    })
  })
})
