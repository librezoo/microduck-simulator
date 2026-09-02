# Security policy

## Supported versions

Security fixes are developed for the latest revision of the default branch.
Older commits, forks, and unofficial application builds are not guaranteed to
receive fixes.

## Reporting a vulnerability

Use GitHub's **Report a vulnerability** / private security-advisory workflow for
this repository. If that option is unavailable, contact a maintainer privately
through the organization before opening a public issue. Do not include secrets,
personal data, working exploits against third parties, or identifying peer
telemetry in a public report.

Please include:

- affected revision and platform;
- reproduction steps and expected impact;
- whether the issue affects the local asset scheme, WebAssembly/ONNX loading,
  WebRTC/Nostr multiplayer, external-link handling, or the native iOS host;
- a minimal proof of concept, if it can be shared safely; and
- any known mitigation.

Maintainers will acknowledge the report when available, assess severity, and
coordinate a disclosure after a fix or mitigation is ready. No response or
resolution deadline is promised by this volunteer project.

## Scope notes

The simulator is not a safety controller for a physical robot. A simulator
result must not be used to bypass the real robot's safety systems. Reports
about upstream Apple, WebKit, browser, MuJoCo, ONNX Runtime, Nostr relay, or
operating-system vulnerabilities should also be sent to the responsible
upstream security channel.
