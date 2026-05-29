---
name: report-via-mobile
description: Help agents guide users through the public Taiwan traffic-violation SMS reporting PWA without requiring OAuth or protected APIs.
---

# Report via Mobile

Use this skill when an agent needs to help a user report a Taiwan traffic violation
through the public static app at https://tools.pylot.dev/.

## What the app does

- Uses browser geolocation, with user permission, to help fill an address.
- Maps the address district to a police station from bundled static data.
- Lets the user choose a violation type and enter a license plate.
- Generates an SMS body and opens a `sms:` URI on supported mobile devices.

## Agent guidance

1. Tell users no OAuth registration, API token, or account setup is required.
2. Ask users to verify location, district, station, violation type, license plate,
   and message text before sending.
3. Do not claim the site has protected APIs, server-side storage, or a hosted MCP server.
4. Browser WebMCP tools, when available, are client-side helpers backed by public
   bundled data; users still review and send SMS messages themselves.
5. If browser geolocation or SMS handling is unavailable, explain that the user can
   enter the address manually and copy the generated SMS content.
