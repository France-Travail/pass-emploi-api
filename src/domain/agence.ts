import { Inject } from '@nestjs/common'
import { Core } from './core'
import {
  AnimationCollective,
  AnimationCollectiveRepositoryToken
} from './rendez-vous/animation-collective'
import { Conseiller, ConseillerRepositoryToken } from './milo/conseiller'
import { failure, Result, success } from '../building-blocks/types/result'
import {
  MauvaiseCommandeError,
  NonTrouveError
} from '../building-blocks/types/domain-error'
import { JeuneDuRendezVous } from './rendez-vous/rendez-vous'
import { ApiProperty } from '@nestjs/swagger'

export const AgenceRepositoryToken = 'Agence.Repository'

export interface Agence {
  id?: string
  nom?: string
}

export namespace Agence {
  import Structure = Core.Structure

  export interface Repository {
    get(id: string, structure: Structure): Promise<Agence | undefined>
    findAllConseillersByAgence(idAgence: string): Promise<Conseiller[]>
  }

  export class Service {
    constructor(
      @Inject(ConseillerRepositoryToken)
      private readonly conseillerRepository: Conseiller.Repository,
      @Inject(AgenceRepositoryToken)
      private readonly agencesRepository: Agence.Repository,
      @Inject(AnimationCollectiveRepositoryToken)
      private readonly animationCollectiveRepository: AnimationCollective.Repository,
      private readonly animationCollectiveService: AnimationCollective.Service
    ) {}

    async changerAgenceConseiller(
      idConseiller: string,
      idNouvelleAgence: string
    ): Promise<Result<ChangementAgenceQueryModel>> {
      const conseiller = await this.conseillerRepository.get(idConseiller)
      if (!conseiller) {
        return failure(new NonTrouveError('Conseiller', idConseiller))
      }

      if (!conseiller.agence?.id) {
        return failure(
          new MauvaiseCommandeError("Le conseiller n'a pas d'agence")
        )
      }

      const agence = await this.agencesRepository.get(
        idNouvelleAgence,
        conseiller.structure
      )
      if (!agence?.id) {
        return failure(new NonTrouveError('Agence', idNouvelleAgence))
      }

      if (conseiller.agence.id === agence.id) {
        return failure(
          new MauvaiseCommandeError('Le conseiller est déjà dans cette agence')
        )
      }

      const animationsCollectives =
        await this.animationCollectiveRepository.getAllByEtablissementAvecSupprimes(
          conseiller.agence.id
        )

      const infosTransfertAnimationsCollectives = await Promise.all(
        animationsCollectives.map(animationCollective =>
          this.updateAnimationCollective(
            animationCollective,
            conseiller,
            agence
          )
        )
      )

      const updatedConseiller = Conseiller.modifierAgence(conseiller, agence)
      await this.conseillerRepository.save(updatedConseiller)

      return success({
        emailConseiller: conseiller.email,
        idNouvelleAgence: idNouvelleAgence,
        idAncienneAgence: conseiller.agence.id,
        infosTransfertAnimationsCollectives
      })
    }

    private async updateAnimationCollective(
      animationCollective: AnimationCollective,
      conseiller: Conseiller,
      agence: Agence
    ): Promise<InfoTransfertACQueryModel> {
      if (animationCollective.createur.id === conseiller.id) {
        const jeunesDesinscrits = await this.changerAgenceAnimationCollective(
          animationCollective,
          conseiller,
          agence
        )
        return {
          idAnimationCollective: animationCollective.id,
          titreAnimationCollective: animationCollective.titre,
          agenceTransferee: AgenceTransferee.OUI,
          jeunesDesinscrits: jeunesDesinscrits.map(jeune => ({
            id: jeune.id,
            nom: jeune.lastName,
            prenom: jeune.firstName
          }))
        }
      } else {
        const jeunesDesinscrits =
          await this.desinscrireJeunesDuConseillerDeLAnimationCollective(
            animationCollective,
            conseiller
          )
        return {
          idAnimationCollective: animationCollective.id,
          titreAnimationCollective: animationCollective.titre,
          agenceTransferee: AgenceTransferee.NON,
          jeunesDesinscrits: jeunesDesinscrits.map(jeune => ({
            id: jeune.id,
            nom: jeune.lastName,
            prenom: jeune.firstName
          }))
        }
      }
    }

    private async changerAgenceAnimationCollective(
      animationCollective: AnimationCollective,
      conseiller: Conseiller,
      agence: Agence
    ): Promise<JeuneDuRendezVous[]> {
      const autresJeunes = getAutresJeunesDeLAgence(
        animationCollective,
        conseiller
      )
      if (autresJeunes.length !== 0) {
        await this.animationCollectiveService.desinscrireJeunesDeLAnimationCollective(
          animationCollective,
          autresJeunes.map(jeune => jeune.id)
        )
      }
      await this.animationCollectiveService.updateEtablissement(
        animationCollective,
        agence.id!
      )
      return autresJeunes
    }

    private async desinscrireJeunesDuConseillerDeLAnimationCollective(
      animationCollective: AnimationCollective,
      conseiller: Conseiller
    ): Promise<JeuneDuRendezVous[]> {
      const jeunesDuConseillerInscrits = getJeunesDuConseiller(
        animationCollective,
        conseiller
      )
      if (jeunesDuConseillerInscrits.length !== 0) {
        await this.animationCollectiveService.desinscrireJeunesDeLAnimationCollective(
          animationCollective,
          jeunesDuConseillerInscrits.map(jeune => jeune.id)
        )
      }
      return jeunesDuConseillerInscrits
    }
  }
}

function getAutresJeunesDeLAgence(
  animationCollective: AnimationCollective,
  conseiller: Conseiller
): JeuneDuRendezVous[] {
  return animationCollective.jeunes.filter(
    jeune => jeune.conseiller?.id !== conseiller.id
  )
}

function getJeunesDuConseiller(
  animationCollective: AnimationCollective,
  conseiller: Conseiller
): JeuneDuRendezVous[] {
  return animationCollective.jeunes.filter(
    jeune => jeune.conseiller?.id === conseiller.id
  )
}

enum AgenceTransferee {
  OUI = 'OUI (le conseiller était créateur)',
  NON = "NON (le conseiller n'était pas le créateur)"
}

class JeuneDesinscrit {
  @ApiProperty()
  id: string

  @ApiProperty()
  nom: string

  @ApiProperty()
  prenom: string
}

class InfoTransfertACQueryModel {
  @ApiProperty()
  idAnimationCollective: string

  @ApiProperty()
  titreAnimationCollective: string

  @ApiProperty()
  agenceTransferee: AgenceTransferee

  @ApiProperty({ isArray: true, type: JeuneDesinscrit })
  jeunesDesinscrits: JeuneDesinscrit[]
}
export class ChangementAgenceQueryModel {
  @ApiProperty({ required: false })
  emailConseiller?: string

  @ApiProperty()
  idAncienneAgence: string

  @ApiProperty()
  idNouvelleAgence: string

  @ApiProperty({ isArray: true, type: InfoTransfertACQueryModel })
  infosTransfertAnimationsCollectives: InfoTransfertACQueryModel[]
}
