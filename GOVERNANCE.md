# Governance

## Project model

`report-via-mobile` is currently a **maintainer-led** project. It does not have a formal steering committee or foundation-owned governance body.

Today, the primary repository owner and admin maintainer is `@Willseed`.
Repository access also currently includes `@SayMyNameTW` with write permission, and
`.github/CODEOWNERS` documents that account as a secondary code owner / reviewer for
pull-request continuity.

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

Additional maintainers may be added over time. Review continuity is now shared by the
documented code owners, but a second admin- or maintain-level maintainer is still not
documented. When that changes, this file and `.github/CODEOWNERS` should be updated so
responsibilities are visible in-repo.

## How decisions are made

- Most work should start in an issue or pull request.
- Technical decisions are made by maintainers after considering review feedback, security impact, and project scope.
- When consensus is unclear, the maintainer makes the final decision.

## Review and release expectations

- Code review should follow `CODEOWNERS` and relevant CI results.
- Changes are expected to merge through pull requests, not undocumented direct pushes.
- GitHub `main` protection now enforces pull-request merges with one approving review,
  dismissal of stale approvals, and the required checks `build / build`, `e2e`,
  `Codacy Analysis`, and `分析程式碼`.
- While `main` branch protection is not enforcing `require_code_owner_reviews`
  automatically, maintainers should make sure the approving review also satisfies the
  documented code-owner policy.
- Production deployment is automated from `main` through GitHub Actions after build and test steps complete.

## Continuity and access note

This repository no longer has a single documented code owner:
`.github/CODEOWNERS` now names both `@Willseed` and `@SayMyNameTW` for review coverage.
That reduces single-reviewer risk and provides a documented backup reviewer for normal
pull-request flow.

Because this repository is hosted under a personal GitHub account, collaborators do not
receive owner-equivalent admin control over branch protection, Pages settings, or
repository ownership. If shared owner-level settings continuity is ever required, it
would need a repository transfer or ownership change rather than a role change inside
this repository.

Maintainers should periodically review who has collaborator access, who is listed in
`CODEOWNERS`, and whether the personal-repository ownership model is still appropriate
for the project.
