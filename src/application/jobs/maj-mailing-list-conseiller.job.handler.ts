import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { Mail, MailRepositoryToken, MailServiceToken } from '../../domain/mail'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import {
  Profil,
  ProfilAutorise,
  TOUT_CONSEIL_DEPARTEMENTAL,
  TOUT_MILO
} from '../../domain/profil'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'

function dispositifFT(dispositif: Profil.Dispositif): ProfilAutorise {
  return {
    structure: Profil.Structure.FRANCE_TRAVAIL,
    dispositifs: [dispositif]
  }
}

@Injectable()
@ProcessJobType(Planificateur.JobType.UPDATE_CONTACTS_CONSEILLER_MAILING_LISTS)
export class MajMailingListConseillerJobHandler extends JobHandler {
  constructor(
    @Inject(MailServiceToken)
    private readonly mailService: Mail.Service,
    @Inject(MailRepositoryToken)
    private readonly mailRepository: Mail.Repository,
    private readonly configuration: ConfigService,
    private readonly dateService: DateService,
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service
  ) {
    super(
      Planificateur.JobType.UPDATE_CONTACTS_CONSEILLER_MAILING_LISTS,
      suiviJobService
    )
  }

  async handle(): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const stats: Record<string, number> = {}

    const suivi: SuiviJob = {
      jobType: this.jobType,
      nbErreurs: 0,
      succes: false,
      dateExecution: maintenant,
      tempsExecution: 0,
      resultat: {}
    }

    const idsListes = this.configuration.get('brevo').mailingLists
    const mailingLists: Array<{
      nom: string
      profil: ProfilAutorise
      id: string
    }> = [
      { nom: 'milo', profil: TOUT_MILO, id: idsListes.milo },
      {
        nom: 'poleEmploi',
        profil: dispositifFT(Profil.Dispositif.CEJ),
        id: idsListes.poleEmploi
      },
      {
        nom: 'brsa',
        profil: dispositifFT(Profil.Dispositif.BRSA),
        id: idsListes.brsa
      },
      {
        nom: 'aij',
        profil: dispositifFT(Profil.Dispositif.AIJ),
        id: idsListes.aij
      },
      { nom: 'cd', profil: TOUT_CONSEIL_DEPARTEMENTAL, id: idsListes.cd },
      {
        nom: 'avenirPro',
        profil: dispositifFT(Profil.Dispositif.AVENIR_PRO),
        id: idsListes.avenirPro
      },
      {
        nom: 'accompagnementIntensif',
        profil: dispositifFT(Profil.Dispositif.ACCOMPAGNEMENT_INTENSIF),
        id: idsListes.accompagnementIntensif
      },
      {
        nom: 'accompagnementGlobal',
        profil: dispositifFT(Profil.Dispositif.ACCOMPAGNEMENT_GLOBAL),
        id: idsListes.accompagnementGlobal
      },
      {
        nom: 'equipEmploi',
        profil: dispositifFT(Profil.Dispositif.EQUIP_EMPLOI_RECRUT),
        id: idsListes.equipEmploi
      }
    ]

    for (const mailingList of mailingLists) {
      const contacts =
        await this.mailRepository.findAllContactsConseillerParProfil(
          mailingList.profil
        )
      stats[mailingList.nom] = contacts.length

      await this.mailService.mettreAJourMailingList(
        contacts,
        Number.parseInt(mailingList.id)
      )
    }

    stats.conseillersSansEmail =
      await this.mailRepository.countContactsConseillerSansEmail()

    return {
      ...suivi,
      succes: true,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat: stats
    }
  }
}
