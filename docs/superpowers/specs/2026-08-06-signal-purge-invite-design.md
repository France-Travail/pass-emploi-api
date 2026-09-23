# Signal d'activité des invités : colonne dédiée `date_derniere_activite`

Date : 2026-08-06 (révisée le même jour après invalidation de la première version)
Branche : `feat/job-purge-invite`
Statut : design validé, à implémenter

## Problème

Le job `purger-invites-inactifs` supprime définitivement des comptes invités. Il lui faut
un signal de vivacité fiable. La table `jeune_invite` n'ayant pas de colonne d'activité
(`date_premiere_connexion` et `date_derniere_connexion` ont été retirées par la migration
`20260803000000`, commit `2524cfa7`, review #347), la branche a détourné
`dateDerniereActualisationToken` : la factory partagée
`ConfigurationApplication.Factory.mettreAJour` a été modifiée pour poser la date à `now`
**inconditionnellement**, au lieu de ne la poser que quand un token push est fourni.

Le point d'écriture visé était le bon. Deux défauts subsistaient :

1. **Le nom du champ ment.** Il ne trace plus l'actualisation du token mais le dernier
   appel à `configuration-application`.
2. **La factory est partagée avec le jeune standard.** Deux consommateurs changent de
   comportement sans que ce soit le but du ticket :
   - `jeune.mappers.ts:33` — `lastActivity` exposé au web conseiller ;
   - `archive-jeune.ts:322` — `estCompteActif = Boolean(dateDerniereActualisationToken) && Boolean(dateDerniereConnexion)`,
     dont la première clause devient toujours vraie, ce qui élargit silencieusement le
     périmètre des comptes archivés à la suppression.

## Le fait structurant : il n'existe pas d'événement de login récurrent côté API

Une première version de ce design proposait d'écrire une `date_derniere_connexion` dans
`UpdateUtilisateurInviteCommandHandler`, supposé appelé à chaque login. **C'est faux**, et
la vérification de la chaîne complète l'établit :

- `pass-emploi-connect/src/idp/invite/invite.service.ts:91` fabrique **un `sub` neuf à
  chaque enrôlement** (`const sub = uuid.v4()`) avant d'appeler
  `PUT /auth/users/invite/:sub`. `getJeuneInvite(sub)` ne retrouve donc jamais rien : la
  branche « invité existant » du handler est **inatteignable** en fonctionnement normal, et
  son log `invite_account_retrieved` compte des anomalies, pas des reconnexions.
- Le commentaire du même fichier l'explicite : « Ce qui rattache durablement l'invité à
  l'appareil, c'est le refresh token émis ensuite. » Un invité qui revient **ne rejoue pas**
  ce flux ; il rafraîchit son token côté connect, ce qui ne touche jamais l'API.

C'est aussi l'explication structurelle du retrait opéré par la review #347 : ces colonnes
n'étaient pas seulement inutilisées, elles n'avaient **aucun événement auquel se rattacher**.

Le seul point de contact récurrent entre un invité et l'API est le Flux B :

- `pass_emploi_app/lib/features/login/login_middleware.dart:30-44` — `BootstrapAction`
  (démarrage de l'app) → `_checkIfUserIsLoggedIn` → `_dispatchLoginSuccess` →
  `LoginSuccessAction`, y compris en ré-authentification silencieuse ;
- `pass_emploi_app/lib/features/push_notification/register/register_push_notification_token_middleware.dart:17`
  — `LoginSuccessAction` → `configureApplication` → `PUT /jeunes/:id/configuration-application`.

## Décision

Restaurer la sémantique d'origine de `dateDerniereActualisationToken`, et introduire un
champ dédié `jeune_invite.date_derniere_activite`, posé à `now` **sans condition** à chaque
appel de `configuration-application`, et persisté **uniquement sur le chemin invité**.

On obtient les trois propriétés recherchées : un signal réellement récurrent (le seul
disponible), un nom honnête, et aucun effet de bord sur le jeune standard.

Rejeté — écrire au Flux A (`UpdateUtilisateurInviteCommandHandler`) : la colonne vaudrait
toujours `date_creation`, et la purge supprimerait chaque invité au bout du délai de
rétention, actif ou non. Strictement pire que l'existant.

Rejeté — faire appeler l'API par connect à chaque rafraîchissement de token : ce serait le
vrai « dernière connexion », mais cela ajoute un aller-retour réseau sur le chemin critique
d'authentification pour alimenter un job de purge. Disproportionné.

## Changements par couche

### Domaine — restaurer la sémantique du token, ajouter le champ d'activité

`src/domain/jeune/configuration-application.ts` :

- `dateDerniereActualisationToken` retrouve sa forme d'origine (identique à `develop`) :

```typescript
pushNotificationToken:
  aMettreAJour.pushNotificationToken ?? configuration.pushNotificationToken,
dateDerniereActualisationToken: aMettreAJour.pushNotificationToken
  ? this.dateService.nowJs()
  : configuration.dateDerniereActualisationToken,
```

- l'interface `ConfigurationApplication` gagne un champ **optionnel**
  `dateDerniereActivite?: Date`, que la factory pose **toujours** à `this.dateService.nowJs()`.

Le champ est optionnel pour que rien d'existant ne casse : `Jeune.ConfigurationApplication`
est un ré-export du même type (`jeune.ts:38`), consommé par l'entité `Jeune`, les fixtures et
`jeune-sql.repository.db.ts`. Un champ requis les ferait toutes échouer à la compilation
sans bénéfice.

Le repository du jeune standard ne mappe pas ce champ — la table `jeune` n'a pas la colonne,
donc il est ignoré. C'est ce qui confine l'effet à l'invité.

Corollaire obligatoire : `src/infrastructure/routes/jeunes.controller.ts` doit normaliser la
chaîne vide en `undefined` :

```typescript
pushNotificationToken: updateConfigurationInput.registration_token || undefined,
```

L'app mobile envoie `token ?? ''`, donc `''` arrive réellement dans le payload ; avec le `??`
restauré dans la factory, `'' ?? 'ancienToken'` vaut `''` et effacerait le token stocké à
chaque ouverture d'app sans push.

### Conservé de la branche

- `registration_token` optionnel dans `UpdateConfigurationInput` (plus de 400 quand
  l'utilisateur refuse les notifications) ;
- `pushNotificationToken?: string` dans `UpdateJeuneConfigurationApplicationCommand`.

Correctif indépendant de la sémantique de la date, toujours valable — et désormais
indispensable, puisque c'est ce qui garantit qu'un invité sans push atteigne quand même
l'endpoint et bumpe `date_derniere_activite`.

### Migration

Nouvelle migration (la migration `20260803000000` déjà appliquée n'est pas modifiée) :

```js
addColumn('jeune_invite', 'date_derniere_activite', { type: Sequelize.DATE, allowNull: true })
```

Une seule colonne, sur `jeune_invite` uniquement. Ni `date_premiere_connexion` ni
`date_derniere_connexion` ne sont réintroduites : sans événement de login récurrent, elles
resteraient mortes — ce qui est exactement le reproche de la review #347.

Pas de backfill. La table `jeune_invite` a été créée le 2026-07-17 ; avec un seuil de
90 jours, aucune ligne existante ne peut devenir candidate avant le 15 octobre 2026, délai
largement suffisant pour que tout invité encore actif ouvre l'app et renseigne la colonne.
Les lignes antérieures à la migration retombent entre-temps sur `date_creation` via le
`GREATEST`.

### Persistance — chemin invité uniquement

`src/infrastructure/repositories/jeune/jeune-invite-configuration-application-sql.repository.db.ts` :
`save` persiste `dateDerniereActivite`, `get` et `toConfigurationApplication` le relisent, et
`attributesConfigurationApplication` le liste.

`jeune-configuration-application-sql.repository.db.ts` n'est **pas** modifié.

`src/infrastructure/sequelize/models/jeune-invite.sql-model.ts` gagne
`dateDerniereActivite: Date | null`.

### Lecture — job de purge

`src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.ts`, dans
`recupererInvitesInactifs` **et** `compterInvitesInactifs` :

```sql
GREATEST(date_derniere_activite, date_creation) < :dateSeuil
```

`date_creation` est un **plancher**, pas un signal : il couvre de façon déterministe les
lignes où `date_derniere_activite` est encore `NULL`. Sans lui, Postgres renverrait `NULL`
et la ligne ne serait jamais sélectionnée — fail-safe, mais implicite.

### Configuration

L'unité passe du mois au jour, seule façon d'exprimer 90 jours :

| | Avant | Après |
|---|---|---|
| Clé | `purgeInvites.retentionMois` | `purgeInvites.retentionJours` |
| Variable d'env | `JOB_PURGE_INVITES_RETENTION_MOIS` | `JOB_PURGE_INVITES_RETENTION_JOURS` |
| Défaut dans le code | `12` | `365` |
| Valeur cible en environnement | — | `90` |
| Calcul du seuil | `minus({ months: … })` | `minus({ days: … })` |

Le défaut du code reste volontairement conservateur : la valeur opérationnelle de 90 jours
est portée par la variable d'environnement, modifiable sans redéploiement. Une variable
oubliée conduit ainsi à purger moins, jamais plus.

Le renommage est sans coût : la branche n'est pas mergée et la variable n'a jamais été
déployée.

Le schéma `configuration.schema.ts` est mis à jour en conséquence.

## Tests

| Fichier | Attendu |
|---|---|
| `update-jeune-configuration-application.command.handler.test.ts` | sémantique token restaurée (date bumpée **seulement** si un token est fourni) ; `dateDerniereActivite` posée à `now` **dans tous les cas** |
| `jeune-invite-configuration-application-sql.repository.db.test.ts` | `save` écrit `date_derniere_activite` ; `get` la relit |
| `jeune-invite-sql.repository.db.test.ts` | signal basé sur `date_derniere_activite` ; cas « ligne pré-migration, colonne `NULL` → retombe sur `date_creation` » ; cas « actualisation de token récente ne protège plus de la purge » |
| `purger-invites-inactifs.job.handler.db.test.ts` | seuil calculé en jours |
| `jeunes.controller.test.ts` | `registration_token` absent ou vide → pas de 400, et la commande reçoit `undefined` |

## Effet de bord supprimé

Les deux champs préexistants de la factory redevenant identiques à `develop`, `lastActivity`
(`jeune.mappers.ts:33`) et `estCompteActif` (`archive-jeune.ts:322`) retrouvent leur
comportement d'origine. Le champ ajouté n'étant persisté que par le repository invité, le
chemin du jeune standard est inchangé de bout en bout.

## Points de vigilance

- **Le signal dépend du Flux B, donc du client mobile.** Si une future version de l'app
  cessait d'appeler `configuration-application` au démarrage, le signal se figerait sans que
  l'API s'en aperçoive, et la purge deviendrait destructrice. À mentionner dans la PR, et à
  surveiller via le dry-run avant toute activation réelle.
- **Variable d'environnement** : poser `JOB_PURGE_INVITES_RETENTION_JOURS=90` sur les
  environnements Scalingo. `JOB_PURGE_INVITES_RETENTION_MOIS` n'a jamais été déployée.
- **Ordre de déploiement** : la migration doit précéder le premier appel post-déploiement.
  Ordre standard Scalingo, rien de spécifique.

## Hors scope

- Réintroduction de `date_premiere_connexion` ou `date_derniere_connexion`.
- Exposition de `date_derniere_activite` dans un query model.
- Renommage de `dateDerniereActualisationToken` : le champ retrouvant sa sémantique
  d'origine, son nom redevient exact.
- Réglage définitif du seuil de rétention : décision produit, portée par la variable
  d'environnement et ajustable au vu des chiffres du dry-run.
