import * as communes from 'src/infrastructure/sequelize/seeders/data/communes.json'
import * as departementsRegions from 'src/infrastructure/sequelize/seeders/data/departements_regions.json'
import * as departements from 'src/infrastructure/sequelize/seeders/data/departements.json'
import * as regions from 'src/infrastructure/sequelize/seeders/data/regions.json'
import { expect } from 'test/utils'

describe('rattachement des departements aux regions', () => {
  it('couvre les 101 departements historiques plus les trois manquants', () => {
    // Given
    const codes = new Set(departementsRegions.map(d => d.code))

    // Then
    expect(departementsRegions.length).to.equal(104)
    for (const departement of departements) {
      expect(codes.has(departement.code)).to.equal(true)
    }
    expect(codes.has('975')).to.equal(true)
    expect(codes.has('977')).to.equal(true)
    expect(codes.has('978')).to.equal(true)
  })

  it('rattache chaque departement a une region existante', () => {
    // Given
    const codesRegion = new Set(regions.map(region => region.code))

    // Then
    for (const departement of departementsRegions) {
      expect(codesRegion.has(departement.code_region)).to.equal(true)
    }
  })

  it('ne laisse hors referentiel que les territoires sans agence', () => {
    // Given
    const codes = new Set(departementsRegions.map(d => d.code))

    // When
    const nonCouverts = [
      ...new Set(communes.map(commune => commune.code_departement))
    ]
      .filter(code => !codes.has(code))
      .sort()

    // Then
    expect(nonCouverts).to.deep.equal(['986', '987', '988', '989', '99'])
  })
})
