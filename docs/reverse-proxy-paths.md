# Panels behind independent URL prefixes

The single-file panel can be served at `/team-a/management.html` or `/team-a/`.
It detects `/team-a` as the API base and uses `/team-a/v8/management` for
management requests. A reverse proxy must strip `/team-a` before forwarding
to that team's CPA backend. Hash navigation does not change the API base.

Saved credentials, login markers, account filters, key names and quota page
preferences are scoped to the panel directory. A panel at a new prefix starts
without importing another panel's saved login. The root `/management.html`
keeps its existing storage keys, preserving existing installations. Theme and
language preferences remain shared.

## Deployment and authorization

Each backend must retain its own configuration, auth directory, management
key and client API keys. URL prefixes and browser storage namespacing are not
authorization controls. A key issued by one backend must be rejected by the
other. Do not merge credential pools or add a fallback to another backend.

Serve the reviewed panel asset independently of tenant-controlled backend
files. Backend HTML, including plugin resources, must not acquire the shared
panel origin's browser storage: sandbox such responses at the reverse proxy
without `allow-same-origin`. Apply the response policy even when a plugin URL
is opened directly, not only when embedded in an iframe. Raw browser storage
remains accessible to trusted same-origin panel code; reversible obfuscation
does not provide cryptographic separation. Only install trusted plugins on
other unsandboxed panels sharing this origin.

When adding a new team to an existing installation, add only its URL prefix.
Keep the existing root routes, client URLs, credentials and backend containers
unchanged. Check path stripping, public API authentication and private
management access separately. A root redirect or health check alone does not
prove a working authenticated panel.

## Verification

`tests/panelPathIsolation.test.ts` protects prefixed API detection, credential
and legacy-login isolation, deletion scope, and account/quota preference
isolation. The API and storage regressions fail against the unmodified panel.
Existing auth and key-name tests cover the root deployment's storage behavior.

Deployment verification additionally requires two independently authenticated
backends, cross-key rejection, an unchanged original backend, and browser
navigation/login at the new prefix. Account onboarding and inference require
real upstream accounts and are not implied by an empty panel opening.
