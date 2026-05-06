# Spec : Rétrodocumentation — Acteurs et Routes

**Date :** 2026-05-06
**Statut :** Approuvé
**Audience cible :** Développeurs internes rejoignant l'équipe

---

## Contexte

pass-emploi-api ne dispose pas de documentation synthétique sur les acteurs du système et leurs routes associées. Un nouveau développeur doit actuellement lire les controllers un par un pour comprendre qui fait quoi. Cette spec décrit la rétrodocumentation à produire.

---

## Objectif

Produire une documentation de référence dans `docs/actors/` qui permet à un nouveau développeur de comprendre en moins de 15 minutes :
- Qui sont les acteurs du système
- Ce que chaque acteur peut faire
- Quelles routes lui sont accessibles

---

## Structure des fichiers

```
docs/
└── actors/
    ├── README.md          # Index global + diagrammes macro
    ├── jeune.md           # Bénéficiaire / Jeune
    ├── conseiller.md      # Conseiller (France Travail + MILO)
    ├── superviseur.md     # Superviseur
    └── admin.md           # Admin interne
```

---

## Contenu détaillé

### `docs/actors/README.md`

Point d'entrée obligatoire. Contient :

1. **Introduction** : présentation des 4 acteurs principaux et de leurs structures d'appartenance (POLE_EMPLOI, MILO, CONSEIL_DEPT, PASS_EMPLOI)

2. **Diagramme 1 — Vue acteurs** (`graph TD` Mermaid)
   - Les acteurs (Jeune, Conseiller, Superviseur, Admin)
   - Leurs structures d'appartenance
   - Les relations entre acteurs (un Superviseur supervise des Conseillers, un Conseiller accompagne des Jeunes)

3. **Diagramme 2 — Auth flow** (`sequenceDiagram` Mermaid)
   - Comment chaque type d'utilisateur s'authentifie
   - Flux OIDC via pass-emploi-connect → pass-emploi-api
   - Distinction JWT utilisateur vs API Key (services internes)

4. **Diagramme 3 — Matrice acteurs × domaines** (`graph LR` Mermaid)
   - Acteurs en entrée, domaines métier en sortie (Actions, Offres, Messagerie, Rendez-vous, Sessions MILO, Démarches, etc.)
   - Liaisons indiquant quel acteur accède à quel domaine

5. **Diagramme 4 — Mindmap des routes** (`mindmap` Mermaid)
   - Arborescence des controllers groupés par acteur
   - Racines : Jeune, Conseiller, Superviseur, Admin
   - Branches : domaines et sous-ressources

6. **Table de navigation** : liens vers les 4 fichiers acteur

---

### `docs/actors/jeune.md`

Acteur : bénéficiaire accompagné, utilise l'app mobile Flutter.

Structure :
1. **Présentation** : qui est le jeune, dispositifs concernés (CEJ, PACEA), structures possibles
2. **Diagramme 1 — Capacités** (`graph LR` Mermaid) : domaines accessibles au jeune (ses actions, ses offres favorites, son chat, ses rendez-vous, son suivi MILO/FT, ses démarches)
3. **Table des routes** : `METHOD | Endpoint | Description` — vue d'ensemble, une ligne par route, sans détail des paramètres
4. **Diagramme 2 — Séquence "Consulter mon suivi"** (`sequenceDiagram` Mermaid) : flux `GET /jeunes/:id/mon-suivi` → MiloClient ou PoleEmploiClient selon la structure du jeune

---

### `docs/actors/conseiller.md`

Acteur : professionnel qui accompagne les bénéficiaires, utilise l'app web Next.js.

Structure :
1. **Présentation** : rôle du conseiller, distinction FT vs MILO, notion de portefeuille
2. **Diagramme 1 — Capacités** (`graph LR` Mermaid) : domaines accessibles (gestion jeunes, actions, rendez-vous, messagerie, offres, sessions MILO, animations collectives, listes de diffusion)
3. **Table des routes** : `METHOD | Endpoint | Description`
4. **Diagramme 2 — Séquence "Créer une action pour un jeune"** (`sequenceDiagram` Mermaid) : flux `POST /conseillers/:id/jeunes/:jeuneId/action` → autorisation → création → notification

---

### `docs/actors/superviseur.md`

Acteur : supervise plusieurs conseillers au sein d'une structure.

Structure :
1. **Présentation** : rôle, périmètre (vision portefeuilles des conseillers supervisés)
2. **Diagramme 1 — Capacités** (`graph LR` Mermaid)
3. **Table des routes** : `METHOD | Endpoint | Description`
4. **Diagramme 2 — Séquence "Consulter le portefeuille d'un conseiller"** (`sequenceDiagram` Mermaid)

---

### `docs/actors/admin.md`

Acteur : équipe interne pass-emploi, accès via API Key.

Structure :
1. **Présentation** : rôle, mode d'authentification (API Key vs OIDC)
2. **Diagramme 1 — Capacités** (`graph LR` Mermaid)
3. **Table des routes** : `METHOD | Endpoint | Description`
4. **Diagramme 2 — Séquence principale** (`sequenceDiagram` Mermaid)

---

## Source des données

Les routes sont extraites des controllers NestJS dans `src/infrastructure/routes/`. Les acteurs sont déduits des guards et décorateurs `@Utilisateur()` présents dans chaque handler. Les descriptions de routes sont inférées des noms de command/query handlers associés.

Fichiers sources principaux :
- `src/infrastructure/routes/*.controller.ts`
- `src/infrastructure/auth/` (guards, stratégies)
- `src/application/commands/` et `src/application/queries/`

---

## Conventions de rédaction

- Langue : français (cohérent avec la codebase)
- Diagrammes : Mermaid uniquement (rendu natif GitHub/GitLab)
- Table des routes : vue d'ensemble uniquement, pas de détail des paramètres ni des corps de requête
- Une phrase par route, en français, à l'impératif ou infinitif (ex: "Récupérer les actions d'un jeune")

---

## Hors périmètre

- Documentation des DTOs (corps de requête / réponse)
- Documentation des services internes (jobs Bull, crons)
- Documentation des clients externes (MiloClient, PoleEmploiClient)
- Génération OpenAPI/Swagger (déjà disponible via `@nestjs/swagger`)
