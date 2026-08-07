import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { DateTime } from 'luxon'
import { SinonSandbox } from 'sinon'
import { failure, isSuccess, success } from 'src/building-blocks/types/result'
import { ConseillerAuthorizer } from '../../../../src/application/authorizers/conseiller-authorizer'
import {
  CreateJeuneCommand,
  CreerJeunePoleEmploiCommandHandler
} from '../../../../src/application/commands/pole-emploi/creer-jeune-pole-emploi.command.handler'
import { EmailExisteDejaError } from '../../../../src/building-blocks/types/domain-error'
import { Chat } from '../../../../src/domain/chat'
import { Conseiller } from '../../../../src/domain/milo/conseiller'
import { Core } from '../../../../src/domain/core'
import { Jeune } from '../../../../src/domain/jeune/jeune'
import { DateService } from '../../../../src/utils/date-service'
import { IdService } from '../../../../src/utils/id-service'
import { unUtilisateurConseiller } from '../../../fixtures/authentification.fixture'
import { unConseiller } from '../../../fixtures/conseiller.fixture'
import {
  unConseillerDuJeune,
  unJeune,
  unJeuneNonAccompagne
} from '../../../fixtures/jeune.fixture'
import { createSandbox, expect, stubClass } from '../../../utils'
import Structure = Core.Structure
import { TIMEZONE_PAR_DEFAUT } from 'src/domain/jeune/configuration-application'

describe('CreateJeunePoleEmploiCommandHandler', () => {
  let createJeuneCommandHandler: CreerJeunePoleEmploiCommandHandler
  const conseiller = unConseiller()
  const idNouveauJeune = 'ae1785ac-71f3-11ec-a0ba-cf33623dcff5'
  const date = DateTime.fromISO('2020-04-06T12:00:00.000Z')
  const sandbox: SinonSandbox = createSandbox()
  const jeuneRepository: StubbedType<Jeune.Repository> = stubInterface(sandbox)
  const conseillerRepository: StubbedType<Conseiller.Repository> =
    stubInterface(sandbox)
  const chatRepository: StubbedType<Chat.Repository> = stubInterface(sandbox)
  const conseillerAuthorizer = stubClass(ConseillerAuthorizer)
  const dateService = stubClass(DateService)
  const idService = stubClass(IdService)

  before(async () => {
    createJeuneCommandHandler = new CreerJeunePoleEmploiCommandHandler(
      jeuneRepository,
      conseillerRepository,
      chatRepository,
      conseillerAuthorizer,
      new Jeune.Factory(dateService, idService)
    )
  })

  beforeEach(async () => {
    conseillerRepository.get.withArgs(conseiller.id).resolves(conseiller)
    idService.uuid.returns(idNouveauJeune)
    dateService.now.returns(date)
  })

  afterEach(() => {
    sandbox.reset()
  })

  describe('handle', () => {
    it('crée un jeune et initialise le chat si besoin', async () => {
      // Given
      const command: CreateJeuneCommand = {
        firstName: 'Kenji',
        lastName: 'Lefameux',
        email: 'kenji.lefameur@poleemploi.fr',
        idConseiller: conseiller.id
      }

      // When
      const result = await createJeuneCommandHandler.handle(command)

      // Then
      const expectedJeune: Jeune = {
        id: idNouveauJeune,
        firstName: command.firstName,
        lastName: command.lastName,
        email: command.email,
        isActivated: false,
        creationDate: date,
        conseiller: unConseillerDuJeune(),
        structure: Core.Structure.POLE_EMPLOI,
        idPartenaire: undefined,
        preferences: {
          partageFavoris: true,
          alertesOffres: true,
          messages: true,
          creationActionConseiller: true,
          rendezVousSessions: true,
          rappelActions: true,
          actualitesMilo: true
        },
        configuration: {
          idJeune: idNouveauJeune,
          fuseauHoraire: TIMEZONE_PAR_DEFAUT
        },
        dispositif: Jeune.Dispositif.CEJ,
        peutVoirLeComptageDesHeures: undefined
      }
      expect(result).to.deep.equal(success(expectedJeune))
      expect(chatRepository.initializeChatIfNotExists).to.have.been.calledWith(
        idNouveauJeune,
        conseiller.id
      )
    })

    describe('quand il existe déjà un jeune avec cet email', () => {
      it('renvoie une erreur', async () => {
        // Given
        const command: CreateJeuneCommand = {
          firstName: 'Kenji',
          lastName: 'Lefameux',
          email: 'kenji.lefameur@poleemploi.fr',
          idConseiller: conseiller.id
        }
        jeuneRepository.getByEmail.withArgs(command.email).resolves(unJeune())

        // When
        const result = await createJeuneCommandHandler.handle(command)

        // Then
        expect(result).to.deep.equal(
          failure(new EmailExisteDejaError(command.email))
        )
      })
    })

    describe('quand le jeune existant est un bénéficiaire non accompagné', () => {
      it('le rattache au conseiller et le reprend en accompagnement', async () => {
        // Given
        const command: CreateJeuneCommand = {
          firstName: 'Kenji',
          lastName: 'Lefameux',
          email: 'kenji.lefameur@poleemploi.fr',
          idConseiller: conseiller.id
        }
        const jeuneNonAccompagne = unJeuneNonAccompagne({
          structure: Core.Structure.FT_ESPACE_CANDIDAT
        })
        jeuneRepository.getByEmail
          .withArgs(command.email)
          .resolves(jeuneNonAccompagne)

        // When
        const result = await createJeuneCommandHandler.handle(command)

        // Then
        expect(isSuccess(result)).to.equal(true)
        if (isSuccess(result)) {
          expect(result.data.id).to.equal(jeuneNonAccompagne.id)
          expect(result.data.conseiller?.id).to.equal(conseiller.id)
          expect(result.data.structure).to.equal(conseiller.structure)
          expect(result.data.preferences.messages).to.equal(true)
        }
        expect(
          chatRepository.initializeChatIfNotExists
        ).to.have.been.calledWithExactly(jeuneNonAccompagne.id, conseiller.id)
      })
    })
  })

  describe('authorize', () => {
    it('authorise un conseiller', async () => {
      // Given
      const command: CreateJeuneCommand = {
        firstName: 'Kenji',
        lastName: 'Lefameux',
        email: 'kenji.lefameur@poleemploi.fr',
        idConseiller: conseiller.id
      }

      const utilisateur = unUtilisateurConseiller({
        structure: Structure.POLE_EMPLOI
      })

      // When
      await createJeuneCommandHandler.authorize(command, utilisateur)

      // Then
      expect(
        conseillerAuthorizer.autoriserLeConseiller
      ).to.have.been.calledWithExactly(command.idConseiller, utilisateur)
    })
  })
})
