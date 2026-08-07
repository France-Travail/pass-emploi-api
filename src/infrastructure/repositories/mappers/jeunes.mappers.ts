import { DateTime } from 'luxon'
import { TIMEZONE_PAR_DEFAUT } from '../../../domain/jeune/configuration-application'
import { Jeune, JeuneNonAccompagne } from '../../../domain/jeune/jeune'
import { JeuneSqlModel } from '../../sequelize/models/jeune.sql-model'

function fromSqlToJeuneCommun(
  jeuneSqlModel: JeuneSqlModel
): Omit<Jeune, 'dispositif'> {
  const jeune: Omit<Jeune, 'dispositif'> = {
    id: jeuneSqlModel.id,
    firstName: jeuneSqlModel.prenom,
    lastName: jeuneSqlModel.nom,
    creationDate: DateTime.fromJSDate(jeuneSqlModel.dateCreation),
    datePremiereConnexion: jeuneSqlModel.datePremiereConnexion
      ? DateTime.fromJSDate(jeuneSqlModel.datePremiereConnexion)
      : undefined,
    isActivated: Boolean(jeuneSqlModel.datePremiereConnexion),
    structure: jeuneSqlModel.structure,
    email: jeuneSqlModel.email ?? undefined,
    idPartenaire: jeuneSqlModel.idPartenaire ?? undefined,
    configuration: toConfigurationApplication(jeuneSqlModel),
    preferences: fromSqlToPreferencesJeune(jeuneSqlModel),
    peutVoirLeComptageDesHeures:
      jeuneSqlModel.peutVoirLeComptageDesHeures ?? undefined,
    dateSignatureCGU: jeuneSqlModel.dateSignatureCGU
      ? DateTime.fromJSDate(jeuneSqlModel.dateSignatureCGU)
      : undefined
  }
  if (jeuneSqlModel.dateDerniereConnexion) {
    jeune.dateDerniereConnexion = DateTime.fromJSDate(
      jeuneSqlModel.dateDerniereConnexion
    )
  }
  if (jeuneSqlModel.conseiller) {
    jeune.conseiller = {
      id: jeuneSqlModel.conseiller.id,
      firstName: jeuneSqlModel.conseiller.prenom,
      lastName: jeuneSqlModel.conseiller.nom,
      email: jeuneSqlModel.conseiller.email || undefined,
      idAgence: jeuneSqlModel.conseiller.idAgence || undefined
    }
  }
  if (jeuneSqlModel.idConseillerInitial) {
    jeune.conseillerInitial = {
      id: jeuneSqlModel.idConseillerInitial
    }
  }
  return jeune
}

// N'utiliser que sur un chemin ne servant que des jeunes accompagnés
// (`dispositif` garanti) — sinon `fromSqlToJeuneOuNonAccompagne`.
export function fromSqlToJeune(jeuneSqlModel: JeuneSqlModel): Jeune {
  return {
    ...fromSqlToJeuneCommun(jeuneSqlModel),
    dispositif: jeuneSqlModel.dispositif!
  }
}

// Le discriminant est `dispositif`, pas la présence d'un conseiller : un
// jeune historique peut avoir perdu son conseiller sans perdre son
// dispositif (cf. fixture `unJeuneSansConseiller`), alors qu'un
// JeuneNonAccompagne n'a jamais eu ni l'un ni l'autre.
export function fromSqlToJeuneOuNonAccompagne(
  jeuneSqlModel: JeuneSqlModel
): Jeune | JeuneNonAccompagne {
  if (!jeuneSqlModel.dispositif) {
    // Sans dispositif, ce chemin ne sert que le nouveau public FT non
    // accompagné, qui n'a jamais de conseiller non plus — le cast traduit
    // cet invariant, que le typage structurel de `Omit` ne peut pas garantir.
    return fromSqlToJeuneCommun(jeuneSqlModel) as JeuneNonAccompagne
  }
  return fromSqlToJeune(jeuneSqlModel)
}

export function fromSqlToPreferencesJeune(
  jeuneSqlModel: JeuneSqlModel
): Jeune.Preferences {
  return {
    partageFavoris: jeuneSqlModel.partageFavoris,
    alertesOffres: jeuneSqlModel.notificationsAlertesOffres,
    messages: jeuneSqlModel.notificationsMessages,
    creationActionConseiller:
      jeuneSqlModel.notificationsCreationActionConseiller,
    rendezVousSessions: jeuneSqlModel.notificationsRendezVousSessions,
    rappelActions: jeuneSqlModel.notificationsRappelActions,
    actualitesMilo: jeuneSqlModel.notificationsActualitesMilo
  }
}

export function toConfigurationApplication(
  jeuneSqlModel: JeuneSqlModel
): Jeune.ConfigurationApplication {
  return {
    idJeune: jeuneSqlModel.id,
    appVersion: jeuneSqlModel.appVersion ?? undefined,
    installationId: jeuneSqlModel.installationId ?? undefined,
    instanceId: jeuneSqlModel.instanceId ?? undefined,
    dateDerniereActualisationToken:
      jeuneSqlModel.dateDerniereActualisationToken ?? undefined,
    pushNotificationToken: jeuneSqlModel.pushNotificationToken ?? undefined,
    fuseauHoraire: jeuneSqlModel.timezone ?? TIMEZONE_PAR_DEFAUT
  }
}
