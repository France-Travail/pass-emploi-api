# Envoi des communications NOTIFICATION — design

> Doc de travail (pas un ADR). Remplace le job `NOTIFIER_BENEFICIAIRES` et la
> route `POST /support/notifier-beneficiaires` par un envoi par lots, cadencé
> par un cron à la minute et piloté par l'état en base.
>
> Révisé le 2026-09-22 (v2) : cron unique, lots fixes, sans plafond, sans relance,
> garde-fous de mise en production. La v1 (job `ENVOYER_LOT_COMMUNICATION`
> auto-replanifié, débit calculé, relance) est abandonnée.

## Problème

Le job actuel (`NOTIFIER_BENEFICIAIRES`) envoie ¼ de la population par exécution à
2 notifs/s : sur 150 000 tokens, un seul job Bull de ~5 h qui monopolise un worker
(chaque worker traite un job à la fois), rejoué depuis le début en cas de
redémarrage (doublons), sans reprise si le handler échoue, avec un garde-fou « un
seul job actif » qui ne regarde que les 50 premiers jobs Redis.

## Modèle de données

### `communication` (existante)

| Colonne | Type | Règle |
|---|---|---|
| `statut_envoi` | `VARCHAR` nullable | `NULL` si `IN_APP`. Pour `NOTIFICATION` : `A_ENVOYER` → `EN_COURS` → `ENVOYEE` \| `ANNULEE` \| `EN_ERREUR`. Les trois derniers sont **terminaux**. |
| `envoi_termine_le` | `TIMESTAMPTZ` nullable | Posé au passage à un statut terminal. |
| `echecs_consecutifs` | `INTEGER` défaut 0 | Lots consécutifs en échec total (voir Jobs). Remis à 0 dès qu'un lot passe. |
| `nb_envoyees`, `nb_erreurs`, `nb_tokens_invalides` | `INTEGER` nullable | Totaux **figés** au passage à un statut terminal. Survivent à la purge du détail. |

`envoyee_le` (branche v1, jamais déployée) n'est **pas** livrée : les migrations de la
branche sont corrigées en place pour créer `statut_envoi` directement.

Les communications `NOTIFICATION` **déjà en base** à la migration passent en `ANNULEE`,
jamais en `A_ENVOYER` : elles ont été créées sans les règles actuelles, et rien ne doit
partir du seul fait d'un déploiement. En prod il ne devrait y en avoir aucune (la
branche bandeau les refuse en 400) — à vérifier avant migration :
`SELECT count(*) FROM communication WHERE type = 'NOTIFICATION'`.

`PUT` et `DELETE /support/communications/:id` sont refusés (400) dès que `statut_envoi`
n'est plus `A_ENVOYER` (ni `NULL`) : on ne réécrit pas un message à moitié parti, on
n'efface pas la trace de qui l'a reçu. Aucun statut ne les réouvre.

### `communication_envoi` (nouvelle) — file de travail

| Colonne | Type |
|---|---|
| `id_communication` | FK `communication.id` ON DELETE CASCADE |
| `id_jeune` | FK `jeune.id` ON DELETE CASCADE |
| `statut` | `A_ENVOYER` \| `EN_COURS` \| `ENVOYEE` \| `ERREUR` \| `TOKEN_INVALIDE` |
| `date_traitement` | `TIMESTAMPTZ` nullable — posée à la réservation (`EN_COURS`) puis au marquage final |

PK `(id_communication, id_jeune)`, index `(id_communication, statut)`. Toutes les
requêtes commencent par `id_communication = ?` : jamais de scan global.

Une ligne = un jeune de la population **au moment du démarrage** (population figée).
Si `push = true`, seuls les jeunes avec `push_notification_token IS NOT NULL` ; si
`push = false` (centre de notifications seul), tous les jeunes de la population.

**Pas un doublon de `notification_jeune`** : celle-ci est le centre de notifications
affiché au jeune (toutes notifs confondues, purgée à 10 jours, écrite en
fire-and-forget par `send()`), sans statut ni résultat d'envoi. `communication_envoi`
est la file de travail : qui reste à traiter, réservation entre workers, erreurs.
Les deux se complètent : le lot appelle le `send()` existant avec `idJeune`, qui
alimente `notification_jeune` comme aujourd'hui.

Volume : ~15–20 Mo par campagne de 150 000 jeunes, purgé (voir Nettoyage).

## Job unique : `ENVOYER_COMMUNICATIONS` (cron `* 8-16 * * 1-5`, Europe/Paris)

Un **tick** = une exécution du cron, toutes les minutes de 8h à 16h59, lun–ven.
Chaque tick lit l'état en base, fait **une** chose, et se termine. Rien n'est
mémorisé hors de la base : un tick qui plante ou un worker qui redémarre ne casse
rien, le tick suivant repart de l'état en base.

```
1. kill switch : config jobs.envoiCommunications.actif = false → sortie immédiate
2. une communication EN_COURS ?
     oui → ENVOYER UN LOT (ci-dessous)
     non → une communication A_ENVOYER avec date_debut ≤ now (ordre date_debut),
           destinataire = JEUNE, push non nul ?
             oui → DÉMARRER (ci-dessous)
             non → sortie
```

Une seule communication `EN_COURS` à la fois. La suivante démarre au tick d'après la
fin de la précédente.

### Démarrer

1. **Réclamation atomique** : `UPDATE communication SET statut_envoi = 'EN_COURS'
   WHERE id = :id AND statut_envoi = 'A_ENVOYER' RETURNING id`. 0 ligne → un autre
   tick l'a prise, sortie.
2. Dans la même transaction : `INSERT INTO communication_envoi (id_communication,
   id_jeune, statut) SELECT :id, j.id, 'A_ENVOYER' FROM jeune j WHERE
   <sqlJeuneDansPopulation> [AND j.push_notification_token IS NOT NULL si push]
   ON CONFLICT DO NOTHING`. Une seule requête SQL, rien n'est chargé en mémoire Node.
3. Log ECS `communication_envoi_demarre` avec l'effectif figé.

Le premier lot part au tick suivant.

### Envoyer un lot

1. **Libérer** les lignes `EN_COURS` dont `date_traitement < now − 30 min` → `A_ENVOYER`
   (worker mort à mi-lot ; un lot dure < 1 min, 30 min lève toute ambiguïté).
2. **Réserver** `tailleLot` lignes (config, défaut **300**) :
   `UPDATE communication_envoi SET statut = 'EN_COURS', date_traitement = now()
   WHERE (id_communication, id_jeune) IN (SELECT … WHERE id_communication = :id AND
   statut = 'A_ENVOYER' ORDER BY id_jeune FOR UPDATE SKIP LOCKED LIMIT :n) RETURNING
   id_jeune` (jointure `jeune` pour le token). `SKIP LOCKED` : deux ticks
   simultanés ne se partagent aucun jeune.
3. **0 ligne réservée** : si plus aucune `EN_COURS` non plus → **terminer** (ci-dessous) ;
   sinon (un autre tick finit son lot) → sortie.
4. Pour chaque ligne, séquentiellement, sans attente entre deux : `send()` (awaité,
   retourne `ENVOYEE` / `TOKEN_INVALIDE` / `ERREUR`), puis marque la ligne. Ordre
   naturel envoyer-puis-marquer : au pire, un worker tué entre les deux renotifie
   **un** jeune après libération. Jamais de perte.
5. **Lot en échec total** (`ERREUR` sur 100 % des lignes, Firebase down) : les lignes
   repassent `A_ENVOYER` (rien n'est parti), `echecs_consecutifs + 1` ; à **3** →
   `EN_ERREUR`, `envoi_termine_le`, totaux figés. Sinon `echecs_consecutifs = 0`.
6. Log ECS `communication_lot_envoye` : `idCommunication`, `envoyees`, `erreurs`,
   `tokensInvalides`, `restantes`. Un log `error` par jeune en `ERREUR` avec la
   raison Firebase (`toEcsError`).

Débit effectif = `tailleLot / 60 s` = 5/s avec les défauts (le job campagne existant
tourne à ~7/s). 300 `send` séquentiels ≈ 15–30 s, le worker est libre le reste de la
minute.

| Population | Durée |
|---|---|
| 3 000 | 10 min |
| 50 000 | ~3 h |
| 150 000 | ~8 h 20 — déborde sur le lendemain matin |

**Pas de plafond** : une très grosse population déborde sur le(s) jour(s) ouvré(s)
suivant(s). Le garde-fou contre un mauvais ciblage est l'effectif visible **avant**
`date_debut` (voir Routes support).

### Terminer

`statut_envoi = 'ENVOYEE'`, `envoi_termine_le = now`, `nb_envoyees` /
`nb_erreurs` / `nb_tokens_invalides` figés depuis `communication_envoi`. Log ECS
`communication_envoi_termine`.

### Observabilité du job

- Exclu de `estJobSuivi` (540 ticks/jour) et de `estNotifiable` (un échec reste
  notifié Mattermost, `succes: false`), comme `SUIVRE_FILE_EVENEMENTS_MILO`.
- `logHandlerExecuted` (automatique dans `JobHandler`) : un tick **à vide** ne logue
  pas en `info` (sinon 540 lignes/jour de bruit) — à voir à l'implémentation si on
  passe par `debug` ou par un `SuiviJob` marqué « rien à faire ».

## Résultat de `send()`

`Notification.Repository.send` n'attend pas Firebase et ne renvoie rien : impossible
de remplir `ERREUR` / `TOKEN_INVALIDE`. Il retourne désormais
`Promise<ResultatEnvoi>` (`ENVOYEE` | `TOKEN_INVALIDE` | `ERREUR`), en awaitant
`firebaseClient.send`. `TOKEN_INVALIDE` = `messaging/registration-token-not-registered`
et `messaging/invalid-registration-token`. Les appelants existants ignorent le
retour, inchangés. `push = false` → pas d'appel Firebase, `ENVOYEE` (écriture
`notification_jeune` seule).

Question ouverte : mettre `jeune.push_notification_token = NULL` sur
`TOKEN_INVALIDE`, comme d'autres jobs le font peut-être — à vérifier à l'implémentation.

## Routes support

| Route | Effet |
|---|---|
| `POST /support/communications/:id/envoi/annulation` | `EN_COURS` → `ANNULEE`, `envoi_termine_le`, totaux figés. Le tick suivant ne fait plus rien (un lot en vol finit ses ≤ 300 envois). 400 pour tout autre statut. |
| `GET /support/populations/:id` | chaque communication `NOTIFICATION` expose `statutEnvoi`, `envoiTermineLe`, `envoi: { envoyees, erreurs, tokensInvalides }` (totaux figés, ou comptés en direct si `EN_COURS` avec en plus `aEnvoyer`, `enCours`), et **`nbDestinataires`** tant qu'elle est `A_ENVOYER` : `count` des jeunes de la population (avec token si `push`). C'est ce que le support relit après création pour vérifier le ciblage avant `date_debut`. |

Supprimés : `POST /support/notifier-beneficiaires`,
`NotifierBeneficiairesCommandHandler`, `NotifierBeneficiairesPayload`,
`NotifierBeneficiairesJobHandler`, `JobType.NOTIFIER_BENEFICIAIRES` et ses types,
`JobType.NOTIFIER_COMMUNICATIONS` (v1, remplacé par `ENVOYER_COMMUNICATIONS`),
`Planificateur.Repository.recupererPremierJobNonTermine`, leurs tests, la ligne du
`TROUBLESHOOT.md`.

**Pas de relance.** `ANNULEE` et `EN_ERREUR` sont terminaux. Reprendre = créer une
nouvelle communication, qui repart à **toute** la population, y compris les jeunes
déjà servis. Assumé : `EN_ERREUR` exige 3 lots consécutifs à 100 % d'échec (Firebase
réellement down 3 min, lignes rendues, rien de perdu), et l'annulation est un choix
du support. À reconsidérer si le cas se présente.

## Nettoyage

`nettoyer-les-donnees` (quotidien) supprime les lignes `communication_envoi` des
communications en statut terminal depuis plus de **30 jours**
(`envoi_termine_le < now − 30 j`). Le détail par jeune reste consultable un mois, les
totaux restent à vie sur `communication`. Les `communication` ne sont pas purgées.

## Mise en production et garde-fous

| Risque | Réponse |
|---|---|
| Des notifs partent au déploiement | Migration : `NOTIFICATION` existantes → `ANNULEE`. Le cron ne démarre que sur `A_ENVOYER`, qui n'existe qu'après une création explicite par le support post-deploy. |
| Envoi non prévu / mauvais ciblage | `nbDestinataires` dans le `GET` avant `date_debut` ; `DELETE` possible tant que `A_ENVOYER`. Filtre de sûreté du cron `destinataire = JEUNE AND push IS NOT NULL`. |
| Trop de notifs d'un coup | Lot fixe 300/min. Kill switch config `jobs.envoiCommunications.actif` (coupe sans redéployer). Annulation par communication. |
| Crash de l'app | Le cron tourne sur le worker, pas le web. Chaque `send` en try/catch. Figement = 1 requête SQL. ≤ 300 lignes en mémoire par tick. |
| Doublons | Réclamation atomique, `SKIP LOCKED`, libération à 30 min. Pire cas : 1 jeune renotifié par crash de worker en plein lot. |
| Pertes | Lot en échec total rendu à `A_ENVOYER`. Lignes orphelines libérées. |
| Suivi des non-envoyées | `envoi.erreurs` / `tokensInvalides` dans le `GET`, détail 30 j dans `communication_envoi` (requête à documenter dans `TROUBLESHOOT.md`), logs ECS par lot et par jeune en erreur. |
| Cron absent après deploy | `yarn tasks:initialiser-les-crons` post-deploy (procédure habituelle). Jobs `NOTIFIER_BENEFICIAIRES` / `NOTIFIER_COMMUNICATIONS` v1 encore en attente dans Redis → échouent en « handler inconnu », sans effet. |
| Coût du cron à la minute | 1 `SELECT` de ~1 ms sur une table de dizaines de lignes, worker pris ~10 ms. Expression cron et `tailleLot` en config : passer à 2 ou 5 min ne demande pas de code. |

**Première campagne réelle** sur une population de test (comptes de l'équipe) avant
toute campagne large — procédure à écrire dans `TROUBLESHOOT.md`.

## Hors périmètre

- Relance d'une communication `ANNULEE` / `EN_ERREUR` (voir Routes support).
- Envoi Firebase multicast (`sendEach`) : évolution possible d'un lot.
- Route de prévisualisation complète d'une population (liste des conseillers/jeunes) :
  sujet transverse, suivi à part. `nbDestinataires` en est la version minimale.
- Purge des `communication`.

## Exemple

Lundi 22/09 14h, support : `POST /support/communications { idPopulation: "PHASE_C",
destinataire: "JEUNE", type: "NOTIFICATION", push: true, typeNotification:
"MIGRATION_PARCOURS_EMPLOI", dateDebut: "2026-09-30", titre, contenu }` → `A_ENVOYER`.
`GET /support/populations/PHASE_C` → `nbDestinataires: 3200`, ordre de grandeur
attendu.

Mardi 30/09 : 8h00 tick → réclame, fige 3 200 lignes, `EN_COURS`. 8h01 → lot de 300
(298 `ENVOYEE`, 1 `TOKEN_INVALIDE`, 1 `ERREUR`). 8h02 → 300. … 8h11 → 200. 8h12 →
plus rien → `ENVOYEE`, `nb_envoyees = 3150`, `nb_erreurs = 12`,
`nb_tokens_invalides = 38`. 8h13 → rien à faire.

Variante crash : 8h05, worker tué au 143ᵉ jeune du lot. 142 `ENVOYEE`, 158 `EN_COURS`.
8h06 → 8h34 : les ticks réservent d'autres lignes, ignorent les 158 (< 30 min). 8h35 :
158 libérées → renvoyées. Le 143ᵉ, parti juste avant le crash, reçoit 2 fois.

Variante Firebase down : 8h05 lot à 300 `ERREUR` → rendu, `echecs_consecutifs = 1`.
8h06 idem → 2. 8h07 idem → `EN_ERREUR`, Mattermost. 3 200 lignes toujours
`A_ENVOYER`, rien de perdu, mais pas de reprise : nouvelle communication à créer.
