# Envoi robuste des communications NOTIFICATION — design

> Doc de travail (pas un ADR). Remplace le job `NOTIFIER_BENEFICIAIRES` et la
> route `POST /support/notifier-beneficiaires` par un envoi par lots courts,
> piloté par l'état en base. Périmètre décidé le 2026-09-17 : reprise sans
> doublon, kill switch support, suivi d'avancement, débit calculé (taille de
> population / fenêtre ouvrée restante).

## Problème

Le job actuel envoie ¼ de la population par exécution à 2 notifs/s : sur
150 000 tokens, un seul job Bull de ~5 h qui monopolise un des workers (chaque
worker traite un job à la fois),
rejoué depuis le début en cas de redémarrage (doublons), sans reprise si le
handler échoue (`attempts: 1`, `envoyee_le` déjà posé), avec un garde-fou
« un seul job actif » qui ne regarde que les 50 premiers jobs Redis.

## Modèle de données

### `communication`

| Colonne | Type | Règle |
|---|---|---|
| `statut_envoi` | `VARCHAR` nullable | `NULL` si `IN_APP`. Pour `NOTIFICATION` : `A_ENVOYER` → `EN_COURS` → `ENVOYEE` \| `ANNULEE` \| `EN_ERREUR`. `ANNULEE` / `EN_ERREUR` → `EN_COURS` (relance). |
| `envoi_termine_le` | `TIMESTAMPTZ` nullable | Posé au passage à `ENVOYEE`. |

`envoyee_le` est supprimée (migrée : non nul → `ENVOYEE` + `envoi_termine_le`,
nul → `A_ENVOYER`).

`PUT` et `DELETE /support/communications/:id` sont refusés (400) dès que
`statut_envoi` n'est plus `A_ENVOYER` (ni `NULL`).

### `communication_envoi` (nouvelle)

| Colonne | Type |
|---|---|
| `id_communication` | FK `communication.id` ON DELETE CASCADE |
| `id_jeune` | FK `jeune.id` ON DELETE CASCADE |
| `statut` | `A_ENVOYER` \| `EN_COURS` \| `ENVOYEE` \| `ERREUR` \| `TOKEN_INVALIDE` |
| `date_traitement` | `TIMESTAMPTZ` nullable — posée à la réservation (`EN_COURS`) puis au marquage final |

PK `(id_communication, id_jeune)`, index `(id_communication, statut)`.
Une ligne = un jeune de la population **au moment du démarrage** (population
figée : la pagination ne dépend plus des tokens qui bougent).

## Jobs

### `NOTIFIER_COMMUNICATIONS` (cron 9h jours ouvrés, conservé)

Pour la **première** communication `NOTIFICATION` avec `date_debut ≤ now` et
`statut_envoi = A_ENVOYER` (ordre `date_debut`), si aucune n'est `EN_COURS` :

1. `INSERT INTO communication_envoi … SELECT` des jeunes de la population avec
   `push_notification_token IS NOT NULL` (`ON CONFLICT DO NOTHING`) ;
2. `statut_envoi = EN_COURS` ;
3. enfile `ENVOYER_LOT_COMMUNICATION` `{ idCommunication, numeroLot: 1,
   echecsConsecutifs: 0 }` immédiat, `jobId =
   ENVOYER_LOT_COMMUNICATION:<idCommunication>:1`.

Une seule communication en cours à la fois (les suivantes partent au cron
suivant).

### `ENVOYER_LOT_COMMUNICATION` (nouveau)

1. Relit la communication ; si elle n'est pas `EN_COURS` → termine sans rien
   faire (annulation).
2. `restantes = count(statut = A_ENVOYER)` (après libération, étape 4) ; si
   `A_ENVOYER` et `EN_COURS` sont tous deux à 0 → `ENVOYEE` +
   `envoi_termine_le = now`, fin. Si seul `EN_COURS` reste (un autre lot est
   en train de finir), replanifie simplement le lot suivant.
3. `debit = clamp(restantes / secondesRestantesAvant17hParis, min, max)` en
   notifs/s (config `jobs.envoiCommunication`, défauts 1 et 10). Hors fenêtre
   ouvrée, la fenêtre vaut une journée entière (9 h).
   `tailleLot = ceil(debit × dureeLotSecondes)` (défaut 60).
4. **Réserve** `tailleLot` lignes `A_ENVOYER` en un seul `UPDATE … SET statut =
   EN_COURS … WHERE … IN (SELECT … FOR UPDATE SKIP LOCKED LIMIT n) RETURNING`
   (ordre `id_jeune`, jointure `jeune` pour le token). Deux workers ne peuvent
   pas réserver la même ligne. Pour chacune : token nul → `TOKEN_INVALIDE`
   sans appel ; sinon `send` (awaité, retourne `ENVOYEE` / `TOKEN_INVALIDE` /
   `ERREUR`), marque la ligne, attend `1000 / debit` ms.
   Avant de réserver, **libère** les lignes `EN_COURS` dont `date_traitement`
   a plus de 5 min (worker mort à mi-lot) en les repassant `A_ENVOYER`.
5. Replanifie le lot `numeroLot + 1` à `now + 1 s` reporté au prochain créneau
   ouvré (8h-17h Paris, lun-ven), `echecsConsecutifs: 0`.
6. Si une exception sort de l'étape 2-4 : `echecsConsecutifs + 1` ; si
   `≥ 3` → `EN_ERREUR`, sinon replanifie le lot suivant à `now + 1 min`.

Un lot dure ~`dureeLotSecondes` → le worker reste disponible pour les autres
jobs entre deux lots. **Plusieurs workers en prod** : un lot rejoué (stalled)
peut tourner sur un autre worker en même temps que le lot suivant ; la
réservation `SKIP LOCKED` garantit qu'ils ne se partagent aucun jeune. Pire cas
résiduel : un worker tué entre l'appel Firebase et le marquage → ce seul jeune
est renotifié après libération. Les `jobId` déterministes empêchent Bull
d'enfiler deux fois le même lot.

`ENVOYER_LOT_COMMUNICATION` est exclu de `estJobSuivi` et `estNotifiable`
(trop de lots pour `suivi_job` / Mattermost) ; un échec reste notifié
(`succes: false`).

## Routes support

| Route | Effet |
|---|---|
| `POST /support/communications/:id/envoi/annulation` | `EN_COURS` → `ANNULEE`, supprime les lots planifiés (`supprimerLesJobsSelonPattern('ENVOYER_LOT_COMMUNICATION:<id>:')`). 400 sinon. |
| `POST /support/communications/:id/envoi/relance` | `ANNULEE` \| `EN_ERREUR` → `EN_COURS`, enfile un lot (`numeroLot = now.toMillis()` pour ne pas collisionner avec la chaîne précédente). Les lignes déjà `ENVOYEE` restent acquises. 400 sinon. |
| `GET /support/populations/:id` | chaque communication expose `statutEnvoi`, `envoiTermineLe`, `envoi: { total, aEnvoyer, enCours, envoyees, erreurs, tokensInvalides }` (présent dès que des lignes existent). |

Supprimés : `POST /support/notifier-beneficiaires`,
`NotifierBeneficiairesCommandHandler`, `NotifierBeneficiairesPayload`,
`NotifierBeneficiairesJobHandler`, `JobType.NOTIFIER_BENEFICIAIRES` et ses
types, `Planificateur.Repository.recupererPremierJobNonTermine` (plus
d'appelant), leurs tests, la ligne du `TROUBLESHOOT.md`.

## Hors périmètre

- Envoi Firebase multicast (`sendEach`) : évolution possible d'un lot si le
  plafond devient limitant.
- Débit adaptatif à la charge observée.
- Purge de `communication_envoi` (cascade à la suppression de la communication
  suffit).
