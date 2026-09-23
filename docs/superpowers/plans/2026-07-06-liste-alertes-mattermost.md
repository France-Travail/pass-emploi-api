# Alertes Mattermost — Liste récapitulative

> Synthèse de l'analyse des briques (api web, api worker, connect, front web, infra).
> Principe directeur : **une alerte = une action immédiate**. Tout ce qui est informatif va dans le canal rapports, jamais dans `#alertes-prod`.
> Détail des seuils, payloads et commandes : [2026-07-02-alertes-monitoring-mattermost.md](./2026-07-02-alertes-monitoring-mattermost.md)

Toutes les alertes arrivent sur `#alertes-prod`, sauf mention contraire.

## Disponibilité — via Heartbeat + règle Kibana (T1–T3, T6)

| # | Alerte | Déclencheur | Action dans le message |
|---|--------|-------------|------------------------|
| 1 | **API web down** | `/health` KO sur 3 checks (~2 min) — inclut DB ou Redis morts grâce à T1 | Restart Scalingo / rollback du dernier deploy |
| 2 | **Connect down** | `/health` KO sur 3 checks — inclut Redis OIDC mort grâce à T3 | Login impossible pour tous → restart/rollback immédiat |
| 3 | **Front web down** | `/api/health` KO sur 3 checks | Restart/rollback immédiat |
| 4 | **Worker mort** (dead man's switch) | `/health/worker` en 503 = aucune ligne `suivi_job` depuis 45 min (T2+T5) | Restart du container worker + `yarn tasks:initialiser-les-crons` |

## Comportement applicatif — via APM + règle Kibana (T7)

| # | Alerte | Déclencheur | Action |
|---|--------|-------------|--------|
| 5 | **Pic d'erreurs 5xx** (api ou connect) | > 5 % des requêtes en erreur sur 5 min | Ouvrir APM, identifier la transaction, rollback si corrélé à un deploy |
| 6 | **Latence dégradée** | p95 > 3 s soutenu 10 min (jamais sur une requête isolée) | Chercher la requête SQL lente ou le partenaire en timeout |
| 7 | **Partenaire externe en panne** — Milo, France Travail, Brevo, Firebase, storage/antivirus | > 50 % d'échecs sur les appels sortants pendant 15 min | Ouvrir un incident avec le partenaire + prévenir le support |
| 8 | **Webhook CEJ Lama cassé** | Le log « Échec de l'envoi du message Mattermost » apparaît (T4) | Réparer le webhook `mattermost.jobWebhookUrl` (filet de sécurité : sans lui, la perte des alertes jobs est invisible) |

## Plateforme et infra — via notifiers/alertes Scalingo (T8–T9)

| # | Alerte | Déclencheur | Action |
|---|--------|-------------|--------|
| 9 | **Crash / crash-loop d'un container** | Événement `app_crashed` (api, connect, front) | Consulter les logs de crash, restart ou rollback |
| 10 | **Fuite mémoire** | RAM > 90 % soutenu 15 min | Restart + investigation |
| 11 | **Disque PostgreSQL** | > 85 % | Vérifier que `NETTOYER_LES_DONNEES` tourne, sinon upsize |
| 12 | **Connexions PostgreSQL** | > 80 % du max pendant 5 min | Chercher une fuite de connexions (pool), scaler si légitime |
| 13 | **Mémoire Redis** (Bull côté api, sessions côté connect) | > 80 % soutenu 15 min | Vérifier `NETTOYER_LES_JOBS` / TTL des sessions, purger ou upsize |

## Ce qui existe déjà et ne change pas (canal jobs, pas `#alertes-prod`)

- **Job en échec** → message CEJ Lama avec la stack (existant)
- **Rapport quotidien des crons à 9h45** → information à lire le matin, pas une alerte (existant)

## Volontairement exclus (pas d'action immédiate = pas d'alerte)

- Pics CPU/RAM ponctuels
- Temps de réponse sur une requête isolée
- Restarts normaux de deploy
- Panne du Wordpress de doc
- Diagoriente, Immersion, Matomo
- Saturation de la file Milo (lisible dans le rapport quotidien, à automatiser seulement si ça arrive vraiment)
- Expiration des secrets IDP (plan dédié à faire)

## Découpage en 3 phases

| Phase | Tâches | Contenu | Livrable |
|-------|--------|---------|----------|
| **1 — Code : rendre les briques surveillables** | T1–T4 | `/health` API vérifie PG + Redis, `/health/worker` (dead man's switch), `/health` connect ping Redis, CEJ Lama logge ses échecs d'envoi | Aucune alerte encore, mais sans elle les pings ne détectent rien |
| **2 — Chaîne Elastic : les règles d'alerte** | T5–T7 | Monitor heartbeat worker, connector Mattermost + règles uptime, règles APM + règle de log CEJ Lama | Alertes **1 à 8** |
| **3 — Scalingo : plateforme et nettoyage du bruit** | T8–T9 | Notifiers crash, suppression des alertes bruit actuelles, alertes addons (disque PG, connexions, mémoire Redis) | Alertes **9 à 13** + fin des remontées inutiles |

Dépendance : la phase 2 nécessite la phase 1 déployée. La phase 3 est indépendante (le nettoyage du bruit, T8 étape 3, peut se faire dès maintenant).

**Total : 13 alertes actionnables**, 3 canaux d'origine (Kibana pour uptime/APM/logs, Scalingo pour la plateforme et les addons, CEJ Lama qui reste sur son canal d'information).
