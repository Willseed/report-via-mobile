# Assurance Case

## Top-level claim

When deployed as designed, `report-via-mobile` provides a reasonably low-risk way to compose and hand off traffic-report SMS messages without operating its own data-collection backend.

## Trust boundaries

1. **User device and browser**: runs the Angular app and mediates permissions.
2. **External services**: GitHub Pages serves static assets; OpenStreetMap Nominatim provides reverse geocoding.
3. **Native SMS application / carrier**: final message sending occurs outside this repository.
4. **Repository and CI environment**: source control, reviews, builds, and deployments.

## Threat model and mitigations

| Threat | Boundary | Current mitigation | Residual risk |
| --- | --- | --- | --- |
| XSS or content injection through user input or geocoder output | Browser UI | Angular templates, project rule against raw HTML, text-based message composition, SMS body sanitization | Future unsafe DOM code could bypass this if introduced |
| Silent or unexpected message sending | Browser ↔ native SMS app | Explicit confirmation dialog before `sms:` handoff | Native SMS UX differs by platform and is outside project control |
| Privacy leakage through backend retention | App architecture | Static-site deployment; no project backend for reports or accounts | User IP/location may still be visible to Nominatim and to the mobile carrier when SMS is sent |
| Reverse-geocoding outage or rate limiting | External geocoder | Timeout, retry, circuit breaker, manual-input fallback | Auto-fill quality degrades when external services are unavailable |
| Incorrect police-station routing | Local data + address matching | Address normalization, station lookup logic, visible station selection, user preview before send | Stale public data or ambiguous addresses still require manual correction |
| CI or supply-chain tampering | Repository / Actions | Protected `main` branch requiring pull requests, one approving review, and CI / E2E / security checks; `CODEOWNERS`, pinned GitHub Actions SHAs, and lockfile-based installs | Owner-level settings continuity still follows GitHub's personal-repository model; provenance evidence remains a limitation |

## Secure design principles used here

- **Minimize retained data**: keep the app client-side and avoid storing reports.
- **Require explicit user action**: only the user completes sending in the native SMS app.
- **Fail safely**: when geocoding fails, the app falls back to manual entry instead of guessing silently.
- **Keep logic observable and testable**: address matching, message composition, and service behavior live in small Angular services with automated tests.

## Evidence currently available in-repo

- [SECURITY.md](../SECURITY.md)
- [CONTRIBUTING.md](../CONTRIBUTING.md)
- [GOVERNANCE.md](../GOVERNANCE.md)
- [docs/architecture.md](./architecture.md)
- [docs/security-requirements.md](./security-requirements.md)
- `.github/CODEOWNERS`
- GitHub Actions workflows for CI, E2E, deployment, and security scanning

## Remaining assurance gaps

The following items cannot be solved by documentation alone:

- release provenance / signing evidence is not yet documented as part of the delivery process
