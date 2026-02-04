import { unEvenementMilo, unEvenementMiloDto } from 'test/fixtures/milo.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { ErreurHttp } from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  success
} from '../../../../src/building-blocks/types/result'
import { EvenementMilo } from '../../../../src/domain/milo/evenement.milo'
import { MiloClient } from '../../../../src/infrastructure/clients/milo/milo-client'
import { EvenementMiloHttpRepository } from '../../../../src/infrastructure/repositories/milo/evenement-milo-http.repository'

describe('MiloEvenementsHttpRepository', () => {
  let repository: EvenementMiloHttpRepository
  let miloClient: StubbedClass<MiloClient>

  beforeEach(async () => {
    miloClient = stubClass(MiloClient)
    repository = new EvenementMiloHttpRepository(miloClient)
  })
  describe('findAllEvenements', () => {
    it("doit retourner une liste d'évènements", async () => {
      // Given
      miloClient.getEvenements.resolves(success([unEvenementMiloDto()]))

      // When
      const evenements = await repository.findAllEvenements()

      // Then
      expect(evenements).to.deep.equal([unEvenementMilo()])
    })
    it('renvoie une liste vide quand il y a un problème HTTP', async () => {
      // Given
      miloClient.getEvenements.resolves(
        failure(new ErreurHttp('Bad Request', 400))
      )

      // When
      const evenements = await repository.findAllEvenements()

      // Then
      expect(evenements).to.deep.equal([])
    })
    it('mappe les éléments de format inconnus en non traitable', async () => {
      // Given
      const unEvenementInconnuDto = unEvenementMiloDto({
        type: 'PLOP'
      })
      const unEvenementMiloInconnue = unEvenementMilo({
        objet: EvenementMilo.ObjetEvenement.NON_TRAITABLE
      })

      miloClient.getEvenements.resolves(
        success([unEvenementMiloDto(), unEvenementInconnuDto])
      )

      // When
      const evenements = await repository.findAllEvenements()

      // Then
      expect(evenements).to.deep.equal([
        unEvenementMilo(),
        unEvenementMiloInconnue
      ])
    })
  })
  describe('acquitterEvenement', () => {
    let evenement: EvenementMilo

    beforeEach(() => {
      evenement = unEvenementMilo()
    })

    it("acquitte l'evenement quand milo répond NO CONTENT", async () => {
      // Given
      miloClient.acquitterEvenement.resolves(emptySuccess())

      // When
      const result = await repository.acquitterEvenement(evenement)

      // Then
      expect(miloClient.acquitterEvenement).to.have.been.calledOnceWithExactly(
        evenement.id
      )
      expect(result).to.deep.equal(emptySuccess())
    })
    it('retourne une failure quand milo répond INTERNAL SERVER ERROR', async () => {
      // Given
      miloClient.acquitterEvenement.resolves(
        failure(new ErreurHttp('Im not a teapot', 500))
      )

      // When
      const result = await repository.acquitterEvenement(evenement)

      // Then
      expect(result).to.deep.equal(
        failure(new ErreurHttp('Im not a teapot', 500))
      )
    })
  })
})
