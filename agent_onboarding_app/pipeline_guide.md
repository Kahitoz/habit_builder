# Jenkins and Kubernetes guide for new projects

Use this guide when adding a project under `~/projects`. Each deployable project is an independent Git repository and gets its own `Jenkinsfile` and (when deploying to Kubernetes) its own manifests. Do not put a shared Jenkinsfile in the parent `projects` folder or assume sibling project folders are checked out together: Jenkins checks out one repository per multibranch job.

## Current Jenkins worker conventions

- Configure a Jenkins **Multibranch Pipeline** for the project's GitHub repository. The repository must contain a root-level file named exactly `Jenkinsfile`.
- Run builds on the `prod-node` agent label.
- The worker has Bash, Podman, `kubectl`, Node/npm, Python, and Firebase CLI available. Use Podman to build and push container images; do not use Docker.
- Fully qualify container image references in `Containerfile`/`Dockerfile` (for example, `docker.io/hashicorp/vault:1.19`). The production Podman worker has no unqualified-image search registries configured, so short names such as `hashicorp/vault:1.19` fail before Podman can pull the image. Pin the intended image tag and registry explicitly.
- Jenkins `sh` steps default to `/bin/sh`, which may be `dash` and reject `set -o pipefail`. For shell blocks that use Bash options or syntax, put `#!/usr/bin/env bash` immediately after the opening `sh '''` (or use another explicit Bash invocation); retain `set -euo pipefail` only when the script is running under Bash.
- Jenkins workers usually run as an unprivileged user. Avoid `npm install -g` in pipeline steps; invoke tools such as pnpm with `npx --yes pnpm@<major>` or provision them in the build image.
- Kubernetes access is configured on the worker through `KUBECONFIG=/var/lib/jenkins/.kube/config`.
- The current registry endpoint is `192.168.0.101:5000`; use the Jenkins username/password credential ID `docker-registry`. Registry pushes use `--tls-verify=false` in the current private-network setup. Keep credentials in Jenkins, never in Git or the Jenkinsfile.
- Kubernetes deployments currently use namespace `demo`, Traefik ingress class `traefik`, and external-dns annotations targeting `100.70.0.0` with Cloudflare proxying disabled. Confirm these values with the project owner if the cluster setup changes.
- Images should be immutable and tagged with the checked-out commit SHA (for example, the first 12 characters). Do not deploy `latest`.

## Repository layout

Adapt this to the app, but keep the Jenkinsfile in the repository root and manifests in that same repository:

```text
new-project/
├── Jenkinsfile
├── frontend/                 # if applicable
│   ├── Containerfile         # optional; can also generate one in Jenkins
│   └── ...
├── backend/                  # if applicable
│   └── ...
└── deploy/
    └── k8s/
        ├── frontend.yaml     # if applicable
        └── backend.yaml      # if applicable
```

The actual service folder names and build commands must match the repository. Examples from the current projects: `frontend`/`backend`, or `client-frontend`/`admin-frontend`. Exclude components that should not be deployed (for example, model-inference or harness/tooling components) from the selectable deployable-service list.

## Jenkins parameters to provide

For a typical web application, expose parameters so a manual build can choose:

- `ACTION`: `ARTIFACT_ONLY`, `BUILD`, `DEPLOY`, or `BUILD_AND_DEPLOY`.
- `COMPONENT` (or `SERVICE`): `ALL` and each independently buildable component.
- For frontend projects, `FRONTEND_DEPLOY_TARGET`: `KUBERNETES`, `FIREBASE`, or `BOTH`.
- `K8S_NAMESPACE`, defaulting to `demo`.
- Firebase project, Hosting target, domain, and subdomain when Firebase is supported.

Make `ARTIFACT_ONLY` the first choice/default. Multibranch indexing or a newly discovered branch can schedule a build without deployment settings; that safe path should compile/test/build and archive outputs without requiring registry, Firebase, or Kubernetes deployment parameters. Only validate a setting when the requested action actually needs it. For example, require a registry repository only when building/pushing a Kubernetes image, and require Firebase project/target/domain/subdomain only when deploying the frontend to Firebase.

Suggested stage order:

1. Validate action/component choices and only the credentials/settings needed for that action.
2. Build and test the selected component(s).
3. For Kubernetes image builds, log in to the registry using `withCredentials`, build with Podman, and push a commit-tagged image.
4. Archive useful build output with `archiveArtifacts` for build/artifact-only runs.
5. For deploy actions, verify Kubernetes access, apply the selected component manifests with the concrete image substituted for `IMAGE_PLACEHOLDER`, then wait for rollout.
6. For Firebase deploy actions, build a static frontend export, bind a Jenkins Secret File credential, and run Firebase CLI non-interactively for the selected Hosting target.
7. In `post`, log out of the registry safely and clean the workspace. Never echo tokens, passwords, service-account JSON, or kubeconfig contents.

## Kubernetes manifests and routing

Create one Deployment and ClusterIP Service per deployable component in the repository's `deploy/k8s/` directory. The Deployment image should initially be `IMAGE_PLACEHOLDER`; Jenkins substitutes the full registry image and immutable tag before applying it. Give each Deployment a readiness probe that matches a real endpoint and container port. Store runtime secrets in Kubernetes Secrets (or the project's approved secret manager), not in manifests.

Use stable, project-specific names, for example `<project>-frontend` and `<project>-backend`. The frontend Service normally exposes port 80 and targets the app's HTTP container port. The backend Service exposes its internal application port. Select the intended production node using the node labels already established in the cluster; check the actual node labels before adding `nodeSelector` values. Do not invent a node name or change labels from an application pipeline without confirming the cluster convention.

Choose the public routing shape deliberately: the frontend and API may share one hostname or use separate hostnames. Keep the frontend API base URL, backend route prefix, and ingress path behavior consistent.

- For a same-host API under `/api`, use a relative frontend API base such as `/api`. Route `/api` to the backend Service and `/` to the frontend Service. The backend should serve routes under `/api`, or the ingress should strip that prefix if the backend routes are unprefixed.
- For separate frontend and API hostnames, use the full API URL as the frontend base and configure CORS for the frontend origin.
- Preserve or strip `/api` intentionally. Do not configure both the backend and proxy to add or both to remove the prefix. Add other required API paths deliberately, and use the project's own hostnames.

CORS is based on the browser origin (scheme, hostname, and port); URL paths such as `/api` are not part of an origin. A separate API hostname remains cross-origin even when the API uses `/api`, so configure the backend's allowed origins with the exact frontend origin. When frontend and API share one hostname, path-based routing is same-origin and may not need CORS. Keep health probes pointed at a real backend endpoint through the Service or Pod; they do not need to use the public ingress path.

Before deployment, the pipeline should check the selected namespace and Kubernetes authorization (`kubectl auth can-i`), apply manifests, and wait for each Deployment's rollout. Deployment must fail clearly if the cluster is unreachable or the rollout times out.

## Firebase frontend option

Only offer Firebase for a frontend that can be built as static files. Configure the framework's static-export mode and a Firebase Hosting configuration (`firebase.json`) inside that frontend project. Bind the Firebase service-account JSON from Jenkins Credentials (current credential ID: `firebase-service-account`) using a Secret File binding; never commit the JSON. Ask for/parameterize the Firebase project ID, Hosting target/site ID, domain, and subdomain. Firebase CLI deployment should be non-interactive and scoped to the selected Hosting target. A Firebase custom domain usually also needs one-time DNS/domain setup outside the pipeline; the pipeline should report the requested hostname, not imply DNS was configured automatically.

## Jenkinsfile implementation notes

- Use Declarative Pipeline syntax and expand `when`, `steps`, and nested blocks on separate lines. Run Jenkins' Declarative Pipeline validation before committing.
- Run shell blocks that use `pipefail` under Bash: begin the multiline `sh` script with `#!/usr/bin/env bash` before `set -euo pipefail`. Do not assume Jenkins' default `/bin/sh` supports Bash options.
- Use `withCredentials([usernamePassword(...)])` for registry auth and `[file(...)]` for Firebase service-account credentials. Disable shell tracing around secret use (`set +x`) and use `--password-stdin` for Podman login.
- For Vault-backed backends, bind the read-only Vault credential only in the deploy stage, create/update the namespace Secret from standard input, and let the app read only its required Vault fields at startup. Keep generated signing keys stable by creating them only when their Kubernetes Secret/key is absent.
- Use an isolated Podman auth file in the workspace temporary directory when supported by the worker; pass it to both login and push, then remove it during cleanup.
- Quote shell values and validate user parameters before inserting them into shell commands. Avoid logging credential values.
- Keep image names and Kubernetes object names specific to this project to prevent collisions with sibling applications.
- If a backend requires Vault or another external secret source, use its dedicated Jenkins credential and least-privilege read access. Do not add secrets as ordinary parameters or environment literals.
- Keep projects independent: a pipeline for one Git repository must not depend on files that exist only in another project repository.

## New-project checklist

- [ ] Create/use a separate GitHub repository for the project and put its own `Jenkinsfile` at the repository root.
- [ ] Create the Jenkins multibranch job connected to that repository; ensure it uses the configured GitHub PAT credential in Jenkins, not a token in source.
- [ ] List only supported components in the pipeline parameters; exclude non-deployable model/harness components.
- [ ] Verify build/test commands locally or on the prod worker, and make artifact-only safe with no deploy credentials supplied.
- [ ] Add one Deployment/Service manifest per Kubernetes component and the project's own ingress routes/hostname.
- [ ] Confirm registry repository/image naming and Jenkins credential IDs; push commit-SHA-tagged images with Podman.
- [ ] Add Firebase configuration and static build only if frontend Firebase hosting is required.
- [ ] Validate the Jenkinsfile, review manifest selectors/ports/probes/routes, then commit and push to the repository's intended branch.
- [ ] Run the multibranch build in artifact-only mode first. Verify build artifacts; test image push and deployment as separate explicit actions.

## Values to confirm for every project

Before using a generated Jenkinsfile, confirm the repository URL and branch, app/component directory names, build/test commands, container ports and start commands, registry image names, namespace, required Kubernetes Secret names, node selector labels, hostname/path routing, and whether Firebase is needed. Cluster and registry details are operational configuration and may change; check them rather than copying stale values blindly.
