import { ActionMiloHttpRepository } from '../../../../src/infrastructure/repositories/milo/action.milo.repository'
import { expect, StubbedClass, stubClass } from '../../../utils'
import { uneActionMilo } from '../../../fixtures/action.fixture'
import {
  emptySuccess,
  failure
} from '../../../../src/building-blocks/types/result'
import { ErreurHttp } from '../../../../src/building-blocks/types/domain-error'
import { MiloClient } from '../../../../src/infrastructure/clients/milo/milo-client'
import { ActionMilo } from '../../../../src/domain/milo/action.milo'
import { DateTime } from 'luxon'

describe('ActionMiloHttpRepository', () => {
  let repository: ActionMiloHttpRepository
  let miloClient: StubbedClass<MiloClient>

  beforeEach(() => {
    miloClient = stubClass(MiloClient)
    repository = new ActionMiloHttpRepository(miloClient)
  })

  describe('creerSituationNonProfessionnelle', () => {
    it('délègue à MiloClient.creerSituationDossier', async () => {
      // Given
      const action = uneActionMilo({ idJeune: 'id-jeune-avec-id-dossier' })
      miloClient.creerSituationDossier.resolves(emptySuccess())
      const getIdpToken = async (): Promise<string> => 'idpToken'

      // When
      const result = await repository.creerSituationNonProfessionnelle(
        action,
        getIdpToken
      )

      // Then
      expect(miloClient.creerSituationDossier).to.have.been.calledOnce()
      expect(miloClient.creerSituationDossier.firstCall.args[2]).to.equal(
        getIdpToken
      )
      expect(result).to.deep.equal(emptySuccess())
    })

    it('envoie les jours de début et de fin dans le fuseau horaire de la structure', async () => {
      // Given
      const action: ActionMilo = {
        ...uneActionMilo(),
        dateDebut: DateTime.fromISO('2026-09-16T20:00:00.000Z', {
          zone: 'utc'
        }),
        dateFinReelle: DateTime.fromISO('2026-09-17T00:00:00.000+04:00', {
          setZone: true
        }),
        timezoneStructure: 'Indian/Reunion'
      }
      miloClient.creerSituationDossier.resolves(emptySuccess())

      // When
      await repository.creerSituationNonProfessionnelle(
        action,
        async () => 'idpToken'
      )

      // Then
      const body = miloClient.creerSituationDossier.firstCall.args[1]
      expect(body.dateDebut).to.equal('2026-09-17')
      expect(body.dateFinReelle).to.equal('2026-09-17')
    })

    it('retourne le résultat de MiloClient en cas de failure', async () => {
      // Given
      const action = uneActionMilo({ idJeune: 'id-jeune-avec-id-dossier' })
      const erreur = failure(new ErreurHttp('Erreur API', 400))
      miloClient.creerSituationDossier.resolves(erreur)

      // When
      const result = await repository.creerSituationNonProfessionnelle(
        action,
        async () => 'idpToken'
      )

      // Then
      expect(result).to.deep.equal(erreur)
    })
  })
})
