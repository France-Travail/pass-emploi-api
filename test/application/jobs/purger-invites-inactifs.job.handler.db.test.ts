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
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
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
      plusCourteInactiviteJours: number
    }
    expect(resultat.nbPurges).to.equal(2)
    const ageAttenduRecent = Math.floor(
      maintenant.diff(DateTime.fromJSDate(dateReferenceRecente), 'days').days
    )
    expect(resultat.plusCourteInactiviteJours).to.equal(ageAttenduRecent)
  })

  it('ne supprime pas la ligne DB si la suppression IDP échoue', async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
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
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
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
      plusCourteInactiviteJours: number
    }
    expect(resultat.nbSimules).to.equal(1)
    const ageAttendu = Math.floor(
      maintenant.diff(DateTime.fromJSDate(dateReference), 'days').days
    )
    expect(resultat.plusCourteInactiviteJours).to.equal(ageAttendu)
  })

  it("purge normalement et se contente d'alerter quand le backlog d'inactifs dépasse le seuil (F1)", async () => {
    // Given : seuil 20%, total 100, backlog d'inactifs = 30 (30% > 20%), tous
    // les candidats remontés sont bien plus vieux que la rétention : le
    // backlog est un signal d'alerte, pas une raison d'abandonner
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
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
    ).to.have.callCount(30)
    expect(suivi.succes).to.equal(true)
    const resultat = suivi.resultat as {
      nbPurges: number
      pourcentageInactifs: number
      motifAbandon: string | null
      alerteBacklog: boolean
      nombreInactifs: number
    }
    expect(resultat.nbPurges).to.equal(30)
    expect(resultat.pourcentageInactifs).to.equal(30)
    expect(resultat.motifAbandon).to.equal(null)
    expect(resultat.alerteBacklog).to.equal(true)
    expect(resultat.nombreInactifs).to.equal(30)
  })

  it("n'alerte pas quand le backlog d'inactifs reste sous le seuil", async () => {
    // Given : seuil 20%, backlog d'inactifs = 10% du parc
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
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
      alerteBacklog: boolean
      motifAbandon: string | null
    }
    expect(resultat.pourcentageInactifs).to.equal(10)
    expect(resultat.alerteBacklog).to.equal(false)
    expect(resultat.motifAbandon).to.equal(null)
    expect(suivi.succes).to.equal(true)
  })

  it('abandonne sans rien supprimer quand un candidat est plus jeune que la rétention (invariant violé)', async () => {
    // Given : retentionJours = 365, un candidat n'a que 10 jours d'inactivité
    // ce qui ne devrait jamais arriver si la requête et le seuil sont corrects
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      {
        id: 'inv1',
        idAuthentification: 'sub1',
        dateReference: maintenant.minus({ days: 10 }).toJSDate()
      }
    ])

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
      motifAbandon: string | null
      plusCourteInactiviteJours: number
    }
    expect(suivi.nbErreurs).to.equal(1)
    expect(resultat.nbPurges).to.equal(0)
    expect(resultat.motifAbandon).to.equal('INVARIANT_AGE')
    expect(resultat.plusCourteInactiviteJours).to.equal(10)
  })

  it('supprime tous les candidats en un seul run, même bien au-delà de 500 (pas de plafond)', async () => {
    // Given
    const candidats = Array.from({ length: 600 }, (_, i) => ({
      id: `inv${i}`,
      idAuthentification: `sub${i}`,
      dateReference: maintenant.minus({ months: 18 }).toJSDate()
    }))
    jeuneInviteRepository.compterTout.resolves(1000)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
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

  it("n'abandonne pas quand un candidat a exactement retentionJours jours d'inactivité (comparaison stricte)", async () => {
    // Given : retentionJours = 365, un candidat a exactement 365 jours
    // d'inactivité : c'est légitime, pas une violation de l'invariant
    const dateReference = maintenant.minus({ days: 365 }).toJSDate()
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      { id: 'inv1', idAuthentification: 'sub1', dateReference }
    ])

    // When
    const suivi = await handler.handle()

    // Then
    expect(
      authentificationRepository.supprimerCompteIdpInvite
    ).to.have.been.calledWith('sub1')
    expect(jeuneInviteRepository.supprimer).to.have.been.calledWith('inv1')
    expect(suivi.succes).to.equal(true)
    const resultat = suivi.resultat as {
      motifAbandon: string | null
      plusCourteInactiviteJours: number
    }
    expect(resultat.motifAbandon).to.equal(null)
    expect(resultat.plusCourteInactiviteJours).to.equal(365)
  })

  it("calcule la plus courte inactivité sans dépasser la pile d'appel sur un backlog de 200 000 candidats", async () => {
    // Given : plus de plafond batchMax, le backlog peut atteindre des centaines
    // de milliers de lignes ; le candidat le moins inactif a 400 jours
    const nombreCandidats = 200000
    const candidats = Array.from({ length: nombreCandidats }, (_, i) => ({
      id: `inv${i}`,
      idAuthentification: `sub${i}`,
      dateReference: maintenant.minus({ days: 400 + i }).toJSDate()
    }))
    const ageAttendu = Math.floor(
      maintenant.diff(DateTime.fromJSDate(candidats[0].dateReference), 'days')
        .days
    )
    const config = testConfig()
    config.get('jobs').purgeInvites.dryRun = true
    handler = new PurgerInvitesInactifsJobHandler(
      dateService,
      suiviJobService,
      jeuneInviteRepository,
      authentificationRepository,
      config
    )
    jeuneInviteRepository.compterTout.resolves(nombreCandidats)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
    jeuneInviteRepository.recupererInvitesInactifs.resolves(candidats)

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(true)
    const resultat = suivi.resultat as {
      nbSimules: number
      plusCourteInactiviteJours: number
    }
    expect(resultat.nbSimules).to.equal(nombreCandidats)
    expect(resultat.plusCourteInactiviteJours).to.equal(ageAttendu)
  })

  it("ne déclenche pas le garde-fou quand aucun candidat n'est remonté", async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([])

    // When
    const suivi = await handler.handle()

    // Then
    expect(jeuneInviteRepository.supprimer).not.to.have.been.called()
    expect(suivi.succes).to.equal(true)
    const resultat = suivi.resultat as {
      motifAbandon: string | null
      plusCourteInactiviteJours: number | null
    }
    expect(resultat.motifAbandon).to.equal(null)
    expect(resultat.plusCourteInactiviteJours).to.equal(null)
  })

  it('ne divise pas par zéro et ne abandonne pas quand le parc est vide', async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(0)
    jeuneInviteRepository.existeActiviteDepuis.resolves(false)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([])

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(true)
    const resultat = suivi.resultat as {
      pourcentageInactifs: number
      motifAbandon: string | null
      total: number
    }
    expect(resultat.pourcentageInactifs).to.equal(0)
    expect(resultat.motifAbandon).to.equal(null)
    expect(resultat.total).to.equal(0)
  })

  it('signale un run en échec quand une suppression IDP échoue (F2)', async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
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
      nbEchecsRedis: number
      nbEchecsDb: number
    }
    expect(resultat.nbEchecsRedis).to.equal(1)
    expect(resultat.nbEchecsDb).to.equal(0)
  })

  it('signale un run en échec quand une suppression DB échoue après une suppression IDP réussie (F2)', async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
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
      nbEchecsRedis: number
      nbEchecsDb: number
      nbPurges: number
    }
    expect(resultat.nbEchecsRedis).to.equal(0)
    expect(resultat.nbEchecsDb).to.equal(1)
    expect(resultat.nbPurges).to.equal(0)
  })

  it('expose une forme de résultat unique et complète sur le chemin nominal (F3)', async () => {
    // Given
    const dateReference = maintenant.minus({ months: 18 }).toJSDate()
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.existeActiviteDepuis.resolves(true)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      { id: 'inv1', idAuthentification: 'sub1', dateReference }
    ])

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.resultat).to.deep.equal({
      dryRun: false,
      nbPurges: 1,
      nbSimules: 0,
      nbEchecsRedis: 0,
      nbEchecsDb: 0,
      pourcentageInactifs: 1,
      plusCourteInactiviteJours: Math.floor(
        maintenant.diff(DateTime.fromJSDate(dateReference), 'days').days
      ),
      motifAbandon: null,
      activiteRecente: true,
      alerteBacklog: false,
      nombreInactifs: 1,
      total: 100
    })
  })

  it("abandonne sans rien supprimer quand aucune activité invité n'a été enregistrée depuis 24h sur un parc significatif (signal muet)", async () => {
    // Given : parcMinimalControleSignal = 100 (config de test), total >= ce plancher,
    // et aucune écriture récente de date_derniere_activite : le signal est probablement cassé
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.existeActiviteDepuis.resolves(false)
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
    expect(suivi.nbErreurs).to.equal(1)
    const resultat = suivi.resultat as {
      motifAbandon: string | null
      activiteRecente: boolean
      nbPurges: number
    }
    expect(resultat.motifAbandon).to.equal('SIGNAL_MUET')
    expect(resultat.activiteRecente).to.equal(false)
    expect(resultat.nbPurges).to.equal(0)
    expect(
      jeuneInviteRepository.existeActiviteDepuis.getCall(0).args[0].getTime()
    ).to.equal(maintenant.minus({ hours: 24 }).toJSDate().getTime())
  })

  it('ne déclenche pas le garde-fou signal muet quand le parc est sous le plancher minimal, même sans activité récente', async () => {
    // Given : total = 50, sous parcMinimalControleSignal (100) : une journée sans
    // aucune ouverture d'app reste plausible sur un si petit parc
    jeuneInviteRepository.compterTout.resolves(50)
    jeuneInviteRepository.existeActiviteDepuis.resolves(false)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      {
        id: 'inv1',
        idAuthentification: 'sub1',
        dateReference: maintenant.minus({ months: 18 }).toJSDate()
      }
    ])

    // When
    const suivi = await handler.handle()

    // Then
    expect(
      authentificationRepository.supprimerCompteIdpInvite
    ).to.have.been.calledWith('sub1')
    expect(jeuneInviteRepository.supprimer).to.have.been.calledWith('inv1')
    expect(suivi.succes).to.equal(true)
    const resultat = suivi.resultat as {
      motifAbandon: string | null
      activiteRecente: boolean
    }
    expect(resultat.motifAbandon).to.equal(null)
    expect(resultat.activiteRecente).to.equal(false)
  })
})
