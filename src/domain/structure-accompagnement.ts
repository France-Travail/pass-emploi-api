import { Result } from '../building-blocks/types/result'

export const StructureAccompagnementRepositoryToken =
  'StructureAccompagnement.Repository'

export interface StructureAccompagnement {
  nom: string
  adresse: {
    ligne: string | null
    codePostal: string | null
    ville: string | null
  }
  telephone: string | null
  horaires: string[] | null
}

export namespace StructureAccompagnement {
  export interface Repository {
    findAllAgencesFranceTravail(
      codeInsee: string,
      codePostal: string
    ): Promise<Result<StructureAccompagnement[]>>

    findMissionLocale(
      codeInsee: string,
      codePostal: string
    ): Promise<Result<StructureAccompagnement | undefined>>
  }
}
