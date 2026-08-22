# TherapyFlow API

The backend runs with `npm start` and serves the frontend and API from the same origin.

## Demo authentication

The prototype has two demo accounts. Both use the password `demo-password`:

- Therapist: `therapist`
- Client: `sarah`

Set `THERAPYFLOW_SESSION_SECRET`, `THERAPYFLOW_PASSWORD_SALT`, and `THERAPYFLOW_DEMO_PASSWORD_HASH` in a real environment. The fallback values are for local development only. Login attempts are throttled after ten failures per client address within a fifteen-minute window.

## Endpoints

- `GET /api/health` returns service status.
- `POST /api/auth/login` accepts `{ "username": "sarah", "password": "demo-password" }` and returns a bearer token.
- `GET /api/me` returns the authenticated user.
- `GET /api/clients` returns all clients to therapists and only the signed-in client's record to clients.
- `GET /api/clients/:clientId/:collection` reads `moods`, `journals`, `assessments`, `sessions`, `appointments`, or `messages`.
- `POST /api/clients/:clientId/:collection` writes a record to one of those collections when the role is authorized.

Send protected requests with:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

The development server uses Node's built-in SQLite support and persists to `therapyflow.db`. `data.json` is used only to seed a fresh database. This storage is not yet suitable for real clinical data; production requires encrypted storage, managed backups, audit logs, and a reviewed deployment of the database runtime.
