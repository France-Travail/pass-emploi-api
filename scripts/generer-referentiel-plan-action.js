// Génère src/infrastructure/plan-action/referentiel-solutions.ts, le
// référentiel « services et solutions » embarqué dans l'API, depuis le
// solutions.json du POC bayesimpact/1jeune-des-solutions
// (apps/api/data/solutions.json, lui-même synchronisé chaque matin depuis le
// back office Grist « Référentiel services et solutions »).
//
//   yarn generer:referentiel-plan-action <chemin/vers/solutions.json>
//
// Seules les colonnes utilisées par la génération déterministe sont
// embarquées. Les invariants du référentiel (ids uniques, envie ou blocage,
// URL sur les liens…) sont vérifiés par
// test/infrastructure/plan-action/catalogue-solutions-statique.test.ts.
const { execFileSync } = require('child_process')
const { readFileSync, writeFileSync } = require('fs')
const path = require('path')

const CHAMPS = [
  'id',
  'category',
  'blocker',
  'situations',
  'auth',
  'minAge',
  'maxAge',
  'territory',
  'kind',
  'label',
  'url',
  'serviceName'
]

const CIBLE = path.join(
  __dirname,
  '..',
  'src',
  'infrastructure',
  'plan-action',
  'referentiel-solutions.ts'
)

const source = process.argv[2]
if (!source) {
  console.error(
    'Usage : yarn generer:referentiel-plan-action <chemin/vers/solutions.json>'
  )
  process.exit(1)
}

const { solutions } = JSON.parse(readFileSync(source, 'utf8'))
const embarquees = solutions.map(solution =>
  Object.fromEntries(CHAMPS.map(champ => [champ, solution[champ] ?? null]))
)

const contenu = `// Référentiel « services et solutions » embarqué au build (aucun appel
// externe au runtime). GÉNÉRÉ par scripts/generer-referentiel-plan-action.js
// depuis apps/api/data/solutions.json du POC bayesimpact/1jeune-des-solutions,
// lui-même synchronisé depuis le back office Grist. NE PAS ÉDITER À LA MAIN.
// L'ordre des lignes est l'ordre du référentiel, servi tel quel aux jeunes.
import { PlanAction } from '../../domain/plan-action'

export const REFERENTIEL_SOLUTIONS: PlanAction.Solution[] = ${JSON.stringify(
  embarquees,
  null,
  2
)}
`

writeFileSync(CIBLE, contenu)
execFileSync('yarn', ['prettier', '--write', CIBLE], { stdio: 'inherit' })
console.log(
  `${embarquees.length} solutions écrites dans ${path.relative(process.cwd(), CIBLE)}`
)
