import { DateTime } from 'luxon'
import { GetActualitesMiloConseillerQueryHandler } from 'src/application/queries/milo/get-actualites-milo-conseiller.query.handler.db'
import { ConseillerAuthorizer } from 'src/application/authorizers/conseiller-authorizer'
import { ActualiteMilo } from 'src/domain/milo/actualite.milo'
import { Conseiller } from 'src/domain/milo/conseiller'
import { uneActualiteMilo } from '../../../fixtures/actualite-milo.fixture'
import { unUtilisateurConseiller } from '../../../fixtures/authentification.fixture'
import { unConseillerMilo } from '../../../fixtures/conseiller-milo.fixture'
import { expect, StubbedClass, stubClass } from '../../../utils'
import {
  emptySuccess,
  failure,
  success
} from 'src/building-blocks/types/result'
import { NonTrouveError } from 'src/building-blocks/types/domain-error'
import { Core } from 'src/domain/core'

describe('GetActualitesMiloConseillerQueryHandler', () => {
  let getActualitesMiloConseillerQueryHandler: GetActualitesMiloConseillerQueryHandler
  let actualiteMiloRepository: StubbedClass<ActualiteMilo.Repository>
  let conseillerMiloRepository: StubbedClass<Conseiller.Milo.Repository>
  let conseillerAuthorizer: StubbedClass<ConseillerAuthorizer>

  const idConseiller = 'conseiller-1'
  const idStructureMilo = 'structure-milo-1'
  const utilisateur = unUtilisateurConseiller({
    id: idConseiller,
    structure: Core.Structure.MILO
  })

  beforeEach(() => {
    actualiteMiloRepository = stubClass(ActualiteMilo.Repository)
    conseillerMiloRepository = stubClass(Conseiller.Milo.Repository)
    conseillerAuthorizer = stubClass(ConseillerAuthorizer)

    getActualitesMiloConseillerQueryHandler =
      new GetActualitesMiloConseillerQueryHandler(
        actualiteMiloRepository,
        conseillerMiloRepository,
        conseillerAuthorizer
      )
  })

  describe('authorize', () => {
    it('autorise le conseiller MILO', async () => {
      // Given
      conseillerAuthorizer.autoriserLeConseiller.resolves(emptySuccess())

      // When
      const result = await getActualitesMiloConseillerQueryHandler.authorize(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result).to.deep.equal(emptySuccess())
      expect(
        conseillerAuthorizer.autoriserLeConseiller
      ).to.have.been.calledOnceWithExactly(idConseiller, utilisateur, true)
    })
  })

  describe('handle', () => {
    it('retourne les actualités de la structure avec le flag proprietaire', async () => {
      // Given
      const conseiller = unConseillerMilo({
        id: idConseiller,
        structure: { id: idStructureMilo }
      })

      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(success(conseiller))

      const actualite1 = uneActualiteMilo({
        id: 'actualite-1',
        idConseiller,
        titre: 'Actualité du conseiller',
        contenu: 'Contenu 1',
        dateCreation: DateTime.fromISO('2024-01-01T10:00:00.000Z')
      })
      const actualite2 = uneActualiteMilo({
        id: 'actualite-2',
        idConseiller: 'autre-conseiller',
        titre: "Actualité d'un autre",
        contenu: 'Contenu 2',
        titreLien: 'En savoir plus',
        lien: 'https://example.com',
        dateCreation: DateTime.fromISO('2024-01-02T10:00:00.000Z')
      })

      actualiteMiloRepository.getByStructureMilo
        .withArgs(idStructureMilo)
        .resolves([actualite1, actualite2])

      // When
      const result = await getActualitesMiloConseillerQueryHandler.handle(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result.actualites).to.have.lengthOf(2)

      // Actualité du conseiller
      expect(result.actualites[0].id).to.equal('actualite-1')
      expect(result.actualites[0].titre).to.equal('Actualité du conseiller')
      expect(result.actualites[0].contenu).to.equal('Contenu 1')
      expect(result.actualites[0].prenomNomConseiller).to.exist()
      expect(result.actualites[0].dateCreation).to.be.a('string')
      expect(result.actualites[0].proprietaire).to.be.true()

      // Actualité d'un autre conseiller
      expect(result.actualites[1].id).to.equal('actualite-2')
      expect(result.actualites[1].titre).to.equal("Actualité d'un autre")
      expect(result.actualites[1].titreLien).to.equal('En savoir plus')
      expect(result.actualites[1].lien).to.equal('https://example.com')
      expect(result.actualites[1].proprietaire).to.be.false()
    })

    it("retourne un tableau vide si le conseiller n'existe pas", async () => {
      // Given
      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(failure(new NonTrouveError('Conseiller', idConseiller)))

      // When
      const result = await getActualitesMiloConseillerQueryHandler.handle(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result.actualites).to.have.lengthOf(0)
      expect(
        actualiteMiloRepository.getByStructureMilo
      ).not.to.have.been.called()
    })

    it("retourne un tableau vide si la structure n'a pas d'actualités", async () => {
      // Given
      const conseiller = unConseillerMilo({
        id: idConseiller,
        structure: { id: idStructureMilo }
      })

      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(success(conseiller))

      actualiteMiloRepository.getByStructureMilo
        .withArgs(idStructureMilo)
        .resolves([])

      // When
      const result = await getActualitesMiloConseillerQueryHandler.handle(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result.actualites).to.have.lengthOf(0)
    })

    it('gère correctement les champs optionnels', async () => {
      // Given
      const conseiller = unConseillerMilo({
        id: idConseiller,
        structure: { id: idStructureMilo }
      })

      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(success(conseiller))

      const actualite = uneActualiteMilo({
        id: 'actualite-1',
        idConseiller,
        titreLien: 'Titre lien',
        lien: 'https://example.com',
        dateSuppression: DateTime.fromISO('2024-03-01T10:00:00.000Z')
      })

      actualiteMiloRepository.getByStructureMilo
        .withArgs(idStructureMilo)
        .resolves([actualite])

      // When
      const result = await getActualitesMiloConseillerQueryHandler.handle(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result.actualites[0].titreLien).to.equal('Titre lien')
      expect(result.actualites[0].lien).to.equal('https://example.com')
      expect(result.actualites[0].dateSuppression).to.be.a('string')
    })

    it('gère les champs optionnels undefined', async () => {
      // Given
      const conseiller = unConseillerMilo({
        id: idConseiller,
        structure: { id: idStructureMilo }
      })

      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(success(conseiller))

      const actualite = uneActualiteMilo({
        id: 'actualite-1',
        idConseiller,
        titreLien: undefined,
        lien: undefined,
        dateSuppression: undefined
      })

      actualiteMiloRepository.getByStructureMilo
        .withArgs(idStructureMilo)
        .resolves([actualite])

      // When
      const result = await getActualitesMiloConseillerQueryHandler.handle(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result.actualites[0].titreLien).to.be.undefined()
      expect(result.actualites[0].lien).to.be.undefined()
      expect(result.actualites[0].dateSuppression).to.be.undefined()
    })

    it('identifie correctement toutes les actualités comme proprietaire si toutes créées par le conseiller', async () => {
      // Given
      const conseiller = unConseillerMilo({
        id: idConseiller,
        structure: { id: idStructureMilo }
      })

      conseillerMiloRepository.get
        .withArgs(idConseiller)
        .resolves(success(conseiller))

      const actualite1 = uneActualiteMilo({
        id: 'actualite-1',
        idConseiller
      })
      const actualite2 = uneActualiteMilo({
        id: 'actualite-2',
        idConseiller
      })

      actualiteMiloRepository.getByStructureMilo
        .withArgs(idStructureMilo)
        .resolves([actualite1, actualite2])

      // When
      const result = await getActualitesMiloConseillerQueryHandler.handle(
        { idConseiller },
        utilisateur
      )

      // Then
      expect(result.actualites).to.have.lengthOf(2)
      expect(result.actualites[0].proprietaire).to.be.true()
      expect(result.actualites[1].proprietaire).to.be.true()
    })
  })
})
