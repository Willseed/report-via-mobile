# auth.md

This public static Angular PWA at https://tools.pylot.dev/ does not require agent
registration, OAuth/OIDC client registration, API keys, or access tokens.

There are currently no protected APIs, OAuth scopes, authorization servers, token
endpoints, server-hosted MCP transports, or server-side user accounts for agents to use.

## Agent registration

- **Audience:** Agents helping users operate the public traffic-violation SMS PWA.
- **Registration endpoint:** None.
- **Supported registration methods:** None; do not create an account or client registration.
- **Credential types:** None.
- **Credential use:** Do not request, store, or send OAuth tokens, API keys, or user credentials.

Agents may fetch the public static resources listed in `/.well-known/api-catalog`
and `/.well-known/agent-skills/index.json`. Compatible browser clients may expose
client-side WebMCP tools through `navigator.modelContext`; those tools use bundled
public data and browser APIs. Browser geolocation permission and SMS sending remain
user-mediated in the user's browser or mobile operating system.

OAuth Protected Resource Metadata is published at
`/.well-known/oauth-protected-resource` with empty `authorization_servers` and
`scopes_supported` arrays to make the no-auth requirement explicit for agents.

No `/.well-known/oauth-authorization-server` document or `agent_auth` block is published
because this service has no authorization server or agent registration flow.

If future protected APIs are added, this file and the relevant OAuth/OIDC discovery
metadata should be updated with registration steps, scopes, and authorization
server details.
