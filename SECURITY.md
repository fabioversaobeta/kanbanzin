# Security policy

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub’s private reporting: **Security → Report a vulnerability** on the repository page
(<https://github.com/fabioversaobeta/kanbanzin/security/advisories/new>). Include a description,
reproduction steps and the impact. You will receive an acknowledgement within 3 business days and
we will keep you informed until it is fixed. We credit reporters who wish to be named.

## Scope

In scope: the API (`apps/api`), the web app (`apps/web`) and their configuration in this repository
(authentication, sessions, authorization, injection, XSS/CSRF, data exposure, rate-limit bypass).
Out of scope: denial of service by volume, social engineering, third-party platforms (Railway,
Vercel, Resend) and findings that require a compromised device.

## Supported versions

Only the latest commit on `main` (the deployed version) receives security fixes.

## Incident handling and personal data

If an incident may expose personal data, the maintainer will: contain and fix it, assess the risk to
data subjects, and — when the risk is relevant — notify the affected users and the Brazilian data
protection authority (ANPD) as required by LGPD art. 48. See
[docs/lgpd-compliance.md](docs/lgpd-compliance.md).

## Design overview

See [docs/security.md](docs/security.md) for the implemented controls and known trade-offs.
