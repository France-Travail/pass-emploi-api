import {
  resumerHorairesFT,
  toStructureAccompagnementFT,
  toStructureAccompagnementMilo
} from '../../../../src/infrastructure/repositories/mappers/structures-accompagnement.mappers'
import { MissionLocaleApprentissageDto } from '../../../../src/infrastructure/clients/dto/apprentissage.dto'
import {
  AgenceFTDto,
  HoraireAgenceFTDto
} from '../../../../src/infrastructure/clients/dto/pole-emploi.dto'
import { expect } from '../../../utils'

function unJour(
  jour: number,
  surcharge: Partial<HoraireAgenceFTDto> = {}
): HoraireAgenceFTDto {
  return {
    jour,
    ouvertureMatin: '08:30',
    fermetureMatin: '12:30',
    horaireFerme: 'N',
    ouvertureApresMidiRDV: '12:30',
    fermetureApresMidiRDV: '16:30',
    horaireFermeRDV: 'N',
    ...surcharge
  }
}

const horairesStMichel: HoraireAgenceFTDto[] = [
  unJour(1),
  unJour(2),
  unJour(3),
  {
    jour: 4,
    ouvertureMatin: '08:30',
    fermetureMatin: '12:30',
    horaireFerme: 'N',
    horaireFermeRDV: 'O'
  },
  unJour(5, { fermetureApresMidiRDV: '15:30' })
]

function uneAgenceStMichel(surcharge: Partial<AgenceFTDto> = {}): AgenceFTDto {
  return {
    code: 'OCC0075',
    codeSafir: '31037',
    libelle: 'TOULOUSE ST-MICHEL',
    libelleEtendu: 'Agence France Travail TOULOUSE ST-MICHEL',
    type: 'APE',
    contact: { telephonePublic: '39-49' },
    adressePrincipale: {
      ligne4: "2 AVENUE DE L'URSS",
      ligne5: '',
      ligne6: '31400 TOULOUSE',
      communeImplantation: '31555',
      bureauDistributeur: '31400'
    },
    horaires: horairesStMichel,
    ...surcharge
  }
}

describe('structures-accompagnement.mappers', () => {
  describe('resumerHorairesFT', () => {
    it('regroupe les jours consécutifs aux mêmes créneaux', () => {
      expect(resumerHorairesFT(horairesStMichel)).to.deep.equal([
        'Lun–mer · 8h30 – 12h30, 12h30 – 16h30 sur RDV',
        'Jeu · 8h30 – 12h30',
        'Ven · 8h30 – 12h30, 12h30 – 15h30 sur RDV'
      ])
    })

    it('affiche les heures pleines sans minutes', () => {
      const horairesParis11: HoraireAgenceFTDto[] = [1, 2, 3, 4]
        .map(jour =>
          unJour(jour, {
            ouvertureMatin: '09:00',
            fermetureMatin: '13:15',
            ouvertureApresMidiRDV: '13:15',
            fermetureApresMidiRDV: '17:00'
          })
        )
        .concat({
          jour: 5,
          ouvertureMatin: '09:00',
          fermetureMatin: '12:00',
          horaireFerme: 'N',
          horaireFermeRDV: 'O'
        })

      expect(resumerHorairesFT(horairesParis11)).to.deep.equal([
        'Lun–jeu · 9h – 13h15, 13h15 – 17h sur RDV',
        'Ven · 9h – 12h'
      ])
    })

    it('ignore les jours inconnus', () => {
      expect(
        resumerHorairesFT([
          unJour(1),
          unJour(2),
          unJour(7),
          unJour(8),
          unJour(0)
        ])
      ).to.deep.equal([
        'Lun–mar · 8h30 – 12h30, 12h30 – 16h30 sur RDV',
        'Dim · 8h30 – 12h30, 12h30 – 16h30 sur RDV'
      ])
    })

    it('renvoie une seule ligne pour une semaine régulière', () => {
      expect(
        resumerHorairesFT([1, 2, 3, 4, 5].map(j => unJour(j)))
      ).to.deep.equal(['Lun–ven · 8h30 – 12h30, 12h30 – 16h30 sur RDV'])
    })

    it('garde la pause de midi', () => {
      const horaires: HoraireAgenceFTDto[] = [
        {
          jour: 1,
          ouvertureMatin: '08:30',
          fermetureMatin: '12:00',
          horaireFerme: 'N',
          ouvertureApresMidi: '14:00',
          fermetureApresMidi: '17:00',
          horaireFermeRDV: 'O'
        }
      ]

      expect(resumerHorairesFT(horaires)).to.deep.equal([
        'Lun · 8h30 – 12h, 14h – 17h'
      ])
    })

    it('compare les heures par leur valeur, avec ou sans zéro initial', () => {
      const horaires: HoraireAgenceFTDto[] = [1, 2].map(jour => ({
        jour,
        ouvertureMatin: jour === 1 ? '8:30' : '08:30',
        fermetureMatin: '9:30',
        horaireFerme: 'N',
        ouvertureApresMidiRDV: '10:00',
        fermetureApresMidiRDV: '12:00',
        horaireFermeRDV: 'N'
      }))

      expect(resumerHorairesFT(horaires)).to.deep.equal([
        'Lun–mar · 8h30 – 9h30, 10h – 12h sur RDV'
      ])
    })

    it('ne regroupe pas des jours non consécutifs', () => {
      const horaires = [1, 3].map(jour =>
        unJour(jour, {
          ouvertureMatin: '09:00',
          fermetureApresMidiRDV: '17:00'
        })
      )

      expect(resumerHorairesFT(horaires)).to.deep.equal([
        'Lun · 9h – 12h30, 12h30 – 17h sur RDV',
        'Mer · 9h – 12h30, 12h30 – 17h sur RDV'
      ])
    })

    it("n'affiche pas l'accueil quand il est fermé", () => {
      const horaires: HoraireAgenceFTDto[] = [
        {
          jour: 1,
          ouvertureMatin: '08:30',
          fermetureMatin: '12:30',
          horaireFerme: 'O',
          ouvertureApresMidiRDV: '13:00',
          fermetureApresMidiRDV: '16:00',
          horaireFermeRDV: 'N'
        }
      ]

      expect(resumerHorairesFT(horaires)).to.deep.equal([
        'Lun · 13h – 16h sur RDV'
      ])
    })

    it('trie les jours avant de les regrouper', () => {
      expect(resumerHorairesFT([3, 1, 2].map(j => unJour(j)))).to.deep.equal([
        'Lun–mer · 8h30 – 12h30, 12h30 – 16h30 sur RDV'
      ])
    })

    it("renvoie une liste vide quand l'agence n'a pas d'horaires", () => {
      expect(resumerHorairesFT(undefined)).to.deep.equal([])
    })

    it('renvoie une liste vide quand tous les jours sont fermés', () => {
      const horaires: HoraireAgenceFTDto[] = [
        { jour: 1, horaireFerme: 'O', horaireFermeRDV: 'O' }
      ]

      expect(resumerHorairesFT(horaires)).to.deep.equal([])
    })
  })

  describe('toStructureAccompagnementFT', () => {
    it("construit la structure d'une agence France Travail", () => {
      expect(toStructureAccompagnementFT(uneAgenceStMichel())).to.deep.equal({
        nom: 'Agence France Travail TOULOUSE ST-MICHEL',
        adresse: {
          ligne: "2 AVENUE DE L'URSS",
          codePostal: '31400',
          ville: 'TOULOUSE'
        },
        telephone: '39-49',
        horaires: [
          'Lun–mer · 8h30 – 12h30, 12h30 – 16h30 sur RDV',
          'Jeu · 8h30 – 12h30',
          'Ven · 8h30 – 12h30, 12h30 – 15h30 sur RDV'
        ]
      })
    })

    it("ajoute le complément d'adresse à la ligne", () => {
      const agence = uneAgenceStMichel({
        adressePrincipale: {
          ligne4: "2 AVENUE DE L'URSS",
          ligne5: 'BAT B',
          ligne6: '31400 TOULOUSE',
          communeImplantation: '31555',
          bureauDistributeur: '31400'
        }
      })

      expect(toStructureAccompagnementFT(agence)?.adresse.ligne).to.equal(
        "2 AVENUE DE L'URSS BAT B"
      )
    })

    it('renvoie null pour les champs absents ou vides', () => {
      const agence = uneAgenceStMichel({
        contact: undefined,
        adressePrincipale: { communeImplantation: '31555', ligne6: '' }
      })

      expect(toStructureAccompagnementFT(agence)).to.deep.include({
        adresse: { ligne: null, codePostal: null, ville: null },
        telephone: null
      })
    })

    it('prend la ville quand la ligne 6 ne commence pas par un code postal', () => {
      const agence = uneAgenceStMichel({
        adressePrincipale: { communeImplantation: '75111', ligne6: 'PARIS' }
      })

      expect(toStructureAccompagnementFT(agence)?.adresse.ville).to.equal(
        'PARIS'
      )
    })

    it("ne renvoie rien quand l'agence n'a pas de nom", () => {
      expect(
        toStructureAccompagnementFT(uneAgenceStMichel({ libelleEtendu: '' }))
      ).to.be.undefined()
    })
  })

  describe('toStructureAccompagnementMilo', () => {
    const missionLocaleToulouse: MissionLocaleApprentissageDto = {
      nom: 'DE TOULOUSE',
      localisation: {
        adresse: '32 Rue de la Caravelle Le Mercurial',
        cp: '31500',
        ville: 'TOULOUSE'
      },
      contact: { telephone: '05 62 73 38 80' }
    }

    it("construit la structure d'une mission locale", () => {
      expect(
        toStructureAccompagnementMilo(missionLocaleToulouse)
      ).to.deep.equal({
        nom: 'Mission Locale DE TOULOUSE',
        adresse: {
          ligne: '32 Rue de la Caravelle Le Mercurial',
          codePostal: '31500',
          ville: 'TOULOUSE'
        },
        telephone: '05 62 73 38 80',
        horaires: null
      })
    })

    it('renvoie null pour les champs absents', () => {
      expect(
        toStructureAccompagnementMilo({ nom: 'DE TOULOUSE' })
      ).to.deep.equal({
        nom: 'Mission Locale DE TOULOUSE',
        adresse: { ligne: null, codePostal: null, ville: null },
        telephone: null,
        horaires: null
      })
    })

    it("ne renvoie rien quand la mission locale n'a pas de nom", () => {
      expect(toStructureAccompagnementMilo({})).to.be.undefined()
    })
  })
})
