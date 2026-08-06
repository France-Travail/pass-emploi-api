# Catégorisation des bénéficiaires & autorisations — notes de conception

> **Document de travail temporaire.** Branche `docs/chantier-autorisations`, à
> détruire avant tout merge. Il capture les constats vérifiés et les pistes de
> conception issues d'une session d'analyse du 2026-08-03.
>
> **Rien ici n'est une décision arrêtée.** Le principe retenu est de ne figer
> (ADR) qu'après validation par un lot pilote sur une feature réelle.
>
> Ce qui est **fonctionnel et durable** ne vit pas ici : ça va dans
> `pass-emploi-tools/docs/app-jeune/utilisateurs-authentification.md`.
>
> Base de référence : `origin/master` au 2026-08-03 (v9.40.0). Les branches
> `feat/cnx-ft` et `fix/retour-mode-invite` sont volontairement ignorées.

---

## 1. Le problème

`Core.Structure` sert simultanément de trois choses :

1. l'**organisation** d'appartenance (MiLo, France Travail, Conseil Départemental) ;
2. le **dispositif** d'accompagnement (CEJ, AIJ, BRSA, Avenir Pro, accompagnement
   intensif/global, Equip'emploi) — alors que `Jeune.Dispositif` existe déjà ;
3. depuis le mode invité, un **statut d'accès** (`INVITE`).

Conséquence : toute évolution des publics se paie en élargissement de `switch`
dispersés, et les droits ne sont écrits nulle part de façon consultable.

L'arrivée de l'app jeune ajoute au moins deux publics (candidat FT non demandeur
d'emploi, invité déjà livré) et fait bouger les droits d'un public existant
(migrants Pass Emploi / « suivi et guidé »).

## 2. Constats vérifiés sur `master`

Tous les chiffres ci-dessous ont été mesurés sur `origin/master`, pas estimés.

| Constat | Mesure |
|---|---|
| Valeurs de `Core.Structure` | **10** |
| Branchements sur la structure (`estMilo`, `estFranceTravail`, `=== Structure.X`…) | **88** occurrences |
| Fichiers de `src/application/` lisant `.structure` | **62** |
| Handlers avec un `authorize()` | **166**, dont **48** côté bénéficiaire |
| Handlers dont `authorize()` retourne `emptySuccess()` sans condition | **24** |
| Appels d'authorizer passant une capacité en 3ᵉ argument | **35** |
| Authorizers | **15** classes, **~30** méthodes |

### 2.1. `Core.Structure` ≡ (organisation, dispositif) — bijection

`fromStructureFTToDispositif` (`creer-jeune-pole-emploi.command.handler.ts`)
établit une correspondance **un pour un** pour les 8 structures FT :

| `Core.Structure` | `Jeune.Dispositif` |
|---|---|
| `POLE_EMPLOI` | `CEJ` |
| `POLE_EMPLOI_AIJ` | `AIJ` |
| `POLE_EMPLOI_BRSA` | `BRSA` |
| `CONSEIL_DEPT` | `CONSEIL_DEPT` |
| `AVENIR_PRO` | `AVENIR_PRO` |
| `FT_ACCOMPAGNEMENT_INTENSIF` | `ACCOMPAGNEMENT_INTENSIF` |
| `FT_ACCOMPAGNEMENT_GLOBAL` | `ACCOMPAGNEMENT_GLOBAL` |
| `FT_EQUIP_EMPLOI_RECRUT` | `EQUIP_EMPLOI_RECRUT` |
| `MILO` | `CEJ` **ou** `PACEA` — seul cas 1→N |

**C'est le constat structurant** : pour un bénéficiaire, `Core.Structure` est le
produit cartésien aplati de deux notions qui existent déjà comme types dans le
code. MiLo est le seul cas où les deux divergent — et c'est précisément pour lui
que la colonne `dispositif` a été introduite. La refacto inachevée était juste ;
il manque de la finir.

Corollaire : tout ce qui lit aujourd'hui la structure fine côté bénéficiaire
(`Mail.creerMailSuppressionJeune`, `NonTraitableReason`, `archive-jeune`) est
réécrivable en `(profil, dispositif)` sans perte.

Contre-exemple à connaître : `maj-mailing-list-conseiller.job.handler.ts` porte
une liste Brevo par structure, mais il s'agit de **conseillers** — hors périmètre
du profil bénéficiaire.

### 2.2. La couche capacité existe déjà, avec le défaut inversé

```ts
return this.jeuneAuthorizer.autoriserLeJeune(
  query.idJeune,
  utilisateur,
  beneficiaireEstFTConnect(utilisateur.structure)   // ← une capacité
)
```

Signature : `structureAutorisee = true`. **L'oubli du 3ᵉ argument ouvre l'accès.**
35 appels le passent ; ceux qui ne le passent pas ne sont pas distinguables d'un
oubli. C'est le mécanisme qui produit les 24 `authorize()` ouverts.

### 2.3. Mode invité : « fermé par défaut » est faux

Livré sur `master` (table `jeune_invite`, routes prénom / configuration /
formulaire Immersion, `JeuneInviteAuthorizer`). Le **seul** verrou est le rejet
de l'invité en tête de `JeuneAuthorizer.autoriserLeJeune`.

Tout cas d'usage qui ne passe pas par cet authorizer est donc accessible à un JWT
invité. Parmi les 24 `authorize()` ouverts — dont certains le sont légitimement
(endpoints d'authentification) — on trouve : référentiels (communes, métiers ROME,
actions prédéfinies, types de qualification), détails d'offres (emploi, immersion
V3, service civique), événements emploi, `create-feedback`, et
**`get-chat-secrets`**.

`get-chat-secrets` mérite un examen : il rend un custom token Firebase portant
`jeuneId = <id de l'appelant>` plus la clé de chiffrement, sans aucun contrôle.
L'exposition réelle dépend des règles Firestore (un invité n'a pas de chat), donc
probablement non exploitable — mais c'est un octroi que personne n'a décidé.

> ⚠️ La doc transverse affirme aujourd'hui « fermé par défaut, ouvert route par
> route ». C'est vrai des seules routes passant par `JeuneAuthorizer`. À corriger
> indépendamment de ce chantier.

### 2.4. Les authorizers mélangent quatre questions

| Famille | Question | Méthodes |
|---|---|---|
| Appartenance de ressource | cette action / offre / recherche / fichier est-elle à toi ? | 11 |
| Relation conseiller ↔ jeune | as-tu autorité sur ce jeune (portefeuille, agence, structure MiLo) ? | 12 |
| Identité / rôle | es-tu conseiller ? superviseur ? support ? | 6 |
| Identité du bénéficiaire | es-tu ce jeune ? cet invité ? | 2 |

Les deux premières sont saines. Les deux dernières n'ont rien à faire dans un
authorizer de ressource.

Doublons relevés dans `ConseillerAuthorizer` :

- `autoriserLeConseillerPourSonJeune(idConseiller, idJeune, …)` vs
  `autoriserConseillerPourSonJeune(idJeune, …)` : verdict identique, la première
  fait une requête de plus et prend un `idConseiller` nécessairement égal à
  `utilisateur.id`.
- `autoriserLeConseillerPourTous` vs `autoriserToutConseiller` : la seconde
  vérifie en plus l'existence en base. Rien dans les noms ne le dit.

## 3. Cible envisagée (non figée)

### 3.1. Profil : un enum plat de publics

```ts
export enum Profil {
  MILO, FT_DEMANDEUR_EMPLOI, FT_CANDIDAT, CONSEIL_DEPT, INVITE
}

const PROFILS: Record<Core.Structure, Profil> = { /* 10 lignes */ }
export function profilDe(structure: Core.Structure): Profil
```

- Le `Record<Core.Structure, …>` **interdit à la compilation** d'ajouter une
  valeur de structure sans statuer sur son profil — à l'inverse d'un `case`
  oublié dans un `switch`.
- 10 structures → 5 profils : la compression est le premier résultat de la table.
- `FT_CANDIDAT` existe mais **aucune structure ne le produit** tant que `connect`
  n'émet rien pour ce public. Inerte et auto-documenté.

### 3.2. Capacités déclarées, pas dérivées

```ts
const CAPACITES: Record<Profil, readonly Capacite[]> = {
  [Profil.MILO]:                [OFFRES, SESSIONS_MILO, AGENDA, CREATION_ACTIONS],
  [Profil.FT_DEMANDEUR_EMPLOI]: [OFFRES, DEMARCHES_FT, AGENDA, CREATION_ACTIONS],
  [Profil.CONSEIL_DEPT]:        [OFFRES, DEMARCHES_FT, AGENDA, CREATION_ACTIONS],
  [Profil.FT_CANDIDAT]:         [OFFRES],   // à confirmer avec la PO
  [Profil.INVITE]:              [OFFRES]
}
```

Cette table **est** la matrice publics → droits : elle tient à l'écran et se
relit en réunion produit.

**Garde-fou** : les capacités sont des **familles de fonctionnalités**, pas des
routes. Cinq à dix, pas cinquante. Si une capacité n'est exigée que par un seul
handler et porte son nom, elle ne doit pas exister. Si le cas devient fréquent,
c'est le signal qu'il fallait déclarer des profils autorisés plutôt que des
capacités, et il faut basculer.

### 3.3. Deux usages distincts des capacités

| | Capacité d'**accès** | Capacité de **contenu** |
|---|---|---|
| Question | as-tu le droit d'appeler ce cas d'usage ? | que contient la réponse pour toi ? |
| Où | `capacitesRequises`, vérifiée avant `authorize()` | dans `handle()` |
| Verdict | 403 | réponse partielle |
| Garantie | fermé par défaut | aucune — règle métier ordinaire |
| Exemple | `GetDemarchesQueryHandler` → `DEMARCHES_FT` | `get-jeune-home-agenda` : sessions MiLo ou non |

Seul le premier peut être fermé par défaut. Confondre les deux était une erreur
d'une version antérieure de cette analyse.

### 3.4. Où vivent les autorisations : trois couches

| Couche | Question | Mécanisme | Défaut |
|---|---|---|---|
| 1. Identité | qui es-tu ? | `OidcAuthGuard` (existe) | fermé |
| 2. Capacité | ta fonctionnalité est-elle ouverte à ton public ? | `capacitesRequises` sur le handler | **fermé** |
| 3. Appartenance | cette ressource est-elle à toi ? | authorizers de ressource (existent) | fermé |

**La déclaration vit sur le handler, pas sur la route** : une règle métier n'a
pas à être portée par `infrastructure/routes/`, et la déclaration doit être à
côté du code qu'elle protège. Bénéfice secondaire : une route appelant plusieurs
handlers obtient une granularité par handler.

```ts
export abstract class BeneficiaireQueryHandler<Q, R> extends QueryHandler<Q, R> {
  abstract readonly capacitesRequises: readonly Capacite[]
  protected verifierCapacites(utilisateur?): Result { /* exigées ⊆ détenues */ }
}
```

Vérification dans `execute()` **avant `getAggregate()`** : un public non autorisé
prend un 403 sans qu'aucune requête ne parte.

Le profil est résolu **une seule fois**, dans le guard :

```ts
// buildUtilisateur()
{ ..., structure, profil: profilDe(structure) }
```

C'est ce point qui produit le découplage : après ça, aucun appelant ne manipule
`Core.Structure`. La structure reste sur l'utilisateur pour les logs et
l'analytics, mais plus rien ne branche dessus.

### 3.5. Authorizer unique

```ts
class BeneficiaireAuthorizer {
  autoriser(idBeneficiaire, utilisateur): Promise<Result>
}
```

Fusionne `JeuneAuthorizer` et `JeuneInviteAuthorizer`. Disparaissent :
`structureAutorisee`, le `if (estInvite)`, et la duplication de repository. Le
repository sait que le bénéficiaire vit dans `jeune` **ou** `jeune_invite` ;
l'application ne le sait pas.

> Commentaire à réintroduire (supprimé par `56394b0b`) : le contrôle d'existence
> en base n'est pas redondant avec le JWT — le token d'un invité n'expirant
> jamais, un compte purgé conserverait un token valide.

### 3.6. Modèle de données (post-novembre)

Aujourd'hui `Jeune` porte 7 champs optionnels indépendants dont la co-occurrence
n'est écrite nulle part.

```ts
interface Beneficiaire {
  id; profil; identite; configuration; dates; dateSignatureCGU?
  accompagnement?: Accompagnement   // conseiller + dispositif + dateFin, ENSEMBLE
  dossierPartenaire?: { idPartenaire }
  preferences?                       // absent pour l'invité
}

type BeneficiaireAccompagne = Beneficiaire & { accompagnement: Accompagnement }
function estAccompagne(b: Beneficiaire): b is BeneficiaireAccompagne
```

- `dispositif` redevient **non optionnel**, à l'intérieur d'`accompagnement` :
  un non-accompagné n'a pas un dispositif nul, il n'a pas d'accompagnement.
- La règle messagerie devient structurelle : `accompagnement !== undefined`.
- Les fonctions qui exigent un accompagnement le déclarent dans leur signature
  (`creerMailSuppressionJeune(b: BeneficiaireAccompagne)`), ce qui rend leur
  `throw` défensif **inatteignable** — donc supprimable.
- Deux tables (`jeune`, `jeune_invite`), **un** type domaine. Aucune migration.

## 4. Options écartées, et pourquoi

| Option | Écartée parce que |
|---|---|
| Éclater `Core.Structure` d'emblée | Elle est dans le JWT (`connect`), les payloads web/app, l'analytics et la base. Chantier multi-repos synchronisé, qui bloquerait tout le reste |
| Décorateur `@Capacite()` **sur la route** | Fait porter une règle métier par la couche transport, et sépare la déclaration du code protégé |
| Axes `organisation` + `dossierFT` | `dossierFT` est entièrement dérivable de `organisation` sur `master` : l'axe ne portait aucune information. Anticipation d'un public non spécifié |
| Valeur `CANDIDAT` avant spécification | Deviner une sémantique. L'ajouter plus tard ne coûte qu'un fichier — c'est tout l'intérêt du design |
| Fonction `capacites()` dérivant les capacités par `if` | Une table déclarative est plus lisible et supprime une logique à suivre. La *raison* d'un droit appartient à la doc produit |
| `profilsAutorises` sur le handler au lieu de capacités | Ajouter un public coûterait la revue des 48 handlers. Or la trajectoire ajoute des publics, pas des features de droits |
| Accompagnement `AILLEURS` (accompagné hors de chez nous) | Ne se distingue de « aucun » nulle part dans la matrice de droits |
| `MESSAGERIE` comme capacité dans la table | Figerait en permanence une situation transitoire. La règle durable est « a un conseiller » ; l'écart des migrants est temporaire |
| Héritage de classes (`BeneficiaireAccompagne extends Beneficiaire`) | « Accompagné » est un **état** qui change (un bénéficiaire navigue d'un public à l'autre), pas une identité. Et le codebase modélise les entités en interfaces + fonctions pures |
| Union discriminée complète | Les deux variantes partagent presque tout (offres, favoris, configuration, CGU, notifications) : l'union taxerait tous les chemins communs pour un gain nul |
| Type `BeneficiaireNonAccompagne` | Un type nommé n'a de valeur que là où il **restreint**. Aucune fonction n'exige l'absence d'accompagnement |

## 5. Questions ouvertes

- **Règle messagerie transitoire.** En régime établi : `a un conseiller`. Pendant
  la migration des conseillers vers Parcours Emploi, ces bénéficiaires ont encore
  un conseiller en base. Piste : réutiliser `Migration` + `FeatureFlip`, dont les
  tags sont déjà posés **sur le conseiller**
  (`getTagSiFeatureActivePourLeConseillerDuJeune`). Avantage : l'exception
  s'auto-supprime quand la migration est finie. À valider : sait-on poser le tag
  sur les bons conseillers avant la sortie de l'app jeune ?
- **Droits du candidat FT non demandeur d'emploi** — à trancher avec la PO.
- **Périmètre de l'invité** au-delà des offres.
- **Rangement de « suivi et guidé »** (structure ? dispositif ?).
- **Transition invité → inscrit** : non traitée. Le modèle proposé la rend
  exprimable, il ne la résout pas.
- **Périmètre conseiller** : non analysé. Part inconnue des 62 fichiers — à
  mesurer, ça dimensionne les lots 3 et 5.

## 6. Découpage en lots

Chaque lot est mergeable seul, testable, et abandonnable sans dette.

| # | Lot | Test | Réversibilité |
|---|---|---|---|
| 0 | Constat : part bénéficiaire/conseiller des 62 fichiers, inventaire des `authorize()` ouverts | — | rien à défaire |
| 1 | `Profil` + `PROFILS` + résolution dans le guard | table exhaustive, 1 test par structure | suppression d'un fichier |
| 2 | Capacités + `BeneficiaireQueryHandler`, sur **3 handlers pilotes** (démarches, CV, suivi semaine) | refus sans appel partenaire ; test d'archi | 3 handlers |
| 3 | Généralisation aux 45 autres + retrait de `structureAutorisee` | par handler | paquets indépendants |
| 4 | `BeneficiaireAuthorizer` (fusion) | tests existants + invité | dépend de 3 |
| 5 | Lectures `.structure` restantes → `(profil, dispositif)` | tests existants | fichier par fichier |
| 6 | Modèle `Beneficiaire` + blocs | — | **post-novembre** |
| 7 | Unification des 11 variantes conseiller→jeune | — | **post-novembre** |

Calendrier app jeune : bêta septembre/octobre, ouverture novembre. Lots 1→4 avant
la bêta (c'est ce qui ferme le défaut) ; 5 au fil de l'eau ; 6 et 7 après.

Le lot 2 est délibérément minuscule : il valide la mécanique sur 3 handlers avant
de la répandre sur 45, et repousse le point de non-retour au plus tard.

**Le lot 1 ne change aucun comportement** : il est mergeable même si tout le reste
est abandonné.

## 7. Garde-fou à ne pas oublier

L'approche incrémentale repose sur une convention non vérifiée par le
compilateur : « tout handler bénéficiaire étend `BeneficiaireQueryHandler` ».
À rendre exécutable par un test d'architecture :

```ts
it('tout handler injectant BeneficiaireAuthorizer déclare ses capacités', () => {
  // échoue si un handler injecte BeneficiaireAuthorizer
  // sans étendre BeneficiaireQueryHandler
})
```

C'est ce test qui transforme la convention en garantie, et qui permet de tenir
l'approche incrémentale sans repasser sur les 166 handlers avant la bêta.

## 8. Ce qui part en doc durable

- **Fonctionnel** (publics, droits, migration, navigation entre publics) →
  `pass-emploi-tools/docs/app-jeune/utilisateurs-authentification.md`, plus la
  correction du « fermé par défaut ».
- **Technique** → ADR dans `docs/decisions/`, **seulement après validation par le
  lot pilote**. Deux ADR pressentis : catégorisation `(profil, dispositif)` d'une
  part, couches d'autorisation d'autre part.
- **Constats datés** (§2) → `docs/investigations/` si on veut les garder après
  destruction de cette branche.
