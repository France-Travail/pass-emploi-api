import { DetailConseillerQueryModel } from 'src/application/queries/query-models/conseillers.query-model'
import { Profil } from '../../../src/domain/profil'

export function detailConseillerQueryModel(
  args: Partial<DetailConseillerQueryModel> = {}
): DetailConseillerQueryModel {
  const defaults: DetailConseillerQueryModel = {
    id: '1',
    firstName: 'Nils',
    lastName: 'Tavernier',
    profil: { structure: Profil.Structure.MILO, dispositif: null },
    notificationsSonores: false,
    aDesBeneficiairesARecuperer: false
  }

  return { ...defaults, ...args }
}
