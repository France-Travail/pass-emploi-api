import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ArchiveJeune } from './archive-jeune'
import { Jeune } from './jeune/jeune'
import { Conseiller } from './milo/conseiller'
import { RendezVous } from './rendez-vous/rendez-vous'
import { estDispositifNonAccompagne, Profil, ProfilAutorise } from './profil'

export const MailServiceToken = 'MailServiceToken'
export const MailRepositoryToken = 'MailRepositoryToken'

export interface MailDataDto {
  to: RecipientDto[]
  templateId: number
  params?: object
  attachment?: AttachmentDto[]
}

interface RecipientDto {
  email: string
  name: string
}

interface AttachmentDto {
  name: string
  content: string
}

export namespace Mail {
  export interface Contact {
    email: string
    nom: string
    prenom: string
  }

  export interface Service {
    envoyer(data: MailDataDto): Promise<void>

    envoyerMailConversationsNonLues(
      conseiller: Conseiller,
      nombreDeConversationNonLues: number
    ): Promise<void>

    envoyerMailRendezVous(
      conseiller: Conseiller,
      rendezVous: RendezVous,
      operation: RendezVous.Operation,
      icsSequence?: number
    ): Promise<void>

    envoyerEmailJeuneArchive(
      jeune: Jeune,
      motif:
        ArchiveJeune.MotifSuppression | ArchiveJeune.MotifSuppressionSupport,
      commentaire?: string
    ): Promise<void>

    mettreAJourMailingList(
      contacts: Contact[],
      mailingListId: number
    ): Promise<void>
  }

  export interface Repository {
    findAllContactsConseillerParProfil(
      profil: ProfilAutorise
    ): Promise<Mail.Contact[]>

    countContactsConseillerSansEmail(): Promise<number>
  }

  @Injectable()
  export class Factory {
    private templates: {
      conversationsNonLues: string
      nouveauRendezvous: string
      rendezVousSupprime: string
      suppressionJeuneMilo: string
      suppressionJeunePE: string
      suppressionBeneficiairePassEmploi: string
    }

    constructor(private configService: ConfigService) {
      this.templates = this.configService.get('brevo').templates
    }

    creerMailSuppressionJeune(jeune: Jeune): MailDataDto {
      if (!jeune.conseiller) {
        throw new Error(`Le jeune ${jeune.id} n'a pas de conseiller`)
      }

      const templateId = ((): number => {
        switch (jeune.structure) {
          case Profil.Structure.MILO:
            return Number.parseInt(this.templates.suppressionJeuneMilo)
          case Profil.Structure.CONSEIL_DEPARTEMENTAL:
            return Number.parseInt(
              this.templates.suppressionBeneficiairePassEmploi
            )
          case Profil.Structure.FRANCE_TRAVAIL:
            if (estDispositifNonAccompagne(jeune.dispositif)) break
            return jeune.dispositif === Profil.Dispositif.CEJ
              ? Number.parseInt(this.templates.suppressionJeunePE)
              : Number.parseInt(
                  this.templates.suppressionBeneficiairePassEmploi
                )
          case Profil.Structure.INVITE:
            break
        }
        throw new Error(
          `Le jeune ${jeune.id} n'est pas un bénéficiaire accompagné : pas de mail de suppression`
        )
      })()

      return {
        to: [
          {
            email: jeune.conseiller.email!,
            name: `${jeune.conseiller.firstName} ${jeune.conseiller.lastName}`
          }
        ],
        templateId,
        params: {
          prenom: jeune.firstName,
          nom: jeune.lastName
        }
      }
    }
  }
}
