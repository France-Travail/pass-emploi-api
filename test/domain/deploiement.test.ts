import { DateTime } from 'luxon'
import { MauvaiseCommandeError } from '../../src/building-blocks/types/domain-error'
import { failure, success } from '../../src/building-blocks/types/result'
import { Deploiement } from '../../src/domain/deploiement'
import { expect } from '../utils'

describe('Deploiement', () => {
  const dateActivation = DateTime.fromISO('2026-10-13T00:00:00.000Z')

  describe('creer', () => {
    it('crée un déploiement de fonctionnalité', () => {
      // When
      const result = Deploiement.creer({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE_1J1S',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation
      })

      // Then
      expect(result).to.deep.equal(
        success({
          nature: Deploiement.Nature.FONCTIONNALITE,
          idPopulation: 'PILOTE_1J1S',
          idFonctionnalite: 'PLAN_D_ACTION',
          dateActivation
        })
      )
    })

    it('crée un déploiement de migration sans fonctionnalité', () => {
      // When
      const result = Deploiement.creer({
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PHASE_C',
        dateActivation
      })

      // Then
      expect(result).to.deep.equal(
        success({
          nature: Deploiement.Nature.MIGRATION,
          idPopulation: 'PHASE_C',
          idFonctionnalite: undefined,
          dateActivation
        })
      )
    })

    it('refuse une fonctionnalité sans idFonctionnalite', () => {
      // When
      const result = Deploiement.creer({
        nature: Deploiement.Nature.FONCTIONNALITE,
        idPopulation: 'PILOTE_1J1S',
        dateActivation
      })

      // Then
      expect(result).to.deep.equal(
        failure(
          new MauvaiseCommandeError(
            'Un déploiement de nature FONCTIONNALITE exige idFonctionnalite'
          )
        )
      )
    })

    it('refuse une migration avec idFonctionnalite', () => {
      // When
      const result = Deploiement.creer({
        nature: Deploiement.Nature.MIGRATION,
        idPopulation: 'PHASE_C',
        idFonctionnalite: 'PLAN_D_ACTION',
        dateActivation
      })

      // Then
      expect(result).to.deep.equal(
        failure(
          new MauvaiseCommandeError(
            'Un déploiement de nature MIGRATION ne porte pas de fonctionnalité'
          )
        )
      )
    })
  })
})
