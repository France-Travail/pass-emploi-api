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
    it('retourne les invités dont GREATEST(activite, creation) < seuil', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-activite-vieille',
          idAuthentification: 'sub-inactif',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActivite: maintenant.minus({ months: 18 }).toJSDate()
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-avant-migration',
          idAuthentification: 'sub-avant-migration',
          dateCreation: maintenant.minus({ months: 18 }).toJSDate(),
          dateDerniereActivite: null
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
          dateDerniereActivite: null
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-malgre-token-recent',
          idAuthentification: 'sub-token-recent',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActivite: maintenant.minus({ months: 18 }).toJSDate(),
          dateDerniereActualisationToken: maintenant
            .minus({ days: 2 })
            .toJSDate()
        })
      )

      // When
      const inactifs = await repository.recupererInvitesInactifs(seuil)

      // Then
      expect(inactifs.map(i => i.id).sort()).to.deep.equal([
        'inactif-activite-vieille',
        'inactif-avant-migration',
        'inactif-malgre-token-recent'
      ])
      expect(inactifs[0]).to.have.property('idAuthentification')

      const inactifActiviteVieille = inactifs.find(
        i => i.id === 'inactif-activite-vieille'
      )
      expect(inactifActiviteVieille?.dateReference.getTime()).to.equal(
        maintenant.minus({ months: 18 }).toJSDate().getTime()
      )
      const inactifAvantMigration = inactifs.find(
        i => i.id === 'inactif-avant-migration'
      )
      expect(inactifAvantMigration?.dateReference.getTime()).to.equal(
        maintenant.minus({ months: 18 }).toJSDate().getTime()
      )
    })
  })

  describe('existeActiviteDepuis', () => {
    const borne = maintenant.minus({ hours: 24 }).toJSDate()

    it('renvoie true quand une ligne a une date_derniere_activite postérieure à la borne', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif-recent',
          idAuthentification: 'sub-actif-recent',
          dateDerniereActivite: maintenant.minus({ hours: 1 }).toJSDate()
        })
      )

      // When
      const activiteRecente = await repository.existeActiviteDepuis(borne)

      // Then
      expect(activiteRecente).to.equal(true)
    })

    it('renvoie false quand seules des lignes antérieures à la borne existent', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif-avant-la-borne',
          idAuthentification: 'sub-actif-avant-la-borne',
          dateDerniereActivite: maintenant.minus({ hours: 48 }).toJSDate()
        })
      )

      // When
      const activiteRecente = await repository.existeActiviteDepuis(borne)

      // Then
      expect(activiteRecente).to.equal(false)
    })

    it('renvoie false quand seules des lignes à date_derniere_activite null existent', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'sans-activite',
          idAuthentification: 'sub-sans-activite',
          dateDerniereActivite: null
        })
      )

      // When
      const activiteRecente = await repository.existeActiviteDepuis(borne)

      // Then
      expect(activiteRecente).to.equal(false)
    })

    it('renvoie false quand la table est vide', async () => {
      // When
      const activiteRecente = await repository.existeActiviteDepuis(borne)

      // Then
      expect(activiteRecente).to.equal(false)
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

  describe('supprimer', () => {
    it('supprime la ligne invité', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({ id: 'a-supprimer', idAuthentification: 'sup' })
      )

      // When
      await repository.supprimer('a-supprimer')

      // Then
      const restant = await JeuneInviteSqlModel.findByPk('a-supprimer')
      expect(restant).to.equal(null)
    })
  })
})
