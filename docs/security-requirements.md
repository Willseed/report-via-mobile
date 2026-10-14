# Security Requirements

This document describes the security properties the project is trying to preserve. It complements [SECURITY.md](../SECURITY.md) by describing engineering expectations, not just reporting workflow.

## Primary requirements

1. **User-controlled sending only**  
   The app must not send SMS messages silently. It should only prepare data and hand off to the native SMS app after explicit user action.

2. **No server-side storage of report content**  
   The default deployment should remain a static, client-side application without storing user reports, phone numbers, or accounts on a project-operated backend.
   Browser `localStorage` may only hold non-sensitive UI state (currently the theme preference). Do not persist credentials, tokens, PII, location, or report drafts there. Scanner findings that flag that theme key as information disclosure are false positives.
   Keep reverse-geocoding results in page memory only. Do not add a persistent Service Worker data group for coordinate-bearing Nominatim requests.

3. **Untrusted input stays text**  
   User input, geocoding responses, and data-file content must be treated as untrusted. New features should avoid raw HTML rendering or unsafe DOM manipulation.

4. **Security-relevant changes get review and tests**  
   Changes that affect message composition, geolocation, address normalization, station lookup, dependency trust, or deployment should include tests or a documented reason why automated coverage is not practical.

5. **Automation should use least privilege**  
   GitHub Actions should keep minimal permissions, pin third-party actions where feasible, and avoid unnecessary secrets exposure.

6. **Vulnerability reporting stays private until fixed**  
   Suspected vulnerabilities should be reported using the private workflow described in [SECURITY.md](../SECURITY.md), not through public issues.

## Operational expectations

- Keep `package-lock.json` and dependencies under review.
- Keep police-station contact data traceable to public, authoritative sources.
- Review deployment, branch-protection, and repository-access settings in GitHub periodically.
- Keep `main` branch protection aligned with the required CI, E2E, and security
  workflows when workflow names or review policy change.
- Keep classic branch protection and repository rulesets consistent: require a
  CODEOWNERS approval, dismiss stale approvals, and require approval after the
  latest reviewable push. With two maintainers, one independent approval is
  feasible; requiring two would prevent maintainer-authored PRs from merging.
- Update documentation when trust boundaries or security assumptions change.
- Restrict Worker deployment to `main` in the workflow and keep the `github-pages` environment restricted to `main`. Worker deployment runs without a separate environment or manual deployment approval; the dependent Pages job must wait for Worker deployment to succeed. Store Cloudflare credentials as repository secrets and scope the token to the required Worker and zone permissions.
- Investigate any failed post-deployment Edge asset-byte or security-header check before accepting a release. A controlled staging deployment is needed to make these Edge checks a pre-production gate.

## Code scanning interpretation

The local ZAP server uses the production Worker's CSP builder and the built
HTML's script and style hashes. It rejects builds without the strict style
policy and must preserve the HTML bytes used by the PWA manifest.
The SARIF converter keeps each ZAP `alertRef` separate so a missing directive,
an unrestricted source, and inline styles do not share an incorrect description.
Both baseline and full scans retain their original reports.

Reviewed informational observations are excluded from SARIF: Modern Web
Application (`10109`, informational severity only), because both scans already
enable the Ajax spider, and localStorage (`120000-1`) only when the instance
contains exactly the `theme-preference` key and an allowed `auto`, `light`, or
`dark` value. Angular's random `ngsw-cache-bust` parameter (`10024`) is also
excluded only for `/ngsw.json`, with a matching fractional-number value and no
other query parameters. Unknown keys, values, evidence, or increased severity
remain visible. The HTTP-only finding (`10106`) is excluded only for the exact
local HTTP scan server; production HTTPS is checked by `verify-edge-deployment.mjs`.
See the [ZAP SPA guidance](https://www.zaproxy.org/docs/alerts/10109/) and
[storage guidance](https://www.zaproxy.org/docs/alerts/120000-1/).

### Strict style CSP

Production builds must use `npm run build -- --configuration production`.
After Angular finishes, the build inventories every compiled component in all
emitted JavaScript chunks, including lazy components and Material/CDK style
loaders. It evaluates instrumented temporary copies without bootstrapping the
application, then hashes the exact scoped CSS plus critical inline CSS and the
empty style element used by CDK MediaMatcher. The emitted JavaScript is unchanged.
Unexpected compilation layouts, unevaluated definitions, custom application
style scopes, or HTML style attributes fail the build rather than producing an
incomplete allowlist. Angular upgrades must pass the inventory and browser tests.

The style hash list travels with its own HTML version. Both the HTML meta policy
and the Worker response header allow only same-origin stylesheets and these
hashes, with `style-src-attr 'none'`. The build recalculates the existing
`/index.html` entry in `ngsw.json`; it never removes that integrity check or
rewrites HTML at request time. Cached pages therefore keep their matching CSP
and continue working offline. Chromium and WebKit production tests cover real
controls, lazy dialogs, and offline reload; Chromium also tests a real hash-valid
Service Worker update that waits for the user's update action.
SHA-1 in these tests matches Angular's existing asset-checksum format; it is not
used for signatures, credentials, or the CSP allowlist (which uses SHA-256).
Scanner exceptions are limited to those checksum calls and their specific rules.

For the Worker-before-Pages rollout only, the Worker retains its previous style
policy when old HTML has no style inventory metadata. Present but malformed
metadata fails closed. Newly built pages always carry the strict policy, and
both the scan harness and post-deployment checks reject `unsafe-inline`. Keep
ZAP rule `10055-6` enabled so a regression remains visible.

The following dependency finding remains open as of 2026-10-14:

- **braces (`GHSA-vfj7-8cjw-p6xm`)**: the advisory has no patched release.
  `braces@3.0.3` is a development dependency reached through Stylelint, whose
  input glob is the repository-controlled `src/**/*.scss`. It is absent from
  production dependencies, but the dependency alert stays visible until a
  supported fix is available. See the
  [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
**Scorecard review count**: branch protection enforces the review safeguards
  above, but Scorecard still recommends two approving reviewers. Raising the
  count requires another eligible maintainer; do not bypass required reviews or
  claim a maximal score while only one independent reviewer is available.

## Non-goals

This project is **not** trying to provide:

- an emergency dispatch system
- guaranteed SMS delivery or receipt confirmation
- anonymous whistleblower protections
- a backend case-management or evidence-storage platform
- perfect availability of external geolocation or reverse-geocoding services

## Known areas needing admin follow-up

Some Silver-related controls are outside the repository content itself and need
administrator action, for example:

- platform security settings such as secret-scanning enablement
