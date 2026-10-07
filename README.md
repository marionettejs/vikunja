# Vikunja — Marionette v5 RC2 migration

This repository is the Marionette organization’s independent migration of [Vikunja](https://github.com/go-vikunja/vikunja), the open-source task manager. Thank you to the Vikunja maintainers and contributors for making this application open source and for the work behind its features, design and documentation. Please consider [supporting Vikunja](https://vikunja.io/support/).

The goal is to replace the Vue frontend with **Marionette 5.0.0-rc.2**, while preserving Vikunja’s appearance and user-visible behavior. The Go backend, upstream assets, translations, models and services are retained where reusable. This is an experimental migration and development case study, independent of the upstream project; upstream endorsement is not implied.

## Migration status

The current RC2 implementation contains no Vue runtime, imports or dependencies in its shipped frontend. This is not a completion claim. The final frozen checkpoint passed 775 unit tests, 24 paired six-surface cases and 40 paired notice cases, with development/production graph audits. The full regression passed 477 of 480 cases, with exactly three preserved baseline failures (bot re-enable and two mobile rich-task bottom markers), zero skipped/flaky and no new failures. Fresh matched three-build n20 measurements passed both datasets; see [results and limits](migration/rc2-publication-measurements-20261007.md). Publication uses pinned Vikunja baseline `5d22d730`, intentionally replacing newer fork-main file changes; existing main was preserved and verified under `backup/upstream-main-before-rc2-20261007`, then reviewed snapshot `e32efc1d` was published with an exact-SHA guarded non-force update. Broader route/device/accessibility parity and licensed-backend, external-provider, Electron and operating-system IME verification remain incomplete. See the [final acceptance and publication record](migration/rc2-final-acceptance-publication-20261007.md).

A frozen original Vue version and historical tests are kept as references. The clean RC2 branch starts from pinned Vue upstream. See the [migration record](migration/README.md), [route/feature inventory](migration/rc2-full-route-inventory.md), [architecture review](migration/rc2-architecture-review.md), [acceptance ledger](migration/rc2-parity-ledger.md) and [production comparison](migration/rc2-benchmark-results.md) and [benchmark protocol](migration/rc2-benchmark-protocol.md). Benchmarks measure bounded workloads and do not certify parity or general performance superiority.

## Run and verify this branch

Use Node 24 or newer and the pnpm version pinned in `frontend/package.json`; the Go version is declared in `go.mod`. Follow [Vikunja’s development setup](https://vikunja.io/docs/development/) for backend configuration and Mage installation. Use a local development/test backend rather than production data.

```bash
cd frontend
pnpm install --frozen-lockfile
pnpm dev
```

Configure the local API address in the frontend’s API settings. For a production frontend build, run `pnpm build` from `frontend/`.

```bash
# From frontend/
pnpm typecheck
pnpm lint
pnpm lint:styles
pnpm test:unit --run

# From the repository root; Mage manages an isolated test backend
mage test:e2e '--config=../migration/acceptance/architecture-logo.config.ts'
```

The focused command runs representative logo, reader, draft and visual checks. The full `migration/acceptance/playwright.config.ts` suite additionally requires the local OpenID provider and public-team fixture configuration described in [the acceptance ledger](migration/rc2-parity-ledger.md); licensed cases require an enabled test backend. Save test output and preserve failed assertions/results. Original frontend test suites remain available through their existing configuration. Upstream project information, attribution and license notices are preserved below; those upstream links describe Vikunja itself rather than a production release of this migration.

---

<img src="https://vikunja.io/images/vikunja-logo.svg" alt="" style="display: block;width: 50%;margin: 0 auto;" width="50%"/>

[![Build Status](https://github.com/go-vikunja/vikunja/actions/workflows/ci.yml/badge.svg)](https://github.com/go-vikunja/vikunja/actions/workflows/ci.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](LICENSE)
[![Install](https://img.shields.io/badge/download-v2.6.0-brightgreen.svg)](https://vikunja.io/docs/installing)
[![Docker Pulls](https://img.shields.io/docker/pulls/vikunja/vikunja.svg)](https://hub.docker.com/r/vikunja/vikunja/)
[![OpenAPI Docs](https://img.shields.io/badge/swagger-docs-brightgreen.svg)](https://try.vikunja.io/api/v2/docs)

# Vikunja

> The task manager you actually own. 

If Vikunja is useful to you, please consider [supporting the project](https://vikunja.io/support/). You can [buy a coffee](https://www.buymeacoffee.com/kolaente), [sponsor on GitHub](https://github.com/sponsors/kolaente) or buy [a sticker pack](https://vikunja.io/stickers).
We're also offering [a hosted version of Vikunja](https://vikunja.cloud/) if you want a hassle-free solution for yourself or your team.
If you or your company needs admin panel, audit logs or time tracking, check out [Vikunja Pro](https://vikunja.io/pro/).

> [!NOTE]
> For the development of Vikunja, we're using LLM-Assisted coding tools in various parts of the codebase.
> Most contributions made @tink-bot are built that way.

## Table of contents

- [Security Reports](#security-reports)
- [Features](#features)
- [Docs](#docs)
	- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)
	- [Unsplash Images](#unsplash-images)

## Security Reports

If you find any security-related issues you don't want to disclose publicly, please use [the contact information on our website](https://vikunja.io/contact/#security).

## Features

See [the features page](https://vikunja.io/features/) on our website for a more exhaustive list or 
try it on [try.vikunja.io](https://try.vikunja.io)!

## Docs

* [Installing](https://vikunja.io/docs/installing/)
* [Build from source](https://vikunja.io/docs/build-from-sources/)
* [Development setup](https://vikunja.io/docs/development/)
* [Magefile](https://vikunja.io/docs/magefile/)
* [Testing](https://vikunja.io/docs/testing/)

All docs can be found on [the Vikunja home page](https://vikunja.io/docs/).

### Roadmap

See [the roadmap](https://my.vikunja.cloud/share/QFyzYEmEYfSyQfTOmIRSwLUpkFjboaBqQCnaPmWd/auth) (hosted on Vikunja!) for more!

## Contributing

Please check out the contribution guidelines on [the website](https://vikunja.io/docs/development/).

## License

Most of this repository is licensed under [AGPL‑3.0‑or‑later](LICENSE).
The contents of [`desktop/`](desktop/) are licensed under
[GPL‑3.0‑or‑later](desktop/LICENSE).

### Unsplash Images

Background images from Unsplash are distributed under the [Unsplash License](https://unsplash.com/license). The license requires giving credit to the photographer and Unsplash. See [Unsplash’s terms](https://unsplash.com/terms) for more information.
