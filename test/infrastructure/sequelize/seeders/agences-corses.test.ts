import * as agencesPE from 'src/infrastructure/sequelize/seeders/data/agences_pe.json'
import * as departementsRegions from 'src/infrastructure/sequelize/seeders/data/departements_regions.json'
import { expect } from 'test/utils'

describe('departement des agences corses', () => {
  it("n'utilise plus le code departement 20", () => {
    // When
    const enVingt = agencesPE.filter(
      agence => String(agence.code_departement) === '20'
    )

    // Then
    expect(enVingt).to.deep.equal([])
  })

  it('repartit les sept agences corses entre 2A et 2B', () => {
    // When
    const corseDuSud = agencesPE.filter(a => a.code_departement === '2A')
    const hauteCorse = agencesPE.filter(a => a.code_departement === '2B')

    // Then
    expect(corseDuSud.map(a => a.id)).to.deep.equal([681, 682, 683])
    expect(hauteCorse.map(a => a.id)).to.deep.equal([684, 685, 686, 687])
  })

  it('rattache chaque agence a un departement du referentiel', () => {
    // Given
    const codes = new Set(departementsRegions.map(d => d.code))

    // When
    const inconnus = [
      ...new Set(
        agencesPE.map(a => String(a.code_departement).padStart(2, '0'))
      )
    ].filter(code => !codes.has(code))

    // Then
    expect(inconnus).to.deep.equal([])
  })
})
