import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { createSandbox } from 'sinon'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import { GetFonctionnalitesJeuneQueryHandler } from '../../../src/application/queries/get-fonctionnalites-jeune.query.handler'
import { Fonctionnalite } from '../../../src/domain/fonctionnalite'
import { success } from '../../../src/building-blocks/types/result'
import { TOUT_PROFIL_SAUF_INVITE } from '../../../src/domain/profil'
import { DateService } from '../../../src/utils/date-service'
import { unUtilisateurJeune } from '../../fixtures/authentification.fixture'
import { StubbedClass, expect, stubClass } from '../../utils'

describe('GetFonctionnalitesJeuneQueryHandler', () => {
  const maintenant = DateTime.fromISO('2026-09-11T12:00:00.000Z')

  let fonctionnaliteRepository: StubbedType<Fonctionnalite.Repository>
  let dateService: StubbedClass<DateService>
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let handler: GetFonctionnalitesJeuneQueryHandler

  beforeEach(() => {
    const sandbox = createSandbox()
    fonctionnaliteRepository = stubInterface<Fonctionnalite.Repository>(sandbox)
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    handler = new GetFonctionnalitesJeuneQueryHandler(
      fonctionnaliteRepository,
      dateService,
      jeuneAuthorizer
    )
  })

  describe('handle', () => {
    it('renvoie les ids des fonctionnalités actives du jeune', async () => {
      // Given
      fonctionnaliteRepository.getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire
        .withArgs('idJeune', maintenant)
        .resolves(['PLAN_D_ACTION'])

      // When
      const result = await handler.handle({ idJeune: 'idJeune' })

      // Then
      expect(result).to.deep.equal(
        success({ fonctionnalites: ['PLAN_D_ACTION'] })
      )
    })

    it("renvoie une liste vide quand aucune fonctionnalité n'est active", async () => {
      // Given
      fonctionnaliteRepository.getIdsDesFonctionnalitesActivesDuConseillerDuBeneficiaire.resolves(
        []
      )

      // When
      const result = await handler.handle({ idJeune: 'idJeune' })

      // Then
      expect(result).to.deep.equal(success({ fonctionnalites: [] }))
    })
  })

  describe('authorize', () => {
    it('autorise un jeune', async () => {
      // When
      await handler.authorize({ idJeune: 'idJeune' }, unUtilisateurJeune())

      // Then
      expect(jeuneAuthorizer.autoriserLeJeune).to.have.been.calledWithExactly(
        'idJeune',
        unUtilisateurJeune()
      )
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(handler.profilsAutorises).to.deep.equal(TOUT_PROFIL_SAUF_INVITE)
    })
  })
})
