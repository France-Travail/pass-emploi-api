import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox, createSandbox } from 'sinon'
import { JeuneAuthorizer } from '../../../../src/application/authorizers/jeune-authorizer'
import {
  CreateDemarcheCommand,
  CreateDemarcheCommandHandler
} from '../../../../src/application/commands/pole-emploi/create-demarche.command.handler'
import { ErreurHttp } from '../../../../src/building-blocks/types/domain-error'
import {
  emptySuccess,
  failure,
  isFailure,
  isSuccess,
  success
} from '../../../../src/building-blocks/types/result'
import { Profil } from '../../../../src/domain/profil'
import { Core } from '../../../../src/domain/core'
import { Demarche } from '../../../../src/domain/demarche'
import { Evenement, EvenementService } from '../../../../src/domain/evenement'
import { unUtilisateurJeune } from '../../../fixtures/authentification.fixture'
import { uneDatetime } from '../../../fixtures/date.fixture'
import { uneDemarche } from '../../../fixtures/demarche.fixture'
import { StubbedClass, expect, stubClass } from '../../../utils'

describe('CreateDemarcheCommandHandler', () => {
  let createDemarcheCommandHandler: CreateDemarcheCommandHandler
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let evenementService: StubbedClass<EvenementService>
  let demarcheFactory: StubbedClass<Demarche.Factory>
  let demarcheRepository: StubbedType<Demarche.Repository>
  const utilisateur = unUtilisateurJeune()
  const demarche = uneDemarche()

  const command: CreateDemarcheCommand = {
    idJeune: 'idJeune',
    accessToken: 'accessToken',
    dateFin: demarche.dateFin,
    description: 'ma démarche'
  }
  const demarcheCreee: Demarche.Creee = {
    statut: Demarche.Statut.A_FAIRE,
    dateCreation: uneDatetime(),
    dateFin: uneDatetime(),
    pourquoi: 'P01',
    quoi: 'Q38',
    description: command.description,
    promptIa: undefined
  }

  beforeEach(() => {
    const sandbox: SinonSandbox = createSandbox()
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    evenementService = stubClass(EvenementService)
    demarcheFactory = stubClass(Demarche.Factory)
    demarcheRepository = stubInterface(sandbox)

    createDemarcheCommandHandler = new CreateDemarcheCommandHandler(
      jeuneAuthorizer,
      evenementService,
      demarcheFactory,
      demarcheRepository
    )
  })

  describe('handle', () => {
    describe('quand la creation se passe bien', () => {
      it('met a jour le statut et renvoie un succès', async () => {
        // Given
        demarcheFactory.creerDemarche
          .withArgs({
            description: command.description,
            dateFin: command.dateFin,
            comment: undefined,
            quoi: undefined,
            pourquoi: undefined,
            promptIa: undefined
          })
          .returns(success(demarcheCreee))

        demarcheRepository.save
          .withArgs(demarcheCreee, command.accessToken)
          .resolves(emptySuccess())

        // When
        const result = await createDemarcheCommandHandler.handle(
          command,
          utilisateur
        )

        // Then
        expect(isSuccess(result)).to.be.true()
      })
    })
    describe('quand il y a une erreur lors de la creation', () => {
      it("transmet l'erreur", async () => {
        // Given
        demarcheFactory.creerDemarche
          .withArgs({
            description: command.description,
            dateFin: command.dateFin,
            comment: undefined,
            quoi: undefined,
            pourquoi: undefined,
            promptIa: undefined
          })
          .returns(success(demarcheCreee))

        const erreurHttp = failure(new ErreurHttp("C'est mauvais", 400))
        demarcheRepository.save
          .withArgs(demarcheCreee, command.accessToken)
          .resolves(erreurHttp)

        // When
        const result = await createDemarcheCommandHandler.handle(
          command,
          utilisateur
        )

        // Then
        expect(result).to.be.deep.equal(erreurHttp)
      })
    })
  })

  describe('authorize', () => {
    it('autorise les jeunes pole emploi', async () => {
      // When
      await createDemarcheCommandHandler.authorize(command, utilisateur)

      // Then
      expect(jeuneAuthorizer.autoriserLeJeune).to.have.been.calledWithExactly(
        command.idJeune,
        utilisateur
      )
    })
  })

  describe('profilsAutorises', () => {
    it('déclare les profils autorisés', () => {
      // Then
      expect(createDemarcheCommandHandler.profilsAutorises).to.deep.equal([
        Profil.FT_DEMANDEUR_EMPLOI_ACCOMPAGNE,
        Profil.FT_DEMANDEUR_EMPLOI,
        Profil.CONSEIL_DEPT
      ])
    })
  })

  describe('execute', () => {
    it("rejette un profil sans la capacité SERVICES_FT sans appeler l'authorizer ni le repository", async () => {
      // Given
      const utilisateurMilo = unUtilisateurJeune({
        structure: Core.Structure.MILO
      })

      // When
      const result = await createDemarcheCommandHandler.execute(
        command,
        utilisateurMilo
      )

      // Then
      expect(isFailure(result)).to.be.true()
      expect(jeuneAuthorizer.autoriserLeJeune).not.to.have.been.called()
      expect(demarcheFactory.creerDemarche).not.to.have.been.called()
      expect(demarcheRepository.save).not.to.have.been.called()
    })
  })

  describe('monitor', () => {
    it('crée un événement d’engagement pour une démarche personnalisée (hors référentiel)', async () => {
      // Given
      const commandPourDemarchePersonnalisee: CreateDemarcheCommand = {
        idJeune: 'idJeune',
        accessToken: 'accessToken',
        description: 'demarche personalisée',
        dateFin: uneDatetime()
      }

      // When
      await createDemarcheCommandHandler.monitor(
        utilisateur,
        commandPourDemarchePersonnalisee
      )

      // Then
      expect(evenementService.creer).to.have.been.calledOnceWithExactly(
        Evenement.Code.ACTION_CREEE_HORS_REFERENTIEL,
        utilisateur
      )
    })

    it('crée un événement d’engagement pour une démarche du référentiel pôle emploi', async () => {
      // Given
      const commandPourDemarcheDuReferentiel: CreateDemarcheCommand = {
        idJeune: 'idJeune',
        accessToken: 'accessToken',
        codeQuoi: 'codeQuoi',
        codePourquoi: 'codePourquoi',
        codeComment: 'codeComment',
        dateFin: uneDatetime()
      }
      // When
      await createDemarcheCommandHandler.monitor(
        utilisateur,
        commandPourDemarcheDuReferentiel
      )
      // Then
      expect(evenementService.creer).to.have.been.calledOnceWithExactly(
        Evenement.Code.ACTION_CREEE_REFERENTIEL,
        utilisateur
      )
    })

    it('crée un événement d’engagement pour une duplication de démarche personnalisée (hors référentiel)', async () => {
      // Given
      const commandPourDemarchePersonnalisee: CreateDemarcheCommand = {
        idJeune: 'idJeune',
        accessToken: 'accessToken',
        description: 'demarche personalisée',
        dateFin: uneDatetime(),
        estDuplicata: true
      }

      // When
      await createDemarcheCommandHandler.monitor(
        utilisateur,
        commandPourDemarchePersonnalisee
      )

      // Then
      expect(evenementService.creer).to.have.been.calledOnceWithExactly(
        Evenement.Code.ACTION_DUPLIQUEE_HORS_REFERENTIEL,
        utilisateur
      )
    })

    it('crée un événement d’engagement pour une duplication de démarche du référentiel pôle emploi', async () => {
      // Given
      const commandPourDemarcheDuReferentiel: CreateDemarcheCommand = {
        idJeune: 'idJeune',
        accessToken: 'accessToken',
        codeQuoi: 'codeQuoi',
        codePourquoi: 'codePourquoi',
        codeComment: 'codeComment',
        dateFin: uneDatetime(),
        estDuplicata: true
      }
      // When
      await createDemarcheCommandHandler.monitor(
        utilisateur,
        commandPourDemarcheDuReferentiel
      )
      // Then
      expect(evenementService.creer).to.have.been.calledOnceWithExactly(
        Evenement.Code.ACTION_DUPLIQUEE_REFERENTIEL,
        utilisateur
      )
    })

    it('crée un événement d’engagement pour une démarche IA du référentiel pôle emploi', async () => {
      // Given
      const commandPourDemarcheDuReferentiel: CreateDemarcheCommand = {
        idJeune: 'idJeune',
        accessToken: 'accessToken',
        codeQuoi: 'codeQuoi',
        codePourquoi: 'codePourquoi',
        description: 'démarche générée par IA',
        dateFin: uneDatetime(),
        estDuplicata: true,
        genereParIA: true
      }
      // When
      await createDemarcheCommandHandler.monitor(
        utilisateur,
        commandPourDemarcheDuReferentiel
      )
      // Then
      expect(evenementService.creer).to.have.been.calledOnceWithExactly(
        Evenement.Code.ACTION_CREEE_IA_REFERENTIEL,
        utilisateur
      )
    })

    it('crée un événement d’engagement pour une démarche IA hors référentiel pôle emploi', async () => {
      // Given
      const commandPourDemarcheDuReferentiel: CreateDemarcheCommand = {
        idJeune: 'idJeune',
        accessToken: 'accessToken',
        description: 'démarche générée par IA',
        dateFin: uneDatetime(),
        estDuplicata: true,
        genereParIA: true
      }
      // When
      await createDemarcheCommandHandler.monitor(
        utilisateur,
        commandPourDemarcheDuReferentiel
      )
      // Then
      expect(evenementService.creer).to.have.been.calledOnceWithExactly(
        Evenement.Code.ACTION_CREEE_IA_HORS_REFERENTIEL,
        utilisateur
      )
    })
  })
})
