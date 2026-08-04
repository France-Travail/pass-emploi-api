import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
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
    jeuneInviteRepository.compterInvitesInactifs.resolves(2)
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
      ageMinJours: number
      ageMaxJours: number
    }
    expect(resultat.nbPurges).to.equal(2)
    const ageAttenduRecent = Math.floor(
      maintenant.diff(DateTime.fromJSDate(dateReferenceRecente), 'days').days
    )
    const ageAttenduAncien = Math.floor(
      maintenant.diff(DateTime.fromJSDate(dateReferenceAncienne), 'days').days
    )
    expect(resultat.ageMinJours).to.equal(ageAttenduRecent)
    expect(resultat.ageMaxJours).to.equal(ageAttenduAncien)
  })

  it('ne supprime pas la ligne DB si la suppression IDP échoue', async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.compterInvitesInactifs.resolves(1)
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
      nbEchecsRedis: number
      nbPurges: number
    }
    expect(resultat.nbEchecsRedis).to.equal(1)
    expect(resultat.nbPurges).to.equal(0)
  })

  it('en dry-run ne supprime rien, compte les simulations et expose les âges', async () => {
    // Given
    const config = testConfig()
    config.get('jobs').purgeInvites.dryRun = true
    handler = new PurgerInvitesInactifsJobHandler(
      dateService,
      suiviJobService,
      jeuneInviteRepository,
      authentificationRepository,
      config
    )
    const dateReference = maintenant.minus({ months: 18 }).toJSDate()
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.compterInvitesInactifs.resolves(1)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      { id: 'inv1', idAuthentification: 'sub1', dateReference }
    ])

    // When
    const suivi = await handler.handle()

    // Then
    expect(
      authentificationRepository.supprimerCompteIdpInvite
    ).not.to.have.been.called()
    expect(jeuneInviteRepository.supprimer).not.to.have.been.called()
    const resultat = suivi.resultat as {
      nbSimules: number
      ageMinJours: number
      ageMaxJours: number
    }
    expect(resultat.nbSimules).to.equal(1)
    const ageAttendu = Math.floor(
      maintenant.diff(DateTime.fromJSDate(dateReference), 'days').days
    )
    expect(resultat.ageMinJours).to.equal(ageAttendu)
    expect(resultat.ageMaxJours).to.equal(ageAttendu)
  })

  it('abandonne si le pourcentage du parc dépasse le seuil', async () => {
    // Given : seuil 20%, on tente 30 sur 100
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.compterInvitesInactifs.resolves(30)
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
    const resultat = suivi.resultat as {
      nbPurges: number
      nbEchecsRedis: number
    }
    expect(resultat.nbPurges).to.equal(0)
    expect(resultat.nbEchecsRedis).to.equal(0)
  })

  it('abandonne sur le compte réel des inactifs même si le batch remonté est petit (F1)', async () => {
    // Given : seuil 20%, total 100, batch remonté = 5 candidats mais le
    // parc inactif réel en compte 30 (30% > 20%) : sans le count réel,
    // l'ancien code n'aurait vu que 5/100 = 5% et n'aurait jamais abandonné
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.compterInvitesInactifs.resolves(30)
    jeuneInviteRepository.recupererInvitesInactifs.resolves(
      Array.from({ length: 5 }, (_, i) => ({
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
    const resultat = suivi.resultat as {
      nbPurges: number
      pourcentageParc: number
      abandon: boolean
    }
    expect(resultat.nbPurges).to.equal(0)
    expect(resultat.pourcentageParc).to.equal(30)
    expect(resultat.abandon).to.equal(true)
  })
})
