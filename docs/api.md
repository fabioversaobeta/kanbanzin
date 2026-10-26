# HTTP API reference

Base URL: `https://api.kanbanzin.fabiobandacheski.com` (development: `http://localhost:3000`).
All resources are under `/v1`. Bodies and responses are JSON (`Content-Type: application/json`).

## Conventions

**Authentication.** Protected routes require `Authorization: Bearer <accessToken>`. Access tokens
live 15 minutes. Renew them with `POST /v1/auth/refresh`, which uses the HttpOnly `kz_refresh`
cookie (so requests must be sent with `credentials: 'include'` from an allowed origin).

**Errors.** Every error has the same shape:

```json
{ "error": { "code": "weak_password", "message": "Password must have at least 10 characters." } }
```

Validation failures from request parsing add an `issues` array (`{ path, message }[]`) and use code
`invalid_request`.

| Status | Meaning                                                         |
| ------ | --------------------------------------------------------------- |
| 400    | Validation error (`invalid_*`, `weak_password`, `superpower_disabled`…) |
| 401    | Missing/invalid/expired token, wrong credentials                |
| 403    | Origin not allowed (CSRF protection)                            |
| 404    | Not found **or not yours** (the two are indistinguishable)      |
| 409    | Conflict (`email_taken`, `limit_reached`)                       |
| 413    | Body larger than 100 KB                                         |
| 429    | Rate limited or account temporarily locked                      |

**Rate limits (per client IP).** Global 300/min; login 10/min; register 10/h;
forgot/reset/change/delete password 5/h; refresh 60/min.

**Ordering.** Move endpoints take a zero-based `index`: the slot among the *other* items of the
destination, i.e. the position the item will have after the move.

**Limits.** 100 boards per user, 50 lists per board, 500 cards per list. Titles: board/list 100
chars, card 200; description 10 000 chars.

## Health

| Method | Path            | Description                                  |
| ------ | --------------- | -------------------------------------------- |
| GET    | `/health`       | Liveness: `{ "status": "ok" }`               |
| GET    | `/health/ready` | Readiness (checks the database), 503 if down |

## Authentication

| Method | Path                       | Body                                              | Result |
| ------ | -------------------------- | ------------------------------------------------- | ------ |
| POST   | `/v1/auth/register`        | `{ name, email, password, acceptTerms: true }`    | `201 { user, accessToken, expiresIn }` + cookie |
| POST   | `/v1/auth/login`           | `{ email, password }`                             | `200 { user, accessToken, expiresIn }` + cookie |
| POST   | `/v1/auth/refresh`         | – (cookie)                                        | `200 { user, accessToken, expiresIn }` + rotated cookie |
| POST   | `/v1/auth/logout`          | – (cookie)                                        | `204`, cookie cleared |
| POST   | `/v1/auth/password/forgot` | `{ email }`                                       | `202` always (never reveals whether the e-mail exists) |
| POST   | `/v1/auth/password/reset`  | `{ token, password }`                             | `204`; signs out every session |

Password rules: 10–128 characters, not a common password, not containing the e-mail user part.
After 5 failed logins an account is locked for 15 minutes (`429 account_locked`).

## Account and privacy

| Method | Path               | Body                                     | Result |
| ------ | ------------------ | ---------------------------------------- | ------ |
| GET    | `/v1/me`           | –                                        | `{ user }` |
| PATCH  | `/v1/me`           | `{ name }`                               | `{ user }` |
| POST   | `/v1/me/password`  | `{ currentPassword, newPassword }`       | `{ accessToken, expiresIn }`; other sessions are revoked |
| GET    | `/v1/me/export`    | –                                        | JSON download with all personal data (LGPD art. 18, II/V) |
| DELETE | `/v1/me`           | `{ password }`                           | `204`; deletes the account and **all** its data (LGPD art. 18, VI) |

## Boards

| Method | Path              | Body                       | Result |
| ------ | ----------------- | -------------------------- | ------ |
| GET    | `/v1/boards`      | –                          | `{ boards: [{ id, title, color, updatedAt }] }` |
| POST   | `/v1/boards`      | `{ title, color? }`        | `201 { board }` |
| GET    | `/v1/boards/:id`  | –                          | `{ board, lists: [{ id, title, position, cards: [...] }], superpowers: [keys] }` |
| PATCH  | `/v1/boards/:id`  | `{ title?, color? }`       | `{ board }` |
| DELETE | `/v1/boards/:id`  | –                          | `204` (cascades to lists and cards) |

`color` is a palette key (`ocean`, `sky`, `mint`, `forest`, `sunset`, `rose`, `violet`,
`graphite`) or a custom `#rrggbb` value. Default: `ocean`.

## Lists

| Method | Path                       | Body        | Result |
| ------ | -------------------------- | ----------- | ------ |
| POST   | `/v1/boards/:id/lists`     | `{ title }` | `201 { list }` (appended) |
| PATCH  | `/v1/lists/:id`            | `{ title }` | `204` |
| POST   | `/v1/lists/:id/move`       | `{ index }` | `204` |
| DELETE | `/v1/lists/:id`            | –           | `204` (cascades to cards) |

## Cards

| Method | Path                       | Body                                              | Result |
| ------ | -------------------------- | ------------------------------------------------- | ------ |
| POST   | `/v1/lists/:id/cards`      | `{ title }`                                       | `201 { card }` (appended) |
| PATCH  | `/v1/cards/:id`            | `{ title?, description?, dueAt?, labels? }`       | `{ card }` |
| POST   | `/v1/cards/:id/move`       | `{ listId, index }`                               | `204` (target list must be on the same board) |
| DELETE | `/v1/cards/:id`            | –                                                 | `204` |

A card is `{ id, listId, title, description, position, createdAt, updatedAt }` plus the fields of
the superpowers enabled on its board:

- `dueAt: string | null` (ISO 8601) — requires `due-dates`
- `labels: string[]` (`red orange yellow green teal blue purple pink`) — requires `color-labels`

Sending a field whose superpower is disabled returns `400 superpower_disabled`.

## Superpowers

| Method | Path                                   | Body              | Result |
| ------ | -------------------------------------- | ----------------- | ------ |
| GET    | `/v1/superpowers`                      | –                 | `{ superpowers: [{ key, name, description, cardFields }] }` |
| PUT    | `/v1/boards/:id/superpowers/:key`      | `{ enabled }`     | `{ superpowers: [enabledKeys] }` (idempotent) |
