import { normaliserNomAgence } from 'src/application/jobs/agences-ft.helpers'
import { expect } from 'test/utils'

describe('normaliserNomAgence', () => {
  it('retire les prefixes des deux nommages', () => {
    expect(normaliserNomAgence('Agence Pôle emploi PORNIC')).to.equal('PORNIC')
    expect(normaliserNomAgence('Agence France Travail PORNIC')).to.equal(
      'PORNIC'
    )
    expect(normaliserNomAgence('Relai Pôle emploi SAIN BEL')).to.equal(
      'SAIN BEL'
    )
    expect(
      normaliserNomAgence('Agence spécialisée Pôle emploi SCENES ET IMAGES')
    ).to.equal('SCENES ET IMAGES')
  })

  it('retire le RPE residuel du nommage historique', () => {
    expect(normaliserNomAgence('Relai Pôle emploi RPE YSSINGEAUX')).to.equal(
      'YSSINGEAUX'
    )
  })

  it('aligne la casse, les accents et la ponctuation', () => {
    expect(
      normaliserNomAgence('Agence Pôle emploi Paris 20ème Vitruve')
    ).to.equal('PARIS 20EME VITRUVE')
    expect(normaliserNomAgence('Agence France Travail CENTRE-ISERE')).to.equal(
      'CENTRE ISERE'
    )
  })

  it('unifie SAINT et ST', () => {
    expect(
      normaliserNomAgence('Agence Pôle emploi SAINT ETIENNE CLAPIER')
    ).to.equal('ST ETIENNE CLAPIER')
    expect(
      normaliserNomAgence('Agence France Travail ST ETIENNE CLAPIER')
    ).to.equal('ST ETIENNE CLAPIER')
  })
})
