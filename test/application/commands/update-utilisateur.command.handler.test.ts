import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { createSandbox, match, SinonSandbox } from 'sinon'
import {
  ConseillerNonValide,
  NonTraitableError,
  NonTraitableReason
} from 'src/building-blocks/types/domain-error'
import { Authentification } from 'src/domain/authentification'
import { DateService } from 'src/utils/date-service'
import { IdService } from 'src/utils/id-service'
import {
  unUtilisateurConseiller,
  unUtilisateurJeune,
  unUtilisateurJeunePasConnecte
} from 'test/fixtures/authentification.fixture'
import { uneDate } from 'test/fixtures/date.fixture'
import {
  unUtilisateurQueryModel,
  unUtilisateurSansEmailQueryModel
} from 'test/fixtures/query-models/authentification.query-model.fixtures'
import {
  UpdateUtilisateurCommand,
  UpdateUtilisateurCommandHandler
} from '../../../src/application/commands/update-utilisateur.command.handler'
import { UtilisateurQueryModel } from '../../../src/application/queries/query-models/authentification.query-model'
import {
  failure,
  isFailure,
  isSuccess,
  Result,
  success
} from '../../../src/building-blocks/types/result'
import { Core } from '../../../src/domain/core'
import { Migration } from '../../../src/domain/migration'
import { MailBrevoService } from '../../../src/infrastructure/clients/mail-brevo.service.db'
import { expect, StubbedClass, stubClass } from '../../utils'
import { ArchiveJeune } from '../../../src/domain/archive-jeune'
import { Jeune, JeuneNonAccompagne } from '../../../src/domain/jeune/jeune'
import MotifSuppressionSupport = ArchiveJeune.MotifSuppressionSupport
import { Profil, structureLegacyVersProfil } from '../../../src/domain/profil'
import {
  unProfilCD,
  unProfilFT,
  unProfilMilo
} from '../../fixtures/profil.fixture'

describe('UpdateUtilisateurCommandHandler', () => {
  let authentificationRepository: StubbedType<Authentification.Repository>
  let updateUtilisateurCommandHandler: UpdateUtilisateurCommandHandler
  const dateService = stubClass(DateService)
  const maintenant = DateService.fromJSDateToDateTime(uneDate())!
  dateService.nowJs.returns(maintenant.toJSDate())
  dateService.now.returns(maintenant)
  let mailBrevoService: StubbedClass<MailBrevoService>
  const uuidGenere = '1'
  const idService: IdService = {
    uuid: () => uuidGenere
  }
  const authentificationFactory: Authentification.Factory =
    new Authentification.Factory(idService)
  let migrationService: StubbedClass<Migration.Service>
  let archiverJeuneRepository: StubbedType<ArchiveJeune.Repository>
  let jeuneRepository: StubbedType<Jeune.Repository>
  const jeuneNonAccompagneFactory: JeuneNonAccompagne.Factory =
    new JeuneNonAccompagne.Factory(dateService, idService)

  beforeEach(() => {
    const sandbox: SinonSandbox = createSandbox()
    authentificationRepository = stubInterface(sandbox)
    mailBrevoService = stubClass(MailBrevoService)
    migrationService = stubClass(Migration.Service)
    archiverJeuneRepository = stubInterface(sandbox)
    jeuneRepository = stubInterface(sandbox)
    updateUtilisateurCommandHandler = new UpdateUtilisateurCommandHandler(
      authentificationRepository,
      authentificationFactory,
      dateService,
      mailBrevoService,
      migrationService,
      archiverJeuneRepository,
      jeuneRepository,
      jeuneNonAccompagneFactory
    )
  })

  describe('execute', () => {
    describe('Conseiller', () => {
      describe("conseiller venant de l'idp MILO ou Pole Emploi", async () => {
        describe('conseiller connu', async () => {
          it('retourne le conseiller', async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.CONSEILLER,
              structure: Core.Structure.MILO
            }

            const utilisateur = unUtilisateurConseiller()
            authentificationRepository.getConseiller
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(
              mailBrevoService.envoyerEmailCreationConseillerMilo
            ).to.have.callCount(0)
            expect(isSuccess(result)).equal(true)
            if (isSuccess(result)) {
              expect(result.data).to.deep.equal(unUtilisateurQueryModel())
            }
          })
          it("ne persiste pas l'installationId pour un conseiller", async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.CONSEILLER,
              structure: Core.Structure.MILO,
              installationId: 'installation-uuid'
            }

            const utilisateur = unUtilisateurConseiller()
            authentificationRepository.getConseiller
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(isSuccess(result)).equal(true)
            expect(
              authentificationRepository.updateInstallationIdJeune
            ).to.have.callCount(0)
          })
          describe('conseiller connu avec mauvaise structure', async () => {
            it('retourne failure', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: Authentification.Type.CONSEILLER,
                structure: Core.Structure.POLE_EMPLOI
              }

              const utilisateur = unUtilisateurConseiller({
                profil: unProfilFT(Profil.Dispositif.BRSA)
              })
              authentificationRepository.getConseiller
                .withArgs(command.idUtilisateurAuth)
                .resolves(utilisateur)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                failure(
                  new NonTraitableError(
                    'Utilisateur',
                    command.idUtilisateurAuth,
                    NonTraitableReason.UTILISATEUR_DEJA_PE_BRSA
                  )
                )
              )
            })
          })
          describe('conseiller connu avec structure FRANCE_TRAVAIL', async () => {
            it('retourne le conseiller', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: Authentification.Type.CONSEILLER,
                structure: 'FRANCE_TRAVAIL'
              }

              const utilisateur = unUtilisateurConseiller({
                profil: unProfilFT(Profil.Dispositif.BRSA)
              })
              authentificationRepository.getConseiller
                .withArgs(command.idUtilisateurAuth)
                .resolves(utilisateur)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(isSuccess(result)).equal(true)
              if (isSuccess(result)) {
                expect(result.data).to.deep.equal(
                  unUtilisateurQueryModel({
                    structure: Core.Structure.POLE_EMPLOI_BRSA
                  })
                )
              }
            })
          })
          describe('conseiller connu qui doit migrer vers Parcours Emploi', async () => {
            it('retourne une failure avec la raison MIGRATION_PARCOURS_EMPLOI', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: Authentification.Type.CONSEILLER,
                structure: 'FRANCE_TRAVAIL'
              }

              const utilisateur = unUtilisateurConseiller({
                profil: unProfilFT(Profil.Dispositif.BRSA)
              })
              authentificationRepository.getConseiller
                .withArgs(command.idUtilisateurAuth)
                .resolves(utilisateur)

              migrationService.faitPartieDeLaMigrationEtLaDateEstPassee
                .withArgs({
                  id: utilisateur.id,
                  type: Authentification.Type.CONSEILLER
                })
                .resolves(true)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(isFailure(result)).to.be.true()
              if (isFailure(result)) {
                expect(result.error).to.be.instanceOf(NonTraitableError)
                expect((result.error as NonTraitableError).reason).to.equal(
                  NonTraitableReason.MIGRATION_PARCOURS_EMPLOI
                )
              }
            })
          })
          describe('conseiller connu qui ne doit pas migrer vers Parcours Emploi', async () => {
            it('retourne le conseiller', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: Authentification.Type.CONSEILLER,
                structure: 'FRANCE_TRAVAIL'
              }

              const utilisateur = unUtilisateurConseiller({
                profil: unProfilFT(Profil.Dispositif.BRSA)
              })
              authentificationRepository.getConseiller
                .withArgs(command.idUtilisateurAuth)
                .resolves(utilisateur)

              migrationService.recupererDateDeMigrationSiLUtilisateurDoitMigrer
                .withArgs({
                  id: utilisateur.id,
                  type: Authentification.Type.CONSEILLER
                })
                .resolves(undefined)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(isSuccess(result)).equal(true)
              if (isSuccess(result)) {
                expect(result.data).to.deep.equal(
                  unUtilisateurQueryModel({
                    structure: Core.Structure.POLE_EMPLOI_BRSA
                  })
                )
              }
            })
          })
        })

        describe('conseiller connu avec nouvel email, nom et prenom', async () => {
          it('met à jour ses infos et retourne le conseiller sans envoi email quand date trop passée', async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.CONSEILLER,
              structure: Core.Structure.MILO,
              email: 'New@email.com',
              nom: 'newNom',
              prenom: 'newPrenom',
              username: 'milou'
            }

            const ilYa5Semaines = maintenant.minus({ weeks: 5 }).toJSDate()

            const utilisateur = unUtilisateurConseiller({
              idAuthentification: command.idUtilisateurAuth,
              email: undefined,
              datePremiereConnexion: ilYa5Semaines
            })
            authentificationRepository.getConseiller
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(
              authentificationRepository.update
            ).to.have.been.calledWithExactly({
              ...utilisateur,
              email: 'new@email.com',
              username: 'milou',
              nom: 'newNom',
              prenom: 'newPrenom',
              dateDerniereConnexion: uneDate(),
              datePremiereConnexion: ilYa5Semaines
            })
            expect(
              mailBrevoService.envoyerEmailCreationConseillerMilo
            ).not.to.have.called()
            expect(isSuccess(result)).equal(true)
            if (isSuccess(result)) {
              expect(result.data.email).to.deep.equal('new@email.com')
            }
          })
          it('met à jour ses infos et retourne le conseiller sans envoi email quand mail existant', async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.CONSEILLER,
              structure: Core.Structure.MILO,
              email: 'New@email.com',
              nom: 'newNom',
              prenom: 'newPrenom',
              username: 'milou'
            }

            const ilYa1Semaine = maintenant.minus({ weeks: 1 }).toJSDate()

            const utilisateur = unUtilisateurConseiller({
              idAuthentification: command.idUtilisateurAuth,
              email: 'old',
              datePremiereConnexion: ilYa1Semaine
            })
            authentificationRepository.getConseiller
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(
              authentificationRepository.update
            ).to.have.been.calledWithExactly({
              ...utilisateur,
              email: 'new@email.com',
              username: 'milou',
              nom: 'newNom',
              prenom: 'newPrenom',
              dateDerniereConnexion: uneDate(),
              datePremiereConnexion: ilYa1Semaine
            })
            expect(
              mailBrevoService.envoyerEmailCreationConseillerMilo
            ).not.to.have.called()
            expect(isSuccess(result)).equal(true)
            if (isSuccess(result)) {
              expect(result.data.email).to.deep.equal('new@email.com')
            }
          })
          it('met à jour ses infos et retourne le conseiller avec envoi email', async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.CONSEILLER,
              structure: Core.Structure.MILO,
              email: 'New@email.com',
              nom: 'newNom',
              prenom: 'newPrenom',
              username: 'milou'
            }

            const ilYaUneSemaine = maintenant.minus({ weeks: 1 }).toJSDate()

            const utilisateur = unUtilisateurConseiller({
              idAuthentification: command.idUtilisateurAuth,
              email: undefined,
              datePremiereConnexion: ilYaUneSemaine
            })
            authentificationRepository.getConseiller
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(
              authentificationRepository.update
            ).to.have.been.calledWithExactly({
              ...utilisateur,
              email: 'new@email.com',
              username: 'milou',
              nom: 'newNom',
              prenom: 'newPrenom',
              dateDerniereConnexion: uneDate(),
              datePremiereConnexion: ilYaUneSemaine
            })
            expect(
              mailBrevoService.envoyerEmailCreationConseillerMilo
            ).to.have.calledOnceWithExactly({
              ...utilisateur,
              email: 'new@email.com',
              username: command.username,
              nom: 'newNom',
              prenom: 'newPrenom',
              dateDerniereConnexion: uneDate(),
              datePremiereConnexion: ilYaUneSemaine
            })
            expect(isSuccess(result)).equal(true)
            if (isSuccess(result)) {
              expect(result.data.email).to.deep.equal('new@email.com')
            }
          })
        })
        describe('conseiller inconnu', async () => {
          describe('quand il est valide', () => {
            let result: Result<UtilisateurQueryModel>
            const command: UpdateUtilisateurCommand = {
              nom: 'Tavernier',
              prenom: 'Nils',
              type: Authentification.Type.CONSEILLER,
              email: 'Nils.Tavernier@Passemploi.com',
              idUtilisateurAuth: 'nilstavernier',
              structure: Core.Structure.MILO,
              username: 'milou'
            }

            beforeEach(() => {
              // Given
              authentificationRepository.getConseiller
                .withArgs(command.idUtilisateurAuth)
                .resolves(undefined)
              authentificationRepository.estConseillerSuperviseur.resolves(true)

              const utilisateur: Authentification.Utilisateur = {
                id: '1',
                prenom: command.prenom || '',
                nom: command.nom || '',
                email: command.email,
                username: command.username,
                type: command.type as Authentification.Type,
                profil: structureLegacyVersProfil(
                  command.structure as Core.Structure
                ),
                roles: []
              }
              authentificationRepository.save
                .withArgs(utilisateur, command.idUtilisateurAuth)
                .resolves()
            })
            it('crée et retourne le conseiller avec un email minusculisé', async () => {
              // When
              result = await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(isSuccess(result)).equal(true)
              if (isSuccess(result)) {
                expect(result.data).to.deep.equal(
                  unUtilisateurQueryModel({
                    roles: [Authentification.Role.SUPERVISEUR],
                    username: 'milou'
                  })
                )
              }
            })
            describe('Pôle Emploi', () => {
              it('n’envoie pas d’email de bienvenue', async () => {
                // Given
                const command: UpdateUtilisateurCommand = {
                  nom: 'Tavernier',
                  prenom: 'Nils',
                  type: Authentification.Type.CONSEILLER,
                  email: 'Nils.Tavernier@Passemploi.com',
                  idUtilisateurAuth: 'nilstavernier',
                  structure: Core.Structure.POLE_EMPLOI
                }
                // When
                result = await updateUtilisateurCommandHandler.execute(command)
                // Then
                expect(
                  mailBrevoService.envoyerEmailCreationConseillerMilo
                ).to.have.callCount(0)
              })
            })
            describe('Mission Locale', () => {
              it('envoie un email de bienvenue', async () => {
                // When
                result = await updateUtilisateurCommandHandler.execute(command)
                // Then
                expect(
                  mailBrevoService.envoyerEmailCreationConseillerMilo
                ).to.have.been.calledOnce()
              })
            })
          })
          describe('quand il est valide mais vient du bouton connexion unique (structure FRANCE_TRAVAIL)', () => {
            let result: Result<UtilisateurQueryModel>
            const command: UpdateUtilisateurCommand = {
              nom: 'Tavernier',
              prenom: 'Nils',
              type: Authentification.Type.CONSEILLER,
              email: 'Nils.Tavernier@Passemploi.com',
              idUtilisateurAuth: 'nilstavernier',
              structure: 'FRANCE_TRAVAIL',
              username: 'milou'
            }

            beforeEach(() => {
              // Given
              authentificationRepository.getConseiller
                .withArgs(command.idUtilisateurAuth)
                .resolves(undefined)
              authentificationRepository.estConseillerSuperviseur.resolves(true)

              const utilisateur: Authentification.Utilisateur = {
                id: '1',
                prenom: command.prenom || '',
                nom: command.nom || '',
                email: command.email,
                username: command.username,
                type: command.type as Authentification.Type,
                profil: structureLegacyVersProfil(
                  command.structure as Core.Structure
                ),
                roles: []
              }
              authentificationRepository.save
                .withArgs(utilisateur, command.idUtilisateurAuth)
                .resolves()
            })
            it('retourne erreur utilisateur inexistant', async () => {
              // When
              result = await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                failure(
                  new NonTraitableError(
                    'Utilisateur',
                    command.idUtilisateurAuth,
                    NonTraitableReason.UTILISATEUR_INEXISTANT
                  )
                )
              )
            })
          })
          describe("quand il est valide mais il manque l'email", () => {
            it('crée et retourne le conseiller', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                nom: 'Tavernier',
                prenom: 'Nils',
                type: Authentification.Type.CONSEILLER,
                idUtilisateurAuth: 'nilstavernier',
                structure: Core.Structure.MILO
              }

              authentificationRepository.getConseiller
                .withArgs(command.idUtilisateurAuth)
                .resolves(undefined)
              authentificationRepository.estConseillerSuperviseur.resolves(true)

              const utilisateur: Authentification.Utilisateur = {
                id: '1',
                prenom: command.prenom || '',
                nom: command.nom || '',
                email: command.email,
                username: command.username,
                type: command.type as Authentification.Type,
                profil: structureLegacyVersProfil(
                  command.structure as Core.Structure
                ),
                roles: []
              }
              authentificationRepository.save
                .withArgs(utilisateur, command.idUtilisateurAuth)
                .resolves()

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(isSuccess(result)).equal(true)
              if (isSuccess(result)) {
                expect(result.data).to.deep.equal({
                  ...unUtilisateurSansEmailQueryModel(),
                  roles: [Authentification.Role.SUPERVISEUR]
                })
              }
            })
          })
          describe('quand il lui manque les infos nom et prenom', () => {
            it('retourne une failure', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                type: Authentification.Type.CONSEILLER,
                idUtilisateurAuth: 'nilstavernier',
                structure: Core.Structure.MILO,
                email: 'Un-Email@valide.fr'
              }

              authentificationRepository.getConseiller
                .withArgs(command.idUtilisateurAuth)
                .resolves(undefined)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(isFailure(result)).equal(true)
              if (isFailure(result)) {
                expect(result.error.code).to.equal(ConseillerNonValide.CODE)
              }
            })
          })
        })
      })
    })

    describe('Jeune', () => {
      describe("jeune venant de l'idp MILO", async () => {
        describe("jeune connu par son id d'authentification", async () => {
          it('retourne le jeune', async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.JEUNE,
              structure: Core.Structure.MILO
            }

            const utilisateur = unUtilisateurJeune({
              profil: unProfilMilo()
            })
            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(result).to.deep.equal(
              success({
                email: 'john.doe@plop.io',
                id: 'ABCDE',
                nom: 'Doe',
                prenom: 'John',
                roles: [],
                structure: 'MILO',
                profil: unProfilMilo(),
                type: 'JEUNE',
                username: undefined
              })
            )
          })
          it('met à jour ses infos et retourne le jeune', async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.JEUNE,
              structure: Core.Structure.MILO,
              email: 'New@email.com',
              nom: 'newNom',
              prenom: 'newPrenom'
            }

            const utilisateur = unUtilisateurJeune({
              idAuthentification: command.idUtilisateurAuth
            })
            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(authentificationRepository.update).to.have.been.called()
            expect(isSuccess(result)).equal(true)
            if (isSuccess(result)) {
              expect(result.data.email).to.deep.equal('new@email.com')
            }
          })
          it("persiste l'installationId transmis au login", async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.JEUNE,
              structure: Core.Structure.MILO,
              installationId: 'installation-uuid'
            }

            const utilisateur = unUtilisateurJeune({
              profil: unProfilMilo()
            })
            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(isSuccess(result)).equal(true)
            expect(
              authentificationRepository.updateInstallationIdJeune
            ).to.have.been.calledWithExactly(
              utilisateur.id,
              'installation-uuid'
            )
          })
          it("ne touche pas à l'installationId quand il n'est pas transmis", async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.JEUNE,
              structure: Core.Structure.MILO
            }

            const utilisateur = unUtilisateurJeune({
              profil: unProfilMilo()
            })
            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(isSuccess(result)).equal(true)
            expect(
              authentificationRepository.updateInstallationIdJeune
            ).to.have.callCount(0)
          })
          it("n'échoue pas quand la persistance de l'installationId échoue", async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.JEUNE,
              structure: Core.Structure.MILO,
              installationId: 'installation-uuid'
            }

            const utilisateur = unUtilisateurJeune({
              profil: unProfilMilo()
            })
            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)
            authentificationRepository.updateInstallationIdJeune.rejects(
              new Error('db down')
            )

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(isSuccess(result)).equal(true)
          })
          it("retourne une failure quand le jeune trouvé n'est pas Milo", async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              email: 'abc@test.com',
              type: Authentification.Type.JEUNE,
              structure: Core.Structure.MILO
            }

            const utilisateurPasMilo = unUtilisateurJeune({
              idAuthentification: command.idUtilisateurAuth,
              profil: unProfilFT()
            })
            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateurPasMilo)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(result).to.deep.equal(
              failure(
                new NonTraitableError(
                  'Utilisateur',
                  command.idUtilisateurAuth,
                  NonTraitableReason.UTILISATEUR_DEJA_PE
                )
              )
            )
          })
        })

        describe("jeune non connu par son id d'authentification", async () => {
          it("réassocie par email un jeune Milo orphelin d'id d'authentification en préservant sa date de première connexion", async () => {
            // Given
            const datePremiereConnexionHistorique = new Date(
              '2021-02-03T04:05:06.000Z'
            )
            const utilisateur = unUtilisateurJeunePasConnecte({
              profil: unProfilMilo(),
              datePremiereConnexion: datePremiereConnexionHistorique
            })
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nouvel-id-keycloak-milo',
              nom: 'nom jeune',
              prenom: 'prenom jeune',
              email: 'abc@test.com',
              type: Authentification.Type.JEUNE,
              structure: Core.Structure.MILO
            }

            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(undefined)
            authentificationRepository.getJeuneByEmail
              .withArgs(command.email, Core.Structure.MILO)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(result).to.deep.equal(
              success({
                email: 'abc@test.com',
                id: 'ABCDE',
                nom: 'nom jeune',
                prenom: 'prenom jeune',
                roles: [],
                structure: 'MILO',
                profil: unProfilMilo(),
                type: 'JEUNE',
                username: undefined
              })
            )
            expect(
              authentificationRepository.update
            ).to.have.been.calledWithExactly({
              ...utilisateur,
              email: command.email,
              nom: command.nom,
              prenom: command.prenom,
              idAuthentification: command.idUtilisateurAuth,
              dateDerniereConnexion: uneDate(),
              datePremiereConnexion: datePremiereConnexionHistorique,
              username: undefined
            })
          })

          it("ne réassocie pas un jeune Milo déjà lié à un autre id d'authentification", async () => {
            // Given
            const utilisateurActif = unUtilisateurJeune({
              profil: unProfilMilo(),
              idAuthentification: 'id-authentification-actif'
            })
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'sub-inconnu',
              email: 'abc@test.com',
              type: Authentification.Type.JEUNE,
              structure: Core.Structure.MILO
            }

            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(undefined)
            authentificationRepository.getJeuneByEmail
              .withArgs(command.email, Core.Structure.MILO)
              .resolves(utilisateurActif)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(authentificationRepository.update).not.to.have.been.called()
            expect(result).to.deep.equal(
              failure(
                new NonTraitableError(
                  'Utilisateur',
                  command.idUtilisateurAuth,
                  NonTraitableReason.UTILISATEUR_INEXISTANT,
                  command.email
                )
              )
            )
          })

          it('retourne une failure quand le jeune est aussi inconnu par email', async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              email: 'abc@test.com',
              type: Authentification.Type.JEUNE,
              structure: Core.Structure.MILO
            }

            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(undefined)
            authentificationRepository.getJeuneByEmail
              .withArgs(command.email, Core.Structure.MILO)
              .resolves(undefined)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(result).to.deep.equal(
              failure(
                new NonTraitableError(
                  'Utilisateur',
                  command.idUtilisateurAuth,
                  NonTraitableReason.UTILISATEUR_INEXISTANT,
                  command.email
                )
              )
            )
          })

          it("retourne une failure quand l'email n'est pas fourni", async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: Authentification.Type.JEUNE,
              structure: Core.Structure.MILO
            }

            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(undefined)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(
              authentificationRepository.getJeuneByEmail
            ).not.to.have.been.called()
            expect(result).to.deep.equal(
              failure(
                new NonTraitableError(
                  'Utilisateur',
                  command.idUtilisateurAuth,
                  NonTraitableReason.UTILISATEUR_INEXISTANT,
                  undefined
                )
              )
            )
          })
        })
      })

      describe('bénéficiaire non accompagné (DEMANDEUR / NON DEMANDEUR)', () => {
        it('crée le jeune sans conseiller quand il est inconnu', async () => {
          // Given
          const command: UpdateUtilisateurCommand = {
            idUtilisateurAuth: 'un-sub-ft',
            prenom: 'Jean',
            nom: 'Dupont',
            email: 'jean.dupont@test.com',
            type: 'BENEFICIAIRE',
            structure: Core.Structure.FT_DEMANDEUR_D_EMPLOI
          }
          authentificationRepository.getJeuneByIdAuthentification
            .withArgs(command.idUtilisateurAuth)
            .resolves(undefined)

          // When
          const result = await updateUtilisateurCommandHandler.execute(command)

          // Then
          expect(jeuneRepository.save).to.have.been.calledOnce()
          const jeuneCree = jeuneRepository.save.getCall(0).args[0]
          expect(jeuneCree.conseiller).to.be.undefined()
          expect(jeuneCree.structure).to.equal(Profil.Structure.FRANCE_TRAVAIL)
          expect(jeuneCree.dispositif).to.equal(
            Profil.Dispositif.DEMANDEUR_D_EMPLOI
          )
          expect(
            authentificationRepository.update
          ).to.have.been.calledWithExactly(
            match({ idAuthentification: 'un-sub-ft', id: uuidGenere })
          )
          expect(isSuccess(result)).to.equal(true)
          if (isSuccess(result)) {
            expect(result.data.structure).to.equal(
              Core.Structure.FT_DEMANDEUR_D_EMPLOI
            )
            expect(result.data.id).to.equal(uuidGenere)
          }
        })

        it('met à jour le jeune quand il est déjà connu', async () => {
          // Given
          const command: UpdateUtilisateurCommand = {
            idUtilisateurAuth: 'un-sub-ft',
            type: 'BENEFICIAIRE',
            structure: Core.Structure.FT_ESPACE_CANDIDAT
          }
          const utilisateur = unUtilisateurJeune({
            profil: unProfilFT(Profil.Dispositif.ESPACE_CANDIDAT)
          })
          authentificationRepository.getJeuneByIdAuthentification
            .withArgs(command.idUtilisateurAuth)
            .resolves(utilisateur)

          // When
          const result = await updateUtilisateurCommandHandler.execute(command)

          // Then
          expect(jeuneRepository.save).not.to.have.been.called()
          expect(authentificationRepository.update).to.have.been.calledOnce()
          expect(isSuccess(result)).to.equal(true)
        })
      })

      describe("jeune venant de l'idp Pole Emploi / BRSA", async () => {
        describe("jeune connu par son id d'authentification", async () => {
          describe("quand le jeune n'a pas migré vers Parcours Emploi", async () => {
            it('retourne le jeune', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: Authentification.Type.JEUNE,
                structure: Core.Structure.POLE_EMPLOI
              }

              const utilisateur = unUtilisateurJeune({
                profil: unProfilFT()
              })
              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(utilisateur)

              migrationService.faitPartieDeLaMigrationEtLaDateEstPassee
                .withArgs({
                  id: utilisateur.id,
                  type: Authentification.Type.JEUNE
                })
                .resolves(false)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                success({
                  email: 'john.doe@plop.io',
                  id: 'ABCDE',
                  nom: 'Doe',
                  prenom: 'John',
                  roles: [],
                  structure: 'POLE_EMPLOI',
                  profil: unProfilFT(),
                  type: 'JEUNE',
                  username: undefined
                })
              )
            })
            it("retourne une failure quand la structure du jeune trouvé n'est pas PE", async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: Authentification.Type.JEUNE,
                structure: Core.Structure.POLE_EMPLOI
              }

              const utilisateur = unUtilisateurJeune({
                profil: unProfilFT(Profil.Dispositif.BRSA)
              })
              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(utilisateur)

              migrationService.faitPartieDeLaMigrationEtLaDateEstPassee
                .withArgs({
                  id: utilisateur.id,
                  type: Authentification.Type.JEUNE
                })
                .resolves(false)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                failure(
                  new NonTraitableError(
                    'Utilisateur',
                    command.idUtilisateurAuth,
                    NonTraitableReason.UTILISATEUR_DEJA_PE_BRSA
                  )
                )
              )
            })
            it("retourne le jeune même s'il est archivé avec le motif MIGRATION - cas nouveau compte", async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: Authentification.Type.JEUNE,
                structure: Core.Structure.POLE_EMPLOI,
                email: 'nils.tavernier@pole-emploi.fr'
              }

              const utilisateur = unUtilisateurJeune({
                profil: unProfilFT(),
                email: 'nils.tavernier@pole-emploi.fr'
              })
              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(utilisateur)

              migrationService.faitPartieDeLaMigrationEtLaDateEstPassee
                .withArgs({
                  id: utilisateur.id,
                  type: Authentification.Type.JEUNE
                })
                .resolves(false)
              archiverJeuneRepository.estArchiveAvecMotif
                .withArgs(utilisateur.email, MotifSuppressionSupport.MIGRATION)
                .resolves(true)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                success({
                  email: utilisateur.email,
                  id: 'ABCDE',
                  nom: 'Doe',
                  prenom: 'John',
                  roles: [],
                  structure: 'POLE_EMPLOI',
                  profil: unProfilFT(),
                  type: 'JEUNE',
                  username: undefined
                })
              )
            })
          })
          describe('quand le jeune a migré vers Parcours Emploi (Feature Flip MIGRATION_PHASE_X pour son conseiller)', async () => {
            it('retourne une failure avec la raison MIGRATION_PARCOURS_EMPLOI si le jeune a migré vers Parcours Emploi', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: Authentification.Type.JEUNE,
                structure: Core.Structure.POLE_EMPLOI
              }

              const utilisateur = unUtilisateurJeune({
                profil: unProfilFT()
              })
              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(utilisateur)

              migrationService.faitPartieDeLaMigrationEtLaDateEstPassee
                .withArgs({
                  id: utilisateur.id,
                  type: Authentification.Type.JEUNE
                })
                .resolves(true)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(isFailure(result)).to.be.true()
              if (isFailure(result)) {
                expect(result.error).to.be.instanceOf(NonTraitableError)
                expect((result.error as NonTraitableError).reason).to.equal(
                  NonTraitableReason.MIGRATION_PARCOURS_EMPLOI
                )
                expect((result.error as NonTraitableError).email).to.equal(
                  utilisateur.email
                )
              }
            })
          })
          describe('jeune connu par son email (première connexion)', async () => {
            it("retourne le jeune et enregistre l'id d'authentification + mise à jour date premiere connexion", async () => {
              // Given
              const utilisateur = unUtilisateurJeunePasConnecte({
                profil: unProfilFT()
              })

              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'Id connection',
                nom: 'nom jeune',
                prenom: 'prenom jeune',
                email: 'email jeune',
                type: Authentification.Type.JEUNE,
                structure: Core.Structure.POLE_EMPLOI
              }

              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(undefined)
              authentificationRepository.getJeuneByEmail
                .withArgs(command.email)
                .resolves(utilisateur)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                success({
                  email: 'email jeune',
                  id: 'ABCDE',
                  nom: 'nom jeune',
                  prenom: 'prenom jeune',
                  roles: [],
                  structure: 'POLE_EMPLOI',
                  profil: unProfilFT(),
                  type: 'JEUNE',
                  username: undefined
                })
              )
              expect(
                authentificationRepository.update
              ).to.have.been.calledWithExactly({
                ...utilisateur,
                email: command.email,
                nom: command.nom,
                prenom: command.prenom,
                idAuthentification: command.idUtilisateurAuth,
                dateDerniereConnexion: uneDate(),
                datePremiereConnexion: uneDate()
              })
            })
            it('retourne une failure quand jeune trouvé pas de la bonne structure', async () => {
              // Given
              const utilisateurMauvaiseStructure = unUtilisateurJeune({
                profil: unProfilMilo()
              })

              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'Id connection',
                nom: 'nom jeune',
                prenom: 'prenom jeune',
                email: 'email jeune',
                type: Authentification.Type.JEUNE,
                structure: Core.Structure.POLE_EMPLOI
              }

              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(undefined)
              authentificationRepository.getJeuneByEmail
                .withArgs(command.email)
                .resolves(utilisateurMauvaiseStructure)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                failure(
                  new NonTraitableError(
                    'Utilisateur',
                    command.idUtilisateurAuth,
                    NonTraitableReason.UTILISATEUR_DEJA_MILO
                  )
                )
              )
            })
          })
          describe("jeune non connu par son id d'authentification ou email", async () => {
            it("retourne une failure quand l'email PE n'est pas fournie", async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: Authentification.Type.JEUNE,
                structure: Core.Structure.POLE_EMPLOI,
                email: undefined
              }

              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(undefined)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                failure(
                  new NonTraitableError(
                    'Utilisateur',
                    command.idUtilisateurAuth,
                    NonTraitableReason.EMAIL_BENEFICIAIRE_INTROUVABLE
                  )
                )
              )
            })
            it('retourne une failure quand le jeune est pas trouvé', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                email: 'abc@test.com',
                type: Authentification.Type.JEUNE,
                structure: Core.Structure.POLE_EMPLOI_BRSA
              }

              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(undefined)
              authentificationRepository.getJeuneByEmail
                .withArgs(command.email, command.structure)
                .resolves(undefined)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                failure(
                  new NonTraitableError(
                    'Utilisateur',
                    command.idUtilisateurAuth,
                    NonTraitableReason.UTILISATEUR_INEXISTANT,
                    command.email
                  )
                )
              )
            })
            it('retourne une failure avec la raison MIGRATION_PARCOURS_EMPLOI si le jeune est archivé avec le motif MIGRATION', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                email: 'abc@test.com',
                type: Authentification.Type.JEUNE,
                structure: Core.Structure.POLE_EMPLOI_BRSA
              }

              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(undefined)
              authentificationRepository.getJeuneByEmail
                .withArgs(command.email, command.structure)
                .resolves(undefined)
              archiverJeuneRepository.estArchiveAvecMotif
                .withArgs('abc@test.com', MotifSuppressionSupport.MIGRATION)
                .resolves(true)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(isFailure(result)).to.be.true()
              if (isFailure(result)) {
                expect(result.error).to.be.instanceOf(NonTraitableError)
                expect((result.error as NonTraitableError).reason).to.equal(
                  NonTraitableReason.MIGRATION_PARCOURS_EMPLOI
                )
                expect((result.error as NonTraitableError).email).to.equal(
                  command.email
                )
              }
            })
          })
        })

        describe('BENEFICIAIRE FRANCE_TRAVAIL', async () => {
          describe("benef connu par son id d'authentification", async () => {
            it('retourne le benef', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: 'BENEFICIAIRE',
                structure: 'FRANCE_TRAVAIL'
              }

              const utilisateur = unUtilisateurJeune({
                profil: unProfilFT()
              })
              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(utilisateur)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                success({
                  email: 'john.doe@plop.io',
                  id: 'ABCDE',
                  nom: 'Doe',
                  prenom: 'John',
                  roles: [],
                  structure: 'POLE_EMPLOI',
                  profil: unProfilFT(),
                  type: 'JEUNE',
                  username: undefined
                })
              )
            })
            it('retourne une failure quand la structure du benef trouvé est Milo', async () => {
              // Given
              const command: UpdateUtilisateurCommand = {
                idUtilisateurAuth: 'nilstavernier',
                type: 'BENEFICIAIRE',
                structure: 'FRANCE_TRAVAIL'
              }

              const utilisateur = unUtilisateurJeune({
                profil: unProfilMilo()
              })
              authentificationRepository.getJeuneByIdAuthentification
                .withArgs(command.idUtilisateurAuth)
                .resolves(utilisateur)

              // When
              const result =
                await updateUtilisateurCommandHandler.execute(command)

              // Then
              expect(result).to.deep.equal(
                failure(
                  new NonTraitableError(
                    'Utilisateur',
                    command.idUtilisateurAuth,
                    NonTraitableReason.UTILISATEUR_DEJA_MILO
                  )
                )
              )
            })
          })
          it('retourne une ok quand la structure du benef trouvé est dans PE', async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: 'BENEFICIAIRE',
              structure: 'FRANCE_TRAVAIL'
            }

            const utilisateur = unUtilisateurJeune({
              profil: unProfilFT(Profil.Dispositif.BRSA)
            })
            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(result).to.deep.equal(
              success({
                email: 'john.doe@plop.io',
                id: 'ABCDE',
                nom: 'Doe',
                prenom: 'John',
                roles: [],
                structure: 'POLE_EMPLOI_BRSA',
                profil: unProfilFT(Profil.Dispositif.BRSA),
                type: 'JEUNE',
                username: undefined
              })
            )
          })
          it('retourne une ok pour un benef de CD', async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: 'BENEFICIAIRE',
              structure: 'FRANCE_TRAVAIL'
            }

            const utilisateur = unUtilisateurJeune({
              profil: unProfilCD()
            })
            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(result).to.deep.equal(
              success({
                email: 'john.doe@plop.io',
                id: 'ABCDE',
                nom: 'Doe',
                prenom: 'John',
                roles: [],
                structure: 'CONSEIL_DEPT',
                profil: unProfilCD(),
                type: 'JEUNE',
                username: undefined
              })
            )
          })
          it('retourne une ok pour un benef de AVENIR PRO', async () => {
            // Given
            const command: UpdateUtilisateurCommand = {
              idUtilisateurAuth: 'nilstavernier',
              type: 'BENEFICIAIRE',
              structure: 'FRANCE_TRAVAIL'
            }

            const utilisateur = unUtilisateurJeune({
              profil: unProfilFT(Profil.Dispositif.AVENIR_PRO)
            })
            authentificationRepository.getJeuneByIdAuthentification
              .withArgs(command.idUtilisateurAuth)
              .resolves(utilisateur)

            // When
            const result =
              await updateUtilisateurCommandHandler.execute(command)

            // Then
            expect(result).to.deep.equal(
              success({
                email: 'john.doe@plop.io',
                id: 'ABCDE',
                nom: 'Doe',
                prenom: 'John',
                roles: [],
                structure: 'AVENIR_PRO',
                profil: unProfilFT(Profil.Dispositif.AVENIR_PRO),
                type: 'JEUNE',
                username: undefined
              })
            )
          })
        })
      })
    })
  })
})
