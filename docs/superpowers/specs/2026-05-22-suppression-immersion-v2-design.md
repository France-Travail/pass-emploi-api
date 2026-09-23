# Suppression Immersion v2 — Design

## Contexte

L'API Immersion Facile v2 (`/v2/search`, `/v2/contact-establishment`) est décommissionnée.
Le code pass-emploi-api exposait en parallèle des endpoints v2 et v3. Ce design décrit la
suppression de la couche v2 en conservant intacte la couche v3 active.

## Périmètre

**Supprimé :** tout le code qui appelle ou expose les endpoints `/v2/` de l'API Immersion Facile.

**Conservé :**
- Endpoints v3 (`/offres-immersion/v3`, `/offres-immersion/v3/:siret/:appellationCode/:locationId`, `/jeunes/:idJeune/offres-immersion/v3/contact`)
- `POST /offres-immersion` (notification nouvelles immersions — indépendant de la version)
- `NotifierNouvellesImmersionsCommandHandler` (indépendant de la version)
- `AddCandidatureOffreImmersionCommandHandler` (indépendant de la version)
- `CreateSuggestionConseillerImmersionCommandHandler` (indépendant de la version)
- Gestion des favoris (`FavoriOffreImmersion`) — aucune distinction v2/v3
- Configuration (`immersion.url`, `immersion.apiKey`) — toujours utilisée par v3

---

## Section 1 : Routes (Controller)

**Fichier modifié :** `src/infrastructure/routes/offres-immersion.controller.ts`

Endpoints supprimés :

| Méthode | Route | Handler retiré |
|---------|-------|----------------|
| `GET` | `/offres-immersion` | `GetOffresImmersionQueryHandler` |
| `GET` | `/offres-immersion/:idOffreImmersion` | `GetDetailOffreImmersionQueryHandler` |
| `POST` | `/jeunes/:idJeune/offres-immersion/contact` | `EnvoyerFormulaireContactImmersionCommandHandler` |

Imports retirés du controller :
- `EnvoyerFormulaireContactImmersionCommandHandler`
- `GetDetailOffreImmersionQuery`, `GetDetailOffreImmersionQueryHandler`
- `GetOffresImmersionQuery`, `GetOffresImmersionQueryHandler`
- `OffreImmersionQueryModel`, `DetailOffreImmersionQueryModel`
- `GetOffresImmersionQueryParams`, `PostImmersionContactBody`

---

## Section 2 : Couche applicative

### Fichiers supprimés entièrement

| Fichier | Raison |
|---------|--------|
| `src/application/queries/get-offres-immersion.query.handler.ts` | Handler v2 uniquement |
| `src/application/queries/get-detail-offre-immersion.query.handler.ts` | Handler v2 uniquement |
| `src/application/commands/envoyer-formulaire-contact-immersion.command.handler.db.ts` | Command v2 uniquement |
| `src/application/queries/query-getters/find-all-offres-immersion.query.getter.db.ts` | Query getter v2 uniquement |

### Tests supprimés

Les fichiers de test correspondant aux 4 handlers/query-getters ci-dessus.

### Fichiers modifiés (parties v2 retirées)

**`src/application/queries/query-models/offres-immersion.query-model.ts`**

Classes supprimées :
- `OffreImmersionQueryModel` (modèle de réponse v2)
- `DetailOffreImmersionQueryModel` (étend `OffreImmersionQueryModel`)
- `ContactImmersionQueryModel` (uniquement référencée par `DetailOffreImmersionQueryModel`)
- `LocalisationQueryModel` (uniquement référencée par `DetailOffreImmersionQueryModel`)

Classes conservées : `OffreImmersionQueryModelV3`, `FavoriOffreImmersionQueryModel`,
`ResultatRechercheOffresImmersionQueryModelV3`, `DetailOffreImmersionQueryModelV3`

**`src/infrastructure/routes/validation/offres-immersion.inputs.ts`**

Classes supprimées :
- `GetOffresImmersionQueryParams` (params de recherche v2)
- `PostImmersionContactBody` (body de contact v2)

Classes conservées : `GetOffresImmersionQueryParamsV3`, `PostImmersionContactBodyV3`,
`NouvellesOffresImmersions`

---

## Section 3 : Infrastructure

### `src/infrastructure/clients/immersion-client.ts`

Méthodes supprimées :
- `getOffres(params)` → appelait `GET /v2/search`
- `getDetailOffre(id)` → appelait `GET /v2/search/:id`
- `envoyerFormulaireImmersion(payload)` → appelait `POST /v2/contact-establishment`

Interface supprimée :
- `FormulaireImmersionPayload` (payload v2)

Conservé : `getOffresV3()`, `getDetailOffreV3()`, `envoyerFormulaireImmersionV3()`,
`FormulaireImmersionPayloadV3`, méthodes `get()` et `post()` privées/partagées.

### `src/infrastructure/repositories/dto/immersion.dto.ts`

Supprimé : `PartenaireImmersion.DtoV2`

Conservé : `PartenaireImmersion.DtoV3`, `SearchResponseV3`, `ContactMode`

### `src/infrastructure/repositories/mappers/offres-immersion.mappers.ts`

Supprimer les fonctions de mapping qui consomment `PartenaireImmersion.DtoV2`.
Conserver les mappers V3.

### `src/infrastructure/repositories/offre/offre-immersion-http-sql.repository.db.ts`

Supprimer les méthodes qui appelaient `ImmersionClient.getOffres()`,
`getDetailOffre()` et `envoyerFormulaireImmersion()`.
Conserver les méthodes V3.

### Module NestJS (`src/app.module.ts` ou module dédié)

Retirer des tableaux `providers` / `imports` les 4 handlers/query-getters supprimés :
- `GetOffresImmersionQueryHandler`
- `GetDetailOffreImmersionQueryHandler`
- `EnvoyerFormulaireContactImmersionCommandHandler`
- `FindAllOffresImmersionQueryGetter` (si enregistré séparément)

---

## Ordre d'exécution (outside-in)

1. **Controller** — retirer routes et imports v2. Le compilateur signale les dépendances mortes.
2. **Query models + Inputs** — supprimer classes v2. Le compilateur confirme qu'aucun v3 ne les référençait.
3. **Handlers / query getters** — supprimer les 4 fichiers v2.
4. **Infrastructure** — nettoyer client, DTOs, mappers, repository.
5. **Module NestJS** — retirer les registrations des providers v2 supprimés.
6. **Tests** — supprimer les fichiers de test des handlers v2 supprimés.

À chaque étape, `yarn build` doit passer avant de passer à la suivante.

---

## Critères de succès

- `yarn build` passe sans erreur
- `yarn test:local:unit` passe (les tests v3 et favoris sont verts)
- Aucune référence à `DtoV2`, `getOffres(`, `getDetailOffre(`, `envoyerFormulaireImmersion(` dans le code source (hors historique git)
- Les routes v3 sont documentées dans Swagger
