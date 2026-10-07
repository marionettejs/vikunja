# Bounded admin, time and avatar paired replay

`acceptance/admin-avatar-paired.config.ts` selects exactly ten existing tests per app from `admin-time.spec.ts` and `avatar-system.spec.ts`. Test bodies, assertions and fixtures are unchanged. It inherits frozen Vue source/build verification and its preview server from `vue-observation-parity.config.ts`, with one worker, zero retries and separate output/report paths.

The six gate cases verify real unlicensed routes and ordinary-user denial. One time contract checks author controls, settled totals and running-entry display. Three avatar cases check desktop/mobile default/initials/marble persistence and the actual cropped-upload endpoint. Enabled admin/time responses use the existing browser-only `proContract`; this does not certify a licensed backend. The upload selector already supports both cropper implementations.

This commit changes only test selection and scope documentation. No browser, backend or build was run during preparation. The parent should run serially after its active suite, archive the report/results, and preserve every failure. Expected collection is twenty tests total. Any selector mismatch should become a documented harness-only correction without weakening behavior or payload assertions.
