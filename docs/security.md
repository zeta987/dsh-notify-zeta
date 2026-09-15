# Security and data boundaries

The notification plugin runs with the permissions of its DSH host. Review the
source and use a DSH version matching the documented compatibility matrix.

## Data handling

- Windows cards receive JSON over parent/child process pipes. No local answer
  HTTP server or downloaded native executable is used by the helper.
- The web notification center uses DSH authentication. Mutations additionally
  require an explicit same-origin POST with bounded JSON input.
- Answers are matched to the active session, original agent instance, request
  ID and random token. Cancelled, replaced, stale and duplicate answers fail.
- Approval cards only offer a one-time decision. If the exact operation cannot
  be resolved, the request is delegated to DSH's standard approval interface.
- General notification previews can be hidden. Interactive cards keep the
  request details visible so the user can make an informed decision.
- Settings are stored in the active profile. Notification history is bounded
  and in memory; answer text is not copied into that history.
- The plugin has no telemetry, webhook or external push service. This does not
  describe network behavior of DSH itself or other installed plugins.

## Reporting a concern

Use the repository's security reporting channel when available, or open an
issue containing only a non-sensitive description. Never post real credentials,
private conversation logs, active request tokens or unredacted screenshots.

Tests and code review reduce risk; they are not a guarantee that all defects or
security vulnerabilities have been eliminated.
