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
    it('retourne les invités dont GREATEST(actualisation, creation) < seuil', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-token-vieux',
          idAuthentification: 'sub-inactif',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActualisationToken: maintenant
            .minus({ months: 18 })
            .toJSDate()
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-jamais-de-token',
          idAuthentification: 'sub-jamais',
          dateCreation: maintenant.minus({ months: 18 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif-token-recent',
          idAuthentification: 'sub-actif',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActualisationToken: maintenant
            .minus({ days: 5 })
            .toJSDate()
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif-cree-recemment',
          idAuthentification: 'sub-recent',
          dateCreation: maintenant.minus({ days: 5 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )

      // When
      const inactifs = await repository.recupererInvitesInactifs(seuil, 100)

      // Then
      expect(inactifs.map(i => i.id).sort()).to.deep.equal([
        'inactif-jamais-de-token',
        'inactif-token-vieux'
      ])
      expect(inactifs[0]).to.have.property('idAuthentification')

      const inactifTokenVieux = inactifs.find(
        i => i.id === 'inactif-token-vieux'
      )
      expect(inactifTokenVieux?.dateReference.getTime()).to.equal(
        maintenant.minus({ months: 18 }).toJSDate().getTime()
      )
      const inactifJamaisDeToken = inactifs.find(
        i => i.id === 'inactif-jamais-de-token'
      )
      expect(inactifJamaisDeToken?.dateReference.getTime()).to.equal(
        maintenant.minus({ months: 18 }).toJSDate().getTime()
      )
    })

    it('respecte la limite passée', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-1',
          idAuthentification: 'sub-1',
          dateCreation: maintenant.minus({ years: 2 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-2',
          idAuthentification: 'sub-2',
          dateCreation: maintenant.minus({ years: 2 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )

      // When
      const inactifs = await repository.recupererInvitesInactifs(seuil, 1)

      // Then
      expect(inactifs).to.have.length(1)
    })
  })

  describe('compterInvitesInactifs', () => {
    it('compte uniquement les invités inactifs (pas tout le parc)', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-1',
          idAuthentification: 'sub-inactif-1',
          dateCreation: maintenant.minus({ years: 2 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-2',
          idAuthentification: 'sub-inactif-2',
          dateCreation: maintenant.minus({ years: 2 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif',
          idAuthentification: 'sub-actif',
          dateCreation: maintenant.minus({ days: 5 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )

      // When
      const nombreInactifs = await repository.compterInvitesInactifs(seuil)

      // Then
      expect(nombreInactifs).to.equal(2)
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
