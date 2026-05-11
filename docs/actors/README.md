# Acteurs et Routes — pass-emploi-api

> Point d'entrée pour comprendre qui fait quoi dans l'API.
> Pour le détail des routes, consulte le fichier de ton acteur.

## Les acteurs

pass-emploi-api sert 4 types d'utilisateurs authentifiés et un ensemble de routes publiques.

| Acteur | App | Structure | Authentification |
|---|---|---|---|
| **Bénéficiaire / Jeune** | App mobile Flutter | FT, MILO, CONSEIL_DEPT | JWT OIDC via pass-emploi-connect |
| **Conseiller** | Web Next.js | FT (POLE_EMPLOI), MILO | JWT OIDC via pass-emploi-connect |
| **Superviseur** | Web Next.js | FT, MILO | JWT OIDC via pass-emploi-connect |
| **Admin** | Outils internes | PASS_EMPLOI | API Key (header `Authorization: Bearer`) |

---

## Diagramme 1 — Relations entre acteurs

```mermaid
graph TD
    AD[👤 Admin<br/>PASS_EMPLOI]
    SV[👤 Superviseur<br/>FT · MILO]
    C[👤 Conseiller<br/>FT · MILO]
    J[👤 Bénéficiaire / Jeune<br/>FT · MILO · CONSEIL_DEPT]

    SV -->|supervise| C
    C -->|accompagne| J
    AD -->|administre| J
    AD -->|administre| C

    subgraph Dispositifs
        D1[CEJ — France Travail + MILO]
        D2[PACEA — MILO]
    end
    J -.->|inscrit à| D1
    J -.->|inscrit à| D2
```
<img src="../diagrammes/relation-beetwen-actors.svg">

---

## Diagramme 2 — Flux d'authentification

```mermaid
sequenceDiagram
    participant App as App Mobile / Web
    participant Connect as pass-emploi-connect
    participant IDP as IDP Externe<br/>(France Travail / MILO)
    participant API as pass-emploi-api

    App->>Connect: Initier connexion OIDC
    Connect->>IDP: Déléguer authentification
    IDP-->>Connect: Identité confirmée
    Connect-->>App: JWT access token (signé)

    App->>API: Requête + Bearer JWT
    API->>Connect: Valider le JWT (JWKS)
    Connect-->>API: Claims (id, type, structure)
    API-->>App: Réponse métier

    note over API: Les services internes utilisent<br/>une API Key à la place du JWT
```
<img src="../diagrammes/authentification-flow.svg">
---

## Diagramme 3 — Matrice acteurs × domaines

```mermaid
graph LR
    J[Jeune] --> ACT[Actions]
    J --> FAV[Favoris & Offres]
    J --> RDV_J[Rendez-vous]
    J --> MSG_J[Messagerie]
    J --> RCH[Recherches & Suggestions]
    J --> SUV[Suivi FT · MILO]
    J --> SES_J[Sessions MILO]

    C[Conseiller] --> ACT
    C --> RDV_C[Rendez-vous]
    C --> MSG_C[Messagerie]
    C --> LD[Listes de diffusion]
    C --> DEM[Démarches]
    C --> SES_C[Sessions MILO]
    C --> AC[Animations collectives]
    C --> SUG[Suggestions d'offres]
    C --> ACT_M[Actualités MILO]

    SV[Superviseur] --> PF[Portefeuille conseillers]
    SV --> SES_C

    AD[Admin] --> CHAT[Chat jeunes]
```
<img src="../diagrammes/actor-x-domain.svg">
---

## Diagramme 4 — Mindmap des routes principales

```mermaid
mindmap
  root((pass-emploi-api))
    Jeune
      /jeunes/:idJeune
      /jeunes/:idJeune/actions
      /jeunes/:idJeune/favoris/**
      /jeunes/:idJeune/recherches/**
      /jeunes/:idJeune/rendezvous/**
      /jeunes/:idJeune/milo/accueil
      /jeunes/milo/:idJeune/**
      /jeunes/:idJeune/pole-emploi/**
    Conseiller
      /conseillers/:idConseiller
      /conseillers/:idConseiller/jeunes/**
      /conseillers/:idConseiller/rendezvous/**
      /conseillers/milo/:idConseiller/**
      /conseillers/pole-emploi/**
      /conseillers/:idConseiller/listes-de-diffusion
    Superviseur
      /conseillers/:idConseiller/jeunes
      /conseillers/milo/:idConseiller/sessions/**
      /structures-milo/:idStructure/jeunes
    Admin
      /admin/chat/:idJeune
    Routes partagées
      /actions/:idAction/**
      /rendezvous/:idRendezVous/**
      /listes-de-diffusion/:idListe
    Public
      /offres-emploi/**
      /offres-immersion/**
      /services-civique/**
      /referentiels/**

```
<img src="../diagrammes/mindmap-road.svg">
---

## Navigation

| Acteur | Fichier |
|---|---|
| Bénéficiaire / Jeune | [jeune.md](./jeune.md) |
| Conseiller | [conseiller.md](./conseiller.md) |
| Superviseur | [superviseur.md](./superviseur.md) |
| Admin | [admin.md](./admin.md) |
