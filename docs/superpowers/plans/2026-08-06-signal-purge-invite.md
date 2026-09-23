# Signal d'activité des invités — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au job de purge des invités un signal d'activité dédié et honnête — `jeune_invite.date_derniere_activite`, écrite à chaque appel de `configuration-application` — et restaurer la sémantique d'origine de `dateDerniereActualisationToken`.

**Architecture:** Un invité n'a **pas** d'événement de login récurrent côté API : `pass-emploi-connect` fabrique un `sub` neuf à chaque enrôlement (`invite.service.ts:91`), donc `PUT /auth/users/invite/:sub` ne fait jamais que créer, et un invité qui revient rafraîchit son token sans toucher l'API. Le seul point de contact récurrent est `PUT /jeunes/:id/configuration-application`, appelé par l'app à chaque démarrage via `BootstrapAction → LoginSuccessAction`. C'est donc là que le signal s'écrit. La factory `ConfigurationApplication` étant partagée avec le jeune standard, le nouveau champ n'est persisté que par le repository invité — la table `jeune` n'a pas la colonne.

**Tech Stack:** NestJS 11, TypeScript 4.9 (strict), Sequelize 6 + sequelize-typescript, PostgreSQL 14, Luxon, Mocha + Chai + Sinon, Yarn 4.

## Global Constraints

- Package manager : `yarn` exclusivement, jamais `npm`.
- Prettier : `semi: false`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: "none"`, `arrowParens: "avoid"`.
- Chaîne **sans** apostrophe → guillemets simples. Chaîne **avec** apostrophe → guillemets doubles. Y compris dans les `it()` et `describe()`.
- ESLint : pas de `console.log` (utiliser `rootLogger`), pas de `process.env` hors `src/config/configuration.ts`, pas de `any`, type de retour explicite sur toute fonction.
- Pas de commentaires explicatifs. Les marqueurs `// Given` / `// When` / `// Then` sont la convention de test du repo et restent.
- Ne jamais modifier une migration déjà appliquée ; toujours en créer une nouvelle.
- **Commits locaux autorisés pour ce run** (validé par l'utilisateur le 2026-08-06) : chaque tâche se termine par son commit local. **Aucun `git push`, jamais.**
- Message de commit en français, préfixe conventionnel, terminé par `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Tests unitaires : `yarn test:local:unit`. Tests DB : `yarn test:local:db`. Les deux acceptent `--grep "..."`.

## Ordre des tâches

Task 2 précède Tasks 3 et 4 (elles écrivent et lisent la colonne). Task 5 est indépendante.

---

### Task 1: Restaurer la sémantique de `dateDerniereActualisationToken` — ✅ FAITE

Commit `b16881a0`. La factory ne pose plus `dateDerniereActualisationToken` à `now` que
lorsqu'un token push est fourni, et le contrôleur normalise `''` en `undefined`
(`registration_token || undefined`) pour que la chaîne vide envoyée par l'app n'efface pas
le token stocké via le `??` restauré.

`git diff develop -- src/domain/jeune/configuration-application.ts` était vide à l'issue de
cette tâche. La Task 3 y **ajoute** un champ : le critère devient « les deux champs
préexistants sont inchangés », pas « diff vide ».

Aucune action. Sa revue de tâche est repliée dans la revue finale (Task 6).

---

### Task 2: Ajouter la colonne `date_derniere_activite` sur `jeune_invite`

**Files:**
- Create: `src/infrastructure/sequelize/migrations/20260806000000-ajouter-date-derniere-activite-jeune-invite.js`
- Modify: `src/infrastructure/sequelize/models/jeune-invite.sql-model.ts` (après le bloc `dateDerniereActualisationToken`, ligne ~46)
- Modify: `test/fixtures/sql-models/jeune-invite.sql-model.ts`

**Interfaces:**
- Consumes: rien.
- Produces: colonne SQL `jeune_invite.date_derniere_activite` (`DATE`, nullable) ; propriété `JeuneInviteDto.dateDerniereActivite: Date | null` ; clé `dateDerniereActivite` dans `unJeuneInviteDto()`, valant `null` par défaut.

- [ ] **Step 1: Créer la migration**

Créer `src/infrastructure/sequelize/migrations/20260806000000-ajouter-date-derniere-activite-jeune-invite.js` :

```js
'use strict'

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('jeune_invite', 'date_derniere_activite', {
      type: Sequelize.DATE,
      allowNull: true
    })
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('jeune_invite', 'date_derniere_activite')
  }
}
```

- [ ] **Step 2: Ajouter la colonne au modèle Sequelize**

Dans `src/infrastructure/sequelize/models/jeune-invite.sql-model.ts`, classe `JeuneInviteDto`, insérer juste après le bloc `dateDerniereActualisationToken` :

```typescript
  @Column({
    field: 'date_derniere_activite',
    type: DataType.DATE
  })
  dateDerniereActivite: Date | null
```

- [ ] **Step 3: Ajouter la clé à la fixture**

Dans `test/fixtures/sql-models/jeune-invite.sql-model.ts`, dans l'objet `defaults`, ajouter juste après `dateDerniereActualisationToken` :

```typescript
    dateDerniereActivite: null,
```

Valeur par défaut `null` : elle représente une ligne antérieure à la migration, le cas que les tests de la Task 4 doivent couvrir.

- [ ] **Step 4: Appliquer la migration et vérifier la compilation**

```bash
yarn start:pg:db
yarn migration
yarn build
```

Attendu : migration appliquée sans erreur, build exit 0. `AsSql<JeuneInviteDto>` exige désormais `dateDerniereActivite`, donc toute construction incomplète ferait échouer le build — c'est le filet de sécurité de cette étape.

- [ ] **Step 5: Vérifier que la colonne existe en base**

```bash
yarn psql -c "\d jeune_invite"
```

Attendu : la ligne `date_derniere_activite | timestamp with time zone |` apparaît.

- [ ] **Step 6: Lancer les tests DB de l'invité**

```bash
yarn test:local:db --grep "JeuneInvite"
```

Attendu : tout vert. La colonne est ajoutée mais encore ni écrite ni lue, donc rien ne doit changer.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/sequelize/migrations/20260806000000-ajouter-date-derniere-activite-jeune-invite.js \
        src/infrastructure/sequelize/models/jeune-invite.sql-model.ts \
        test/fixtures/sql-models/jeune-invite.sql-model.ts
git commit -m "feat: colonne date_derniere_activite sur jeune_invite"
```

---

### Task 3: Écrire `date_derniere_activite` à chaque appel de configuration

Le champ est posé **sans condition** par la factory partagée, mais persisté **uniquement**
par le repository invité. Le repository du jeune standard n'est pas modifié : la table
`jeune` n'a pas la colonne, le champ y est simplement ignoré.

**Files:**
- Modify: `src/domain/jeune/configuration-application.ts` (interface `ConfigurationApplication`, ligne ~9 ; factory `mettreAJour`, ligne ~55)
- Modify: `src/infrastructure/repositories/jeune/jeune-invite-configuration-application-sql.repository.db.ts` (`save`, `toConfigurationApplication`, `attributesConfigurationApplication`)
- Test: `test/application/commands/update-jeune-configuration-application.command.handler.test.ts`
- Test: `test/infrastructure/repositories/jeune/jeune-invite-configuration-application-sql.repository.db.test.ts`

**Interfaces:**
- Consumes: `JeuneInviteDto.dateDerniereActivite` (Task 2).
- Produces: `ConfigurationApplication.dateDerniereActivite?: Date`, posé à `now` par `ConfigurationApplication.Factory.mettreAJour` à chaque appel ; colonne `date_derniere_activite` renseignée pour les invités, lue par la Task 4.

- [ ] **Step 1: Écrire le test du domaine**

Dans `test/application/commands/update-jeune-configuration-application.command.handler.test.ts`, à l'intérieur du `describe('dateDerniereActualisationToken', ...)` existant, ajouter :

```typescript
      it('pose dateDerniereActivite à maintenant même sans token', async () => {
        // Given
        const utilisateur = unUtilisateurJeune()
        jeuneConfigurationApplicationRepository.get
          .withArgs(utilisateur.id)
          .resolves({
            idJeune: utilisateur.id,
            pushNotificationToken: 'ancienToken',
            dateDerniereActualisationToken: dateAncienne,
            fuseauHoraire: 'Europe/Paris'
          })
        jeuneAuthorizer.autoriserLeJeune.resolves(emptySuccess())

        // When
        await updateJeuneConfigurationApplicationCommandHandler.execute(
          { idJeune: utilisateur.id, pushNotificationToken: undefined },
          utilisateur
        )

        // Then
        const configSauvegardee =
          jeuneConfigurationApplicationRepository.save.getCall(0).args[0]
        expect(configSauvegardee.dateDerniereActivite).to.deep.equal(
          uneDatetime().toJSDate()
        )
      })
```

`dateAncienne` est la constante déjà déclarée en tête de ce `describe` par la Task 1.

- [ ] **Step 2: Lancer le test et vérifier qu'il échoue**

```bash
yarn test:local:unit --grep "pose dateDerniereActivite"
```

Attendu : ÉCHEC à la compilation — `dateDerniereActivite` n'existe pas sur le type `ConfigurationApplication`.

- [ ] **Step 3: Ajouter le champ au domaine**

Dans `src/domain/jeune/configuration-application.ts`, dans l'interface `ConfigurationApplication`, ajouter juste après `dateDerniereActualisationToken` :

```typescript
  dateDerniereActivite?: Date
```

Le champ est **optionnel** à dessein : `Jeune.ConfigurationApplication` est un ré-export du même type (`jeune.ts:38`), consommé par l'entité `Jeune`, les fixtures et `jeune-sql.repository.db.ts`. Un champ requis les ferait toutes échouer sans bénéfice.

Ne rien ajouter à l'interface `AMettreAJour` : la valeur ne vient jamais du client.

Puis, dans `mettreAJour`, ajouter juste après la ligne `dateDerniereActualisationToken: …` :

```typescript
        dateDerniereActivite: this.dateService.nowJs(),
```

- [ ] **Step 4: Lancer le test et vérifier qu'il passe**

```bash
yarn test:local:unit --grep "pose dateDerniereActivite"
```

Attendu : PASS.

- [ ] **Step 5: Écrire les tests de persistance**

Dans `test/infrastructure/repositories/jeune/jeune-invite-configuration-application-sql.repository.db.test.ts` :

a) Dans le premier test de `get` (`retourne la configuration application (sans préférences)`), ajouter `dateDerniereActivite: uneDatetime().toJSDate(),` à l'objet passé à `unJeuneInviteDto({...})`, et la même clé à l'objet `expected`. Sans ça, le `deep.equal` échouera : `get` retournera une clé supplémentaire.

b) Dans le second test de `get` (`applique le fuseau horaire par défaut quand il est absent`), ajouter `dateDerniereActivite: null,` à l'objet passé à `unJeuneInviteDto({...})` et l'assertion :

```typescript
        expect(result?.dateDerniereActivite).to.equal(undefined)
```

c) Dans le premier test de `save` (`met à jour la configuration de l'invité`), ajouter `dateDerniereActivite: uneDatetime().toJSDate(),` à l'objet `configuration` et l'assertion :

```typescript
      expect(result?.dateDerniereActivite).to.deep.equal(
        uneDatetime().toJSDate()
      )
```

d) Dans le second test de `save` (`écrit null pour les champs absents`), ajouter l'assertion :

```typescript
      expect(result?.dateDerniereActivite).to.equal(null)
```

- [ ] **Step 6: Lancer les tests et vérifier qu'ils échouent**

```bash
yarn test:local:db --grep "JeuneInviteConfigurationApplicationSqlRepository"
```

Attendu : ÉCHEC. Le repository ne lit ni n'écrit encore la colonne.

- [ ] **Step 7: Persister le champ côté invité**

Dans `src/infrastructure/repositories/jeune/jeune-invite-configuration-application-sql.repository.db.ts` :

Dans `save`, ajouter à l'objet passé à `JeuneInviteSqlModel.update`, après `dateDerniereActualisationToken` :

```typescript
        dateDerniereActivite:
          configurationApplication.dateDerniereActivite ?? null,
```

Dans `toConfigurationApplication`, ajouter après `dateDerniereActualisationToken` :

```typescript
    dateDerniereActivite: jeuneInviteSqlModel.dateDerniereActivite ?? undefined
```

Dans `attributesConfigurationApplication`, ajouter `'dateDerniereActivite',` après `'dateDerniereActualisationToken'`.

**Ne pas** modifier `jeune-configuration-application-sql.repository.db.ts` : c'est ce qui confine l'effet à l'invité.

- [ ] **Step 8: Lancer les tests et vérifier qu'ils passent**

```bash
yarn test:local:db --grep "JeuneInviteConfigurationApplicationSqlRepository"
```

Attendu : tous PASS.

- [ ] **Step 9: Vérifier que le chemin du jeune standard est intact**

```bash
git diff develop -- src/infrastructure/repositories/jeune/jeune-configuration-application-sql.repository.db.ts
yarn test:local:db --grep "JeuneConfigurationApplicationSqlRepository"
yarn test:local:unit --grep "ArchiveJeune"
```

Attendu : premier diff **vide**, tests verts. Le champ traverse la factory pour tout le monde mais n'est persisté que côté invité.

- [ ] **Step 10: Lancer la suite complète du handler**

```bash
yarn test:local:unit --grep "UpdateJeuneConfigurationApplicationCommand"
```

Attendu : tout vert.

- [ ] **Step 11: Commit**

```bash
git add src/domain/jeune/configuration-application.ts \
        src/infrastructure/repositories/jeune/jeune-invite-configuration-application-sql.repository.db.ts \
        test/application/commands/update-jeune-configuration-application.command.handler.test.ts \
        test/infrastructure/repositories/jeune/jeune-invite-configuration-application-sql.repository.db.test.ts
git commit -m "feat: date_derniere_activite invité écrite à chaque configuration"
```

---

### Task 4: Baser le signal de purge sur `date_derniere_activite`

**Files:**
- Modify: `src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.ts` (les trois `Sequelize.col('date_derniere_actualisation_token')`, lignes 26, 35, 58)
- Test: `test/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.test.ts`

**Interfaces:**
- Consumes: `date_derniere_activite` (Task 2), renseignée par la Task 3.
- Produces: aucun changement de signature. `recupererInvitesInactifs` et `compterInvitesInactifs` gardent leurs signatures ; seule la colonne du `GREATEST` change.

- [ ] **Step 1: Réécrire le premier test de `recupererInvitesInactifs`**

Dans `test/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.test.ts`, remplacer intégralement le premier `it` du `describe('recupererInvitesInactifs', ...)` par :

```typescript
    it('retourne les invités dont GREATEST(activite, creation) < seuil', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-activite-vieille',
          idAuthentification: 'sub-inactif',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActivite: maintenant.minus({ months: 18 }).toJSDate()
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-avant-migration',
          idAuthentification: 'sub-avant-migration',
          dateCreation: maintenant.minus({ months: 18 }).toJSDate(),
          dateDerniereActivite: null
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif-activite-recente',
          idAuthentification: 'sub-actif',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActivite: maintenant.minus({ days: 5 }).toJSDate()
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif-cree-recemment',
          idAuthentification: 'sub-recent',
          dateCreation: maintenant.minus({ days: 5 }).toJSDate(),
          dateDerniereActivite: null
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-malgre-token-recent',
          idAuthentification: 'sub-token-recent',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActivite: maintenant.minus({ months: 18 }).toJSDate(),
          dateDerniereActualisationToken: maintenant
            .minus({ days: 2 })
            .toJSDate()
        })
      )

      // When
      const inactifs = await repository.recupererInvitesInactifs(seuil, 100)

      // Then
      expect(inactifs.map(i => i.id).sort()).to.deep.equal([
        'inactif-activite-vieille',
        'inactif-avant-migration',
        'inactif-malgre-token-recent'
      ])
      expect(inactifs[0]).to.have.property('idAuthentification')

      const inactifActiviteVieille = inactifs.find(
        i => i.id === 'inactif-activite-vieille'
      )
      expect(inactifActiviteVieille?.dateReference.getTime()).to.equal(
        maintenant.minus({ months: 18 }).toJSDate().getTime()
      )
      const inactifAvantMigration = inactifs.find(
        i => i.id === 'inactif-avant-migration'
      )
      expect(inactifAvantMigration?.dateReference.getTime()).to.equal(
        maintenant.minus({ months: 18 }).toJSDate().getTime()
      )
    })
```

`inactif-malgre-token-recent` verrouille la décision de design : une actualisation de token récente ne protège **plus** de la purge. `inactif-avant-migration` couvre la ligne antérieure à la migration, qui retombe sur `date_creation`.

- [ ] **Step 2: Adapter les autres tests du fichier**

Dans `it('respecte la limite passée', ...)` et dans le `describe('compterInvitesInactifs', ...)`, remplacer **chaque** occurrence de `dateDerniereActualisationToken: null` par `dateDerniereActivite: null`.

- [ ] **Step 3: Lancer les tests et vérifier qu'ils échouent**

```bash
yarn test:local:db --grep "JeuneInviteSqlRepository"
```

Attendu : ÉCHEC sur `recupererInvitesInactifs`. La requête lit encore `date_derniere_actualisation_token` : `inactif-malgre-token-recent` est absent du résultat (protégé à tort par son token récent) et `actif-activite-recente` y figure à tort (la fixture pose `dateDerniereActualisationToken: uneDate()`, soit `2022-03-01`, donc bien antérieure au seuil).

- [ ] **Step 4: Changer la colonne lue**

Dans `src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.ts`, remplacer les **trois** occurrences de :

```typescript
Sequelize.col('date_derniere_actualisation_token'),
```

par :

```typescript
Sequelize.col('date_derniere_activite'),
```

(une dans l'`attributes` de `recupererInvitesInactifs`, une dans son `where`, une dans le `where` de `compterInvitesInactifs` — l'indentation diffère entre les trois, la reproduire telle quelle.)

- [ ] **Step 5: Lancer les tests et vérifier qu'ils passent**

```bash
yarn test:local:db --grep "JeuneInviteSqlRepository"
```

Attendu : tous PASS.

- [ ] **Step 6: Vérifier qu'aucune référence à l'ancien signal ne subsiste**

```bash
grep -n "date_derniere_actualisation_token" src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.ts
```

Attendu : **aucun résultat**.

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.ts \
        test/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.test.ts
git commit -m "feat: purge invités basée sur date_derniere_activite"
```

---

### Task 5: Passer la rétention en jours

L'unité passe du mois au jour, seule façon d'exprimer 90 jours. Le défaut du code reste conservateur (365 jours) : la valeur opérationnelle de 90 est portée par la variable d'environnement, modifiable sans redéploiement. Une variable oubliée fait purger **moins**, jamais plus.

**Files:**
- Modify: `src/config/configuration.ts` (bloc `purgeInvites`)
- Modify: `src/config/configuration.schema.ts` (bloc `purgeInvites`)
- Modify: `src/application/jobs/purger-invites-inactifs.job.handler.db.ts:36,42`
- Modify: `test/utils/test-config.ts` (bloc `purgeInvites`)

**Interfaces:**
- Consumes: rien.
- Produces: clé `jobs.purgeInvites.retentionJours` (string, lue via `Number(...)`), remplaçant `retentionMois`.

- [ ] **Step 1: Renommer la clé de configuration**

Dans `src/config/configuration.ts`, bloc `purgeInvites`, remplacer :

```typescript
        retentionMois: process.env.JOB_PURGE_INVITES_RETENTION_MOIS ?? '12',
```

par :

```typescript
        retentionJours: process.env.JOB_PURGE_INVITES_RETENTION_JOURS ?? '365',
```

- [ ] **Step 2: Mettre à jour le schéma Joi**

Dans `src/config/configuration.schema.ts`, bloc `purgeInvites`, remplacer `retentionMois: Joi.number().required(),` par :

```typescript
      retentionJours: Joi.number().required(),
```

- [ ] **Step 3: Mettre à jour la config de test**

Dans `test/utils/test-config.ts`, bloc `purgeInvites`, remplacer `retentionMois: '12',` par :

```typescript
        retentionJours: '365',
```

- [ ] **Step 4: Calculer le seuil en jours dans le job**

Dans `src/application/jobs/purger-invites-inactifs.job.handler.db.ts`, remplacer :

```typescript
    const retentionMois = Number(config.retentionMois)
```

par :

```typescript
    const retentionJours = Number(config.retentionJours)
```

puis :

```typescript
    const dateSeuil = maintenant.minus({ months: retentionMois }).toJSDate()
```

par :

```typescript
    const dateSeuil = maintenant.minus({ days: retentionJours }).toJSDate()
```

- [ ] **Step 5: Vérifier qu'aucune référence à l'ancien nom ne subsiste**

```bash
grep -rn "retentionMois\|RETENTION_MOIS" src test
```

Attendu : **aucun résultat**.

- [ ] **Step 6: Vérifier build et tests du job**

```bash
yarn build
yarn test:local:unit --grep "PurgerInvitesInactifsJobHandler"
```

Attendu : build exit 0, tests verts. Ces tests stubent le repository et n'assertent pas la valeur du seuil, donc le changement d'unité ne doit rien casser ; s'ils échouent, c'est un couplage à corriger.

- [ ] **Step 7: Commit**

```bash
git add src/config/configuration.ts \
        src/config/configuration.schema.ts \
        src/application/jobs/purger-invites-inactifs.job.handler.db.ts \
        test/utils/test-config.ts
git commit -m "feat: rétention de la purge invités exprimée en jours"
```

---

### Task 6: Vérification globale de la branche

**Files:** aucun, sauf correction d'un problème détecté.

**Interfaces:**
- Consumes: Tasks 1 à 5.
- Produces: rien.

- [ ] **Step 1: Lint**

```bash
yarn lint
```

Attendu : exit 0.

- [ ] **Step 2: Build**

```bash
yarn build
```

Attendu : exit 0.

- [ ] **Step 3: Suite unitaire complète**

```bash
yarn test:local:unit
```

Attendu : tout vert. Surveiller particulièrement `ArchiveJeune` et les query handlers exposant `lastActivity` : la Task 1 ayant restauré les deux champs préexistants de la factory à l'identique de `develop`, et la Task 3 n'ayant fait qu'**ajouter** un champ non persisté côté jeune, ces suites doivent passer sans modification. Un échec ici signalerait une fuite du nouveau champ vers le chemin du jeune standard.

- [ ] **Step 4: Suite DB complète**

```bash
yarn start:pg:db
yarn migration
yarn test:local:db
```

Attendu : tout vert.

- [ ] **Step 5: Vérifier que le champ token n'est plus détourné**

```bash
grep -rn "dateDerniereActualisationToken" src | grep -v "\.test\."
```

Attendu : les occurrences restantes ne concernent que la sémantique « token » — factory, repositories de configuration, mappers, `archive-jeune.ts`, modèles SQL. **Aucune** dans `jeune-invite-sql.repository.db.ts` ni dans le job de purge.

- [ ] **Step 6: Vérifier que le chemin du jeune standard n'a pas bougé**

```bash
git diff develop --stat -- src/infrastructure/repositories/jeune/jeune-configuration-application-sql.repository.db.ts \
                           src/application/queries/query-mappers/jeune.mappers.ts \
                           src/domain/archive-jeune.ts
```

Attendu : **sortie vide**.

- [ ] **Step 7: Récapituler à l'utilisateur les actions hors code**

Ne pas exécuter, seulement rapporter :

1. Poser `JOB_PURGE_INVITES_RETENTION_JOURS=90` sur les environnements Scalingo. `JOB_PURGE_INVITES_RETENTION_MOIS` n'a jamais été déployée.
2. Signaler dans la PR que le signal dépend du client mobile : si une future version de l'app cessait d'appeler `configuration-application` au démarrage, le signal se figerait et la purge deviendrait destructrice. Garder le `dryRun` actif jusqu'à validation des chiffres.
3. Après déploiement : `yarn tasks:initialiser-les-crons`.
