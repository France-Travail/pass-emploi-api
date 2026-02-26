import { ConfigService } from '@nestjs/config'
import { parse } from 'pg-connection-string'

export const testConfig = (): ConfigService => {
  const databaseUrl =
    (process.env.DATABASE_URL as string) ||
    'postgresql://test:test@localhost:56432/test'
  const { host, port, database, user, password } = parse(databaseUrl)
  return new ConfigService({
    environment: 'test',
    database: {
      host,
      port,
      database,
      user,
      password
    },
    poleEmploi: {
      url: 'https://api.peio.pe-qvr.fr/partenaire',
      loginUrl:
        'https://entreprise.pole-emploi.fr/connexion/oauth2/access_token',
      clientId: 'pole-emploi-client-id',
      clientSecret: 'pole-emploi-client-secret',
      scope: 'pole-emploi-scope'
    },
    milo: {
      url: 'https://milo.com',
      urlWeb: 'https://milo.com',
      maxNombreEvenementsBatch: 1500,
      apiKeyDossierV1: 'apiKeyDossierV1',
      apiKeyCreerJeune: 'apiKeyCreerJeune',
      apiKeyDetailRendezVous: 'apiKeyDetailRendezVous',
      apiKeyInstanceSessionLecture: 'apiKeyInstanceSessionLecture',
      apiKeyInstanceSessionEcritureConseiller:
        'apiKeyInstanceSessionEcritureConseiller',
      apiKeyInstanceSessionAnnulationJeune:
        'apiKeyInstanceSessionAnnulationJeune',
      apiKeySessionDetailConseiller: 'apiKeySessionDetailConseiller',
      apiKeySessionsDetailEtListeJeune: 'apiKeySessionsDetailEtListeJeune',
      apiKeySessionsListeConseiller: 'apiKeySessionsListeConseiller',
      apiKeyUtilisateurs: 'apiKeyUtilisateurs',
      apiKeyEnvoiEmail: 'apiKeyEnvoiEmail',
      apiKeyDossierCej: 'apiKeyDossierCej',
      apiKeyDossier: 'apiKeyDossier',
      apiKeyJwtJeune: 'apiKeyJwtJeune',
      apiKeyJwtSessions: 'apiKeyJwtSessions',
      apiKeySessions: 'apiKeySessions',
      apiKeyJwtUtilisateurs: 'apiKeyJwtUtilisateurs',
      apiKeyRdv: 'apiKeyRdv',
      apiKeyEvents: 'apiKeyEvents'
    },
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6767'
    },
    planificateur: {
      url: 'https://planification.com'
    },
    brevo: {
      url: 'https://brevo.com',
      apiKey: 'brevoApiKey',
      templates: {
        conversationsNonLues: '200',
        conversationsNonLuesPassEmploi: '363',
        nouveauRendezvous: '300',
        rappelRendezvous: '400',
        compteJeuneArchiveMILO: '500',
        compteJeuneArchivePECEJ: '501',
        compteJeuneArchivePEBRSA: '502'
      }
    },
    serviceCivique: {
      url: 'https://api.api-engagement.beta.gouv.op',
      apiKey: 'apiKey'
    },
    immersion: {
      url: 'https://api.api-immersion.beta.gouv.op',
      apiKey: 'apiKey'
    },
    cje: {
      apiUrl: 'https://cje.com/api',
      apiKey: 'cjekey'
    },
    diagoriente: {
      url: 'https://api-dev.diagoriente.fr',
      clientId: 'diagoriente-client-id',
      clientSecret: 'diagoriente-client-secret'
    },
    jecliqueoupas: {
      url: 'https://jecliqueoupas.fr/api',
      token: 'token-jecliqueoupas',
      cert: 'CERT_BASE64',
      ip: '1.2.3.4',
      intervalleAnalyse: 15
    },
    firebase: {
      key: '{"type": "service_account","project_id": "pass-emploi-test","private_key_id": "xx","private_key": "xx","client_email": "test@pass-emploi-test.iam.gserviceaccount.com","client_id": "xx","auth_uri": "https://accounts.google.com/o/oauth2/auth","token_uri": "https://oauth2.googleapis.com/token","auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/test"}',
      encryptionKey: 'firebase-encryption-key'
    },
    noReplyContactEmail: 'no-reply@pass-emploi.beta.gouv.fr',
    frontEndUrl: 'http://frontend.com',
    matomo: {
      siteId: 0,
      url: 'https://url.matomo.test'
    },
    mattermost: {
      jobWebhookUrl: 'https://mattermost.incubateur.net/hooks/xxx'
    },
    monitoring: {
      dashboardUrl: 'https://elastic.com'
    },
    jobs: {
      notificationRecherches: {
        nombreDeRequetesEnParallele: '5'
      },
      mailConseillers: {
        nombreDeConseillersEnParallele: '100'
      }
    },
    apiKeys: {
      keycloak: ['api-key-keycloak'],
      immersion: ['api-key-immersion'],
      support: ['api-key-support'],
      admin: ['api-key-admin'],
      poleEmploi: ['api-key-consumer-pole-emploi']
    },
    features: {
      notifierRendezVousMilo: true,
      recupererStructureMilo: true
    },
    oidc: {
      issuerUrl: 'https://pass-emploi-connect.com',
      issuerApiUrl: 'https://pass-emploi-connect-api.com',
      clientId: 'client',
      clientSecret: 'chut'
    },
    values: {
      maxRechercheConseillers: '5'
    },
    headers: {
      staleIfErrorSeconds: '60',
      maxAgeMobile: '600',
      maxAgeComptage: '600',
      maxAgeReferentiels: '600',
      maxAgeCV: '600',
      maxAgeSuggestions: '600',
      maxAgeMinimal: '5',
      staleIfErrorAgeMinimal: '5'
    },
    remoteConfig: { test: ['ok'] }
  })
}
