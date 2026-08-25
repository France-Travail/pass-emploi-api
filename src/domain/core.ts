export namespace Core {
  // LEGACY : format d'échange avec les fronts (claim `userStructure`, entrées et sorties d'API). Cible : Profil (structure × dispositif)
  // Profil se dérive d'ici via structureLegacyVersProfil() et se replie via profilVersStructureLegacy()
  export enum Structure {
    MILO = 'MILO',
    POLE_EMPLOI = 'POLE_EMPLOI',
    POLE_EMPLOI_BRSA = 'POLE_EMPLOI_BRSA',
    POLE_EMPLOI_AIJ = 'POLE_EMPLOI_AIJ',
    CONSEIL_DEPT = 'CONSEIL_DEPT',
    AVENIR_PRO = 'AVENIR_PRO',
    FT_ACCOMPAGNEMENT_INTENSIF = 'FT_ACCOMPAGNEMENT_INTENSIF',
    FT_ACCOMPAGNEMENT_GLOBAL = 'FT_ACCOMPAGNEMENT_GLOBAL',
    FT_EQUIP_EMPLOI_RECRUT = 'FT_EQUIP_EMPLOI_RECRUT',
    FT_DEMANDEUR_D_EMPLOI = 'FT_DEMANDEUR_D_EMPLOI',
    INVITE = 'INVITE',
    FT_ESPACE_CANDIDAT = 'FT_ESPACE_CANDIDAT'
  }
}
