import { DateTime } from 'luxon'
import { JeuneInviteSqlRepository } from '../../../../src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db'
import { JeuneInviteSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune-invite.sql-model'
import { unJeuneInviteDto } from '../../../fixtures/sql-models/jeune-invite.sql-model'
import { expect } from '../../../utils'
import { getDatabase } from '../../../utils/database-for-testing'

describe('JeuneInviteSqlRepository', () => {
  let repository: JeuneInviteSqlRepository
  const maintenant = DateTime.fromISO('2026-08-04T12:00:00.000Z')
  const seuil = maintenant.minus({ months: 12 }).toJSDate()

  beforeEach(async () => {
    await getDatabase().cleanPG()
    repository = new JeuneInviteSqlRepository()
  })

  describe('recupererInvitesInactifs', () => {
    it('retourne les invités dont date_derniere_activite < seuil', async () => {
      // Given
      const dateActiviteVieille = maintenant.minus({ months: 18 }).toJSDate()
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-activite-vieille',
          idAuthentification: 'sub-inactif',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActivite: dateActiviteVieille
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-activation-egale-creation',
          idAuthentification: 'sub-inactif-creation',
          dateCreation: maintenant.minus({ months: 18 }).toJSDate(),
          dateDerniereActivite: maintenant.minus({ months: 18 }).toJSDate()
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif-activite-recente',
          idAuthentification: 'sub-actif',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActivite: maintenant.minus({ days: 5 }).toJSDate()
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif-cree-recemment',
          idAuthentification: 'sub-recent',
          dateCreation: maintenant.minus({ days: 5 }).toJSDate(),
          dateDerniereActivite: maintenant.minus({ days: 5 }).toJSDate()
        })
      )
      // When
      const inactifs = await repository.recupererInvitesInactifs(seuil)

      // Then
      expect(inactifs.map(i => i.id).sort()).to.deep.equal([
        'inactif-activation-egale-creation',
        'inactif-activite-vieille'
      ])
      expect(inactifs[0]).to.have.property('idAuthentification')

      const inactifActiviteVieille = inactifs.find(
        i => i.id === 'inactif-activite-vieille'
      )
      expect(inactifActiviteVieille?.dateReference.getTime()).to.equal(
        dateActiviteVieille.getTime()
      )
      const inactifActivationEgaleCreation = inactifs.find(
        i => i.id === 'inactif-activation-egale-creation'
      )
      expect(inactifActivationEgaleCreation?.dateReference.getTime()).to.equal(
        maintenant.minus({ months: 18 }).toJSDate().getTime()
      )
    })
  })

  describe('compterTout', () => {
    it('retourne le nombre total dinvités', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({ id: 'a', idAuthentification: 'sa' })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({ id: 'b', idAuthentification: 'sb' })
      )

      // When
      const total = await repository.compterTout()

      // Then
      expect(total).to.equal(2)
    })
  })

  describe('supprimerPlusieurs', () => {
    it('supprime toutes les lignes passées et laisse les autres intactes', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({ id: 'a-supprimer-1', idAuthentification: 'sup1' })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({ id: 'a-supprimer-2', idAuthentification: 'sup2' })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({ id: 'a-garder', idAuthentification: 'garde' })
      )

      // When
      await repository.supprimerPlusieurs(['a-supprimer-1', 'a-supprimer-2'])

      // Then
      expect(await JeuneInviteSqlModel.findByPk('a-supprimer-1')).to.equal(null)
      expect(await JeuneInviteSqlModel.findByPk('a-supprimer-2')).to.equal(null)
      expect(await JeuneInviteSqlModel.findByPk('a-garder')).not.to.equal(null)
    })
  })

  describe('recupererPourReprise', () => {
    it("retourne l'invité non repris, sans repreneur", async () => {
      // Given
      const dateCreation = maintenant.minus({ days: 3 })
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'invite',
          dateCreation: dateCreation.toJSDate()
        })
      )

      // When
      const invite = await repository.recupererPourReprise('invite')

      // Then
      expect(invite).to.deep.equal({ id: 'invite', dateCreation })
    })

    it("retourne le repreneur quand l'invité a été repris", async () => {
      // Given
      const dateCreation = maintenant.minus({ days: 3 })
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'invite',
          dateCreation: dateCreation.toJSDate(),
          idJeuneRepreneur: 'id-jeune',
          dateReprise: maintenant.toJSDate()
        })
      )

      // When
      const invite = await repository.recupererPourReprise('invite')

      // Then
      expect(invite).to.deep.equal({
        id: 'invite',
        dateCreation,
        idJeuneRepreneur: 'id-jeune'
      })
    })

    it('retourne undefined pour un invité inconnu', async () => {
      // When
      const invite = await repository.recupererPourReprise('inconnu')

      // Then
      expect(invite).to.equal(undefined)
    })
  })

  describe('marquerRepris', () => {
    it('enregistre le jeune repreneur et la date de reprise', async () => {
      // Given
      await JeuneInviteSqlModel.creer(unJeuneInviteDto({ id: 'invite' }))

      // When
      const marque = await repository.marquerRepris(
        'invite',
        'id-jeune',
        maintenant
      )

      // Then
      expect(marque).to.equal(true)
      const invite = await JeuneInviteSqlModel.findByPk('invite')
      expect(invite!.idJeuneRepreneur).to.equal('id-jeune')
      expect(invite!.dateReprise).to.deep.equal(maintenant.toJSDate())
    })

    it("n'écrase pas une reprise déjà enregistrée", async () => {
      // Given
      await JeuneInviteSqlModel.creer(unJeuneInviteDto({ id: 'invite' }))
      await repository.marquerRepris('invite', 'premier-jeune', maintenant)

      // When
      const marque = await repository.marquerRepris(
        'invite',
        'second-jeune',
        maintenant.plus({ minutes: 1 })
      )

      // Then
      expect(marque).to.equal(false)
      const invite = await JeuneInviteSqlModel.findByPk('invite')
      expect(invite!.idJeuneRepreneur).to.equal('premier-jeune')
    })
  })

  describe('recupererInvitesRepris', () => {
    it('ne retourne que les invités repris', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'repris',
          idAuthentification: 'sub-repris',
          idJeuneRepreneur: 'id-jeune',
          dateReprise: maintenant.toJSDate()
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'non-repris',
          idAuthentification: 'sub-non-repris'
        })
      )

      // When
      const invites = await repository.recupererInvitesRepris()

      // Then
      expect(invites).to.deep.equal([
        { id: 'repris', idAuthentification: 'sub-repris' }
      ])
    })
  })
})
