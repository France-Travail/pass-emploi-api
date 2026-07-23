import {
  beneficiaireEstFTConnect,
  Core,
  estFranceTravail,
  estDemandeurDEmploiFT
} from '../../src/domain/core'
import { expect } from '../utils'

describe('Core', () => {
  describe('estDemandeurDEmploiFT', () => {
    it('autorise un FT_DEMANDEUR_D_EMPLOI', () => {
      expect(
        estDemandeurDEmploiFT(Core.Structure.FT_DEMANDEUR_D_EMPLOI)
      ).to.equal(true)
    })

    it('autorise un bénéficiaire FT classique', () => {
      expect(estDemandeurDEmploiFT(Core.Structure.POLE_EMPLOI)).to.equal(true)
    })

    it('refuse un FT_ESPACE_CANDIDAT', () => {
      expect(estDemandeurDEmploiFT(Core.Structure.FT_ESPACE_CANDIDAT)).to.equal(
        false
      )
    })

    it('refuse un MILO', () => {
      expect(estDemandeurDEmploiFT(Core.Structure.MILO)).to.equal(false)
    })
  })

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
