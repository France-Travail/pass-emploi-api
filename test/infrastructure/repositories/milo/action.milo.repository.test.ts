import { ActionMiloHttpRepository } from '../../../../src/infrastructure/repositories/milo/action.milo.repository'
import { expect, StubbedClass, stubClass } from '../../../utils'
import { uneActionMilo } from '../../../fixtures/action.fixture'
import {
  emptySuccess,
  failure
} from '../../../../src/building-blocks/types/result'
import { ErreurHttp } from '../../../../src/building-blocks/types/domain-error'
import { MiloClient } from '../../../../src/infrastructure/clients/milo/milo-client'

describe('ActionMiloHttpRepository', () => {
  let repository: ActionMiloHttpRepository
  let miloClient: StubbedClass<MiloClient>

  beforeEach(() => {
    miloClient = stubClass(MiloClient)
    repository = new ActionMiloHttpRepository(miloClient)
  })

  describe('save', () => {
    it('délègue à MiloClient.creerSituationDossier', async () => {
      // Given
      const action = uneActionMilo({ idJeune: 'id-jeune-avec-id-dossier' })
      miloClient.creerSituationDossier.resolves(emptySuccess())
      const getIdpToken = async (): Promise<string> => 'idpToken'

      // When
      const result = await repository.save(action, getIdpToken)

      // Then
      expect(miloClient.creerSituationDossier).to.have.been.calledOnce()
      expect(miloClient.creerSituationDossier.firstCall.args[2]).to.equal(
        getIdpToken
      )
      expect(result).to.deep.equal(emptySuccess())
    })

    it('retourne le résultat de MiloClient en cas de failure', async () => {
      // Given
      const action = uneActionMilo({ idJeune: 'id-jeune-avec-id-dossier' })
      const erreur = failure(new ErreurHttp('Erreur API', 400))
      miloClient.creerSituationDossier.resolves(erreur)

      // When
      const result = await repository.save(action, async () => 'idpToken')

      // Then
      expect(result).to.deep.equal(erreur)
    })
  })
})
