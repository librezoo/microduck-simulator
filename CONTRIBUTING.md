# Contributing

Thank you for contributing to the MicroZoo simulator.

## Development workflow

1. Create a focused branch and keep changes small and independently reviewable.
2. Use [Conventional Commits](https://www.conventionalcommits.org/) for every
   commit, for example `fix(mobile): preserve controls after rotation`.
3. Sign commits with the contributor's configured Git signing identity.
4. Run the relevant checks before requesting review:

   ```bash
   cd app
   npm ci
   npm test
   npm run build
   ```

5. Describe behavior changes, tests, device/browser coverage, and any remaining
   limitation in the pull request.

Do not weaken authentication, path validation, data-protection controls, safe
runtime fallbacks, or another existing security boundary without a documented
threat analysis and maintainer review.

## Developer Certificate of Origin

This project uses the Developer Certificate of Origin 1.1 (DCO). Add a
`Signed-off-by` trailer to every commit:

```text
Signed-off-by: Your Name <your-email@example.com>
```

By adding that trailer, you certify that you have the right to submit the
contribution under the project's licenses, as described at
<https://developercertificate.org/>. Use `git commit -s` to add it.

## Assets, models, and generated media

Do not contribute downloaded images, audio, fonts, 3D models, trained weights,
motion captures, datasets, logos, or generated media without a reviewable
rights record. A contribution containing such material must include:

- the exact file paths and creator or rights holder;
- the canonical source URL and immutable source revision when available;
- the full license name and version, plus a copy of custom permission;
- the original download date and a description of every transformation;
- confirmation that redistribution of source and binary/App forms is allowed;
- for generated media, the tool, date, prompt/reference disclosure, and the
  contributor's basis for granting the submitted license; and
- an update to `ASSET_LICENSES.md` and any user-facing attribution.

Do not submit assets restricted to non-commercial use, standalone-use bans, or
terms incompatible with downstream commercial reuse as part of the
Apache-2.0-covered work. A maintainer may accept a clearly isolated exception
only when its separate terms are documented and the distribution is not
described as wholly open source.

## Dependency changes

Include the package-lock change, upstream project link, license identifier, and
security rationale for a new dependency. Update `THIRD_PARTY_NOTICES.md` and the
offline legal bundle when its code or data ships to users. Copyleft, source-
availability, patent, or field-of-use restrictions require maintainer review.

## Security reports

Do not disclose a suspected vulnerability in a public issue. Follow
`SECURITY.md` so maintainers can coordinate a fix and disclosure.
