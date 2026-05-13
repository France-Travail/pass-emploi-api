# Investigation : Baisse des consultations rendez-vous

**Date :** 2026-05-11
**Statut :** Conclus — cause racine identifiée
**Observé sur :** Metabase — graphique utilisation fonctionnalité rendez-vous (FT + MILO, CEJ/Jeune)

---

## Symptôme

Baisse brutale du nombre de rendez-vous enregistrés constatée sur Metabase :
- Premier drop : mi-2025
- Deuxième drop : janvier 2026
- Structures impactées : **France Travail et MILO** (les deux)

La baisse est observable côté **données persistées en DB**, pas uniquement côté appels API — ce qui suggère soit des données qui ne remontent plus depuis les APIs externes, soit une vraie baisse d'activité.

---

## Hypothèses à tester

| # | Hypothèse | Probabilité |
|---|-----------|-------------|
| H1 | FT a modifié l'API `peconnect-rendezvousagenda` ou `peconnect-gerer-prestations` (breaking change silencieux) | Forte |
| H2 | L'échange de token OIDC FT échoue → tous les appels FT tombent | Forte |
| H3 | Le job MILO (`traiter-evenement-milo`) a arrêté de synchroniser les RDV | Moyenne |
| H4 | Les notifications RDV ne sont plus envoyées → baisse d'engagement → moins de consultations | Faible |
| H5 | Baisse réelle d'activité (fin de cohorte, moins d'utilisateurs actifs) | À écarter ou confirmer en dernier |
| H6 | La pipeline analytics (`3-charger-les-vues.job.ts`) est en erreur → la vue `analytics_fonctionnalites` ne se rafraîchit plus → le graphe Metabase montre une baisse qui n'existe pas en prod | À vérifier en premier |

---

## Axe 1 : Elastic APM

> Remplace le nom du service par la valeur de `APM_SERVICE_NAME` en prod.

### 1.1 Volume des transactions RDV

Dans **APM > Services > [service] > Transactions**, filtre KQL :

```kql
transaction.name: "GET /jeunes/:idJeune/rendez-vous/:idRendezVous"
```

```kql
transaction.name: "GET /jeunes/:idJeune/home/agenda"
```

```kql
transaction.name: "GET /jeunes/:idJeune/mon-suivi"
```

→ Passe la plage temporelle sur **jan 2025 → aujourd'hui**. Un effondrement du throughput confirme que moins de jeunes consultent leurs RDV. Si le volume d'appels est stable mais les données retournées sont vides, le problème est en aval (API FT).

---

### 1.2 État des dépendances FT

Dans **APM > Services > [service] > Dependencies**, cherche :

- `peconnect-rendezvousagenda` → throughput, error rate, latence
- `peconnect-gerer-prestations` → idem

Si le **taux d'erreur monte** à partir de mi-2025 sur ces entrées → c'est l'API FT qui est en cause (H1 ou H2).

---

### 1.3 Logs de cache servi silencieusement

Ces logs apparaissent quand l'API FT échoue et que le code sert le cache au lieu de remonter une erreur. C'est le pattern le plus dangereux car l'utilisateur voit des données figées sans aucune erreur visible.

Code concerné : `src/infrastructure/clients/pole-emploi-partenaire-client.db.ts:376-386`

Dans **Discover**, KQL :

```kql
message: "Utilisation du cache pour peconnect-rendezvousagenda"
```

```kql
message: "Utilisation du cache pour peconnect-gerer-prestations"
```

→ Si ces messages explosent à partir de mi-2025, l'API FT échoue massivement mais les utilisateurs voient des données figées.

```kql
message: "Erreur GET WITH CACHE FT"
```

→ Apparaît quand l'appel échoue **et** qu'il n'y a pas de cache (erreur réseau ou timeout sans fallback possible).

```kql
message: "Impossible de mapper la prestation"
```

→ Indique un changement de format dans la réponse de l'API Prestation (breaking change côté FT).

---

### 1.4 Erreurs sur les routes RDV

Dans **APM > Errors**, KQL :

```kql
transaction.name: *rendez-vous* OR transaction.name: *agenda* OR transaction.name: *suivi*
```

---

### 1.5 Job de synchronisation MILO

Dans **APM > Transactions** ou **Discover** :

```kql
transaction.name: *milo* AND transaction.result: "error"
```

→ Si `traiter-evenement-milo` échoue systématiquement, les RDV MILO ne sont plus mis à jour en DB.

---

## Axe 2 : Code — Silent failures identifiés

### 2.1 RDV Agenda FT ignoré en cas d'erreur

**Fichier :** `src/application/queries/query-getters/pole-emploi/get-rendez-vous-jeune-pole-emploi.query.getter.ts:125`

```typescript
// Si getPrestations() échoue → l'erreur remonte (comportement correct)
if (isFailureApi(responsePrestations)) return responsePrestations

// Si getRendezVous() échoue → liste vide retournée silencieusement (problème potentiel)
const rendezVousPoleEmploi = isFailureApi(responseRendezVous) ? [] : ...
```

→ Si `peconnect-rendezvousagenda` renvoie des erreurs, les RDV FT Agenda disparaissent sans aucune erreur visible côté client ni dans les logs.

### 2.2 Échange de token OIDC — point de défaillance central

**Fichier :** `src/application/queries/query-getters/pole-emploi/get-rendez-vous-jeune-pole-emploi.query.getter.ts:58-63`

```typescript
const idpToken =
  query.idpToken ??
  (await this.oidcClient.exchangeTokenJeune(query.accessToken, jeune.structure))
```

→ Si l'échange de token échoue (changement côté FT, expiration, quota), **tous les appels FT** tombent pour ce jeune. À croiser avec des erreurs 401 dans APM Dependencies.

### 2.3 Cache `getWithCache` — comportement en cas d'erreur

**Fichier :** `src/infrastructure/clients/pole-emploi-partenaire-client.db.ts:376-394`

- Erreur HTTP > 401 avec cache disponible → sert le cache **sans log d'erreur visible** (log `warn` uniquement)
- Erreur HTTP > 401 sans cache → retourne `failureApi`
- Erreur 401 → retourne `failureApi` directement (token expiré)
- Erreur réseau/timeout → `throw` (remonte comme erreur non catchée)

---

## Axe 3 : DB / Metabase — Isolation du drop

### 3.1 Volume RDV par semaine

```sql
SELECT
  DATE_TRUNC('week', date) AS semaine,
  COUNT(*) AS nb_rdv
FROM rendez_vous
WHERE date > '2025-01-01'
GROUP BY semaine
ORDER BY semaine;
```

→ Visualise précisément la date du premier drop.

### 3.2 Isolation par structure

```sql
SELECT
  DATE_TRUNC('month', date) AS mois,
  source,
  COUNT(*) AS nb_rdv
FROM rendez_vous
WHERE date > '2025-01-01'
GROUP BY mois, source
ORDER BY mois, source;
```

→ Si FT baisse avant MILO ou inversement, le bug est isolé à une structure.

### 3.3 Âge du cache FT

Le cache FT est stocké dans `cache_api_partenaire`. Si les entrées ne sont plus mises à jour, c'est la preuve que l'API FT échoue depuis longtemps et que le code sert du cache figé.

```sql
SELECT
  path_partenaire,
  MAX(date) AS derniere_mise_a_jour,
  NOW() - MAX(date) AS age_du_cache,
  COUNT(*) AS nb_utilisateurs
FROM cache_api_partenaire
WHERE path_partenaire LIKE '%rendezvousagenda%'
   OR path_partenaire LIKE '%gerer-prestations%'
GROUP BY path_partenaire
ORDER BY age_du_cache DESC
LIMIT 20;
```

→ Si `age_du_cache` est de plusieurs mois → l'API FT n'a pas répondu correctement depuis longtemps.

---

## Axe 4 : Notifications

Les notifications RDV (`RAPPEL_RENDEZVOUS`) sont envoyées via Firebase pour les jeunes ayant `preferences.rendezVousSessions = true`.

**Fichier :** `src/domain/notification/notification.ts:210-262`

Points à vérifier :

1. **Tokens Firebase invalides** — un token invalide retourne une erreur Firebase sans bloquer l'envoi aux autres. Cherche dans APM :
   ```kql
   message: *firebase* AND log.level: error
   ```

2. **Préférences désactivées en masse** — la colonne s'appelle `notifications_rendezvous_sessions` (boolean), il n'y a pas de `updated_at`. Distribution actuelle par structure :
   ```sql
   SELECT
     structure,
     COUNT(*) FILTER (WHERE notifications_rendezvous_sessions = true) AS notifs_actives,
     COUNT(*) FILTER (WHERE notifications_rendezvous_sessions = false) AS notifs_desactivees,
     COUNT(*) AS total
   FROM jeune
   GROUP BY structure
   ORDER BY structure;
   ```
   Pour se limiter aux jeunes récemment actifs (proxy : `date_derniere_connexion`) :
   ```sql
   SELECT
     DATE_TRUNC('month', date_derniere_connexion) AS mois,
     COUNT(*) FILTER (WHERE notifications_rendezvous_sessions = true) AS notifs_actives,
     COUNT(*) FILTER (WHERE notifications_rendezvous_sessions = false) AS notifs_desactivees
   FROM jeune
   WHERE date_derniere_connexion > '2025-01-01'
   GROUP BY mois
   ORDER BY mois;
   ```

3. **Volume de notifications envoyées** — dans APM, cherche les spans Firebase pour voir si le volume a chuté :
   ```kql
   transaction.name: *notification* OR transaction.name: *rappel*
   ```

---

## Axe 5 : Pipeline analytics — Fraîcheur des vues (H6)

La vue `analytics_fonctionnalites` est recalculée **chaque lundi** par `3-charger-les-vues.job.ts`. Si ce job est en erreur, les données s'arrêtent net et Metabase affiche une baisse qui n'existe pas en prod.

**C'est le premier truc à éliminer avant d'investiguer le reste.**

### 5.1 Vérifier la fraîcheur de la vue (DB analytics)

```sql
SELECT
  MAX(semaine) AS derniere_semaine_calculee,
  NOW()::date - MAX(semaine) AS age_en_jours
FROM analytics_fonctionnalites
WHERE type_utilisateur = 'JEUNE'
  AND categorie = 'Rendez-vous';
```

→ Si `age_en_jours` dépasse 14 jours, la pipeline ne tourne plus. Les drops observés sur Metabase sont un artefact, pas un bug produit.

### 5.2 Vérifier le job dans APM / Worker logs

Dans **APM > Transactions** (worker) :

```kql
transaction.name: *charger-les-vues* OR transaction.name: *analytics*
```

→ Vérifie si le job s'exécute bien chaque lundi et s'il ne retourne pas d'erreurs.

---

## Ordre d'investigation recommandé

```
0. DB analytics → fraîcheur de la vue (§5.1) — éliminer H6 en premier
1. APM Dependencies → état des APIs FT (§1.2)
2. Discover → logs de cache silencieux (§1.3)
3. SQL cache_api_partenaire → âge du cache FT (§3.3)
4. SQL rendez_vous → isolation par structure (§3.2)
5. APM job MILO → synchronisation (§1.5)
6. Code → silent failure RDV Agenda (§2.1) si les étapes précédentes confirment une erreur FT
```

---

## Axe 6 : Analytics deep-dive — Requêtes de diagnostic

### 6.1 Structures et actions disponibles dans la vue

```sql
SELECT DISTINCT
  categorie, action, nom, structure, type_utilisateur
FROM analytics_fonctionnalites
WHERE categorie ILIKE '%rendez%'
   OR nom ILIKE '%rendez%'
ORDER BY categorie, action, nom;
```

**Résultat :** Seules `MILO`, `MILO_PACEA`, `POLE_EMPLOI`, `POLE_EMPLOI_BRSA` ont des entrées. `FT_ACCOMPAGNEMENT_INTENSIF` (56K jeunes), `FT_ACCOMPAGNEMENT_GLOBAL`, `FT_EQUIP_EMPLOI_RECRUT`, `POLE_EMPLOI_AIJ` sont **complètement absentes**.

### 6.2 Volumes par semaine et structure dans la vue agrégée

```sql
SELECT
  semaine, structure,
  SUM(nb_users_action) AS nb_users_action,
  SUM(nb_users_total)  AS nb_users_total
FROM analytics_fonctionnalites
WHERE type_utilisateur = 'JEUNE'
  AND categorie = 'Rendez-vous'
  AND action = 'Consultation'
  AND nom != 'Session'
  AND semaine >= '2024-06-01'
GROUP BY semaine, structure
ORDER BY semaine, structure;
```

**Résultat :** 1 à 3 utilisateurs par semaine maximum sur l'ensemble du dataset. `MILO_PACEA` disparaît après février 2025. `POLE_EMPLOI` n'apparaît que 3 fois en 18 mois.

### 6.3 Événements bruts dans la table source

```sql
SELECT
  DATE_TRUNC('month', date_evenement) AS mois,
  structure,
  COUNT(*) AS nb_evenements
FROM evenement_engagement
WHERE categorie = 'Rendez-vous'
  AND action = 'Consultation'
  AND type_utilisateur = 'JEUNE'
  AND date_evenement >= '2024-06-01'
GROUP BY mois, structure
ORDER BY mois, structure;
```

**Résultat :** Volumes identiques à la vue agrégée — 10 à 40 événements/mois au maximum. `FT_ACCOMPAGNEMENT_INTENSIF` absent de tous les mois. Confirme que le problème est **en amont de la pipeline** : les événements ne sont pas générés.

---

## Résultats de l'investigation

| Date | Axe | Hypothèse / Observation | Résultat | Statut |
|------|-----|------------------------|----------|--------|
| 2026-05-12 | §4 Notifications | H4 — préférences notifs désactivées en masse | Quasi 100% des jeunes ont `notifications_rendezvous_sessions = true` quelle que soit la structure | ❌ Éliminée |
| 2026-05-12 | §3.1 DB `rendez_vous` | H1/H2 — baisse des RDV créés en prod | Source `PASS_EMPLOI` stable à ~10 000 RDV/mois. Les RDV FT ne sont pas dans cette table (récupérés à la volée depuis l'API FT) | ⚠️ Non conclusif — ne couvre pas les RDV FT |
| 2026-05-12 | §3.2 DB `rendez_vous` par source | Explosion MILO | Source `MILO` absente avant nov 2025, puis 46 842 RDV en fév 2026 et ~95 000 en mars 2026. Nouvelle intégration ou migration de masse | ℹ️ À investiguer séparément |
| 2026-05-12 | §3.2 DB `rendez_vous` par source | Données aberrantes | Dates impossibles : 2033, 2222, 20222. Bug de validation de date côté client | ℹ️ Bug séparé à corriger |
| 2026-05-12 | §5 Pipeline analytics | H6 — pipeline analytics cassée | `MAX(semaine) = 2026-05-04`, age = 8 jours. Pipeline hebdomadaire en bonne santé | ❌ Éliminée |
| 2026-05-12 | §3.3 DB `cache_api_partenaire` | H1/H2 — API FT en erreur silencieuse | Cache `peconnect-rendezvousagenda` et `peconnect-gerer-prestations` mis à jour il y a **2 secondes**. 55 000+ utilisateurs en cache actif | ❌ Éliminées |
| 2026-05-12 | §6.1 Analytics structures | H7 — structures FT non trackées | `FT_ACCOMPAGNEMENT_INTENSIF` (56K jeunes), `FT_ACCOMPAGNEMENT_GLOBAL`, `FT_EQUIP_EMPLOI_RECRUT`, `POLE_EMPLOI_AIJ` **absentes** de `analytics_fonctionnalites` pour la catégorie Rendez-vous | ✅ Confirmée — mais symptôme, pas cause racine |
| 2026-05-12 | §6.2 Analytics volumes | Volumes anormalement bas | 1 à 3 jeunes/semaine trackés sur 300K+ jeunes actifs. `MILO_PACEA` disparaît après fév 2025, `POLE_EMPLOI` erratique | ✅ Confirmé |
| 2026-05-12 | §6.3 Événements bruts | Cause racine | Volumes identiques dans `evenement_engagement` (table source). 10-40 événements/mois max. Le problème est **en amont de la pipeline** | ✅ Cause racine identifiée |

---

## Conclusion

**La baisse observée sur Metabase n'est pas un bug API ni un bug de données.**

Les événements de consultation RDV (`categorie = 'Rendez-vous'`, `action = 'Consultation'`) n'ont **jamais été tracés de façon fiable** par l'app mobile Flutter. Sur 300K+ jeunes actifs, seuls 10 à 40 événements par mois remontent dans la table source `evenement_engagement` — ce qui représente une couverture quasi nulle.

La "baisse" visible sur Metabase s'explique mécaniquement : le dénominateur `nb_users_total` augmente au fil des mois (nouveaux jeunes inscrits, intégration MILO massive en fév 2026), tandis que `nb_users_action` reste proche de zéro → le ratio s'effondre sans que la fonctionnalité soit dégradée.

**Ce qui a été éliminé :**
- API FT (`peconnect-rendezvousagenda`, `peconnect-gerer-prestations`) → fonctionne, cache frais
- Pipeline analytics → saine, données à 8 jours
- Notifications → 99%+ des jeunes ont les notifs actives

**Prochaine action :** vérifier dans le repo `pass_emploi_app` (Flutter) que l'événement `Rendez-vous / Consultation` est bien déclenché sur les écrans de consultation RDV, et pour toutes les structures (notamment `FT_ACCOMPAGNEMENT_INTENSIF`).
