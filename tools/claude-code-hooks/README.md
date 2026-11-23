# Claude Code → Kanbanzin session tracker

Mirrors every Claude Code session as a card on a Kanbanzin board, so one glance shows which
sessions are waiting for you and which are done. Plain Node (no dependencies), cross-platform.

| Claude Code event | Card goes to | Notes |
| --- | --- | --- |
| `SessionStart` | **Nova** | Also tells Claude its card id (see below) |
| `UserPromptSubmit` | **Trabalhando** | First prompt becomes a short title |
| `Stop`, `Notification` (permission / idle / needs input) | **Aguardando você** | Description gets the last paragraph of Claude's reply |
| `PostToolUse` | **Trabalhando** | Only after you approved something while it was waiting |
| `SessionEnd` | unchanged | Description notes the session ended |

The lists and the board (default `Sessões Claude Code`) are created on first use.

## Getting to "Concluídas"

Both ways work together:

1. **Claude decides.** At session start the hook injects the card id and the id of the
   `Concluídas` list into Claude's context and asks it to call the Kanbanzin MCP tool `move_card`
   when everything you asked is done. This needs the MCP server registered (see
   [docs/mcp.md](../../docs/mcp.md)).
2. **You decide.** Drag the card to `Concluídas` yourself, or drag it back if Claude was premature.

The script never moves a card out of `Concluídas` on its own. Sending a new prompt in that session
reopens it (`Trabalhando`).

## Short by design

Cards only track progress, so nothing long is stored: the title is the first line of your first
prompt cut to about 70 characters, and the detail is the last paragraph of Claude's reply cut to
about 200. No model call is involved. Claude may replace the title with a better summary through
`update_card`. Set `KANBANZIN_EXCERPT=0` to drop the reply excerpt entirely.

## Setup

1. Create a personal access token on the account page of Kanbanzin.
2. Save `~/.kanbanzin/config.json` (`%USERPROFILE%\.kanbanzin\config.json` on Windows):

   ```json
   { "apiUrl": "https://api.kanbanzin.fabiobandacheski.com", "token": "kbz_...", "board": "Sessões Claude Code" }
   ```

   Environment variables `KANBANZIN_API_URL`, `KANBANZIN_TOKEN`, `KANBANZIN_BOARD` override the file.
3. Print the hook settings with the right absolute path and merge them into
   `~/.claude/settings.json`:

   ```powershell
   node tools/claude-code-hooks/kanbanzin-hook.mjs --print-settings
   ```

## Behaviour you can rely on

- **Never breaks a session.** Every failure exits 0 silently. Set `KANBANZIN_DEBUG=1` to see why a
  hook did nothing.
- **API down?** A failed request pauses all calls for 60 seconds, so a dead API costs at most one
  short timeout (2.5 s, `KANBANZIN_TIMEOUT_MS`) per minute.
- `SessionStart` and `UserPromptSubmit` run synchronously (about 0.3 s); `Stop`, `Notification`
  and `PostToolUse` run in the background (`async`).
- Per-session state lives in `~/.kanbanzin/sessions/` and is pruned after 30 days.
- Deleting the card or a list in Kanbanzin is fine: the next event recreates what is missing.

## Privacy

Card titles and the reply excerpt come from your prompts and Claude's replies and are sent to your
own Kanbanzin API. Avoid pasting secrets into the first line of a prompt, or turn the excerpt off.

## Tests

```powershell
node --test "tools/claude-code-hooks/*.test.mjs"
```
