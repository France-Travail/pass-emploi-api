import { emptySuccess, failure } from 'src/building-blocks/types/result'
import { Evenement, EvenementService } from 'src/domain/evenement'
import { ImmersionClient } from 'src/infrastructure/clients/immersion-client'
import { unUtilisateurJeune } from 'test/fixtures/authentification.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { JeuneAuthorizer } from '../../../src/application/authorizers/jeune-authorizer'
import {
  EnvoyerFormulaireContactImmersionCommandHandlerV3,
  EnvoyerFormulaireContactImmersionCommandV3
} from '../../../src/application/commands/envoyer-formulaire-contact-immersionV3.command.handler.db'
import { PartenaireImmersion } from '../../../src/infrastructure/repositories/dto/immersion.dto'
import { ErreurHttp } from '../../../src/building-blocks/types/domain-error'
import ContactMode = PartenaireImmersion.ContactMode

describe('EnvoyerFormulaireContactImmersionCommandHandler', () => {
  let jeuneAuthorizer: StubbedClass<JeuneAuthorizer>
  let envoyerFormulaireContactImmersionCommandHandler: EnvoyerFormulaireContactImmersionCommandHandlerV3
  let immersionClient: StubbedClass<ImmersionClient>
  let evenementService: StubbedClass<EvenementService>

  beforeEach(async () => {
    jeuneAuthorizer = stubClass(JeuneAuthorizer)
    immersionClient = stubClass(ImmersionClient)
    evenementService = stubClass(EvenementService)
    envoyerFormulaireContactImmersionCommandHandler =
      new EnvoyerFormulaireContactImmersionCommandHandlerV3(
        jeuneAuthorizer,
        immersionClient,
        evenementService
      )
  })

  describe('handle', () => {
    describe('quand la requête est correct', () => {
      it('transmet le formulaire au format attendu par immersion', async () => {
        // Given
        const command: EnvoyerFormulaireContactImmersionCommandV3 = {
          idJeune: 'idJeune',
          appellationCode: '11573',
          siret: 'siret',
          locationId: 'un-location-id',
          prenom: 'prenom',
          nom: 'nom',
          email: 'test@test.com',
          contactMode: 'EMAIL',
          numeroTelephone: '0606060606',
          datePreferences: 'dans le mois qui vient'
        }

        immersionClient.envoyerFormulaireImmersionV3.resolves(emptySuccess())

        // When
        await envoyerFormulaireContactImmersionCommandHandler.handle(command)

        // Then
        expect(
          immersionClient.envoyerFormulaireImmersionV3
        ).to.have.been.calledOnceWithExactly({
          kind: 'IF',
          appellationCode: command.appellationCode,
          siret: command.siret,
          locationId: command.locationId,
          potentialBeneficiaryFirstName: command.prenom,
          potentialBeneficiaryLastName: command.nom,
          potentialBeneficiaryEmail: command.email,
          potentialBeneficiaryPhone: '0600000000',
          immersionObjective: "Découvrir un métier ou un secteur d'activité",
          contactMode: command.contactMode as ContactMode,
          datePreferences: command.datePreferences,
          experienceAdditionalInformation: undefined,
          resumeLink: undefined
        })
      })

      it('transmet experienceAdditionalInformation et resumeLink quand fournis', async () => {
        // Given
        const command: EnvoyerFormulaireContactImmersionCommandV3 = {
          idJeune: 'idJeune',
          appellationCode: '11573',
          siret: 'siret',
          locationId: 'un-location-id',
          prenom: 'prenom',
          nom: 'nom',
          email: 'test@test.com',
          contactMode: 'EMAIL',
          datePreferences: 'dans le mois qui vient',
          numeroTelephone: '0606060606',
          experienceAdditionalInformation:
            "J'ai déjà travaillé dans ce secteur",
          resumeLink: 'https://mon-cv.fr/cv.pdf'
        }

        immersionClient.envoyerFormulaireImmersionV3.resolves(emptySuccess())

        // When
        await envoyerFormulaireContactImmersionCommandHandler.handle(command)

        // Then
        expect(
          immersionClient.envoyerFormulaireImmersionV3
        ).to.have.been.calledOnceWithExactly({
          kind: 'IF',
          appellationCode: command.appellationCode,
          siret: command.siret,
          locationId: command.locationId,
          potentialBeneficiaryFirstName: command.prenom,
          potentialBeneficiaryLastName: command.nom,
          potentialBeneficiaryEmail: command.email,
          potentialBeneficiaryPhone: '0600000000',
          immersionObjective: "Découvrir un métier ou un secteur d'activité",
          contactMode: command.contactMode as ContactMode,
          datePreferences: command.datePreferences,
          experienceAdditionalInformation:
            command.experienceAdditionalInformation,
          resumeLink: command.resumeLink
        })
      })
    })
    describe('quand la requête a échoué', () => {
      it("renvoie la failure du client quand l'envoi échoue", async () => {
        // Given
        const command: EnvoyerFormulaireContactImmersionCommandV3 = {
          idJeune: 'idJeune',
          appellationCode: '11573',
          siret: 'siret',
          prenom: 'prenom',
          nom: 'nom',
          email: 'test@test.com',
          contactMode: 'EMAIL',
          locationId: '',
          numeroTelephone: '0606060606',
          datePreferences: 'dans le mois qui vient'
        }

        immersionClient.envoyerFormulaireImmersionV3.resolves(
          failure(new ErreurHttp('erreur', 400))
        )

        // When
        const result =
          await envoyerFormulaireContactImmersionCommandHandler.handle(command)

        // Then
        expect(result).to.deep.equal(failure(new ErreurHttp('erreur', 400)))
      })
    })
  })

  describe('authorize', () => {
    it('authorize le jeune', async () => {
      // Given
      const command: EnvoyerFormulaireContactImmersionCommandV3 = {
        idJeune: 'idJeune',
        appellationCode: '11573',
        siret: 'siret',
        prenom: 'prenom',
        nom: 'nom',
        email: 'email',
        contactMode: 'EMAIL',
        locationId: '',
        numeroTelephone: '0606060606',
        datePreferences: 'Dès que possible'
      }

      const utilisateur = unUtilisateurJeune()

      // When
      await envoyerFormulaireContactImmersionCommandHandler.authorize(
        command,
        utilisateur
      )

      // Then
      expect(jeuneAuthorizer.autoriserLeJeune).to.have.been.calledWithExactly(
        'idJeune',
        utilisateur
      )
    })
  })
  describe('monitor', () => {
    const utilisateur = unUtilisateurJeune()

    it("créé l'événement d'envoi formulaire", async () => {
      await envoyerFormulaireContactImmersionCommandHandler.monitor(utilisateur)

      expect(evenementService.creer).to.have.been.calledWithExactly(
        Evenement.Code.OFFRE_IMMERSION_ENVOI_FORMULAIRE,
        utilisateur
      )
    })
  })
})
