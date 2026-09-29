export interface GristRecordDto<T> {
  id: number
  fields: T
}

export interface GristRecordsDto<T> {
  records: Array<GristRecordDto<T>>
}

export interface GristServiceFieldsDto {
  Nom: string
  Description: string
}

export interface GristSolutionFieldsDto {
  Id_technique: string
  Envie: string
  Blocage: string
  Sous_categorie: string
  Besoin_exprime_par_le_jeune: string
  Type: string
  Action_affichee_au_jeune: string
  URL: string
  Ecran_de_l_app: string
  Service: string
  Situations: string
  Authentification: string
  Age_minimum: number | null
  Age_maximum: number | null
  Territoire: string
  Domaine: string
  Conversion_FT_Thematique: string
  Conversion_FT_Demarche: string
  Conversion_FT_Code_pourquoi: string
  Conversion_FT_Code_quoi: string
  Conversion_ML_Categorie: string
  Conversion_ML_Code_categorie: string
  Conversion_ML_Action: string
  Conversion_ML_Origine_de_l_action: string
}
