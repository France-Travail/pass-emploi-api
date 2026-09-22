# Référentiel des agences France Travail — design

> Statut : validé le 2026-09-02, complété le 2026-09-03 (appel API, réconciliation en
> mode du job, résultats du dry-run sur le dump complet), **révisé le 2026-09-03** :
> la réconciliation devient un job one-off distinct du job mensuel, et le plafond est
> relevé le temps du premier passage. En attente de plan
> d'implémentation.
> Périmètre : `structure = 'POLE_EMPLOI'` uniquement. MILO n'est jamais touché.

## Objectif

Rendre les statistiques régionales fiables. Aujourd'hui elles ne le sont pas, pour
deux raisons distinctes :

1. **Les conseillers sans agence sortent des stats.** Quand un conseiller ne trouve
   pas son agence dans le référentiel, il saisit son nom en texte libre
   (`conseiller.nom_manuel_agence`) et `id_agence` reste `NULL`. Le job analytics
   joint sur `id_agence` avec `where id_agence is not null`
   (`2-enrichir-les-evenements.job.ts:129-131`) : ces conseillers **et tous leurs
   jeunes** ont `agence`, `departement` et `region` à `NULL` dans
   `evenement_engagement`. Ils ne faussent pas les totaux régionaux, ils en
   disparaissent.
2. **Les libellés de région sont dédoublés.** Deux orthographes coexistent selon le
   chemin d'écriture, corrigées aujourd'hui par des rustines en dur
   (`conseiller.milo.db.ts:194-197` : `'Grand-Est'` → `'Grand Est'`,
   `"Provence-Alpes-Côte-d'Azur"` → `"Provence-Alpes-Côte d'Azur"`).

La réponse aux deux : faire de l'API agences de francetravail.io la source de vérité
du référentiel FT, et adosser les régions à une table référentielle.

`nom_manuel_agence` sera supprimée dans un second temps, une fois le référentiel
complet — c'est la condition, pas l'inverse. Hors périmètre de cette spec.

## Modèle de données

### Table `region`

| Colonne | Type | Note |
|---|---|---|
| `code` | STRING, PK | code région INSEE |
| `libelle` | STRING | |

Les clés sont les codes tels que **FT les émet** dans `codeRegionINSEE` — les 18 codes
région INSEE, plus `05` que FT attribue à Saint-Pierre-et-Miquelon (qui n'est pas une
région INSEE mais une COM). Pas de pseudo-code à inventer : le référentiel suit la
source de vérité, sinon la jointure sur `codeRegionINSEE` échoue.

Les libellés sont repris **à l'identique** de ceux en base : `evenement_engagement.region`
est une copie dénormalisée figée, une orthographe différente scinderait la région en
deux valeurs dans les dashboards.

**Contenu, dérivé des 858 paires appariées — zéro conflit :**

| code | libellé | | code | libellé |
|---|---|---|---|---|
| `01` | Guadeloupe | | `32` | Hauts-de-France |
| `02` | Martinique | | `44` | Grand Est |
| `03` | Guyane | | `52` | Pays de la Loire |
| `04` | La Réunion | | `53` | Bretagne |
| `05` | Saint-Pierre-et-Miquelon | | `75` | Nouvelle-Aquitaine |
| `06` | Mayotte | | `76` | Occitanie |
| `11` | Île-de-France | | `84` | Auvergne-Rhône-Alpes |
| `24` | Centre-Val de Loire | | `93` | Provence-Alpes-Côte d'Azur |
| `27` | Bourgogne-Franche-Comté | | `94` | Corse |
| `28` | Normandie | | | |

Chacun des 19 codes ne s'associe qu'à un seul libellé sur l'ensemble des paires. Le
mapping n'est donc pas une hypothèse : il est établi.

`region` devient la **seule source d'écriture** des libellés de région. Les rustines
de `conseiller.milo.db.ts:194-197` sont remplacées par un lookup.

### Colonne `departement.code_region`

FK vers `region.code`. Ferme la chaîne `commune → département → région`, qui n'existe
pas aujourd'hui : `departement` n'a que `code` + `libelle`, `commune` s'arrête à
`code_departement`.

Le mapping est **entièrement dérivable des données actuelles**, sans source externe.
Croisé sur les 858 paires appariées — `communeImplantation` → `commune` → département
d'un côté, `codeRegionINSEE` de l'autre — il couvre **103 départements avec zéro
conflit**. Les 103 sont les 101 lignes de `departement`, plus `975` et `978` qui en
sont absentes (voir ci-dessous).

### Corrections de référentiel

Sans elles la chaîne ne joint pas. Indépendantes de l'import FT, elles bénéficient
aussi à MILO.

- **Corse** — `agence.code_departement` vaut `'20'`, mais `departement` ne connaît que
  `2A` et `2B`. La jointure agence → département échoue aujourd'hui pour la Corse.
  Bloquant pour la réconciliation, qui compare les départements.
- **Départements d'outre-mer manquants** — `commune` référence les départements `975`
  (Saint-Pierre-et-Miquelon) et `978` (Saint-Martin), mais `departement` n'a de ligne
  ni pour l'un ni pour l'autre. Deux agences FT sont concernées (`SPM0001` et
  `GUA0070`). Les autres codes d'outre-mer (971, 972, 973, 974, 976) sont bien
  présents, ainsi que `2A` et `2B`.

### Colonne `agence.code_safir`

STRING, nullable, unique sur le périmètre `POLE_EMPLOI`. Clé de réconciliation avec
FT et identifiant des agences créées par le job.

### `agence.nom_region` reste dénormalisée

Écrite depuis `region`, pas remplacée par une FK. Le job analytics lit
`agence.nom_region` en SQL brut (`2-enrichir-les-evenements.job.ts:123`) et
`evenement_engagement.region` est de toute façon une copie figée : passer en FK
obligerait à réécrire ces requêtes pour zéro gain sur les stats.

## Appel à l'API France Travail

| | |
|---|---|
| Route | `referentielagences/v1/agences`, relative à `POLE_EMPLOI_API_BASE_URL` (`https://api.francetravail.io/partenaire`) |
| Authentification | bearer token existant, `getToken()` / `getWithRetry` |
| Scopes | `api_referentielagencesv1 organisationpe`, déjà présents dans `POLE_EMPLOI_SCOPE` |
| Pagination | aucune — la réponse est la liste complète en un appel |

Le token est unique et partagé par toute l'intégration FT (`pole-emploi-client.ts:344-364`).
Aucun changement de configuration n'est nécessaire : les scopes sont déjà accordés au
`client_id`, ce que confirme le fonctionnement des appels FT actuels.

DTO de réponse, champs observés :

```ts
{
  code: string                 // 'PDL0092'
  codeSafir: string            // '44155'
  libelle: string              // 'NANTES MALAKOFF'
  libelleEtendu: string        // 'Agence France Travail NANTES MALAKOFF'
  siret: string
  type: string                 // 'APE'
  typeAccueil: string
  codeRegionINSEE: string      // '52'
  dispositifADEDA: boolean
  contact: { telephonePublic: string; email: string }
  adressePrincipale: {
    ligne4: string; ligne5: string; ligne6: string
    gpsLon: number; gpsLat: number
    communeImplantation: string  // '44109'
    bureauDistributeur: string
  }
  zoneCompetences?: Array<{ communeInsee: string }>
}
```

Champs consommés : `codeSafir`, `libelle`, `libelleEtendu`, `codeRegionINSEE`,
`adressePrincipale.communeImplantation`. Tout le reste est ignoré.

`zoneCompetences` — liste des communes couvertes par l'agence, obtenue via un
paramètre optionnel — n'est pas repris : `agence` ne modélise qu'un seul
`code_departement`. Si le besoin apparaît, c'est une table de liaison à part.

## Réconciliation initiale (job one-off distinct)

C'est le seul moment où l'appariement se fait sans clé. Ce n'est **pas un script
Node nu** : les scripts de `scripts/data-migrations/` sont sans contexte NestJS
(`structures-milo-dans-agences.js:1-6`), donc sans accès à `PoleEmploiClient` — il
faudrait y ré-implémenter le token OAuth, le scope et le retry, c'est-à-dire dupliquer
la partie la plus fragile.

C'est un **job à part entière, mais sans cron** : `RECONCILIER_AGENCES_FT`, déclenché
à la main par `TASK_NAME=RECONCILIER_AGENCES_FT`. `TaskService.handle` fait
`const isCronJob = task in Planificateur.JobType` (`task.service.ts:33`), donc tout
membre de l'enum est exécutable en one-off avec l'injection Nest complète, et
`InitCronsCommandHandler` ne planifie que les entrées du tableau des crons — n'y rien
mettre suffit à le rendre strictement manuel. Il **n'a aucun chemin de suppression ni
de création** : il apparie, écrit `code_safir`, aligne `nom_agence` et la région. Rien
d'autre.

**Révision du 2026-09-03 : ce n'est plus un mode du job mensuel.** La version
précédente logeait réconciliation et diff dans un même handler, avec sélection
automatique du mode sur la présence de `code_safir IS NULL`. Deux raisons de séparer :
une reprise de données qui ne tourne qu'une fois n'a rien à faire dans un exécutable
planifié, et le mode automatique faisait porter au job mensuel une branche morte
douze fois par an. Le job mensuel gardait le test sur `code_safir IS NULL`, mais comme
**garde-fou d'arrêt** et non comme aiguillage : il refusait de démarrer, avant même
l'appel HTTP, tant que la réconciliation n'avait pas été faite. **Ce garde-fou a été
retiré le 2026-09-07** : voir la révision post-implémentation du même jour dans le
plan — il s'est avéré bloquer le job de façon permanente une fois qu'un résidu
d'agences durablement non réconciliables (fusions perdantes, fermetures sans
successeur) existe, ce qui est l'état stable attendu. Le plafond de suppression
couvre déjà le scénario qu'il visait à empêcher. Le code commun — la
normalisation des noms, les tables de correspondance commune → département et
code → libellé — vit dans un module partagé.

**Appariement** sur `(nom normalisé, code_departement)` :

- normalisation du nom en base : retrait du préfixe — `Agence Pôle emploi ` (848
  lignes), `Relai Pôle emploi ` (40), `Agence spécialisée Pôle emploi ` (6) — puis
  d'un éventuel `RPE ` résiduel, puis majuscules, retrait des accents via
  `remove-accents` (déjà une dépendance, utilisée par le job ROME), réduction de la
  ponctuation à des espaces, et enfin `SAINT`→`ST` / `SAINTE`→`STE`.
- les deux dernières règles ne sont pas théoriques : sans le `RPE `,
  `Relai Pôle emploi RPE YSSINGEAUX` et `RPE VARENNES` n'apparient pas (FT renvoie
  `YSSINGEAUX` et `VARENNES`) ; sans `SAINT`→`ST`, deux agences supplémentaires
  échouent.
- côté FT, `libelle` est le nom nu, directement comparable. Un
  `Relai Pôle emploi SAIN BEL` s'apparie donc à `SAIN BEL` quel que soit le
  `libelleEtendu` que FT lui attribue.
- département : `agence.code_departement` contre celui dérivé de
  `adressePrincipale.communeImplantation` via `commune`. **La correction Corse doit
  être passée avant.**

**Exécution en deux temps.** Le job tourne d'abord en dry-run et produit un rapport :
appariées, ambiguës, orphelines des deux côtés groupées par département, et
distribution du champ `type`. Le rapport est relu, puis l'écriture est lancée.

### Résultat mesuré sur le dump complet contre la base de staging (2026-09-03)

Vérifications préalables sur `pass-emploi-api-staging`, en lecture seule :

- `agence` contient **894 lignes `POLE_EMPLOI`** (plus 451 `MILO` et 2 `PASS_EMPLOI`),
  et les `nom_agence` sont **strictement identiques** à `agences_pe.json` — le seed
  n'a pas dérivé, l'analyse porte donc sur les données réelles.
- `code_region` est **vide sur les 894**, comme attendu : la migration
  `20231214114516` a créé la colonne sans jamais la remplir côté FT.
- `nom_region` prend **19 valeurs distinctes**, `code_departement` est renseigné partout.
- **Aucun `rendez_vous` n'est rattaché à une agence `POLE_EMPLOI`** (0 sur toute la
  table) : l'`id_agence` des rendez-vous est bien un concept MILO, comme le laissait
  penser le code.

| | |
|---|---|
| Appariées | **858 / 885 (97,0 %)**, dont 857 sur `(nom, département)` et 1 sur le nom seul |
| Ambiguës | **0** |
| Dans FT, absentes en base | 27 |
| En base, absentes de FT | 36 |
| `codeSafir` dupliqués | 0 |
| `communeImplantation` hors référentiel | 0 |
| Répartition FT | 838 `APE`, 39 `RPE`, 8 `APES` (base : 848 / 40 / 6) |

**Les 63 non-appariées ne sont pas des créations et des fermetures indépendantes.**
Groupées par département, ce sont très majoritairement des réorganisations :

- **Fusions n→1** : `CHAMBERY MUDRY` + `CHAMBERY GD VERGER` → `CHAMBERY` ;
  `FORBACH VILLE HAUTE` + `FORBACH CARREFOUR EUROPE` → `FORBACH` ;
  `CREIL SAINT MAXIMIN` + `CREIL NOGENT` → `CREIL BORDS DE L'OISE` ;
  `PERIGUEUX CHANGE` + `PERIGUEUX LITTRE` → `PERIGUEUX` ;
  `CHERBOURG CENTRE` + `CHERBOURG LaNoé` → `CHERBOURG LES TOURELLES` ;
  `AMIENS DURY` + `MILLEVOYE` + `TELLIER` → `AMIENS SUD` + `AMIENS GARE` (3→2).
- **Renommages 1→1** : `CHATEAU-GOMBERT` → `MARSEILLE CHATEAU-GOMBERT` ;
  `BLANCARDE` → `MARSEILLE BLANCARDE` ; `REALPANIER` → `AVIGNON REALPANIER` ;
  `ISTRES` → `OUEST PROVENCE I` ; `MIRAMAS` → `OUEST PROVENCE M` ;
  `PE MAMOUDZOU KAWENI` → `KAWENI` ; `AVS Placement Techniciens` →
  `AVS Technicien & journaliste` ; `Croix Nivert` → `Spectacle Paris` (l'adresse FT de
  cette dernière est bien 202 rue de la Croix Nivert).
- **Déménagements probables**, à confirmer : `SAINT ETIENNE TERRASSE` →
  `ST ETIENNE TECHNOPOLE`, `SAINT-POL-SUR-TERNOISE` → `HERLIN-LE-SEC`, `Torcy` →
  `Lognes`, `Brunoy` → `Yerres`, `POITIERS-GRAND LARGE` → `POITIERS SAINT BENOIT`,
  `MEXIMIEUX` → `MONTLUEL`.
- **Fermetures sans successeur** (~9) : `MIRIBEL`, `PORT DE BOUC`, `CROZON`,
  `TOULOUSE OCCITANE`, `LILLE REPUBLIQUE`, `STRASBOURG SEYBOTH`,
  `MARSEILLE SAINT CHARLES`, `A2S MARTINIQUE`, `DZOUMOGNE`.
- **Créations réelles** (~5) : les trois autres agences « Spectacle »,
  `AUXERRE BRICHERES`, `COMBANI`.

### Table de correspondance (conséquence directe)

Traiter ces 63 lignes mécaniquement produirait 36 suppressions et 27 créations, donc
détacherait les conseillers de 36 agences dont **la plupart ont un successeur
identifiable**. Les conseillers de `CHAMBERY MUDRY` doivent atterrir sur `CHAMBERY`,
pas repartir de zéro.

La réconciliation intègre donc une **table de correspondance manuelle**
`id base → codeSafir cible`, établie une seule fois à partir de ce rapport. Pendant la
réconciliation, elle réaffecte `conseiller.id_agence` vers l'agence cible avant toute
suppression. Seules les fermetures sans successeur entraînent un détachement.

**Révision du 2026-09-04.** Les 27 entrées de la table de correspondance ne sont
pas toutes de même nature : 17 sont de purs renommages 1→1 (`CHATEAU-GOMBERT` →
`MARSEILLE CHATEAU-GOMBERT`) — c'est la **même** agence, seulement rebaptisée par FT,
sans aucune raison de la supprimer. Les 5 restantes sont de vraies fusions n→1
(`CHAMBERY MUDRY` + `CHAMBERY GD VERGER` → `CHAMBERY`), où une des deux lignes doit
réellement disparaître.

La première version de ce plan ne consultait la table que dans le job mensuel, au
moment de la suppression — traitant à tort les 17 renommages comme des fusions.
Conséquence : ces 17 agences restaient orphelines (`code_safir` nul) pour toujours,
puisque la réconciliation ne les appariait jamais par nom et que rien d'autre ne leur
écrivait de `code_safir`.

Corrigé : la réconciliation consulte désormais aussi la table de correspondance,
en plus de l'appariement par nom. Une agence base avec une entrée dans la table est
traitée comme appariée — `code_safir`, nom et région sont écrits sur sa ligne
existante, exactement comme un appariement par nom. Pour une fusion n→1, seule la
première agence rencontrée réclame le `code_safir` (contrainte d'unicité oblige) ;
l'autre reste orpheline et suit le chemin suppression + réaffectation du job mensuel,
inchangé.

Effet sur les 36 orphelines mesurées, **vérifié par un dry-run réel en local le
2026-09-04** : `nbAppariees` passe de 858 à 880, `nbOrphelinesFT` de 27 à 5,
`nbOrphelinesBase` de 36 à 14. Le détail : les 17 renommages 1→1 gagnent tous, plus
1 gagnant par fusion sur les 5 fusions n→1 (17+5=22 résolues). Restent orphelines les
5 perdants des fusions (supprimés par le job mensuel, conseillers réaffectés au
gagnant via la même table) et les 9 vraies fermetures sans successeur. La table de
correspondance ne réduit donc plus le nombre de suppressions du job mensuel à zéro,
mais le fait passer de 36 à 14.

Ces 36 suppressions dépassent le plafond `max(5, 2 %)` ≈ 17 — le job refuserait
d'exécuter ce diff. **Décision : relever `JOB_MAJ_AGENCES_FT_NOMBRE_SUPPRESSIONS_MIN`
à la valeur exacte de `nbOrphelinesBase` mesurée au dry-run, le temps du premier
passage, puis retirer la variable.** Calé sur la valeur exacte plutôt que sur un
chiffre rond, le plafond laisse passer la reprise attendue et arrête quand même le job
si la réalité s'écarte de ce que le dry-run annonçait. Le premier diff n'est pas un
mois de mouvements : il solde d'un coup les réorganisations accumulées depuis le
dernier peuplement manuel de la table.

**Ce qu'il écrit** : `code_safir`, et `nom_agence` aligné sur `libelleEtendu` — le
rebranding Pôle emploi → France Travail, décidé explicitement (voir Arbitrages).

## Job mensuel

`MAJ_REFERENTIEL_AGENCES_FT`, handler
`src/application/jobs/maj-referentiel-agences-ft.job.handler.db.ts`.

Décalqué de `MajReferentielRomeJobHandler`, à une différence structurante près : ROME
fait `destroy({ truncate: true })` puis `bulkCreate`
(`maj-referentiel-rome.job.handler.db.ts:69-71`). Impossible ici, à cause de la FK
`conseiller.id_agence`.

- **Cron** : `'0 4 1 * *'` — le 1er du mois à 4h, une heure après ROME
  (`'0 3 1 * *'`, `planificateur.ts:327`) pour ne pas empiler deux appels FT.
- **Client** : méthode `getAgencesFT()` sur `PoleEmploiClient`, via `getWithRetry`
  qui gère déjà token et retry (`pole-emploi-client.ts:210-223` comme modèle). Voir
  la section « Appel à l'API France Travail ». Aucun changement de configuration.
- **Déclenchement manuel** : `TASK_NAME=MAJ_REFERENTIEL_AGENCES_FT`.
- **Scope SQL** : `structure = 'POLE_EMPLOI'`. `getStructureDeReference()`
  (`domain/core.ts:66-73`) ramène toutes les structures FT à `POLE_EMPLOI`, donc ce
  filtre couvre bien tout le périmètre FT sans jamais toucher MILO.

### Diff

L'identité d'une agence est son `code_safir`. **Un renommage ne peut donc jamais
produire une suppression.**

| Cas | Action |
|---|---|
| `code_safir` dans FT, absent en base | INSERT. `id` = `codeSafir`, `nom_agence` = `libelleEtendu`, `code_region` = `codeRegionINSEE`, `nom_region` lu depuis `region`, `code_departement` dérivé de `communeImplantation` via `commune` |
| `codeRegionINSEE` absent de la réponse | région dérivée par la chaîne `communeImplantation → commune → departement → region`. Concerne les agences spécialisées nationales (les quatre agences « Spectacle », `type: APES`), qui n'ont pas de région chez FT |
| `code_safir` des deux côtés | UPDATE des champs qui diffèrent : `nom_agence`, `code_region`, `nom_region`, `code_departement`. `id` n'est jamais modifié |
| `code_safir` en base, absent de FT | Dans la même transaction : `UPDATE conseiller SET id_agence = NULL` sur les conseillers rattachés, puis `DELETE FROM agence` |

Une agence supprimée puis rouverte par FT revient par un simple INSERT au run suivant.
Elle reprend alors son `codeSafir` comme `id`, alors que les 894 lignes d'origine
gardent leurs ids numériques : l'id change. Sans conséquence, les conseillers
concernés ayant été détachés et ayant re-choisi entre-temps, et
`evenement_engagement` stockant des libellés et non des ids.

### Conseillers détachés

Un conseiller à `id_agence = NULL` sans `nom_manuel_agence` est exactement dans
l'état d'un conseiller neuf : `conseillers.mappers.ts:23-33` n'expose le champ
`agence` que si l'un des deux est renseigné, et `conseillers.query-model.ts:52` le
déclare optionnel. Le parcours de choix d'agence existant côté `pass-emploi-web`
s'applique donc tel quel, **sans développement supplémentaire**.

Le trou dans les stats dure jusqu'à la reconnexion du conseiller — de l'ordre de la
journée, les conseillers se connectant quotidiennement.

### Garde-fous

Ils sont porteurs, pas décoratifs : ils sont ce qui rend le DELETE acceptable.

Le risque n'est pas que FT se trompe, c'est qu'on n'ait pas reçu **toute** sa
réponse — dérive d'un filtre par défaut, panne partielle
côté FT, scope de token réduit renvoyant 200 avec moins de données. Dans tous ces
cas la réponse est bien formée et plus courte, et le code ne peut pas distinguer
« FT a fermé 400 agences » de « je n'ai lu qu'un tiers de la liste ».

1. **Plafond de suppression** — abandon total sans écriture, `succes: false`, si le
   nombre de suppressions dépasse `max(5 agences, 2 % des agences actives)`. Relevé
   temporairement pour le premier passage (voir plus haut).
2. **Réponse vide ou anormalement courte** — abandon, cas particulier du plafond.
3. **Réconciliation faite — retiré le 2026-09-07.** Le job mensuel refusait de
   démarrer, avant l'appel HTTP, tant qu'une agence `POLE_EMPLOI` avait `code_safir IS
   NULL`, pour éviter qu'un job lancé avant la réconciliation ne voie les 894 agences
   comme absentes du référentiel FT et ne tente de tout supprimer pour tout recréer.
   Retiré car il bloquait aussi l'état stable attendu (un résidu d'agences
   durablement sans `code_safir`) — le plafond de suppression ci-dessus couvre déjà
   le même scénario, sans jamais bloquer cet état stable.
4. **Dry-run** par variable d'environnement — calcule et logue le diff sans écrire.
   Obligatoire pour la première exécution. **Corrigé le 2026-09-07** : le calcul des
   stats (créations, mises à jour, suppressions, réaffectations, détachements) se
   fait desormais avant l'arrêt dry-run, pas seulement le calcul du plafond — sinon
   un dry-run réussi n'annonçait rien (toutes les stats à zéro), contrairement au job
   de réconciliation qui a toujours fait ce calcul en amont.
5. **Transaction unique**, comme ROME.

### Journalisation et suivi

Avant chaque suppression, un log ECS listant les agences supprimées et les conseillers
détachés (`event.action` au passé, `event.outcome`, conformément aux conventions de
`pass-emploi-tools/docs/logs-ecs/conventions.md`), pour que le support puisse répondre
à « j'ai perdu mon agence ».

`SuiviJob.resultat`, job mensuel : `{ dryRun, nbCreees, nbMisesAJour, nbSupprimees,
nbConseillersDetaches, nbConseillersReaffectes }`.

`SuiviJob.resultat`, réconciliation : `{ dryRun, nbAppariees, nbAmbigues,
nbOrphelinesFT, nbOrphelinesBase, nbMisesAJour }`. Les deux compteurs d'orphelines
annoncent exactement ce que le premier passage du job mensuel créera et supprimera —
c'est ce qui permet de caler le plafond avant de l'atteindre.

## Tests

Mocha / Chai / Sinon. `.db.test.ts` pour le job, Nock pour le client FT.

- création d'une agence inconnue
- mise à jour d'une agence renommée — **ne déclenche aucune suppression**
- suppression d'une agence disparue, avec détachement des conseillers rattachés
- réouverture : réapparition par INSERT
- plafond dépassé → abandon sans aucune écriture
- réponse vide → abandon
- agence sans `code_safir` → traitee comme une agence disparue par le job mensuel (supprimee, conseillers reaffectes ou detaches), plus de blocage au demarrage (retire le 2026-09-07)
- réconciliation : appariement par nom normalisé, y compris un `Relai Pôle emploi
  X` face au `libelle` `X`, et écriture de `code_safir`
- réconciliation : ni création ni suppression, quoi qu'annonce le référentiel FT
- dry-run → aucune écriture
- `structure = 'MILO'` intacte après exécution
- région dérivée du `codeRegionINSEE`
- département corse résolu

## Ordre de livraison

Chaque étape est livrable seule.

1. Table `region` + `departement.code_region` + corrections Corse et SPM. Remplace
   les rustines de `conseiller.milo.db.ts:194-197`.
2. Colonne `agence.code_safir`.
3. Client FT (`getAgencesFT`).
4. Job one-off de réconciliation, sans cron. Exécution en dry-run par `TASK_NAME`,
   revue du rapport, puis écriture.
5. Job mensuel (diff, garde-fous, cron) et table de correspondance.
6. Clé étrangère `agence.code_region` → `region.code`.
7. *Hors périmètre* : suppression de `nom_manuel_agence`.

## Arbitrages actés

- **Écrasement des noms** — `nom_agence` est aligné sur `libelleEtendu`, donc les 894
  lignes passent de « Agence Pôle emploi X » à « Agence France Travail X ».
  `evenement_engagement.agence` étant une copie figée, chaque agence apparaîtra sous
  deux libellés dans l'historique analytics, avant et après la bascule. Décidé en
  connaissance de cause. Option ouverte si les dashboards s'en plaignent : une
  migration de rattrapage réécrivant `evenement_engagement.agence` sur l'historique.
- **Suppression plutôt que fermeture** — pas de colonne `date_fermeture`. On ne garde
  pas d'agences mortes dans le référentiel. La réversibilité en cas de réponse API
  partielle est assurée par les garde-fous, pas par la conservation des lignes.
  Corollaire : `GetAgencesQueryHandler` n'a besoin d'aucun filtre, la table ne
  contenant que des agences vivantes.
- **Périmètre FT strict** — MILO conserve son alimentation actuelle par
  `conseiller.milo.db.ts`.

## Points ouverts

- Le traitement des orphelines de la réconciliation — agences en base que FT ne
  renvoie pas — est une décision manuelle ponctuelle, prise sur le rapport. Elles
  peuvent être de vraies agences fermées depuis 2022 comme des échecs d'appariement.
- Le rattachement du département `977` (Saint-Barthélemy) à la région `01`
  (Guadeloupe) : aucune agence FT ni MILO ne s'y trouve, donc aucune source ne le
  dicte. Une seule commune concernée, sans agence.
- **Filtre sur `type` : a priori non.** Trois valeurs observées sur un échantillon
  d'environ 600 agences, et elles correspondent exactement à nos trois préfixes :
  `APE` → « Agence France Travail » (base : « Agence Pôle emploi »), `RPE` → « Relai
  France Travail » (« Relai Pôle emploi »), `APES` → « Agence spécialisée France
  Travail » (« Agence spécialisée Pôle emploi »). On prend donc tout. À reconfirmer
  sur le dump complet via la distribution de `type` dans le rapport de dry-run.
- **`siret` n'est ni obligatoire ni unique.** Absent sur de nombreux `RPE`, et partagé
  entre agences co-implantées (`IDF0082` et `IDF0039` portent le même, comme `IDF0229`
  et `IDF0247`). Confirme `codeSafir` comme clé et interdit le siret comme
  identifiant.
- **Les six déménagements probables et le cas Marseille sont confirmés (2026-09-04)**
  et intégrés à `CORRESPONDANCES_AGENCES_FT`. Marseille (`MARSEILLE SAINT CHARLES` →
  `MARSEILLE PORTE D'AIX`) n'avait au départ qu'un indice géographique faible ; le
  compte exact des agences Marseille des deux côtés (11 = 11, dix paires déjà
  appariées par le nom, un seul reste de chaque côté) ne laissait arithmétiquement
  aucune autre possibilité. La répartition d'Amiens (3→2) est confirmée le même jour :
  `AMIENS DURY` → `AMIENS SUD`, `AMIENS TELLIER` → `AMIENS GARE` (l'adresse FT de
  cette dernière, rue Paul Tellier, corrobore), et `AMIENS MILLEVOYE` sans
  correspondance rejoint les fermetures.
- **Le volume de conseillers impactés en production reste à mesurer.** En staging, 3
  conseillers seulement sont rattachés aux 36 agences (2 sur `MIRIBEL`, 1 sur
  `MEXIMIEUX`), pour 12 jeunes derrière eux — mais staging ne compte que 15 conseillers
  FT rattachés au total, le ratio n'y a aucune valeur prédictive. La même requête est à
  rejouer sur la production pour prioriser l'arbitrage des 36.
