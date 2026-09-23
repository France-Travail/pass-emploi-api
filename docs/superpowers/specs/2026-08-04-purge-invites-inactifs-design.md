# Design — Job de purge des invités inactifs

> Statut : validé (brainstorming), prêt pour plan d'implémentation.
> Date : 2026-08-04 · Branche : `feat/job-purge-invite`

## 1. Objectif

Supprimer périodiquement les invités (`jeune_invite`) inactifs depuis longtemps :
la ligne DB **et** l'identité côté `pass-emploi-connect` (Redis OIDC). Opération
**irréversible et sans recours** — d'où des garde-fous stricts (dry-run, plafond,
alerte sur pic) et une rétention conservatrice.

## 2. Contexte et contraintes découvertes

- **L'invité** (`jeune_invite`) porte : `id`, `idAuthentification` (sub côté connect),
  `prenom`, `dateCreation`, un bloc push (`pushNotificationToken`,
  `dateDerniereActualisationToken`, `appVersion`, `installationId`, `instanceId`,
  `timezone`), `dateSignatureCGU`. Pas de ligne `jeune` associée.
- **`date_derniere_connexion` a été volontairement retirée** de `jeune_invite` par
  la PR #347 (« fix: review mode invité », mergée sur `develop`). On ne la
  réintroduit pas.
- **`dateDerniereActualisationToken` est aujourd'hui un signal cassé** :
  - `null` à la création (`creerJeuneInvite`).
  - L'app appelle `PUT /jeunes/:id/configuration-application` à **chaque login**
    (`LoginSuccessAction` → `configureApplication`), endpoint **ouvert aux invités**
    (`UpdateJeuneConfigurationApplicationCommandHandler` branche sur `estInvite`).
  - Mais l'app envoie `registration_token: token ?? ''` (et `''` aussi si
    `getToken()` throw). L'API valide `@IsNotEmpty()` → **400** quand le push est
    refusé/échoue → la date n'est **jamais** mise à jour.
  - La factory `ConfigurationApplication.Factory.mettreAJour` ne bump la date que
    `si aMettreAJour.pushNotificationToken` est truthy
    (`configuration-application.ts:55-57`).
  - Conséquence : la date n'est fiable que pour les invités **ayant accepté les
    notifs**. Un invité actif mais sans push paraît aussi vieux que sa `dateCreation`.
- **`OidcClient.deleteAccount(idUser)` ne connaît pas les invités** : il résout
  l'`idAuthentification` via `JeuneSqlModel` puis `ConseillerSqlModel` uniquement
  (`oidc-client.db.ts:145-155`) → lèverait `NotFoundException` pour un invité.
- **La suppression Redis côté connect (`DELETE /accounts/:idAuth`) utilise
  `deletePattern` → `KEYS`**, qui balaye tout le keyspace et bloque Redis :
  tolérable à l'unité, **dangereux en boucle serrée**. Le job doit throttler.

## 3. Décision de signal — Option A : découpler la vivacité du push

On rend `dateDerniereActualisationToken` fiable pour **tous** les invités en la
transformant en « date de dernier login » indépendante de la présence d'un push token.

1. **Validation** : `registration_token` devient optionnel / tolère la chaîne vide
   (`@IsOptional` + retrait de `@IsNotEmpty`, ou acceptation explicite de `''`).
   Un token vide ne doit plus renvoyer 400.
2. **Factory `mettreAJour`** :
   - `dateDerniereActualisationToken` est **toujours** mise à `now` lors d'un appel
     de configuration (c.-à-d. à chaque login), qu'un token soit fourni ou non.
   - `pushNotificationToken` : n'est écrasé que par un token **non vide**
     (`aMettreAJour.pushNotificationToken || configuration.pushNotificationToken`) ;
     un `''` ne remplace pas un token existant et n'est pas stocké comme token.
3. **Signal de purge** :
   `GREATEST(date_derniere_actualisation_token, date_creation) < maintenant − rétention`.
   `date_creation` (jamais nulle) sert de plancher ; `GREATEST` ignore les NULL en
   Postgres, donc l'invité sans date de token retombe proprement sur sa création.

**Portée du changement** : la factory et l'endpoint sont partagés avec les jeunes
standards. Effet collatéral **assumé et bénéfique** : les logins des jeunes sans
push seront désormais aussi horodatés. Aucun impact sur le stockage du token lui-même.

**Migration progressive** : Option A ne corrige que les logins **futurs**. Les
invités existants à `date_derniere_actualisation_token = null` verront leur date
alimentée à leur **prochain** login ; d'ici là le signal retombe sur `dateCreation`
(comportement sûr, absorbé par la rétention + le dry-run).

## 4. Architecture du job

Calqué sur `NettoyerLesDonneesJobHandler`, renvoie un `SuiviJob`.

### 4.1 Composants
- `Planificateur.JobType.PURGER_INVITES_INACTIFS` (nouveau) dans `planificateur.ts`.
- Entrée dans `listeCronJobs` — **quotidien**, tôt le matin (ex. `'0 3 * * *'`),
  après/décalé des autres jobs de nettoyage.
- `src/application/jobs/purger-invites-inactifs.job.handler.db.ts` (`@ProcessJobType`).
- Enregistrement dans `app.module.ts` (providers).
- Job **suivi et notifiable** : ne pas l'ajouter aux listes d'exclusion de
  `suivi-job.ts`.

### 4.2 Algorithme (idempotent, rejouable)
```
maintenant = dateService.now()
seuil = maintenant - retentionMois
candidats = invités où GREATEST(dateDerniereActualisationToken, dateCreation) < seuil
            ORDER BY ... LIMIT batchMax        # plafond par run

garde-fou pic:
  total = COUNT(jeune_invite)
  si candidats.length / total > pourcentageMax → ABANDON + alerte, nbErreurs++, sortie

pour chaque invité (candidats):
  try:
    if dryRun:
      nbSimules++            # on ne supprime rien, on log l'âge
      continue
    await authentificationRepository.supprimerCompteIdpInvite(idAuthentification)  # Redis d'abord
    await JeuneInviteSqlModel.destroy({ where: { id } })                            # puis la ligne
    nbPurges++
  catch (echec Redis):  nbEchecsRedis++ ; NE PAS supprimer la ligne (retry prochain run)
  catch (echec DB):     nbEchecsDb++
  # espacement entre suppressions pour ne pas marteler le KEYS côté connect
```

**Ordre imposé** : identité connect (Redis) **d'abord**, ligne DB **ensuite**.
L'inverse laisserait un token OIDC valide sur un compte inexistant. Si l'étape
Redis échoue, on **ne supprime pas** la ligne → l'invité est reproposé au run
suivant, jamais d'identité orpheline côté connect.

### 4.3 Suppression de l'identité connect (par idAuthentification)
- `OidcClient.deleteAccountByIdAuth(idAuth: string)` : nouvelle méthode qui fait
  directement `DELETE {issuerApiUrl}/accounts/:idAuth` **sans** résolution
  jeune/conseiller (l'invité fournit déjà son `idAuthentification`).
- `Authentification.Repository.supprimerCompteIdpInvite(idAuthentification)` :
  délègue à `oidcClient.deleteAccountByIdAuth`. Isole le job du client HTTP et
  reste testable.
- `deleteAccount(idUser)` existant reste **inchangé** (chemin critique jeune/conseiller).

### 4.4 Repository invité
Ajouts sur `JeuneInvite.Repository` (ou requêtes SqlModel directes dans le handler,
au choix du plan — cohérent avec le style de `nettoyer-les-donnees`) :
- récupération des candidats (`id`, `idAuthentification`) avec le prédicat `GREATEST`,
  `LIMIT batchMax` ;
- comptage total du parc (garde-fou pic).

## 5. Configuration (ConfigService)

Nouveau bloc sous `jobs` (`configuration.ts` + schema), toutes valeurs surchargeables
par variable d'environnement :

| Clé | Env | Défaut proposé | Rôle |
|---|---|---|---|
| `retentionMois` | `JOB_PURGE_INVITES_RETENTION_MOIS` | `12` | Ancienneté d'inactivité avant purge. **À caler après dry-run.** |
| `batchMax` | `JOB_PURGE_INVITES_BATCH_MAX` | à définir | Plafond de suppressions par run (protège le `KEYS` connect). |
| `pourcentageParcMax` | `JOB_PURGE_INVITES_POURCENTAGE_MAX` | à définir | Seuil d'abandon si trop d'invités seraient purgés (anti-bug de signal). |
| `dryRun` | `JOB_PURGE_INVITES_DRY_RUN` | `true` au 1er déploiement | Compte sans supprimer. |

## 6. Métriques (`SuiviJob.resultat`)

- `nbPurges`, `nbSimules` (dry-run), `nbEchecsRedis`, `nbEchecsDb`
- `ageMinJours` / `ageMaxJours` des comptes purgés (distribution → quantifie l'angle mort)
- `pourcentageParc` (déclenche l'alerte sur pic ; un pic signale un bug de signal,
  pas de la vraie inactivité)
- `dryRun` (booléen, pour lever toute ambiguïté sur la nature du run)

## 7. Garde-fous (rappel)

- **Dry-run initial obligatoire** : premier déploiement en `dryRun=true`, on calibre
  `retentionMois` sur la distribution d'âges observée avant toute suppression réelle.
- **Plafond par run** (`batchMax`) + espacement entre suppressions → ne jamais
  marteler le `KEYS` côté connect.
- **Abandon + alerte si `pourcentageParc > pourcentageParcMax`**.
- **Ordre Redis→DB** garantissant zéro identité orpheline.

## 8. Tests (`.db.test.ts`, structure miroir)

- Purge un invité au-delà du seuil ; conserve un invité en-deçà.
- Fallback `dateCreation` quand `dateDerniereActualisationToken` est null.
- `GREATEST` : invité vieux à la création mais avec token récent → **conservé**.
- Ordre Redis→DB : échec Redis ⇒ ligne **non** supprimée, `nbEchecsRedis++`.
- `dryRun=true` : rien n'est supprimé, `nbSimules` correct.
- Garde-fou pic : au-delà de `pourcentageParcMax` ⇒ abandon, aucune suppression.
- `batchMax` : ne purge pas au-delà du plafond en un run.
- Option A (tests complémentaires sur le flux config) :
  - token vide ⇒ plus de 400, `dateDerniereActualisationToken` mise à `now`,
    token non écrasé ;
  - token non vide ⇒ date mise à `now` **et** token stocké.

## 9. Hors scope / points ouverts

- **Réintroduction de `date_derniere_connexion`** : écartée (revert d'une décision
  récente #347).
- **Refonte du `KEYS`/`deletePattern` côté connect** : hors de ce repo ; on le
  contourne par le throttling. À signaler à l'équipe connect comme dette.
- **Valeurs définitives** de `batchMax`, `pourcentageParcMax` et `retentionMois` :
  fixées après lecture des chiffres du dry-run.
