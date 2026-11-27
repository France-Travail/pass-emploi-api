import { JeuneMiloSansStructure } from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { ActionMilo } from '../../../src/domain/milo/action.milo'
import { JeuneMilo } from '../../../src/domain/milo/jeune.milo'
import { uneActionQualifiee } from '../../fixtures/action.fixture'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { uneConfiguration, unJeune } from '../../fixtures/jeune.fixture'
import { expect } from '../../utils'

describe('ActionMilo', () => {
  describe('creer', () => {
    const action = uneActionQualifiee()
    const utilisateur = unUtilisateurConseiller({ username: 'j.doe' })

    it('prend le fuseau horaire de la structure et pas celui du jeune', () => {
      // Given
      const jeune: JeuneMilo = {
        ...unJeune({
          idPartenaire: 'idDossier',
          configuration: uneConfiguration({ fuseauHoraire: 'Europe/Paris' })
        }),
        structureMilo: { id: 'id-structure', timezone: 'Indian/Reunion' }
      }

      // When
      const result = ActionMilo.creer(action, jeune, utilisateur)

      // Then
      expect(result).to.deep.equal(
        success({
          ...action,
          idDossier: 'idDossier',
          loginConseiller: 'j.doe',
          timezoneStructure: 'Indian/Reunion'
        })
      )
    })

    it("échoue quand le jeune n'a pas de structure", () => {
      // Given
      const jeune: JeuneMilo = { ...unJeune(), structureMilo: undefined }

      // When
      const result = ActionMilo.creer(action, jeune, utilisateur)

      // Then
      expect(result).to.deep.equal(
        failure(new JeuneMiloSansStructure(jeune.id))
      )
    })
  })
})
