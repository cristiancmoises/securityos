# Production deployment

This runbook covers the audited SecurityOS topology on the IONOS VPS. A normal
release replaces the **web container only**. Tor, Cloudmacs, their data, and the
reverse-proxy network attachments stay running throughout the deployment.

The VPS has limited free disk space. Build the multi-stage runtime image on a
compatible local machine, validate it, transfer the compressed Docker image, and
load it on the VPS. Do not run a Docker build on the VPS.

## Production invariants

- Use Compose project `securityos` and the existing production file
  `/root/secos/securityos/docker-compose.yml` for container recreation.
- Treat that production checkout as immutable deployment evidence. Its modified
  Compose file is intentional and is not interchangeable with the repository's
  version.
- Keep the web container named `securityos`, published as `3002:3000`, and
  attached to `securityos_securenet`.
- Keep `securityos-tor-1` running and healthy on `securityos_securenet`.
- Keep `securityos-cloudmacs` running on `securityos_cloudmacs-net`, without a
  published host port. Preserve all of its bind-mounted data.
- Keep the `npm-attachment` reverse proxy attached to both networks.
- The audited VPS platform is `linux/amd64`.
- Never deploy with the release's Compose file, run `docker compose down`, or
  select Tor or Cloudmacs in a release command.

At the 2026-09-01 audit, the active production Compose file had SHA-256
`337229790ed2bcdc91bbd4286141f1390b63dfedfa0afe5a056c0fc31cb9b181`.
If that fingerprint changes, re-audit the effective model before deploying; do
not overwrite the file to make the checksum match.

## 1. Validate and build locally

Start from a clean, reviewed commit. Dependency installation must not rewrite
the lockfile.

```sh
test -z "$(git status --porcelain)"
yarn install --frozen-lockfile
yarn test --runInBand
yarn stylelint
yarn build
yarn audit
(cd sidecar && cargo fmt --check && CC=gcc cargo test --locked && cargo audit)
docker compose config -q
git diff --check
```

Run the full ESLint report as well, but do not misrepresent the repository's
existing legacy-rule backlog as a new release regression. New and materially
changed modules must be lint-clean; reduce the recorded baseline separately.

Push the reviewed commit and verify every remote's `refs/heads/main` equals the
local commit before deployment. Never put credentials in a Git URL, artifact,
Compose file, or shell history, and never force-push as part of deployment.

Build only the Dockerfile's multi-stage `runtime` target for the production
architecture. The candidate tag contains the reviewed commit identifier.

```sh
release_id="$(git rev-parse --short=12 HEAD)"
image_ref="securityos-web:candidate-${release_id}"

docker build --pull --platform linux/amd64 --target runtime \
  --tag "$image_ref" .

test "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' \
  "$image_ref")" = "linux/amd64"
local_image_id="$(docker image inspect --format '{{.Id}}' "$image_ref")"
```

Create the deployable image artifact outside the checkout. `docker image save`
preserves the candidate tag and immutable image ID; gzip reduces the temporary
space required on the VPS.

```sh
artifact_dir="$(cd .. && pwd)/securityos-artifacts"
image_tar="$artifact_dir/securityos-web-${release_id}.tar"
install -d -m 0700 "$artifact_dir"

docker image save --output "$image_tar" "$image_ref"
gzip -9 "$image_tar"
image_archive="${image_tar}.gz"
gzip --test "$image_archive"

printf '%s\n' "$local_image_id" >"${image_archive}.image-id"
(
  cd "$artifact_dir"
  sha256sum "$(basename "$image_archive")" \
    >"$(basename "$image_archive").sha256"
)
```

Record the compressed artifact size and the image's uncompressed virtual size.
The VPS must have room for the uploaded archive, the loaded candidate, Docker's
load overhead, and the existing rollback image at the same time.

```sh
stat --format='archive-bytes=%s' "$image_archive"
docker image inspect --format='image-bytes={{.Size}}' "$image_ref"
```

## 2. Check capacity and stage through Evelin

`ev shell` is a Fish convenience function, not an SSH host alias. Scripts and
other shells should use the pinned Evelin client configuration explicitly.

```sh
command ev --config "$HOME/.evelin/client.toml" shell
```

Run these read-only checks on the VPS before uploading anything:

```sh
df -h / /var/lib/docker
docker system df
docker image inspect securityos-web:latest >/dev/null
```

Stop if there is not conservative headroom for both artifact and loaded image.
The 2026-09-01 audit found the root filesystem 95% full with only about 8.7 GiB
free. Expand storage or perform a separately approved, exact-owner cleanup first.
Never use broad Docker cleanup to make space.

Create exact staging and rollback directories, then exit the VPS shell.

```sh
install -d -m 0700 /root/securityos-staging /root/securityos-rollbacks
exit
```

Upload the image and its verification files from the local machine:

```sh
remote_archive="/root/securityos-staging/$(basename "$image_archive")"

command ev --config "$HOME/.evelin/client.toml" cp \
  "$image_archive" "remote:${remote_archive}"
command ev --config "$HOME/.evelin/client.toml" cp \
  "${image_archive}.sha256" "remote:${remote_archive}.sha256"
command ev --config "$HOME/.evelin/client.toml" cp \
  "${image_archive}.image-id" "remote:${remote_archive}.image-id"
command ev --config "$HOME/.evelin/client.toml" shell
```

The server currently restricts Evelin `exec`, so production commands must run in
the authenticated interactive shell. Do not work around that allow-list.

On the VPS, substitute the reviewed commit identifier and verify the artifact
before loading it. Loading an image does not affect the running container.

```sh
set -o pipefail
release_id="REVIEWED-COMMIT-12HEX"
image_ref="securityos-web:candidate-${release_id}"
remote_archive="/root/securityos-staging/securityos-web-${release_id}.tar.gz"

cd /root/securityos-staging
sha256sum --check "$(basename "${remote_archive}.sha256")"
gzip --test "$remote_archive"
expected_image_id="$(cat "${remote_archive}.image-id")"
printf '%s\n' "$expected_image_id" | grep -Eq '^sha256:[0-9a-f]{64}$'

gzip --decompress --stdout "$remote_archive" | docker image load
candidate_image="$(docker image inspect --format '{{.Id}}' "$image_ref")"
test "$candidate_image" = "$expected_image_id"
test "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' \
  "$image_ref")" = "linux/amd64"
```

After the loaded ID matches, remove only the uploaded archive to recover its VPS
space. The verified local copy remains the recovery artifact.

```sh
rm -- "$remote_archive"
df -h /var/lib/docker
```

## 3. Verify the production model and create the rollback point

Use the active production Compose file, not a Compose file from the release
artifact. The `--no-build` cutover later ensures its build context is never used.

```sh
prod_root="/root/secos/securityos"
prod_compose="$prod_root/docker-compose.yml"
rollback_id="$(date -u +%Y%m%dT%H%M%SZ)"
rollback_root="/root/securityos-rollbacks/${rollback_id}"

test -f "$prod_compose"
docker compose -p securityos -f "$prod_compose" config -q

running_web_hash="$(docker inspect --format \
  '{{index .Config.Labels "com.docker.compose.config-hash"}}' securityos)"
file_web_hash="$(docker compose -p securityos -f "$prod_compose" \
  config --hash web | awk '$1 == "web" { print $2 }')"
test "$running_web_hash" = "$file_web_hash"
```

Validate the host-specific topology without displaying environment values:

```sh
docker compose -p securityos -f "$prod_compose" config --format json | \
  jq --exit-status '
    .name == "securityos" and
    .services.web.container_name == "securityos" and
    ([.services.web.ports[] |
      select(.target == 3000 and .published == "3002")] | length == 1) and
    (.services.web.networks | has("securenet")) and
    .networks.securenet.name == "securityos_securenet" and
    .services.cloudmacs.container_name == "securityos-cloudmacs" and
    ((.services.cloudmacs.ports // []) | length == 0) and
    (.services.cloudmacs.networks | has("cloudmacs-net")) and
    .networks["cloudmacs-net"].name == "securityos_cloudmacs-net"
  ' >/dev/null

test "$(docker inspect --format '{{.State.Health.Status}}' \
  securityos-tor-1)" = "healthy"
docker network inspect securityos_securenet >/dev/null
docker network inspect securityos_cloudmacs-net >/dev/null

proxy_networks="$(docker inspect --format \
  '{{json .NetworkSettings.Networks}}' npm-attachment)"
printf '%s\n' "$proxy_networks" | grep -q 'securityos_securenet'
printf '%s\n' "$proxy_networks" | grep -q 'securityos_cloudmacs-net'
curl --fail --silent --show-error --output /dev/null \
  http://127.0.0.1:3002/
```

Record the exact companion container IDs so post-cutover checks can prove they
were not recreated. Preserve the dirty production Compose file and patch as
rollback evidence, then give the running web image a cheap rollback tag. Do not
tag or replace Tor or Cloudmacs images.

```sh
old_web_image="$(docker inspect --format '{{.Image}}' securityos)"
old_tor_container="$(docker inspect --format '{{.Id}}' securityos-tor-1)"
old_cloudmacs_container="$(docker inspect --format '{{.Id}}' \
  securityos-cloudmacs)"

install -d -m 0700 "$rollback_root"
cp --preserve=all "$prod_compose" "$rollback_root/docker-compose.yml"
test ! -e "$prod_root/old.ymo" || \
  cp --preserve=all "$prod_root/old.ymo" "$rollback_root/old.ymo"
GIT_OPTIONAL_LOCKS=0 git -C "$prod_root" rev-parse HEAD \
  >"$rollback_root/source-commit.txt"
GIT_OPTIONAL_LOCKS=0 git -C "$prod_root" status --short --branch \
  >"$rollback_root/working-tree-status.txt"
GIT_OPTIONAL_LOCKS=0 git -C "$prod_root" diff --binary \
  >"$rollback_root/working-tree.patch"
printf '%s\n' "$old_web_image" >"$rollback_root/web-image-id.txt"

docker image tag "$old_web_image" \
  "securityos-web:rollback-${rollback_id}"
test "$(docker image inspect --format '{{.Id}}' \
  "securityos-web:rollback-${rollback_id}")" = "$old_web_image"
```

## 4. Smoke-test the candidate on the existing Tor network

Run a temporary candidate beside production. It joins the existing
`securityos_securenet` and resolves the already-running Tor service by its
`tor` alias. It publishes no host port and cannot replace any production
container.

```sh
smoke="securityos-smoke-${release_id}"
cleanup_smoke() {
  docker container inspect "$smoke" >/dev/null 2>&1 &&
    docker rm --force "$smoke" >/dev/null
}
trap cleanup_smoke EXIT

docker run --detach --rm --name "$smoke" --init \
  --network securityos_securenet \
  --read-only \
  --tmpfs /tmp \
  --tmpfs /SecurityOS/.next/cache \
  --tmpfs /root/.cache \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --memory 1g \
  --pids-limit 512 \
  --log-driver none \
  --env NODE_ENV=production \
  --env NEXT_TELEMETRY_DISABLED=1 \
  --env TMPDIR=/tmp \
  --env TOR_PROXY=socks5h://tor:9050 \
  "$image_ref"

smoke_ip="$(docker inspect --format \
  '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$smoke")"
curl --fail --silent --show-error --output /dev/null \
  --retry 20 --retry-delay 2 --retry-connrefused \
  "http://${smoke_ip}:3000/"

curl --fail --silent --show-error \
  "http://${smoke_ip}:3000/api/proxy?url=https%3A%2F%2Fcheck.torproject.org%2Fapi%2Fip" |
  jq --exit-status '.IsTor == true' >/dev/null

docker stop "$smoke" >/dev/null
trap - EXIT
```

If either probe fails, stop here. The production web, Tor, and Cloudmacs
containers are still untouched.

## 5. Replace only the exact web container

Point the Compose-generated web tag at the validated candidate before the short
outage. This does not change the already-running container.

```sh
docker image tag "$image_ref" securityos-web:latest
test "$(docker image inspect --format '{{.Id}}' securityos-web:latest)" = \
  "$candidate_image"
```

Stop and remove only the exact `securityos` web container, then recreate only
the `web` service from the unchanged production Compose file. `--no-deps` keeps
Tor running; `--no-build` prevents use of the old checkout as a build context.

```sh
docker stop securityos
docker rm securityos
docker compose -p securityos -f "$prod_compose" \
  up --detach --no-deps --no-build web
```

Verify the candidate image, port, network, HTTP route, and the unchanged
companion container IDs:

```sh
test "$(docker inspect --format '{{.Image}}' securityos)" = \
  "$candidate_image"
test "$(docker inspect --format '{{.Id}}' securityos-tor-1)" = \
  "$old_tor_container"
test "$(docker inspect --format '{{.Id}}' securityos-cloudmacs)" = \
  "$old_cloudmacs_container"
test "$(docker inspect --format '{{.State.Health.Status}}' \
  securityos-tor-1)" = "healthy"

docker port securityos 3000/tcp | grep -Eq ':3002$'
docker inspect --format '{{json .NetworkSettings.Networks}}' securityos |
  jq --exit-status 'has("securityos_securenet")' >/dev/null

curl --fail --silent --show-error --output /dev/null \
  --retry 20 --retry-delay 2 --retry-connrefused \
  http://127.0.0.1:3002/
curl --fail --silent --show-error --output /dev/null \
  --retry 10 --retry-delay 3 https://os.securityops.co/
```

Then validate Tor Browser, Clearnet Browser, ZUPT, Keywave, IRC, and GODS EYE
from a real browser. Keep both the candidate and rollback tags through the agreed
observation window.

## Rollback

Rollback also replaces only the exact web container. The saved image tag points
to the immutable image that ran before cutover.

```sh
if docker container inspect securityos >/dev/null 2>&1; then
  docker stop securityos
  docker rm securityos
fi

docker image tag "securityos-web:rollback-${rollback_id}" \
  securityos-web:latest
docker compose -p securityos -f "$prod_compose" \
  up --detach --no-deps --no-build web

test "$(docker inspect --format '{{.Image}}' securityos)" = \
  "$old_web_image"
test "$(docker inspect --format '{{.Id}}' securityos-tor-1)" = \
  "$old_tor_container"
test "$(docker inspect --format '{{.Id}}' securityos-cloudmacs)" = \
  "$old_cloudmacs_container"
docker port securityos 3000/tcp | grep -Eq ':3002$'
curl --fail --silent --show-error --output /dev/null \
  --retry 20 --retry-delay 2 --retry-connrefused \
  http://127.0.0.1:3002/
```

The production checkout, dirty Compose model, persistent networks, Tor service,
Cloudmacs service, and Cloudmacs bind mounts remain untouched throughout
cutover and rollback.

## Forbidden cleanup operations

On this multi-application VPS, never use the following as part of a SecurityOS
release:

- `docker system prune`, `docker image prune`, `docker builder prune`,
  `docker volume prune`, or broad image deletion;
- `docker compose down`, `down -v`, `rm -v`, or `--rmi all`;
- stopping, removing, rebuilding, or recreating `securityos-tor-1` or
  `securityos-cloudmacs` during a web release;
- deletion of unnamed or apparently unused volumes without documented ownership;
- deletion of Cloudmacs bind-mount directories;
- `git pull`, `git reset --hard`, `git clean`, or replacement of
  `/root/secos/securityos`;
- overwriting `/root/secos/securityos/docker-compose.yml` with the release copy;
- credentials in Git URLs, command arguments, Compose files, artifacts, or
  documentation.

Any later cleanup must resolve exact image tags or paths first, confirm that the
rollback window has closed, and remain limited to SecurityOS web artifacts. Do
not remove the rollback tag until rollback is explicitly retired.
