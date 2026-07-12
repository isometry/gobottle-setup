# gobottle-setup

GitHub Action installing [gobottle](https://github.com/isometry/gobottle)
from its GitHub release binaries — no Go toolchain, no compilation. Every
binary is validated before use: SHA256 checksum against the release's
`SHA256SUMS`, plus GitHub-native SLSA build provenance via
`gh attestation verify`.

## Usage

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - uses: isometry/gobottle-setup@v1

      - run: gobottle release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          # optional: dedicated token for the tap commit; falls back to
          # GITHUB_TOKEN when unset
          GOBOTTLE_TAP_TOKEN: ${{ secrets.HOMEBREW_TAP_GITHUB_TOKEN }}
```

## Inputs

| Input        | Default             | Description                                                    |
| ------------ | ------------------- | -------------------------------------------------------------- |
| `version`    | `latest`            | Version to install (see [pinning](#version-pinning))           |
| `repository` | `isometry/gobottle` | Repository to install from                                     |
| `token`      | `${{ github.token }}` | Token for API access, downloads, and attestation verification |
| `verify`     | `true`              | Verify SLSA build provenance (checksums are always enforced)   |

## Outputs

| Output      | Description                                        |
| ----------- | -------------------------------------------------- |
| `version`   | Resolved version that was installed (no `v` prefix) |
| `path`      | Directory containing the `gobottle` binary          |
| `cache-hit` | Whether the binary came from the runner tool cache  |

## Version pinning

- `latest` — the latest stable release (default)
- `1.2.3` / `v1.2.3` — exact pin; prereleases (`1.3.0-rc.1`) only install
  when pinned exactly
- `1` / `1.2` — newest matching **stable** release

## Verification

The downloaded archive is always checked against the release's
`SHA256SUMS`. With `verify: true` (the default) its SLSA build provenance
is additionally verified with
[`gh attestation verify`](https://cli.github.com/manual/gh_attestation_verify),
proving it was built by the release workflow of the source repository.
`verify: false` skips only the provenance step — for runners without the
`gh` CLI (it is preinstalled on GitHub-hosted runners).

## Platforms

Linux and macOS runners on amd64/arm64 — matching the gobottle release
matrix.
