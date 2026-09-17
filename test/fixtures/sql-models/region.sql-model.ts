import { RegionDto } from '../../../src/infrastructure/sequelize/models/region.sql-model'
import { AsSql } from '../../../src/infrastructure/sequelize/types'

export function uneRegionDto(
  args: Partial<AsSql<RegionDto>> = {}
): AsSql<RegionDto> {
  const defaults: AsSql<RegionDto> = {
    id: '84',
    code: '84',
    libelle: 'Auvergne-Rhône-Alpes'
  }
  return { ...defaults, ...args }
}
