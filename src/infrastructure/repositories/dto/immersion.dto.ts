export namespace PartenaireImmersion {
  export interface DtoV3 {
    rome: string
    romeLabel: string
    naf: string
    nafLabel: string
    siret: string
    name: string
    locationId: string
    customizedName?: string
    voluntaryToImmersion: boolean
    position: { lat: number; lon: number }
    address: {
      streetNumberAndAddress: string
      postcode: string
      departmentCode: string
      city: string
    }
    contactMode?: ContactMode
    distance_m?: number
    numberOfEmployeeRange?: string
    appellations: Array<{
      appellationLabel: string
      appellationCode: string
    }>
    additionalInformation?: string
    website?: string
    remoteWorkMode?: string
    fitForDisabledWorkers?: string
    isAvailable?: boolean
    isSearchable?: boolean
    establishmentScore?: number
    nextAvailabilityDate?: string
    createdAt?: string
    updatedAt?: string
  }

  export interface SearchResponseV3 {
    data: DtoV3[]
    pagination: {
      totalRecords: number
      currentPage: number
      totalPages: number
      numberPerPage: number
    }
  }

  export enum ContactMode {
    UNKNOWN = 'UNKNOWN',
    EMAIL = 'EMAIL',
    PHONE = 'PHONE',
    IN_PERSON = 'IN_PERSON'
  }
}
