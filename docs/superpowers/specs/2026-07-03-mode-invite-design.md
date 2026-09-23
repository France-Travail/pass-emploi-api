# Mode invité — Analyse et design

> Statut : proposition à valider par l'équipe. Issu du brainstorming "Mode invité - Stockage"
> (post-it « id jeune fantôme + stockage intégral en base ») et d'une session de cadrage du 2026-07-03.

## 1. Objectif

Permettre à un utilisateur **sans compte** d'utiliser l'application mobile avec un périmètre réduit :

- **Accueil / Plan d'action** : répondre à un QCM qui génère une liste d'actions à faire (nouvelle feature).
- **Offres** : recherche seulement (pas de favoris, pas de recherches sauvegardées).
- **Événements** : consultation des événements publics + « mémo » (épingler des événements pour soi).

À tout moment, l'invité peut créer un compte France Travail et basculer en mode connecté —
sans pour autant obtenir l'accès complet (pas de conseiller tant qu'il n'est pas en accompagnement).

## 2. Décisions actées

| Sujet | Décision |
|---|---|
| Identité | **Anonyme total** : aucun email, aucune saisie. Identité générée côté app à l'installation. |
| Conversion | Porte de sortie permanente « créer un compte FT ». La conversion fait quitter le mode invité. |
| Reprise des données | **Migration automatique pilotée par l'app** : après la première connexion, l'app présente le token invité qu'elle détient encore ; le serveur transfère plan d'action + mémos vers le nouveau compte puis supprime le fantôme. Le « matching impossible » du tableau blanc disparaît : pas de devinette côté serveur. |
| Changement de téléphone | **Perte assumée** des données invité (cohérent avec l'anonymat total). |
| Plateforme | **App mobile uniquement** (pass_emploi_app / Flutter). |

## 3. Hypothèses à valider (produit / DPO)

- **Nettoyage** : TTL glissant **~6 mois d'inactivité** (chaque requête rafraîchit `date_derniere_activite`,
  un cron purge les inactifs). Durée exacte à arbitrer.
- **Périmètre des données persistées côté serveur** : réponses QCM + plan d'action (actions et leur statut)
  + mémos événements. La recherche d'offres reste stateless (rien de persisté).
- Les mémos événements couvrent les **deux types** d'événements : animations collectives et événements emploi (API FT).

## 4. État de l'existant (contraintes)

- **Toute l'auth vient de pass-emploi-connect**, serveur OIDC (`oidc-provider`) qui ne fait que fédérer
  des IdP externes (Milo, FT, Conseil départemental). Aucun compte local → le warning
  « auth sans SSO à mettre en place » du tableau blanc.
- Connect enregistre déjà un **grant custom** (`token-exchange.grant.ts`, via `oidc.registerGrantType`) :
  ajouter un grant maison est un chemin éprouvé dans ce repo.
- Côté API, `OidcAuthGuard` valide le JWT (JWKS de connect) et construit `Authentification.Utilisateur`
  à partir de `userId` / `userType` (JEUNE, CONSEILLER) / `userStructure`.
- `JeuneSqlModel` est fortement couplé à l'accompagnement (conseiller, actions, rendez-vous, situations Milo)
  et est parcouru par de nombreux jobs et requêtes (portefeuilles, notifications, stats, campagnes, archivage).
- La **recherche d'offres** passe par `PoleEmploiClient` en `client_credentials` (token partenaire) :
  un invité peut chercher des offres sans identité FT.
- Un `RateLimiterService` (token bucket) existe déjà dans l'API.

## 5. Approches envisagées

### Approche A — « Jeune fantôme » littéral : ligne dans la table `jeune`

Créer de vrais `JeuneSqlModel` avec une structure/type spéciale et un conseiller null.

- ✅ Réutilise tout (repos, authorizers, handlers) ; peu de code de stockage.
- ❌ **Risque de fuite élevé** : chaque requête/job qui itère sur les jeunes (notifications push,
  stats, campagnes, archivage, portefeuille conseiller) doit désormais exclure les fantômes —
  un oubli et un fantôme apparaît dans un écran conseiller ou reçoit une notification.
- ❌ Pollution analytics, cascade de FK au nettoyage, colonnes majoritairement nulles.

### Approche B — Domaine invité dédié (recommandée)

Nouveau bounded context `invite` avec ses propres tables, son propre type d'utilisateur,
zéro ligne dans `jeune`.

- ✅ Aucun risque de fuite dans les features conseiller/accompagnement : l'invité n'existe pas pour elles.
- ✅ Nettoyage trivial (delete cascade sur 3 tables), analytics séparables, contrôle d'accès explicite.
- ✅ Fidèle au post-it de l'équipe (« stockage intégral en base ») en corrigeant son angle mort (la table `jeune`).
- ❌ Un peu de plomberie neuve (type utilisateur, guard, tables) ; quelques handlers de lecture
  (offres, événements) doivent accepter le type INVITE en plus de JEUNE.

### Approche C — Local-first : tout dans l'app, rien en base

QCM, plan d'action et mémos stockés sur le téléphone ; l'API expose seulement des endpoints
publics rate-limités pour la recherche et les événements. À la conversion, l'app pousse ses
données locales vers le nouveau compte.

- ✅ Zéro fantôme, zéro nettoyage, zéro auth invité, RGPD minimal.
- ❌ Warning « cache mobile disparaît » : vider le cache/réinstaller = tout perdu.
- ❌ Pas de visibilité produit sur le funnel QCM ; logique de scoring du QCM dupliquée côté app
  si elle doit exister aussi côté serveur pour les connectés.
- Écartée par l'équipe au brainstorming, mais son esprit est repris : **ne persister que le strict nécessaire**.

**Recommandation : Approche B**, avec l'auth portée par connect (section 6).

## 6. Design recommandé

### 6.1 Authentification — grant « invité » dans pass-emploi-connect

Invariant conservé : **tout token vient de connect** (un seul émetteur, un seul JWKS,
`OidcAuthGuard` inchangé dans sa mécanique).

1. À l'entrée en mode invité, l'app génère un UUID + un secret d'appareil, stockés en
   Keychain/Keystore (survit au vidage du cache applicatif, pas à la réinstallation — assumé).
2. L'app appelle connect sur un grant custom (ex. `urn:pass-emploi:params:oauth:grant-type:invite`)
   avec le `client_id` mobile **et son couple UUID + secret d'appareil**. Au premier appel,
   connect enregistre l'identité invité (hash du secret) ; aux appels suivants, il ré-émet des
   tokens pour la même identité. La session ne dépend donc pas de la durée de vie d'un refresh
   token : tant que le Keychain détient le secret et que le fantôme n'a pas été purgé (TTL, §6.5),
   l'invité retrouve ses données.
3. Claims du JWT : `userId = <uuid invité>`, `userType = INVITE`, pas de structure
   (ou `userStructure = INVITE` si un défaut est plus simple pour le mobile).
4. Access token court (aligné sur l'existant) ; le refresh token devient optionnel puisque le
   grant est rejouable — à trancher à l'implémentation selon ce qui est le plus simple côté app.

Anti-abus à la création (post-it « rate limit ») : rate limit par IP sur le grant invité ;
en durcissement ultérieur, attestation d'app (Play Integrity / App Attest).

### 6.2 Contrôle d'accès dans l'API — default-deny

- Nouveau `Authentification.Type.INVITE`.
- **Refus par défaut** : un guard global rejette tout utilisateur INVITE sauf sur les routes
  décorées `@AccessibleAuxInvites()`. C'est le point clé : on n'audite pas les ~30 controllers
  existants, on ouvre explicitement une poignée de routes.
- Routes ouvertes aux invités :
  - recherche d'offres (emploi, immersion, service civique — périmètre produit à confirmer),
  - lecture des événements (événements emploi + animations collectives publiques),
  - CRUD du plan d'action invité (QCM + actions),
  - CRUD des mémos événements,
  - endpoint de migration (section 6.4).
- Un `InviteAuthorizer` vérifie que l'invité n'accède qu'à **ses** ressources (`idInvite == utilisateur.id`).

### 6.3 Modèle de données (nouvelles tables, rien dans `jeune`)

```
compte_invite
  id (uuid, PK)                  -- le userId du JWT
  date_creation
  date_derniere_activite         -- rafraîchie à chaque requête (throttlée, ex. 1x/h)

plan_action_invite
  id, id_compte_invite (FK cascade)
  reponses_qcm (jsonb)
  date_creation

action_invite
  id, id_plan_action_invite (FK cascade)
  contenu, statut (A_FAIRE / FAITE), ordre

memo_evenement_invite
  id, id_compte_invite (FK cascade)
  type_evenement (ANIMATION_COLLECTIVE | EVENEMENT_EMPLOI)
  id_evenement_externe, date_ajout
```

Détail des colonnes QCM/plan d'action à affiner quand la feature « plan d'action » sera spécifiée
(elle concerne aussi les connectés).

### 6.4 Migration à la conversion

`POST /invites/migration`, appelé par l'app **authentifiée avec le nouveau token connecté**,
body : le token invité encore détenu par l'app (preuve de possession de l'identité invité).

Le serveur : vérifie les deux tokens → transfère plan d'action et mémos vers le compte connecté
→ supprime le `compte_invite` (cascade) → demande à connect la révocation de la session invité.
Idempotent (rejouable si l'app est tuée en plein milieu).

Côté cible, le rattachement dépend du modèle « plan d'action » des connectés (à spécifier) ;
les mémos peuvent devenir des favoris/inscriptions selon les règles produit.

### 6.5 Nettoyage

Job cron Bull (planificateur existant), quotidien :
`DELETE FROM compte_invite WHERE date_derniere_activite < now() - TTL` (cascade).
Couvre abandon, curieux, app désinstallée. Suppression immédiate à la migration réussie.
Côté connect, les sessions expirent d'elles-mêmes via le refresh token.

### 6.6 Rate limiting

- Création d'invité (grant connect) : limite par IP.
- Endpoints invités dans l'API : limite par `userId` invité (réutiliser le pattern
  `RateLimiterService` ou un compteur Redis), plus stricte que pour les connectés —
  la recherche d'offres consomme le quota partenaire FT.

### 6.7 Événements métier / analytics

Tracer via `EvenementService` : création d'invité, QCM complété, mémo ajouté, conversion réussie.
C'est ce qui répond au « comment savoir ? » du tableau blanc (funnel invité → compte FT).

## 7. Réponse aux points du tableau blanc

| Point du tableau | Réponse du design |
|---|---|
| Persistence | Tables dédiées `compte_invite` & co, pas la table `jeune`. |
| Sécu (auth JWT) | Grant custom dans connect → JWT du même émetteur, guard inchangé + default-deny INVITE. |
| Reprise en mode connecté | Migration pilotée par l'app avec les deux tokens ; pas de matching serveur. |
| Changer de tel | Non supporté (anonymat assumé) ; le Keychain survit au moins au vidage de cache. |
| Nettoyage | TTL glissant + cron Bull + suppression à la conversion. |
| Rate limit | Par IP à la création, par invité sur les endpoints. |
| « Cache mobile disparaît » | Secret en Keychain/Keystore, pas dans le cache applicatif. |
| « Auth sans SSO » | Pas de SSO ni de compte local : grant anonyme custom dans connect (pattern token-exchange déjà en place). |
| « Matching impossible ? Comment savoir ? » | Rendu inutile par la migration app-driven ; funnel mesuré via `EvenementService`. |

## 8. Impacts par repo

- **pass-emploi-connect** : grant custom invité, émission access/refresh pour `userType=INVITE`,
  révocation à la migration, rate limit IP.
- **pass-emploi-api** : type INVITE, guard default-deny + décorateur, domaine `invite`
  (tables, migrations, repos, handlers CQRS, authorizer), endpoint migration, cron de purge,
  ouverture des handlers offres/événements au type INVITE, événements analytics.
- **pass_emploi_app** : parcours invité, stockage Keychain/Keystore du secret, écran QCM,
  bandeau « créer un compte FT », appel de migration post-login.

## 9. Questions ouvertes

1. Durée exacte du TTL de nettoyage (proposition : 6 mois glissants) — produit/DPO.
2. Périmètre exact des offres accessibles (immersion et service civique inclus ?).
3. Modèle « plan d'action » côté connecté (la cible de migration) — feature à spécifier en parallèle.
4. Que devient un mémo à la migration si l'équivalent connecté n'existe pas (inscription ? favori ?).
5. Faut-il pousser des notifications aux invités (relance QCM, rappel événement) ?
   Impact : token Firebase à stocker sur `compte_invite`.
6. Attestation d'app (Play Integrity / App Attest) dès le début ou en durcissement ultérieur ?
