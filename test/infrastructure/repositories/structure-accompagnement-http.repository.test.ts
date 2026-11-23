import { ErreurHttp } from '../../../src/building-blocks/types/domain-error'
import { failure, success } from '../../../src/building-blocks/types/result'
import { ApprentissageClient } from '../../../src/infrastructure/clients/apprentissage-client'
import { CommuneApprentissageDto } from '../../../src/infrastructure/clients/dto/apprentissage.dto'
import { AgenceFTDto } from '../../../src/infrastructure/clients/dto/pole-emploi.dto'
import { PoleEmploiClient } from '../../../src/infrastructure/clients/pole-emploi-client'
import { StructureAccompagnementHttpRepository } from '../../../src/infrastructure/repositories/structure-accompagnement-http.repository'
import { expect, StubbedClass, stubClass } from '../../utils'

function uneAgence(libelleEtendu: string): AgenceFTDto {
  return {
    code: 'OCC0075',
    codeSafir: '31037',
    libelle: libelleEtendu,
    libelleEtendu,
    type: 'APE',
    contact: { telephonePublic: '39-49' },
    adressePrincipale: {
      ligne4: '2 AVENUE DE L URSS',
      ligne6: '31400 TOULOUSE',
      communeImplantation: '31555',
      bureauDistributeur: '31400'
    }
  }
}

function uneCommune(
  insee: string,
  nomMissionLocale: string | null
): CommuneApprentissageDto {
  return {
    nom: insee,
    code: { insee, postaux: ['69003'] },
    mission_locale: nomMissionLocale
      ? {
          nom: nomMissionLocale,
          localisation: { adresse: '1 rue', cp: '69003', ville: 'LYON' },
          contact: { telephone: '04 00 00 00 00' }
        }
      : null
  }
}

describe('StructureAccompagnementHttpRepository', () => {
  let repository: StructureAccompagnementHttpRepository
  let apprentissageClient: StubbedClass<ApprentissageClient>
  let poleEmploiClient: StubbedClass<PoleEmploiClient>

  beforeEach(() => {
    apprentissageClient = stubClass(ApprentissageClient)
    poleEmploiClient = stubClass(PoleEmploiClient)
    repository = new StructureAccompagnementHttpRepository(
      apprentissageClient,
      poleEmploiClient
    )
  })

  describe('findAllAgencesFranceTravail', () => {
    it('renvoie toutes les agences FT de la commune dans leur ordre', async () => {
      // Given
      poleEmploiClient.getAgencesFTParCommune
        .withArgs('31555')
        .resolves(success([uneAgence('Agence A'), uneAgence('Agence B')]))

      // When
      const result = await repository.findAllAgencesFranceTravail(
        '31555',
        '31000'
      )

      // Then
      expect(result).to.deep.equal(
        success([
          {
            nom: 'Agence A',
            adresse: {
              ligne: '2 AVENUE DE L URSS',
              codePostal: '31400',
              ville: 'TOULOUSE'
            },
            telephone: '39-49',
            horaires: []
          },
          {
            nom: 'Agence B',
            adresse: {
              ligne: '2 AVENUE DE L URSS',
              codePostal: '31400',
              ville: 'TOULOUSE'
            },
            telephone: '39-49',
            horaires: []
          }
        ])
      )
    })

    it("appelle FT avec le code d'arrondissement pour Paris", async () => {
      // Given
      poleEmploiClient.getAgencesFTParCommune.resolves(success([]))

      // When
      await repository.findAllAgencesFranceTravail('75056', '75011')

      // Then
      expect(
        poleEmploiClient.getAgencesFTParCommune
      ).to.have.been.calledOnceWithExactly('75111')
    })

    it('renvoie une liste vide sans appeler FT quand le code postal parisien est inconnu', async () => {
      // When
      const result = await repository.findAllAgencesFranceTravail(
        '75056',
        '75000'
      )

      // Then
      expect(result).to.deep.equal(success([]))
      expect(poleEmploiClient.getAgencesFTParCommune).not.to.have.been.called()
    })

    it('retire les agences sans nom', async () => {
      // Given
      poleEmploiClient.getAgencesFTParCommune
        .withArgs('31555')
        .resolves(success([uneAgence(''), uneAgence('Agence B')]))

      // When
      const result = await repository.findAllAgencesFranceTravail(
        '31555',
        '31000'
      )

      // Then
      expect(result._isSuccess && result.data.map(s => s.nom)).to.deep.equal([
        'Agence B'
      ])
    })

    it("remonte l'échec de FT", async () => {
      // Given
      const echec = failure(new ErreurHttp('requête invalide', 400))
      poleEmploiClient.getAgencesFTParCommune.withArgs('31555').resolves(echec)

      // When
      const result = await repository.findAllAgencesFranceTravail(
        '31555',
        '31000'
      )

      // Then
      expect(result).to.deep.equal(echec)
    })

    it("remonte un refus d'accès de FT en 502 pour ne pas déconnecter l'invité", async () => {
      // Given
      poleEmploiClient.getAgencesFTParCommune
        .withArgs('31555')
        .resolves(failure(new ErreurHttp('refus', 403)))

      // When
      const result = await repository.findAllAgencesFranceTravail(
        '31555',
        '31000'
      )

      // Then
      expect(result).to.deep.equal(failure(new ErreurHttp('refus', 502)))
    })
  })

  describe('findMissionLocale', () => {
    it('ne garde que la mission locale de la commune du code INSEE', async () => {
      // Given
      apprentissageClient.rechercherCommunes
        .withArgs('69003')
        .resolves(
          success([
            uneCommune('69003', 'PLATEAU NORD VAL DE SAONE'),
            uneCommune('69123', 'DE LYON')
          ])
        )

      // When
      const result = await repository.findMissionLocale('69123', '69003')

      // Then
      expect(result).to.deep.equal(
        success({
          nom: 'Mission Locale DE LYON',
          adresse: { ligne: '1 rue', codePostal: '69003', ville: 'LYON' },
          telephone: '04 00 00 00 00',
          horaires: null
        })
      )
    })

    it('ne renvoie rien quand aucune commune ne correspond', async () => {
      // Given
      apprentissageClient.rechercherCommunes
        .withArgs('69003')
        .resolves(success([uneCommune('69003', 'PLATEAU NORD VAL DE SAONE')]))

      // When
      const result = await repository.findMissionLocale('69123', '69003')

      // Then
      expect(result).to.deep.equal(success(undefined))
    })

    it("ne renvoie rien quand la commune n'a pas de mission locale", async () => {
      // Given
      apprentissageClient.rechercherCommunes
        .withArgs('69003')
        .resolves(success([uneCommune('69123', null)]))

      // When
      const result = await repository.findMissionLocale('69123', '69003')

      // Then
      expect(result).to.deep.equal(success(undefined))
    })

    it("remonte un refus d'accès de l'API Apprentissage en 502 pour ne pas déconnecter l'invité", async () => {
      // Given
      apprentissageClient.rechercherCommunes
        .withArgs('69003')
        .resolves(failure(new ErreurHttp('clé invalide', 401)))

      // When
      const result = await repository.findMissionLocale('69123', '69003')

      // Then
      expect(result).to.deep.equal(failure(new ErreurHttp('clé invalide', 502)))
    })
  })
})
