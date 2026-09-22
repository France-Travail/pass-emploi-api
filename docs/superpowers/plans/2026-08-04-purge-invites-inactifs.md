# Purge des invités inactifs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un job planifié qui supprime les invités (`jeune_invite`) inactifs depuis longtemps — ligne DB **et** identité OIDC côté connect — avec dry-run, plafond par run et alerte sur pic.

**Architecture:** Job Bull `PURGER_INVITES_INACTIFS` calqué sur `NettoyerLesDonneesJobHandler`, renvoyant un `SuiviJob`. Le signal d'inactivité est rendu fiable en amont (Option A) en découplant `dateDerniereActualisationToken` du push : la date est désormais bumpée à chaque appel de configuration (= login), token présent ou non. Suppression de l'identité connect via un nouveau chemin `deleteAccountByIdAuth` (par `idAuthentification`, sans lookup jeune/conseiller), toujours **Redis d'abord puis DB**.

**Tech Stack:** NestJS 11, TypeScript 4.9, Sequelize 6 (PostgreSQL 14), Bull 4 (Redis), Mocha + Chai + Sinon, class-validator, Joi (config schema), Luxon.

## Global Constraints

- Prettier : `semi: false`, `singleQuote: true`, `tabWidth: 2`, `trailingComma: none`, `arrowParens: avoid`. Strings sans apostrophe → guillemets simples ; avec apostrophe → guillemets doubles.
- ESLint : pas de `console` (logger NestJS), pas de `process.env` direct (ConfigService), `explicit-function-return-type`, pas de `any`. Variables inutilisées préfixées `_`.
- Erreurs métier via le pattern `Result` (`success`/`failure`), pas d'exception métier.
- Tests DB en `.db.test.ts`, colocalisés dans `/test` (structure miroir de `/src`), harnais `getDatabase()` + `cleanPG()`.
- Marqueurs `// Given` / `// When` / `// Then` conservés dans les tests.
- Toute entrée `resolutions` en `">=<version>"` (non concerné ici).
- Ne **pas** committer automatiquement sans validation de l'utilisateur : chaque étape « Commit » liste la commande, mais l'exécution du commit reste à la main de l'utilisateur si sa préférence l'exige.

**Signal d'inactivité (verbatim spec §3) :** `GREATEST(date_derniere_actualisation_token, date_creation) < maintenant − retentionMois`.

**Ordre de suppression (verbatim spec §4.2) :** identité connect (Redis) **d'abord**, ligne DB **ensuite**. Échec Redis ⇒ la ligne n'est **pas** supprimée (retry au prochain run).

---

## File Structure

**Option A (signal fiable) :**
- Modify `src/infrastructure/routes/validation/jeunes.inputs.ts` — `registration_token` tolère le vide.
- Modify `src/domain/jeune/configuration-application.ts` — factory bump la date à chaque appel.

**Suppression identité connect par idAuthentification :**
- Modify `src/infrastructure/clients/oidc-client.db.ts` — `deleteAccountByIdAuth`.
- Modify `src/domain/authentification.ts` — signature `supprimerCompteIdpInvite`.
- Modify `src/infrastructure/repositories/authentification-sql.repository.db.ts` — implémentation.

**Repository invité (candidats + comptage) :**
- Modify `src/domain/jeune/jeune-invite.ts` — signatures repo.
- Modify `src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.ts` — implémentation.

**Job + câblage :**
- Modify `src/domain/planificateur.ts` — `JobType.PURGER_INVITES_INACTIFS` + entrée `listeCronJobs`.
- Create `src/application/jobs/purger-invites-inactifs.job.handler.db.ts` — handler.
- Modify `src/config/configuration.ts` + `src/config/configuration.schema.ts` — bloc config.
- Modify `src/app.module.ts` — enregistrement provider.

**Tests :**
- Modify `test/application/commands/update-jeune-configuration-application.command.handler.test.ts`
- Create `test/application/jobs/purger-invites-inactifs.job.handler.db.test.ts`

---

## Task 1 : Option A — la factory bump la date à chaque login

**Files:**
- Modify: `src/infrastructure/routes/validation/jeunes.inputs.ts:18-29`
- Modify: `src/domain/jeune/configuration-application.ts:46-64`
- Test: `test/application/commands/update-jeune-configuration-application.command.handler.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `ConfigurationApplication.Factory.mettreAJour(configuration, aMettreAJour)` met **toujours** `dateDerniereActualisationToken` à `dateService.nowJs()` ; `pushNotificationToken` n'est écrasé que par un token non vide.

- [ ] **Step 1: Écrire les tests qui échouent** (dans le `describe('handle')` existant, ajouter un `describe` dédié Option A)

```typescript
describe('Option A - dateDerniereActualisationToken découplée du push', () => {
  it('met la date à maintenant même sans token (push refusé)', async () => {
    // Given
    const utilisateur = unUtilisateurJeune()
    jeuneConfigurationApplicationRepository.get
      .withArgs(utilisateur.id)
      .resolves({
        idJeune: utilisateur.id,
        pushNotificationToken: 'ancienToken',
        dateDerniereActualisationToken: uneDatetime().minus({ days: 30 }).toJSDate(),
        fuseauHoraire: 'Europe/Paris'
      })
    jeuneAuthorizer.autoriserLeJeune.resolves(emptySuccess())

    // When
    await updateJeuneConfigurationApplicationCommandHandler.execute(
      { idJeune: utilisateur.id, pushNotificationToken: '' },
      utilisateur
    )

    // Then
    const configSauvegardee =
      jeuneConfigurationApplicationRepository.save.getCall(0).args[0]
    expect(configSauvegardee.dateDerniereActualisationToken).to.deep.equal(
      uneDatetime().toJSDate()
    )
    expect(configSauvegardee.pushNotificationToken).to.equal('ancienToken')
  })

  it('met la date à maintenant et stocke le token quand il est fourni', async () => {
    // Given
    const utilisateur = unUtilisateurJeune()
    jeuneConfigurationApplicationRepository.get
      .withArgs(utilisateur.id)
      .resolves({
        idJeune: utilisateur.id,
        pushNotificationToken: 'ancienToken',
        dateDerniereActualisationToken: uneDatetime().minus({ days: 30 }).toJSDate(),
        fuseauHoraire: 'Europe/Paris'
      })
    jeuneAuthorizer.autoriserLeJeune.resolves(emptySuccess())

    // When
    await updateJeuneConfigurationApplicationCommandHandler.execute(
      { idJeune: utilisateur.id, pushNotificationToken: 'nouveauToken' },
      utilisateur
    )

    // Then
    const configSauvegardee =
      jeuneConfigurationApplicationRepository.save.getCall(0).args[0]
    expect(configSauvegardee.dateDerniereActualisationToken).to.deep.equal(
      uneDatetime().toJSDate()
    )
    expect(configSauvegardee.pushNotificationToken).to.equal('nouveauToken')
  })
})
```

Ajouter en tête de fichier l'import manquant : `import { emptySuccess } from '../../../src/building-blocks/types/result'`.

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `yarn test:local:unit --grep "Option A - dateDerniereActualisationToken"`
Expected: FAIL — le premier test échoue car la date n'est pas bumpée quand le token est vide (factory actuelle : `aMettreAJour.pushNotificationToken ? now : ancienne`).

- [ ] **Step 3: Modifier la factory** (`src/domain/jeune/configuration-application.ts`, méthode `mettreAJour`)

```typescript
    mettreAJour(
      configuration: ConfigurationApplication,
      aMettreAJour: AMettreAJour
    ): ConfigurationApplication {
      return {
        idJeune: configuration.idJeune,
        pushNotificationToken:
          aMettreAJour.pushNotificationToken ||
          configuration.pushNotificationToken,
        dateDerniereActualisationToken: this.dateService.nowJs(),
        installationId:
          aMettreAJour.installationId ?? configuration.installationId,
        instanceId: aMettreAJour.instanceId ?? configuration.instanceId,
        appVersion: aMettreAJour.appVersion ?? configuration.appVersion,
        fuseauHoraire: aMettreAJour.fuseauHoraire ?? configuration.fuseauHoraire
      }
    }
```

Note : `||` (et non `??`) pour que `pushNotificationToken: ''` ne remplace pas un token existant.

- [ ] **Step 4: Relâcher la validation** (`src/infrastructure/routes/validation/jeunes.inputs.ts`, `UpdateConfigurationInput`)

```typescript
export class UpdateConfigurationInput {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  registration_token?: string

  @ApiPropertyOptional()
  @IsString()
  @IsTimeZone()
  @IsOptional()
  fuseauHoraire?: string
}
```

Le controller (`jeunes.controller.ts:203`) passe `updateConfigurationInput.registration_token` à `pushNotificationToken` ; côté command la propriété reste typée `pushNotificationToken: string`. Élargir cette propriété à `string | undefined` dans `UpdateJeuneConfigurationApplicationCommand` (`update-jeune-configuration-application.command.handler.ts:23`) : `pushNotificationToken?: string`, et adapter l'appel controller en `updateConfigurationInput.registration_token ?? ''`.

- [ ] **Step 5: Lancer les tests pour vérifier qu'ils passent**

Run: `yarn test:local:unit --grep "Option A - dateDerniereActualisationToken"`
Expected: PASS (2 tests). Vérifier aussi que les tests existants du même fichier passent : `yarn test:local:unit --grep "UpdateJeuneConfigurationApplicationCommand"`.
Note : si un ancien test asserte que la date **n'est pas** modifiée sans token, il doit être mis à jour pour refléter le nouveau comportement (bump systématique).

- [ ] **Step 6: Commit**

```bash
git add src/domain/jeune/configuration-application.ts src/infrastructure/routes/validation/jeunes.inputs.ts src/application/commands/update-jeune-configuration-application.command.handler.ts src/infrastructure/routes/jeunes.controller.ts test/application/commands/update-jeune-configuration-application.command.handler.test.ts
git commit -m "feat: dateDerniereActualisationToken bumpée à chaque login (signal de vivacité découplé du push)"
```

---

## Task 2 : Suppression de l'identité connect par idAuthentification

**Files:**
- Modify: `src/infrastructure/clients/oidc-client.db.ts:137-161`
- Modify: `src/domain/authentification.ts:105` (dans `Authentification.Repository`)
- Modify: `src/infrastructure/repositories/authentification-sql.repository.db.ts:216-223`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `OidcClient.deleteAccountByIdAuth(idAuthentification: string): Promise<void>` — `DELETE {issuerApiUrl}/accounts/:idAuthentification`, sans lookup jeune/conseiller.
  - `Authentification.Repository.supprimerCompteIdpInvite(idAuthentification: string): Promise<void>`.

- [ ] **Step 1: Ajouter la méthode au client OIDC** (`src/infrastructure/clients/oidc-client.db.ts`, juste après `deleteAccount`)

```typescript
  public async deleteAccountByIdAuth(
    idAuthentification: string
  ): Promise<void> {
    const apiKey = this.configService.get('oidc.apiKey')
    const url = `${this.configService.get('oidc').issuerApiUrl}/accounts`
    const headers = {
      'X-API-KEY': apiKey
    }
    await this.axios.delete(`${url}/${idAuthentification}`, { headers })
  }
```

- [ ] **Step 2: Déclarer la méthode repo dans le domaine** (`src/domain/authentification.ts`, interface `Repository`, à côté de `deleteUtilisateurIdp`)

```typescript
    supprimerCompteIdpInvite(idAuthentification: string): Promise<void>
```

- [ ] **Step 3: Implémenter dans le repository SQL** (`src/infrastructure/repositories/authentification-sql.repository.db.ts`, après `deleteUtilisateurIdp`)

```typescript
  async supprimerCompteIdpInvite(idAuthentification: string): Promise<void> {
    await this.oidcClient.deleteAccountByIdAuth(idAuthentification)
  }
```

- [ ] **Step 4: Compiler pour vérifier l'absence d'erreur de typage**

Run: `yarn build`
Expected: build OK (aucune erreur TypeScript ; toute classe implémentant `Authentification.Repository` doit compiler — seul `AuthentificationSqlRepository` l'implémente).

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/clients/oidc-client.db.ts src/domain/authentification.ts src/infrastructure/repositories/authentification-sql.repository.db.ts
git commit -m "feat: suppression compte IDP invité par idAuthentification"
```

---

## Task 3 : Repository invité — candidats inactifs + comptage du parc

**Files:**
- Modify: `src/domain/jeune/jeune-invite.ts:6-10` (interface `Repository`)
- Modify: `src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.ts`
- Test: `test/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.test.ts` (nouveau fichier)

**Interfaces:**
- Consumes: `unJeuneInviteDto` (fixture existante), `JeuneInviteSqlModel`.
- Produces, sur `JeuneInvite.Repository` :
  - `recupererInvitesInactifs(dateSeuil: Date, limite: number): Promise<Array<{ id: string; idAuthentification: string }>>` — invités où `GREATEST(date_derniere_actualisation_token, date_creation) < dateSeuil`, `LIMIT limite`.
  - `compterTout(): Promise<number>`.
  - `supprimer(id: string): Promise<void>`.

- [ ] **Step 1: Écrire le test DB qui échoue** (`test/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.test.ts`)

```typescript
import { DateTime } from 'luxon'
import { JeuneInviteSqlRepository } from '../../../../src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db'
import { JeuneInviteSqlModel } from '../../../../src/infrastructure/sequelize/models/jeune-invite.sql-model'
import { unJeuneInviteDto } from '../../../fixtures/sql-models/jeune-invite.sql-model'
import { expect } from '../../../utils'
import { getDatabase } from '../../../utils/database-for-testing'

describe('JeuneInviteSqlRepository', () => {
  let repository: JeuneInviteSqlRepository
  const maintenant = DateTime.fromISO('2026-08-04T12:00:00.000Z')
  const seuil = maintenant.minus({ months: 12 }).toJSDate()

  beforeEach(async () => {
    await getDatabase().cleanPG()
    repository = new JeuneInviteSqlRepository()
  })

  describe('recupererInvitesInactifs', () => {
    it('retourne les invités dont GREATEST(actualisation, creation) < seuil', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-token-vieux',
          idAuthentification: 'sub-inactif',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActualisationToken: maintenant.minus({ months: 18 }).toJSDate()
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-jamais-de-token',
          idAuthentification: 'sub-jamais',
          dateCreation: maintenant.minus({ months: 18 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif-token-recent',
          idAuthentification: 'sub-actif',
          dateCreation: maintenant.minus({ years: 3 }).toJSDate(),
          dateDerniereActualisationToken: maintenant.minus({ days: 5 }).toJSDate()
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'actif-cree-recemment',
          idAuthentification: 'sub-recent',
          dateCreation: maintenant.minus({ days: 5 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )

      // When
      const inactifs = await repository.recupererInvitesInactifs(seuil, 100)

      // Then
      expect(inactifs.map(i => i.id).sort()).to.deep.equal([
        'inactif-jamais-de-token',
        'inactif-token-vieux'
      ])
      expect(inactifs[0]).to.have.property('idAuthentification')
    })

    it('respecte la limite passée', async () => {
      // Given
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-1',
          idAuthentification: 'sub-1',
          dateCreation: maintenant.minus({ years: 2 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )
      await JeuneInviteSqlModel.creer(
        unJeuneInviteDto({
          id: 'inactif-2',
          idAuthentification: 'sub-2',
          dateCreation: maintenant.minus({ years: 2 }).toJSDate(),
          dateDerniereActualisationToken: null
        })
      )

      // When
      const inactifs = await repository.recupererInvitesInactifs(seuil, 1)

      // Then
      expect(inactifs).to.have.length(1)
    })
  })

  describe('compterTout', () => {
    it('retourne le nombre total dinvités', async () => {
      // Given
      await JeuneInviteSqlModel.creer(unJeuneInviteDto({ id: 'a', idAuthentification: 'sa' }))
      await JeuneInviteSqlModel.creer(unJeuneInviteDto({ id: 'b', idAuthentification: 'sb' }))

      // When
      const total = await repository.compterTout()

      // Then
      expect(total).to.equal(2)
    })
  })

  describe('supprimer', () => {
    it('supprime la ligne invité', async () => {
      // Given
      await JeuneInviteSqlModel.creer(unJeuneInviteDto({ id: 'a-supprimer', idAuthentification: 'sup' }))

      // When
      await repository.supprimer('a-supprimer')

      // Then
      const restant = await JeuneInviteSqlModel.findByPk('a-supprimer')
      expect(restant).to.equal(null)
    })
  })
})
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `yarn test:local:db --grep "JeuneInviteSqlRepository"`
Expected: FAIL — `repository.recupererInvitesInactifs is not a function`.

- [ ] **Step 3: Étendre l'interface du domaine** (`src/domain/jeune/jeune-invite.ts`)

```typescript
export namespace JeuneInvite {
  export interface Repository {
    existe(id: string): Promise<boolean>
    recupererInvitesInactifs(
      dateSeuil: Date,
      limite: number
    ): Promise<Array<{ id: string; idAuthentification: string }>>
    compterTout(): Promise<number>
    supprimer(id: string): Promise<void>
  }
}
```

- [ ] **Step 4: Implémenter dans le repository SQL** (`src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.ts`)

```typescript
import { Injectable } from '@nestjs/common'
import { Op, Sequelize } from 'sequelize'
import { JeuneInvite } from '../../../domain/jeune/jeune-invite'
import { JeuneInviteSqlModel } from '../../sequelize/models/jeune-invite.sql-model'

@Injectable()
export class JeuneInviteSqlRepository implements JeuneInvite.Repository {
  async existe(id: string): Promise<boolean> {
    const nombre = await JeuneInviteSqlModel.count({ where: { id } })
    return nombre > 0
  }

  async recupererInvitesInactifs(
    dateSeuil: Date,
    limite: number
  ): Promise<Array<{ id: string; idAuthentification: string }>> {
    const invites = await JeuneInviteSqlModel.findAll({
      attributes: ['id', 'idAuthentification'],
      where: Sequelize.where(
        Sequelize.fn(
          'GREATEST',
          Sequelize.col('date_derniere_actualisation_token'),
          Sequelize.col('date_creation')
        ),
        { [Op.lt]: dateSeuil }
      ),
      limit: limite
    })
    return invites.map(invite => ({
      id: invite.id,
      idAuthentification: invite.idAuthentification
    }))
  }

  async compterTout(): Promise<number> {
    return JeuneInviteSqlModel.count()
  }

  async supprimer(id: string): Promise<void> {
    await JeuneInviteSqlModel.destroy({ where: { id } })
  }
}
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `yarn test:local:db --grep "JeuneInviteSqlRepository"`
Expected: PASS (4 tests). Le cas `inactif-jamais-de-token` valide que `GREATEST` avec `date_derniere_actualisation_token = NULL` retombe bien sur `date_creation` (Postgres ignore les NULL dans `GREATEST`).

- [ ] **Step 6: Commit**

```bash
git add src/domain/jeune/jeune-invite.ts src/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.ts test/infrastructure/repositories/jeune/jeune-invite-sql.repository.db.test.ts
git commit -m "feat: repository invité - candidats inactifs, comptage, suppression"
```

---

## Task 4 : Config + JobType + entrée cron

**Files:**
- Modify: `src/config/configuration.ts:267-276` (bloc `jobs`)
- Modify: `src/config/configuration.schema.ts:205-...` (bloc `jobs`)
- Modify: `test/utils/test-config.ts:118-125` (bloc `jobs` du ConfigService de test)
- Modify: `src/domain/planificateur.ts:88` (enum) et `:255-272` (`listeCronJobs`)

**Interfaces:**
- Consumes: rien.
- Produces:
  - `Planificateur.JobType.PURGER_INVITES_INACTIFS = 'PURGER_INVITES_INACTIFS'`.
  - Config accessible via `configService.get('jobs').purgeInvites` → `{ retentionMois: number, batchMax: number, pourcentageParcMax: number, dryRun: boolean }`.

- [ ] **Step 1: Ajouter le JobType** (`src/domain/planificateur.ts`, dans `enum JobType`, après `NETTOYER_LES_DONNEES`)

```typescript
    PURGER_INVITES_INACTIFS = 'PURGER_INVITES_INACTIFS',
```

- [ ] **Step 2: Ajouter l'entrée cron** (`src/domain/planificateur.ts`, dans `listeCronJobs`, après le bloc `NETTOYER_LES_DONNEES`)

```typescript
  {
    type: Planificateur.JobType.PURGER_INVITES_INACTIFS,
    expression: '0 3 * * *',
    description:
      "Tous les jours à 3h. Purge les invités inactifs (ligne DB + identité connect)."
  },
```

- [ ] **Step 3: Ajouter les valeurs de config** (`src/config/configuration.ts`, dans le bloc `jobs`)

```typescript
    jobs: {
      notificationRecherches: {
        nombreDeRequetesEnParallele:
          process.env.JOB_NOMBRE_RECHERCHES_PARALLELE ?? '5'
      },
      mailConseillers: {
        nombreDeConseillersEnParallele:
          process.env.JOB_NOMBRE_CONSEILLERS_PARALLELE ?? '100'
      },
      purgeInvites: {
        retentionMois: process.env.JOB_PURGE_INVITES_RETENTION_MOIS ?? '12',
        batchMax: process.env.JOB_PURGE_INVITES_BATCH_MAX ?? '500',
        pourcentageParcMax:
          process.env.JOB_PURGE_INVITES_POURCENTAGE_MAX ?? '20',
        dryRun: process.env.JOB_PURGE_INVITES_DRY_RUN !== 'false'
      }
    },
```

Note : `dryRun` défaut `true` (n'est `false` que si la variable vaut explicitement `'false'`), conforme spec §5 (dry-run au 1er déploiement). Valeurs `batchMax`/`pourcentageParcMax` = points de départ à recalibrer après dry-run (spec §9).

- [ ] **Step 4: Ajouter le schéma Joi** (`src/config/configuration.schema.ts`, dans `jobs: Joi.object({...})`)

```typescript
  jobs: Joi.object({
    notificationRecherches: Joi.object({
      nombreDeRequetesEnParallele: Joi.number().required()
    }),
    mailConseillers: Joi.object({
      nombreDeConseillersEnParallele: Joi.number().required()
    }),
    purgeInvites: Joi.object({
      retentionMois: Joi.number().required(),
      batchMax: Joi.number().required(),
      pourcentageParcMax: Joi.number().required(),
      dryRun: Joi.boolean().required()
    })
  }),
```

Vérifier la ponctuation exacte (virgules entre objets) en relisant le bloc existant avant/après.

- [ ] **Step 5: Ajouter `purgeInvites` au ConfigService de test** (`test/utils/test-config.ts`, dans le bloc `jobs`)

```typescript
    jobs: {
      notificationRecherches: {
        nombreDeRequetesEnParallele: '5'
      },
      mailConseillers: {
        nombreDeConseillersEnParallele: '100'
      },
      purgeInvites: {
        retentionMois: '12',
        batchMax: '500',
        pourcentageParcMax: '20',
        dryRun: false
      }
    },
```

`dryRun: false` par défaut en test → les tests « mode réel » de la Task 5 fonctionnent tels quels ; le test dry-run bascule la valeur localement.

- [ ] **Step 6: Compiler + smoke test config**

Run: `yarn build`
Expected: build OK. Le schéma Joi valide au démarrage ; les nouvelles clés ont toutes un défaut, donc aucune variable d'env supplémentaire requise.

- [ ] **Step 7: Commit**

```bash
git add src/domain/planificateur.ts src/config/configuration.ts src/config/configuration.schema.ts test/utils/test-config.ts
git commit -m "feat: JobType PURGER_INVITES_INACTIFS + config purge invités"
```

---

## Task 5 : Job handler de purge

**Files:**
- Create: `src/application/jobs/purger-invites-inactifs.job.handler.db.ts`
- Modify: `src/app.module.ts:147-ish` (import) et `:945-ish` (providers)
- Test: `test/application/jobs/purger-invites-inactifs.job.handler.db.test.ts`

**Interfaces:**
- Consumes:
  - `JeuneInvite.Repository` (Task 3) : `recupererInvitesInactifs`, `compterTout`, `supprimer`.
  - `Authentification.Repository.supprimerCompteIdpInvite` (Task 2).
  - `Planificateur.JobType.PURGER_INVITES_INACTIFS` (Task 4), config `jobs.purgeInvites` (Task 4).
  - `JobHandler` base, `SuiviJob`, `DateService`, `ProcessJobType`, `ConfigService`.
- Produces: `PurgerInvitesInactifsJobHandler` (provider NestJS) renvoyant un `SuiviJob` dont `resultat` = `{ dryRun, nbPurges, nbSimules, nbEchecsRedis, nbEchecsDb, pourcentageParc, ageMinJours, ageMaxJours }`.

- [ ] **Step 1: Écrire le test DB qui échoue** (`test/application/jobs/purger-invites-inactifs.job.handler.db.test.ts`)

```typescript
import { StubbedType, stubInterface } from '@salesforce/ts-sinon'
import { SinonSandbox } from 'sinon'
import { Authentification } from 'src/domain/authentification'
import { JeuneInvite } from 'src/domain/jeune/jeune-invite'
import { SuiviJob } from 'src/domain/suivi-job'
import { DateService } from 'src/utils/date-service'
import { uneDatetime } from 'test/fixtures/date.fixture'
import { PurgerInvitesInactifsJobHandler } from '../../../src/application/jobs/purger-invites-inactifs.job.handler.db'
import {
  createSandbox,
  expect,
  StubbedClass,
  stubClass
} from '../../utils'
import { testConfig } from '../../utils/module-for-testing'

describe('PurgerInvitesInactifsJobHandler', () => {
  let handler: PurgerInvitesInactifsJobHandler
  let dateService: StubbedClass<DateService>
  let suiviJobService: StubbedType<SuiviJob.Service>
  let jeuneInviteRepository: StubbedType<JeuneInvite.Repository>
  let authentificationRepository: StubbedType<Authentification.Repository>
  const maintenant = uneDatetime()

  beforeEach(() => {
    const sandbox: SinonSandbox = createSandbox()
    dateService = stubClass(DateService)
    dateService.now.returns(maintenant)
    suiviJobService = stubInterface(sandbox)
    jeuneInviteRepository = stubInterface(sandbox)
    authentificationRepository = stubInterface(sandbox)
    handler = new PurgerInvitesInactifsJobHandler(
      dateService,
      suiviJobService,
      jeuneInviteRepository,
      authentificationRepository,
      testConfig()
    )
  })

  it('supprime IDP puis DB pour chaque invité inactif (mode réel)', async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      { id: 'inv1', idAuthentification: 'sub1' },
      { id: 'inv2', idAuthentification: 'sub2' }
    ])

    // When
    const suivi = await handler.handle()

    // Then
    expect(
      authentificationRepository.supprimerCompteIdpInvite
    ).to.have.been.calledWith('sub1')
    expect(jeuneInviteRepository.supprimer).to.have.been.calledWith('inv1')
    const resultat = suivi.resultat as { nbPurges: number }
    expect(resultat.nbPurges).to.equal(2)
  })

  it("ne supprime pas la ligne DB si la suppression IDP échoue", async () => {
    // Given
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      { id: 'inv1', idAuthentification: 'sub1' }
    ])
    authentificationRepository.supprimerCompteIdpInvite
      .withArgs('sub1')
      .rejects(new Error('connect KO'))

    // When
    const suivi = await handler.handle()

    // Then
    expect(jeuneInviteRepository.supprimer).not.to.have.been.called
    const resultat = suivi.resultat as {
      nbEchecsRedis: number
      nbPurges: number
    }
    expect(resultat.nbEchecsRedis).to.equal(1)
    expect(resultat.nbPurges).to.equal(0)
  })

  it('en dry-run ne supprime rien et compte les simulations', async () => {
    // Given
    const config = testConfig()
    config.get('jobs').purgeInvites.dryRun = true
    handler = new PurgerInvitesInactifsJobHandler(
      dateService,
      suiviJobService,
      jeuneInviteRepository,
      authentificationRepository,
      config
    )
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves([
      { id: 'inv1', idAuthentification: 'sub1' }
    ])

    // When
    const suivi = await handler.handle()

    // Then
    expect(authentificationRepository.supprimerCompteIdpInvite).not.to.have.been.called
    expect(jeuneInviteRepository.supprimer).not.to.have.been.called
    const resultat = suivi.resultat as { nbSimules: number }
    expect(resultat.nbSimules).to.equal(1)
  })

  it('abandonne si le pourcentage du parc dépasse le seuil', async () => {
    // Given : seuil 20%, on tente 30 sur 100
    jeuneInviteRepository.compterTout.resolves(100)
    jeuneInviteRepository.recupererInvitesInactifs.resolves(
      Array.from({ length: 30 }, (_, i) => ({
        id: `inv${i}`,
        idAuthentification: `sub${i}`
      }))
    )

    // When
    const suivi = await handler.handle()

    // Then
    expect(authentificationRepository.supprimerCompteIdpInvite).not.to.have.been.called
    expect(jeuneInviteRepository.supprimer).not.to.have.been.called
    expect(suivi.succes).to.equal(false)
  })
})
```

Note : `testConfig` est exporté depuis `test/utils/module-for-testing.ts` (ré-export de `test/utils/test-config.ts`) et contient `jobs.purgeInvites` après la Task 4/Step 5. `testConfig().get('jobs').purgeInvites` renvoie donc `{ retentionMois: '12', batchMax: '500', pourcentageParcMax: '20', dryRun: false }`. Le test dry-run récupère l'objet via `config.get('jobs').purgeInvites` (référence mutable) et bascule `dryRun = true` avant de construire le handler.

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `yarn test:local:db --grep "PurgerInvitesInactifsJobHandler"`
Expected: FAIL — module `purger-invites-inactifs.job.handler.db` introuvable.

- [ ] **Step 3: Écrire le handler** (`src/application/jobs/purger-invites-inactifs.job.handler.db.ts`)

```typescript
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DateTime } from 'luxon'
import { JobHandler } from '../../building-blocks/types/job-handler'
import {
  Authentification,
  AuthentificationRepositoryToken
} from '../../domain/authentification'
import {
  JeuneInvite,
  JeuneInviteRepositoryToken
} from '../../domain/jeune/jeune-invite'
import { Planificateur, ProcessJobType } from '../../domain/planificateur'
import { SuiviJob, SuiviJobServiceToken } from '../../domain/suivi-job'
import { DateService } from '../../utils/date-service'

@Injectable()
@ProcessJobType(Planificateur.JobType.PURGER_INVITES_INACTIFS)
export class PurgerInvitesInactifsJobHandler extends JobHandler {
  constructor(
    private dateService: DateService,
    @Inject(SuiviJobServiceToken)
    suiviJobService: SuiviJob.Service,
    @Inject(JeuneInviteRepositoryToken)
    private readonly jeuneInviteRepository: JeuneInvite.Repository,
    @Inject(AuthentificationRepositoryToken)
    private readonly authentificationRepository: Authentification.Repository,
    private readonly configService: ConfigService
  ) {
    super(Planificateur.JobType.PURGER_INVITES_INACTIFS, suiviJobService)
  }

  async handle(): Promise<SuiviJob> {
    const maintenant = this.dateService.now()
    const config = this.configService.get('jobs').purgeInvites
    const retentionMois = Number(config.retentionMois)
    const batchMax = Number(config.batchMax)
    const pourcentageParcMax = Number(config.pourcentageParcMax)
    const dryRun: boolean = config.dryRun

    const dateSeuil = maintenant.minus({ months: retentionMois }).toJSDate()

    let nbErreurs = 0
    let nbPurges = 0
    let nbSimules = 0
    let nbEchecsRedis = 0
    let nbEchecsDb = 0
    let ageMinJours: number | null = null
    let ageMaxJours: number | null = null
    let pourcentageParc = 0
    let succes = true

    try {
      const total = await this.jeuneInviteRepository.compterTout()
      const candidats =
        await this.jeuneInviteRepository.recupererInvitesInactifs(
          dateSeuil,
          batchMax
        )

      pourcentageParc = total > 0 ? (candidats.length / total) * 100 : 0

      if (pourcentageParc > pourcentageParcMax) {
        this.logger.warn(
          `Purge invités abandonnée: ${pourcentageParc.toFixed(
            1
          )}% du parc dépasse le seuil ${pourcentageParcMax}%`
        )
        return {
          jobType: this.jobType,
          nbErreurs: 1,
          succes: false,
          dateExecution: maintenant,
          tempsExecution: DateService.calculerTempsExecution(maintenant),
          resultat: {
            dryRun,
            abandon: true,
            pourcentageParc,
            nbCandidats: candidats.length,
            total
          }
        }
      }

      for (const invite of candidats) {
        if (dryRun) {
          nbSimules++
          continue
        }
        try {
          await this.authentificationRepository.supprimerCompteIdpInvite(
            invite.idAuthentification
          )
        } catch (e) {
          this.logger.warn(
            `Echec suppression IDP invité ${invite.idAuthentification}`,
            e
          )
          nbEchecsRedis++
          continue
        }
        try {
          await this.jeuneInviteRepository.supprimer(invite.id)
          nbPurges++
        } catch (e) {
          this.logger.warn(`Echec suppression DB invité ${invite.id}`, e)
          nbEchecsDb++
        }
      }
    } catch (e) {
      this.logger.warn(e)
      nbErreurs++
      succes = false
    }

    return {
      jobType: this.jobType,
      nbErreurs,
      succes,
      dateExecution: maintenant,
      tempsExecution: DateService.calculerTempsExecution(maintenant),
      resultat: {
        dryRun,
        nbPurges,
        nbSimules,
        nbEchecsRedis,
        nbEchecsDb,
        pourcentageParc,
        ageMinJours,
        ageMaxJours
      }
    }
  }
}
```

Note : `ageMinJours`/`ageMaxJours` restent `null` dans cette première version (les candidats n'exposent pas leur date). Si la métrique d'âge est requise dès la v1, étendre `recupererInvitesInactifs` pour renvoyer aussi `dateReference: Date` et calculer l'âge — sinon garder `null` et l'ajouter plus tard (documenté spec §6/§9). Choix par défaut : garder `null` (YAGNI, le dry-run compte déjà via `nbSimules`/`pourcentageParc`).

- [ ] **Step 4: Enregistrer le provider** (`src/app.module.ts`)

Ajouter l'import près des autres job handlers (vers la ligne 147) :

```typescript
import { PurgerInvitesInactifsJobHandler } from './application/jobs/purger-invites-inactifs.job.handler.db'
```

Ajouter dans le tableau des providers, à côté de `NettoyerLesDonneesJobHandler` (vers la ligne 945) :

```typescript
  PurgerInvitesInactifsJobHandler,
```

- [ ] **Step 5: Lancer le test pour vérifier qu'il passe**

Run: `yarn test:local:db --grep "PurgerInvitesInactifsJobHandler"`
Expected: PASS (4 tests). Puis `yarn build` pour valider l'injection NestJS et l'absence d'erreur de typage.

- [ ] **Step 6: Commit**

```bash
git add src/application/jobs/purger-invites-inactifs.job.handler.db.ts src/app.module.ts test/application/jobs/purger-invites-inactifs.job.handler.db.test.ts
git commit -m "feat: job de purge des invités inactifs (dry-run, plafond, garde-fou pic)"
```

---

## Task 6 : Vérification d'ensemble

**Files:** aucun (validation).

- [ ] **Step 1: Lint**

Run: `yarn lint`
Expected: 0 erreur.

- [ ] **Step 2: Build**

Run: `yarn build`
Expected: build OK.

- [ ] **Step 3: Suite ciblée**

Run: `yarn test:local:unit --grep "UpdateJeuneConfigurationApplicationCommand" && yarn test:local:db --grep "JeuneInviteSqlRepository|PurgerInvitesInactifsJobHandler"`
Expected: tous PASS.

- [ ] **Step 4: Vérifier que le cron sera bien planifié**

Contrôler que `PURGER_INVITES_INACTIFS` figure dans `listeCronJobs` (`src/domain/planificateur.ts`) — c'est ce que consomme `yarn tasks:initialiser-les-crons` post-deploy. Aucune action de code, juste confirmation visuelle.

- [ ] **Step 5: Commit éventuel de docs**

Si des ajustements de doc sont nécessaires (README des jobs, variables d'env), les faire ici. Sinon, rien.

---

## Notes de déploiement

- **Premier déploiement en dry-run** : ne pas définir `JOB_PURGE_INVITES_DRY_RUN` (défaut `true`). Lire les métriques `SuiviJob.resultat` (`nbSimules`, `pourcentageParc`) sur plusieurs runs.
- **Calibrer** `JOB_PURGE_INVITES_RETENTION_MOIS`, `JOB_PURGE_INVITES_BATCH_MAX`, `JOB_PURGE_INVITES_POURCENTAGE_MAX` d'après ces chiffres, puis passer `JOB_PURGE_INVITES_DRY_RUN=false`.
- **Post-deploy** : `yarn tasks:initialiser-les-crons` pour enregistrer le cron.
- **Dette signalée à l'équipe connect** : `deletePattern`/`KEYS` sur `DELETE /accounts/:idAuth` — le throttling (`batchMax`) contourne, mais le fond reste à traiter côté connect.
