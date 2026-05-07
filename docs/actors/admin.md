# Admin

## Qui est-il ?

L'admin représente les services internes de l'équipe pass-emploi (scripts, outils, support).
Il n'utilise **pas de JWT OIDC** : l'authentification se fait via une **API Key** transmise dans le header `Authorization: Bearer <key>`.

La clé est stockée dans les variables d'environnement (via `ConfigService`, jamais en dur).

---

## Diagramme de capacités

```mermaid
graph LR
    AD[Admin] --> CHAT[Consulter le chat d'un jeune]
    AD -.->|API Key| AUTH[ApiKeyAuthGuard]
    AUTH -.->|valide| AD
```

---

## Routes

| Méthode | Endpoint | Description |
|---|---|---|
| `GET` | `/admin/chat/:idJeune` | Récupérer les informations de chat d'un jeune (secrets Firebase) |

> Ces routes sont protégées par `ApiKeyAuthGuard` (pas OIDC). L'accès est réservé aux outils internes.

---

## Séquence : Consulter le chat d'un jeune

```mermaid
sequenceDiagram
    participant Tool as Outil Interne / Script
    participant API as pass-emploi-api
    participant Guard as ApiKeyAuthGuard
    participant H as GetChatSecretsQueryHandler
    participant Firebase as Firebase Admin SDK

    Tool->>API: GET /admin/chat/:idJeune<br/>Authorization: Bearer <API_KEY>
    API->>Guard: Vérifier la clé API
    Guard-->>API: Autorisé

    API->>H: handle(query)
    H->>Firebase: Récupérer les tokens chat du jeune
    Firebase-->>H: Chat secrets
    H-->>API: ChatSecretsQueryModel
    API-->>Tool: 200 { token, ... }
```
