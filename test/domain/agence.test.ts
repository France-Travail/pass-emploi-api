import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox } from 'sinon'
import { expect, StubbedClass, stubClass } from '../utils'
import { DateService } from '../../src/utils/date-service'
import { AnimationCollective } from '../../src/domain/rendez-vous/animation-collective'
import { Agence, ChangementAgenceQueryModel } from '../../src/domain/agence'
import { Conseiller } from '../../src/domain/milo/conseiller'
import { unConseiller } from '../fixtures/conseiller.fixture'
import {
  uneAnimationCollective,
  unJeuneDuRendezVous
} from '../fixtures/rendez-vous.fixture'
import { uneAgence } from '../fixtures/agence.fixture'
import {
  isFailure,
  Result,
  success
} from '../../src/building-blocks/types/result'

describe('Agence', () => {
  let agenceService: Agence.Service
  let agenceRepository: StubbedType<Agence.Repository>
  let conseillerRepository: StubbedType<Conseiller.Repository>
  let animationCollectiveRepository: StubbedType<AnimationCollective.Repository>
  let animationCollectiveService: AnimationCollective.Service
  let dateService: StubbedClass<DateService>

  const conseiller = unConseiller({
    agence: {
      id: 'id-agence-actuelle',
      nom: 'agence actuelle'
    }
  })

  const unAutreConseiller = unConseiller({
    id: 'un-autre-conseiller',
    agence: {
      id: 'id-agence-actuelle',
      nom: 'agence actuelle'
    }
  })

  const jeuneDuConseiller = unJeuneDuRendezVous({
    id: 'id-jeune-du-conseiller',
    conseiller: {
      id: conseiller.id,
      lastName: conseiller.lastName,
      firstName: conseiller.firstName,
      idAgence: conseiller.agence!.id
    }
  })

  const jeuneDunAutreConseiller = unJeuneDuRendezVous({
    id: 'id-jeune-autre-conseiller',
    conseiller: {
      id: unAutreConseiller.id,
      firstName: unAutreConseiller.firstName,
      lastName: unAutreConseiller.lastName,
      idAgence: unAutreConseiller.agence!.id
    }
  })

  const nouvelleAgence = uneAgence({
    id: 'idNouvelleAgence'
  })

  const idConseiller = conseiller.id
  const idNouvelleAgence = 'idNouvelleAgence'

  beforeEach(async () => {
    const sandbox = createSandbox()
    agenceRepository = stubInterface(sandbox)
    conseillerRepository = stubInterface(sandbox)
    animationCollectiveRepository = stubInterface(sandbox)
    dateService = stubClass(DateService)
    animationCollectiveService = new AnimationCollective.Service(
      animationCollectiveRepository,
      dateService
    )
    agenceService = new Agence.Service(
      conseillerRepository,
      agenceRepository,
      animationCollectiveRepository,
      animationCollectiveService
    )
  })

  describe('Service', () => {
    describe("quand le conseiller n'existe pas", () => {
      it('rejette', async () => {
        // Given
        conseillerRepository.get.withArgs(conseiller.id).resolves(undefined)
        // When
        const result = await agenceService.changerAgenceConseiller(
          idConseiller,
          idNouvelleAgence
        )
        // Then
        expect(isFailure(result)).to.equal(true)
      })
    })
    describe("quand l'agence cible n'existe pas", () => {
      it('rejette', async () => {
        // Given
        conseillerRepository.get.withArgs(conseiller.id).resolves(conseiller)
        agenceRepository.get
          .withArgs(idNouvelleAgence, conseiller.structure)
          .resolves(undefined)
        // When
        const result = await agenceService.changerAgenceConseiller(
          idConseiller,
          idNouvelleAgence
        )

        // Then
        expect(isFailure(result)).to.equal(true)
      })
    })
    describe("quand l'agence cible est la même", () => {
      it('rejette', async () => {
        // Given
        conseillerRepository.get.withArgs(conseiller.id).resolves(conseiller)
        agenceRepository.get
          .withArgs(conseiller.agence!.id, conseiller.structure)
          .resolves(conseiller.agence)

        // When
        const result = await agenceService.changerAgenceConseiller(
          conseiller.id,
          conseiller.agence!.id!
        )

        // Then
        expect(isFailure(result)).to.equal(true)
      })
    })
    describe("quand le conseiller n'a pas de jeune et n'a pas créé d'AC", () => {
      it("change l'agence cible", async () => {
        // Given
        conseillerRepository.get.withArgs(conseiller.id).resolves(conseiller)
        agenceRepository.get
          .withArgs(idNouvelleAgence, conseiller.structure)
          .resolves(nouvelleAgence)
        animationCollectiveRepository.getAllByEtablissementAvecSupprimes.resolves(
          []
        )

        // When
        const result = await agenceService.changerAgenceConseiller(
          idConseiller,
          idNouvelleAgence
        )

        // Then
        expect(conseillerRepository.save).to.have.been.calledWithExactly({
          ...conseiller,
          agence: nouvelleAgence
        })
        expect(result).to.deep.equal(
          success({
            emailConseiller: conseiller.email,
            idNouvelleAgence: nouvelleAgence.id,
            idAncienneAgence: conseiller!.agence!.id,
            infosTransfertAnimationsCollectives: []
          })
        )
      })
    })
    describe('quand le conseiller a au moins un jeune', () => {
      beforeEach(() => {
        conseillerRepository.get.withArgs(conseiller.id).resolves(conseiller)
        agenceRepository.get
          .withArgs(idNouvelleAgence, conseiller.structure)
          .resolves(nouvelleAgence)
      })
      describe("quand il y a des AC non closes dans l'établissement", () => {
        describe("quand le conseiller a créé l'AC", () => {
          describe("quand tous les jeunes de l'AC sont au conseiller", () => {
            const animationCollective = uneAnimationCollective({
              idAgence: conseiller.agence!.id!,
              jeunes: [jeuneDuConseiller],
              createur: {
                id: conseiller.id,
                nom: conseiller.lastName,
                prenom: conseiller.firstName
              }
            })
            let result: Result<ChangementAgenceQueryModel>
            beforeEach(async () => {
              // Given
              animationCollectiveRepository.getAllByEtablissementAvecSupprimes
                .withArgs(conseiller.agence!.id)
                .resolves([animationCollective])

              // When
              result = await agenceService.changerAgenceConseiller(
                idConseiller,
                idNouvelleAgence
              )
            })
            it("modifie l'agence cible de l'AC", () => {
              expect(
                animationCollectiveRepository.save
              ).to.have.been.calledWithExactly({
                ...animationCollective,
                idAgence: nouvelleAgence.id
              })
            })
            it("modifie l'agence cible du conseiller", () => {
              expect(conseillerRepository.save).to.have.been.calledWithExactly({
                ...conseiller,
                agence: nouvelleAgence
              })
            })
            it('renvoie un succès', () => {
              // Then
              expect(result).to.deep.equal(
                success({
                  emailConseiller: conseiller.email,
                  idNouvelleAgence: nouvelleAgence.id,
                  idAncienneAgence: conseiller!.agence!.id,
                  infosTransfertAnimationsCollectives: [
                    {
                      idAnimationCollective:
                        '20c8ca73-fd8b-4194-8d3c-80b6c9949deb',
                      titreAnimationCollective: 'rdv',
                      agenceTransferee: 'OUI (le conseiller était créateur)',
                      jeunesDesinscrits: []
                    }
                  ]
                })
              )
            })
          })
          describe("quand un des jeunes de l'AC n'est pas au conseiller", () => {
            const animationCollective = uneAnimationCollective({
              idAgence: conseiller.agence!.id!,
              jeunes: [jeuneDuConseiller, jeuneDunAutreConseiller],
              createur: {
                id: conseiller.id,
                nom: conseiller.lastName,
                prenom: conseiller.firstName
              }
            })
            let result: Result<ChangementAgenceQueryModel>
            beforeEach(async () => {
              // Given
              animationCollectiveRepository.getAllByEtablissementAvecSupprimes
                .withArgs(conseiller.agence!.id)
                .resolves([animationCollective])

              // When
              result = await agenceService.changerAgenceConseiller(
                idConseiller,
                idNouvelleAgence
              )
            })
            it('désinscrit les autres jeunes', () => {
              expect(
                animationCollectiveRepository.save
              ).to.have.been.calledWithExactly({
                ...animationCollective,
                jeunes: [jeuneDuConseiller]
              })
            })
            it("modifie l'agence cible du conseiller", () => {
              it("modifie l'agence cible du conseiller", () => {
                expect(
                  conseillerRepository.save
                ).to.have.been.calledWithExactly({
                  ...conseiller,
                  agence: nouvelleAgence
                })
              })
            })
            it('renvoie un succès', () => {
              // Then
              expect(result).to.deep.equal(
                success({
                  emailConseiller: conseiller.email,
                  idNouvelleAgence: nouvelleAgence.id,
                  idAncienneAgence: conseiller!.agence!.id,
                  infosTransfertAnimationsCollectives: [
                    {
                      idAnimationCollective:
                        '20c8ca73-fd8b-4194-8d3c-80b6c9949deb',
                      titreAnimationCollective: 'rdv',
                      agenceTransferee: 'OUI (le conseiller était créateur)',
                      jeunesDesinscrits: [
                        {
                          id: 'id-jeune-autre-conseiller',
                          nom: 'Doe',
                          prenom: 'John'
                        }
                      ]
                    }
                  ]
                })
              )
            })
          })
        })

        describe("quand le conseiller n'a pas créé l'AC", () => {
          const animationCollective = uneAnimationCollective({
            idAgence: unAutreConseiller.agence!.id!,
            jeunes: [jeuneDuConseiller, jeuneDunAutreConseiller],
            createur: {
              id: unAutreConseiller.id,
              nom: unAutreConseiller.lastName,
              prenom: unAutreConseiller.firstName
            }
          })
          let result: Result<ChangementAgenceQueryModel>
          beforeEach(async () => {
            // Given
            animationCollectiveRepository.getAllByEtablissementAvecSupprimes
              .withArgs(conseiller.agence!.id)
              .resolves([animationCollective])

            // When
            result = await agenceService.changerAgenceConseiller(
              idConseiller,
              idNouvelleAgence
            )
          })
          it('désinscrit ses jeunes', () => {
            expect(
              animationCollectiveRepository.save
            ).to.have.been.calledWithExactly({
              ...animationCollective,
              jeunes: [jeuneDunAutreConseiller]
            })
          })
          it("modifie l'agence cible du conseiller", () => {
            it("modifie l'agence cible du conseiller", () => {
              expect(conseillerRepository.save).to.have.been.calledWithExactly({
                ...conseiller,
                agence: nouvelleAgence
              })
            })
          })
          it('renvoie un succès', () => {
            // Then
            expect(result).to.deep.equal(
              success({
                emailConseiller: conseiller.email,
                idNouvelleAgence: nouvelleAgence.id,
                idAncienneAgence: conseiller!.agence!.id,
                infosTransfertAnimationsCollectives: [
                  {
                    idAnimationCollective:
                      '20c8ca73-fd8b-4194-8d3c-80b6c9949deb',
                    titreAnimationCollective: 'rdv',
                    agenceTransferee:
                      "NON (le conseiller n'était pas le créateur)",
                    jeunesDesinscrits: [
                      {
                        id: 'id-jeune-du-conseiller',
                        nom: 'Doe',
                        prenom: 'John'
                      }
                    ]
                  }
                ]
              })
            )
          })
        })
      })
    })
  })
})
