import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { FonctionnaliteAuthorizer } from '../../../src/application/authorizers/fonctionnalite-authorizer'
import { DroitsInsuffisants } from '../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure
} from '../../../src/building-blocks/types/result'
import { Fonctionnalite } from '../../../src/domain/fonctionnalite'
import { Profil } from '../../../src/domain/profil'
import { DateService } from '../../../src/utils/date-service'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'

describe('FonctionnaliteAuthorizer', () => {
  const maintenant = DateTime.fromISO('2026-10-16T12:00:00.000Z')
  let authorizer: FonctionnaliteAuthorizer
  let fonctionnaliteRepository: StubbedType<Fonctionnalite.Repository>
  let dateService: StubbedClass<DateService>

  beforeEach(() => {
    fonctionnaliteRepository = stubInterface(createSandbox())
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    authorizer = new FonctionnaliteAuthorizer(
      fonctionnaliteRepository,
      dateService
    )
  })

  describe('autoriserLeDispositifPourLeConseiller', () => {
    it('autorise un dispositif autre que Autre sans consulter les fonctionnalités', async () => {
      // When
      const result = await authorizer.autoriserLeDispositifPourLeConseiller(
        'id-conseiller',
        Profil.Dispositif.PACEA
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        fonctionnaliteRepository.getIdsFonctionnalitesActivesDuConseiller
      ).not.to.have.been.called()
    })

    it('autorise une commande sans dispositif', async () => {
      // When
      const result = await authorizer.autoriserLeDispositifPourLeConseiller(
        'id-conseiller',
        undefined
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })

    it('autorise Autre quand la fonctionnalité est active pour le conseiller', async () => {
      // Given
      fonctionnaliteRepository.getIdsFonctionnalitesActivesDuConseiller
        .withArgs('id-conseiller', maintenant)
        .resolves([Fonctionnalite.Id.DISPOSITIF_AUTRE])

      // When
      const result = await authorizer.autoriserLeDispositifPourLeConseiller(
        'id-conseiller',
        Profil.Dispositif.AUTRE
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
    })

    it('refuse Autre quand la fonctionnalité est inactive pour le conseiller', async () => {
      // Given
      fonctionnaliteRepository.getIdsFonctionnalitesActivesDuConseiller
        .withArgs('id-conseiller', maintenant)
        .resolves(['PLAN_ACTION'])

      // When
      const result = await authorizer.autoriserLeDispositifPourLeConseiller(
        'id-conseiller',
        Profil.Dispositif.AUTRE
      )

      // Then
      expect(result).to.deep.equal(failure(new DroitsInsuffisants()))
    })
  })
})
