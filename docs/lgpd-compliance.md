# Brazilian legal compliance (LGPD, Marco Civil, CDC)

> **Disclaimer.** This document records the technical and product measures implemented in the code
> base to comply with Brazilian law. It is not legal advice. The legal texts shown to users
> (`apps/web/src/features/legal/LegalPages.tsx`) are a solid starting point, but **should be reviewed
> by a lawyer** before the service is offered to the public, especially if it will be commercial.

## Laws considered

| Law | Relevance |
| --- | --------- |
| **Lei nº 13.709/2018 (LGPD)** | Personal data processing: legal bases, transparency, data subject rights, security, international transfer |
| **Lei nº 12.965/2014 (Marco Civil da Internet)** | Retention of access logs (art. 15), privacy and inviolability of communications (art. 7) |
| **Lei nº 8.078/1990 (CDC)** | Clear terms, no abusive clauses (relevant if offered as a paid service) |
| **Lei nº 9.610/1998 (Direitos Autorais)** | File uploads are intentionally **not supported**, removing the main copyright/illegal-content hosting risk |

## LGPD checklist

| Requirement | Implementation |
| ----------- | -------------- |
| Transparency (arts. 6, VI; 9) | Privacy Policy page (`/privacy`) in clear pt-BR: data collected, purposes, legal bases, sharing, retention, rights, controller contact (`VITE_CONTACT_EMAIL`) |
| Legal basis (art. 7) | Contract execution (account and service), legitimate interest (security, anti-abuse), legal obligation (access logs). Documented in the policy |
| Consent record | Sign-up requires an explicit, unchecked-by-default checkbox for the Terms and Privacy Policy; the API rejects registration otherwise (`terms_not_accepted`) and stores `terms_version` + `terms_accepted_at` |
| Minimisation (art. 6, III) | Only name, e-mail and password hash are required. No phone, document numbers, location, analytics or advertising identifiers |
| Access and portability (art. 18, II, V) | `GET /v1/me/export` + “Baixar meus dados” in the account page: structured JSON with all personal data and content (never secrets) |
| Rectification (art. 18, III) | Profile page (`PATCH /v1/me`) |
| Erasure (art. 18, VI) | “Excluir minha conta” (`DELETE /v1/me`, password confirmed). Database cascades delete the account, sessions, boards, lists, cards and settings in one statement |
| Revocation / information about sharing (art. 18, IX, VII) | Policy lists every operator (Railway, Vercel, Resend); deleting the account revokes everything |
| Security (arts. 46–49) | See [security.md](security.md): Argon2id, TLS, token hashing, rate limiting, ownership checks, security headers |
| International transfer (art. 33) | Operators may process data abroad; disclosed in the policy. Prefer Railway/Vercel/Resend regions close to Brazil when possible and keep their DPAs on file |
| Children (art. 14) | Service is for 18+; stated in the Terms and Privacy Policy. No intentional collection from minors |
| Incident response (art. 48) | Process in [SECURITY.md](../SECURITY.md); notify ANPD and affected users when an incident may cause relevant risk |
| Records of processing (art. 37) | This document + the data map below |
| Data protection officer (art. 41) | The controller is an individual maintainer; publish a contact channel (`VITE_CONTACT_EMAIL`). Appoint a DPO if the service scales commercially |

## Data map

| Data | Where | Purpose | Retention |
| ---- | ----- | ------- | --------- |
| Name, e-mail | `users` | Identify the account, send transactional e-mail | Until account deletion |
| Password hash (Argon2id) | `users` | Authentication | Until account deletion |
| Terms version and timestamp | `users` | Prove consent | Until account deletion |
| Failed-login counter / lock time | `users` | Anti brute-force | Cleared on success/reset |
| Refresh-token digests | `refresh_tokens` | Keep the session | 30 days max; revoked on logout/reset |
| Reset-token digests | `password_reset_tokens` | Password recovery | 1 hour; single use |
| Boards, lists, cards | `boards`, `lists`, `cards` | The service itself | Until deleted by the user or account deletion |
| IP address, timestamp, route | Platform request logs (Railway/Vercel) | Security, abuse prevention, Marco Civil art. 15 | **6 months** (configure the log retention of the hosting platform accordingly) |

The API request log (stdout, collected by Railway) contains method, URL, status, latency and the
client IP. It never contains request bodies, passwords, tokens or cookies (`Authorization`,
`Cookie` and `Set-Cookie` are redacted). Query strings carry no personal data by design: the
password-reset token travels in the URL fragment, which browsers never send to servers.

## Cookies

Only one cookie is set: `kz_refresh` (HttpOnly, Secure, SameSite=Strict, path `/v1/auth`). It is
strictly necessary for authentication, so under the ANPD cookie guidance it does not require a
consent banner, but it **is** disclosed in the policy. If analytics or marketing cookies are ever
added, a consent banner with granular opt-in becomes mandatory.

## Marco Civil da Internet

Art. 15 obliges *internet application providers that carry out an organised, professional activity
with economic ends* to keep access logs for 6 months. Even for a non-commercial project, keeping the
platform’s request logs for 6 months is recommended and is what the Privacy Policy declares.
Content of private communications is never accessed or disclosed except by court order (art. 10).

## Operational checklist before going public

- [ ] Set `VITE_CONTACT_EMAIL` (Vercel) so the policy shows a real contact address
- [ ] Have the Terms and Privacy Policy reviewed by a lawyer
- [ ] Confirm log retention on Railway/Vercel is at least 6 months (or export logs)
- [ ] Sign/store the DPAs of Railway, Vercel and Resend
- [ ] Configure SPF/DKIM/DMARC on the sending domain
- [ ] Decide who answers data-subject requests and within what time (LGPD: 15 days for a complete declaration)
- [ ] Bump `CURRENT_TERMS_VERSION` in `apps/api/src/modules/identity/domain/user.ts` and the “last update” date in the legal pages whenever the texts change materially
