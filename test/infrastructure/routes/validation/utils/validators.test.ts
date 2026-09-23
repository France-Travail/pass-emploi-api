import { IsNumeroTelephoneFrancais } from '../../../../../src/infrastructure/routes/validation/utils/validators'
import { validate } from 'class-validator'
import { expect } from '../../../../utils'

class PayloadAvecTelephone {
  @IsNumeroTelephoneFrancais()
  numeroTelephone: unknown

  constructor(numeroTelephone: unknown) {
    this.numeroTelephone = numeroTelephone
  }
}

describe('IsNumeroTelephoneFrancais', () => {
  const numerosValides: Array<[string, string]> = [
    ['mobile métropole', '0606060606'],
    ['fixe métropole', '0140000000'],
    ['mobile métropole international', '+33606060606'],
    ['mobile La Réunion', '0692036376'],
    ['mobile La Réunion international', '+262692036376'],
    ['mobile Guadeloupe', '0690123456'],
    ['mobile Martinique', '0696123456'],
    ['mobile Guyane', '0694123456'],
    ['mobile Mayotte', '0639691234']
  ]
  for (const [libelle, numero] of numerosValides) {
    it(`accepte un ${libelle} (${numero})`, async () => {
      // When
      const erreurs = await validate(new PayloadAvecTelephone(numero))

      // Then
      expect(erreurs).to.be.empty()
    })
  }

  const numerosInvalides: Array<[string, unknown]> = [
    ['numéro trop court', '0692'],
    ['numéro non français', '+14155552671'],
    ['texte', 'pas un numéro'],
    ['valeur non string', 692036376]
  ]
  for (const [libelle, numero] of numerosInvalides) {
    it(`refuse un ${libelle}`, async () => {
      // When
      const erreurs = await validate(new PayloadAvecTelephone(numero))

      // Then
      expect(erreurs).to.have.length(1)
      expect(erreurs[0].constraints).to.deep.equal({
        isNumeroTelephoneFrancais:
          'numeroTelephone must be a valid phone number (France métropolitaine ou outre-mer)'
      })
    })
  }
})
