# Superviseur

## Qui est-il ?

Le superviseur est **un conseiller** disposant de droits de supervision sur d'autres conseillers MILO.
Il utilise **l'application web Next.js**, exactement comme un conseiller classique.

Sa particularité : il gère la partie **MILO décorrélée de pass-emploi** — c'est-à-dire les sessions, animations collectives et structures MILO qui existent indépendamment du dispositif pass-emploi. Il n'a pas de portefeuille de jeunes propre mais peut consulter ceux des conseillers qu'il supervise.

> Dans le code, son token JWT contient `type=SUPERVISEUR` (distinct de `CONSEILLER`), ce qui lui ouvre des routes supplémentaires.

---

## Diagramme de capacités

```mermaid
graph LR
    SV[Superviseur<br/>= Conseiller MILO<br/>avec droits élargis]

    SV --> SES[Sessions MILO de la structure]
    SV --> AC[Animations collectives]
    SV --> JEL[Jeunes de l'établissement MILO]
    SV --> PC[Consulter les portefeuilles<br/>des conseillers supervisés]

    SES --> DET[Détail et clôture]
    PC --> IND[Indicateurs par jeune]
```

---

## Routes

> Ces routes sont spécifiques au superviseur MILO. Les routes génériques de pass-emploi (jeunes, actions, rendez-vous) sont documentées dans [conseiller.md](./conseiller.md).

### Supervision MILO

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/conseillers/milo/:idConseiller/sessions` | Sessions d'un conseiller supervisé |
| `GET` | `/conseillers/milo/:idConseiller/sessions/:idSession` | Détail d'une session |
| `GET` | `/conseillers/milo/:idConseiller/compteurs-portefeuille` | Compteurs du portefeuille d'un conseiller |
| `GET` | `/conseillers/:idConseiller/jeunes` | Jeunes du portefeuille d'un conseiller supervisé |
| `GET` | `/conseillers/:idConseiller/jeunes/:idJeune/indicateurs` | Indicateurs d'un jeune |
| `GET` | `/structures-milo/:idStructureMilo/jeunes` | Tous les jeunes de la structure MILO |
| `POST` | `/structures-milo/animations-collectives/:idAnimationCollective/cloturer` | Clôturer une animation collective |

---

## Séquence : Consulter les sessions d'un conseiller supervisé

```mermaid
sequenceDiagram
    participant Web as App Web Superviseur
    participant API as pass-emploi-api
    participant Auth as OidcAuthGuard
    participant Authz as ConseillerAuthorizer
    participant H as GetSessionsQueryHandler
    participant MILO as API MILO

    Web->>API: GET /conseillers/milo/:idConseiller/sessions
    API->>Auth: Valider JWT
    Auth-->>API: Utilisateur (type=SUPERVISEUR, structure=MILO)

    API->>H: handle(query)
    H->>Authz: Le superviseur peut-il voir ce conseiller ?
    Authz->>MILO: Vérifier appartenance à la structure
    MILO-->>Authz: OK
    Authz-->>H: Autorisé

    H->>MILO: Récupérer sessions du conseiller
    MILO-->>H: Liste sessions
    H-->>API: SessionsQueryModel[]
    API-->>Web: 200 [{ id, titre, dateDebut, ... }]
```
<img src="../diagrammes/supervisor-sequence-flux.svg">
