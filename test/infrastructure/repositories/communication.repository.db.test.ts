import { DateTime } from 'luxon'
import { Communication } from '../../../src/domain/communication'
import { CommunicationEnvoi } from '../../../src/domain/communication-envoi'
import { Core } from '../../../src/domain/core'
import { Profil } from '../../../src/domain/profil'
import { CommunicationSqlRepository } from '../../../src/infrastructure/repositories/communication.repository.db'
import { CommunicationEnvoiSqlModel } from '../../../src/infrastructure/sequelize/models/communication-envoi.sql-model'
import { CommunicationSqlModel } from '../../../src/infrastructure/sequelize/models/communication.sql-model'
import { ConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/conseiller.sql-model'
import { JeuneSqlModel } from '../../../src/infrastructure/sequelize/models/jeune.sql-model'
import { PopulationConseillerSqlModel } from '../../../src/infrastructure/sequelize/models/population-conseiller.sql-model'
import { PopulationProfilSqlModel } from '../../../src/infrastructure/sequelize/models/population-profil.sql-model'
import { PopulationSqlModel } from '../../../src/infrastructure/sequelize/models/population.sql-model'
import { unConseillerDto } from '../../fixtures/sql-models/conseiller.sql-model'
import { unJeuneDto } from '../../fixtures/sql-models/jeune.sql-model'
import { expect } from '../../utils'
import {
  DatabaseForTesting,
  getDatabase
} from '../../utils/database-for-testing'

describe('CommunicationSqlRepository', () => {
  const maintenant = DateTime.fromISO('2026-10-01T12:00:00.000Z')
  const hier = maintenant.minus({ days: 1 }).toJSDate()
  const demain = maintenant.plus({ days: 1 }).toJSDate()
  const dansUneSemaine = maintenant.plus({ days: 7 }).toJSDate()

  let databaseForTesting: DatabaseForTesting
  let repo: CommunicationSqlRepository

  before(() => {
    databaseForTesting = getDatabase()
  })

  beforeEach(async () => {
    await databaseForTesting.cleanPG()
    repo = new CommunicationSqlRepository(databaseForTesting.sequelize)

    await ConseillerSqlModel.bulkCreate([
      unConseillerDto({
        id: 'conseillerCite',
        structure: Core.Structure.POLE_EMPLOI,
        dispositif: Profil.Dispositif.AIJ,
        email: 'cite@ft.fr'
      }),
      unConseillerDto({
        id: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI,
        email: 'ftcej@ft.fr'
      }),
      unConseillerDto({
        id: 'conseillerMilo',
        structure: Core.Structure.MILO,
        email: 'milo@milo.fr'
      })
    ])
    await JeuneSqlModel.bulkCreate([
      unJeuneDto({
        id: 'jeuneDuConseillerCite',
        idConseiller: 'conseillerCite',
        structure: Core.Structure.POLE_EMPLOI_AIJ
      }),
      unJeuneDto({
        id: 'jeuneTransfere',
        idConseiller: 'conseillerMilo',
        idConseillerInitial: 'conseillerCite',
        structure: Core.Structure.POLE_EMPLOI_AIJ
      }),
      unJeuneDto({
        id: 'jeuneFtCej',
        idConseiller: 'conseillerFtCej',
        structure: Core.Structure.POLE_EMPLOI
      }),
      unJeuneDto({
        id: 'jeuneMilo',
        idConseiller: 'conseillerMilo',
        structure: Core.Structure.MILO
      })
    ])
    await PopulationSqlModel.bulkCreate([
      { id: 'PILOTE', description: null },
      { id: 'FT_CEJ', description: null }
    ])
    await PopulationConseillerSqlModel.bulkCreate([
      { idPopulation: 'PILOTE', emailConseiller: 'cite@ft.fr' }
    ])
    await PopulationProfilSqlModel.bulkCreate([
      {
        idPopulation: 'FT_CEJ',
        structure: Profil.Structure.FRANCE_TRAVAIL,
        dispositif: Profil.Dispositif.CEJ
      }
    ])
  })

  function uneCommunication(
    surcharge: Partial<{
      idPopulation: string
      destinataire: Communication.Destinataire
      type: Communication.Type
      dateDebut: Date
      dateFin: Date | null
      titre: string
      contenu: string
      ctaLabel: string | null
      ctaUrlAndroid: string | null
      ctaUrlIos: string | null
    }>
  ): {
    idPopulation: string
    destinataire: Communication.Destinataire
    type: Communication.Type
    dateDebut: Date
    dateFin: Date | null
    titre: string
    contenu: string
    ctaLabel: string | null
    ctaUrlAndroid: string | null
    ctaUrlIos: string | null
  } {
    return {
      idPopulation: 'PILOTE',
      destinataire: Communication.Destinataire.CONSEILLER,
      type: Communication.Type.IN_APP,
      dateDebut: hier,
      dateFin: demain,
      titre: 'Votre application évolue',
      contenu: 'Le 15 octobre 2026…',
      ctaLabel: null,
      ctaUrlAndroid: null,
      ctaUrlIos: null,
      ...surcharge
    }
  }

  describe('getMessageInformatifDuConseiller', () => {
    it('renvoie la communication du conseiller cité par email', async () => {
      // Given
      await CommunicationSqlModel.create(uneCommunication({}))

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).to.deep.include({
        titre: 'Votre application évolue',
        contenu: 'Le 15 octobre 2026…'
      })
      expect(message!.id).to.be.a('number')
    })

    it('renvoie la communication du conseiller dont le profil correspond', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunication({ idPopulation: 'FT_CEJ' })
      )

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerFtCej',
        maintenant
      )

      // Then
      expect(message).not.to.be.undefined()
    })

    it('ne renvoie rien au conseiller hors de la population', async () => {
      // Given
      await CommunicationSqlModel.create(uneCommunication({}))

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerMilo',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('ne renvoie rien avant la date de début', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunication({ dateDebut: demain, dateFin: dansUneSemaine })
      )

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('ne renvoie rien à partir de la date de fin', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunication({ dateDebut: hier, dateFin: maintenant.toJSDate() })
      )

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('renvoie la communication dès la date de début', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunication({ dateDebut: maintenant.toJSDate(), dateFin: demain })
      )

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).not.to.be.undefined()
    })

    it('ignore les communications destinées aux jeunes et les notifications', async () => {
      // Given
      await CommunicationSqlModel.bulkCreate([
        uneCommunication({ destinataire: Communication.Destinataire.JEUNE }),
        uneCommunication({ type: Communication.Type.NOTIFICATION })
      ])

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('renvoie la communication dont la fin est la plus proche quand plusieurs sont visibles', async () => {
      // Given
      await CommunicationSqlModel.bulkCreate([
        uneCommunication({ titre: 'Lointaine', dateFin: dansUneSemaine }),
        uneCommunication({ titre: 'Urgente', dateFin: demain })
      ])

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message!.titre).to.equal('Urgente')
    })

    it('reste visible sans date de fin', async () => {
      // Given
      await CommunicationSqlModel.create(uneCommunication({ dateFin: null }))

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message).not.to.be.undefined()
    })

    it('priorise une communication avec une échéance sur une communication sans date de fin', async () => {
      // Given
      await CommunicationSqlModel.bulkCreate([
        uneCommunication({ titre: 'Indéfinie', dateFin: null }),
        uneCommunication({ titre: 'Urgente', dateFin: demain })
      ])

      // When
      const message = await repo.getMessageInformatifDuConseiller(
        'conseillerCite',
        maintenant
      )

      // Then
      expect(message!.titre).to.equal('Urgente')
    })
  })

  describe('getMessageInformatifDuJeune', () => {
    function uneCommunicationJeune(
      surcharge: Partial<{
        idPopulation: string
        type: Communication.Type
        dateDebut: Date
        dateFin: Date | null
        titre: string
        contenu: string
        ctaLabel: string | null
        ctaUrlAndroid: string | null
        ctaUrlIos: string | null
      }>
    ): {
      idPopulation: string
      destinataire: Communication.Destinataire
      type: Communication.Type
      dateDebut: Date
      dateFin: Date | null
      titre: string
      contenu: string
      ctaLabel: string | null
      ctaUrlAndroid: string | null
      ctaUrlIos: string | null
    } {
      return uneCommunication({
        destinataire: Communication.Destinataire.JEUNE,
        ...surcharge
      })
    }

    it('renvoie la communication du jeune dont le profil correspond', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunicationJeune({ idPopulation: 'FT_CEJ' })
      )

      // When
      const message = await repo.getMessageInformatifDuJeune(
        'jeuneFtCej',
        maintenant
      )

      // Then
      expect(message).to.deep.include({
        titre: 'Votre application évolue',
        contenu: 'Le 15 octobre 2026…'
      })
      expect(message!.id).to.be.a('number')
      expect(message!.cta).to.be.undefined()
    })

    it('renvoie la communication du jeune dont le conseiller de référence est cité par email', async () => {
      // Given
      await CommunicationSqlModel.create(uneCommunicationJeune({}))

      // When
      const message = await repo.getMessageInformatifDuJeune(
        'jeuneDuConseillerCite',
        maintenant
      )

      // Then
      expect(message).not.to.be.undefined()
    })

    it('se base sur le conseiller initial pour un jeune en transfert temporaire', async () => {
      // Given
      await CommunicationSqlModel.create(uneCommunicationJeune({}))

      // When
      const message = await repo.getMessageInformatifDuJeune(
        'jeuneTransfere',
        maintenant
      )

      // Then
      expect(message).not.to.be.undefined()
    })

    it('ne renvoie rien au jeune hors de la population', async () => {
      // Given
      await CommunicationSqlModel.create(uneCommunicationJeune({}))

      // When
      const message = await repo.getMessageInformatifDuJeune(
        'jeuneMilo',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('ne renvoie rien hors de la fenêtre de visibilité', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunicationJeune({ dateDebut: demain, dateFin: dansUneSemaine })
      )

      // When
      const message = await repo.getMessageInformatifDuJeune(
        'jeuneDuConseillerCite',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('ignore les communications destinées aux conseillers et les notifications', async () => {
      // Given
      await CommunicationSqlModel.bulkCreate([
        uneCommunication({
          destinataire: Communication.Destinataire.CONSEILLER
        }),
        uneCommunicationJeune({ type: Communication.Type.NOTIFICATION })
      ])

      // When
      const message = await repo.getMessageInformatifDuJeune(
        'jeuneDuConseillerCite',
        maintenant
      )

      // Then
      expect(message).to.be.undefined()
    })

    it('renvoie la communication dont la fin est la plus proche quand plusieurs sont visibles', async () => {
      // Given
      await CommunicationSqlModel.bulkCreate([
        uneCommunicationJeune({ titre: 'Lointaine', dateFin: dansUneSemaine }),
        uneCommunicationJeune({ titre: 'Urgente', dateFin: demain })
      ])

      // When
      const message = await repo.getMessageInformatifDuJeune(
        'jeuneDuConseillerCite',
        maintenant
      )

      // Then
      expect(message!.titre).to.equal('Urgente')
    })

    it('renvoie le cta quand la communication en a un', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunicationJeune({
          ctaLabel: 'Télécharger l’application',
          ctaUrlAndroid: 'https://play.google.com/store/apps/details?id=xxx',
          ctaUrlIos: 'https://apps.apple.com/app/apple-store/id123'
        })
      )

      // When
      const message = await repo.getMessageInformatifDuJeune(
        'jeuneDuConseillerCite',
        maintenant
      )

      // Then
      expect(message!.cta).to.deep.equal({
        label: 'Télécharger l’application',
        urlAndroid: 'https://play.google.com/store/apps/details?id=xxx',
        urlIos: 'https://apps.apple.com/app/apple-store/id123'
      })
    })

    it('reste visible sans date de fin', async () => {
      // Given
      await CommunicationSqlModel.create(
        uneCommunicationJeune({ dateFin: null })
      )

      // When
      const message = await repo.getMessageInformatifDuJeune(
        'jeuneDuConseillerCite',
        maintenant
      )

      // Then
      expect(message).not.to.be.undefined()
    })

    it('priorise une communication avec une échéance sur une communication sans date de fin', async () => {
      // Given
      await CommunicationSqlModel.bulkCreate([
        uneCommunicationJeune({ titre: 'Indéfinie', dateFin: null }),
        uneCommunicationJeune({ titre: 'Urgente', dateFin: demain })
      ])

      // When
      const message = await repo.getMessageInformatifDuJeune(
        'jeuneDuConseillerCite',
        maintenant
      )

      // Then
      expect(message!.titre).to.equal('Urgente')
    })
  })

  describe('envoi des NOTIFICATION', () => {
    function uneNotificationAEnvoyer(
      surcharge: Partial<{
        idPopulation: string
        dateDebut: Date
        statutEnvoi: Communication.StatutEnvoi | null
        push: boolean | null
        destinataire: Communication.Destinataire
      }> = {}
    ): Promise<CommunicationSqlModel> {
      return CommunicationSqlModel.create({
        ...uneCommunication({
          destinataire: Communication.Destinataire.JEUNE,
          type: Communication.Type.NOTIFICATION,
          dateFin: null,
          titre: 'Courte',
          contenu: 'Court'
        }),
        push: true,
        statutEnvoi: Communication.StatutEnvoi.A_ENVOYER,
        ...surcharge
      })
    }

    describe('demarrerProchainEnvoi', () => {
      it('réclame la première communication due et fige les jeunes de la population avec token', async () => {
        // Given
        await JeuneSqlModel.update(
          { pushNotificationToken: null },
          { where: { id: 'jeuneTransfere' } }
        )
        const due = await uneNotificationAEnvoyer()
        await uneNotificationAEnvoyer({ dateDebut: demain })

        // When
        const aEnvoyer = await repo.demarrerProchainEnvoi(maintenant)

        // Then
        expect(aEnvoyer?.id).to.equal(due.id)
        expect(aEnvoyer?.push).to.equal(true)
        const communication = await CommunicationSqlModel.findByPk(due.id)
        expect(communication!.statutEnvoi).to.equal(
          Communication.StatutEnvoi.EN_COURS
        )
        const envois = await CommunicationEnvoiSqlModel.findAll({
          where: { idCommunication: due.id },
          order: [['idJeune', 'ASC']]
        })
        expect(envois.map(e => e.idJeune)).to.deep.equal([
          'jeuneDuConseillerCite'
        ])
        expect(envois[0].statut).to.equal(CommunicationEnvoi.Statut.A_ENVOYER)
      })

      it('fige tous les jeunes de la population, même sans token, quand push est faux', async () => {
        // Given
        await JeuneSqlModel.update(
          { pushNotificationToken: null },
          { where: { id: 'jeuneTransfere' } }
        )
        const due = await uneNotificationAEnvoyer({ push: false })

        // When
        await repo.demarrerProchainEnvoi(maintenant)

        // Then
        const envois = await CommunicationEnvoiSqlModel.count({
          where: { idCommunication: due.id }
        })
        expect(envois).to.equal(2)
      })

      it('réclame la communication dont la date de début est la plus ancienne', async () => {
        // Given
        await uneNotificationAEnvoyer({ dateDebut: hier })
        const plusAncienne = await uneNotificationAEnvoyer({
          dateDebut: maintenant.minus({ days: 2 }).toJSDate()
        })

        // When
        const aEnvoyer = await repo.demarrerProchainEnvoi(maintenant)

        // Then
        expect(aEnvoyer?.id).to.equal(plusAncienne.id)
      })

      it("ne réclame rien tant qu'une communication est EN_COURS", async () => {
        // Given
        await uneNotificationAEnvoyer({
          statutEnvoi: Communication.StatutEnvoi.EN_COURS
        })
        const due = await uneNotificationAEnvoyer()

        // When
        const aEnvoyer = await repo.demarrerProchainEnvoi(maintenant)

        // Then
        expect(aEnvoyer).to.equal(undefined)
        expect(
          (await CommunicationSqlModel.findByPk(due.id))!.statutEnvoi
        ).to.equal(Communication.StatutEnvoi.A_ENVOYER)
        expect(await CommunicationEnvoiSqlModel.count()).to.equal(0)
      })

      it('ne duplique pas un envoi déjà figé pour un jeune de la population', async () => {
        // Given
        const due = await uneNotificationAEnvoyer()
        await CommunicationEnvoiSqlModel.create({
          idCommunication: due.id,
          idJeune: 'jeuneTransfere',
          statut: CommunicationEnvoi.Statut.ENVOYEE
        })

        // When
        await repo.demarrerProchainEnvoi(maintenant)

        // Then
        const envois = await CommunicationEnvoiSqlModel.findAll({
          where: { idCommunication: due.id },
          order: [['idJeune', 'ASC']]
        })
        expect(envois.map(e => [e.idJeune, e.statut])).to.deep.equal([
          ['jeuneDuConseillerCite', CommunicationEnvoi.Statut.A_ENVOYER],
          ['jeuneTransfere', CommunicationEnvoi.Statut.ENVOYEE]
        ])
      })

      it('ignore les communications non dues, déjà démarrées, IN_APP ou sans push', async () => {
        // Given
        await uneNotificationAEnvoyer({ dateDebut: demain })
        await uneNotificationAEnvoyer({
          statutEnvoi: Communication.StatutEnvoi.ANNULEE
        })
        await uneNotificationAEnvoyer({ push: null })
        await CommunicationSqlModel.create({
          ...uneCommunication({}),
          statutEnvoi: null
        })

        // When
        const aEnvoyer = await repo.demarrerProchainEnvoi(maintenant)

        // Then
        expect(aEnvoyer).to.equal(undefined)
        expect(await CommunicationEnvoiSqlModel.count()).to.equal(0)
      })
    })

    describe('recupererEnvoiEnCours', () => {
      it('renvoie la communication EN_COURS', async () => {
        // Given
        const enCours = await uneNotificationAEnvoyer({
          statutEnvoi: Communication.StatutEnvoi.EN_COURS
        })
        await uneNotificationAEnvoyer()

        // When
        const resultat = await repo.recupererEnvoiEnCours()

        // Then
        expect(resultat?.id).to.equal(enCours.id)
        expect(resultat?.echecsConsecutifs).to.equal(0)
      })
    })

    describe('reserverEnvois / marquerEnvoi / rendreEnvois / compterEnvois', () => {
      let idCommunication: number

      beforeEach(async () => {
        const communication = await uneNotificationAEnvoyer({
          idPopulation: 'FT_CEJ'
        })
        idCommunication = communication.id
        await CommunicationEnvoiSqlModel.bulkCreate(
          ['jeuneDuConseillerCite', 'jeuneFtCej', 'jeuneMilo'].map(idJeune => ({
            idCommunication,
            idJeune,
            statut: CommunicationEnvoi.Statut.A_ENVOYER,
            dateTraitement: null
          }))
        )
      })

      it('réserve les n premiers A_ENVOYER avec leur token, par id de jeune', async () => {
        // Given
        await JeuneSqlModel.update(
          { pushNotificationToken: null },
          { where: { id: 'jeuneFtCej' } }
        )

        // When
        const reserves = await repo.reserverEnvois(
          idCommunication,
          2,
          maintenant
        )

        // Then
        expect(reserves).to.deep.equal([
          { idJeune: 'jeuneDuConseillerCite', token: 'token' },
          { idJeune: 'jeuneFtCej', token: null }
        ])
        const compteurs = await repo.compterEnvois(idCommunication)
        expect(compteurs).to.deep.equal({
          aEnvoyer: 1,
          enCours: 2,
          envoyees: 0,
          erreurs: 0,
          tokensInvalides: 0
        })
      })

      it('marque un envoi et rend les autres', async () => {
        // Given
        await repo.reserverEnvois(idCommunication, 3, maintenant)

        // When
        await repo.marquerEnvoi(
          idCommunication,
          'jeuneFtCej',
          CommunicationEnvoi.Statut.ENVOYEE,
          maintenant
        )
        await repo.rendreEnvois(idCommunication, [
          'jeuneDuConseillerCite',
          'jeuneMilo'
        ])

        // Then
        expect(await repo.compterEnvois(idCommunication)).to.deep.equal({
          aEnvoyer: 2,
          enCours: 0,
          envoyees: 1,
          erreurs: 0,
          tokensInvalides: 0
        })
      })

      it('ne réserve ensuite que les A_ENVOYER restants', async () => {
        // Given
        await repo.reserverEnvois(idCommunication, 2, maintenant)

        // When
        const reserves = await repo.reserverEnvois(
          idCommunication,
          5,
          maintenant
        )

        // Then
        expect(reserves.map(r => r.idJeune)).to.deep.equal(['jeuneMilo'])
      })

      it('ne touche pas un envoi déjà ENVOYEE en le marquant ou en le rendant', async () => {
        // Given
        await repo.reserverEnvois(idCommunication, 1, maintenant)
        await repo.marquerEnvoi(
          idCommunication,
          'jeuneDuConseillerCite',
          CommunicationEnvoi.Statut.ENVOYEE,
          maintenant
        )

        // When
        await repo.marquerEnvoi(
          idCommunication,
          'jeuneDuConseillerCite',
          CommunicationEnvoi.Statut.ERREUR,
          maintenant
        )
        await repo.rendreEnvois(idCommunication, ['jeuneDuConseillerCite'])

        // Then
        expect(await repo.compterEnvois(idCommunication)).to.deep.equal({
          aEnvoyer: 2,
          enCours: 0,
          envoyees: 1,
          erreurs: 0,
          tokensInvalides: 0
        })
      })

      it('ne libère pas les EN_COURS plus récents que la date donnée', async () => {
        // Given
        await repo.reserverEnvois(idCommunication, 3, maintenant)

        // When
        const liberes = await repo.libererEnvoisBloques(
          idCommunication,
          maintenant.minus({ minutes: 30 })
        )

        // Then
        expect(liberes).to.equal(0)
        expect((await repo.compterEnvois(idCommunication)).enCours).to.equal(3)
      })

      it('libère les EN_COURS plus vieux que la date donnée', async () => {
        // Given
        await repo.reserverEnvois(
          idCommunication,
          3,
          maintenant.minus({ hours: 1 })
        )

        // When
        const liberes = await repo.libererEnvoisBloques(
          idCommunication,
          maintenant.minus({ minutes: 30 })
        )

        // Then
        expect(liberes).to.equal(3)
        expect((await repo.compterEnvois(idCommunication)).aEnvoyer).to.equal(3)
      })
    })

    describe('terminerEnvoi', () => {
      it('pose le statut, la date et fige les totaux', async () => {
        // Given
        const communication = await uneNotificationAEnvoyer({
          statutEnvoi: Communication.StatutEnvoi.EN_COURS
        })
        await CommunicationEnvoiSqlModel.bulkCreate([
          {
            idCommunication: communication.id,
            idJeune: 'jeuneDuConseillerCite',
            statut: CommunicationEnvoi.Statut.ENVOYEE
          },
          {
            idCommunication: communication.id,
            idJeune: 'jeuneFtCej',
            statut: CommunicationEnvoi.Statut.ERREUR
          },
          {
            idCommunication: communication.id,
            idJeune: 'jeuneMilo',
            statut: CommunicationEnvoi.Statut.TOKEN_INVALIDE
          }
        ])

        // When
        await repo.terminerEnvoi(
          communication.id,
          Communication.StatutEnvoi.ENVOYEE,
          maintenant
        )

        // Then
        const terminee = await CommunicationSqlModel.findByPk(communication.id)
        expect(terminee!.statutEnvoi).to.equal(
          Communication.StatutEnvoi.ENVOYEE
        )
        expect(terminee!.envoiTermineLe).to.deep.equal(maintenant.toJSDate())
        expect(terminee!.nbEnvoyees).to.equal(1)
        expect(terminee!.nbErreurs).to.equal(1)
        expect(terminee!.nbTokensInvalides).to.equal(1)
      })
    })

    describe('enregistrerEchecDeLot', () => {
      it('incrémente et renvoie le compteur, que reinitialiserEchecsDeLot remet à zéro', async () => {
        // Given
        const communication = await uneNotificationAEnvoyer({
          statutEnvoi: Communication.StatutEnvoi.EN_COURS
        })

        // When - Then
        expect(await repo.enregistrerEchecDeLot(communication.id)).to.equal(1)
        expect(await repo.enregistrerEchecDeLot(communication.id)).to.equal(2)
        await repo.reinitialiserEchecsDeLot(communication.id)
        expect(
          (await CommunicationSqlModel.findByPk(communication.id))!
            .echecsConsecutifs
        ).to.equal(0)
      })
    })

    describe('compterDestinataires', () => {
      it('compte les jeunes de la population, avec token seulement si push', async () => {
        // Given
        await JeuneSqlModel.update(
          { pushNotificationToken: null },
          { where: { id: 'jeuneTransfere' } }
        )

        // When - Then
        expect(await repo.compterDestinataires('PILOTE', true)).to.equal(1)
        expect(await repo.compterDestinataires('PILOTE', false)).to.equal(2)
      })
    })
  })
})
