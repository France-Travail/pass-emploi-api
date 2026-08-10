import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { Authentification } from 'src/domain/authentification'
import { JeuneInvite } from 'src/domain/jeune/jeune-invite'
import { SuiviJob } from 'src/domain/suivi-job'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { PurgerInvitesInactifsJobHandler } from '../../../src/application/jobs/purger-invites-inactifs.job.handler.db'
import { createSandbox, expect, StubbedClass, stubClass } from '../../utils'
import { testConfig } from '../../utils/module-for-testing'

describe('PurgerInvitesInactifsJobHandler', () => {
  let handler: PurgerInvitesInactifsJobHandler
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let jeuneInviteRepository: StubbedType<JeuneInvite.Repository>
  let authentificationRepository: StubbedType<Authentification.Repository>
  const maintenant = uneDatetime()

  beforeEach(() => {
    const sandbox: SinonSandbox = createSandbox()
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    suiviJobService = stubInterface(sandbox)
    jeuneInviteRepository = stubInterface(sandbox)
    authentificationRepository = stubInterface(sandbox)
    handler = new PurgerInvitesInactifsJobHandler(
      dateService,
      suiviJobService,
      jeuneInviteRepository,
      authentificationRepository,
      testConfig()
    )
  })

  it('supprime IDP puis DB pour chaque invité inactif (mode réel)', async () => {
    // Given
    const dateReferenceRecente = maintenant.minus({ months: 18 }).toJSDate()
    const dateReferenceAncienne = maintenant.minus({ months: 24 }).toJSDate()
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      {
        id: 'inv1',
        idAuthentification: 'sub1',
        dateReference: dateReferenceRecente
      },
      {
        id: 'inv2',
        idAuthentification: 'sub2',
        dateReference: dateReferenceAncienne
      }
    ])

    // When
    const suivi = await handler.handle()

    // Then
    expect(
      authentificationRepository.supprimerCompteIdpInvite
    ).to.have.been.calledWith('sub1')
    expect(jeuneInviteRepository.supprimer).to.have.been.calledWith('inv1')
    expect(
      authentificationRepository.supprimerCompteIdpInvite
        .getCall(0)
        .calledBefore(jeuneInviteRepository.supprimer.getCall(0))
    ).to.equal(true)
    const resultat = suivi.resultat as {
      nbPurges: number
    }
    expect(resultat.nbPurges).to.equal(2)
  })

  it('ne supprime pas la ligne DB si la suppression IDP échoue', async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      {
        id: 'inv1',
        idAuthentification: 'sub1',
        dateReference: maintenant.minus({ months: 18 }).toJSDate()
      }
    ])
    authentificationRepository.supprimerCompteIdpInvite
      .withArgs('sub1')
      .rejects(new Error('connect KO'))

    // When
    const suivi = await handler.handle()

    // Then
    expect(jeuneInviteRepository.supprimer).not.to.have.been.called()
    const resultat = suivi.resultat as {
      nbEchecsIdp: number
      nbPurges: number
    }
    expect(resultat.nbEchecsIdp).to.equal(1)
    expect(resultat.nbPurges).to.equal(0)
  })

  it("abandonne sans rien supprimer quand le pourcentage d'inactifs dépasse le seuil", async () => {
    // Given : seuil 20%, total 100, backlog d'inactifs = 30 (30% > 20%)
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves(
      Array.from({ length: 30 }, (_, i) => ({
        id: `inv${i}`,
        idAuthentification: `sub${i}`,
        dateReference: maintenant.minus({ months: 18 }).toJSDate()
      }))
    )

    // When
    const suivi = await handler.handle()

    // Then
    expect(
      authentificationRepository.supprimerCompteIdpInvite
    ).not.to.have.been.called()
    expect(jeuneInviteRepository.supprimer).not.to.have.been.called()
    expect(suivi.succes).to.equal(false)
    expect(suivi.nbErreurs).to.equal(1)
    const resultat = suivi.resultat as {
      nbPurges: number
      pourcentageInactifs: number
      nombreInactifs: number
    }
    expect(resultat.nbPurges).to.equal(0)
    expect(resultat.pourcentageInactifs).to.equal(30)
    expect(resultat.nombreInactifs).to.equal(30)
  })

  it("n'abandonne pas quand le pourcentage d'inactifs reste sous le seuil", async () => {
    // Given : seuil 20%, backlog d'inactifs = 10% du parc
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves(
      Array.from({ length: 10 }, (_, i) => ({
        id: `inv${i}`,
        idAuthentification: `sub${i}`,
        dateReference: maintenant.minus({ months: 18 }).toJSDate()
      }))
    )

    // When
    const suivi = await handler.handle()

    // Then
    const resultat = suivi.resultat as {
      pourcentageInactifs: number
    }
    expect(resultat.pourcentageInactifs).to.equal(10)
    expect(suivi.succes).to.equal(true)
  })

  it('supprime tous les candidats en un seul run, même bien au-delà de 500 (pas de plafond)', async () => {
    // Given
    const candidats = Array.from({ length: 600 }, (_, i) => ({
      id: `inv${i}`,
      idAuthentification: `sub${i}`,
      dateReference: maintenant.minus({ months: 18 }).toJSDate()
    }))
    jeuneInviteRepository.compterTout.resolves(10000)
    jeuneInviteRepository.recupererInvitesInactifs.resolves(candidats)

    // When
    const suivi = await handler.handle()

    // Then
    expect(jeuneInviteRepository.supprimer).to.have.callCount(600)
    const resultat = suivi.resultat as {
      nbPurges: number
      nombreInactifs: number
    }
    expect(resultat.nbPurges).to.equal(600)
    expect(resultat.nombreInactifs).to.equal(600)
  })

  it("ne déclenche pas le garde-fou quand aucun candidat n'est remonté", async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([])

    // When
    const suivi = await handler.handle()

    // Then
    expect(jeuneInviteRepository.supprimer).not.to.have.been.called()
    expect(suivi.succes).to.equal(true)
  })

  it('ne divise pas par zéro quand le parc est vide', async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(0)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([])

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(true)
    const resultat = suivi.resultat as {
      pourcentageInactifs: number
      total: number
    }
    expect(resultat.pourcentageInactifs).to.equal(0)
    expect(resultat.total).to.equal(0)
  })

  it('signale un run en échec quand une suppression IDP échoue', async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      {
        id: 'inv1',
        idAuthentification: 'sub1',
        dateReference: maintenant.minus({ months: 18 }).toJSDate()
      }
    ])
    authentificationRepository.supprimerCompteIdpInvite
      .withArgs('sub1')
      .rejects(new Error('connect KO'))

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(false)
    expect(suivi.nbErreurs).to.equal(1)
    const resultat = suivi.resultat as {
      nbEchecsIdp: number
      nbEchecsDb: number
    }
    expect(resultat.nbEchecsIdp).to.equal(1)
    expect(resultat.nbEchecsDb).to.equal(0)
  })

  it('signale un run en échec quand une suppression DB échoue après une suppression IDP réussie', async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      {
        id: 'inv1',
        idAuthentification: 'sub1',
        dateReference: maintenant.minus({ months: 18 }).toJSDate()
      }
    ])
    jeuneInviteRepository.supprimer.withArgs('inv1').rejects(new Error('DB KO'))

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(false)
    expect(suivi.nbErreurs).to.equal(1)
    const resultat = suivi.resultat as {
      nbEchecsIdp: number
      nbEchecsDb: number
      nbPurges: number
    }
    expect(resultat.nbEchecsIdp).to.equal(0)
    expect(resultat.nbEchecsDb).to.equal(1)
    expect(resultat.nbPurges).to.equal(0)
  })

  it('expose une forme de résultat unique et complète sur le chemin nominal', async () => {
    // Given
    const dateReference = maintenant.minus({ months: 18 }).toJSDate()
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      { id: 'inv1', idAuthentification: 'sub1', dateReference }
    ])

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.resultat).to.deep.equal({
      nbPurges: 1,
      nbEchecsIdp: 0,
      nbEchecsDb: 0,
      pourcentageInactifs: 1,
      nombreInactifs: 1,
      total: 100
    })
  })
})
