# Kanbanzin documentation

| Document | Read it to… |
| -------- | ----------- |
| [architecture.md](architecture.md) | Understand the layers, modules, data model and request flow |
| [api.md](api.md) | Integrate with or test the HTTP API |
| [security.md](security.md) | See the threat model, controls and operational guidance |
| [lgpd-compliance.md](lgpd-compliance.md) | Review how Brazilian law (LGPD, Marco Civil, CDC) is addressed |
| [superpowers.md](superpowers.md) | Use or add per-board “superpowers” (plugins) |
| [deployment.md](deployment.md) | Deploy to Railway + Vercel with your own domain, configure Resend |
| [development.md](development.md) | Run, test and contribute locally |
| [adr/](adr) | Read the reasoning behind the key technical decisions |

Architecture Decision Records:

- [ADR-0001](adr/0001-independent-apps-monorepo.md) — One repository, two independent apps
- [ADR-0002](adr/0002-session-strategy.md) — In-memory access token + rotating HttpOnly refresh cookie
- [ADR-0003](adr/0003-fractional-ordering.md) — Fractional positions for ordering
- [ADR-0004](adr/0004-pglite-for-tests.md) — PGlite for tests and local development
