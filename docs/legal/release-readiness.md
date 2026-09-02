# Release readiness and unresolved rights

Last reviewed: 2026-09-03

This is a current evidence record, not legal advice. It separates engineering
remediation from rights or platform decisions that cannot be created by a code
change. The current repositories are suitable for continued private
development and review, but they are **not yet cleared for a new public source
release, public binary distribution, or App Store submission**.

## Completed in the current tree

- The repositories declare Apache-2.0 for project-authored source and require
  DCO sign-off for new contributions.
- Legacy brand art, stickers, prop models, ball textures, two restricted room
  models, an unverified run policy, and an unverified WBC bundle have original
  or programmatic replacements and are excluded from current builds.
- Each retained CC BY 4.0 room has creator, source, license, and modification
  attribution in both source and installed-app notices.
- Production dependency notices, ONNX Runtime notices, and the libraries
  linked into MuJoCo WASM accompany web and iOS builds.
- The iOS reference build packages no public-multiplayer networking chunk,
  declares no collection or tracking, and includes the required-reason API
  entry for local file metadata.
- CI tests the simulator and inspects the final `.app` for required legal files
  and removed assets.

## Rights and release blockers

### 1. Pollen robot model

`app/public/robot/mjlab/**` remains `PENDING` in `ASSET_LICENSES.md`. Current
evidence says only "Creative Commons BY-SA-NC" without an exact license version
or a file-by-file derivation record. Obtain written permission or the exact
source and terms before distribution. If the governing terms are noncommercial,
the complete product cannot be represented as OSI open source and cannot be
commercially distributed on that basis.

### 2. Existing public Git history

Deleted legacy assets remain reachable in earlier commits of the configured
public repository. A normal removal commit does not remove those objects from
Git history. Before redistributing that history, either obtain permission for
every historical asset or coordinate a clean repository/history rewrite and
replacement of published clones. No history rewrite or force push has been
performed by this remediation.

### 3. Earlier code contributions

The existing history contains multiple contributor identities and did not
previously contain a project license or contributor agreement. Adding
Apache-2.0 now can license only copyrights held by people who authorize it. The
maintainer must obtain explicit Apache-2.0 ratification from the relevant prior
rights holders or replace the affected code with independently authorized work.
The DCO process in `CONTRIBUTING.md` addresses future submissions only.

### 4. Product and publisher names

A preliminary registry screen found live `MICRO ZOO` registrations in relevant
toy categories, including [US registration 5765694 / serial
88072647](https://tsdr.uspto.gov/statusview/sn88072647) and [EU trade mark
018019871](https://euipo.europa.eu/eSearch/#details/trademarks/018019871).
That is a release red flag, not a final infringement opinion. Do not publish
under `MicroZoo` until the publisher has documented rights, permission, or
jurisdiction-specific counsel clearance. `Zoo Kinder` also requires a proper
clearance search; a preliminary no-exact-hit search is not legal clearance.

### 5. Publisher operations and platform declarations

Before a public app release, record the actual publishing legal entity and a
monitored privacy/legal contact, adopt an accurate public privacy-policy URL,
complete App Store privacy and age-rating answers, reassess Kids Category and
parental-gate requirements, and confirm the reference build's export-compliance
answer. Any restored networking, telemetry, accounts, or third-party SDKs
requires a new data-flow, privacy-manifest, and encryption review.

## Maintainer decision needed

The next irreversible actions are intentionally not automated: selecting or
clearing the publisher name, collecting contributor/model permissions, and
rewriting or replacing public Git history. Those actions affect third parties
and published clones and require an explicit maintainer decision.
