import { Jeune } from '../../../src/domain/jeune/jeune'
import { RendezVousMilo } from '../../../src/domain/milo/rendez-vous.milo'
import {
  CodeTypeRendezVous,
  RendezVous
} from '../../../src/domain/rendez-vous/rendez-vous'
import { IdService } from '../../../src/utils/id-service'
import { resoudreDateMilo } from '../../../src/utils/milo-date'
import { uneConfiguration, unJeune } from '../../fixtures/jeune.fixture'
import { unRendezVousMilo } from '../../fixtures/milo.fixture'
import {
  unJeuneDuRendezVous,
  unRendezVous
} from '../../fixtures/rendez-vous.fixture'
import { expect, StubbedClass, stubClass } from '../../utils'
import Statut = RendezVousMilo.Statut

describe('MiloRendezVous', () => {
  describe('Factory', () => {
    let idService: StubbedClass<IdService>
    let rendezVousFactory: RendezVousMilo.Factory

    let rdvMilo: RendezVousMilo
    let rendezVousPassEmploi: RendezVous
    let jeune: Jeune
    let uuid: string
    let rendezVousObtenu: RendezVous

    const idJeune = 'id-jeune'
    // Le fuseau du jeune ne doit jamais influencer la date résolue : elle est
    // déjà résolue en amont (ACL) avec le fuseau de la structure MiLo. On le
    // met volontairement à un fuseau différent pour le prouver.
    const configuration = uneConfiguration({
      fuseauHoraire: 'America/Guadeloupe'
    })
    const timezoneStructureMilo = 'Europe/Paris'
    const dateTimeRendezVousDebut = resoudreDateMilo(
      '2022-10-06 10:07:00',
      timezoneStructureMilo
    )
    const dateTimeRendezVousFin = resoudreDateMilo(
      '2022-10-06 11:43:00',
      timezoneStructureMilo
    )

    describe('creerRendezVousPassEmploi', () => {
      beforeEach(() => {
        // Given
        idService = stubClass(IdService)
        rendezVousFactory = new RendezVousMilo.Factory(idService)

        jeune = unJeune({
          id: idJeune,
          configuration
        })
        uuid = 'de82d1fe-875c-11ed-a1eb-0242ac120002'
        idService.uuid.returns(uuid)
      })

      describe('les règles complexes', () => {
        beforeEach(() => {
          // Given
          rdvMilo = unRendezVousMilo({
            dateHeureDebut: dateTimeRendezVousDebut,
            dateHeureFin: dateTimeRendezVousFin
          })

          // When
          rendezVousObtenu = rendezVousFactory.createRendezVousCEJ(
            rdvMilo,
            jeune
          )
        })
        it('retourne un rendez-vous avec la date résolue au fuseau de la structure, jamais celui du jeune', async () => {
          // Then
          expect(rendezVousObtenu.date).to.deep.equal(
            new Date('2022-10-06T08:07:00Z')
          )
        })
        describe('durée', () => {
          it('retourne la durée en minutes quand la date de fin est renseignée', async () => {
            // Then
            expect(rendezVousObtenu.duree).to.deep.equal(96)
          })
          it("retourne 0 quand la date de fin n'est pas renseignée", async () => {
            // Given
            rdvMilo = unRendezVousMilo({
              dateHeureFin: undefined
            })
            // When
            rendezVousObtenu = rendezVousFactory.createRendezVousCEJ(
              rdvMilo,
              jeune
            )
            // Then
            expect(rendezVousObtenu.duree).to.deep.equal(0)
          })
        })
      })
      describe("quand c'est un rendez vous individuel", () => {
        it('retourne un rendez-vous avec le type ENTRETIEN INDIVIDUEL ', async () => {
          // Given
          rdvMilo = unRendezVousMilo({
            dateHeureDebut: dateTimeRendezVousDebut,
            dateHeureFin: dateTimeRendezVousFin
          })

          // When
          rendezVousObtenu = rendezVousFactory.createRendezVousCEJ(
            rdvMilo,
            jeune
          )

          // Then
          const expected: RendezVous = {
            id: uuid,
            source: RendezVous.Source.MILO,
            titre: rdvMilo.titre,
            sousTitre: '',
            date: new Date('2022-10-06T08:07:00Z'),
            duree: 96,
            jeunes: [
              unJeuneDuRendezVous({
                id: idJeune,
                configuration
              })
            ],
            type: CodeTypeRendezVous.RENDEZ_VOUS_MILO,
            presenceConseiller: true,
            modalite: rdvMilo.modalite,
            commentaire: rdvMilo.commentaire,
            informationsPartenaire: {
              type: 'RENDEZ_VOUS',
              id: rdvMilo.id
            },
            createur: { id: '', nom: '', prenom: '' },
            adresse: undefined,
            annule: false
          }
          expect(rendezVousObtenu).to.deep.equal(expected)
        })
        it('retourne un rendez-vous annulé quand le statut et Annulé', async () => {
          // Given
          rdvMilo = unRendezVousMilo({
            dateHeureDebut: dateTimeRendezVousDebut,
            dateHeureFin: dateTimeRendezVousFin,
            statut: RendezVousMilo.Statut.RDV_ANNULE
          })

          // When
          rendezVousObtenu = rendezVousFactory.createRendezVousCEJ(
            rdvMilo,
            jeune
          )

          // Then
          const expected: RendezVous = {
            id: uuid,
            source: RendezVous.Source.MILO,
            titre: rdvMilo.titre,
            sousTitre: '',
            date: new Date('2022-10-06T08:07:00Z'),
            duree: 96,
            jeunes: [
              unJeuneDuRendezVous({
                id: idJeune,
                configuration
              })
            ],
            type: CodeTypeRendezVous.RENDEZ_VOUS_MILO,
            presenceConseiller: true,
            modalite: rdvMilo.modalite,
            commentaire: rdvMilo.commentaire,
            informationsPartenaire: {
              type: 'RENDEZ_VOUS',
              id: rdvMilo.id
            },
            createur: { id: '', nom: '', prenom: '' },
            adresse: undefined,
            annule: true
          }
          expect(rendezVousObtenu).to.deep.equal(expected)
        })
        it('retourne un rendez-vous annulé quand le statut et Reporté', async () => {
          // Given
          rdvMilo = unRendezVousMilo({
            dateHeureDebut: dateTimeRendezVousDebut,
            dateHeureFin: dateTimeRendezVousFin,
            statut: RendezVousMilo.Statut.RDV_REPORTE
          })

          // When
          rendezVousObtenu = rendezVousFactory.createRendezVousCEJ(
            rdvMilo,
            jeune
          )

          // Then
          const expected: RendezVous = {
            id: uuid,
            source: RendezVous.Source.MILO,
            titre: rdvMilo.titre,
            sousTitre: '',
            date: new Date('2022-10-06T08:07:00Z'),
            duree: 96,
            jeunes: [
              unJeuneDuRendezVous({
                id: idJeune,
                configuration
              })
            ],
            type: CodeTypeRendezVous.RENDEZ_VOUS_MILO,
            presenceConseiller: true,
            modalite: rdvMilo.modalite,
            commentaire: rdvMilo.commentaire,
            informationsPartenaire: {
              type: 'RENDEZ_VOUS',
              id: rdvMilo.id
            },
            createur: { id: '', nom: '', prenom: '' },
            adresse: undefined,
            annule: true
          }
          expect(rendezVousObtenu).to.deep.equal(expected)
        })
      })
      describe("quand c'est une session", () => {
        beforeEach(() => {
          // Given
          rdvMilo = unRendezVousMilo({
            dateHeureDebut: dateTimeRendezVousDebut,
            dateHeureFin: dateTimeRendezVousFin,
            adresse: 'Route de la plage, 97122 Baie-Mahault'
          })

          // When
          rendezVousObtenu = rendezVousFactory.createRendezVousCEJ(
            rdvMilo,
            jeune
          )
        })
        it('retourne un rendez-vous avec le type ENTRETIEN INDIVIDUEL ', async () => {
          // Then
          const expected: RendezVous = {
            id: uuid,
            source: RendezVous.Source.MILO,
            titre: rdvMilo.titre,
            sousTitre: '',
            date: new Date('2022-10-06T08:07:00Z'),
            duree: 96,
            jeunes: [
              unJeuneDuRendezVous({
                id: idJeune,
                configuration
              })
            ],
            type: CodeTypeRendezVous.RENDEZ_VOUS_MILO,
            presenceConseiller: true,
            adresse: rdvMilo.adresse,
            commentaire: rdvMilo.commentaire,
            informationsPartenaire: {
              type: 'RENDEZ_VOUS',
              id: rdvMilo.id
            },
            createur: { id: '', nom: '', prenom: '' },
            modalite: undefined,
            annule: false
          }
          expect(rendezVousObtenu).to.deep.equal(expected)
        })
      })
    })
    describe('mettreAJourRendezVousPassEmploi', () => {
      beforeEach(() => {
        // Given
        idService = stubClass(IdService)
        rendezVousFactory = new RendezVousMilo.Factory(idService)
        jeune = unJeune({
          id: idJeune,
          configuration
        })
      })

      it('retourne un rendez-vous avec le type ENTRETIEN INDIVIDUEL ', async () => {
        // Given
        rendezVousPassEmploi = unRendezVous({
          id: 'un-id-pass-emploi-quoi',
          jeunes: [jeune]
        })
        uuid = 'de82d1fe-875c-11ed-a1eb-0242ac120002'
        idService.uuid.returns(uuid)
        rdvMilo = unRendezVousMilo({
          dateHeureDebut: dateTimeRendezVousDebut,
          dateHeureFin: dateTimeRendezVousFin,
          statut: Statut.RDV_ABSENT
        })

        // When
        rendezVousObtenu = rendezVousFactory.updateRendezVousCEJ(
          rendezVousPassEmploi,
          rdvMilo
        )

        // Then
        const expected: RendezVous = {
          ...rendezVousPassEmploi,
          jeunes: [
            {
              id: jeune.id,
              firstName: jeune.firstName,
              lastName: jeune.lastName,
              email: jeune.email,
              configuration: jeune.configuration,
              conseiller: jeune.conseiller,
              preferences: jeune.preferences,
              present: false
            }
          ],
          titre: rdvMilo.titre,
          date: new Date('2022-10-06T08:07:00Z'),
          duree: 96,
          modalite: rdvMilo.modalite,
          commentaire: rdvMilo.commentaire,
          adresse: undefined
        }
        expect(rendezVousObtenu).to.deep.equal(expected)
      })

      it('retourne un rendez-vous annulé quand le statut et Annulé', async () => {
        // Given
        rendezVousPassEmploi = unRendezVous({
          id: 'un-id-pass-emploi-quoi',
          jeunes: [jeune],
          annule: false
        })
        idService.uuid.returns('de82d1fe-875c-11ed-a1eb-0242ac120002')
        rdvMilo = unRendezVousMilo({
          dateHeureDebut: dateTimeRendezVousDebut,
          dateHeureFin: dateTimeRendezVousFin,
          statut: RendezVousMilo.Statut.RDV_ANNULE
        })

        // When
        rendezVousObtenu = rendezVousFactory.updateRendezVousCEJ(
          rendezVousPassEmploi,
          rdvMilo
        )

        expect(rendezVousObtenu.annule).to.be.true()
      })
      it('retourne un rendez-vous annulé quand le statut et Reporté', async () => {
        // Given
        rendezVousPassEmploi = unRendezVous({
          id: 'un-id-pass-emploi-quoi',
          jeunes: [jeune],
          annule: false
        })

        idService.uuid.returns('de82d1fe-875c-11ed-a1eb-0242ac120002')
        rdvMilo = unRendezVousMilo({
          dateHeureDebut: dateTimeRendezVousDebut,
          dateHeureFin: dateTimeRendezVousFin,
          statut: RendezVousMilo.Statut.RDV_REPORTE
        })

        // When
        rendezVousObtenu = rendezVousFactory.updateRendezVousCEJ(
          rendezVousPassEmploi,
          rdvMilo
        )

        // Then
        expect(rendezVousObtenu.annule).to.be.true()
      })
    })
  })
})
