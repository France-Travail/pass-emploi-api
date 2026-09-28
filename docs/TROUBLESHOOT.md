# Troubleshoot

## Mes migrations ne sont pas rejouées dans les tests :(
Pas d'inquiétude, l'image docker pour la DB de test contient un volume.
Pour supprimer ce volume et rejouer les migrations depuis le début, simplement exécuter la commande suivante :

```
docker compose up --renew-anon-volumes -d pgtestdb 
```

## Je veux retrouver un job sur redis
Pas d'inquiétude, on a un cli pour ça

Créer un tunnel :
```bash
# Exemple pour la prod, sur la region secnumt
scalingo --region osc-secnum-fr1 -a pass-emploi-api-prod db-tunnel SCALINGO_REDIS_URL
```
Ensuite, se connecter via l'outil `bull-repl`, installé en tant que dépendance de dev dans ce projet
```bash
bull-repl
connect -u redis://username:password@localhost:10000 JobQueue
```
Exemple de requêtes :
```bash
delayed -q '[.root[] | select(.data.type | contains("MAJ_CODES_EVENEMENTS"))]'-e 6000
delayed -q '[.root[] | select(.data.type | contains("RENDEZVOUS") | not)]'-e 6000
active -q '[.root[] | select(.data.type | contains("ENVOYER_COMMUNICATIONS"))]' -e 6000
```

## Communications NOTIFICATION

Voir [ADR-007](decisions/ADR-007-communications.md) et le design de l'envoi
(`docs/superpowers/specs/2026-09-17-envoi-communications-design.md`) pour le
détail du cycle de vie et des lots.

### Le cron ne tourne pas

`ENVOYER_COMMUNICATIONS` (`* 8-16 * * 1-5`) doit être planifié après chaque
déploiement :

```bash
yarn tasks:initialiser-les-crons
```

S'il manque, aucune `NOTIFICATION` `A_ENVOYER` ne démarre, et un envoi
`EN_COURS` reste bloqué sans avancer (les lots ne se réservent qu'à un tick).

### Couper l'envoi

Kill switch global, sans redéployer — variable Scalingo, redémarre le worker :

```bash
ENVOI_COMMUNICATIONS_ACTIF=false
```

Pour arrêter une seule communication sans couper le cron pour toutes les
autres :

```
POST /support/communications/:id/envoi/annulation
```

`EN_COURS` → `ANNULEE` (400 pour tout autre `statut_envoi`). Un lot déjà en
vol va au bout de ses ≤ 300 envois avant que l'arrêt prenne effet.

### Suivre un envoi

- `GET /support/populations/:id` : `statutEnvoi`, `envoiTermineLe`,
  `nbDestinataires` (tant que `A_ENVOYER`), `envoi` (compteurs vivants
  `EN_COURS`, totaux figés une fois terminé).
- Kibana, `event.action` : `communication_envoi_demarre` (démarrage, effectif
  figé), `communication_lot_envoye` (un log par lot, avec ses compteurs),
  `communication_envoi_termine` (fin), `communication_envoi_en_erreur`
  (passage `EN_ERREUR`).

### Lister les jeunes en erreur

Détail conservé 30 jours après la fin de l'envoi (purge par
`nettoyer-les-donnees`, quotidien) :

```sql
SELECT id_jeune, statut, date_traitement
FROM communication_envoi
WHERE id_communication = :id
  AND statut IN ('ERREUR', 'TOKEN_INVALIDE')
ORDER BY date_traitement;
```

### Faire une première campagne réelle

Avant toute campagne sur une population large, valider le circuit complet sur
une population de test (les comptes de l'équipe) :

1. Créer une population de test avec les emails des conseillers de l'équipe
   (`POST /support/populations`, `POST /support/populations/conseillers`).
2. Créer une `NOTIFICATION` dessus (`POST /support/communications`, `push:
   true`).
3. Relire `nbDestinataires` sur `GET /support/populations/:id` avant
   `dateDebut`, pour vérifier le ciblage.
4. Attendre le passage de `dateDebut` et le prochain tick du cron.
5. Vérifier `envoi` sur `GET /support/populations/:id` (compteurs puis totaux
   figés une fois `ENVOYEE`) et les notifications reçues sur les téléphones de
   test.
