import { HttpService } from '@nestjs/axios'
import { expect } from 'chai'
import { DateTime } from 'luxon'
import * as nock from 'nock'
import {
  emptySuccess,
  failure,
  isFailure,
  isSuccess,
  success
} from 'src/building-blocks/types/result'
import { ErreurHttp } from 'src/building-blocks/types/domain-error'
import { MiloClient } from 'src/infrastructure/clients/milo-client'
import {
  unDetailSessionConseillerDto,
  unDetailSessionJeuneDto,
  uneInscriptionSessionMiloDto,
  uneListeDeStructuresConseillerMiloDto,
  uneListeSessionsConseillerDto,
  uneListeSessionsJeuneDto,
  uneStructureConseillerMiloDto
} from 'test/fixtures/milo-dto.fixture'
import { testConfig } from 'test/utils/module-for-testing'
import {
  MILO_INSCRIT,
  MILO_PRESENT,
  MILO_REFUS_JEUNE,
  MILO_REFUS_TIERS
} from '../../../src/infrastructure/clients/dto/milo.dto'
import { initializeAPMAgent } from '../../../src/infrastructure/monitoring/apm.init'
import { RateLimiterService } from '../../../src/utils/rate-limiter.service'
import { DateService } from '../../../src/utils/date-service'
import { StubbedClass, stubClass } from '../../utils'
import { uneDatetime } from '../../fixtures/date.fixture'

initializeAPMAgent()

describe('MiloClient', () => {
  const configService = testConfig()
  let dateService: StubbedClass<DateService>
  const rateLimiterService = new RateLimiterService(configService)
  let miloClient: MiloClient
  const MILO_BASE_URL = 'https://milo.com'

  beforeEach(() => {
    const httpService = new HttpService()
    dateService = stubClass(DateService)
    dateService.now.returns(uneDatetime())
    miloClient = new MiloClient(
      httpService,
      configService,
      rateLimiterService,
      dateService
    )
  })

  afterEach(() => {
    nock.cleanAll()
  })

  describe('getSessionsConseiller', () => {
    it('recupere la liste des sessions milo de la structure du conseiller', async () => {
      // Given
      const idpToken = 'idpToken'
      const idStructure = '1'

      nock(MILO_BASE_URL)
        .get(
          `/operateurs/structures/${idStructure}/sessions?dateDebutRecherche=2023-05-31&dateFinRecherche=2023-06-29&taillePage=150&rechercheInscrits=true`
        )
        .reply(200, uneListeSessionsConseillerDto)
        .isDone()

      // When
      const result = await miloClient.getSessionsConseillerParStructure(
        idpToken,
        idStructure,
        'America/Cayenne',
        {
          periode: {
            debut: DateTime.fromISO('2023-06-01T00:00:00'),
            fin: DateTime.fromISO('2023-06-30T00:00:00')
          }
        }
      )

      // Then
      expect(result).to.deep.equal(
        success(uneListeSessionsConseillerDto.sessions)
      )
    })

    it('recupere la liste des sessions milo de la structure du conseiller', async () => {
      // Given
      const idpToken = 'idpToken'
      const idStructure = '1'

      nock(MILO_BASE_URL)
        .get(
          `/operateurs/structures/${idStructure}/sessions?taillePage=150&rechercheInscrits=true`
        )
        .reply(200, uneListeSessionsConseillerDto)
        .isDone()

      // When
      const result = await miloClient.getSessionsConseillerParStructure(
        idpToken,
        idStructure,
        'America/Cayenne',
        { periode: {} }
      )

      // Then
      expect(result).to.deep.equal(
        success(uneListeSessionsConseillerDto.sessions)
      )
    })

    it('envoie les bons headers', async () => {
      // Given
      const idpToken = 'idpToken'
      const idStructure = '1'

      const scope = nock(MILO_BASE_URL)
        .get(
          `/operateurs/structures/${idStructure}/sessions?taillePage=150&rechercheInscrits=true`
        )
        .matchHeader(
          'X-Gravitee-Api-Key',
          configService.get('milo').apiKeySessionsListeConseiller
        )
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .matchHeader('Authorization', `Bearer ${idpToken}`)
        .reply(200, uneListeSessionsConseillerDto)

      // When
      await miloClient.getSessionsConseillerParStructure(
        idpToken,
        idStructure,
        'America/Cayenne',
        { periode: {} }
      )

      // Then
      expect(scope.isDone()).to.equal(true)
    })

    it('renvoie une failure quand Milo renvoie 400', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(/\/operateurs\/structures\/1\/sessions/)
        .reply(400, { message: 'Bad Request' })

      // When
      const result = await miloClient.getSessionsConseillerParStructure(
        'idpToken',
        '1',
        'America/Cayenne',
        { periode: {} }
      )

      // Then
      expect(isFailure(result)).to.be.true()
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(/\/operateurs\/structures\/1\/sessions/)
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.getSessionsConseillerParStructure(
        'idpToken',
        '1',
        'America/Cayenne',
        { periode: {} }
      )

      // Then
      await expect(promise).to.be.rejected()
    })
  })

  describe('getSessionsJeune', () => {
    it('recupere la liste des sessions milo accessible au jeune', async () => {
      // Given
      const idpToken = 'idpToken'
      const idDossier = 'idDossier'

      nock(MILO_BASE_URL)
        .get(
          `/operateurs/sessions?idDossier=${idDossier}&taillePage=150&dateFinRecherche=2020-07-06`
        )
        .reply(200, uneListeSessionsJeuneDto)
        .isDone()

      // When
      const result = await miloClient.getSessionsParDossierJeune(
        idpToken,
        idDossier
      )

      // Then
      expect(result).to.deep.equal(success(uneListeSessionsJeuneDto.sessions))
    })

    it('permet de ne récuperer la liste des sessions que sur une période donnée', async () => {
      // Given
      const idpToken = 'idpToken'
      const idDossier = 'idDossier'

      nock(MILO_BASE_URL)
        .get(
          `/operateurs/sessions?idDossier=${idDossier}&dateDebutRecherche=2023-07-21&dateFinRecherche=2023-07-26&taillePage=150`
        )
        .reply(200, uneListeSessionsJeuneDto)
        .isDone()

      // When
      const result = await miloClient.getSessionsParDossierJeune(
        idpToken,
        idDossier,
        {
          debut: DateTime.fromISO('2023-07-21T17:53:42'),
          fin: DateTime.fromISO('2023-07-26T22:11:10')
        }
      )

      // Then
      expect(result).to.deep.equal(success(uneListeSessionsJeuneDto.sessions))
    })

    it('renvoie une failure quand Milo renvoie 400', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(/\/operateurs\/sessions/)
        .reply(400, { message: 'Bad Request' })

      // When
      const result = await miloClient.getSessionsParDossierJeune(
        'idpToken',
        'idDossier'
      )

      // Then
      expect(isFailure(result)).to.be.true()
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(/\/operateurs\/sessions/)
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.getSessionsParDossierJeune(
        'idpToken',
        'idDossier'
      )

      // Then
      await expect(promise).to.be.rejected()
    })
  })

  describe('getSessionsJeunePourConseiller', () => {
    it('recupere la liste des sessions milo accessibles au jeune', async () => {
      // Given
      const idpToken = 'idpToken'
      const idDossier = 'idDossier'

      nock(MILO_BASE_URL)
        .get(
          `/operateurs/sessions?idDossier=${idDossier}&taillePage=150&dateFinRecherche=2020-07-06`
        )
        .reply(200, uneListeSessionsJeuneDto)
        .isDone()

      // When
      const result = await miloClient.getSessionsParDossierJeunePourConseiller(
        idpToken,
        idDossier
      )

      // Then
      expect(result).to.deep.equal(success(uneListeSessionsJeuneDto.sessions))
    })

    it('permet de ne récuperer la liste des sessions que sur une période donnée', async () => {
      // Given
      const idpToken = 'idpToken'
      const idDossier = 'idDossier'

      nock(MILO_BASE_URL)
        .get(
          `/operateurs/sessions?idDossier=${idDossier}&dateDebutRecherche=2023-07-21&dateFinRecherche=2023-07-26&taillePage=150`
        )
        .reply(200, uneListeSessionsJeuneDto)
        .isDone()

      // When
      const result = await miloClient.getSessionsParDossierJeunePourConseiller(
        idpToken,
        idDossier,
        {
          debut: DateTime.fromISO('2023-07-21T17:53:42'),
          fin: DateTime.fromISO('2023-07-26T22:11:10')
        }
      )

      // Then
      expect(result).to.deep.equal(success(uneListeSessionsJeuneDto.sessions))
    })
  })

  describe('getDetailSessionConseiller', () => {
    it("recupere le detail d'une sessions milo", async () => {
      // Given
      const idpToken = 'idpToken'
      const idSession = '1'

      nock(MILO_BASE_URL)
        .get(`/operateurs/sessions/${idSession}`)
        .reply(200, unDetailSessionConseillerDto)
        .isDone()

      // When
      const result = await miloClient.getDetailSessionConseiller(
        idpToken,
        idSession
      )
      // Then
      expect(result).to.deep.equal(success(unDetailSessionConseillerDto))
    })

    it('renvoie une failure quand Milo renvoie 404', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get('/operateurs/sessions/1')
        .reply(404, { message: 'Not Found' })

      // When
      const result = await miloClient.getDetailSessionConseiller(
        'idpToken',
        '1'
      )

      // Then
      expect(isFailure(result)).to.be.true()
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get('/operateurs/sessions/1')
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.getDetailSessionConseiller('idpToken', '1')

      // Then
      await expect(promise).to.be.rejected()
    })
  })

  describe('getDetailSessionJeune', () => {
    it("recupere le detail d'une sessions milo", async () => {
      // Given
      const idpToken = 'idpToken'
      const idSession = '1'
      const idDossier = 'id-dossier'

      nock(MILO_BASE_URL)
        .get(`/operateurs/sessions/${idSession}`)
        .reply(200, unDetailSessionJeuneDto)
        .isDone()

      nock(MILO_BASE_URL)
        .get(
          '/operateurs/sessions?idDossier=id-dossier&taillePage=150&dateDebutRecherche=2020-04-06&dateFinRecherche=2020-04-06'
        )
        .reply(200, {
          page: 1,
          nbSessions: 1,
          sessions: [
            {
              ...unDetailSessionJeuneDto,
              sessionInstance: { statut: MILO_INSCRIT }
            }
          ]
        })

      // When
      const result = await miloClient.getDetailSessionJeune(
        idpToken,
        idSession,
        idDossier,
        'America/Cayenne'
      )

      // Then
      expect(result).to.deep.equal(
        success({
          ...unDetailSessionJeuneDto,
          sessionInstance: { statut: MILO_INSCRIT }
        })
      )
    })

    it('renvoie une failure quand le detail renvoie 404', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get('/operateurs/sessions/1')
        .reply(404, { message: 'Not Found' })

      // When
      const result = await miloClient.getDetailSessionJeune(
        'idpToken',
        '1',
        'id-dossier',
        'America/Cayenne'
      )

      // Then
      expect(isFailure(result)).to.be.true()
    })
  })

  describe('getStructureConseiller', () => {
    it('recupere la structure principale du conseiller', async () => {
      // Given
      const idpToken = 'idpToken'

      nock(MILO_BASE_URL)
        .get(`/operateurs/utilisateurs/moi/structures`)
        .reply(200, uneListeDeStructuresConseillerMiloDto)
        .isDone()

      // When
      const result = await miloClient.getStructureConseiller(idpToken)
      // Then
      expect(result).to.deep.equal(
        success(uneListeDeStructuresConseillerMiloDto[1])
      )
    })

    it('renvoie une failure quand aucune structure principale', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get('/operateurs/utilisateurs/moi/structures')
        .reply(200, [uneStructureConseillerMiloDto({ principale: false })])

      // When
      const result = await miloClient.getStructureConseiller('idpToken')

      // Then
      expect(result).to.deep.equal(
        failure(new ErreurHttp('Structure Milo principale introuvable', 404))
      )
    })
  })

  describe('getListeInscritsSessionConseillers', () => {
    it("recupere les inscrits d'une sessions milo", async () => {
      // Given
      const idpToken = 'idpToken'
      const idSession = '1'

      nock(MILO_BASE_URL)
        .get(`/operateurs/sessions/${idSession}/inscrits`)
        .reply(200, [uneInscriptionSessionMiloDto()])
        .isDone()

      // When
      const result = await miloClient.getListeInscritsSession(
        idpToken,
        idSession
      )
      // Then
      expect(result).to.deep.equal(success([uneInscriptionSessionMiloDto()]))
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get('/operateurs/sessions/1/inscrits')
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.getListeInscritsSession('idpToken', '1')

      // Then
      await expect(promise).to.be.rejected()
    })
  })

  describe('inscrireJeunesSession', () => {
    it('renvoie une failure et arrête la boucle quand une inscription échoue', async () => {
      // Given
      const idSession = 'id-session'
      const idsDossier = ['id-dossier-1', 'id-dossier-2']

      nock(MILO_BASE_URL)
        .post(
          `/operateurs/dossiers/${idsDossier[0]}/instances-session`,
          JSON.stringify(idSession)
        )
        .reply(400, { message: 'Erreur inscription' })

      const scope2 = nock(MILO_BASE_URL)
        .post(
          `/operateurs/dossiers/${idsDossier[1]}/instances-session`,
          JSON.stringify(idSession)
        )
        .reply(201, {
          id: 'inst2',
          idDossier: idsDossier[1],
          idSession,
          statut: 'test'
        })

      // When
      const result = await miloClient.inscrireJeunesSession(
        'idpToken',
        idSession,
        idsDossier
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect(scope2.isDone()).to.equal(false)
    })

    it('envoie les bons headers', async () => {
      // Given
      const idSession = 'id-session'
      const idsDossier = ['id-dossier-1']

      const scope = nock(MILO_BASE_URL)
        .post(
          `/operateurs/dossiers/${idsDossier[0]}/instances-session`,
          JSON.stringify(idSession)
        )
        .matchHeader(
          'X-Gravitee-Api-Key',
          configService.get('milo').apiKeyInstanceSessionEcritureConseiller
        )
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .matchHeader('Authorization', 'Bearer idpToken')
        .matchHeader('Content-Type', 'application/json')
        .reply(201, {
          id: 'inst1',
          idDossier: idsDossier[0],
          idSession,
          statut: 'test'
        })

      // When
      await miloClient.inscrireJeunesSession('idpToken', idSession, idsDossier)

      // Then
      expect(scope.isDone()).to.equal(true)
    })

    it('inscrit chaque jeune à la session', async () => {
      // Given
      const idSession = 'id-session'
      const idsDossier = ['id-dossier-1', 'id-dossier-2', 'id-dossier-3']

      const scope1 = nock(MILO_BASE_URL)
        .post(
          `/operateurs/dossiers/${idsDossier[0]}/instances-session`,
          JSON.stringify(idSession)
        )
        .reply(201, {
          id: 'inst1',
          idDossier: idsDossier[0],
          idSession,
          statut: 'test'
        })
      const scope2 = nock(MILO_BASE_URL)
        .post(
          `/operateurs/dossiers/${idsDossier[1]}/instances-session`,
          JSON.stringify(idSession)
        )
        .reply(201, {
          id: 'inst2',
          idDossier: idsDossier[1],
          idSession,
          statut: 'test'
        })
      const scope3 = nock(MILO_BASE_URL)
        .post(
          `/operateurs/dossiers/${idsDossier[2]}/instances-session`,
          JSON.stringify(idSession)
        )
        .reply(201, {
          id: 'inst3',
          idDossier: idsDossier[2],
          idSession,
          statut: 'test'
        })

      // When
      const result = await miloClient.inscrireJeunesSession(
        'idpToken',
        idSession,
        idsDossier
      )

      // Then
      expect(scope1.isDone()).to.equal(true)
      expect(scope2.isDone()).to.equal(true)
      expect(scope3.isDone()).to.equal(true)
      expect(result).to.deep.equal(
        success([
          {
            id: 'inst1',
            idDossier: 'id-dossier-1',
            idSession: 'id-session',
            statut: 'test'
          },
          {
            id: 'inst2',
            idDossier: 'id-dossier-2',
            idSession: 'id-session',
            statut: 'test'
          },
          {
            id: 'inst3',
            idDossier: 'id-dossier-3',
            idSession: 'id-session',
            statut: 'test'
          }
        ])
      )
    })
  })

  describe('desinscrireJeunesSession', () => {
    it('renvoie une failure quand une désinscription échoue', async () => {
      // Given
      const aDesinscrire = [
        { idDossier: 'id-dossier-1', idInstanceSession: 'id-inscription-1' },
        { idDossier: 'id-dossier-2', idInstanceSession: 'id-inscription-2' }
      ]

      nock(MILO_BASE_URL)
        .delete(
          `/operateurs/dossiers/${aDesinscrire[0].idDossier}/instances-session/${aDesinscrire[0].idInstanceSession}`
        )
        .reply(400, { message: 'Erreur' })

      // When
      const result = await miloClient.desinscrireJeunesSession(
        'idpToken',
        aDesinscrire
      )

      // Then
      expect(isFailure(result)).to.be.true()
    })

    it('désinscrit chaque jeune de la session', async () => {
      // Given
      const aDesinscrire = [
        { idDossier: 'id-dossier-1', idInstanceSession: 'id-inscription-1' },
        { idDossier: 'id-dossier-2', idInstanceSession: 'id-inscription-2' },
        { idDossier: 'id-dossier-3', idInstanceSession: 'id-inscription-3' }
      ]

      const scope1 = nock(MILO_BASE_URL)
        .delete(
          `/operateurs/dossiers/${aDesinscrire[0].idDossier}/instances-session/${aDesinscrire[0].idInstanceSession}`
        )
        .reply(201)
      const scope2 = nock(MILO_BASE_URL)
        .delete(
          `/operateurs/dossiers/${aDesinscrire[1].idDossier}/instances-session/${aDesinscrire[1].idInstanceSession}`
        )
        .reply(201)
      const scope3 = nock(MILO_BASE_URL)
        .delete(
          `/operateurs/dossiers/${aDesinscrire[2].idDossier}/instances-session/${aDesinscrire[2].idInstanceSession}`
        )
        .reply(201)

      // When
      const result = await miloClient.desinscrireJeunesSession(
        'idpToken',
        aDesinscrire
      )

      // Then
      expect(scope1.isDone()).to.equal(true)
      expect(scope2.isDone()).to.equal(true)
      expect(scope3.isDone()).to.equal(true)
      expect(result).to.deep.equal(emptySuccess())
    })
  })

  describe('modifierInscriptionJeunesSession', () => {
    it('renvoie une failure quand une modification échoue', async () => {
      // Given
      const aModifier = [
        {
          idDossier: 'id-dossier-1',
          idInstanceSession: 'id-inscription-1',
          statut: MILO_INSCRIT
        }
      ]

      nock(MILO_BASE_URL)
        .put(
          `/operateurs/dossiers/${aModifier[0].idDossier}/instances-session/${aModifier[0].idInstanceSession}`,
          { statut: MILO_INSCRIT }
        )
        .reply(400, { message: 'Erreur modification' })

      // When
      const result = await miloClient.modifierInscriptionJeunesSession(
        'idpToken',
        aModifier
      )

      // Then
      expect(isFailure(result)).to.be.true()
    })

    it('modifie les inscriptions de chaque jeune à la session', async () => {
      // Given
      const aModifier = [
        {
          idDossier: 'id-dossier-1',
          idInstanceSession: 'id-inscription-1',
          statut: MILO_INSCRIT
        },
        {
          idDossier: 'id-dossier-2',
          idInstanceSession: 'id-inscription-2',
          statut: MILO_REFUS_TIERS
        },
        {
          idDossier: 'id-dossier-3',
          idInstanceSession: 'id-inscription-3',
          statut: MILO_REFUS_JEUNE,
          commentaire: 'J’ai pas envie'
        },
        {
          idDossier: 'id-dossier-4',
          idInstanceSession: 'id-inscription-4',
          statut: MILO_PRESENT,
          dateDebutReelle: '2020-04-08'
        }
      ]

      const scope1 = nock(MILO_BASE_URL)
        .put(
          `/operateurs/dossiers/${aModifier[0].idDossier}/instances-session/${aModifier[0].idInstanceSession}`,
          { statut: MILO_INSCRIT }
        )
        .reply(201)
      const scope2 = nock(MILO_BASE_URL)
        .put(
          `/operateurs/dossiers/${aModifier[1].idDossier}/instances-session/${aModifier[1].idInstanceSession}`,
          { statut: MILO_REFUS_TIERS }
        )
        .reply(201)
      const scope3 = nock(MILO_BASE_URL)
        .put(
          `/operateurs/dossiers/${aModifier[2].idDossier}/instances-session/${aModifier[2].idInstanceSession}`,
          { statut: MILO_REFUS_JEUNE, commentaire: 'J’ai pas envie' }
        )
        .reply(201)
      const scope4 = nock(MILO_BASE_URL)
        .put(
          `/operateurs/dossiers/${aModifier[3].idDossier}/instances-session/${aModifier[3].idInstanceSession}`,
          { statut: MILO_PRESENT, dateDebutReelle: '2020-04-08' }
        )
        .reply(201)

      // When
      const result = await miloClient.modifierInscriptionJeunesSession(
        'idpToken',
        aModifier
      )

      // Then
      expect(scope1.isDone()).to.equal(true)
      expect(scope2.isDone()).to.equal(true)
      expect(scope3.isDone()).to.equal(true)
      expect(scope4.isDone()).to.equal(true)
      expect(result).to.deep.equal(emptySuccess())
    })
  })

  describe('envoyerEmailActivation', () => {
    it("envoie un email d'activation", async () => {
      // Given
      const scope = nock(MILO_BASE_URL)
        .put('/sue/sendVerifyEmail', 'test@example.com')
        .matchHeader(
          'X-Gravitee-Api-Key',
          configService.get('milo').apiKeyEnvoiEmail
        )
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .matchHeader('Authorization', 'Bearer idpToken')
        .matchHeader('Content-Type', 'text/plain')
        .reply(200)

      // When
      const result = await miloClient.envoyerEmailActivation(
        'idpToken',
        'test@example.com'
      )

      // Then
      expect(scope.isDone()).to.equal(true)
      expect(isSuccess(result)).to.be.true()
    })

    it('renvoie une failure quand Milo renvoie une erreur', async () => {
      // Given
      nock(MILO_BASE_URL)
        .put('/sue/sendVerifyEmail', 'test@example.com')
        .reply(400, { message: 'Erreur envoi email' })

      // When
      const result = await miloClient.envoyerEmailActivation(
        'idpToken',
        'test@example.com'
      )

      // Then
      expect(isFailure(result)).to.be.true()
    })
  })
})
