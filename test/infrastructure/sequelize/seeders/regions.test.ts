import * as agencesPE from 'src/infrastructure/sequelize/seeders/data/agences_pe.json'
import * as regions from 'src/infrastructure/sequelize/seeders/data/regions.json'
import { expect } from 'test/utils'

describe('referentiel des regions', () => {
  it('couvre 20 regions aux codes uniques', () => {
    // When
    const codes = regions.map(region => region.code)

    // Then
    expect(regions.length).to.equal(20)
    expect(new Set(codes).size).to.equal(20)
  })

  it('reprend exactement les libelles deja stockes sur les agences FT', () => {
    // Given
    const libellesFT = new Set(agencesPE.map(agence => agence.nom_region))

    // When
    const libellesReferentiel = new Set(regions.map(region => region.libelle))
    const manquants = [...libellesFT].filter(
      libelle => !libellesReferentiel.has(libelle)
    )
    const enTrop = [...libellesReferentiel].filter(
      libelle => !libellesFT.has(libelle)
    )

    // Then
    expect(manquants).to.deep.equal([])
    expect(enTrop).to.deep.equal(['Saint-Martin'])
  })
})
