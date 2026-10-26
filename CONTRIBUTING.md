# Contributing

Thanks for helping improve Kanbanzin! Everything (code, comments, commits, issues, PRs, docs) is
written in **English**; end-user copy in the app is pt-BR.

## Workflow

1. Create a branch from `main`: `feat/<short-name>`, `fix/<short-name>`, `docs/<short-name>`…
2. Make focused commits using [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(api): add checklist superpower`, `fix(web): keep draft when closing the card dialog`.
3. Run the checks locally: `npm run lint && npm run typecheck && npm test`.
4. Open a Pull Request using the template. Explain *what* and *why*, and how to test it.
5. CI must be green and the PR approved before merging. Prefer squash merges with a clear title.

`main` is always deployable; merging deploys it.

## Standards

- **Architecture**: respect the layers (domain → application → infrastructure → interface). Business
  rules belong in the domain/application layers, never in routes or React components. See
  [docs/architecture.md](docs/architecture.md).
- **Clean code**: small functions, intention-revealing names, no dead code, no commented-out code.
- **Tests**: every behaviour change comes with tests (unit for rules, integration for HTTP/DB).
  Bug fixes start with a failing test.
- **Security and privacy**: validate all input, keep ownership checks in queries, never log secrets
  or personal data, and mention any new personal data in the PR (it affects the Privacy Policy and
  [docs/lgpd-compliance.md](docs/lgpd-compliance.md)).
- **Migrations**: generate with `npm run db:generate`, review the SQL, keep them backwards
  compatible.
- **Docs**: update `README.md` and `docs/` when behaviour, configuration or architecture changes.

## Adding a superpower

Follow [docs/superpowers.md](docs/superpowers.md).

## Reporting bugs and vulnerabilities

Open an issue with steps to reproduce for regular bugs. For security issues, **do not open a public
issue**; follow [SECURITY.md](SECURITY.md).
