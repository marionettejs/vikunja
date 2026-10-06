# Marionette RC2 migration record

This branch restarts from upstream Vikunja Vue baseline `5d22d730aa35b0666d0849099c12a1e638baabc9`. Its publication history contains a single migration snapshot above that preserved baseline.

Runtime packages are pinned exactly to `marionette@5.0.0-rc.2` and matching `@mnjs` packages. The version-matched framework source is `f4243b8334cafe0bd1b06eba85d87e2310cb3618`; installed `docs-manifest.json` identifies that revision. Public RealWorld guidance is pinned to `34ceaa5987c1e80dfa6b6f2285cb9fcb5296ce04` in [marionette-realworld-example-app](https://github.com/marionettejs/marionette-realworld-example-app).

The Go backend and upstream licensing/notices are preserved. Reusable models, services, generated API client, assets, translations and styles remain at their existing roots. Vue runtime, wrappers and build dependencies have been removed from the shipped frontend. This does not establish complete parity.

- [Ownership and decisions](rc2-architecture-review.md)
- [All 59 original route declarations and partial status](rc2-full-route-inventory.md)
- [Test results, fixes and unresolved deviations](rc2-parity-ledger.md)
- [Production comparison and raw samples](rc2-benchmark-results.md)
- [Benchmark method and reproduction](rc2-benchmark-protocol.md)

Completion requires all routes/features, visual and keyboard behavior, loading/errors/cancellation, authentication/reload/deep links and supported backend interaction to pass. Bundle compilation and a Vue audit are necessary but insufficient. Tests and failed assertions remain available; coverage gaps do not reduce feature scope.
