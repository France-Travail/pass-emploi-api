import { ArchiveJeune } from '../../src/domain/archive-jeune'
import { uneDate } from './date.fixture'
import { DateTime } from 'luxon'
import { Profil } from '../../src/domain/profil'

export const uneArchiveJeuneMetadonnees = (
  args: Partial<ArchiveJeune.Metadonnees> = {}
): ArchiveJeune.Metadonnees => {
  const defaults: ArchiveJeune.Metadonnees = {
    idJeune: '1',
    motif: ArchiveJeune.MotifSuppression.CONTRAT_ARRIVE_A_ECHEANCE,
    commentaire: 'Il a loupé un rdv',
    nomJeune: 'test',
    prenomJeune: 'test',
    structure: Profil.Structure.MILO,
    dispositif: Profil.Dispositif.PACEA,
    dateCreation: DateTime.fromJSDate(uneDate()).minus({ month: 1 }).toJSDate(),
    dateArchivage: uneDate()
  }

  return { ...defaults, ...args }
}
