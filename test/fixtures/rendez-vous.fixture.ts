import {
  CodeTypeRendezVous,
  JeuneDuRendezVous,
  RendezVous
} from '../../src/domain/rendez-vous/rendez-vous'
import {
  desPreferencesJeune,
  unConseillerDuJeune,
  uneConfiguration
} from './jeune.fixture'

export const unRendezVous = (args: Partial<RendezVous> = {}): RendezVous => {
  const defaults: RendezVous = {
    id: '20c8ca73-fd8b-4194-8d3c-80b6c9949deb',
    source: RendezVous.Source.PASS_EMPLOI,
    titre: 'rdv',
    duree: 30,
    modalite: 'modalite',
    date: new Date('2021-11-11T08:03:30.000Z'),
    jeunes: [unJeuneDuRendezVous()],
    commentaire: 'commentaire',
    sousTitre: 'sous titre',
    type: CodeTypeRendezVous.ENTRETIEN_INDIVIDUEL_CONSEILLER,
    presenceConseiller: true,
    adresse: undefined,
    organisme: undefined,
    invitation: undefined,
    icsSequence: undefined,
    dateCloture: undefined,
    idAgence: undefined,
    precision: 'Ceci est une précision',
    createur: {
      id: '1',
      nom: 'Tavernier',
      prenom: 'Nils'
    },
    nombreMaxParticipants: undefined,
    annule: false
  }
  return { ...defaults, ...args }
}

export const uneAnimationCollective = (
  args: Partial<RendezVous.AnimationCollective> = {}
): RendezVous.AnimationCollective => {
  const defaults: RendezVous.AnimationCollective = {
    id: '20c8ca73-fd8b-4194-8d3c-80b6c9949deb',
    source: RendezVous.Source.PASS_EMPLOI,
    titre: 'rdv',
    duree: 30,
    modalite: 'modalite',
    date: new Date('2021-11-11T08:03:30.000Z'),
    jeunes: [unJeuneDuRendezVous()],
    commentaire: 'commentaire',
    sousTitre: 'sous titre',
    type: CodeTypeRendezVous.ATELIER,
    presenceConseiller: true,
    adresse: undefined,
    organisme: undefined,
    invitation: undefined,
    icsSequence: undefined,
    dateCloture: undefined,
    idAgence: undefined,
    precision: 'Ceci est une précision',
    createur: {
      id: '1',
      nom: 'Tavernier',
      prenom: 'Nils'
    },
    nombreMaxParticipants: undefined,
    annule: false
  }
  return { ...defaults, ...args }
}

export const unJeuneDuRendezVous = (
  args: Partial<JeuneDuRendezVous> = {}
): JeuneDuRendezVous => {
  const defaults: JeuneDuRendezVous = {
    id: 'ABCDE',
    firstName: 'John',
    lastName: 'Doe',
    conseiller: unConseillerDuJeune(),
    configuration: uneConfiguration(),
    email: 'john.doe@plop.io',
    preferences: desPreferencesJeune(),
    present: undefined
  }

  return { ...defaults, ...args }
}
