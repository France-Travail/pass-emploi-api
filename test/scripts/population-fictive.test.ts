import {
  construireJeunesFictifs,
  lireArguments,
  PREFIXE,
  verifierEnvironnement
} from '../../src/scripts/population-fictive'
import { expect } from '../utils'

describe('population-fictive', () => {
  describe('verifierEnvironnement', () => {
    for (const environnement of ['staging', 'development']) {
      it(`accepte ${environnement}`, () => {
        expect(() => verifierEnvironnement(environnement)).not.to.throw()
      })
    }

    for (const environnement of [
      'prod',
      undefined,
      '',
      'Staging',
      'staging ',
      'test'
    ]) {
      it(`refuse ${JSON.stringify(environnement)}`, () => {
        expect(() => verifierEnvironnement(environnement)).to.throw(
          `ENVIRONMENT=${JSON.stringify(environnement)}`
        )
      })
    }
  })

  describe('lireArguments', () => {
    it('lit la commande seule', () => {
      expect(lireArguments(['etat'])).to.deep.equal({ commande: 'etat' })
    })

    it('lit les options de semer', () => {
      expect(
        lireArguments([
          'semer',
          '--email-conseiller',
          'conseillere@exemple.fr',
          '--mails',
          'marie@exemple.fr'
        ])
      ).to.deep.equal({
        commande: 'semer',
        emailConseiller: 'conseillere@exemple.fr',
        mails: 'marie@exemple.fr'
      })
    })

    it('refuse une commande inconnue', () => {
      expect(() => lireArguments(['archiver'])).to.throw('Usage')
    })

    it('refuse une absence de commande', () => {
      expect(() => lireArguments([])).to.throw('Usage')
    })

    it('refuse une option inconnue', () => {
      expect(() => lireArguments(['semer', '--nb', '50'])).to.throw()
    })

    it('refuse une option sur une autre commande que semer', () => {
      expect(() =>
        lireArguments(['nettoyer', '--mails', 'marie@exemple.fr'])
      ).to.throw('Usage')
    })

    it('refuse une adresse de mails sans arobase unique', () => {
      expect(() => lireArguments(['semer', '--mails', 'marie'])).to.throw(
        '--mails'
      )
    })
  })

  describe('construireJeunesFictifs', () => {
    it('construit 4 jeunes et 1 témoin, tous préfixés', () => {
      // When
      const jeunes = construireJeunesFictifs()

      // Then
      expect(jeunes.map(jeune => jeune.id)).to.deep.equal([
        'demo-migr-000000',
        'demo-migr-000001',
        'demo-migr-000002',
        'demo-migr-000003',
        'demo-migr-temoin-000000'
      ])
      expect(jeunes.filter(jeune => jeune.temoin)).to.have.length(1)
      for (const jeune of jeunes) {
        expect(jeune.idAuthentification.startsWith(PREFIXE)).to.be.true()
      }
    })

    it('donne des identifiants d’authentification à largeur fixe', () => {
      // When
      const jeunes = construireJeunesFictifs()

      // Then
      expect(jeunes.map(jeune => jeune.idAuthentification)).to.deep.equal([
        'demo-migr-auth-000000',
        'demo-migr-auth-000001',
        'demo-migr-auth-000002',
        'demo-migr-auth-000003',
        'demo-migr-auth-temoin-000000'
      ])
    })

    it('rend tous les jeunes inactifs, en @example.com, sans --mails', () => {
      // When
      const jeunes = construireJeunesFictifs()

      // Then
      for (const jeune of jeunes) {
        expect(jeune.actif).to.be.false()
        expect(jeune.email).to.equal(`${jeune.id}@example.com`)
      }
    })

    it('rend actifs les jeunes prévus, en plus-addressing, avec --mails', () => {
      // When
      const jeunes = construireJeunesFictifs('marie@exemple.fr')

      // Then
      expect(
        jeunes.map(({ id, actif, email }) => ({ id, actif, email }))
      ).to.deep.equal([
        {
          id: 'demo-migr-000000',
          actif: true,
          email: 'marie+demo-migr-000000@exemple.fr'
        },
        {
          id: 'demo-migr-000001',
          actif: true,
          email: 'marie+demo-migr-000001@exemple.fr'
        },
        {
          id: 'demo-migr-000002',
          actif: false,
          email: 'demo-migr-000002@example.com'
        },
        {
          id: 'demo-migr-000003',
          actif: false,
          email: 'demo-migr-000003@example.com'
        },
        {
          id: 'demo-migr-temoin-000000',
          actif: true,
          email: 'marie+demo-migr-temoin-000000@exemple.fr'
        }
      ])
    })

    it('sème un chat pour une partie des jeunes', () => {
      // When
      const jeunes = construireJeunesFictifs()

      // Then
      expect(
        jeunes.filter(jeune => jeune.avecChat).map(jeune => jeune.id)
      ).to.deep.equal([
        'demo-migr-000000',
        'demo-migr-000002',
        'demo-migr-temoin-000000'
      ])
    })
  })
})
