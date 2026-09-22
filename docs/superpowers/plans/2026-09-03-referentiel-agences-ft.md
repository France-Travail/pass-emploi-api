# Référentiel des agences France Travail — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de l'API agences de francetravail.io la source de vérité du référentiel FT, et adosser les régions à une table référentielle, pour que les statistiques régionales cessent d'être fausses.

**Architecture:** Une table `region` clé sur le code émis par FT devient la seule source d'écriture des libellés de région, et `departement.code_region` ferme la chaîne `commune → département → région`. Deux exécutables distincts consomment `referentielagences/v1/agences`. Un **job one-off de réconciliation**, lancé une seule fois à la main, apparie les agences existantes par nom, département, et table de correspondance des renommages/fusions, et leur écrit un `code_safir` — il ne crée ni ne supprime rien. Un **job mensuel** applique ensuite le diff sur les agences `structure = 'POLE_EMPLOI'`, apparié exclusivement par `code_safir` : créations, mises à jour, suppressions avec détachement ou réaffectation des conseillers. *(Révisé le 2026-09-07 : le job mensuel ne refuse plus de démarrer selon un état global de la base — voir la révision post-implémentation.)*

**Tech Stack:** NestJS 11, TypeScript 4.9, Sequelize 6 (+ sequelize-cli pour les migrations), PostgreSQL 14, Bull, Mocha/Chai/Sinon, Nock, Luxon, `remove-accents`.

**Spec:** `docs/superpowers/specs/2026-09-02-referentiel-agences-ft-design.md`

## Global Constraints

- **Périmètre SQL strict** : toute écriture du job filtre `structure = 'POLE_EMPLOI'`. Les 451 lignes `MILO` et les 2 `PASS_EMPLOI` ne sont jamais touchées.
- **Prettier** : `tabWidth: 2`, `semi: false`, `singleQuote: true`, `trailingComma: "none"`, `arrowParens: "avoid"`.
- **Guillemets** : string sans apostrophe → guillemets simples ; string avec apostrophe → guillemets doubles. S'applique aussi aux `it()` / `describe()`.
- **ESLint** : `no-console` (utiliser le logger NestJS), `no-process-env` (utiliser `ConfigService`), `explicit-function-return-type`, `no-explicit-any`.
- **Pas de commentaires explicatifs.** Les marqueurs `// Given` / `// When` / `// Then` dans les tests sont une convention du repo et restent.
- **Résultats métier** : pattern `Result` (`success` / `failure`), jamais d'exception métier.
- **Libellés de région** : les 20 valeurs sont reprises **à l'identique** de celles en base. `evenement_engagement.region` est une copie figée ; une orthographe différente scinde la région dans les dashboards.
- **Tests** : `.test.ts` pour l'unitaire, `.db.test.ts` dès qu'il y a accès base. Lancer `yarn test:local:db` pour les seconds.

## Révision post-implémentation (2026-09-04)

Après exécution complète du plan, un test en conditions réelles (worker + base locale + vraie API FT) a révélé un défaut de conception dans le rôle de `CORRESPONDANCES_AGENCES_FT` (Task 7/9). La table mélange deux natures de cas :

- **17 des 27 entrées sont de purs renommages 1→1** (`CHATEAU-GOMBERT` → `MARSEILLE CHATEAU-GOMBERT`) : c'est la **même** agence, juste rebaptisée par FT — aucune raison de la supprimer.
- **5 sont de vraies fusions n→1** (`CHAMBERY MUDRY` + `CHAMBERY GD VERGER` → `CHAMBERY`) : une des deux lignes doit réellement disparaître.

Le Task 9 tel qu'écrit ne consultait la table que dans le job mensuel, au moment de la suppression — traitant les 17 renommages comme des fusions. Ces 17 agences restaient donc orphelines (`code_safir` nul) pour toujours, la réconciliation ne les appariant jamais par nom.

**Correctif appliqué dans `ReconcilierAgencesFTJobHandler.reconcilier()` (Task 7)** : en plus de l'appariement par nom, toute agence base présente comme clé de `CORRESPONDANCES_AGENCES_FT` est appariée à l'agence FT orpheline portant le `codeSafir` cible — `code_safir`, nom et région sont alors écrits sur sa ligne existante, exactement comme un appariement par nom. Pour une fusion n→1, seule la première agence rencontrée réclame le `codeSafir` (contrainte d'unicité) ; l'autre reste orpheline et suit le chemin suppression + réaffectation du job mensuel, inchangé. Un log ECS `agence_ft_renommee` trace chaque appariement par correspondance.

Effet sur les 36 orphelines mesurées le 2026-09-03, **vérifié par un dry-run réel en local le 2026-09-04** : `nbAppariees` passe de 858 à **880**, `nbOrphelinesFT` de 27 à **5**, `nbOrphelinesBase` de 36 à **14**. Le détail des 22 résolues : les 17 renommages 1→1 (tous gagnent), plus 1 gagnant par fusion sur les 5 fusions n→1 — soit 17+5=22. Les 14 qui restent orphelines : les 5 perdants des fusions (leur ligne sera supprimée par le job mensuel, conseillers réaffectés au gagnant via la même table) et les 9 vraies fermetures sans successeur (`556` MIRIBEL, `1235`, `621`, `1180`, `797`, `762`, `1001`, `1008`, `845` MILLEVOYE). Les chiffres de plafond et de mise en service ci-dessous (à l'origine calculés sur 36) sont à relire à la lumière de ces 14 — voir la section Mise en service, mise à jour en conséquence.

## Révision post-implémentation (2026-09-07)

En lançant réellement le job mensuel en dry-run juste après la réconciliation
corrigée ci-dessus (14 orphelines résiduelles, comme attendu), il a immédiatement
refusé de démarrer : `"14 agences sans code SAFIR : lancer TASK_NAME=RECONCILIER_AGENCES_FT
avant"`. Ce message était pourtant exact — la réconciliation venait de tourner. Le
garde-fou de la Task 8 (« refuse tant qu'une agence `POLE_EMPLOI` a `code_safir IS
NULL` ») décrit dans le paragraphe **Le garde-fou qui remplace la détection de mode**
plus bas s'avère être un verrou permanent : ces 14 lignes ne recevront **jamais** de
`code_safir` via la réconciliation (5 perdants de fusion, 9 fermetures sans
successeur), donc ce compte ne peut jamais retomber à zéro. Le job mensuel ne pouvait
plus jamais démarrer, dry-run ou pas.

**Analyse.** Le garde-fou visait à empêcher un run du job mensuel sur une base jamais
réconciliée (894 lignes à `code_safir` nul), où il aurait vu les 894 comme absentes
du référentiel FT et tenté de tout supprimer. Ce scénario est déjà couvert par le
**plafond** de `appliquerDiff` : sur une base jamais réconciliée, `aSupprimer`
contiendrait les 894 lignes, très au-delà de `max(5, 2 %)` ≈ 17, et le plafond
refuserait — avec un message plus informatif de surcroît (`aSupprimer.length` réel
plutôt qu'un simple compte de lignes nulles). Le garde-fou faisait donc doublon avec
un mécanisme qui protège déjà contre le même scénario, sans jamais s'assouplir pour
l'état stable et voulu (un résidu d'agences non reconciliables en permanence).

**Correctif** : le garde-fou est supprimé. `appliquerDiff` traite désormais une
agence à `code_safir` nul exactement comme une agence dont le `code_safir` ne
correspond à aucune entrée de la réponse FT du jour — candidate à la suppression,
réaffectée via `CORRESPONDANCES_AGENCES_FT` si une entrée existe, détachée sinon. Le
plafond reste l'unique protection contre une suppression massive.

**Correctif complémentaire (même jour) : dry-run muet.** Une fois le garde-fou
retiré, le dry-run du job mensuel a été rejoué en local — succès, mais toutes les
stats (`nbCreees`, `nbMisesAJour`, `nbSupprimees`, `nbConseillersDetaches`,
`nbConseillersReaffectes`) à zéro. `appliquerDiff` faisait `if (config.dryRun) return`
juste après la vérification du plafond, avant d'avoir jamais calculé ce qu'il aurait
fait — contrairement au job de réconciliation, dont le dry-run calcule et rapporte
ses stats avant de s'arrêter. Corrigé : le calcul des créations/mises à jour (déjà
pur, sans I/O) et des suppressions/réaffectations/détachements (nécessite de compter
les conseillers par agence, en lecture seule) se fait désormais avant le
`if (dryRun) return`. La transaction d'écriture réutilise ces calculs au lieu de les
refaire, pour ne jamais compter deux fois.

---

### Task 1: Table `region`

**Files:**
- Create: `src/infrastructure/sequelize/seeders/data/regions.json`
- Create: `src/infrastructure/sequelize/migrations/20260903000000-creer-table-region.js`
- Create: `src/infrastructure/sequelize/models/region.sql-model.ts`
- Modify: `src/infrastructure/sequelize/models/index.ts`
- Modify: `src/infrastructure/sequelize/seeders/1-referentiel-communes-et-departements.js`
- Create: `test/fixtures/sql-models/region.sql-model.ts`
- Test: `test/infrastructure/sequelize/seeders/regions.test.ts`
- Test: `test/infrastructure/sequelize/models/region.sql-model.db.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `RegionSqlModel` (table `region`, colonnes `code` PK STRING, `libelle` STRING NOT NULL), `RegionDto`, la fixture `uneRegionDto(args?: Partial<AsSql<RegionDto>>): AsSql<RegionDto>`, et le fichier de données `regions.json` que la migration, le seeder et les tests partagent.

Les données de référence vivent dans un JSON de `seeders/data/`, comme `departements.json` et `agences_pe.json`. C'est nécessaire : `getDatabase().cleanPG()` fait un `truncate({ cascade: true })` sur **toutes** les tables, donc aucun test ne peut observer les données insérées par une migration. Les invariants du référentiel se testent sur le JSON, la mécanique SQL se teste avec des fixtures.

- [ ] **Step 1: Écrire le test d'invariants qui échoue**

`test/infrastructure/sequelize/seeders/regions.test.ts` :

```typescript
import * as agencesPE from 'src/infrastructure/sequelize/seeders/data/agences_pe.json'
import * as regions from 'src/infrastructure/sequelize/seeders/data/regions.json'
import { expect } from 'test/utils'

describe('referentiel des regions', () => {
  it('couvre 20 regions aux codes uniques', () => {
    // When
    const codes = regions.map(region => region.code)

    // Then
    expect(regions.length).to.equal(20)
    expect(new Set(codes).size).to.equal(20)
  })

  it('reprend exactement les libelles deja stockes sur les agences FT', () => {
    // Given
    const libellesFT = new Set(agencesPE.map(agence => agence.nom_region))

    // When
    const libellesReferentiel = new Set(regions.map(region => region.libelle))
    const manquants = [...libellesFT].filter(
      libelle => !libellesReferentiel.has(libelle)
    )
    const enTrop = [...libellesReferentiel].filter(
      libelle => !libellesFT.has(libelle)
    )

    // Then
    expect(manquants).to.deep.equal([])
    expect(enTrop).to.deep.equal(['Saint-Martin'])
  })
})
```

Le second test est celui qui compte : `evenement_engagement.region` est une copie figée des libellés, une divergence d'un seul caractère scinderait la région dans les dashboards. Il vérifie qu'aucun libellé porté par les 894 agences FT ne manque au référentiel, et que le seul ajout est `Saint-Martin` — la liste des extras est assertée nominativement, pour qu'un futur ajout non justifié fasse échouer le test au lieu de passer sous le radar.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `yarn test:local:unit --grep "referentiel des regions"`
Expected: FAIL — `Cannot find module '.../seeders/data/regions.json'`

- [ ] **Step 3: Écrire les données de référence**

`src/infrastructure/sequelize/seeders/data/regions.json` :

```json
[
  { "code": "01", "libelle": "Guadeloupe" },
  { "code": "02", "libelle": "Martinique" },
  { "code": "03", "libelle": "Guyane" },
  { "code": "04", "libelle": "La Réunion" },
  { "code": "05", "libelle": "Saint-Pierre-et-Miquelon" },
  { "code": "06", "libelle": "Mayotte" },
  { "code": "10", "libelle": "Saint-Martin" },
  { "code": "11", "libelle": "Île-de-France" },
  { "code": "24", "libelle": "Centre-Val de Loire" },
  { "code": "27", "libelle": "Bourgogne-Franche-Comté" },
  { "code": "28", "libelle": "Normandie" },
  { "code": "32", "libelle": "Hauts-de-France" },
  { "code": "44", "libelle": "Grand Est" },
  { "code": "52", "libelle": "Pays de la Loire" },
  { "code": "53", "libelle": "Bretagne" },
  { "code": "75", "libelle": "Nouvelle-Aquitaine" },
  { "code": "76", "libelle": "Occitanie" },
  { "code": "84", "libelle": "Auvergne-Rhône-Alpes" },
  { "code": "93", "libelle": "Provence-Alpes-Côte d'Azur" },
  { "code": "94", "libelle": "Corse" }
]
```

Dix-neuf de ces couples sont dérivés des 858 agences appariées entre le dump FT du 2026-09-03 et la base de staging : chaque `codeRegionINSEE` ne s'associe qu'à un seul `nom_region`, sans aucun conflit.

Le vingtième, `10 Saint-Martin`, ne vient pas de FT mais de MILO : la base porte une agence `97801S00` et une `structure_milo` en `code_region = '10'`. FT n'a aucune agence à Saint-Martin, donc le code n'apparaît pas dans son dump. Sans lui, la clé étrangère de la Task 10 rejetterait cette ligne. Le libellé retenu est `Saint-Martin` (avec traits d'union, comme `Saint-Pierre-et-Miquelon` chez FT) et non `Saint Martin` tel que stocké aujourd'hui : le référentiel tranche l'orthographe, et la Task 10 réaligne la ligne existante.

- [ ] **Step 4: Lancer le test d'invariants**

Run: `yarn test:local:unit --grep "referentiel des regions"`
Expected: PASS (2 tests)

- [ ] **Step 5: Écrire la migration**

`src/infrastructure/sequelize/migrations/20260903000000-creer-table-region.js` :

```javascript
'use strict'

const regions = require('../seeders/data/regions.json')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.createTable(
        'region',
        {
          code: {
            type: Sequelize.STRING,
            primaryKey: true,
            allowNull: false
          },
          libelle: {
            type: Sequelize.STRING,
            allowNull: false
          }
        },
        { transaction }
      )
      await queryInterface.bulkInsert('region', regions, { transaction })
    })
  },

  async down(queryInterface) {
    await queryInterface.dropTable('region')
  }
}
```

- [ ] **Step 6: Écrire le modèle Sequelize**

`src/infrastructure/sequelize/models/region.sql-model.ts` :

```typescript
import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table
} from 'sequelize-typescript'

export class RegionDto extends Model {
  @PrimaryKey
  @Column({ field: 'code', type: DataType.STRING })
  code!: string

  @Column({ field: 'libelle', type: DataType.STRING })
  libelle!: string
}

@Table({ timestamps: false, tableName: 'region' })
export class RegionSqlModel extends RegionDto {}
```

- [ ] **Step 7: Enregistrer le modèle**

Dans `src/infrastructure/sequelize/models/index.ts`, ajouter l'import à côté de celui de `AgenceSqlModel` :

```typescript
import { RegionSqlModel } from './region.sql-model'
```

puis `RegionSqlModel,` dans la liste passée à `sequelize.addModels(...)`.

- [ ] **Step 8: Alimenter le seeder**

Dans `src/infrastructure/sequelize/seeders/1-referentiel-communes-et-departements.js`, requérir le JSON en tête :

```javascript
const regions = require('./data/regions.json')
```

puis insérer les régions **avant** les départements dans le `up` (l'ordre compte : `departement.code_region` référencera `region.code` à la Task 2) :

```javascript
        await queryInterface.bulkInsert('region', regions)
```

et les supprimer **après** eux dans le `down` :

```javascript
        await queryInterface.bulkDelete('region', null, {})
```

- [ ] **Step 9: Écrire la fixture**

`test/fixtures/sql-models/region.sql-model.ts` :

```typescript
import { RegionDto } from '../../../src/infrastructure/sequelize/models/region.sql-model'
import { AsSql } from '../../../src/infrastructure/sequelize/types'

export function uneRegionDto(
  args: Partial<AsSql<RegionDto>> = {}
): AsSql<RegionDto> {
  const defaults: AsSql<RegionDto> = {
    code: '84',
    libelle: 'Auvergne-Rhône-Alpes'
  }
  return { ...defaults, ...args }
}
```

- [ ] **Step 10: Écrire le test de la table**

`test/infrastructure/sequelize/models/region.sql-model.db.test.ts` :

```typescript
import { RegionSqlModel } from 'src/infrastructure/sequelize/models/region.sql-model'
import { uneRegionDto } from 'test/fixtures/sql-models/region.sql-model'
import { expect } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('RegionSqlModel', () => {
  beforeEach(async () => {
    await getDatabase().cleanPG()
  })

  it('persiste un code et un libelle', async () => {
    // When
    await RegionSqlModel.create(
      uneRegionDto({ code: '11', libelle: 'Île-de-France' })
    )

    // Then
    const region = await RegionSqlModel.findByPk('11')
    expect(region!.libelle).to.equal('Île-de-France')
  })

  it('refuse deux regions de meme code', async () => {
    // Given
    await RegionSqlModel.create(uneRegionDto({ code: '11' }))

    // When
    const promesse = RegionSqlModel.create(uneRegionDto({ code: '11' }))

    // Then
    await expect(promesse).to.be.rejected()
  })
})
```

- [ ] **Step 11: Lancer les tests**

Run: `yarn test:local:db --grep "RegionSqlModel"`
Expected: PASS (2 tests)

- [ ] **Step 12: Commit**

```bash
git add src/infrastructure/sequelize/seeders/data/regions.json \
        src/infrastructure/sequelize/seeders/1-referentiel-communes-et-departements.js \
        src/infrastructure/sequelize/migrations/20260903000000-creer-table-region.js \
        src/infrastructure/sequelize/models/region.sql-model.ts \
        src/infrastructure/sequelize/models/index.ts \
        test/fixtures/sql-models/region.sql-model.ts \
        test/infrastructure/sequelize/seeders/regions.test.ts \
        test/infrastructure/sequelize/models/region.sql-model.db.test.ts
git commit -m "feat: table referentielle des regions"
```

---

### Task 2: Chaîne département → région

**Files:**
- Create: `src/infrastructure/sequelize/seeders/data/departements_regions.json`
- Create: `src/infrastructure/sequelize/migrations/20260903000001-departement-code-region.js`
- Modify: `src/infrastructure/sequelize/models/departement.sql-model.ts`
- Modify: `src/infrastructure/sequelize/seeders/1-referentiel-communes-et-departements.js`
- Modify: `test/fixtures/sql-models/departement.sql-model.ts`
- Test: `test/infrastructure/sequelize/seeders/departements-regions.test.ts`
- Test: `test/infrastructure/sequelize/models/departement.sql-model.db.test.ts`

**Interfaces:**
- Consumes: `regions.json` et la table `region` (Task 1).
- Produces: `DepartementDto.codeRegion: string` (colonne `code_region`, NOT NULL, FK vers `region.code`), le fichier `departements_regions.json` (104 entrées `{ code, libelle, code_region }`), et les lignes `975` / `977` / `978` dans `departement`.

Les départements `975` (Saint-Pierre-et-Miquelon), `977` (Saint-Barthélemy) et `978` (Saint-Martin) sont référencés par `commune` mais absents de `departement` : la jointure `commune → departement` échoue aujourd'hui pour eux. Le nouveau fichier remplace `departements.json` comme source du seeder, en y ajoutant `code_region` et ces trois lignes.

- [ ] **Step 1: Écrire le test d'invariants qui échoue**

`test/infrastructure/sequelize/seeders/departements-regions.test.ts` :

```typescript
import * as communes from 'src/infrastructure/sequelize/seeders/data/communes.json'
import * as departementsRegions from 'src/infrastructure/sequelize/seeders/data/departements_regions.json'
import * as departements from 'src/infrastructure/sequelize/seeders/data/departements.json'
import * as regions from 'src/infrastructure/sequelize/seeders/data/regions.json'
import { expect } from 'test/utils'

describe('rattachement des departements aux regions', () => {
  it('couvre les 101 departements historiques plus les trois manquants', () => {
    // Given
    const codes = new Set(departementsRegions.map(d => d.code))

    // Then
    expect(departementsRegions.length).to.equal(104)
    for (const departement of departements) {
      expect(codes.has(departement.code)).to.equal(true)
    }
    expect(codes.has('975')).to.equal(true)
    expect(codes.has('977')).to.equal(true)
    expect(codes.has('978')).to.equal(true)
  })

  it('rattache chaque departement a une region existante', () => {
    // Given
    const codesRegion = new Set(regions.map(region => region.code))

    // Then
    for (const departement of departementsRegions) {
      expect(codesRegion.has(departement.code_region)).to.equal(true)
    }
  })

  it('ne laisse hors referentiel que les territoires sans agence', () => {
    // Given
    const codes = new Set(departementsRegions.map(d => d.code))

    // When
    const nonCouverts = [
      ...new Set(communes.map(commune => commune.code_departement))
    ]
      .filter(code => !codes.has(code))
      .sort()

    // Then
    expect(nonCouverts).to.deep.equal(['986', '987', '988', '989', '99'])
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `yarn test:local:unit --grep "rattachement des departements"`
Expected: FAIL — `Cannot find module '.../departements_regions.json'`

- [ ] **Step 3: Générer le fichier de données**

Exécuter depuis la racine du repo :

```bash
node -e "
const fs = require('fs')
const departements = require('./src/infrastructure/sequelize/seeders/data/departements.json')
const MANQUANTS = [
  { code: '975', libelle: 'Saint-Pierre-et-Miquelon' },
  { code: '977', libelle: 'Saint-Barthélemy' },
  { code: '978', libelle: 'Saint-Martin' }
]
const REGION = {
  '01':'84','02':'32','03':'84','04':'93','05':'93','06':'93','07':'84','08':'44',
  '09':'76','10':'44','11':'76','12':'76','13':'93','14':'28','15':'84','16':'75',
  '17':'75','18':'24','19':'75','21':'27','22':'53','23':'75','24':'75','25':'27',
  '26':'84','27':'28','28':'24','29':'53','2A':'94','2B':'94','30':'76','31':'76',
  '32':'76','33':'75','34':'76','35':'53','36':'24','37':'24','38':'84','39':'27',
  '40':'75','41':'24','42':'84','43':'84','44':'52','45':'24','46':'76','47':'75',
  '48':'76','49':'52','50':'28','51':'44','52':'44','53':'52','54':'44','55':'44',
  '56':'53','57':'44','58':'27','59':'32','60':'32','61':'28','62':'32','63':'84',
  '64':'75','65':'76','66':'76','67':'44','68':'44','69':'84','70':'27','71':'27',
  '72':'52','73':'84','74':'84','75':'11','76':'28','77':'11','78':'11','79':'75',
  '80':'32','81':'76','82':'76','83':'93','84':'93','85':'52','86':'75','87':'75',
  '88':'44','89':'27','90':'27','91':'11','92':'11','93':'11','94':'11','95':'11',
  '971':'01','972':'02','973':'03','974':'04','975':'05','976':'06',
  '977':'01','978':'01'
}
const tous = [...departements, ...MANQUANTS].map(d => ({
  code: d.code,
  libelle: d.libelle,
  code_region: REGION[d.code]
}))
const sansRegion = tous.filter(d => !d.code_region)
if (sansRegion.length) throw new Error('sans region: ' + JSON.stringify(sansRegion))
fs.writeFileSync(
  './src/infrastructure/sequelize/seeders/data/departements_regions.json',
  JSON.stringify(tous, null, 2) + '\n'
)
console.log(tous.length + ' departements ecrits')
"
```

Expected: `104 departements ecrits`

Les 101 correspondances métropolitaines et DOM sont dérivées des 858 paires appariées — `communeImplantation` → `commune` → département d'un côté, `codeRegionINSEE` de l'autre — sans aucun conflit.

Les trois autres viennent de la table `commune`. Celle-ci référence **huit** codes absents de `departement` — `975`, `977`, `978`, `986`, `987`, `988`, `989` et `99` — pour lesquels la jointure `commune → departement` échoue aujourd'hui. Seuls les trois premiers sont repris.

Les cinq autres sont Wallis-et-Futuna, la Polynésie française, la Nouvelle-Calédonie, Clipperton et Monaco (sous le pseudo-code `99`). **Aucun n'a d'agence FT ni MILO**, aucun n'a de code de région chez FT, et Monaco n'est pas un territoire français. Les couvrir obligerait à inventer cinq codes de région dans un référentiel dont l'autorité est FT — pour des communes qui ne peuvent jamais être la commune d'implantation d'une agence. Le troisième test assère donc que le reste à découvert est **exactement** cette liste, nommément : un nouveau code non couvert fera échouer le test au lieu de passer inaperçu.

Rattachement des trois repris :

| Département | Région | Origine |
|---|---|---|
| `975` Saint-Pierre-et-Miquelon | `05` | FT, agence safir `97003` |
| `978` Saint-Martin | `01` Guadeloupe | FT, agence safir `97010` |
| `977` Saint-Barthélemy | `01` Guadeloupe | **arbitrage** — aucune agence, aucune source |

**Le cas Saint-Martin est un conflit de sources, pas un choix libre.** FT rattache son agence de Saint-Martin à la région `01` (Guadeloupe). MILO, pour la sienne, utilise un code `10` « Saint Martin » qui n'existe nulle part chez FT. Les deux agences du même territoire déclarent donc deux régions différentes.

Le rattachement du département suit **FT**, source de vérité actée. La région `10` reste néanmoins au référentiel : la ligne MILO la porte, et la clé étrangère de la Task 10 la rejetterait sinon. Aucun département ne pointe vers elle — c'est une région que seule MILO utilise.

Unifier demanderait de réécrire le `code_region` de l'agence MILO, donc de toucher l'alimentation MILO, explicitement hors périmètre. À arbitrer séparément.

`977` est le seul rattachement qu'aucune donnée ne dicte : ni FT ni MILO n'y ont d'agence. Le rattachement à la Guadeloupe suit l'appartenance administrative d'avant 2007 et ne concerne qu'une commune sans agence.

- [ ] **Step 4: Lancer le test d'invariants**

Run: `yarn test:local:unit --grep "rattachement des departements"`
Expected: PASS (3 tests)

- [ ] **Step 5: Écrire la migration**

`src/infrastructure/sequelize/migrations/20260903000001-departement-code-region.js` :

```javascript
'use strict'

const departementsRegions = require('../seeders/data/departements_regions.json')

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.bulkInsert(
        'departement',
        departementsRegions
          .filter(d => ['975', '977', '978'].includes(d.code))
          .map(d => ({ code: d.code, libelle: d.libelle })),
        { transaction }
      )

      await queryInterface.addColumn(
        'departement',
        'code_region',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      )

      for (const departement of departementsRegions) {
        await queryInterface.sequelize.query(
          'UPDATE departement SET code_region = :codeRegion WHERE code = :code',
          {
            replacements: {
              codeRegion: departement.code_region,
              code: departement.code
            },
            type: Sequelize.QueryTypes.UPDATE,
            transaction
          }
        )
      }

      await queryInterface.changeColumn(
        'departement',
        'code_region',
        {
          type: Sequelize.STRING,
          allowNull: false,
          references: { model: 'region', key: 'code' }
        },
        { transaction }
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.removeColumn('departement', 'code_region', {
        transaction
      })
      await queryInterface.bulkDelete(
        'departement',
        { code: ['975', '977', '978'] },
        { transaction }
      )
    })
  }
}
```

- [ ] **Step 6: Ajouter la colonne au modèle**

Dans `src/infrastructure/sequelize/models/departement.sql-model.ts`, ajouter après `libelle` :

```typescript
  @Column({ field: 'code_region', type: DataType.STRING })
  codeRegion!: string
```

- [ ] **Step 7: Basculer le seeder sur le nouveau fichier**

Dans `src/infrastructure/sequelize/seeders/1-referentiel-communes-et-departements.js`, remplacer `require('./data/departements.json')` par `require('./data/departements_regions.json')`, de sorte qu'une base fraîchement seedée porte les 103 départements avec leur région.

- [ ] **Step 8: Mettre la fixture à jour**

Dans `test/fixtures/sql-models/departement.sql-model.ts`, ajouter `codeRegion: '84'` aux `defaults`.

- [ ] **Step 9: Écrire le test de la colonne**

`test/infrastructure/sequelize/models/departement.sql-model.db.test.ts` :

```typescript
import { DepartementSqlModel } from 'src/infrastructure/sequelize/models/departement.sql-model'
import { RegionSqlModel } from 'src/infrastructure/sequelize/models/region.sql-model'
import { unDepartementDto } from 'test/fixtures/sql-models/departement.sql-model'
import { uneRegionDto } from 'test/fixtures/sql-models/region.sql-model'
import { expect } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('DepartementSqlModel', () => {
  beforeEach(async () => {
    await getDatabase().cleanPG()
    await RegionSqlModel.create(uneRegionDto({ code: '84' }))
  })

  it('rattache un departement a une region', async () => {
    // When
    await DepartementSqlModel.create(
      unDepartementDto({ code: '69', libelle: 'Rhône', codeRegion: '84' })
    )

    // Then
    const departement = await DepartementSqlModel.findByPk('69')
    expect(departement!.codeRegion).to.equal('84')
  })

  it('refuse un departement rattache a une region inexistante', async () => {
    // When
    const promesse = DepartementSqlModel.create(
      unDepartementDto({ code: '69', codeRegion: 'ZZ' })
    )

    // Then
    await expect(promesse).to.be.rejected()
  })
})
```

- [ ] **Step 10: Lancer les tests**

Run: `yarn test:local:db --grep "DepartementSqlModel"`
Expected: PASS (2 tests)

- [ ] **Step 11: Vérifier qu'aucun test existant ne casse**

Run: `yarn test:local:db`
Expected: PASS — la fixture `unDepartementDto` ayant gagné un champ obligatoire, tout appelant doit encore compiler.

- [ ] **Step 12: Commit**

```bash
git add src/infrastructure/sequelize/seeders/data/departements_regions.json \
        src/infrastructure/sequelize/seeders/1-referentiel-communes-et-departements.js \
        src/infrastructure/sequelize/migrations/20260903000001-departement-code-region.js \
        src/infrastructure/sequelize/models/departement.sql-model.ts \
        test/fixtures/sql-models/departement.sql-model.ts \
        test/infrastructure/sequelize/seeders/departements-regions.test.ts \
        test/infrastructure/sequelize/models/departement.sql-model.db.test.ts
git commit -m "feat: rattacher les departements a une region"
```

---

### Task 3: Correction du code département des agences corses

**Files:**
- Modify: `src/infrastructure/sequelize/seeders/data/agences_pe.json`
- Create: `src/infrastructure/sequelize/migrations/20260903000002-corriger-departement-agences-corses.js`
- Test: `test/infrastructure/sequelize/seeders/agences-corses.test.ts`

**Interfaces:**
- Consumes: `departements_regions.json` (Task 2), pour vérifier que les codes corrigés existent bien.
- Produces: les 7 agences corses portent `code_departement` `2A` ou `2B` au lieu de `20`.

`agence.code_departement` vaut `'20'` pour les 7 agences corses, alors que `departement` et `commune` ne connaissent que `2A` et `2B`. La jointure échoue donc aujourd'hui, et l'appariement du job échouerait aussi. La répartition est dérivée du `communeImplantation` renvoyé par FT : `2A247` Porto-Vecchio, `2A249` Propriano, `2A004` Ajaccio d'un côté ; `2B033` Bastia, `2B096` Corte, `2B123` Plaine Orientale, `2B134` Ile Rousse de l'autre.

- [ ] **Step 1: Écrire le test qui échoue**

`test/infrastructure/sequelize/seeders/agences-corses.test.ts` :

```typescript
import * as agencesPE from 'src/infrastructure/sequelize/seeders/data/agences_pe.json'
import * as departementsRegions from 'src/infrastructure/sequelize/seeders/data/departements_regions.json'
import { expect } from 'test/utils'

describe('departement des agences corses', () => {
  it("n'utilise plus le code departement 20", () => {
    // When
    const enVingt = agencesPE.filter(
      agence => String(agence.code_departement) === '20'
    )

    // Then
    expect(enVingt).to.deep.equal([])
  })

  it('repartit les sept agences corses entre 2A et 2B', () => {
    // When
    const corseDuSud = agencesPE.filter(a => a.code_departement === '2A')
    const hauteCorse = agencesPE.filter(a => a.code_departement === '2B')

    // Then
    expect(corseDuSud.map(a => a.id)).to.deep.equal([681, 682, 683])
    expect(hauteCorse.map(a => a.id)).to.deep.equal([684, 685, 686, 687])
  })

  it('rattache chaque agence a un departement du referentiel', () => {
    // Given
    const codes = new Set(departementsRegions.map(d => d.code))

    // When
    const inconnus = [
      ...new Set(agencesPE.map(a => String(a.code_departement).padStart(2, '0')))
    ].filter(code => !codes.has(code))

    // Then
    expect(inconnus).to.deep.equal([])
  })
})
```

Le troisième test dépasse la Corse : il vérifie qu'**aucune** des 894 agences ne pointe vers un département absent du référentiel.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `yarn test:local:unit --grep "departement des agences corses"`
Expected: FAIL — 7 agences en `20`, aucune en `2A`/`2B`.

- [ ] **Step 3: Corriger le fichier de données**

Exécuter depuis la racine du repo :

```bash
node -e "
const fs = require('fs')
const chemin = './src/infrastructure/sequelize/seeders/data/agences_pe.json'
const agences = require(chemin)
const CORSE_DU_SUD = [681, 682, 683]
const HAUTE_CORSE = [684, 685, 686, 687]
for (const agence of agences) {
  if (CORSE_DU_SUD.includes(agence.id)) agence.code_departement = '2A'
  if (HAUTE_CORSE.includes(agence.id)) agence.code_departement = '2B'
}
const restants = agences.filter(a => String(a.code_departement) === '20')
if (restants.length) throw new Error('agences encore en 20: ' + restants.length)
fs.writeFileSync(chemin, JSON.stringify(agences, null, 2) + '\n')
console.log('agences corses corrigees')
"
```

Expected: `agences corses corrigees`

- [ ] **Step 4: Lancer le test**

Run: `yarn test:local:unit --grep "departement des agences corses"`
Expected: PASS (3 tests)

- [ ] **Step 5: Écrire la migration**

`src/infrastructure/sequelize/migrations/20260903000002-corriger-departement-agences-corses.js` :

```javascript
'use strict'

const CORSE_DU_SUD = ['681', '682', '683']
const HAUTE_CORSE = ['684', '685', '686', '687']

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        "UPDATE agence SET code_departement = '2A' WHERE id IN (:ids)",
        {
          replacements: { ids: CORSE_DU_SUD },
          type: Sequelize.QueryTypes.UPDATE,
          transaction
        }
      )
      await queryInterface.sequelize.query(
        "UPDATE agence SET code_departement = '2B' WHERE id IN (:ids)",
        {
          replacements: { ids: HAUTE_CORSE },
          type: Sequelize.QueryTypes.UPDATE,
          transaction
        }
      )
    })
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      "UPDATE agence SET code_departement = '20' WHERE id IN (:ids)",
      {
        replacements: { ids: [...CORSE_DU_SUD, ...HAUTE_CORSE] },
        type: Sequelize.QueryTypes.UPDATE
      }
    )
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/sequelize/seeders/data/agences_pe.json \
        src/infrastructure/sequelize/migrations/20260903000002-corriger-departement-agences-corses.js \
        test/infrastructure/sequelize/seeders/agences-corses.test.ts
git commit -m "fix: code departement des agences corses en 2A/2B"
```

---

### Task 4: Lookup région côté MILO

**Files:**
- Modify: `src/domain/milo/conseiller.milo.db.ts:183-197`
- Test: `test/domain/milo/conseiller.milo.db.test.ts`

**Interfaces:**
- Consumes: `RegionSqlModel` (Task 1).
- Produces: rien de nouveau — supprime les rustines et fiabilise `agence.nomRegion` côté MILO.

Aujourd'hui le libellé de région d'une agence MILO est obtenu par chirurgie de chaîne : `substring(0, 20)` pour retirer `'Structure régionale '`, puis deux corrections en dur (`'Grand-Est'` → `'Grand Est'`, `"Provence-Alpes-Côte-d'Azur"` → `"Provence-Alpes-Côte d'Azur"`). Rien ne garantit qu'il n'existe pas d'autres écarts. Le lookup sur `region` supprime la classe entière de bugs.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `test/domain/milo/conseiller.milo.db.test.ts` :

```typescript
    it('prend le libelle de region dans le referentiel plutot que dans la structure', async () => {
      // Given
      await RegionSqlModel.create(
        uneRegionDto({ code: '52', libelle: 'Pays de la Loire' })
      )
      await StructureMiloSqlModel.create(
        uneStructureMiloDto({
          id: 'STRUCTURE-DEPT',
          codeDepartement: '44',
          codeRegion: '52',
          nomRegion: 'Structure régionale Pays-de-la-Loire'
        })
      )

      // When
      await repository.save(unConseillerMilo({ idStructure: 'NOUVELLE' }))

      // Then
      const agence = await AgenceSqlModel.findByPk('NOUVELLE')
      expect(agence!.nomRegion).to.equal('Pays de la Loire')
    })
```

Le libellé stocké dans `structure_milo` (`Pays-de-la-Loire`, avec tirets) diffère volontairement de celui du référentiel (`Pays de la Loire`) : c'est ce qui prouve que le lookup gagne. La région doit être créée explicitement, `cleanPG()` ayant vidé la table.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `yarn test:local:db --grep "referentiel plutot que dans la structure"`
Expected: FAIL — `expected 'Pays-de-la-Loire' to equal 'Pays de la Loire'`

- [ ] **Step 3: Remplacer les rustines par le lookup**

Dans `src/domain/milo/conseiller.milo.db.ts`, supprimer le bloc `TAILLE_PREFIX_REGION` et les deux `if` de correction, et les remplacer par :

```typescript
        const regionSql = structureDansLeDepartementSql.codeRegion
          ? await RegionSqlModel.findByPk(
              structureDansLeDepartementSql.codeRegion
            )
          : null
        const nomRegion = regionSql?.libelle ?? null
```

Puis, dans la construction de `agenceACreer`, remplacer `nomRegion: nomRegionSansPrefixe ?? 'INCONNU'` par :

```typescript
          nomRegion: nomRegion ?? 'INCONNU',
```

Ajouter l'import :

```typescript
import { RegionSqlModel } from '../../infrastructure/sequelize/models/region.sql-model'
```

Le bloc `TAILLE_PREFIX_DEPARTEMENT` qui traite `nomDepartement` n'est pas concerné et reste en l'état.

- [ ] **Step 4: Lancer les tests**

Run: `yarn test:local:db --grep "ConseillerMilo"`
Expected: PASS — y compris les tests existants du repository.

- [ ] **Step 5: Commit**

```bash
git add src/domain/milo/conseiller.milo.db.ts \
        test/domain/milo/conseiller.milo.db.test.ts
git commit -m "refactor: resoudre le libelle de region par le referentiel cote MILO"
```

---

### Task 5: Colonne `agence.code_safir`

**Files:**
- Create: `src/infrastructure/sequelize/migrations/20260903000003-ajouter-code-safir-agence.js`
- Modify: `src/infrastructure/sequelize/models/agence.sql-model.ts`
- Modify: `test/fixtures/sql-models/agence.sql-model.ts`
- Test: `test/infrastructure/sequelize/models/agence.sql-model.db.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `AgenceDto.codeSafir: string | null` (colonne `code_safir`), avec un index unique partiel sur les seules lignes `POLE_EMPLOI` non nulles.

L'unicité est partielle : les agences MILO n'ont pas de `code_safir`, et plusieurs `NULL` doivent coexister.

- [ ] **Step 1: Écrire le test qui échoue**

`test/infrastructure/sequelize/models/agence.sql-model.db.test.ts` :

```typescript
import { AgenceSqlModel } from 'src/infrastructure/sequelize/models/agence.sql-model'
import { uneAgenceDto, uneAgenceMiloDto } from 'test/fixtures/sql-models/agence.sql-model'
import { expect } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('AgenceSqlModel code_safir', () => {
  beforeEach(async () => {
    await getDatabase().cleanPG()
  })

  it('accepte un code safir sur une agence FT', async () => {
    // When
    await AgenceSqlModel.create(
      uneAgenceDto({ id: '900', codeSafir: '44155' })
    )

    // Then
    const agence = await AgenceSqlModel.findByPk('900')
    expect(agence!.codeSafir).to.equal('44155')
  })

  it('accepte plusieurs agences sans code safir', async () => {
    // When
    await AgenceSqlModel.create(uneAgenceMiloDto({ id: '901' }))
    await AgenceSqlModel.create(uneAgenceMiloDto({ id: '902' }))

    // Then
    const sansSafir = await AgenceSqlModel.count({ where: { codeSafir: null } })
    expect(sansSafir).to.equal(2)
  })

  it('refuse deux agences FT avec le meme code safir', async () => {
    // Given
    await AgenceSqlModel.create(uneAgenceDto({ id: '903', codeSafir: '44155' }))

    // When
    const promesse = AgenceSqlModel.create(
      uneAgenceDto({ id: '904', codeSafir: '44155' })
    )

    // Then
    await expect(promesse).to.be.rejected()
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `yarn test:local:db --grep "AgenceSqlModel code_safir"`
Expected: FAIL — la propriété `codeSafir` n'existe pas.

- [ ] **Step 3: Écrire la migration**

`src/infrastructure/sequelize/migrations/20260903000003-ajouter-code-safir-agence.js` :

```javascript
'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.addColumn(
        'agence',
        'code_safir',
        { type: Sequelize.STRING, allowNull: true },
        { transaction }
      )
      await queryInterface.sequelize.query(
        `CREATE UNIQUE INDEX idx_agence_code_safir
         ON agence (code_safir)
         WHERE code_safir IS NOT NULL AND structure = 'POLE_EMPLOI'`,
        { transaction }
      )
    })
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      await queryInterface.sequelize.query(
        'DROP INDEX IF EXISTS idx_agence_code_safir',
        { transaction }
      )
      await queryInterface.removeColumn('agence', 'code_safir', { transaction })
    })
  }
}
```

- [ ] **Step 4: Ajouter la colonne au modèle**

Dans `src/infrastructure/sequelize/models/agence.sql-model.ts`, ajouter après `codeDepartement` :

```typescript
  @Column({
    field: 'code_safir',
    type: DataType.STRING
  })
  codeSafir: string | null
```

- [ ] **Step 5: Mettre les fixtures à jour**

Dans `test/fixtures/sql-models/agence.sql-model.ts`, ajouter `codeSafir: null` aux `defaults` de `uneAgenceMiloDto` **et** de `uneAgenceDto`.

- [ ] **Step 6: Lancer les tests**

Run: `yarn test:local:db --grep "AgenceSqlModel code_safir"`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/sequelize/migrations/20260903000003-ajouter-code-safir-agence.js \
        src/infrastructure/sequelize/models/agence.sql-model.ts \
        test/fixtures/sql-models/agence.sql-model.ts \
        test/infrastructure/sequelize/models/agence.sql-model.db.test.ts
git commit -m "feat: colonne code_safir sur agence"
```

---

### Task 6: Appel à l'API agences de France Travail

**Files:**
- Modify: `src/infrastructure/clients/dto/pole-emploi.dto.ts`
- Modify: `src/infrastructure/clients/pole-emploi-client.ts`
- Test: `test/infrastructure/clients/pole-emploi-client.test.ts`

**Interfaces:**
- Consumes: `getWithRetry<T>(suffixUrl: string, params?: unknown, secondesAAttendre?: number): Promise<Result<AxiosResponse<T>>>`.
- Produces: `AgenceFTDto` et `PoleEmploiClient.getAgencesFT(): Promise<Result<AgenceFTDto[]>>`.

L'endpoint ne pagine pas : la réponse est la liste complète en un appel. Les scopes `api_referentielagencesv1 organisationpe` sont déjà présents dans `POLE_EMPLOI_SCOPE`, aucun changement de configuration n'est nécessaire.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `test/infrastructure/clients/pole-emploi-client.test.ts` :

```typescript
  describe('getAgencesFT', () => {
    it('retourne les agences renvoyees par le referentiel', async () => {
      // Given
      poleEmploiClient.inMemoryToken = {
        token: 'test-token',
        tokenDate: uneDatetimeDeMaintenant.minus({ minutes: 20 })
      }
      nock('https://api.peio.pe-qvr.fr/partenaire')
        .get('/referentielagences/v1/agences')
        .reply(200, [
          {
            code: 'PDL0092',
            codeSafir: '44155',
            libelle: 'NANTES MALAKOFF',
            libelleEtendu: 'Agence France Travail NANTES MALAKOFF',
            type: 'APE',
            codeRegionINSEE: '52',
            adressePrincipale: { communeImplantation: '44109' }
          }
        ])

      // When
      const result = await poleEmploiClient.getAgencesFT()

      // Then
      expect(isSuccess(result)).to.equal(true)
      if (isSuccess(result)) {
        expect(result.data.length).to.equal(1)
        expect(result.data[0].codeSafir).to.equal('44155')
        expect(result.data[0].adressePrincipale.communeImplantation).to.equal(
          '44109'
        )
      }
    })

    it('remonte un echec quand le referentiel repond en erreur', async () => {
      // Given
      poleEmploiClient.inMemoryToken = {
        token: 'test-token',
        tokenDate: uneDatetimeDeMaintenant.minus({ minutes: 20 })
      }
      nock('https://api.peio.pe-qvr.fr/partenaire')
        .get('/referentielagences/v1/agences')
        .reply(404)

      // When
      const result = await poleEmploiClient.getAgencesFT()

      // Then
      expect(isFailure(result)).to.equal(true)
    })
  })
```

`handleAxiosError` (`src/infrastructure/clients/utils/axios-error-handler.ts`) ne convertit en `Failure` que les statuts strictement inférieurs à 500 par défaut — un vrai `500` ressort en exception, rattrapée par le `try/catch` du job appelant mais pas par le contrat `Result` du client. C'est le comportement déjà en vigueur pour `getMetiersRomeApi`, dont le test équivalent utilise `404` pour la même raison ; `getAgencesFT` suit la même convention plutôt que d'en introduire une nouvelle.

`https://api.peio.pe-qvr.fr/partenaire` est l'URL de base configurée par `testConfig()`, pas celle de production — `nock` doit cibler la même que les tests existants du fichier (voir `getMetiersRomeApi` juste après). `inMemoryToken` est posé à la main pour éviter un aller-retour OAuth réel, comme le fait déjà chaque test de ce fichier.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `yarn test:local:unit --grep "getAgencesFT"`
Expected: FAIL — `poleEmploiClient.getAgencesFT is not a function`

- [ ] **Step 3: Écrire le DTO**

Dans `src/infrastructure/clients/dto/pole-emploi.dto.ts`, ajouter :

```typescript
export interface AgenceFTDto {
  code: string
  codeSafir: string
  libelle: string
  libelleEtendu: string
  type: string
  codeRegionINSEE?: string
  adressePrincipale: {
    communeImplantation: string
  }
}
```

Les autres champs de la réponse (`siret`, `typeAccueil`, `dispositifADEDA`, `contact`, `zoneCompetences`, coordonnées GPS, lignes d'adresse) ne sont pas consommés et ne sont donc pas déclarés. `codeRegionINSEE` est optionnel : les agences spécialisées nationales n'en ont pas.

- [ ] **Step 4: Écrire la méthode du client**

Dans `src/infrastructure/clients/pole-emploi-client.ts`, juste après `getMetiersRomeApi` :

```typescript
  async getAgencesFT(): Promise<Result<AgenceFTDto[]>> {
    try {
      const result = await this.getWithRetry<AgenceFTDto[]>(
        'referentielagences/v1/agences'
      )
      if (isFailure(result)) return result
      return success(result.data.data ?? [])
    } catch (e) {
      return handleAxiosError(e, 'La récupération des agences FT a échoué')
    }
  }
```

Ajouter `AgenceFTDto` à l'import des DTO en tête de fichier.

- [ ] **Step 5: Lancer les tests**

Run: `yarn test:local:unit --grep "getAgencesFT"`
Expected: PASS (2 tests)

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/clients/dto/pole-emploi.dto.ts \
        src/infrastructure/clients/pole-emploi-client.ts \
        test/infrastructure/clients/pole-emploi-client.test.ts
git commit -m "feat: recuperer le referentiel des agences France Travail"
```

---

### Task 7: Réconciliation initiale — job one-off

**Files:**
- Create: `src/application/jobs/agences-ft.helpers.ts`
- Create: `src/application/jobs/reconcilier-agences-ft.job.handler.db.ts`
- Modify: `src/domain/planificateur.ts` (enum `JobType` uniquement, **pas** la liste des crons)
- Modify: `src/config/configuration.ts`
- Modify: `src/app.module.ts`
- Test: `test/application/jobs/agences-ft.helpers.test.ts`
- Test: `test/application/jobs/reconcilier-agences-ft.job.handler.db.test.ts`

**Interfaces:**
- Consumes: `PoleEmploiClient.getAgencesFT()` (Task 6), `AgenceSqlModel.codeSafir` (Task 5), `CommuneSqlModel`, `RegionSqlModel` (Task 1).
- Produces:
  - `Planificateur.JobType.RECONCILIER_AGENCES_FT` (**sans entrée cron**)
  - `ReconcilierAgencesFTJobHandler`
  - `normaliserNomAgence`, `normaliserDepartement`, `chargerDepartementParCommune`, `chargerLibelleParCodeRegion` dans le module partagé `agences-ft.helpers.ts`
  - `StatsReconciliationAgencesFT = { dryRun: boolean; nbAppariees: number; nbAmbigues: number; nbOrphelinesFT: number; nbOrphelinesBase: number; nbMisesAJour: number }`

**Ce job ne tourne qu'une fois, à la main.** Il apparie les agences par nom et département, écrit `code_safir`, aligne `nom_agence` et la région — et ne crée ni ne supprime jamais rien. C'est une reprise de données, pas un traitement récurrent : lui donner un cron n'aurait aucun sens puisqu'il n'a plus rien à faire dès que toutes les agences portent un `code_safir`.

Il emprunte l'enveloppe `JobHandler` plutôt que d'être un script isolé, pour trois raisons concrètes : `TaskService.handle` (`src/application/task.service.ts:33`) route déjà tout membre de `Planificateur.JobType` vers une exécution one-off via `TASK_NAME=`, le `SuiviJob` produit une trace persistée du résultat — indispensable pour une reprise de données qu'on veut pouvoir relire après coup — et l'injection NestJS donne accès au client FT et à Sequelize sans câblage manuel. Un job sans cron **n'est jamais planifié** : `planifierLesCronJobs` n'enregistre que les entrées du tableau des crons.

- [ ] **Step 1: Écrire le test unitaire de normalisation**

`test/application/jobs/agences-ft.helpers.test.ts` :

```typescript
describe('normaliserNomAgence', () => {
  it('retire les prefixes des deux nommages', () => {
    expect(normaliserNomAgence('Agence Pôle emploi PORNIC')).to.equal('PORNIC')
    expect(normaliserNomAgence('Agence France Travail PORNIC')).to.equal(
      'PORNIC'
    )
    expect(normaliserNomAgence('Relai Pôle emploi SAIN BEL')).to.equal(
      'SAIN BEL'
    )
    expect(
      normaliserNomAgence('Agence spécialisée Pôle emploi SCENES ET IMAGES')
    ).to.equal('SCENES ET IMAGES')
  })

  it('retire le RPE residuel du nommage historique', () => {
    expect(normaliserNomAgence('Relai Pôle emploi RPE YSSINGEAUX')).to.equal(
      'YSSINGEAUX'
    )
  })

  it('aligne la casse, les accents et la ponctuation', () => {
    expect(normaliserNomAgence('Agence Pôle emploi Paris 20ème Vitruve')).to.equal(
      'PARIS 20EME VITRUVE'
    )
    expect(normaliserNomAgence('Agence France Travail CENTRE-ISERE')).to.equal(
      'CENTRE ISERE'
    )
  })

  it('unifie SAINT et ST', () => {
    expect(
      normaliserNomAgence('Agence Pôle emploi SAINT ETIENNE CLAPIER')
    ).to.equal('ST ETIENNE CLAPIER')
    expect(
      normaliserNomAgence('Agence France Travail ST ETIENNE CLAPIER')
    ).to.equal('ST ETIENNE CLAPIER')
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `yarn test:local:db --grep "normaliserNomAgence"`
Expected: FAIL — module introuvable.

- [ ] **Step 3: Déclarer le type de job**

Dans `src/domain/planificateur.ts`, ajouter à l'enum `JobType` :

```typescript
    RECONCILIER_AGENCES_FT = 'RECONCILIER_AGENCES_FT'
```

**Ne rien ajouter au tableau des crons.** L'absence d'entrée est ce qui rend ce job strictement manuel : `InitCronsCommandHandler` ne planifie que ce que ce tableau contient. Le job reste déclenchable par `TASK_NAME=RECONCILIER_AGENCES_FT`.

- [ ] **Step 4: Déclarer la configuration**

Dans `src/config/configuration.ts`, à l'intérieur du bloc `jobs`, après `purgeInvites` :

```typescript
      reconciliationAgencesFT: {
        dryRun: process.env.JOB_RECONCILIATION_AGENCES_FT_DRY_RUN !== 'false'
      }
```

Le dry-run est **actif par défaut** : il faut poser explicitement `JOB_RECONCILIATION_AGENCES_FT_DRY_RUN=false` pour que la réconciliation écrive. Comme le job est lancé à la main, la variable se pose sur l'exécution elle-même, sans toucher à la configuration de l'application.

- [ ] **Step 5: Écrire le module partagé**

Ce module est la seule chose que la réconciliation et le job mensuel ont en commun. Il ne contient que des fonctions pures et deux chargeurs de tables de correspondance — aucune écriture.

`src/application/jobs/agences-ft.helpers.ts` :

```typescript
import { remove as enleverLesAccents } from 'remove-accents'
import { Op } from 'sequelize'
import { AgenceFTDto } from '../../infrastructure/clients/dto/pole-emploi.dto'
import { CommuneSqlModel } from '../../infrastructure/sequelize/models/commune.sql-model'
import { DepartementSqlModel } from '../../infrastructure/sequelize/models/departement.sql-model'
import { RegionSqlModel } from '../../infrastructure/sequelize/models/region.sql-model'

const PREFIXES = [
  'AGENCE SPECIALISEE POLE EMPLOI ',
  'AGENCE SPECIALISEE FRANCE TRAVAIL ',
  'RELAI POLE EMPLOI ',
  'RELAI FRANCE TRAVAIL ',
  'AGENCE POLE EMPLOI ',
  'AGENCE FRANCE TRAVAIL '
]

export function normaliserNomAgence(nom: string): string {
  let normalise = enleverLesAccents(nom)
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()

  const prefixe = PREFIXES.find(p => normalise.startsWith(p))
  if (prefixe) normalise = normalise.slice(prefixe.length)
  if (normalise.startsWith('RPE ')) normalise = normalise.slice(4)

  return normalise
    .replace(/\bSAINTE\b/g, 'STE')
    .replace(/\bSAINT\b/g, 'ST')
}

export function normaliserDepartement(code: string | undefined | null): string {
  if (!code) return '??'
  if (code === '2A' || code === '2B' || code === '20') return '20'
  return code.length === 1 ? `0${code}` : code
}

export function pousser<T>(
  map: Map<string, T[]>,
  cle: string,
  valeur: T
): void {
  const existants = map.get(cle)
  if (existants) existants.push(valeur)
  else map.set(cle, [valeur])
}

export async function chargerDepartementParCommune(
  agencesFT: AgenceFTDto[]
): Promise<Map<string, string>> {
  const codes = agencesFT.map(a => a.adressePrincipale.communeImplantation)
  const communes = await CommuneSqlModel.findAll({
    where: { code: { [Op.in]: codes } },
    attributes: ['code', 'codeDepartement']
  })
  return new Map(communes.map(c => [c.code, c.codeDepartement]))
}

export async function chargerLibelleParCodeRegion(): Promise<
  Map<string, string>
> {
  const regions = await RegionSqlModel.findAll()
  return new Map(regions.map(r => [r.code, r.libelle]))
}

export async function chargerRegionParDepartement(): Promise<
  Map<string, string>
> {
  const departements = await DepartementSqlModel.findAll({
    attributes: ['code', 'codeRegion']
  })
  return new Map(departements.map(d => [d.code, d.codeRegion]))
}
```

- [ ] **Step 5 bis: Écrire le handler de réconciliation**

`src/application/jobs/reconcilier-agences-ft.job.handler.db.ts` :

```typescript
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Sequelize } from 'sequelize'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { isFailure } from '../../building-blocks/types/result'
import { Core } from '../../domain/core'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { AgenceFTDto } from '../../infrastructure/clients/dto/pole-emploi.dto'
import { PoleEmploiClient } from '../../infrastructure/clients/pole-emploi-client'
import { AgenceSqlModel } from '../../infrastructure/sequelize/models/agence.sql-model'
import { SequelizeInjectionToken } from '../../infrastructure/sequelize/providers'
import { DateService } from '../../utils/date-service'
import {
  chargerDepartementParCommune,
  chargerLibelleParCodeRegion,
  normaliserDepartement,
  normaliserNomAgence,
  pousser
} from './agences-ft.helpers'

export interface StatsReconciliationAgencesFT {
  dryRun: boolean
  nbAppariees: number
  nbAmbigues: number
  nbOrphelinesFT: number
  nbOrphelinesBase: number
  nbMisesAJour: number
}

@Injectable()
@ProcessJobType(Planificateur.JobType.RECONCILIER_AGENCES_FT)
export class ReconcilierAgencesFTJobHandler extends JobHandler<void> {
  constructor(
    private readonly poleEmploiClient: PoleEmploiClient,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    private readonly configService: ConfigService
  ) {
    super(Planificateur.JobType.RECONCILIER_AGENCES_FT, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const debutExecutionJob = this.dateService.now()
    const config = this.configService.get('jobs').reconciliationAgencesFT
    const stats: StatsReconciliationAgencesFT = {
      dryRun: config.dryRun,
      nbAppariees: 0,
      nbAmbigues: 0,
      nbOrphelinesFT: 0,
      nbOrphelinesBase: 0,
      nbMisesAJour: 0
    }
    let succes = true

    try {
      const agencesFTResult = await this.poleEmploiClient.getAgencesFT()
      if (isFailure(agencesFTResult)) {
        throw new Error(
          `Récupération des agences FT échouée : ${agencesFTResult.error.message}`
        )
      }
      const agencesFT = agencesFTResult.data
      if (agencesFT.length === 0) {
        throw new Error('Le référentiel des agences FT est vide')
      }

      const agencesBase = await AgenceSqlModel.findAll({
        where: { structure: Core.Structure.POLE_EMPLOI }
      })

      await this.reconcilier(agencesFT, agencesBase, stats, config.dryRun)
    } catch (e) {
      this.logger.error(e)
      succes = false
    }

    return {
      jobType: this.jobType,
      nbErreurs: succes ? 0 : 1,
      succes,
      dateExecution: debutExecutionJob,
      tempsExecution: DateService.calculerTempsExecution(debutExecutionJob),
      resultat: stats
    }
  }

  private async reconcilier(
    agencesFT: AgenceFTDto[],
    agencesBase: AgenceSqlModel[],
    stats: StatsReconciliationAgencesFT,
    dryRun: boolean
  ): Promise<void> {
    const departementParCommune = await chargerDepartementParCommune(agencesFT)

    const parNomEtDepartement = new Map<string, AgenceSqlModel[]>()
    const parNom = new Map<string, AgenceSqlModel[]>()
    for (const agence of agencesBase) {
      const nom = normaliserNomAgence(agence.nomAgence)
      pousser(parNom, nom, agence)
      pousser(
        parNomEtDepartement,
        `${nom}|${normaliserDepartement(agence.codeDepartement)}`,
        agence
      )
    }

    const appariements: Array<{ ft: AgenceFTDto; base: AgenceSqlModel }> = []
    const apparieesBase = new Set<string>()

    for (const agenceFT of agencesFT) {
      const nom = normaliserNomAgence(agenceFT.libelle)
      const departement = normaliserDepartement(
        departementParCommune.get(
          agenceFT.adressePrincipale.communeImplantation
        )
      )
      const candidats =
        parNomEtDepartement.get(`${nom}|${departement}`) ?? parNom.get(nom) ?? []

      if (candidats.length === 1) {
        appariements.push({ ft: agenceFT, base: candidats[0] })
        apparieesBase.add(candidats[0].id)
      } else if (candidats.length > 1) {
        stats.nbAmbigues++
      } else {
        stats.nbOrphelinesFT++
      }
    }

    stats.nbAppariees = appariements.length
    stats.nbOrphelinesBase = agencesBase.filter(
      a => !apparieesBase.has(a.id)
    ).length

    if (dryRun) return

    const libelleParCodeRegion = await chargerLibelleParCodeRegion()

    await this.sequelize.transaction(async transaction => {
      for (const { ft, base } of appariements) {
        await AgenceSqlModel.update(
          {
            codeSafir: ft.codeSafir,
            nomAgence: ft.libelleEtendu,
            codeRegion: ft.codeRegionINSEE ?? base.codeRegion,
            nomRegion: ft.codeRegionINSEE
              ? libelleParCodeRegion.get(ft.codeRegionINSEE) ?? base.nomRegion
              : base.nomRegion
          },
          { where: { id: base.id }, transaction }
        )
        stats.nbMisesAJour++
      }
    })
  }
}
```

`nbOrphelinesFT` et `nbOrphelinesBase` ne déclenchent aucune écriture ici : ce sont les compteurs qui annoncent ce que le job mensuel créera et supprimera au premier passage. Les lire dans le `SuiviJob` de la réconciliation est le seul moyen de valider le plafond de la Task 8 avant de l'atteindre.

- [ ] **Step 6: Enregistrer le handler**

Dans `src/app.module.ts`, ajouter l'import à côté de celui de `MajReferentielRomeJobHandler` :

```typescript
import { ReconcilierAgencesFTJobHandler } from './application/jobs/reconcilier-agences-ft.job.handler.db'
```

puis `ReconcilierAgencesFTJobHandler` dans la liste des providers, juste après `MajReferentielRomeJobHandler`.

- [ ] **Step 7: Lancer les tests de normalisation**

Run: `yarn test:local:unit --grep "normaliserNomAgence"`
Expected: PASS (4 tests)

- [ ] **Step 8: Écrire le test de la réconciliation**

En tête du fichier de test, poser les imports :

```typescript
import { ConfigService } from '@nestjs/config'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { normaliserNomAgence } from 'src/application/jobs/agences-ft.helpers'
import {
  ReconcilierAgencesFTJobHandler,
  StatsReconciliationAgencesFT
} from 'src/application/jobs/reconcilier-agences-ft.job.handler.db'
import { success } from 'src/building-blocks/types/result'
import { Core } from 'src/domain/core'
import { SuiviJob } from 'src/domain/suivi-job'
import { PoleEmploiClient } from 'src/infrastructure/clients/pole-emploi-client'
import { AgenceSqlModel } from 'src/infrastructure/sequelize/models/agence.sql-model'
import { CommuneSqlModel } from 'src/infrastructure/sequelize/models/commune.sql-model'
import { ConseillerSqlModel } from 'src/infrastructure/sequelize/models/conseiller.sql-model'
import { RegionSqlModel } from 'src/infrastructure/sequelize/models/region.sql-model'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import {
  uneAgenceDto,
  uneAgenceMiloDto
} from 'test/fixtures/sql-models/agence.sql-model'
import { uneCommuneDto } from 'test/fixtures/sql-models/commune.sql-model'
import { unConseillerDto } from 'test/fixtures/sql-models/conseiller.sql-model'
import { uneRegionDto } from 'test/fixtures/sql-models/region.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'
```

Puis ajouter le bloc :

```typescript
describe('ReconcilierAgencesFTJobHandler', () => {
  let handler: ReconcilierAgencesFTJobHandler
  let poleEmploiClient: StubbedClass<PoleEmploiClient>
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let configService: StubbedClass<ConfigService>

  const maintenant = uneDatetime()

  const agenceFT = {
    code: 'PDL0093',
    codeSafir: '44163',
    libelle: 'PORNIC',
    libelleEtendu: 'Agence France Travail PORNIC',
    type: 'APE',
    codeRegionINSEE: '52',
    adressePrincipale: { communeImplantation: '44131' }
  }

  beforeEach(async () => {
    await getDatabase().cleanPG()
    const sandbox = createSandbox()
    poleEmploiClient = stubClass(PoleEmploiClient)
    dateService = stubClass(DateService)
    suiviJobService = stubInterface(sandbox)
    configService = stubClass<
      ConfigService<Record<string | symbol, unknown>>
    >(ConfigService)
    dateService.now.returns(maintenant)
    configService.get.returns({
      reconciliationAgencesFT: { dryRun: false }
    })

    await RegionSqlModel.create(
      uneRegionDto({ code: '52', libelle: 'Pays de la Loire' })
    )
    await CommuneSqlModel.create(
      uneCommuneDto({ id: '44131-44210', code: '44131', codeDepartement: '44' })
    )
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '458',
        nomAgence: 'Agence Pôle emploi PORNIC',
        codeDepartement: '44',
        nomRegion: 'Pays de la Loire',
        codeSafir: null
      })
    )

    handler = new ReconcilierAgencesFTJobHandler(
      poleEmploiClient,
      getDatabase().sequelize,
      suiviJobService,
      dateService,
      configService
    )
  })

  it('ecrit le code safir et aligne le nom sans rien creer ni supprimer', async () => {
    // Given
    poleEmploiClient.getAgencesFT.resolves(success([agenceFT]))

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsReconciliationAgencesFT
    expect(stats.nbAppariees).to.equal(1)

    const agence = await AgenceSqlModel.findByPk('458')
    expect(agence!.codeSafir).to.equal('44163')
    expect(agence!.nomAgence).to.equal('Agence France Travail PORNIC')
    expect(agence!.codeRegion).to.equal('52')
  })

  it("n'ecrit rien en dry-run", async () => {
    // Given
    configService.get.returns({
      reconciliationAgencesFT: { dryRun: true }
    })
    poleEmploiClient.getAgencesFT.resolves(success([agenceFT]))

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsReconciliationAgencesFT
    expect(stats.nbAppariees).to.equal(1)
    const agence = await AgenceSqlModel.findByPk('458')
    expect(agence!.codeSafir).to.equal(null)
    expect(agence!.nomAgence).to.equal('Agence Pôle emploi PORNIC')
  })

  it('ne touche pas aux agences MILO', async () => {
    // Given
    await AgenceSqlModel.create(
      uneAgenceMiloDto({ id: 'MILO-1', nomAgence: 'Agence Pôle emploi PORNIC' })
    )
    poleEmploiClient.getAgencesFT.resolves(success([agenceFT]))

    // When
    await handler.handle()

    // Then
    const milo = await AgenceSqlModel.findByPk('MILO-1')
    expect(milo!.codeSafir).to.equal(null)
    expect(milo!.nomAgence).to.equal('Agence Pôle emploi PORNIC')
  })

  it('echoue sans rien ecrire quand le referentiel est vide', async () => {
    // Given
    poleEmploiClient.getAgencesFT.resolves(success([]))

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(false)
    const agence = await AgenceSqlModel.findByPk('458')
    expect(agence!.codeSafir).to.equal(null)
  })
})
```

- [ ] **Step 9: Lancer les tests**

Run: `yarn test:local:db --grep "ReconcilierAgencesFTJobHandler"`
Expected: PASS (4 tests)

- [ ] **Step 10: Commit**

```bash
git add src/application/jobs/agences-ft.helpers.ts \
        src/application/jobs/reconcilier-agences-ft.job.handler.db.ts \
        src/domain/planificateur.ts \
        src/config/configuration.ts \
        src/app.module.ts \
        test/application/jobs/agences-ft.helpers.test.ts \
        test/application/jobs/reconcilier-agences-ft.job.handler.db.test.ts
git commit -m "feat: job one-off de reconciliation du referentiel des agences FT"
```

---

### Task 8: Job mensuel de mise à jour

**Files:**
- Create: `src/application/jobs/maj-referentiel-agences-ft.job.handler.db.ts`
- Modify: `src/domain/planificateur.ts` (enum `JobType` **et** liste des crons)
- Modify: `src/config/configuration.ts`
- Modify: `src/app.module.ts`
- Test: `test/application/jobs/maj-referentiel-agences-ft.job.handler.db.test.ts`

**Interfaces:**
- Consumes: `agences-ft.helpers.ts` (Task 7), `PoleEmploiClient.getAgencesFT()` (Task 6), `AgenceSqlModel.codeSafir` (Task 5).
- Produces:
  - `Planificateur.JobType.MAJ_REFERENTIEL_AGENCES_FT` **avec** son entrée cron `'0 4 1 * *'`
  - `MajReferentielAgencesFTJobHandler`
  - `StatsMajAgencesFT = { dryRun: boolean; nbCreees: number; nbMisesAJour: number; nbSupprimees: number; nbConseillersDetaches: number; nbConseillersReaffectes: number }`

Handler **distinct** de celui de la Task 7, dans son propre fichier. Il ne connaît pas la réconciliation : il apparie exclusivement par `code_safir`, et n'a donc aucun appariement par nom, aucune détection de mode, aucune branche morte à porter tous les mois.

Une agence créée prend son `codeSafir` comme `id`. Une agence dont FT ne renvoie plus le `codeSafir` est supprimée, après passage à `NULL` de `conseiller.id_agence` dans la même transaction. Le plafond bloque tout le diff : au-delà de `max(nombreSuppressionsMin, pourcentageSuppressionsMax %)`, le job abandonne sans rien écrire.

**Le garde-fou qui remplace la détection de mode — supprimé le 2026-09-07.**
Séparer les deux jobs crée un risque : si le job mensuel tournait avant la
réconciliation, aucune agence n'aurait de `code_safir`, les 894 seraient vues comme
absentes du référentiel FT, et il tenterait de tout supprimer pour tout recréer. La
version initiale de ce plan ajoutait un garde-fou explicite pour ce cas : refuser de
s'exécuter tant qu'une agence `POLE_EMPLOI` a `code_safir IS NULL`. **Ce garde-fou a
été retiré** après avoir constaté, en conditions réelles, qu'il rendait le job
mensuel définitivement inexécutable — voir la révision post-implémentation du
2026-09-07 en tête de ce document. Le plafond de `appliquerDiff` couvre déjà le même
scénario (894 candidates à la suppression dépassent trivialement `max(5, 2 %)`), sans
jamais bloquer l'état stable où un petit résidu d'agences reste durablement sans
`code_safir`.

- [ ] **Step 1: Écrire les tests qui échouent**

`test/application/jobs/maj-referentiel-agences-ft.job.handler.db.test.ts` :

```typescript
import { ConfigService } from '@nestjs/config'
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import {
  MajReferentielAgencesFTJobHandler,
  StatsMajAgencesFT
} from 'src/application/jobs/maj-referentiel-agences-ft.job.handler.db'
import { success } from 'src/building-blocks/types/result'
import { SuiviJob } from 'src/domain/suivi-job'
import { PoleEmploiClient } from 'src/infrastructure/clients/pole-emploi-client'
import { AgenceSqlModel } from 'src/infrastructure/sequelize/models/agence.sql-model'
import { CommuneSqlModel } from 'src/infrastructure/sequelize/models/commune.sql-model'
import { ConseillerSqlModel } from 'src/infrastructure/sequelize/models/conseiller.sql-model'
import { RegionSqlModel } from 'src/infrastructure/sequelize/models/region.sql-model'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { uneAgenceDto } from 'test/fixtures/sql-models/agence.sql-model'
import { uneCommuneDto } from 'test/fixtures/sql-models/commune.sql-model'
import { unConseillerDto } from 'test/fixtures/sql-models/conseiller.sql-model'
import { uneRegionDto } from 'test/fixtures/sql-models/region.sql-model'
import { createSandbox, expect, StubbedClass, stubClass } from 'test/utils'
import { getDatabase } from 'test/utils/database-for-testing'

describe('MajReferentielAgencesFTJobHandler', () => {
  let handler: MajReferentielAgencesFTJobHandler
  let poleEmploiClient: StubbedClass<PoleEmploiClient>
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let configService: StubbedClass<ConfigService>

  const agenceFTPornic = {
    code: 'PDL0093',
    codeSafir: '44163',
    libelle: 'PORNIC',
    libelleEtendu: 'Agence France Travail PORNIC',
    type: 'APE',
    codeRegionINSEE: '52',
    adressePrincipale: { communeImplantation: '44131' }
  }

  const agenceFTNouvelle = {
    code: 'PDL0092',
    codeSafir: '44155',
    libelle: 'NANTES MALAKOFF',
    libelleEtendu: 'Agence France Travail NANTES MALAKOFF',
    type: 'APE',
    codeRegionINSEE: '52',
    adressePrincipale: { communeImplantation: '44109' }
  }

  beforeEach(async () => {
    await getDatabase().cleanPG()
    const sandbox = createSandbox()
    poleEmploiClient = stubClass(PoleEmploiClient)
    dateService = stubClass(DateService)
    suiviJobService = stubInterface(sandbox)
    configService = stubClass<
      ConfigService<Record<string | symbol, unknown>>
    >(ConfigService)
    dateService.now.returns(uneDatetime())
    configService.get.returns({
      majAgencesFT: {
        dryRun: false,
        pourcentageSuppressionsMax: '2',
        nombreSuppressionsMin: '5'
      }
    })

    await RegionSqlModel.create(uneRegionDto({ code: '52', libelle: 'Pays de la Loire' }))
    await CommuneSqlModel.create(
      uneCommuneDto({ id: '44131-44210', code: '44131', codeDepartement: '44' })
    )
    await CommuneSqlModel.create(
      uneCommuneDto({ id: '44109-44000', code: '44109', codeDepartement: '44' })
    )
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '458',
        nomAgence: 'Agence France Travail PORNIC',
        codeDepartement: '44',
        codeSafir: '44163'
      })
    )

    handler = new MajReferentielAgencesFTJobHandler(
      poleEmploiClient,
      getDatabase().sequelize,
      suiviJobService,
      dateService,
      configService
    )
  })

  it('cree une agence inconnue avec son code safir comme identifiant', async () => {
    // Given
    poleEmploiClient.getAgencesFT.resolves(
      success([agenceFTPornic, agenceFTNouvelle])
    )

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbCreees).to.equal(1)

    const creee = await AgenceSqlModel.findByPk('44155')
    expect(creee!.nomAgence).to.equal('Agence France Travail NANTES MALAKOFF')
    expect(creee!.codeDepartement).to.equal('44')
    expect(creee!.nomRegion).to.equal('Pays de la Loire')
    expect(creee!.structure).to.equal(Core.Structure.POLE_EMPLOI)
  })

  it('renomme sans supprimer quand seul le libelle change', async () => {
    // Given
    poleEmploiClient.getAgencesFT.resolves(
      success([{ ...agenceFTPornic, libelleEtendu: 'Agence France Travail PORNIC SUD' }])
    )

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbSupprimees).to.equal(0)
    expect(stats.nbMisesAJour).to.equal(1)
    const agence = await AgenceSqlModel.findByPk('458')
    expect(agence!.nomAgence).to.equal('Agence France Travail PORNIC SUD')
  })

  it('supprime une agence disparue et detache ses conseillers', async () => {
    // Given
    await ConseillerSqlModel.create(
      unConseillerDto({ id: 'CONSEILLER-1', idAgence: '458' })
    )
    poleEmploiClient.getAgencesFT.resolves(success([agenceFTNouvelle]))

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbSupprimees).to.equal(1)
    expect(stats.nbConseillersDetaches).to.equal(1)

    const conseiller = await ConseillerSqlModel.findByPk('CONSEILLER-1')
    expect(conseiller!.idAgence).to.equal(null)
    expect(await AgenceSqlModel.findByPk('458')).to.equal(null)
  })

  it('abandonne sans rien ecrire quand le plafond de suppressions est depasse', async () => {
    // Given
    for (const codeSafir of ['1', '2', '3', '4', '5', '6']) {
      await AgenceSqlModel.create(
        uneAgenceDto({
          id: `agence-${codeSafir}`,
          nomAgence: `Agence France Travail ${codeSafir}`,
          codeDepartement: '44',
          codeSafir
        })
      )
    }
    poleEmploiClient.getAgencesFT.resolves(success([agenceFTPornic]))

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(false)
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbSupprimees).to.equal(0)
    expect(await AgenceSqlModel.findByPk('agence-1')).not.to.equal(null)
  })

  it('refuse de tourner tant quune agence na pas de code safir', async () => {
    // Given
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '999',
        nomAgence: 'Agence France Travail NON RECONCILIEE',
        codeDepartement: '44',
        codeSafir: null
      })
    )
    poleEmploiClient.getAgencesFT.resolves(success([agenceFTPornic]))

    // When
    const suivi = await handler.handle()

    // Then
    expect(suivi.succes).to.equal(false)
    expect(poleEmploiClient.getAgencesFT).not.to.have.been.called()
    expect(await AgenceSqlModel.findByPk('999')).not.to.equal(null)
  })
})
```

Le dernier test vérifie les deux moitiés du garde : le job échoue, **et** il n'a pas appelé France Travail. C'est ce qui prouve que le garde est bien placé avant l'appel HTTP.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `yarn test:local:db --grep "MajReferentielAgencesFTJobHandler"`
Expected: FAIL — `Cannot find module '.../maj-referentiel-agences-ft.job.handler.db'`

- [ ] **Step 3: Déclarer le job, son cron et sa configuration**

Dans `src/domain/planificateur.ts`, ajouter à l'enum `JobType` :

```typescript
    MAJ_REFERENTIEL_AGENCES_FT = 'MAJ_REFERENTIEL_AGENCES_FT'
```

et, cette fois, à la fin du tableau des crons, après l'entrée `MAJ_REFERENTIEL_ROME` :

```typescript
  {
    type: Planificateur.JobType.MAJ_REFERENTIEL_AGENCES_FT,
    expression: '0 4 1 * *',
    description:
      'Le 1er de chaque mois à 4h. Mise à jour du référentiel des agences France Travail.'
  }
```

Dans `src/config/configuration.ts`, à côté de `reconciliationAgencesFT` :

```typescript
      majAgencesFT: {
        dryRun: process.env.JOB_MAJ_AGENCES_FT_DRY_RUN === 'true',
        pourcentageSuppressionsMax:
          process.env.JOB_MAJ_AGENCES_FT_POURCENTAGE_SUPPRESSIONS_MAX ?? '2',
        nombreSuppressionsMin:
          process.env.JOB_MAJ_AGENCES_FT_NOMBRE_SUPPRESSIONS_MIN ?? '5'
      }
```

Le sens du défaut est **inversé** par rapport à la réconciliation : `=== 'true'` au lieu de `!== 'false'`. Un job planifié dont le dry-run serait actif par défaut ne ferait jamais rien tout en rapportant des succès — c'est le pire des deux mondes. Ici la protection est le plafond, pas le dry-run ; ce dernier reste disponible pour une exécution manuelle de vérification.

`nombreSuppressionsMin` est prévu pour être **relevé le temps du premier passage**, puis remis à son défaut. Le premier diff n'est pas un mois de mouvements : il solde d'un coup toutes les réorganisations accumulées depuis le dernier peuplement manuel de la table — 36 agences d'après la mesure du 2026-09-03, contre un plafond par défaut de 17. La procédure exacte est à la section « Mise en service ».

- [ ] **Step 3 bis: Écrire le squelette du handler**

`src/application/jobs/maj-referentiel-agences-ft.job.handler.db.ts` :

```typescript
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Sequelize } from 'sequelize'
import { JobHandler } from '../../building-blocks/types/job-handler'
import { isFailure } from '../../building-blocks/types/result'
import { Core } from '../../domain/core'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { AgenceFTDto } from '../../infrastructure/clients/dto/pole-emploi.dto'
import { PoleEmploiClient } from '../../infrastructure/clients/pole-emploi-client'
import { AgenceSqlModel } from '../../infrastructure/sequelize/models/agence.sql-model'
import { ConseillerSqlModel } from '../../infrastructure/sequelize/models/conseiller.sql-model'
import { SequelizeInjectionToken } from '../../infrastructure/sequelize/providers'
import { DateService } from '../../utils/date-service'
import { rootLogger } from '../../utils/logger.module'
import {
  chargerDepartementParCommune,
  chargerLibelleParCodeRegion,
  chargerRegionParDepartement
} from './agences-ft.helpers'

export interface StatsMajAgencesFT {
  dryRun: boolean
  nbCreees: number
  nbMisesAJour: number
  nbSupprimees: number
  nbConseillersDetaches: number
  nbConseillersReaffectes: number
}

@Injectable()
@ProcessJobType(Planificateur.JobType.MAJ_REFERENTIEL_AGENCES_FT)
export class MajReferentielAgencesFTJobHandler extends JobHandler<void> {
  constructor(
    private readonly poleEmploiClient: PoleEmploiClient,
    @Inject(SequelizeInjectionToken) private readonly sequelize: Sequelize,
    @Inject(SuiviJobServiceToken) suiviJobService: SuiviJob.Service,
    private readonly dateService: DateService,
    private readonly configService: ConfigService
  ) {
    super(Planificateur.JobType.MAJ_REFERENTIEL_AGENCES_FT, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const debutExecutionJob = this.dateService.now()
    const config = this.configService.get('jobs').majAgencesFT
    const stats: StatsMajAgencesFT = {
      dryRun: config.dryRun,
      nbCreees: 0,
      nbMisesAJour: 0,
      nbSupprimees: 0,
      nbConseillersDetaches: 0,
      nbConseillersReaffectes: 0
    }
    let succes = true

    try {
      const agencesBase = await AgenceSqlModel.findAll({
        where: { structure: Core.Structure.POLE_EMPLOI }
      })
      const nbSansCodeSafir = agencesBase.filter(a => !a.codeSafir).length
      if (nbSansCodeSafir > 0) {
        throw new Error(
          `${nbSansCodeSafir} agences sans code SAFIR : lancer TASK_NAME=RECONCILIER_AGENCES_FT avant`
        )
      }

      const agencesFTResult = await this.poleEmploiClient.getAgencesFT()
      if (isFailure(agencesFTResult)) {
        throw new Error(
          `Récupération des agences FT échouée : ${agencesFTResult.error.message}`
        )
      }
      const agencesFT = agencesFTResult.data
      if (agencesFT.length === 0) {
        throw new Error('Le référentiel des agences FT est vide')
      }

      await this.appliquerDiff(agencesFT, agencesBase, stats, config)
    } catch (e) {
      this.logger.error(e)
      succes = false
    }

    return {
      jobType: this.jobType,
      nbErreurs: succes ? 0 : 1,
      succes,
      dateExecution: debutExecutionJob,
      tempsExecution: DateService.calculerTempsExecution(debutExecutionJob),
      resultat: stats
    }
  }
}
```

Le garde sur `code_safir` est placé **avant** l'appel HTTP : inutile d'interroger FT pour un job qui ne peut rien faire.

- [ ] **Step 4: Implémenter le diff**

Ajouter à la classe :

```typescript
  private async appliquerDiff(
    agencesFT: AgenceFTDto[],
    agencesBase: AgenceSqlModel[],
    stats: StatsMajAgencesFT,
    config: { pourcentageSuppressionsMax: string; nombreSuppressionsMin: string; dryRun: boolean }
  ): Promise<void> {
    const departementParCommune = await chargerDepartementParCommune(agencesFT)
    const libelleParCodeRegion = await chargerLibelleParCodeRegion()
    const departementParCodeRegion = await chargerRegionParDepartement()

    const parCodeSafir = new Map(agencesBase.map(a => [a.codeSafir, a]))
    const codesSafirFT = new Set(agencesFT.map(a => a.codeSafir))

    // handle() garantit qu'aucune agence POLE_EMPLOI n'a de codeSafir nul
    // avant d'appeler appliquerDiff : l'assertion non-null est sure ici.
    const aSupprimer = agencesBase.filter(a => !codesSafirFT.has(a.codeSafir!))
    const plafond = Math.max(
      parseInt(config.nombreSuppressionsMin, 10),
      Math.floor(
        (agencesBase.length * parseInt(config.pourcentageSuppressionsMax, 10)) /
          100
      )
    )
    if (aSupprimer.length > plafond) {
      throw new Error(
        `Plafond de suppressions dépassé : ${aSupprimer.length} > ${plafond}`
      )
    }

    if (config.dryRun) return

    await this.sequelize.transaction(async transaction => {
      for (const agenceFT of agencesFT) {
        const codeDepartement =
          departementParCommune.get(
            agenceFT.adressePrincipale.communeImplantation
          ) ?? null
        const codeRegion =
          agenceFT.codeRegionINSEE ??
          (codeDepartement
            ? departementParCodeRegion.get(codeDepartement) ?? null
            : null)
        const nomRegion = codeRegion
          ? libelleParCodeRegion.get(codeRegion) ?? 'INCONNU'
          : 'INCONNU'

        const existante = parCodeSafir.get(agenceFT.codeSafir)
        if (existante) {
          await AgenceSqlModel.update(
            {
              nomAgence: agenceFT.libelleEtendu,
              codeRegion,
              nomRegion,
              codeDepartement: codeDepartement ?? existante.codeDepartement
            },
            { where: { id: existante.id }, transaction }
          )
          stats.nbMisesAJour++
        } else {
          await AgenceSqlModel.create(
            {
              id: agenceFT.codeSafir,
              codeSafir: agenceFT.codeSafir,
              nomAgence: agenceFT.libelleEtendu,
              nomUsuel: agenceFT.libelle,
              nomRegion,
              codeRegion,
              nomDepartement: null,
              codeDepartement: codeDepartement ?? '99',
              structure: Core.Structure.POLE_EMPLOI,
              timezone: 'Europe/Paris'
            },
            { transaction }
          )
          stats.nbCreees++
        }
      }

      for (const agence of aSupprimer) {
        const [nbDetaches] = await ConseillerSqlModel.update(
          { idAgence: null },
          { where: { idAgence: agence.id }, transaction }
        )
        stats.nbConseillersDetaches += nbDetaches
        rootLogger.info(
          {
            context: this.jobType,
            event: { action: 'agence_ft_supprimee', outcome: 'success' },
            agence: { id: agence.id, nom: agence.nomAgence },
            nbConseillers: nbDetaches
          },
          'agence_ft_supprimee'
        )
        await AgenceSqlModel.destroy({
          where: { id: agence.id },
          transaction
        })
        stats.nbSupprimees++
      }
    })
  }
```

Les logs suivent les conventions ECS du socle transverse (`pass-emploi-tools/docs/logs-ecs/conventions.md`) : `message` identique à `event.action`, verbe au passé en snake_case et sans interpolation, `event.outcome` à `success` ou `failure`, niveau `info` pour un fait nominal. C'est la forme émise par `emitHandlerExecuted` (`src/utils/logger.helpers.ts:304-331`). `this.logger` du `JobHandler` est un logger NestJS et ne produit pas ce format : il reste réservé aux erreurs techniques.

Le fallback `codeRegionINSEE` absent → chaîne `commune → département → région` couvre les agences spécialisées nationales, qui n'ont pas de région chez FT.

- [ ] **Step 4 bis: Enregistrer le handler**

Dans `src/app.module.ts`, ajouter l'import à côté de celui de `ReconcilierAgencesFTJobHandler` :

```typescript
import { MajReferentielAgencesFTJobHandler } from './application/jobs/maj-referentiel-agences-ft.job.handler.db'
```

puis `MajReferentielAgencesFTJobHandler` dans la liste des providers.

- [ ] **Step 5: Lancer les tests**

Run: `yarn test:local:db --grep "MajReferentielAgencesFTJobHandler"`
Expected: PASS (5 tests : les 4 du diff, plus celui du garde `code_safir`)

- [ ] **Step 6: Vérifier la compilation**

Run: `yarn tsc --noEmit`
Expected: aucune erreur

- [ ] **Step 7: Commit**

```bash
git add src/application/jobs/maj-referentiel-agences-ft.job.handler.db.ts \
        src/domain/planificateur.ts \
        src/config/configuration.ts \
        src/app.module.ts \
        test/application/jobs/maj-referentiel-agences-ft.job.handler.db.test.ts
git commit -m "feat: job mensuel de mise a jour du referentiel des agences FT"
```

---

### Task 9: Table de correspondance des renommages et fusions

**Files:**
- Create: `src/application/jobs/data/correspondances-agences-ft.ts`
- Modify: `src/application/jobs/maj-referentiel-agences-ft.job.handler.db.ts`
- Test: `test/application/jobs/maj-referentiel-agences-ft.job.handler.db.test.ts`

**Interfaces:**
- Consumes: `appliquerDiff()` et `StatsMajAgencesFT.nbConseillersReaffectes`, tous deux produits par la Task 8.
- Produces: `CORRESPONDANCES_AGENCES_FT: Record<string, string>` (id d'agence en base → `codeSafir` de l'agence successeur) et sa prise en compte dans la boucle de suppression.

Sur le dump complet, 858 agences sur 885 s'apparient par le nom. Les 27 restantes côté FT et 36 côté base ne sont **pas** des créations et fermetures indépendantes : ce sont des fusions et des renommages. Sans cette table, les conseillers de `CHAMBERY MUDRY` seraient détachés au lieu d'atterrir sur `CHAMBERY`.

**La réaffectation a lieu en mode nominal, dans la boucle de suppression, et pas avant.** L'agence successeur n'existe pas tant qu'elle n'a pas été créée : `CHAMBERY` (safir `73014`) est une orpheline FT au moment de la réconciliation. Dans `appliquerDiff`, les créations précèdent les suppressions à l'intérieur de la même transaction, donc la cible est disponible au moment où la source est supprimée.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter dans `test/application/jobs/maj-referentiel-agences-ft.job.handler.db.test.ts` :

```typescript
  it("rattache les conseillers d'une agence fusionnee a son successeur", async () => {
    // Given
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '527',
        nomAgence: 'Agence France Travail CHAMBERY MUDRY',
        codeDepartement: '73',
        codeSafir: 'ANCIEN-73'
      })
    )
    await ConseillerSqlModel.create(
      unConseillerDto({ id: 'CONSEILLER-73', idAgence: '527' })
    )
    await CommuneSqlModel.create(
      uneCommuneDto({ id: '73065-73000', code: '73065', codeDepartement: '73' })
    )
    poleEmploiClient.getAgencesFT.resolves(
      success([
        agenceFTPornic,
        {
          code: 'ARA0204',
          codeSafir: '73014',
          libelle: 'CHAMBERY',
          libelleEtendu: 'Agence France Travail CHAMBERY',
          type: 'APE',
          codeRegionINSEE: '52',
          adressePrincipale: { communeImplantation: '73065' }
        }
      ])
    )

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbConseillersReaffectes).to.equal(1)
    expect(stats.nbConseillersDetaches).to.equal(0)

    const conseiller = await ConseillerSqlModel.findByPk('CONSEILLER-73')
    expect(conseiller!.idAgence).to.equal('73014')
    expect(await AgenceSqlModel.findByPk('527')).to.equal(null)
  })

  it('detache les conseillers quand la fermeture est sans successeur', async () => {
    // Given
    await AgenceSqlModel.create(
      uneAgenceDto({
        id: '556',
        nomAgence: 'Agence France Travail MIRIBEL',
        codeDepartement: '01',
        codeSafir: 'ANCIEN-01'
      })
    )
    await ConseillerSqlModel.create(
      unConseillerDto({ id: 'CONSEILLER-01', idAgence: '556' })
    )
    poleEmploiClient.getAgencesFT.resolves(success([agenceFTPornic]))

    // When
    const suivi = await handler.handle()

    // Then
    const stats = suivi.resultat as StatsMajAgencesFT
    expect(stats.nbConseillersReaffectes).to.equal(0)
    expect(stats.nbConseillersDetaches).to.equal(1)

    const conseiller = await ConseillerSqlModel.findByPk('CONSEILLER-01')
    expect(conseiller!.idAgence).to.equal(null)
  })
```

Le premier test place l'ancienne agence avec un `code_safir` que FT ne renvoie plus : c'est ce qui la range parmi les suppressions. Le second vérifie que le détachement reste le comportement par défaut hors correspondance.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `yarn test:local:db --grep "fusionnee a son successeur"`
Expected: FAIL — `expected null to equal '73014'`, le conseiller ayant été détaché.

- [ ] **Step 3: Écrire la table de correspondance**

`src/application/jobs/data/correspondances-agences-ft.ts` :

```typescript
export const CORRESPONDANCES_AGENCES_FT: Record<string, string> = {
  '1223': '13017',
  '1243': '13452',
  '1264': '84511',
  '1240': '13421',
  '1221': '13090',
  '1006': '97601',
  '928': '93035',
  '1332': '00958',
  '527': '73014',
  '529': '73014',
  '727': '57040',
  '731': '57040',
  '857': '60283',
  '861': '60283',
  '1038': '24013',
  '1041': '24013',
  '1100': '50013',
  '1101': '50013',
  '543': '42135',
  '839': '62693',
  '973': '77093',
  '906': '91074',
  '1065': '86014',
  '555': '01019',
  '1222': '13050',
  '843': '80011',
  '851': '80492'
}
```

Les 25 entrées ci-dessus sont les renommages et fusions confirmés : 8 renommages 1→1 établis sans ambiguïté sur le dump du 2026-09-03, 5 fusions n→1, et 7 cas confirmés le 2026-09-04 après vérification croisée base/FT — les six déménagements probables (`543`, `839`, `973`, `906`, `1065`, `555`), et `1222` MARSEILLE SAINT CHARLES → `13050` MARSEILLE PORTE D'AIX. Ce dernier n'avait au départ qu'un indice géographique faible (Porte d'Aix est à quelques centaines de mètres de la gare Saint-Charles) ; le compte exact des agences Marseille des deux côtés — 11 en base, 11 chez FT, dix paires déjà appariées par le nom, un seul reste de chaque côté — ne laisse arithmétiquement aucune autre possibilité.

La répartition d'Amiens est confirmée le 2026-09-04 : `843` DURY → `80011` SUD, `851` TELLIER → `80492` GARE (l'adresse FT de GARE, rue Paul Tellier, corrobore). `845` MILLEVOYE n'a pas de correspondance : c'est une vraie fermeture, elle rejoint la liste des détachements ci-dessous.

Les neuf agences suivantes sont de vraies fermetures sans successeur, et doivent détacher : `556`, `1235`, `621`, `1180`, `797`, `762`, `1001`, `1008`, `845`.

- [ ] **Step 4: Réaffecter au lieu de détacher quand un successeur existe**

Dans `appliquerDiff`, remplacer la boucle de suppression par :

```typescript
      const idParCodeSafir = new Map<string, string>()
      for (const agenceFT of agencesFT) {
        const existante = parCodeSafir.get(agenceFT.codeSafir)
        idParCodeSafir.set(agenceFT.codeSafir, existante?.id ?? agenceFT.codeSafir)
      }

      for (const agence of aSupprimer) {
        const codeSafirCible = CORRESPONDANCES_AGENCES_FT[agence.id]
        const idCible = codeSafirCible
          ? idParCodeSafir.get(codeSafirCible)
          : undefined

        const [nbConseillers] = await ConseillerSqlModel.update(
          { idAgence: idCible ?? null },
          { where: { idAgence: agence.id }, transaction }
        )
        if (idCible) stats.nbConseillersReaffectes += nbConseillers
        else stats.nbConseillersDetaches += nbConseillers

        const action = idCible ? 'agence_ft_fusionnee' : 'agence_ft_supprimee'
        rootLogger.info(
          {
            context: this.jobType,
            event: { action, outcome: 'success' },
            agence: {
              id: agence.id,
              nom: agence.nomAgence,
              idCible: idCible ?? null
            },
            nbConseillers
          },
          action
        )

        await AgenceSqlModel.destroy({ where: { id: agence.id }, transaction })
        stats.nbSupprimees++
      }
```

`idParCodeSafir` couvre aussi bien les agences déjà en base que celles créées plus haut dans la même transaction — une agence créée prend son `codeSafir` comme `id`, d'où le `?? agenceFT.codeSafir`.

Ajouter l'import :

```typescript
import { CORRESPONDANCES_AGENCES_FT } from './data/correspondances-agences-ft'
```

- [ ] **Step 5: Déclarer les nouveaux `event.action` dans la taxonomie**

Ajouter `agence_ft_fusionnee` et `agence_ft_supprimee` à la liste des `event.action` de l'api, dans `pass-emploi-tools/docs/logs-ecs/couverture-api.md`. Les conventions imposent que chaque repo tienne sa liste à jour : un `event.action` non déclaré n'est pas exploitable en dashboard.

- [ ] **Step 6: Lancer les tests**

Run: `yarn test:local:db --grep "MajReferentielAgencesFTJobHandler"`
Expected: PASS (7 tests : les 5 du job mensuel, plus 2 de correspondance)

- [ ] **Step 7: Vérifier la compilation et le lint**

Run: `yarn tsc --noEmit && yarn lint`
Expected: aucune erreur

- [ ] **Step 8: Commit**

```bash
git add src/application/jobs/data/correspondances-agences-ft.ts \
        src/application/jobs/maj-referentiel-agences-ft.job.handler.db.ts \
        test/application/jobs/maj-referentiel-agences-ft.job.handler.db.test.ts
git commit -m "feat: reaffecter les conseillers des agences fusionnees ou renommees"
```

---

### Task 10: Verrouiller `agence.code_region` sur le référentiel

**Files:**
- Create: `src/infrastructure/sequelize/migrations/20260903000004-agence-fk-region.js`
- Create: `test/infrastructure/sequelize/models/agence.sql-model.db.test.ts`

**Interfaces:**
- Consumes: `RegionSqlModel` (Task 1), `agence.code_region` renseigné par les Tasks 7 et 8.
- Produces: la contrainte `agence_code_region_fkey`, et l'alignement de `agence.nom_region` sur `region.libelle`.

Sans cette tâche, le lien entre la table `region` et les agences n'est que comportemental : le job écrit les bonnes valeurs, mais rien n'empêche une écriture ultérieure — un autre job, une reprise manuelle, la création d'agence MILO — de réintroduire une orthographe divergente. C'est précisément le mode de panne que la table `region` doit éliminer.

**Ordonnancement.** Une clé étrangère tolère `NULL`, donc cette tâche ne dépend pas du remplissage des 894 lignes FT : elle est exécutable dès la Task 2. La placer après la Task 8 la rend seulement plus démonstrative. Si les Tasks 7 et 8 sont développées après elle, la contrainte fait échouer bruyamment tout code de région inventé par le job — un filet utile pendant le développement.

Le passage de `code_region` en `NOT NULL` reste **hors périmètre** : il n'est possible qu'après la première réconciliation réelle, et seulement si les 2 agences `PASS_EMPLOI` et les 2 `MILO` aujourd'hui sans code trouvent une région.

- [ ] **Step 1: Vérifier qu'aucune donnée ne bloque la contrainte**

Sur staging comme sur production, avant d'écrire quoi que ce soit :

```sql
select structure, code_region, nom_region, count(*)
from agence
where code_region is not null
  and code_region not in (select code from region)
group by 1, 2, 3;
```

Mesuré sur staging le 2026-09-03, avant l'ajout de `10 Saint-Martin` au référentiel : une ligne (`MILO`, `10`, `Saint Martin`). Après cet ajout : aucune. **Si production remonte un code inconnu, l'arbitrer et l'ajouter à `regions.json` avant de continuer** — la migration échoue volontairement plutôt que d'écraser une valeur.

- [ ] **Step 2: Écrire le test qui échoue**

`test/infrastructure/sequelize/models/agence.sql-model.db.test.ts` :

```typescript
import { ForeignKeyConstraintError } from 'sequelize'
import { AgenceSqlModel } from 'src/infrastructure/sequelize/models/agence.sql-model'
import { RegionSqlModel } from 'src/infrastructure/sequelize/models/region.sql-model'
import { uneAgenceDto } from 'test/fixtures/sql-models/agence.sql-model'
import { uneRegionDto } from 'test/fixtures/sql-models/region.sql-model'
import { expect, getDatabase } from 'test/utils'

describe('AgenceSqlModel', () => {
  beforeEach(async () => {
    await getDatabase().cleanPG()
    await RegionSqlModel.create(uneRegionDto({ code: '52' }))
  })

  it('accepte un code region present dans le referentiel', async () => {
    // When
    await AgenceSqlModel.create(uneAgenceDto({ id: '1', codeRegion: '52' }))

    // Then
    const agence = await AgenceSqlModel.findByPk('1')
    expect(agence!.codeRegion).to.equal('52')
  })

  it('accepte une agence sans code region', async () => {
    // When
    await AgenceSqlModel.create(uneAgenceDto({ id: '2', codeRegion: null }))

    // Then
    const agence = await AgenceSqlModel.findByPk('2')
    expect(agence!.codeRegion).to.equal(null)
  })

  it('refuse un code region absent du referentiel', async () => {
    // When
    const promise = AgenceSqlModel.create(
      uneAgenceDto({ id: '3', codeRegion: 'ZZ' })
    )

    // Then
    await expect(promise).to.be.rejectedWith(ForeignKeyConstraintError)
  })
})
```

- [ ] **Step 3: Lancer le test pour vérifier qu'il échoue**

Run: `yarn test:local:db --grep "AgenceSqlModel"`
Expected: FAIL sur le troisième test — la création en `ZZ` réussit aujourd'hui.

- [ ] **Step 4: Écrire la migration**

`src/infrastructure/sequelize/migrations/20260903000004-agence-fk-region.js` :

```javascript
'use strict'

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async transaction => {
      const [inconnus] = await queryInterface.sequelize.query(
        `select distinct code_region from agence
         where code_region is not null
           and code_region not in (select code from region)`,
        { transaction }
      )

      if (inconnus.length) {
        throw new Error(
          'codes region absents du referentiel: ' +
            inconnus.map(ligne => ligne.code_region).join(', ')
        )
      }

      await queryInterface.sequelize.query(
        `update agence set nom_region = region.libelle
         from region
         where agence.code_region = region.code
           and agence.nom_region is distinct from region.libelle`,
        { transaction }
      )

      await queryInterface.addConstraint('agence', {
        type: 'foreign key',
        fields: ['code_region'],
        name: 'agence_code_region_fkey',
        references: {
          table: 'region',
          field: 'code'
        },
        onUpdate: 'CASCADE',
        transaction
      })
    })
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('agence', 'agence_code_region_fkey')
  }
}
```

**`transaction` doit être à l'intérieur de l'objet passé à `addConstraint`, pas en paramètre séparé** — contrairement à `queryInterface.sequelize.query(...)`, `addConstraint` fusionne `transaction` dans ses propres options (voir `20230630142821-ajout-cascade-rendez-vous-jeune-association.js`). L'omettre ne produit aucune erreur immédiate : `addConstraint` s'exécute alors sur une connexion séparée du pool, hors de la transaction ouverte par l'`UPDATE` juste au-dessus. L'`ALTER TABLE` tente de verrouiller `agence`, déjà verrouillée par l'`UPDATE` non validé de la transaction en cours ; cette transaction, elle, attend que la promesse `addConstraint` se résolve avant de pouvoir `COMMIT`. Aucune des deux ne peut avancer — un auto-interblocage silencieux, sans message d'erreur, la migration restant bloquée indéfiniment.

L'`UPDATE` aligne les libellés sur le référentiel. Sur staging il touche une seule ligne : l'agence MILO `97801S00`, `Saint Martin` → `Saint-Martin`. Elle porte **0 conseiller**, donc la césure d'historique dans `evenement_engagement` est nulle en pratique. Sur production, relancer la requête du Step 1 en `is distinct from` pour compter les lignes touchées avant de déployer.

Pas de `onDelete` : supprimer une région dont dépendent des agences doit échouer, ce qui est le comportement par défaut.

- [ ] **Step 5: Lancer les tests**

Run: `yarn test:local:db --grep "AgenceSqlModel"`
Expected: PASS (3 tests)

Puis la suite complète des tests base, la contrainte pouvant casser des fixtures existantes :

Run: `yarn test:local:db`
Expected: PASS — si une fixture crée une agence avec un `codeRegion` non seedé, lui passer `codeRegion: null` ou créer la région dans le `beforeEach`.

- [ ] **Step 6: Vérifier la compilation et le lint**

Run: `yarn tsc --noEmit && yarn lint`
Expected: aucune erreur

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/sequelize/migrations/20260903000004-agence-fk-region.js \
        test/infrastructure/sequelize/models/agence.sql-model.db.test.ts
git commit -m "feat: adosser le code region des agences au referentiel"
```

---

## Mise en service

Après déploiement des dix tâches :

1. `yarn tasks:initialiser-les-crons` pour enregistrer le cron mensuel.
2. Réconciliation en dry-run : `TASK_NAME=RECONCILIER_AGENCES_FT`, sans poser `JOB_RECONCILIATION_AGENCES_FT_DRY_RUN=false` (le dry-run est actif par défaut). Relire le `resultat` du `SuiviJob` : `nbAppariees` doit être proche de 880 (858 par nom + 22 via la table de correspondance : 17 renommages + 1 gagnant par fusion sur 5), `nbAmbigues` à 0, et `nbOrphelinesFT` / `nbOrphelinesBase` annoncent ce que le job mensuel créera et supprimera — mesuré à 5 et 14 le 2026-09-04.
3. **Noter la valeur de `nbOrphelinesBase`.** C'est le nombre exact d'agences que le premier passage du job mensuel supprimera : les perdants des fusions (déjà dans `CORRESPONDANCES_AGENCES_FT`, réaffectés) et les vraies fermetures (détachées). Le plafond par défaut vaut `max(5, 2 % du parc)`, soit 17 agences pour 894 — et la mesure du 2026-09-04, après le correctif ci-dessus, en donne **14**. Le premier passage tiendrait donc **sous le plafond par défaut**, sans réglage particulier — à reconfirmer sur le dry-run de production avant de conclure que les étapes 7 et 9 sont inutiles.
4. Les sept déménagements probables (dont Marseille) et la répartition d'Amiens sont confirmés et déjà dans `CORRESPONDANCES_AGENCES_FT` depuis le 2026-09-04, et consultés par la réconciliation elle-même (voir la révision post-implémentation en tête de ce document) — cette étape est donc déjà faite pour le dry-run de l'étape 2.
5. Rejouer la réconciliation avec `JOB_RECONCILIATION_AGENCES_FT_DRY_RUN=false`.
6. Vérifier qu'aucune agence FT résolue n'a de `code_safir` nul (14 orphelines subsisteront, c'est attendu) :

   ```sql
   select count(*) from agence
   where structure = 'POLE_EMPLOI' and code_safir is null;
   ```

7. **Si la mesure de production dépasse le plafond par défaut**, le relever pour le seul premier passage : poser `JOB_MAJ_AGENCES_FT_NOMBRE_SUPPRESSIONS_MIN` à la valeur **exacte** de `nbOrphelinesBase` relevée à l'étape 3. Pas un chiffre rond, pas de marge : ainsi calé, le plafond laisse passer la reprise attendue et arrête le job si la réalité diffère de ce que le dry-run annonçait. Une marge confortable rouvrirait le trou que le plafond existe pour boucher. Avec 14 mesurées en local, cette étape peut ne pas être nécessaire — mais la mesure de production fait foi.
8. Déclencher le premier passage à la main : `TASK_NAME=MAJ_REFERENTIEL_AGENCES_FT`. Relire le `SuiviJob` : `nbSupprimees` doit valoir exactement le `nbOrphelinesBase` annoncé, et `nbCreees` le `nbOrphelinesFT`.
9. **Si le plafond a été relevé à l'étape 7, le retirer** pour rendre au plafond sa valeur de garde. Les passages suivants ne traitent plus que les mouvements d'un mois, où quelques suppressions sont la norme et où un pic est justement le signal qu'on veut voir.
10. Laisser le cron mensuel prendre le relais.
11. Une fois les 894 lignes FT pourvues d'un `code_region`, envisager le passage de la colonne en `NOT NULL` — il reste alors à trancher le cas des 2 agences `PASS_EMPLOI` et des 2 `MILO` (`INCONNU`, `TEST`) qui n'ont aucune région.

**Hors périmètre de ce plan**, à traiter une fois le référentiel complet : la suppression de `conseiller.nom_manuel_agence` et le filtrage éventuel sur `type`.
