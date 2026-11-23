# MCP server

The API exposes a [Model Context Protocol](https://modelcontextprotocol.io) endpoint so agents such as
Claude Code can orchestrate boards, lists and cards.

- **Endpoint:** `POST /mcp` (Streamable HTTP, stateless, JSON responses)
- **Auth:** `Authorization: Bearer kbz_...` with a personal access token
- **Scope:** the token's owner only; the tools call the same use cases as the HTTP API, so
  ownership checks and limits are identical

## Connect Claude Code

1. Create a token (`POST /v1/me/tokens` with a session, or from the account page once available).
   The secret is shown **once**; it expires after 90 days by default (max 365) and can be revoked.
2. Register the server:

```powershell
claude mcp add --transport http kanbanzin https://api.kanbanzin.fabiobandacheski.com/mcp --header "Authorization: Bearer kbz_YOUR_TOKEN"
```

For local development, use `http://localhost:3000/mcp`.

## Tools

| Tool | Purpose |
| ---- | ------- |
| `list_boards`, `get_board` | Read boards, with lists and cards and their ids |
| `create_board`, `update_board` | Create, rename, recolor |
| `create_list`, `rename_list`, `move_list` | Manage lists |
| `archive_list_cards` | Archive all cards of a list |
| `create_card`, `update_card`, `move_card`, `delete_card` | Manage cards (`create_card` can also set description, due date and labels) |
| `set_board_superpower` | Enable `due-dates` / `color-labels` |

Deleting boards and lists is intentionally **not** exposed.

## Security notes

- Tokens are stored as SHA-256 digests only and are never shown again after creation.
- Personal tokens work on board routes and `/mcp`; account routes (`/v1/me/*`, including token
  management) accept real sessions only, so a leaked token cannot mint tokens or change the account.
- Treat the token like a password: it grants full access to your boards until it expires or is revoked.
