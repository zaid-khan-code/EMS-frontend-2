# ERP-to-PMS handoff verification - 2026-10-07

Status: approved bounded handoff implemented; private live integration QA remains pending.

## Delivered flow

1. EMS Launchpad validates the absolute configured PMS URL (HTTPS; HTTP only on loopback; no credentials/query/fragment). It opens a child synchronously, retains its handle, and waits for validated readiness before requesting the existing authenticated POST /api/auth/project-management/token.
2. PMS EMS-mode startup announces versioned pms:ready with a cryptographically random 32-byte challenge. Both sides check exact configured origin and exact opener/child source, with strict message schemas.
3. EMS delivers the bounded signed-token value only to that child origin and matching challenge. One provider request is allowed per attempt; a StrictMode restart can replace the pending challenge. No token is put in URLs, browser storage or logs.
4. PMS consumes the challenge and detaches its listener before calling the existing same-origin session exchange. Existing backend signature, organization, claims and fresh grant checks remain authoritative. A new opener launch exchanges its current ERP identity BEFORE accepting any old PMS cookie, preventing account-switch confusion.
5. Timeout (30 seconds), abort/unmount, cancellation and failure clean up listeners and discard late responses. Popup/configuration/provider failures give sanitized guidance. Successful logout suppresses automatic re-handoff; retry checks the current session. Existing demo selection stays unchanged.

## Verification

- Test-first receiver/launcher wiring and account-switch regression were observed failing before their implementations/fix, then passing.
- Full PMS default suite: 187 passed, 70 opt-in skipped; backend build and frontend typecheck/production build passed. Runner used two workers and a 15-second test allowance after concurrent-suite resource contention; no product assertions weakened.
- Full EMS frontend suite: 127 passed; production build passed. Existing jsdom preflight/React Router/Browserslist warnings remain. EMS whole-project typecheck was not run.
- Final focused rerun: PMS 11 passed; EMS frontend 9 passed.
- Browser: real localhost:8080 ERP opener to localhost:3000 PMS child, actual launcher/receiver/resource and React StrictMode; identity HTTP APIs mocked with a fictional identity. Workspace displayed Handoff QA Employee / QA001; project-read denial remained enforced; logout and Check access again stayed signed out. Parent showed handoff sent. Child URL contained no token. Screenshot: artifacts/ems-handoff-browser-20261007.png. Temporary harness files removed.
- Fresh reviewer identified the stale-cookie account-switch bug, corrected with a failing-then-passing regression test. Review then hit a usage limit; no complete independent clean-review claim is made. Remaining sender/receiver/session paths inspected manually.
- Staged secret-pattern and whitespace checks gate both repository commits. Scanner reports paths/rules only and is a targeted check, not proof that every possible secret pattern is covered.

## Deployment and remaining work

Configure non-secret PMS VITE_PMS_SESSION_MODE=ems and exact VITE_ERP_ORIGIN; configure EMS VITE_PROJECT_MANAGEMENT_URL as its absolute trusted PMS URL. Backend private runtime configuration remains external to Git. Production uses HTTPS and secure cookies. Deployment headers must allow the intended opener relationship; popup blocking or opener isolation fails closed, never weakens headers automatically.

11/12 integration implementation groups delivered; this is a checklist count, not a production-readiness percentage. Remaining group: privately provisioned EMS/PMS environment, permission catalog/database readiness, explicit employee grants, and actual signed-token/cookie/gRPC/browser verification. No live mode, migration or global grants were enabled in this slice.

The browser challenge binds delivery to a window/attempt; it is NOT server-side JWT replay protection. Authorization-code/PKCE, independently revocable PMS sessions, new token lifetime policy and authenticated realtime remain deferred. No new dependency, DB table, login/signup rewrite, or credential file.

## 2026-10-09 - Live reload handoff repair

Authenticated local browser QA exposed a reproducible reload failure: the EMS sender removed its child listener after initial token delivery, while PMS correctly requested fresh opener identity on reload. The regression first failed because only one identity was sent. Keep the exact-source/exact-origin/schema-validated listener for the launched child, request a fresh EMS token for each new challenge, suppress duplicate completed challenges and concurrent requests, bound each request to the existing 30-second deadline, and release the listener on child closure, cancellation, identity/role changes or launch replacement. Tokens remain request-local and never enter URLs or storage. No ordinary authentication module, grant catalog or backend contract changed.

Browser proof against real EMS PostgreSQL and TLS gRPC: signed-in Launchpad opened PMS; the PMS child reloaded and returned to the authenticated portfolio; the saved QA project and Done issue persisted. Seven launcher tests passed, including reload, revocation, source/origin rejection, late-token cancellation and closed-child cleanup. Frontend production build passed. Initial full suite ran concurrently with the build and had two existing EmployeeDetail 5-second timeouts (128 passed). A sequential rerun with --maxWorkers=2 --testTimeout=15000 passed all 130 tests across 38 files. Existing React Router/Browserslist and mocked-page preflight warnings remain; no unrelated test or product behavior was changed to hide them. Hosted gRPC and ordinary EMS role grants remain pending.
