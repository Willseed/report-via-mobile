# auth.md

This document describes the agent registration profile for the public static Angular
PWA at https://tools.pylot.dev/. The app helps a user prepare a Taiwan traffic-violation
SMS and hand it to the user's native SMS app.

## Step 1 — Discover

Fetch the OAuth Protected Resource Metadata before using this service:

```http
GET https://tools.pylot.dev/.well-known/oauth-protected-resource
```

It identifies `https://tools.pylot.dev/` as the resource and points to the OAuth
Authorization Server metadata at:

```http
GET https://tools.pylot.dev/.well-known/oauth-authorization-server
```

The `agent_auth` block in that document is the machine-readable registration profile.

## Step 2 — Pick a method

This service supports one registration method. Pick `anonymous` because this public
resource does not have a user identity or a protected API:

- **Identity type:** `anonymous`
- **Credential type:** `none`
- **Registration URI:** `https://tools.pylot.dev/auth.md`

The `register_uri` is this read-only document. An agent must not POST an identity,
email address, API key, or OAuth token to this site. Anonymous registration means that
an agent may use the public app on a user's behalf without creating an account or
receiving a credential. The `none` credential type explicitly means that no bearer
credential is issued.

To register, read this document and then use the public browser experience at
https://tools.pylot.dev/. Ask the user to review the location, district, police station,
violation details, license plate, and generated SMS before opening the `sms:` link.

## Step 3 — Register

Read the `register_uri` and then open the public app. No POST registration request is
needed, and no identity assertion is accepted by this static service.

## Step 4 — Claim

No claim ceremony is supported because this site does not create server-side user
accounts or issue credentials. The advertised `claim_uri` is the documentation anchor
`https://tools.pylot.dev/auth.md#step-4--claim`; it is informational only and
must not be called as an API. There is no revocation endpoint because there is no
credential to revoke.

## Step 5 — Use the credential

There is no credential to present. Use the public app in a user-mediated browser
session; do not add an `Authorization` header.

## Step 6 — Handle revocation

There is no revocation operation because no credential is issued. If a future version
adds protected APIs or account-bound credentials, it must publish a real revocation URI
and update this document and both OAuth metadata documents.

## Credential use and privacy

Do not request, store, or send OAuth tokens, API keys, ID-JAGs, or user credentials for
this service. The app has no protected API or hosted MCP transport. Its bundled station
data is public. Browser geolocation permission and SMS sending remain user-mediated in
the user's browser or mobile operating system. If GPS is used, the browser sends the
coordinates to OpenStreetMap Nominatim for reverse geocoding.

The machine-readable discovery resources are:

- `/.well-known/oauth-protected-resource`
- `/.well-known/oauth-authorization-server`
- `/.well-known/api-catalog`
- `/.well-known/agent-skills/index.json`
