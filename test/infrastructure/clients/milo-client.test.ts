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
import {
  ErreurHttp,
  ErreurMiloHttp
} from 'src/building-blocks/types/domain-error'
import { MiloClient } from 'src/infrastructure/clients/milo/milo-client'
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
import {
  DossierMiloDto,
  EvenementMiloDto,
  InstanceSessionMiloDto,
  RendezVousMiloDto
} from '../../../src/infrastructure/repositories/dto/milo.dto'
import { JeuneMilo } from '../../../src/domain/milo/jeune.milo'
import { initializeAPMAgent } from '../../../src/infrastructure/monitoring/apm.init'
import { RateLimiterService } from '../../../src/utils/rate-limiter.service'
import { DateService } from '../../../src/utils/date-service'
import { StubbedClass, stubClass } from '../../utils'
import { uneDatetime } from '../../fixtures/date.fixture'
import { MiloClientUtils } from '../../../src/infrastructure/clients/milo/milo-client-utils'

initializeAPMAgent()

describe('MiloClient', () => {
  const configService = testConfig()
  let dateService: StubbedClass<DateService>
  const rateLimiterService = new RateLimiterService(configService)
  let miloClient: MiloClient
  const MILO_BASE_URL = 'https://milo.com'

  beforeEach(() => {
    const httpService = new HttpService()
    const miloClientUtils = new MiloClientUtils(httpService, configService)
    dateService = stubClass(DateService)
    dateService.now.returns(uneDatetime())
    miloClient = new MiloClient(
      miloClientUtils,
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

  describe('getDossier', () => {
    const idDossier = '123456'

    it('recupere le dossier et le mappe correctement', async () => {
      // Given
      const dossierDto: DossierMiloDto = {
        idDossier: 123456,
        idJeune: 'id-jeune',
        numeroDE: 'num-de',
        nomNaissance: 'Nom',
        nomUsage: 'NomUsage',
        prenom: 'Prenom',
        dateNaissance: '2000-01-01',
        mail: 'test@example.com',
        adresse: {
          numero: '1',
          libelleVoie: 'rue',
          complement: '',
          codePostal: '75001',
          commune: 'Paris'
        },
        structureRattachement: {
          nomUsuel: 'ML Paris',
          nomOfficiel: 'Mission Locale Paris',
          codeStructure: 'CODE-STRUCT'
        },
        accompagnementCEJ: {
          accompagnementCEJ: true,
          dateDebut: '2023-01-01',
          dateFinPrevue: '2023-12-31',
          dateFinReelle: null,
          premierAccompagnement: null
        },
        situationsCEJ: [
          {
            etat: JeuneMilo.EtatSituation.EN_COURS,
            dateFin: null,
            categorieSituation: JeuneMilo.CategorieSituation.EMPLOI,
            codeRomeMetierPrepare: null,
            codeRomePremierMetier: 'A1234',
            codeRomeMetierExerce: null
          }
        ]
      }
      nock(MILO_BASE_URL)
        .get(`/api-dossiers-cej/dossiers/${idDossier}`)
        .reply(200, dossierDto)

      // When
      const result = await miloClient.getDossier(idDossier)

      // Then
      expect(isSuccess(result)).to.be.true()
      if (isSuccess(result)) {
        expect(result.data.id).to.equal(idDossier)
        expect(result.data.prenom).to.equal('Prenom')
        expect(result.data.nom).to.equal('NomUsage')
        expect(result.data.email).to.equal('test@example.com')
        expect(result.data.codePostal).to.equal('75001')
        expect(result.data.codeStructure).to.equal('CODE-STRUCT')
      }
    })

    it('envoie les bons headers', async () => {
      // Given
      const scope = nock(MILO_BASE_URL)
        .get(`/api-dossiers-cej/dossiers/${idDossier}`)
        .matchHeader(
          'X-Gravitee-Api-Key',
          configService.get('milo').apiKeyDossierCej
        )
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, {
          idDossier: 123456,
          idJeune: 'id',
          numeroDE: 'num',
          nomNaissance: 'N',
          nomUsage: 'N',
          prenom: 'P',
          dateNaissance: '2000-01-01',
          mail: null,
          accompagnementCEJ: {
            accompagnementCEJ: true,
            dateDebut: null,
            dateFinPrevue: null,
            dateFinReelle: null,
            premierAccompagnement: null
          },
          situationsCEJ: []
        })

      // When
      await miloClient.getDossier(idDossier)

      // Then
      expect(scope.isDone()).to.equal(true)
    })

    it('renvoie un message custom quand Milo renvoie 400', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(`/api-dossiers-cej/dossiers/${idDossier}`)
        .reply(400, { message: 'Bad Request' })

      // When
      const result = await miloClient.getDossier(idDossier)

      // Then
      expect(result).to.deep.equal(
        failure(
          new ErreurHttp(
            'Le numéro de dossier est incorrect. Renseignez un numéro. Exemple : 123456.',
            400
          )
        )
      )
    })

    it('renvoie le message API quand Milo renvoie 404', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(`/api-dossiers-cej/dossiers/${idDossier}`)
        .reply(404, { message: 'Dossier introuvable' })

      // When
      const result = await miloClient.getDossier(idDossier)

      // Then
      expect(isFailure(result)).to.be.true()
      if (isFailure(result)) {
        expect(result.error.message).to.equal('Dossier introuvable')
      }
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(`/api-dossiers-cej/dossiers/${idDossier}`)
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.getDossier(idDossier)

      // Then
      await expect(promise).to.be.rejected()
    })
  })

  describe('creerSituationDossier', () => {
    const idDossier = 'idDossier'
    const body = {
      dateDebut: '2022-03-01',
      dateFinReelle: '2022-03-01',
      commentaire: 'Un commentaire',
      mesure: 'SANTE',
      loginConseiller: 'loginConseiller'
    }

    it('crée une SNP avec le bon body', async () => {
      // Given
      const scope = nock(MILO_BASE_URL)
        .post(`/sue/dossiers/${idDossier}/situation`, body)
        .reply(201)

      // When
      const result = await miloClient.creerSituationDossier(idDossier, body)

      // Then
      expect(scope.isDone()).to.equal(true)
      expect(isSuccess(result)).to.be.true()
    })

    it('envoie les bons headers', async () => {
      // Given
      const scope = nock(MILO_BASE_URL)
        .post(`/sue/dossiers/${idDossier}/situation`, body)
        .matchHeader(
          'X-Gravitee-Api-Key',
          configService.get('milo').apiKeyDossier
        )
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(201)

      // When
      await miloClient.creerSituationDossier(idDossier, body)

      // Then
      expect(scope.isDone()).to.equal(true)
    })

    it('renvoie une failure quand Milo renvoie 400', async () => {
      // Given
      nock(MILO_BASE_URL)
        .post(`/sue/dossiers/${idDossier}/situation`)
        .reply(400, { message: 'un message' })

      // When
      const result = await miloClient.creerSituationDossier(idDossier, body)

      // Then
      expect(isFailure(result)).to.be.true()
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .post(`/sue/dossiers/${idDossier}/situation`)
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.creerSituationDossier(idDossier, body)

      // Then
      await expect(promise).to.be.rejected()
    })
  })

  describe('creerJeune', () => {
    const idDossier = '12345'

    it('crée un jeune et renvoie le sub keycloak', async () => {
      // Given
      nock(MILO_BASE_URL)
        .post(`/sue/compte-jeune/${idDossier}`, {})
        .reply(200, 'sub-keycloak-id')

      // When
      const result = await miloClient.creerJeune(idDossier)

      // Then
      expect(result).to.deep.equal(
        success({
          idAuthentification: 'sub-keycloak-id',
          existeDejaChezMilo: false
        })
      )
    })

    it('envoie les bons headers', async () => {
      // Given
      const scope = nock(MILO_BASE_URL)
        .post(`/sue/compte-jeune/${idDossier}`, {})
        .matchHeader(
          'X-Gravitee-Api-Key',
          configService.get('milo').apiKeyCreerJeune
        )
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, 'sub-id')

      // When
      await miloClient.creerJeune(idDossier)

      // Then
      expect(scope.isDone()).to.equal(true)
    })

    it('renvoie une failure 422 quand le compte existe dans une autre ML', async () => {
      // Given
      nock(MILO_BASE_URL)
        .post(`/sue/compte-jeune/${idDossier}`, {})
        .reply(400, {
          message: 'Account exists in other ML',
          code: 'SUE_ACCOUNT_EXISTING_OTHER_ML'
        })

      // When
      const result = await miloClient.creerJeune(idDossier)

      // Then
      expect(result).to.deep.equal(
        failure(new ErreurMiloHttp('Account exists in other ML', 422))
      )
    })

    it('renvoie success avec existeDejaChezMilo quand le compte est déjà rattaché avec un sub keycloak', async () => {
      // Given
      nock(MILO_BASE_URL)
        .post(`/sue/compte-jeune/${idDossier}`, {})
        .reply(400, {
          message: 'Already attached',
          code: 'SUE_RECORD_ALREADY_ATTACHED_TO_ACCOUNT',
          'id-keycloak': 'existing-sub'
        })

      // When
      const result = await miloClient.creerJeune(idDossier)

      // Then
      expect(result).to.deep.equal(
        success({
          idAuthentification: 'existing-sub',
          existeDejaChezMilo: true
        })
      )
    })

    it('renvoie une failure quand le compte est déjà rattaché sans sub keycloak', async () => {
      // Given
      nock(MILO_BASE_URL)
        .post(`/sue/compte-jeune/${idDossier}`, {})
        .reply(400, {
          message: 'Already attached',
          code: 'SUE_RECORD_ALREADY_ATTACHED_TO_ACCOUNT'
        })

      // When
      const result = await miloClient.creerJeune(idDossier)

      // Then
      expect(isFailure(result)).to.be.true()
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .post(`/sue/compte-jeune/${idDossier}`, {})
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.creerJeune(idDossier)

      // Then
      await expect(promise).to.be.rejected()
    })

    describe('avec surcharge', () => {
      it('utilise PUT sur le endpoint surcharge', async () => {
        // Given
        const scope = nock(MILO_BASE_URL)
          .put(`/sue/compte-jeune/surcharge/${idDossier}`, {})
          .reply(200, 'sub-id')

        // When
        const result = await miloClient.creerJeune(idDossier, true)

        // Then
        expect(scope.isDone()).to.equal(true)
        expect(result).to.deep.equal(
          success({
            idAuthentification: 'sub-id',
            existeDejaChezMilo: false
          })
        )
      })

      it('fait un POST si PUT renvoie un body vide', async () => {
        // Given
        nock(MILO_BASE_URL)
          .put(`/sue/compte-jeune/surcharge/${idDossier}`, {})
          .reply(200, '')

        nock(MILO_BASE_URL)
          .post(`/sue/compte-jeune/${idDossier}`, {})
          .reply(200, 'sub-from-post')

        // When
        const result = await miloClient.creerJeune(idDossier, true)

        // Then
        expect(result).to.deep.equal(
          success({
            idAuthentification: 'sub-from-post',
            existeDejaChezMilo: false
          })
        )
      })
    })
  })

  describe('getInstanceSession', () => {
    const idInstance = 'id-instance'
    const idDossier = 'id-dossier'

    it('recupere une instance de session', async () => {
      // Given
      const instanceDto: InstanceSessionMiloDto = {
        id: 'id-instance',
        idSession: 'id-session',
        nom: 'Session test',
        dateHeureDebut: '2020-10-06 10:00:00',
        dateHeureFin: '2020-10-06 12:00:00',
        lieu: 'Paris',
        idDossier: 'id-dossier',
        statut: 'Prescrit'
      }
      nock(MILO_BASE_URL)
        .get(`/operateurs/dossiers/${idDossier}/sessions/${idInstance}`)
        .reply(200, instanceDto)

      // When
      const result = await miloClient.getInstanceSession(idInstance, idDossier)

      // Then
      expect(result).to.deep.equal(success(instanceDto))
    })

    it('envoie les bons headers', async () => {
      // Given
      const scope = nock(MILO_BASE_URL)
        .get(`/operateurs/dossiers/${idDossier}/sessions/${idInstance}`)
        .matchHeader(
          'X-Gravitee-Api-Key',
          configService.get('milo').apiKeyDetailRendezVous
        )
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, {
          id: 'id-instance',
          idSession: 'id-session',
          nom: 'test',
          dateHeureDebut: '2020-10-06 10:00:00',
          lieu: '',
          idDossier: 'id-dossier',
          statut: 'Prescrit'
        })

      // When
      await miloClient.getInstanceSession(idInstance, idDossier)

      // Then
      expect(scope.isDone()).to.equal(true)
    })

    it('renvoie une failure quand Milo renvoie 404', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(`/operateurs/dossiers/${idDossier}/sessions/${idInstance}`)
        .reply(404, { message: 'Not Found' })

      // When
      const result = await miloClient.getInstanceSession(idInstance, idDossier)

      // Then
      expect(isFailure(result)).to.be.true()
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(`/operateurs/dossiers/${idDossier}/sessions/${idInstance}`)
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.getInstanceSession(idInstance, idDossier)

      // Then
      await expect(promise).to.be.rejected()
    })
  })

  describe('getRendezVous', () => {
    const idDossier = '1234'
    const idRendezVous = '5678'

    it('recupere un rendez-vous', async () => {
      // Given
      const rdvDto: RendezVousMiloDto = {
        id: 5678,
        dateHeureDebut: '2020-10-06 10:00:00',
        dateHeureFin: '2020-10-06 12:00:00',
        objet: 'Test RDV',
        conseiller: 'SIMILO SIMILO',
        idDossier: 1234,
        commentaire: '',
        type: 'Téléphone',
        statut: 'Planifié',
        lieu: 'Bureau'
      }
      nock(MILO_BASE_URL)
        .get(`/operateurs/dossiers/${idDossier}/rdv/${idRendezVous}`)
        .reply(200, rdvDto)

      // When
      const result = await miloClient.getRendezVous(idDossier, idRendezVous)

      // Then
      expect(result).to.deep.equal(success(rdvDto))
    })

    it('envoie les bons headers', async () => {
      // Given
      const scope = nock(MILO_BASE_URL)
        .get(`/operateurs/dossiers/${idDossier}/rdv/${idRendezVous}`)
        .matchHeader(
          'X-Gravitee-Api-Key',
          configService.get('milo').apiKeyDetailRendezVous
        )
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, {
          id: 5678,
          dateHeureDebut: '2020-10-06 10:00:00',
          objet: 'Test',
          conseiller: 'C',
          idDossier: 1234,
          type: 'Tel',
          statut: 'Planifié'
        })

      // When
      await miloClient.getRendezVous(idDossier, idRendezVous)

      // Then
      expect(scope.isDone()).to.equal(true)
    })

    it('renvoie success(undefined) quand Milo renvoie 404', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(`/operateurs/dossiers/${idDossier}/rdv/${idRendezVous}`)
        .reply(404, { message: 'Not Found' })

      // When
      const result = await miloClient.getRendezVous(idDossier, idRendezVous)

      // Then
      expect(result).to.deep.equal(success(undefined))
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get(`/operateurs/dossiers/${idDossier}/rdv/${idRendezVous}`)
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.getRendezVous(idDossier, idRendezVous)

      // Then
      await expect(promise).to.be.rejected()
    })
  })

  describe('getEvenements', () => {
    it('recupere la liste des evenements', async () => {
      // Given
      const evenements: EvenementMiloDto[] = [
        {
          identifiant: 'evt-1',
          idDossier: 1234,
          type: 'RDV',
          action: 'CREATE',
          idType: 5678,
          date: '2023-06-01 10:00:00'
        }
      ]
      nock(MILO_BASE_URL).get('/api-evenements/events').reply(200, evenements)

      // When
      const result = await miloClient.getEvenements()

      // Then
      expect(result).to.deep.equal(success(evenements))
    })

    it('envoie les bons headers', async () => {
      // Given
      const scope = nock(MILO_BASE_URL)
        .get('/api-evenements/events')
        .matchHeader(
          'X-Gravitee-Api-Key',
          configService.get('milo').apiKeyEvents
        )
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200, [])

      // When
      await miloClient.getEvenements()

      // Then
      expect(scope.isDone()).to.equal(true)
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .get('/api-evenements/events')
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.getEvenements()

      // Then
      await expect(promise).to.be.rejected()
    })
  })

  describe('acquitterEvenement', () => {
    const idEvenement = 'evt-1'

    it('acquitte un evenement', async () => {
      // Given
      const scope = nock(MILO_BASE_URL)
        .post(`/api-evenements/events/${idEvenement}/ack`, {})
        .reply(200)

      // When
      const result = await miloClient.acquitterEvenement(idEvenement)

      // Then
      expect(scope.isDone()).to.equal(true)
      expect(isSuccess(result)).to.be.true()
    })

    it('envoie les bons headers', async () => {
      // Given
      const scope = nock(MILO_BASE_URL)
        .post(`/api-evenements/events/${idEvenement}/ack`, {})
        .matchHeader(
          'X-Gravitee-Api-Key',
          configService.get('milo').apiKeyEvents
        )
        .matchHeader('operateur', 'APPLICATION_CEJ')
        .reply(200)

      // When
      await miloClient.acquitterEvenement(idEvenement)

      // Then
      expect(scope.isDone()).to.equal(true)
    })

    it('renvoie une failure quand Milo renvoie 400', async () => {
      // Given
      nock(MILO_BASE_URL)
        .post(`/api-evenements/events/${idEvenement}/ack`, {})
        .reply(400, { message: 'Erreur acquittement' })

      // When
      const result = await miloClient.acquitterEvenement(idEvenement)

      // Then
      expect(isFailure(result)).to.be.true()
    })

    it('throw quand Milo renvoie 500', async () => {
      // Given
      nock(MILO_BASE_URL)
        .post(`/api-evenements/events/${idEvenement}/ack`, {})
        .reply(500, 'Internal Server Error')

      // When
      const promise = miloClient.acquitterEvenement(idEvenement)

      // Then
      await expect(promise).to.be.rejected()
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
