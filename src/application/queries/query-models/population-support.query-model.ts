import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Communication } from '../../../domain/communication'
import { Deploiement } from '../../../domain/deploiement'
import { Notification } from '../../../domain/notification/notification'
import { Profil } from '../../../domain/profil'

export class ProfilPopulationQueryModel {
  @ApiProperty({ enum: Profil.Structure })
  structure: Profil.Structure

  @ApiPropertyOptional({ enum: Profil.Dispositif })
  dispositif?: Profil.Dispositif
}

export class DeploiementQueryModel {
  @ApiProperty()
  id: number

  @ApiProperty({ enum: Deploiement.Nature })
  nature: Deploiement.Nature

  @ApiPropertyOptional()
  idFonctionnalite?: string

  @ApiProperty({ description: 'Date d’activation, en UTC' })
  dateActivation: string
}

export class EnvoiCommunicationQueryModel {
  @ApiPropertyOptional({ description: 'EN_COURS seulement' })
  aEnvoyer?: number

  @ApiPropertyOptional({ description: 'EN_COURS seulement' })
  enCours?: number

  @ApiProperty()
  envoyees: number

  @ApiProperty()
  erreurs: number

  @ApiProperty()
  tokensInvalides: number
}

export class CommunicationSupportQueryModel {
  @ApiProperty()
  id: number

  @ApiProperty({ enum: Communication.Destinataire })
  destinataire: Communication.Destinataire

  @ApiProperty({ enum: Communication.Type })
  type: Communication.Type

  @ApiProperty({ description: 'Début de visibilité, en UTC' })
  dateDebut: string

  @ApiPropertyOptional({
    description:
      'Fin de visibilité (exclue), en UTC. Absente = IN_APP visible indéfiniment, ou communication NOTIFICATION (toujours sans dateFin).'
  })
  dateFin?: string

  @ApiProperty()
  titre: string

  @ApiProperty()
  contenu: string

  @ApiPropertyOptional()
  ctaLabel?: string

  @ApiPropertyOptional()
  ctaUrlAndroid?: string

  @ApiPropertyOptional()
  ctaUrlIos?: string

  @ApiPropertyOptional({ enum: Notification.TypeNotifManuelle })
  typeNotification?: Notification.Type

  @ApiPropertyOptional()
  push?: boolean

  @ApiPropertyOptional({
    enum: Communication.StatutEnvoi,
    description:
      'NOTIFICATION seulement. A_ENVOYER → EN_COURS → ENVOYEE | ANNULEE | EN_ERREUR.'
  })
  statutEnvoi?: Communication.StatutEnvoi

  @ApiPropertyOptional({
    description: 'Fin de l’envoi (ENVOYEE, ANNULEE ou EN_ERREUR), en UTC'
  })
  envoiTermineLe?: string

  @ApiPropertyOptional({
    description:
      'A_ENVOYER seulement : nombre de jeunes qui recevront la notification si elle partait maintenant (avec token si push). À relire avant dateDebut pour vérifier le ciblage.'
  })
  nbDestinataires?: number

  @ApiPropertyOptional({
    type: EnvoiCommunicationQueryModel,
    description:
      'EN_COURS : compteurs vivants. Terminée : totaux figés (le détail par jeune est purgé après 30 jours).'
  })
  envoi?: EnvoiCommunicationQueryModel
}

export class PopulationSupportQueryModel {
  @ApiProperty()
  id: string

  @ApiPropertyOptional()
  description?: string

  @ApiProperty({ type: String, isArray: true })
  conseillers: string[]

  @ApiProperty({ type: ProfilPopulationQueryModel, isArray: true })
  profils: ProfilPopulationQueryModel[]

  @ApiProperty({ type: DeploiementQueryModel, isArray: true })
  deploiements: DeploiementQueryModel[]

  @ApiProperty({ type: CommunicationSupportQueryModel, isArray: true })
  communications: CommunicationSupportQueryModel[]
}
