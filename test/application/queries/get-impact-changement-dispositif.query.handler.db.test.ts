import { emptySuccess, success } from 'src/building-blocks/types/result'
import {
  GetImpactChangementDispositifQuery,
  GetImpactChangementDispositifQueryHandler
} from '../../../src/application/queries/get-impact-changement-dispositif.query.handler.db'
import { ConseillerAuthorizer } from '../../../src/application/authorizers/conseiller-authorizer'
import { Core } from '../../../src/domain/core'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { expect, StubbedClass, stubClass } from '../../utils'
import { getDatabase } from '../../utils/database-for-testing'

describe('GetImpactChangementDispositifQueryHandler', () => {
  let handler: GetImpactChangementDispositifQueryHandler
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>
  const idConseiller = 'conseiller-ft'
  const idAutreConseiller = 'autre-conseiller-ft'

  before(async () => {
    await getDatabase().cleanPG()
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)
    handler = new GetImpactChangementDispositifQueryHandler(
      conseillerAuthorizer
    )

    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: idConseiller,
        structure: Core.Structure.POLE_EMPLOI
      }),
      unConseillerDto({
        id: idAutreConseiller,
        structure: Core.Structure.POLE_EMPLOI
      })
    ])
    await JeuneSqlModel.bulkCreate([
      unJeuneDto({ id: 'suivi-en-propre-1', idConseiller }),
      unJeuneDto({ id: 'suivi-en-propre-2', idConseiller }),
      unJeuneDto({
        id: 'transfere-temporairement-a-un-autre',
        idConseiller: idAutreConseiller,
        idConseillerInitial: idConseiller
      }),
      unJeuneDto({
        id: 'suivi-temporairement-pour-un-autre',
        idConseiller,
        idConseillerInitial: idAutreConseiller
      }),
      unJeuneDto({
        id: 'jeune-autre-conseiller',
        idConseiller: idAutreConseiller
      })
    ])
  })

  describe('handle', () => {
    it('compte les bénéficiaires qui suivront le dispositif et ceux qui gardent le leur', async () => {
      // When
      const result = await handler.handle({ idConseiller })

      // Then
      expect(result).to.deep.equal(
        success({
          nbBeneficiairesConcernes: 3,
          nbBeneficiairesTransferesTemporairement: 1,
          nbBeneficiairesSuivisTemporairement: 1
        })
      )
    })
  })

  describe('authorize', () => {
    it('autorise le conseiller', async () => {
      // Given
      const query: GetImpactChangementDispositifQuery = { idConseiller }
      const utilisateur = unUtilisateurConseiller({ id: idConseiller })
      conseillerAuthorizer.autoriserLeConseiller
        .withArgs(idConseiller, utilisateur)
        .resolves(emptySuccess())

      // When
      const result = await handler.authorize(query, utilisateur)

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })
  })
})
