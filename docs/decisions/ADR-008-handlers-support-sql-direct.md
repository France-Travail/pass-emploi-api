# Handlers support : Sequelize en direct, repository seulement s'il existe déjà

* Statut : accepté
* Date : 2026-09-17

Les routes `/support/*` (fonctionnalités, populations, déploiements,
communications) sont de l'outillage interne : un CRUD plat sur des tables de
pilotage, appelé par le support sous clé d'API, sans règle métier au-delà de
quelques invariants (dates ordonnées, population existante). Les handlers
correspondants accèdent aux modèles Sequelize directement depuis la couche
application, ce qui déroge à l'architecture nominale (domaine → repository →
implémentation SQL). Cette ADR acte la dérogation et en fixe la limite.

## Décisions

1. **Un handler support lit et écrit via les `*SqlModel`**, sans passer par un
   repository domaine. Le fichier porte le suffixe `.db.ts` pour le dire, et
   son test est un `.db.test.ts` sur la base de test, pas un test unitaire à
   doubles.
2. **Un repository domaine existant s'utilise**, on ne le contourne pas.
   `PopulationRepository.existe()` sert à tous les handlers qui vérifient une
   population ; `Communication.Repository.getMessageInformatifDuConseiller()`
   sert à la lecture côté client. Si un repository couvre déjà l'opération dont
   un handler support a besoin, le handler l'appelle.
3. **On ne crée pas de repository pour le support.** Un repository domaine naît
   d'un besoin des parcours client (jeune, conseiller) ou d'un job, avec ses
   règles d'appartenance, ses filtres, ses tests DB. Le CRUD support n'est pas
   ce besoin : un `save`/`delete` de plus dans l'interface pour le seul confort
   architectural serait du code sans utilisateur.
4. **Les invariants restent dans le domaine.** `Deploiement.creer`,
   `Communication.creer` valident ce qui doit l'être quel que soit l'appelant ;
   le handler ne fait que persister le résultat. C'est ce qui garde la
   dérogation locale à l'infrastructure : la logique n'a pas bougé de couche.

## Ce que ça donne

| Handler | Domaine | Repository | Sequelize direct |
|---|---|---|---|
| `CreerCommunicationCommandHandler` | `Communication.creer` | `Population.existe` | `CommunicationSqlModel.create` |
| `ModifierCommunicationCommandHandler` | `Communication.creer` | `Population.existe` | `findByPk`, `update` |
| `SupprimerCommunicationCommandHandler` | — | — | `destroy` |
| `GetCommunicationsConseillerQueryHandler` (client) | — | `Communication.Repository` | — |

## Tests : au niveau du use case

Sur ce périmètre (populations, déploiements, communications), le comportement
attendu se vérifie sur le **handler, avec la base de test et les vrais
repositories** (`*.handler.db.test.ts`), intitulés formulés en règle métier
(« affiche une seule communication à la fois : celle qui se termine le plus
tôt »). Pas de test unitaire du handler à doubles : il ne vérifierait que le
câblage, et se réécrit à chaque déplacement de la règle entre SQL et TS. Les
tests des repositories restent pour documenter finement les bornes (dates,
transferts), le test du handler garantit le résultat vu par l'utilisateur.
Ça vaut aussi pour `GetCommunicationsConseillerQueryHandler` côté client.

## Quand revenir dessus

Si un handler support commence à porter une règle métier qui dépasse
l'invariant d'entité (orchestration entre agrégats, effet de bord vers un
partenaire, notification), il sort de cette dérogation : on remonte la règle
dans le domaine et on passe par un repository comme partout ailleurs.

## Liens

* [ADR-006](ADR-006-deploiements-fonctionnalites-migrations.md),
  [ADR-007](ADR-007-communications.md) : les handlers concernés.
* `src/application/commands/support/`, `src/application/queries/get-population*-support.query.handler.db.ts`.
