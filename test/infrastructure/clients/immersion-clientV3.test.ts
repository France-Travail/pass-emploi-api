import { HttpService } from '@nestjs/axios'
import { expect } from 'chai'
import * as nock from 'nock'
import { testConfig } from '../../utils/test-config'
import { ImmersionClient } from '../../../src/infrastructure/clients/immersion-client'
import { URLSearchParams } from 'url'
import { success } from '../../../src/building-blocks/types/result'

describe('ImmersionClient', () => {
  let immersionClient: ImmersionClient
  const configService = testConfig()

  beforeEach(() => {
    const httpService = new HttpService()

    immersionClient = new ImmersionClient(httpService, configService)
  })

  describe('get', () => {
    it('fait un http get avec les bons paramètres', async () => {
      // Given
      const resultat = { siret: 'siret', name: 'name' }
      nock('https://api.api-immersion.beta.gouv.op')
        .get('/v3/offers/siret/appellationCode/locationId')
        .reply(200, resultat)
        .isDone()

      // When
      const response = await immersionClient.get(
        'v3/offers/siret/appellationCode/locationId'
      )

      // Then
      expect(response.status).to.equal(200)
      expect(response.data).to.deep.equal(resultat)
    })
  })

  describe('getOffres', () => {
    it('fait un http get avec les bons paramètres', async () => {
      // Given
      const offre = {
        rome: 'D1102',
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
      const apiResponse = {
        data: [offre],
        pagination: {
          totalRecords: 1,
          currentPage: 1,
          totalPages: 1,
          numberPerPage: 100
        }
      }

      const params = new URLSearchParams()
      params.append('distanceKm', '30')
      params.append('longitude', '2.13082255225161')
      params.append('latitude', '48.502103949334845')
      params.append('rome', 'D1102')
      params.append('sortBy', 'date')
      params.append('sortOrder', 'desc')

      nock('https://api.api-immersion.beta.gouv.op')
        .get(
          '/v3/offers?distanceKm=30&longitude=2.13082255225161&latitude=48.502103949334845&rome=D1102&sortBy=date&sortOrder=desc'
        )
        .reply(200, apiResponse)
        .isDone()

      // When
      const response = await immersionClient.getOffresV3(params)

      // Then
      expect(response).to.deep.equal(success(apiResponse))
    })
  })

  describe('getDetailOffre', () => {
    it('fait un http get avec les bons paramètres', async () => {
      // Given
      const offre = {
        rome: 'D1102',
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

      nock('https://api.api-immersion.beta.gouv.op')
        .get('/v3/offers/siret/appellationCode/locationId')
        .reply(200, offre)
        .isDone()

      // When
      const response = await immersionClient.getDetailOffreV3(
        'siret/appellationCode/locationId'
      )

      // Then
      expect(response).to.deep.equal(success(offre))
    })
  })

  describe('postFormulaireImmersion', () => {
    it('fait un appel en succes', async () => {
      // Given
      const params = {
        kind: 'IF' as const,
        appellationCode: '11573',
        siret: 'siret',
        locationId: 'un-location-id',
        potentialBeneficiaryFirstName: 'potentialBeneficiaryFirstName',
        potentialBeneficiaryLastName: 'potentialBeneficiaryLastName',
        potentialBeneficiaryEmail: 'potentialBeneficiaryEmail',
        potentialBeneficiaryPhone: 'non communiqué',
        immersionObjective: "Découvrir un métier ou un secteur d'activité",
        contactMode: 'EMAIL',
        experienceAdditionalInformation: 'test',
        numeroTelephone: '0606060606',
        datePreferences: 'Dès que possible'
      }

      nock('https://api.api-immersion.beta.gouv.op')
        .post('/v3/apply-to-offer', params)
        .reply(200, {})
        .isDone()

      // When
      const response =
        await immersionClient.envoyerFormulaireImmersionV3(params)

      // Then
      expect(response._isSuccess).to.equal(true)
    })
    it('fait un appel en echec et renvoie une failure', async () => {
      // Given
      const params = {
        kind: 'IF' as const,
        appellationCode: '11573',
        siret: 'siret',
        locationId: 'un-location-id',
        potentialBeneficiaryFirstName: 'potentialBeneficiaryFirstName',
        potentialBeneficiaryLastName: 'potentialBeneficiaryLastName',
        potentialBeneficiaryEmail: 'potentialBeneficiaryEmail',
        potentialBeneficiaryPhone: 'non communiqué',
        immersionObjective: "Découvrir un métier ou un secteur d'activité",
        contactMode: 'EMAIL',
        experienceAdditionalInformation: 'test',
        numeroTelephone: '0606060606',
        datePreferences: 'Dès que possible'
      }

      nock('https://api.api-immersion.beta.gouv.op')
        .post('/v3/apply-to-offer', params)
        .reply(429, {})
        .isDone()

      // When
      const response =
        await immersionClient.envoyerFormulaireImmersionV3(params)

      // Then
      expect(response._isSuccess).to.equal(false)
    })
  })
})
