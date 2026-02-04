import { unEvenementMilo, unRendezVousMilo } from 'test/fixtures/milo.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { success } from '../../../../src/building-blocks/types/result'
import { EvenementMilo } from '../../../../src/domain/milo/evenement.milo'
import { RendezVousMilo } from '../../../../src/domain/milo/rendez-vous.milo'
import { MiloClient } from '../../../../src/infrastructure/clients/milo/milo-client'
import { RendezVousMiloHttpRepository } from '../../../../src/infrastructure/repositories/milo/rendez-vous-milo-http.repository'

describe('RendezVousMiloHttpRepository', () => {
  let repository: RendezVousMiloHttpRepository
  let miloClient: StubbedClass<MiloClient>

  beforeEach(async () => {
    miloClient = stubClass(MiloClient)
    repository = new RendezVousMiloHttpRepository(miloClient)
  })

  describe('findRendezVousByEvenement', () => {
    const idPartenaireBeneficiaire = 1234
    const idObjet = 5678

    describe('quand il existe', () => {
      it('renvoie le rendez vous milo', async () => {
        // Given
        miloClient.getRendezVous.resolves(
          success({
            id: idObjet,
            dateHeureDebut: '2020-10-06 10:00:00',
            dateHeureFin: '2020-10-06 12:00:00',
            objet: 'Test RDV',
            conseiller: 'SIMILO SIMILO',
            idDossier: idPartenaireBeneficiaire,
            commentaire: '',
            type: 'Téléphone',
            statut: 'Planifié',
            lieu: 'new'
          })
        )

        // When
        const resultat = await repository.findRendezVousByEvenement(
          unEvenementMilo({
            idObjet: idObjet.toString(),
            objet: EvenementMilo.ObjetEvenement.RENDEZ_VOUS,
            idPartenaireBeneficiaire: idPartenaireBeneficiaire.toString()
          })
        )

        // Then
        const expected: RendezVousMilo = unRendezVousMilo({
          id: idObjet.toString(),
          idPartenaireBeneficiaire: idPartenaireBeneficiaire.toString(),
          adresse: 'new'
        })
        expect(resultat).to.deep.equal(expected)
        expect(miloClient.getRendezVous).to.have.been.calledOnceWithExactly(
          idPartenaireBeneficiaire.toString(),
          idObjet.toString()
        )
      })

      it('envoie les bons headers', async () => {
        // Given
        const scope = nock('https://milo.com')
          .get(
            `/operateurs/dossiers/${idPartenaireBeneficiaire}/rdv/${idObjet}`
          )
          .matchHeader(
            'X-Gravitee-Api-Key',
            configService.get('milo').apiKeyDetailRendezVous
          )
          .matchHeader('operateur', 'applicationcej')
          .reply(200, {
            id: idObjet,
            dateHeureDebut: '2020-10-06 10:00:00',
            dateHeureFin: '2020-10-06 12:00:00',
            objet: 'Test RDV',
            conseiller: 'SIMILO SIMILO',
            idDossier: idPartenaireBeneficiaire,
            commentaire: '',
            type: 'Téléphone',
            statut: 'Planifié',
            lieu: 'new'
          })

        // When
        await repository.findRendezVousByEvenement(
          unEvenementMilo({
            idObjet: idObjet.toString(),
            objet: EvenementMilo.ObjetEvenement.RENDEZ_VOUS,
            idPartenaireBeneficiaire: idPartenaireBeneficiaire.toString()
          })
        )

        // Then
        expect(scope.isDone()).to.equal(true)
      })
    })
    describe("quand il n'existe pas", () => {
      it('renvoie undefined', async () => {
        // Given
        miloClient.getRendezVous.resolves(success(undefined))

        // When
        const resultat = await repository.findRendezVousByEvenement(
          unEvenementMilo({
            idObjet: idObjet.toString(),
            objet: EvenementMilo.ObjetEvenement.RENDEZ_VOUS,
            idPartenaireBeneficiaire: idPartenaireBeneficiaire.toString()
          })
        )

        // Then
        expect(resultat).to.be.undefined()
      })
    })
    describe('quand Milo renvoie une erreur 500', () => {
      it('throw une exception', async () => {
        // Given
        nock('https://milo.com')
          .get(
            `/operateurs/dossiers/${idPartenaireBeneficiaire}/rdv/${idObjet}`
          )
          .reply(500, 'Internal Server Error')

        // When
        const promise = repository.findRendezVousByEvenement(
          unEvenementMilo({
            idObjet: idObjet.toString(),
            objet: EvenementMilo.ObjetEvenement.RENDEZ_VOUS,
            idPartenaireBeneficiaire: idPartenaireBeneficiaire.toString()
          })
        )

        // Then
        await expect(promise).to.be.rejected()
      })
    })
    describe("quand l'evenement est du mauvais type", () => {
      it('renvoie undefined', async () => {
        // Given
        const evenementPasBon = unEvenementMilo({
          idObjet: idObjet.toString(),
          objet: EvenementMilo.ObjetEvenement.SESSION,
          idPartenaireBeneficiaire: idPartenaireBeneficiaire.toString()
        })

        // When
        const resultat = await repository.findRendezVousByEvenement(
          evenementPasBon
        )

        // Then
        expect(resultat).to.be.undefined()
      })
    })
  })
})
