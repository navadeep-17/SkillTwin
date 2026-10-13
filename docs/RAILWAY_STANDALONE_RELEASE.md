# Railway standalone image release

**Why:** Earlier exact-commit Railpack builds compiled Next.js and then timed out exporting the image, twice. The build diagnosis had no app-code root cause, so this is an image-size/build-system mitigation rather than a proven fix.

**Changes:** enable Next.js `output: "standalone"`; introduce a two-stage Dockerfile; copy only traced production server files, Next static output, and public assets to the runtime. Preserve Railway's existing `npm run start` command by rewriting the *runtime image copy* of the package script to `node server.js`. No Railway variables, learner data, Supabase schema, or service settings are modified by the PR.

**Deploy order:**
1. Require normal CI, production build and anonymous auth smoke. Verify the standalone entrypoint exists and Dockerfile has no dev build tools in the final image. A complete Docker build in CI is preferred before merging.
2. Merge Dockerfile change alone to main. Railway pinned-source requires `connect_service_source` with the reviewed merge SHA; never apply the unknown historical staged environment patch.
3. Inspect Railway build logs: Dockerfile builder selected, output image exported, deployment SUCCESS, and server starts on injected `PORT`.
4. Confirm `/api/health` and `/api/readiness` respond, and check anonymous session boundaries.
5. Only then merge/release catalog PR #45, migration for saved journey PR #46, and guided prep PR #47 in order.

**Caveats:** Dockerfile currently installs from package.json because there is no committed npm lockfile. Reproducible dependency locking remains a separate security task. The last successful running release stays available until the new deployment is healthy. No claims of deployment success are warranted solely because CI passes.
