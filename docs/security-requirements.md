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
- Keep both deployment environments restricted to `main`, and require maintainer review for `cloudflare-production` before the dependent Pages job can run. Store Cloudflare credentials as environment secrets and scope the token to the required Worker and zone permissions.
- Investigate any failed post-deployment Edge asset-byte or security-header check before accepting a release. A controlled staging deployment is needed to make these Edge checks a pre-production gate.

## Code scanning interpretation

The local ZAP server uses the production Worker's CSP builder and the built
HTML's script hashes. It must preserve the HTML bytes used by the PWA manifest.
The SARIF converter keeps each ZAP `alertRef` separate so a missing directive,
an unrestricted source, and inline styles do not share an incorrect description.
Both baseline and full scans retain their original reports.

Two reviewed informational observations are excluded from SARIF: Modern Web
Application (`10109`, informational severity only), because both scans already
enable the Ajax spider, and localStorage (`120000-1`) only when the instance
contains exactly the `theme-preference` key and an allowed `auto`, `light`, or
`dark` value. Unknown keys, values, evidence, or increased severity remain visible.
See the [ZAP SPA guidance](https://www.zaproxy.org/docs/alerts/10109/) and
[storage guidance](https://www.zaproxy.org/docs/alerts/120000-1/).

The following findings remain open as of 2026-10-14:

- **Inline styles (`10055-6`)**: Angular and Material insert runtime styles, so
  `style-src` currently permits inline styles. Script sources remain restricted
  to the built hashes and same origin, and inline event handlers are blocked.
  Removing this allowance needs a separate style/nonce design compatible with
  PWA asset integrity; do not ignore all CSP findings to hide it.
- **braces (`GHSA-vfj7-8cjw-p6xm`)**: the advisory has no patched release.
  `braces@3.0.3` is a development dependency reached through Stylelint, whose
  input glob is the repository-controlled `src/**/*.scss`. It is absent from
  production dependencies, but the dependency alert stays visible until a
  supported fix is available. See the
  [upstream advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- **Scorecard review count**: branch protection enforces the review safeguards
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
