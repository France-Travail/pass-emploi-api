import { ConfigService } from '@nestjs/config'
import { Sequelize } from 'sequelize'
import { Context, ContextKey } from '../../../src/building-blocks/context'
import { success } from '../../../src/building-blocks/types/result'
import { CacheApiPartenaireService } from '../../../src/infrastructure/clients/cache-api-partenaire.service.db'
import { MiloClient } from '../../../src/infrastructure/clients/milo/milo-client'
import { MiloClientV1 } from '../../../src/infrastructure/clients/milo/milo-client-v1'
import { MiloClientV2 } from '../../../src/infrastructure/clients/milo/milo-client-v2'
import { unUtilisateurConseiller } from '../../fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'

describe('MiloClient (bascule V1 / V2)', () => {
  const conseillerBetaTesteur = unUtilisateurConseiller({
    email: 'beta@milo.fr'
  })
  const conseillerNonBetaTesteur = unUtilisateurConseiller({
    email: 'pas-beta@milo.fr'
  })

  let miloClientV1: StubbedClass<MiloClientV1>
  let miloClientV2: StubbedClass<MiloClientV2>
  let context: StubbedClass<Context>

  beforeEach(() => {
    miloClientV1 = stubClass(MiloClientV1)
    miloClientV2 = stubClass(MiloClientV2)
    miloClientV1.getRendezVous.resolves(success({} as never))
    miloClientV2.getRendezVous.resolves(success({} as never))
    context = stubClass(Context)
  })

  function creerClient(
    milo: Partial<{
      apiV2Enabled: boolean
      apiV2PourTousLesUtilisateurs: boolean
      apiV2PourTousLesJobs: boolean
    }>
  ): MiloClient {
    return new MiloClient(
      new ConfigService({
        milo: { ...milo, emailsConseillersV2: ['beta@milo.fr'] }
      }),
      miloClientV1,
      miloClientV2,
      context,
      {} as Sequelize,
      stubClass(CacheApiPartenaireService)
    )
  }

  function etantDonneUnUtilisateur(
    utilisateur = conseillerNonBetaTesteur
  ): void {
    context.get.withArgs(ContextKey.UTILISATEUR).returns(utilisateur)
  }

  async function verifierAppel(
    client: MiloClient,
    attendu: 'V1' | 'V2'
  ): Promise<void> {
    await client.getRendezVous('1', '2')
    const [appele, nonAppele] =
      attendu === 'V2'
        ? [miloClientV2, miloClientV1]
        : [miloClientV1, miloClientV2]
    expect(appele.getRendezVous).to.have.been.calledOnceWith('1', '2')
    expect(nonAppele.getRendezVous).not.to.have.been.called()
  }

  describe('utilisateurs', () => {
    it('appelle la V2 pour un conseiller non bêta-testeur quand la V2 est activée pour tous les utilisateurs', async () => {
      etantDonneUnUtilisateur()
      const client = creerClient({
        apiV2Enabled: true,
        apiV2PourTousLesUtilisateurs: true
      })

      await verifierAppel(client, 'V2')
    })

    it('appelle la V2 pour tous les utilisateurs même si la bascule bêta-testeurs est désactivée', async () => {
      etantDonneUnUtilisateur()
      const client = creerClient({
        apiV2Enabled: false,
        apiV2PourTousLesUtilisateurs: true
      })

      await verifierAppel(client, 'V2')
    })

    it("n'est pas concerné par la V2 pour tous les jobs", async () => {
      etantDonneUnUtilisateur()
      const client = creerClient({
        apiV2Enabled: true,
        apiV2PourTousLesJobs: true
      })

      await verifierAppel(client, 'V1')
    })

    it('appelle la V2 pour un conseiller bêta-testeur', async () => {
      etantDonneUnUtilisateur(conseillerBetaTesteur)
      const client = creerClient({ apiV2Enabled: true })

      await verifierAppel(client, 'V2')
    })

    it('appelle la V1 pour un conseiller non bêta-testeur', async () => {
      etantDonneUnUtilisateur()
      const client = creerClient({ apiV2Enabled: true })

      await verifierAppel(client, 'V1')
    })
  })

  describe('jobs, sans utilisateur dans le contexte', () => {
    it('appelle la V2 quand la V2 est activée pour tous les jobs', async () => {
      const client = creerClient({ apiV2PourTousLesJobs: true })

      await verifierAppel(client, 'V2')
    })

    it('appelle la V1 quand la V2 est activée seulement pour tous les utilisateurs', async () => {
      const client = creerClient({
        apiV2Enabled: true,
        apiV2PourTousLesUtilisateurs: true
      })

      await verifierAppel(client, 'V1')
    })

    it("appelle la V1 quand la V2 n'est pas activée pour tous les jobs", async () => {
      const client = creerClient({ apiV2Enabled: true })

      await verifierAppel(client, 'V1')
    })
  })
})
