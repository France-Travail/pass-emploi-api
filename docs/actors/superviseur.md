# Superviseur

## Qui est-il ?

Le superviseur supervise plusieurs conseillers au sein d'une même structure. Il utilise **l'application web Next.js**.
Il n'a pas de portefeuille de jeunes propre : il accède aux données de ses conseillers supervisés.

---

## Diagramme de capacités

```mermaid
graph LR
    SV[Superviseur] --> PC[Portefeuille de conseillers]
    SV --> JC[Jeunes des conseillers]
    SV --> SES[Sessions MILO de la structure]
    SV --> AC[Animations collectives]
    SV --> JEL[Jeunes de l'établissement]

    PC --> CONS[Voir les conseillers de sa structure]
    JC --> IND[Indicateurs par jeune]
    SES --> DET[Détail et clôture de sessions]
```

---

## Routes

### Supervision des conseillers

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/conseillers` | Rechercher des conseillers dans sa structure |
| `GET` | `/conseillers/:idConseiller` | Détail d'un conseiller supervisé |
| `GET` | `/conseillers/:idConseiller/jeunes` | Jeunes du portefeuille d'un conseiller |
| `GET` | `/conseillers/:idConseiller/jeunes/comptage` | Comptage des jeunes d'un conseiller |
| `GET` | `/conseillers/:idConseiller/jeunes/:idJeune/indicateurs` | Indicateurs d'un jeune |

### Sessions MILO (superviseur MILO uniquement)

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/conseillers/milo/:idConseiller/sessions` | Sessions d'un conseiller supervisé |
| `GET` | `/conseillers/milo/:idConseiller/sessions/:idSession` | Détail d'une session |
| `GET` | `/conseillers/milo/:idConseiller/compteurs-portefeuille` | Compteurs du portefeuille d'un conseiller |
| `GET` | `/structures-milo/:idStructureMilo/jeunes` | Tous les jeunes de la structure MILO |
| `POST` | `/structures-milo/animations-collectives/:idAnimationCollective/cloturer` | Clôturer une animation collective |

---

## Séquence : Consulter le portefeuille d'un conseiller

```mermaid
sequenceDiagram
    participant Web as App Web Superviseur
    participant API as pass-emploi-api
    participant Auth as OidcAuthGuard
    participant Authz as ConseillerAuthorizer
    participant H as GetJeunesQueryHandler
    participant DB as PostgreSQL

    Web->>API: GET /conseillers/:idConseiller/jeunes
    API->>Auth: Valider JWT
    Auth-->>API: Utilisateur (type=SUPERVISEUR, structure=MILO)

    API->>H: handle(query)
    H->>Authz: Le superviseur peut-il voir ce conseiller ?
    Authz->>DB: Vérifier même structure
    DB-->>Authz: OK
    Authz-->>H: Autorisé

    H->>DB: Récupérer jeunes du conseiller
    DB-->>H: Liste jeunes
    H-->>API: JeunesQueryModel[]
    API-->>Web: 200 [{ id, nom, prenom, ... }]
```
