# Marionette Experimental Fork of Vikunja

This is the Marionette organization's experimental fork of [Vikunja](https://github.com/go-vikunja/vikunja), an excellent open-source task management application. We are deeply grateful to the Vikunja maintainers and contributors for building such a wonderful project—please visit the [upstream repository](https://github.com/go-vikunja/vikunja) and consider supporting their ongoing work via the [Vikunja support page](https://vikunja.io/support/).

We intend to migrate the full Vue frontend to Marionette 5.0.0-beta.2, preserving real application behavior, with no Vue dependency when migration is complete. It will serve as a substantial real-world example of Marionette and an open case study for learning, evaluating, and improving agent-led development: our prompts, documentation, agent guidance, and verification practices.

Migration has just started; the current application still uses Vue. We do not claim completion, demonstrated parity, or endorsement by upstream. Because this is an experimental migration fork, the upstream documentation, links, attributions, and license section preserved below continue to describe the original project.

See the [migration record](migration/README.md) for scope, completion criteria, and how we record agent-led work.

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
