# Design — Dashboard Kibana « Auth — perf »

> Spec pour construire à la main, dans Kibana, un dashboard de suivi des tests de
> perf du **scénario authentification** (premier scénario mené). Données 100 %
> issues des **logs ECS** (pas d'APM, pas d'instrumentation nouvelle).
>
> Date : 2026-07-27 · Statut : à valider avant construction.

## 1. Objectif

Suivre, pendant les tirs de perf sur l'authentification :

1. **Disponibilité** = taux de réussite du login (`login_completed` / total).
2. **Latence** aux percentiles (p50/p95/p99).
3. **Découpage par population** : MILO / France Travail / Invité.
4. **Nombre de personnes** qui se connectent.

Hors périmètre v1 (décision actée) : distinction **création de compte vs
reconnexion** — non instrumentée aujourd'hui (la donnée `datePremiereConnexion`
vit en base API, pas dans Elastic). À traiter en v2 si besoin (cf. §8).

Interprétation retenue de la demande « disponibilité (réussite a p95) » :
**disponibilité = taux de réussite (%)**, et **p95 = percentile de latence**. Deux
métriques distinctes. À corriger si l'intention était autre.

## 2. Où vivent les données

L'authentification (login OIDC) est portée par **pass-emploi-connect**, pas par
l'API. Tous les événements utiles sont des logs ECS émis par le `rootLogger` de
connect, ingérés dans les data streams `logs-*-default`.

- **Data view Kibana** : `logs-*-default-*` (couvre app + router).
- **Filtre global recommandé** : restreindre au service connect
  (`service.name`/`log.logger` selon le mapping en place — à confirmer sur un
  échantillon de logs réels).

### Taxonomie `event.action` d'auth (connect)

| `event.action` | Émis quand | `outcome` |
|---|---|---|
| `login_initiated` | entrée du flow (redirection à venir) | success |
| `login_redirected` | redirection vers l'IDP construite | success / failure |
| `login_completed` | **login abouti** (session créée) | success |
| `login_failed` | **échec du login** (à une étape `login.step`) | failure |
| `external_api_call` | appel sortant vers l'IDP (`token`, `userinfo`) | success / failure |
| `token_issued` / `token_refreshed` / `token_failed` | grant / refresh de token | — |

## 3. Champs pivots

| Champ | Présent sur | Contenu | Usage |
|---|---|---|---|
| `event.action` | tous | verbe snake_case | filtrage principal |
| `event.outcome` | tous porteurs d'action | `success` / `failure` | dispo |
| `labels.idp` | **`login_*` uniquement** | `milo-jeune`, `milo-conseiller`, `francetravail-jeune`, `francetravail-conseiller`, `francetravail-aij`, `francetravail-brsa`, `francetravail-beneficiaire`, `invite`, `conseildepartemental-conseiller` | découpage des panels login |
| `log.logger` | tous (via `context`) | nom du logger : idpName (`milo-jeune`…) sur login IDP **et** sur `external_api_call` ; `InviteService` sur login invité | découpage des panels latence |
| `labels.operation` | `external_api_call` | `token` / `userinfo` | décomposer la latence IDP |
| `event.duration` | `external_api_call` | **nanosecondes** | latence |
| `user.id` | `login_completed` MILO/FT (via mixin) | id utilisateur | uniques |
| `login.step` | `login_failed` | étape d'échec (`ApiPassEmploi`, `Callback`, `UserInfo`, `SessionNotFound`…) | diagnostic échecs |
| `error.type` | logs `failure` | type d'erreur ECS | diagnostic échecs |

### Nuances structurantes (à ne pas ignorer)

- **`labels.idp` n'existe PAS sur `external_api_call`.** Les panels de latence se
  découpent donc sur **`log.logger`** (= idpName), pas sur `labels.idp`.
- **L'invité ne produit aucun `external_api_call`** (pas d'IDP externe) → **aucune
  latence mesurable par cette voie pour l'invité**. Les panels latence ne
  montreront que MILO et FT. (Si la latence invité devient nécessaire : passer par
  `request_completed`/pino-http sur l'endpoint invité, ou APM — hors v1.)
- **`user.id` peut être absent sur le `login_completed` invité** : le flux invité
  ne pose pas le user dans le `Context` avant de loguer, et chaque connexion invité
  fabrique un `sub` neuf (uuid). Donc pour l'invité, « nombre de personnes » n'a
  pas de sens en `cardinality(user.id)` → utiliser **`count(login_completed)`**
  (chaque login ≈ un nouvel enregistrement device). Pour MILO/FT,
  `cardinality(user.id)` = personnes uniques.

## 4. Découpage par population — approche Lens « Filters »

On construit tout à la main dans Lens, **sans runtime field ni Painless**. Le
découpage MILO / France Travail / Invité se fait avec un **break down de type
« Filters »** (et non « Top values ») : on définit des groupes nommés par KQL.
La conversion ns → ms de la latence se fait par **formule Lens** (`/ 1000000`).

Le Painless équivalent (si un jour on veut un vrai champ réutilisable ou un
Dashboard control groupé) est conservé en **annexe §10**.

### 4.1 Groupes pour les panels login (§6 : 1, 4, 5, 6)

Break down « Filters », champ `labels.idp` (présent sur les `login_*`) :

| Groupe nommé | KQL |
|---|---|
| MILO | `labels.idp: milo*` |
| France Travail | `labels.idp: francetravail*` |
| Invité | `labels.idp: "invite"` |
| Conseil Départemental *(optionnel)* | `labels.idp: conseildepartemental*` |

### 4.2 Groupes pour les panels latence (§6 : 2, 3)

Break down « Filters », champ `log.logger` (les `external_api_call` ne portent
**pas** `labels.idp`) :

| Groupe nommé | KQL |
|---|---|
| MILO | `log.logger: milo*` |
| France Travail | `log.logger: francetravail*` |

> Pas de groupe Invité ici : l'invité ne produit aucun `external_api_call`
> (cf. §3), il est structurellement absent des panels latence.

### 4.3 Latence en millisecondes

`event.duration` est en **nanosecondes**. Pas de runtime field : on divise dans
la **formule Lens** du panel, ex. `percentile(event.duration, 95) / 1000000`.
Formater l'unité de la colonne en « ms » pour la lisibilité.

> Astuce : si les wildcards KQL (`milo*`) posent souci parce que `labels.idp` /
> `log.logger` sont mappés en `keyword`, ils fonctionnent quand même en KQL
> Kibana. En cas de doute, remplace par une énumération OR explicite
> (`labels.idp: ("milo-jeune" or "milo-conseiller")`).

## 5. Définitions des métriques

- **Disponibilité (taux de réussite)** =
  `count(login_completed) / (count(login_completed) + count(login_failed))`,
  sur la fenêtre courante, éventuellement par `idp_groupe`.
- **Latence** = percentiles de `event.duration` (÷ 1 000 000 pour des ms) sur
  `event.action: external_api_call`, découpés par le break down Filters latence
  (§4.2) et/ou `labels.operation`. Mesure le **round-trip IDP** (token +
  userinfo), **pas** le login end-to-end (cf. §8).

## 6. Panels

Tous en **Lens** sauf mention contraire ; data view `logs-*-default-*`.

### Panel 1 — Disponibilité (taux de réussite)
- **But** : dispo globale + par population, chiffre du moment.
- **Type** : Metric (global) + série temporelle (Line) en dessous.
- **Formule Lens** :
  `count(kql='event.action: "login_completed"') / count(kql='event.action: "login_completed" or event.action: "login_failed"')`
- **Format** : pourcentage.
- **Break down by** : **Filters** — groupes login (§4.1).

### Panel 2 — Latence p50/p95/p99 par population
- **But** : latence IDP par groupe.
- **Type** : Line (3 séries de percentiles) ou Bar horizontal.
- **Filtre (KQL)** : `event.action: "external_api_call"`.
- **Métriques (formules Lens)** : `percentile(event.duration, 50) / 1000000`,
  `…, 95) / 1000000`, `…, 99) / 1000000` (unité : ms).
- **Break down by** : **Filters** — groupes latence (§4.2 ⇒ MILO / FT
  uniquement).

### Panel 3 — Latence par opération (token vs userinfo)
- **But** : voir quelle étape IDP coûte.
- **Type** : Bar.
- **Filtre (KQL)** : `event.action: "external_api_call"`.
- **Métrique (formule Lens)** : `percentile(event.duration, 95) / 1000000` (ms).
- **Break down by** : `labels.operation` (Top values) ; sous-découpe Filters
  latence (§4.2) si utile.

### Panel 4 — Personnes connectées (uniques)
- **But** : combien de personnes se connectent.
- **Type** : Metric, avec break down **Filters** — groupes login (§4.1).
- **Filtre (KQL)** : `event.action: "login_completed"`.
- **Métrique** :
  - MILO / FT : `unique_count(user.id)`.
  - Invité : `count()` (cf. §3, `user.id` non fiable ⇒ compter les logins).
  - Pratique : afficher **deux métriques** côte à côte (uniques `user.id` +
    `count(login_completed)`) pour lever l'ambiguïté, plutôt qu'un seul chiffre
    trompeur.

### Panel 5 — Volume de connexions dans le temps
- **But** : débit + succès/échec pendant le tir.
- **Type** : Bar empilé (par minute).
- **Filtre (KQL)** : `event.action: "login_completed" or event.action: "login_failed"`.
- **Métrique** : `count()`.
- **Break down by** : `event.outcome` (couleur) ; split optionnel Filters login
  (§4.1).

### Panel 6 — Top causes d'échec
- **But** : diagnostiquer les échecs pendant la charge.
- **Type** : Table.
- **Filtre (KQL)** : `event.action: "login_failed"`.
- **Colonnes** : `count()` par `login.step`, puis `error.type` ; split Filters
  login (§4.1).

## 7. Contrôles globaux du dashboard

- **Time picker** calé sur la fenêtre du tir de perf.
- **Contrôle (Dashboard control)** : les contrôles Kibana filtrent sur un champ
  réel — pas sur un break down Filters. Deux options :
  - dropdown **Options list** sur `labels.idp` brut (valeurs fines :
    `milo-jeune`, `francetravail-conseiller`…), simple mais non groupé ;
  - ou créer le runtime field `idp_groupe` (annexe §10) **uniquement** pour
    disposer d'un contrôle groupé MILO / FT / Invité.
- **Refresh** court (5–10 s) pendant les tirs.

## 8. Caveats & limites connues

1. **Latence ≠ end-to-end login.** Il n'existe pas de champ « durée totale de
   login » : le flow s'étale sur plusieurs requêtes HTTP (`/login` → IDP →
   callback). La latence mesurée est le **round-trip vers l'IDP**
   (`external_api_call`), qui est la part dominante et la plus variable, mais pas
   le temps perçu complet.
2. **Invité sans latence** par cette voie (pas d'`external_api_call`).
3. **`user.id`** : uniques fiables pour MILO/FT seulement ; invité = volume de
   logins.
4. **Flux non authentifié** : les échecs très précoces (`login_redirected`
   failure, `SessionNotFound`) peuvent ne pas porter `user.*`.
5. **Création vs reconnexion** : hors v1. Pour l'obtenir, instrumenter
   `login_completed` avec un booléen (ex. `labels.premiere_connexion`) dérivé de
   `datePremiereConnexion === dateDerniereConnexion` côté API
   (`update-utilisateur.command.handler.ts`), puis propagé par connect. Mini-dev
   api + connect.
6. **Filtre service connect** : le champ exact (`service.name` vs autre) est à
   confirmer sur un échantillon réel avant de figer le filtre global.

## 9. Extensions futures (v2)

- Dimension **création vs reconnexion** (cf. §8.5).
- Latence **end-to-end** via corrélation `login_initiated` → `login_completed`
  sur une clé de session (`interaction.uid`) — plus lourd, transform ES ou script.
- Panels **token refresh** (`token_refreshed` vs `token_issued`) pour distinguer
  reconnexion silencieuse vs login complet.

## 10. Annexe — Runtime fields Painless (optionnel)

Non nécessaires pour la v1 (on utilise les break down Filters, §4). À créer
seulement si on veut un champ réutilisable partout ou un Dashboard control
groupé. **Emplacement** : Stack Management → Data Views → `logs-*-default-*` →
Add field → Type `Keyword` → « Set value » → éditeur Painless (ce n'est **pas**
une formule Lens).

### `idp_groupe` — depuis `labels.idp` (panels login)

```painless
String idp = doc['labels.idp'].size() > 0 ? doc['labels.idp'].value : '';
if (idp.isEmpty()) { return; }
if (idp.startsWith('milo')) { emit('MILO'); }
else if (idp.startsWith('francetravail')) { emit('France Travail'); }
else if (idp.equals('invite')) { emit('Invité'); }
else if (idp.startsWith('conseildepartemental')) { emit('Conseil Départemental'); }
else { emit('Autre'); }
```

### `idp_groupe_ext` — depuis `log.logger` (panels latence, MILO/FT)

```painless
String l = doc['log.logger'].size() > 0 ? doc['log.logger'].value : '';
if (l.startsWith('milo')) { emit('MILO'); }
else if (l.startsWith('francetravail')) { emit('France Travail'); }
```

### `event.duration_ms` (type `double`) — latence lisible

```painless
if (doc['event.duration'].size() == 0) { return; }
emit(doc['event.duration'].value / 1000000.0);
```

> Si l'éditeur rejette `doc['labels.idp']`, le champ n'est pas mappé sous ce nom
> exact : vérifier dans la liste des champs (parfois `labels.idp.keyword`) et
> ajuster.
