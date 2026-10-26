import { DateTime } from 'luxon'
import { Planificateur } from '../../src/domain/planificateur'
import { estNotifiable, SuiviJob } from '../../src/domain/suivi-job'
import { expect } from '../utils'

describe('SuiviJob', () => {
  describe('estNotifiable', () => {
    const unSuiviDeNettoyage = (succes: boolean): SuiviJob => ({
      jobType: Planificateur.JobType.NETTOYER_ARCHIVES_JEUNES,
      dateExecution: DateTime.fromISO('2026-10-23T03:00:00Z'),
      succes,
      resultat: {},
      nbErreurs: succes ? 0 : 1,
      tempsExecution: 0
    })

    it("ne notifie un nettoyage d'archives qu'en échec", () => {
      // When - Then
      expect(estNotifiable(unSuiviDeNettoyage(true))).to.be.false()
      expect(estNotifiable(unSuiviDeNettoyage(false))).to.be.true()
    })
  })
})
