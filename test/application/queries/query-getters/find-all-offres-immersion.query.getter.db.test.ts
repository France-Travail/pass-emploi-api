import { URLSearchParams } from 'url'
import { expect } from 'chai'
import { failure, success } from '../../../../src/building-blocks/types/result'
import { ErreurHttp } from '../../../../src/building-blocks/types/domain-error'
import { TIMEOUT } from 'dns'
import { ImmersionClient } from '../../../../src/infrastructure/clients/immersion-client'
import { FindAllOffresImmersionQueryGetter } from '../../../../src/application/queries/query-getters/find-all-offres-immersion.query.getter.db'
import { StubbedClass, stubClass } from '../../../utils'

describe('FindAllOffresImmersionQueryGetter', () => {
  let immersionClient: StubbedClass<ImmersionClient>
  let findAllOffresImmersionQueryGetter: FindAllOffresImmersionQueryGetter

  beforeEach(() => {
    immersionClient = stubClass(ImmersionClient)
    findAllOffresImmersionQueryGetter = new FindAllOffresImmersionQueryGetter(
      immersionClient
    )
  })

  describe('handle', () => {
    describe('quand la requête est correcte', () => {
      it('renvoie les offres', async () => {
        // Given
        const query = {
          rome: 'D1102',
          lat: 48.502103949334845,
          lon: 2.13082255225161,
          distance: 30
        }

        const params = new URLSearchParams()
        params.append('distanceKm', query.distance.toString())
        params.append('longitude', query.lon.toString())
        params.append('latitude', query.lat.toString())
        params.append('rome', query.rome)
        params.append('sortBy', 'date')
        params.append('sortOrder', 'desc')

        immersionClient.getOffres.resolves(
          success([
            {
              rome: 'mon-rome',
              siret: 'siret',
              romeLabel: 'romeLabel',
              name: 'name',
              nafLabel: 'nafLabel',
              naf: 'naf',
              address: {
                streetNumberAndAddress: 'street',
                postcode: '75001',
                city: 'city',
                departmentCode: '75'
              },
              voluntaryToImmersion: true,
              locationId: 'locationId',
              position: { lat: 48.5, lon: 2.1 },
              appellations: [
                {
                  appellationCode: 'appellationCode',
                  appellationLabel: 'appellationCodeLabel'
                }
              ]
            }
          ])
        )

        // When
        const offres = await findAllOffresImmersionQueryGetter.handle(query)

        // Then
        expect(immersionClient.getOffres.getCall(0).args).to.be.deep.equal([
          params
        ])
        expect(offres).to.deep.equal(
          success([
            {
              id: 'siret-appellationCode',
              metier: 'appellationCodeLabel',
              nomEtablissement: 'name',
              secteurActivite: 'nafLabel',
              ville: 'city',
              estVolontaire: true,
              locationId: 'locationId'
            }
          ])
        )
      })
    })
    describe('quand la requête est mauvaise', () => {
      it('renvoie une erreur', async () => {
        // Given
        const query = {
          rome: 'PLOP',
          lat: 48.502103949334845,
          lon: 2.13082255225161,
          distance: 30
        }

        immersionClient.getOffres.resolves(
          failure(new ErreurHttp("un message d'erreur", 404))
        )

        // When
        const offres = await findAllOffresImmersionQueryGetter.handle(query)

        // Then
        expect(offres).to.deep.equal(
          failure(new ErreurHttp("un message d'erreur", 404))
        )
      })
    })
    describe('quand la requête renvoie une erreur', () => {
      it('renvoie une erreur', async () => {
        // Given
        const query = {
          rome: 'PLOP',
          lat: 48.502103949334845,
          lon: 2.13082255225161,
          distance: 30
        }

        const error: Error = new Error(TIMEOUT)

        immersionClient.getOffres.rejects(error)

        // When
        const call = findAllOffresImmersionQueryGetter.handle(query)

        // Then
        await expect(call).to.be.rejectedWith(error)
      })
    })
  })
})
