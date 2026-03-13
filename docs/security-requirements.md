# Security Requirements

This document describes the security properties the project is trying to preserve. It complements [SECURITY.md](../SECURITY.md) by describing engineering expectations, not just reporting workflow.

## Primary requirements

1. **User-controlled sending only**  
   The app must not send SMS messages silently. It should only prepare data and hand off to the native SMS app after explicit user action.

2. **No server-side storage of report content**  
   The default deployment should remain a static, client-side application without storing user reports, phone numbers, or accounts on a project-operated backend.

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
- Update documentation when trust boundaries or security assumptions change.

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
