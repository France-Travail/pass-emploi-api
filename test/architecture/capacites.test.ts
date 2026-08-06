import * as fs from 'fs'
import * as path from 'path'
import { expect } from '../utils'

const SRC_APPLICATION = path.join(__dirname, '../../src/application')
const DOSSIERS_SURVEILLES = ['queries', 'commands']

// Angle mort connu et assumé du garde-fou : un handler qui n'injecte AUCUN
// authorizer (ex. GetChatSecretsQueryHandler, `authorize()` retournant
// `emptySuccess()` inconditionnellement) n'apparaît jamais dans la liste des
// fichiers scannés ci-dessous, puisque le critère de détection est la
// présence de `JeuneAuthorizer`. Ce test ne couvre donc que les handlers qui
// délèguent effectivement à `JeuneAuthorizer` — pas les ~24 `authorize()`
// ouverts recensés par ailleurs dans le lot pilote.
// Les deux seuls handlers restants : chacun sert à la fois un jeune et un
// conseiller sur la même route (deux entrées distinctes convergeant vers un
// seul handler), donc pas de valeur unique de capacitesRequises à assigner
// sans les séparer d'abord en deux handlers propres. Traité au commit 5
// dédié — ne pas migrer ni tenter de déclarer capacitesRequises dessus
// entre-temps.
const HANDLERS_NON_MIGRES: readonly string[] = [
  'commands/action/create-action.command.handler.ts',
  'queries/get-comptage-jeune.query.handler.db.ts'
]

function listerLesFichiersTs(dossier: string): string[] {
  const entrees = fs.readdirSync(dossier, { withFileTypes: true })
  return entrees.flatMap(entree => {
    const cheminComplet = path.join(dossier, entree.name)
    if (entree.isDirectory()) {
      return listerLesFichiersTs(cheminComplet)
    }
    if (entree.name.endsWith('.ts') && !entree.name.endsWith('.test.ts')) {
      return [cheminComplet]
    }
    return []
  })
}

function injecteJeuneAuthorizer(contenu: string): boolean {
  return /JeuneAuthorizer/.test(contenu)
}

function declareCapacitesRequises(contenu: string): boolean {
  return /capacitesRequises/.test(contenu)
}

describe('Garde-fou capacités bénéficiaire', () => {
  it('tout handler qui injecte JeuneAuthorizer déclare capacitesRequises, sauf handler explicitement listé comme non migré', () => {
    const fichiersEnDefaut: string[] = []

    for (const dossier of DOSSIERS_SURVEILLES) {
      const fichiers = listerLesFichiersTs(path.join(SRC_APPLICATION, dossier))

      for (const fichier of fichiers) {
        const cheminRelatif = path
          .relative(SRC_APPLICATION, fichier)
          .split(path.sep)
          .join('/')
        const contenu = fs.readFileSync(fichier, 'utf-8')

        if (!injecteJeuneAuthorizer(contenu)) {
          continue
        }
        if (HANDLERS_NON_MIGRES.includes(cheminRelatif)) {
          continue
        }
        if (!declareCapacitesRequises(contenu)) {
          fichiersEnDefaut.push(cheminRelatif)
        }
      }
    }

    expect(fichiersEnDefaut).to.deep.equal([])
  })
})
