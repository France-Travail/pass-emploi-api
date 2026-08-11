import { unEvenementMilo, unRendezVousMilo } from 'test/fixtures/milo.fixture'
import { expect, StubbedClass, stubClass } from 'test/utils'
import { failure, success } from '../../../../src/building-blocks/types/result'
import { EvenementMilo } from '../../../../src/domain/milo/evenement.milo'
import { RendezVousMilo } from '../../../../src/domain/milo/rendez-vous.milo'
import { MiloClient } from '../../../../src/infrastructure/clients/milo/milo-client'
import { RendezVousMiloHttpRepository } from '../../../../src/infrastructure/repositories/milo/rendez-vous-milo-http.repository'
import { ErreurMiloHttp } from '../../../../src/building-blocks/types/domain-error'
import { resoudreDateMilo } from '../../../../src/utils/milo-date'
import Statut = RendezVousMilo.Statut

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
    const timezoneStructureMilo = 'Indian/Reunion'

    describe('quand il existe', () => {
      it('renvoie le rendez vous milo avec la date résolue au fuseau de la structure', async () => {
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
          }),
          timezoneStructureMilo
        )

        // Then
        const expected: RendezVousMilo = unRendezVousMilo({
          id: idObjet.toString(),
          idPartenaireBeneficiaire: idPartenaireBeneficiaire.toString(),
          dateHeureDebut: resoudreDateMilo(
            '2020-10-06 10:00:00',
            timezoneStructureMilo
          ),
          dateHeureFin: resoudreDateMilo(
            '2020-10-06 12:00:00',
            timezoneStructureMilo
          ),
          adresse: 'new',
          statut: Statut.RDV_PLANIFIE
        })
        expect(resultat).to.deep.equal(expected)
        expect(miloClient.getRendezVous).to.have.been.calledOnceWithExactly(
          idPartenaireBeneficiaire.toString(),
          idObjet.toString()
        )
      })
    })
    describe("quand il n'existe pas", () => {
      it('renvoie undefined', async () => {
        // Given
        miloClient.getRendezVous.resolves(
          failure(new ErreurMiloHttp('Ressource Milo introuvable', 404))
        )

        // When
        const resultat = await repository.findRendezVousByEvenement(
          unEvenementMilo({
            idObjet: idObjet.toString(),
            objet: EvenementMilo.ObjetEvenement.RENDEZ_VOUS,
            idPartenaireBeneficiaire: idPartenaireBeneficiaire.toString()
          }),
          timezoneStructureMilo
        )

        // Then
        expect(resultat).to.be.undefined()
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
          evenementPasBon,
          timezoneStructureMilo
        )

        // Then
        expect(resultat).to.be.undefined()
      })
    })
  })
})
