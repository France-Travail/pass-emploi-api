import { reconcilierReferentiel } from 'src/application/jobs/mappers/referentiel-plan-action.mapper'
import { PlanAction } from 'src/domain/plan-action/plan-action'
import { Profil } from 'src/domain/profil'
import {
  GristRecordDto,
  GristServiceFieldsDto,
  GristSolutionFieldsDto
} from 'src/infrastructure/clients/dto/grist.dto'
import { expect } from 'test/utils'

describe('reconcilierReferentiel', () => {
  const serviceOnisep: GristRecordDto<GristServiceFieldsDto> = {
    id: 1,
    fields: { Nom: 'ONISEP', Description: 'site pour trouver une formation' }
  }

  function uneSolutionGrist(
    fields: Partial<GristSolutionFieldsDto> = {}
  ): GristRecordDto<GristSolutionFieldsDto> {
    return {
      id: 1,
      fields: {
        Id_technique: 'p-2',
        Envie: "M'orienter",
        Blocage: '',
        Sous_categorie: "Consulter des sites d'orientation",
        Besoin_exprime_par_le_jeune: 'Je ne sais pas',
        Type: 'Lien web',
        Action_affichee_au_jeune: 'Je consulte des sites',
        URL: 'https://www.onisep.fr/',
        Ecran_de_l_app: '',
        Service: 'ONISEP',
        Situations: 'Au collège; Au lycée',
        Authentification: 'France Travail; Mission Locale; Invité',
        Age_minimum: null,
        Age_maximum: null,
        Territoire: '',
        Domaine: '',
        Conversion_FT_Thematique: 'Mon (nouveau) métier',
        Conversion_FT_Demarche: 'Information sur un métier',
        Conversion_FT_Code_pourquoi: 'P01',
        Conversion_FT_Code_quoi: 'Q02',
        Conversion_ML_Categorie: 'Projet pro',
        Conversion_ML_Code_categorie: 'PROJET_PROFESSIONNEL',
        Conversion_ML_Action: 'Autre',
        Conversion_ML_Origine_de_l_action: 'Référentiel app jeune',
        ...fields
      }
    }
  }

  it('résout le service par son nom et le porte dans la solution', () => {
    // Given
    const solutions = [uneSolutionGrist()]

    // When
    const resultat = reconcilierReferentiel([serviceOnisep], solutions)

    // Then
    expect(resultat.services).to.deep.equal([
      { id: '1', nom: 'ONISEP', description: 'site pour trouver une formation' }
    ])
    expect(resultat.solutions[0].service).to.deep.equal({
      id: '1',
      nom: 'ONISEP',
      description: 'site pour trouver une formation'
    })
    expect(resultat.anomalies.nbServicesNonResolus).to.equal(0)
  })

  it('traduit les énumérations fermées', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Blocage: "Peu d'expérience professionnelle" })]
    )

    // Then
    expect(resultat.solutions[0].type).to.equal(PlanAction.TypeTache.LIEN)
    expect(resultat.solutions[0].besoin).to.equal(PlanAction.Besoin.ORIENTER)
    expect(resultat.solutions[0].contrainte).to.equal(
      PlanAction.Contrainte.PEU_EXPERIENCE
    )
  })

  it('découpe les multivaluées sur le point-virgule en ignorant les espaces', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Territoire: '75;  972 ;' })]
    )

    // Then
    expect(resultat.solutions[0].situations).to.deep.equal([
      'Au collège',
      'Au lycée'
    ])
    expect(resultat.solutions[0].authentifications).to.deep.equal([
      Profil.Structure.FRANCE_TRAVAIL,
      Profil.Structure.MILO,
      Profil.Structure.INVITE
    ])
    expect(resultat.solutions[0].territoires).to.deep.equal(['75', '972'])
  })

  it('normalise les deux conventions de vide vers undefined', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Blocage: '', Domaine: '', Age_minimum: null })]
    )

    // Then
    expect(resultat.solutions[0].contrainte).to.equal(undefined)
    expect(resultat.solutions[0].domaine).to.equal(undefined)
    expect(resultat.solutions[0].ageMin).to.equal(undefined)
  })

  it('mappe une navigation avec son écran', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [
        uneSolutionGrist({
          Type: "Écran de l'app",
          Ecran_de_l_app: 'evenements'
        })
      ]
    )

    // Then
    expect(resultat.solutions[0].type).to.equal(PlanAction.TypeTache.NAVIGATION)
    expect(resultat.solutions[0].ecranApp).to.equal(
      PlanAction.Destination.EVENEMENTS
    )
  })

  it("mappe chacune des cinq valeurs réelles d'écran vers sa destination", () => {
    const casDeTest: Array<[string, PlanAction.Destination]> = [
      ['evenements', PlanAction.Destination.EVENEMENTS],
      ['offres-alternance', PlanAction.Destination.OFFRES_ALTERNANCE],
      ['offres-emploi', PlanAction.Destination.OFFRES_EMPLOI],
      [
        'offres-services-civiques',
        PlanAction.Destination.OFFRES_SERVICE_CIVIQUE
      ],
      ['aller-vers', PlanAction.Destination.ALLER_VERS]
    ]

    for (const [valeurGrist, destinationAttendue] of casDeTest) {
      // When
      const resultat = reconcilierReferentiel(
        [serviceOnisep],
        [
          uneSolutionGrist({
            Type: "Écran de l'app",
            Ecran_de_l_app: valeurGrist
          })
        ]
      )

      // Then
      expect(resultat.solutions[0].ecranApp).to.equal(destinationAttendue)
      expect(resultat.anomalies.nbSolutionsEcartees).to.equal(0)
    }
  })

  it('écarte une navigation sans écran renseigné', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Type: "Écran de l'app", Ecran_de_l_app: '' })]
    )

    // Then
    expect(resultat.solutions).to.deep.equal([])
    expect(resultat.anomalies.nbSolutionsEcartees).to.equal(1)
  })

  it('écarte une navigation vers un écran inconnu', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [
        uneSolutionGrist({
          Type: "Écran de l'app",
          Ecran_de_l_app: 'offres-formation'
        })
      ]
    )

    // Then
    expect(resultat.solutions).to.deep.equal([])
    expect(resultat.anomalies.nbSolutionsEcartees).to.equal(1)
  })

  it('écarte une solution dont le type est inconnu', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Type: 'Podcast' })]
    )

    // Then
    expect(resultat.solutions).to.deep.equal([])
    expect(resultat.anomalies.nbSolutionsEcartees).to.equal(1)
  })

  it('importe sans service une solution dont le nom ne résout rien', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Service: 'ONISEP Orientation' })]
    )

    // Then
    expect(resultat.solutions[0].service).to.equal(undefined)
    expect(resultat.anomalies.nbServicesNonResolus).to.equal(1)
  })

  it("retient l'identifiant de ligne le plus bas quand deux services partagent un nom", () => {
    // Given
    const doublon: GristRecordDto<GristServiceFieldsDto> = {
      id: 7,
      fields: { Nom: 'ONISEP', Description: 'doublon' }
    }

    // When
    const resultat = reconcilierReferentiel(
      [doublon, serviceOnisep],
      [uneSolutionGrist()]
    )

    // Then
    expect(resultat.solutions[0].service!.id).to.equal('1')
    expect(resultat.anomalies.nbDoublonsServices).to.equal(1)
  })

  it("compte et loggue une valeur d'Authentification non reconnue sans écarter la solution", () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [
        uneSolutionGrist({
          Authentification: 'France Travail; Structure Inconnue'
        })
      ]
    )

    // Then
    expect(resultat.solutions).to.have.length(1)
    expect(resultat.solutions[0].authentifications).to.deep.equal([
      Profil.Structure.FRANCE_TRAVAIL
    ])
    expect(resultat.anomalies.nbValeursNonReconnues).to.equal(1)
  })

  it("compte et loggue une valeur d'Envie non reconnue sans écarter la solution", () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Envie: 'Un besoin inexistant' })]
    )

    // Then
    expect(resultat.solutions).to.have.length(1)
    expect(resultat.solutions[0].besoin).to.equal(undefined)
    expect(resultat.anomalies.nbValeursNonReconnues).to.equal(1)
  })

  it('compte et loggue une valeur de Blocage non reconnue sans écarter la solution', () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [uneSolutionGrist({ Blocage: 'Une contrainte inexistante' })]
    )

    // Then
    expect(resultat.solutions).to.have.length(1)
    expect(resultat.solutions[0].contrainte).to.equal(undefined)
    expect(resultat.anomalies.nbValeursNonReconnues).to.equal(1)
  })

  it('résout un service dont le nom Grist porte une espace finale', () => {
    // Given
    const serviceAvecEspace: GristRecordDto<GristServiceFieldsDto> = {
      id: 1,
      fields: { Nom: 'ONISEP ', Description: 'site pour trouver une formation' }
    }

    // When
    const resultat = reconcilierReferentiel(
      [serviceAvecEspace],
      [uneSolutionGrist({ Service: 'ONISEP' })]
    )

    // Then
    expect(resultat.solutions[0].service?.nom).to.equal('ONISEP ')
    expect(resultat.anomalies.nbServicesNonResolus).to.equal(0)
  })

  it("écarte les solutions en doublon d'identifiant technique", () => {
    // Given
    const premiere = uneSolutionGrist()
    const seconde = { id: 9, fields: uneSolutionGrist().fields }

    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [premiere, seconde]
    )

    // Then
    expect(resultat.solutions).to.have.length(1)
    expect(resultat.anomalies.nbDoublonsSolutions).to.equal(1)
  })

  it("reconnaît les trois libellés réels d'Authentification", () => {
    // When
    const resultat = reconcilierReferentiel(
      [serviceOnisep],
      [
        uneSolutionGrist({
          Authentification: 'France Travail; Mission Locale; Invité'
        })
      ]
    )

    // Then
    expect(resultat.solutions[0].authentifications).to.deep.equal([
      Profil.Structure.FRANCE_TRAVAIL,
      Profil.Structure.MILO,
      Profil.Structure.INVITE
    ])
    expect(resultat.anomalies.nbValeursNonReconnues).to.equal(0)
  })
})
