import { ActualiteMilo } from '../../src/domain/milo/actualite.milo'
import { uneDatetime } from './date.fixture'
import { unConseiller } from './conseiller.fixture'

export const uneActualiteMilo = (
  args?: Partial<ActualiteMilo>
): ActualiteMilo => {
  const defaults: ActualiteMilo = {
    id: 'f5a2bc3d-4e1f-6a7b-8c9d-0e1f2a3b4c5d',
    idStructureMilo: 'structure-milo-1',
    idConseiller: unConseiller().id,
    titre: "Titre de l'actualité",
    contenu: "Contenu de l'actualité",
    titreLien: 'En savoir plus',
    lien: 'https://example.com',
    dateCreation: uneDatetime(),
    dateModification: uneDatetime()
  }

  return { ...defaults, ...args }
}
