# Governance

## Project model

`report-via-mobile` is currently a **maintainer-led** project. It does not have a formal steering committee or foundation-owned governance body.

Today, the primary repository owner and code owner is `@Willseed`.

## Roles and responsibilities

### Maintainer / repository owner

The maintainer is responsible for:

- setting project direction and release priorities
- reviewing and merging contributions
- maintaining repository settings, GitHub Actions, and Pages deployment
- triaging bugs and security reports
- keeping contribution, governance, and security documentation current

### Contributors

Contributors are expected to:

- follow [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- follow [CONTRIBUTING.md](./CONTRIBUTING.md)
- provide focused changes with appropriate tests and rationale
- avoid public disclosure of unpatched vulnerabilities

### Future maintainers

Additional maintainers may be added over time. When that happens, this file and `.github/CODEOWNERS` should be updated so responsibilities are visible in-repo.

## How decisions are made

- Most work should start in an issue or pull request.
- Technical decisions are made by maintainers after considering review feedback, security impact, and project scope.
- When consensus is unclear, the maintainer makes the final decision.

## Review and release expectations

- Code review should follow `CODEOWNERS` and relevant CI results.
- Changes are expected to merge through pull requests, not undocumented direct pushes.
- Production deployment is automated from `main` through GitHub Actions after build and test steps complete.

## Continuity and access note

This repository currently has a **single active maintainer and a single documented code owner**. That is a real continuity and resiliency limitation.

Known gaps that require repository-admin or organizational follow-up:

- appoint at least one additional maintainer with enough access to review and recover the project if needed
- ensure branch protection and required status checks reflect the documented review policy
- periodically review who has administrative access to the repository and Pages deployment

Until those actions are completed, continuity depends heavily on the availability of the current owner account.
