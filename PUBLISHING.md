# Publishing

## Provenance is mandatory, not a nicety

n8n's docs are explicit: from 1 May 2026, nodes submitted for Creator Portal
verification **must** be published by a GitHub Actions workflow carrying a
provenance statement, and "n8n won't accept verified nodes published directly
from a local machine."

`0.1.0` was published from a laptop to bring the package into existence, because
npm will not attach a trusted publisher to a package that does not exist yet.
That version is therefore **not submittable for verification**. Every release
from `0.1.1` onward goes through the tag and the workflow.

Everything is ready except npm authentication, which has to be done by a human
holding the npm account. Pick one route.

## Route A, trusted publishing (recommended, no token anywhere)

npm signs the release using GitHub's OIDC identity, so there is no long-lived
token to leak or rotate.

1. On npmjs.com, go to the `n8n-nodes-flyn` package settings and add a trusted
   publisher:
   - Repository: `Latracal-Solutions/n8n-nodes-flyn`
   - Workflow: `publish.yml`
2. Push the tag:
   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```

If npm will not let you configure a trusted publisher before the package
exists, do one manual `npm publish --access public` first, then add the trusted
publisher and use tags from then on.

## Route B, access token

1. On npmjs.com create a **granular access token** with write access to this
   package only. Do not use a classic automation token with account-wide scope.
2. Add it to the repo as a secret named `NPM_TOKEN`:
   **Settings > Secrets and variables > Actions > New repository secret**.
   Add it through the GitHub UI so the value is never in a shell history.
3. Push the tag:
   ```bash
   git tag v0.1.0 && git push origin v0.1.0
   ```

## What the workflow does

Lints, builds, checks the tag matches `package.json`'s version, then publishes
with `--provenance`. It upgrades npm first because the version bundled with
Node 20 and 22 is too old for trusted publishing.

## After publishing

1. Confirm the listing: <https://www.npmjs.com/package/n8n-nodes-flyn>
2. Install it in your own n8n (**Settings > Community Nodes**) and run one
   Create Link. The API contract has been verified endpoint by endpoint, but no
   end-to-end run has happened against a live key.
3. Submit to the n8n Creator Portal. Approval does not equal publication:
   packages have sat in the release queue for weeks afterwards, so submit early
   and chase any follow-up form, which is the documented way this stalls.

## Releasing again later

Bump `version` in `package.json`, commit, then tag with the matching `vX.Y.Z`.
The workflow refuses to publish if the tag and the manifest disagree.
