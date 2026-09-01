# Production deployment

This runbook covers the audited SecurityOS topology on the IONOS VPS. A normal
release replaces the **web container only**. Tor and the reverse proxy stay
running throughout the deployment. Cloudmacs remains available in the repository
for optional deployments, but is intentionally absent from this VPS.

The VPS has limited free disk space. Build the multi-stage runtime image on a
compatible local machine, validate it, transfer the compressed Docker image, and
load it on the VPS. Do not run a Docker build on the VPS.

## Production invariants

- Use Compose project `securityos` and this exact ordered stack for every
  production operation: the preserved base
  `/root/secos/securityos/docker-compose.yml`, one reviewed
  `/root/securityos-runtime/docker-compose.release-<sha>.yml`, then the durable
  root-only
  `/root/securityos-runtime/ionos-no-cloudmacs.override.yml` **last**.
- Treat that production checkout as immutable deployment evidence. Its modified
  Compose file is intentional and is not interchangeable with the repository's
  version.
- The base `web` service is build-only, but the selected per-release override
  supplies the exact immutable image reference and root-only runtime env file.
  Always use `--no-build` and `--pull never`; never retag a candidate over a
  Compose-derived name or edit the dirty base file.
- Keep the web container named `securityos`, published as `3002:3000`, and
  attached to `securityos_securenet`.
- Keep `securityos-tor-1` running and healthy on `securityos_securenet`.
- Keep `securityos-cloudmacs` and `securityos_cloudmacs-net` absent. Do not run an
  unqualified `docker compose up`: the immutable production Compose evidence still
  defines the optional service and could recreate it.
- Build the web image with `NEXT_PUBLIC_ENABLE_CLOUDMACS=false` (the Dockerfile
  default). Its process entry, shortcuts, editor integration, icon assets, and
  loopback CSP allowances must be absent from the production artifact.
- Keep `npm-attachment` running on `securityos_securenet`; it must not be attached
  to the removed Cloudmacs network.
- Preserve the dormant Cloudmacs bind-mount directories as user/rollback data.
  Their existence does not authorize mounting or deleting them.
- The audited VPS platform is `linux/amd64`.
- Never deploy with the repository's general-purpose Compose model, run
  `docker compose down`, or select Tor or Cloudmacs in a release command. Always
  select `web` explicitly and include all three audited production files.

At the 2026-09-01 audit, the preserved base Compose file had SHA-256
`337229790ed2bcdc91bbd4286141f1390b63dfedfa0afe5a056c0fc31cb9b181`.
If that fingerprint or either selected override changes, re-audit the effective
model before deploying; do not overwrite a file to make a checksum match.

## 1. Validate and build locally

Start from a clean, reviewed commit. Dependency installation must not rewrite
the lockfile. Run the release blocks in Bash with strict error handling; do not
continue after a failed command.

```sh
test -n "${BASH_VERSION:-}"
set -Eeuo pipefail
umask 077

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
image_ref="securityos:${release_id}"

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

# This rendered override contains no secret. Its env_file target is provisioned
# separately on the VPS and is never copied into the repository or artifact.
release_override="$artifact_dir/docker-compose.release-${release_id}.yml"
sed "s/REVIEWED-COMMIT-12HEX/${release_id}/g" \
  deploy/ionos-web-release.override.example.yml >"$release_override"
chmod 0600 "$release_override"
if grep --quiet 'REVIEWED-COMMIT-12HEX' "$release_override"; then
  printf '%s\n' "Release override still contains its placeholder" >&2
  exit 1
fi
exclusion_override="$artifact_dir/ionos-no-cloudmacs.override.yml"
install -m 0600 deploy/ionos-no-cloudmacs.override.yml "$exclusion_override"

docker image save --output "$image_tar" "$image_ref"
gzip -9 "$image_tar"
image_archive="${image_tar}.gz"
gzip --test "$image_archive"

printf '%s\n' "$local_image_id" >"${image_archive}.image-id"
archive_bytes="$(stat --format='%s' "$image_archive")"
image_bytes="$(docker image inspect --format='{{.Size}}' "$image_ref")"
reserve_bytes=$((2 * 1024 * 1024 * 1024))
staging_required_bytes=$((archive_bytes + reserve_bytes))
docker_required_bytes=$((2 * image_bytes + reserve_bytes))
shared_required_bytes=$((archive_bytes + 2 * image_bytes + reserve_bytes))

printf '%s\n' \
  "archive_bytes=${archive_bytes}" \
  "image_bytes=${image_bytes}" \
  "staging_required_bytes=${staging_required_bytes}" \
  "docker_required_bytes=${docker_required_bytes}" \
  "shared_required_bytes=${shared_required_bytes}" \
  >"${image_archive}.capacity"

(
  cd "$artifact_dir"
  archive_name="$(basename "$image_archive")"
  sha256sum "$archive_name" "$archive_name.image-id" \
    "$archive_name.capacity" "$(basename "$release_override")" \
    "$(basename "$exclusion_override")" \
    >"$(basename "$image_archive").sha256"
)
```

Record the numeric gates. The factor of two on the image size conservatively
covers the loaded candidate and transient Docker load/extraction overhead; the
existing production image remains present as the rollback point.

```sh
cat "${image_archive}.capacity"
```

## 2. Check capacity and stage through Evelin

`ev shell` is a Fish convenience function, not an SSH host alias. Scripts and
other shells should use the pinned Evelin client configuration explicitly.

```sh
command ev --config "$HOME/.evelin/client.toml" shell
```

Run these read-only checks on the VPS before uploading anything:

```sh
test -n "${BASH_VERSION:-}"
set -Eeuo pipefail
umask 077

docker system df
docker container inspect securityos >/dev/null
current_web_image="$(docker inspect --format '{{.Image}}' securityos)"
[[ "$current_web_image" =~ ^sha256:[0-9a-f]{64}$ ]]
docker image inspect "$current_web_image" >/dev/null

# Copy these two exact decimal values from the reviewed local .capacity file.
release_id="REVIEWED-COMMIT-12HEX"
archive_bytes="REVIEWED-ARCHIVE-BYTES"
image_bytes="REVIEWED-IMAGE-BYTES"
[[ "$release_id" =~ ^[0-9a-f]{12}$ ]]
[[ "$archive_bytes" =~ ^[0-9]+$ ]] && ((archive_bytes > 0))
[[ "$image_bytes" =~ ^[0-9]+$ ]] && ((image_bytes > 0))

staging_dir="/tmp/securityos-upload-${release_id}"
reserve_bytes=$((2 * 1024 * 1024 * 1024))
staging_required_bytes=$((archive_bytes + reserve_bytes))
docker_required_bytes=$((2 * image_bytes + reserve_bytes))
shared_required_bytes=$((archive_bytes + 2 * image_bytes + reserve_bytes))
docker_root="$(docker info --format '{{.DockerRootDir}}')"
staging_device="$(df -P /tmp | awk 'NR == 2 { print $1 }')"
docker_device="$(df -P "$docker_root" | awk 'NR == 2 { print $1 }')"
staging_available="$(df -PB1 /tmp | awk 'NR == 2 { print $4 }')"
docker_available="$(df -PB1 "$docker_root" | awk 'NR == 2 { print $4 }')"

[[ "$staging_available" =~ ^[0-9]+$ ]]
[[ "$docker_available" =~ ^[0-9]+$ ]]
if [[ "$staging_device" == "$docker_device" ]]; then
  ((staging_available >= shared_required_bytes))
else
  ((staging_available >= staging_required_bytes))
  ((docker_available >= docker_required_bytes))
fi
```

This is a hard numeric gate, not an advisory `df -h` check. Stop if any arithmetic
assertion fails. The 2026-09-01 audit found the root filesystem 95% full with
only about 8.7 GiB free. Expand storage or perform a separately approved,
exact-owner cleanup first. Never use broad Docker cleanup to make space.

Create the exact release-scoped upload path accepted by Evelin's file-copy
policy, plus the persistent rollback directory, then exit the VPS shell. Do not
substitute a `/root` staging path: Evelin rejects it.

```sh
install -d -m 0700 "$staging_dir" /root/securityos-rollbacks
test "$(stat --format='%u:%a' "$staging_dir")" = "0:700"
exit
```

Upload the image and its verification files from the local machine:

```sh
[[ "$release_id" =~ ^[0-9a-f]{12}$ ]]
remote_archive="/tmp/securityos-upload-${release_id}/$(basename "$image_archive")"

command ev --config "$HOME/.evelin/client.toml" cp \
  "$image_archive" "remote:${remote_archive}"
command ev --config "$HOME/.evelin/client.toml" cp \
  "${image_archive}.sha256" "remote:${remote_archive}.sha256"
command ev --config "$HOME/.evelin/client.toml" cp \
  "${image_archive}.image-id" "remote:${remote_archive}.image-id"
command ev --config "$HOME/.evelin/client.toml" cp \
  "${image_archive}.capacity" "remote:${remote_archive}.capacity"
command ev --config "$HOME/.evelin/client.toml" cp \
  "$release_override" \
  "remote:/tmp/securityos-upload-${release_id}/$(basename "$release_override")"
command ev --config "$HOME/.evelin/client.toml" cp \
  "$exclusion_override" \
  "remote:/tmp/securityos-upload-${release_id}/$(basename "$exclusion_override")"
command ev --config "$HOME/.evelin/client.toml" shell
```

The server currently restricts Evelin `exec`, so production commands must run in
the authenticated interactive shell. Do not work around that allow-list.

On the VPS, substitute the reviewed commit identifier and verify the artifact
before loading it. Loading an image does not affect the running container.

```sh
test -n "${BASH_VERSION:-}"
set -Eeuo pipefail
umask 077

release_id="REVIEWED-COMMIT-12HEX"
[[ "$release_id" =~ ^[0-9a-f]{12}$ ]]
image_ref="securityos:${release_id}"
staging_dir="/tmp/securityos-upload-${release_id}"
remote_archive="${staging_dir}/securityos-web-${release_id}.tar.gz"

test "$(stat --format='%u:%a' "$staging_dir")" = "0:700"
cd "$staging_dir"
sha256sum --check "$(basename "${remote_archive}.sha256")"
gzip --test "$remote_archive"
expected_image_id="$(cat "${remote_archive}.image-id")"
[[ "$expected_image_id" =~ ^sha256:[0-9a-f]{64}$ ]]

capacity_file="${remote_archive}.capacity"
archive_bytes="$(awk -F= '$1 == "archive_bytes" { print $2 }' \
  "$capacity_file")"
image_bytes="$(awk -F= '$1 == "image_bytes" { print $2 }' \
  "$capacity_file")"
reserve_bytes=$((2 * 1024 * 1024 * 1024))
staging_required_bytes="$(awk -F= \
  '$1 == "staging_required_bytes" { print $2 }' "$capacity_file")"
docker_required_bytes="$(awk -F= \
  '$1 == "docker_required_bytes" { print $2 }' "$capacity_file")"
shared_required_bytes="$(awk -F= \
  '$1 == "shared_required_bytes" { print $2 }' "$capacity_file")"
for value in "$archive_bytes" "$image_bytes" "$staging_required_bytes" \
  "$docker_required_bytes" "$shared_required_bytes"; do
  [[ "$value" =~ ^[0-9]+$ ]] && ((value > 0))
done
test "$(stat --format='%s' "$remote_archive")" = "$archive_bytes"

# Re-run the numeric gate immediately before loading; free space may have changed
# since the pre-upload check.
docker_root="$(docker info --format '{{.DockerRootDir}}')"
staging_device="$(df -P "$staging_dir" | awk 'NR == 2 { print $1 }')"
docker_device="$(df -P "$docker_root" | awk 'NR == 2 { print $1 }')"
staging_available="$(df -PB1 "$staging_dir" | awk 'NR == 2 { print $4 }')"
docker_available="$(df -PB1 "$docker_root" | awk 'NR == 2 { print $4 }')"
[[ "$staging_available" =~ ^[0-9]+$ ]]
[[ "$docker_available" =~ ^[0-9]+$ ]]
if [[ "$staging_device" == "$docker_device" ]]; then
  ((staging_available >= shared_required_bytes))
else
  ((staging_available >= staging_required_bytes))
  ((docker_available >= docker_required_bytes))
fi

# Never overwrite an unrelated pre-existing candidate tag.
if existing_candidate="$(docker image inspect --format '{{.Id}}' \
  "$image_ref" 2>/dev/null)"; then
  test "$existing_candidate" = "$expected_image_id"
fi

gzip --decompress --stdout "$remote_archive" | docker image load
candidate_image="$(docker image inspect --format '{{.Id}}' "$image_ref")"
test "$candidate_image" = "$expected_image_id"
docker image inspect --format '{{json .RepoTags}}' "$candidate_image" | \
  jq --exit-status --arg image_ref "$image_ref" \
    'index($image_ref) != null' >/dev/null
test "$(docker image inspect --format '{{.Os}}/{{.Architecture}}' \
  "$image_ref")" = "linux/amd64"
```

After the loaded ID matches, remove only the uploaded archive to recover its VPS
space. The verified local copy remains the recovery artifact.

```sh
rm -- "$remote_archive"
docker_available="$(df -PB1 "$docker_root" | awk 'NR == 2 { print $4 }')"
[[ "$docker_available" =~ ^[0-9]+$ ]]
((docker_available >= reserve_bytes))
```

## 3. Verify the production model and create the rollback point

The live service is defined by three ordered files: preserved base, selected
per-release web override, and durable no-Cloudmacs exclusion. The exclusion is
not auto-loaded, so every command below names it last. Install the rendered
candidate override from the staging directory and provision its referenced env
file separately as root-owned mode `0600`. That env file contains
`SECURITYOS_ORIGIN` and `PROXY_CAPABILITY_SECRET`; never print, copy into Git, or
place either secret value in a Compose file.

```sh
release_id="REVIEWED-COMMIT-12HEX"
[[ "$release_id" =~ ^[0-9a-f]{12}$ ]]
image_ref="securityos:${release_id}"
candidate_image="$(docker image inspect --format '{{.Id}}' "$image_ref")"
[[ "$candidate_image" =~ ^sha256:[0-9a-f]{64}$ ]]

prod_root="/root/secos/securityos"
prod_compose="$prod_root/docker-compose.yml"
runtime_root="/root/securityos-runtime"
candidate_release="$runtime_root/docker-compose.release-${release_id}.yml"
candidate_runtime_env="$runtime_root/securityos.env"
prod_exclusion="$runtime_root/ionos-no-cloudmacs.override.yml"
staged_release="/tmp/securityos-upload-${release_id}/docker-compose.release-${release_id}.yml"
staged_exclusion="/tmp/securityos-upload-${release_id}/ionos-no-cloudmacs.override.yml"
rollback_id="$(date -u +%Y%m%dT%H%M%SZ)"
rollback_root="/root/securityos-rollbacks/${rollback_id}"
[[ "$rollback_id" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]

test -f "$prod_compose"
test -f "$staged_release"
test -f "$staged_exclusion"
test ! -e "$candidate_release"
install -o root -g root -m 0600 "$staged_release" "$candidate_release"
rm -- "$staged_release"
test "$(stat --format='%u:%a' "$candidate_release")" = "0:600"
test "$(stat --format='%u:%a' "$candidate_runtime_env")" = "0:600"
test "$(grep --count '^SECURITYOS_ORIGIN=https://os\.securityops\.co$' \
  "$candidate_runtime_env")" = "1"
test "$(grep --count '^PROXY_CAPABILITY_SECRET=' \
  "$candidate_runtime_env")" = "1"
test "$(awk 'NF && $0 !~ /^#/ { count++ } END { print count }' \
  "$candidate_runtime_env")" = "2"
capability_secret_length="$(awk -F= \
  '$1 == "PROXY_CAPABILITY_SECRET" { print length($2) }' \
  "$candidate_runtime_env")"
[[ "$capability_secret_length" =~ ^[0-9]+$ ]]
((capability_secret_length >= 32))
test "$(stat --format='%u:%a' "$prod_exclusion")" = "0:600"
# The canonical exclusion is transferred and checksum-verified with every
# release. Byte drift is a hard stop; update it only in a separately reviewed,
# rollback-protected provisioning change.
cmp --silent "$staged_exclusion" "$prod_exclusion"
rm -- "$staged_exclusion"
expected_compose_sha256="337229790ed2bcdc91bbd4286141f1390b63dfedfa0afe5a056c0fc31cb9b181"
actual_compose_sha256="$(sha256sum "$prod_compose" | awk '{ print $1 }')"
test "$actual_compose_sha256" = "$expected_compose_sha256"
prod_compose_sha256="$actual_compose_sha256"
candidate_release_sha256="$(sha256sum "$candidate_release" | awk '{ print $1 }')"
candidate_runtime_env_sha256="$(sha256sum "$candidate_runtime_env" | \
  awk '{ print $1 }')"
prod_exclusion_sha256="$(sha256sum "$prod_exclusion" | awk '{ print $1 }')"
[[ "$candidate_release_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$candidate_runtime_env_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$prod_exclusion_sha256" =~ ^[0-9a-f]{64}$ ]]

# Resolve the release override that created the running container. The exact
# three-file label is evidence; do not guess an old release from image tags.
active_config_files="$(docker inspect --format \
  '{{index .Config.Labels "com.docker.compose.project.config_files"}}' \
  securityos)"
IFS=',' read -r active_base old_release active_exclusion active_extra \
  <<<"$active_config_files"
test -z "${active_extra:-}"
test "$active_base" = "$prod_compose"
test "$active_exclusion" = "$prod_exclusion"
case "$old_release" in
  "$runtime_root"/docker-compose.release-*.yml)
    old_release_id="${old_release##*/docker-compose.release-}"
    old_release_id="${old_release_id%.yml}"
    [[ "$old_release_id" =~ ^[0-9a-f]{7,40}$ ]] || {
      printf '%s\n' "Invalid active release identifier" >&2
      exit 1
    }
    ;;
  /root/securityos-rollbacks/*/docker-compose.release.rollback.yml)
    [[ "$old_release" =~ ^/root/securityos-rollbacks/[0-9]{8}T[0-9]{6}Z/docker-compose\.release\.rollback\.yml$ ]] || {
      printf '%s\n' "Invalid active rollback override path" >&2
      exit 1
    }
    old_rollback_root="${old_release%/docker-compose.release.rollback.yml}"
    test "$(stat --format='%u:%a' "$old_rollback_root")" = "0:700"
    ;;
  *) printf '%s\n' "Invalid active release override" >&2; exit 1 ;;
esac
test "$(realpath --canonicalize-existing "$old_release")" = "$old_release"
test "$old_release" != "$candidate_release"
test "$(stat --format='%u:%a' "$old_release")" = "0:600"
old_release_sha256="$(sha256sum "$old_release" | awk '{ print $1 }')"
[[ "$old_release_sha256" =~ ^[0-9a-f]{64}$ ]]

old_web_ref="$(docker inspect --format '{{.Config.Image}}' securityos)"
old_web_image="$(docker inspect --format '{{.Image}}' securityos)"
[[ "$old_web_image" =~ ^sha256:[0-9a-f]{64}$ ]]
test -n "$old_web_ref"
test "$(docker inspect --format \
  '{{index .Config.Labels "com.docker.compose.project"}}' securityos)" = \
  "securityos"
test "$(docker inspect --format \
  '{{index .Config.Labels "com.docker.compose.service"}}' securityos)" = \
  "web"

old_web_hash="$(docker inspect --format \
  '{{index .Config.Labels "com.docker.compose.config-hash"}}' securityos)"
old_file_web_hash="$(docker compose -p securityos -f "$prod_compose" \
  -f "$old_release" -f "$prod_exclusion" \
  config --hash web | awk '$1 == "web" { print $2 }')"
candidate_web_hash="$(docker compose -p securityos -f "$prod_compose" \
  -f "$candidate_release" -f "$prod_exclusion" \
  config --hash web | awk '$1 == "web" { print $2 }')"
[[ "$old_web_hash" =~ ^[0-9a-f]{64}$ ]]
[[ "$candidate_web_hash" =~ ^[0-9a-f]{64}$ ]]
test "$old_web_hash" = "$old_file_web_hash"

docker compose -p securityos -f "$prod_compose" -f "$old_release" \
  -f "$prod_exclusion" config -q
docker compose -p securityos -f "$prod_compose" -f "$candidate_release" \
  -f "$prod_exclusion" config -q
```

Validate the host-specific topology without displaying environment values:

```sh
docker compose -p securityos -f "$prod_compose" -f "$candidate_release" \
  -f "$prod_exclusion" config --format json | \
  jq --exit-status --arg image_ref "$image_ref" '
    .name == "securityos" and
    .services.web.container_name == "securityos" and
    .services.web.image == $image_ref and
    (.services.web.build // null) == null and
    (.services.web.tmpfs | sort) ==
      ["/SecurityOS/.next/cache", "/home/node/.cache", "/tmp"] and
    ((.services.web.ports // []) | length == 1) and
    .services.web.ports[0].target == 3000 and
    .services.web.ports[0].published == "3002" and
    .services.web.ports[0].protocol == "tcp" and
    ((.services.web.networks | keys | sort) == ["securenet"]) and
    .networks.securenet.name == "securityos_securenet" and
    (.services.cloudmacs // null) == null
  ' >/dev/null

docker compose -p securityos -f "$prod_compose" -f "$old_release" \
  -f "$prod_exclusion" config --format json | \
  jq --exit-status --arg old_web_ref "$old_web_ref" '
    .services.web.image == $old_web_ref and
    .services.web.container_name == "securityos" and
    (.services.web.build // null) == null and
    (.services.web.tmpfs | sort) ==
      ["/SecurityOS/.next/cache", "/home/node/.cache", "/tmp"] and
    (.services.cloudmacs // null) == null
  ' >/dev/null

test "$(docker inspect --format '{{.State.Health.Status}}' \
  securityos-tor-1)" = "healthy"
docker network inspect securityos_securenet >/dev/null
if docker container inspect securityos-cloudmacs >/dev/null 2>&1; then
  printf '%s\n' "Cloudmacs must remain absent from production" >&2
  exit 1
fi
if docker network inspect securityos_cloudmacs-net >/dev/null 2>&1; then
  printf '%s\n' "The retired Cloudmacs network must remain absent" >&2
  exit 1
fi

proxy_networks="$(docker inspect --format \
  '{{json .NetworkSettings.Networks}}' npm-attachment)"
printf '%s\n' "$proxy_networks" | grep -q 'securityos_securenet'
if printf '%s\n' "$proxy_networks" | grep -q 'securityos_cloudmacs-net'; then
  printf '%s\n' "Reverse proxy still has a retired network attachment" >&2
  exit 1
fi
curl --fail --silent --show-error --output /dev/null \
  http://127.0.0.1:3002/
```

Record the exact companion container IDs so post-cutover checks can prove they
were not recreated. Preserve the dirty production Compose file and patch as
rollback evidence, then give the running web image a cheap rollback tag. Do not
tag or replace Tor images, and do not recreate Cloudmacs.

```sh
old_tor_container="$(docker inspect --format '{{.Id}}' securityos-tor-1)"
old_proxy_container="$(docker inspect --format '{{.Id}}' npm-attachment)"
old_securenet="$(docker network inspect --format '{{.Id}}' \
  securityos_securenet)"

[[ "$old_tor_container" =~ ^[0-9a-f]{64}$ ]]
[[ "$old_proxy_container" =~ ^[0-9a-f]{64}$ ]]
[[ "$old_securenet" =~ ^[0-9a-f]{64}$ ]]

test ! -e "$rollback_root"
install -d -m 0700 "$rollback_root"
cp --preserve=all "$prod_compose" "$rollback_root/docker-compose.yml"
rollback_image_ref="securityos-web:rollback-${rollback_id}"
docker image tag "$old_web_image" "$rollback_image_ref"
test "$(docker image inspect --format '{{.Id}}' \
  "$rollback_image_ref")" = "$old_web_image"

# Preserve both reviewed release files as evidence, then derive a dedicated
# rollback override from the old release by changing its sole image field to the
# protected rollback tag. The rollback service hash is intentionally distinct.
old_release_evidence="$rollback_root/docker-compose.release.previous.yml"
cp --preserve=all "$old_release" "$old_release_evidence"
cp --preserve=all "$candidate_release" \
  "$rollback_root/docker-compose.release.candidate.yml"
rollback_release="$rollback_root/docker-compose.release.rollback.yml"
test "$(grep --count '^    image:' "$old_release")" = "1"
sed "s|^    image:.*$|    image: ${rollback_image_ref}|" \
  "$old_release" >"${rollback_release}.tmp"
install -o root -g root -m 0600 "${rollback_release}.tmp" "$rollback_release"
rm -- "${rollback_release}.tmp"
cp --preserve=all "$prod_exclusion" \
  "$rollback_root/ionos-no-cloudmacs.override.yml"
chmod 0600 "$rollback_release" \
  "$old_release_evidence" \
  "$rollback_root/docker-compose.release.candidate.yml" \
  "$rollback_root/ionos-no-cloudmacs.override.yml"
rollback_release_sha256="$(sha256sum "$rollback_release" | awk '{ print $1 }')"
[[ "$rollback_release_sha256" =~ ^[0-9a-f]{64}$ ]]
docker compose -p securityos -f "$prod_compose" -f "$rollback_release" \
  -f "$prod_exclusion" config --format json | \
  jq --exit-status --arg rollback_image_ref "$rollback_image_ref" '
    .services.web.image == $rollback_image_ref and
    .services.web.container_name == "securityos" and
    (.services.web.build // null) == null and
    (.services.web.tmpfs | sort) ==
      ["/SecurityOS/.next/cache", "/home/node/.cache", "/tmp"] and
    (.services.cloudmacs // null) == null
  ' >/dev/null
rollback_web_hash="$(docker compose -p securityos -f "$prod_compose" \
  -f "$rollback_release" -f "$prod_exclusion" \
  config --hash web | awk '$1 == "web" { print $2 }')"
[[ "$rollback_web_hash" =~ ^[0-9a-f]{64}$ ]]
test ! -e "$prod_root/old.ymo" || \
  cp --preserve=all "$prod_root/old.ymo" "$rollback_root/old.ymo"
GIT_OPTIONAL_LOCKS=0 git -C "$prod_root" rev-parse HEAD \
  >"$rollback_root/source-commit.txt"
GIT_OPTIONAL_LOCKS=0 git -C "$prod_root" status --short --branch \
  >"$rollback_root/working-tree-status.txt"
GIT_OPTIONAL_LOCKS=0 git -C "$prod_root" diff --binary \
  >"$rollback_root/working-tree.patch"
printf '%s\n' "$old_web_image" >"$rollback_root/web-image-id.txt"
printf '%s\n' "$old_web_ref" >"$rollback_root/web-image-ref.txt"

# Persist every value needed for rollback before cutover. The pointer makes the
# state discoverable after an Evelin/SSH disconnect; neither file contains a
# credential. Write both atomically and keep them root-only.
state_file="$rollback_root/state.env"
state_tmp="${state_file}.tmp"
active_state="/root/securityos-rollbacks/active-web-state"
active_tmp="${active_state}.tmp"

printf '%s\n' \
  "release_id=$(printf '%q' "$release_id")" \
  "image_ref=$(printf '%q' "$image_ref")" \
  "candidate_image=$(printf '%q' "$candidate_image")" \
  "prod_root=$(printf '%q' "$prod_root")" \
  "runtime_root=$(printf '%q' "$runtime_root")" \
  "prod_compose=$(printf '%q' "$prod_compose")" \
  "candidate_release=$(printf '%q' "$candidate_release")" \
  "candidate_runtime_env=$(printf '%q' "$candidate_runtime_env")" \
  "old_release_evidence=$(printf '%q' "$old_release_evidence")" \
  "rollback_release=$(printf '%q' "$rollback_release")" \
  "prod_exclusion=$(printf '%q' "$prod_exclusion")" \
  "prod_compose_sha256=$(printf '%q' "$prod_compose_sha256")" \
  "candidate_release_sha256=$(printf '%q' "$candidate_release_sha256")" \
  "candidate_runtime_env_sha256=$(printf '%q' \
    "$candidate_runtime_env_sha256")" \
  "old_release_sha256=$(printf '%q' "$old_release_sha256")" \
  "rollback_release_sha256=$(printf '%q' "$rollback_release_sha256")" \
  "prod_exclusion_sha256=$(printf '%q' "$prod_exclusion_sha256")" \
  "rollback_id=$(printf '%q' "$rollback_id")" \
  "rollback_image_ref=$(printf '%q' "$rollback_image_ref")" \
  "old_web_image=$(printf '%q' "$old_web_image")" \
  "old_web_ref=$(printf '%q' "$old_web_ref")" \
  "old_tor_container=$(printf '%q' "$old_tor_container")" \
  "old_proxy_container=$(printf '%q' "$old_proxy_container")" \
  "old_securenet=$(printf '%q' "$old_securenet")" \
  "old_web_hash=$(printf '%q' "$old_web_hash")" \
  "candidate_web_hash=$(printf '%q' "$candidate_web_hash")" \
  "rollback_web_hash=$(printf '%q' "$rollback_web_hash")" \
  >"$state_tmp"
chmod 0600 "$state_tmp"
mv -- "$state_tmp" "$state_file"
printf '%s\n' "$state_file" >"$active_tmp"
chmod 0600 "$active_tmp"
mv -- "$active_tmp" "$active_state"
sync

test "$(stat --format='%u:%a' "$state_file")" = "0:600"
test "$(cat "$active_state")" = "$state_file"

# The loaded image and installed override are durable; remove only this release's
# remaining verified upload metadata and then the now-empty staging directory.
remote_archive="/tmp/securityos-upload-${release_id}/securityos-web-${release_id}.tar.gz"
rm -- "${remote_archive}.sha256" "${remote_archive}.image-id" \
  "${remote_archive}.capacity"
rmdir -- "/tmp/securityos-upload-${release_id}"
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
  --env-file "$candidate_runtime_env" \
  --read-only \
  --tmpfs /tmp \
  --tmpfs /SecurityOS/.next/cache \
  --tmpfs /home/node/.cache \
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

test "$(docker inspect --format '{{.Config.User}}' "$smoke")" = "node"

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

If either probe fails, stop here. The production web and Tor containers are
still untouched, and Cloudmacs remains absent.

## 5. Replace only the exact web container

Run this as one Bash block. It reloads the root-owned state, validates both the
captured old release and candidate three-file models, and automatically performs
a web-only rollback if recreation or a post-cutover check fails. A failed
automatic rollback still leaves the state pointer available for the reconnect
procedure below.

```sh
test -n "${BASH_VERSION:-}"
set -Eeuo pipefail
umask 077

active_state="/root/securityos-rollbacks/active-web-state"
test "$(stat --format='%u:%a' "$active_state")" = "0:600"
state_file="$(cat "$active_state")"
case "$state_file" in
  /root/securityos-rollbacks/*/state.env) ;;
  *) printf '%s\n' "Invalid rollback-state path" >&2; exit 1 ;;
esac
test "$(stat --format='%u:%a' "$state_file")" = "0:600"
# This file was generated by the root-only block in section 3.
# shellcheck disable=SC1090
source "$state_file"

[[ "$release_id" =~ ^[0-9a-f]{12}$ ]]
[[ "$candidate_image" =~ ^sha256:[0-9a-f]{64}$ ]]
[[ "$old_web_image" =~ ^sha256:[0-9a-f]{64}$ ]]
[[ "$old_tor_container" =~ ^[0-9a-f]{64}$ ]]
[[ "$old_proxy_container" =~ ^[0-9a-f]{64}$ ]]
[[ "$old_securenet" =~ ^[0-9a-f]{64}$ ]]
[[ "$old_web_hash" =~ ^[0-9a-f]{64}$ ]]
[[ "$candidate_web_hash" =~ ^[0-9a-f]{64}$ ]]
[[ "$prod_compose_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$candidate_release_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$candidate_runtime_env_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$old_release_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$rollback_release_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$prod_exclusion_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$rollback_id" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]
test "$image_ref" = "securityos:${release_id}"
test "$rollback_image_ref" = "securityos-web:rollback-${rollback_id}"
test -n "$old_web_ref"
test "$state_file" = \
  "/root/securityos-rollbacks/${rollback_id}/state.env"
test "$prod_root" = "/root/secos/securityos"
test "$runtime_root" = "/root/securityos-runtime"
test "$prod_compose" = "$prod_root/docker-compose.yml"
test "$candidate_release" = \
  "$runtime_root/docker-compose.release-${release_id}.yml"
test "$candidate_runtime_env" = \
  "$runtime_root/securityos.env"
test "$old_release_evidence" = \
  "/root/securityos-rollbacks/${rollback_id}/docker-compose.release.previous.yml"
test "$rollback_release" = \
  "/root/securityos-rollbacks/${rollback_id}/docker-compose.release.rollback.yml"
test "$prod_exclusion" = \
  "/root/securityos-runtime/ionos-no-cloudmacs.override.yml"
test "$(stat --format='%u:%a' "$candidate_release")" = "0:600"
test "$(stat --format='%u:%a' "$candidate_runtime_env")" = "0:600"
test "$(stat --format='%u:%a' "$rollback_release")" = "0:600"
test "$(stat --format='%u:%a' "$prod_exclusion")" = "0:600"
test "$(sha256sum "$prod_compose" | awk '{ print $1 }')" = \
  "$prod_compose_sha256"
test "$(sha256sum "$candidate_release" | awk '{ print $1 }')" = \
  "$candidate_release_sha256"
test "$(sha256sum "$candidate_runtime_env" | awk '{ print $1 }')" = \
  "$candidate_runtime_env_sha256"
test "$(sha256sum "$old_release_evidence" | awk '{ print $1 }')" = \
  "$old_release_sha256"
test "$(sha256sum "$rollback_release" | awk '{ print $1 }')" = \
  "$rollback_release_sha256"
test "$(sha256sum "$prod_exclusion" | awk '{ print $1 }')" = \
  "$prod_exclusion_sha256"

assert_companions_unchanged() {
  local dormant_path
  local running_mount_sources

  test "$(docker inspect --format '{{.Id}}' securityos-tor-1)" = \
    "$old_tor_container" || return 1
  test "$(docker inspect --format '{{.Id}}' npm-attachment)" = \
    "$old_proxy_container" || return 1
  test "$(docker network inspect --format '{{.Id}}' \
    securityos_securenet)" = "$old_securenet" || return 1
  ! docker container inspect securityos-cloudmacs >/dev/null 2>&1 || return 1
  ! docker network inspect securityos_cloudmacs-net >/dev/null 2>&1 || return 1
  test "$(docker inspect --format '{{.State.Running}}' securityos-tor-1)" = \
    "true" || return 1
  test "$(docker inspect --format '{{.State.Health.Status}}' \
    securityos-tor-1)" = "healthy" || return 1
  test "$(docker inspect --format '{{.State.Running}}' npm-attachment)" = \
    "true" || return 1
  docker inspect --format '{{json .NetworkSettings.Networks}}' \
    npm-attachment | jq --exit-status \
    'has("securityos_securenet") and (has("securityos_cloudmacs-net") | not)' \
    >/dev/null || return 1
  docker inspect --format '{{json .NetworkSettings.Networks}}' \
    securityos-tor-1 | jq --exit-status \
    'has("securityos_securenet")' >/dev/null || return 1
  running_mount_sources="$(docker ps --quiet | xargs --no-run-if-empty \
    docker inspect --format '{{range .Mounts}}{{println .Source}}{{end}}')" || \
    return 1
  for dormant_path in \
    /root/.cloudmacs.d \
    /root/.spacemacs.d \
    /root/cloudmacs-data \
    /root/cloudmacs-telega \
    /root/whatsappel; do
    ! printf '%s\n' "$running_mount_sources" | \
      grep --fixed-strings --line-regexp -- "$dormant_path" || return 1
  done
}

assert_web_release() {
  local expected_image="$1"
  local expected_ref="$2"
  local expected_hash="$3"
  local fs_index
  local headers
  local icon_size

  test "$(docker inspect --format '{{.Name}}' securityos)" = "/securityos" || \
    return 1
  test "$(docker inspect --format \
    '{{index .Config.Labels "com.docker.compose.project"}}' securityos)" = \
    "securityos" || return 1
  test "$(docker inspect --format \
    '{{index .Config.Labels "com.docker.compose.service"}}' securityos)" = \
    "web" || return 1
  test "$(docker inspect --format '{{.Config.Image}}' securityos)" = \
    "$expected_ref" || return 1
  test "$(docker inspect --format '{{.Image}}' securityos)" = \
    "$expected_image" || return 1
  test "$(docker inspect --format \
    '{{index .Config.Labels "com.docker.compose.config-hash"}}' securityos)" = \
    "$expected_hash" || return 1
  test "$(docker inspect --format '{{.State.Running}}' securityos)" = \
    "true" || return 1
  docker inspect --format '{{json .Config.Env}}' securityos | \
    jq --exit-status \
      'map(select(startswith("NEXT_PUBLIC_ENABLE_CLOUDMACS="))) ==
       ["NEXT_PUBLIC_ENABLE_CLOUDMACS=false"]' >/dev/null || return 1
  docker inspect --format '{{json .NetworkSettings.Ports}}' securityos | \
    jq --exit-status '
      [. | to_entries[] | select(.value != null)] as $published |
      ($published | length) == 1 and
      $published[0].key == "3000/tcp" and
      ($published[0].value | length) >= 1 and
      all($published[0].value[]; .HostPort == "3002")
    ' >/dev/null || return 1
  docker inspect --format '{{json .NetworkSettings.Networks}}' securityos | \
    jq --exit-status \
    '(keys | sort) == ["securityos_securenet"]' >/dev/null || return 1
  curl --fail --silent --show-error --output /dev/null \
    --retry 20 --retry-delay 2 --retry-connrefused \
    http://127.0.0.1:3002/ || return 1
  curl --fail --silent --show-error \
    http://127.0.0.1:3002/api/tor-status | \
    jq --exit-status '.configured == true and .tor == true' >/dev/null || \
    return 1
  curl --fail --silent --show-error \
    'http://127.0.0.1:3002/api/proxy?url=https%3A%2F%2Fcheck.torproject.org%2Fapi%2Fip' | \
    jq --exit-status '.IsTor == true' >/dev/null || return 1
  curl --fail --silent --show-error --output /dev/null \
    --retry 10 --retry-delay 3 https://os.securityops.co/ || return 1
  test "$(curl --silent --output /dev/null --write-out '%{http_code}' \
    http://127.0.0.1:3002/Users/Public/Desktop/Cloudmacs.url)" = "404" || \
    return 1
  test "$(curl --silent --output /dev/null --write-out '%{http_code}' \
    'http://127.0.0.1:3002/Users/Public/Start%20Menu/Cloudmacs.url')" = \
    "404" || return 1
  for icon_size in 16 32 48 96 144; do
    test "$(curl --silent --output /dev/null --write-out '%{http_code}' \
      "http://127.0.0.1:3002/System/Icons/${icon_size}x${icon_size}/emacs.webp")" = \
      "404" || return 1
  done
  fs_index="$(curl --fail --silent --show-error \
    http://127.0.0.1:3002/.index/fs.9p.json)" || return 1
  ! printf '%s\n' "$fs_index" | grep --fixed-strings --quiet 'Cloudmacs.url' || \
    return 1
  headers="$(curl --fail --silent --show-error --head \
    http://127.0.0.1:3002/)" || return 1
  ! printf '%s\n' "$headers" | \
    grep --extended-regexp --ignore-case --quiet \
      'https?://(localhost|127\.0\.0\.1):8090' || return 1
}

remove_exact_web() {
  if docker container inspect securityos >/dev/null 2>&1; then
    test "$(docker inspect --format '{{.Name}}' securityos)" = "/securityos" || \
      return 1
    test "$(docker inspect --format \
      '{{index .Config.Labels "com.docker.compose.project"}}' securityos)" = \
      "securityos" || return 1
    test "$(docker inspect --format \
      '{{index .Config.Labels "com.docker.compose.service"}}' securityos)" = \
      "web" || return 1
    docker stop securityos || return 1
    docker rm securityos || return 1
  fi
}

validate_release_stack() {
  local selected_release="$1"
  local expected_ref="$2"
  local expected_hash="$3"
  local expected_release_sha="$4"
  local rendered_hash

  test "$(sha256sum "$prod_compose" | awk '{ print $1 }')" = \
    "$prod_compose_sha256" || return 1
  test "$(sha256sum "$selected_release" | awk '{ print $1 }')" = \
    "$expected_release_sha" || return 1
  test "$(sha256sum "$prod_exclusion" | awk '{ print $1 }')" = \
    "$prod_exclusion_sha256" || return 1
  docker compose -p securityos -f "$prod_compose" -f "$selected_release" \
    -f "$prod_exclusion" config -q || return 1
  docker compose -p securityos -f "$prod_compose" -f "$selected_release" \
    -f "$prod_exclusion" config --format json | \
    jq --exit-status --arg expected_ref "$expected_ref" '
      .services.web.image == $expected_ref and
      .services.web.container_name == "securityos" and
      (.services.web.build // null) == null and
      (.services.web.tmpfs | sort) ==
        ["/SecurityOS/.next/cache", "/home/node/.cache", "/tmp"] and
      (.services.cloudmacs // null) == null
    ' >/dev/null || return 1
  rendered_hash="$(docker compose -p securityos -f "$prod_compose" \
    -f "$selected_release" -f "$prod_exclusion" \
    config --hash web | awk '$1 == "web" { print $2 }')" || return 1
  test "$rendered_hash" = "$expected_hash" || return 1
}

start_exact_web() {
  local selected_release="$1"
  local expected_ref="$2"
  local expected_hash="$3"
  local expected_release_sha="$4"

  validate_release_stack "$selected_release" "$expected_ref" \
    "$expected_hash" "$expected_release_sha" || return 1
  docker compose -p securityos -f "$prod_compose" -f "$selected_release" \
    -f "$prod_exclusion" up --detach --no-deps --no-build --pull never web || \
    return 1
}

rollback_web() {
  test "$(docker image inspect --format '{{.Id}}' \
    "$rollback_image_ref")" = "$old_web_image" || return 1
  remove_exact_web || return 1
  start_exact_web "$rollback_release" "$rollback_image_ref" \
    "$rollback_web_hash" "$rollback_release_sha256" || return 1
  assert_companions_unchanged || return 1
  assert_web_release "$old_web_image" "$rollback_image_ref" \
    "$rollback_web_hash" || return 1
}

cutover_web() {
  test "$(docker image inspect --format '{{.Id}}' "$image_ref")" = \
    "$candidate_image" || return 1
  web_container_touched=1
  remove_exact_web || return 1
  start_exact_web "$candidate_release" "$image_ref" "$candidate_web_hash" \
    "$candidate_release_sha256" || return 1
  assert_companions_unchanged || return 1
  assert_web_release "$candidate_image" "$image_ref" \
    "$candidate_web_hash" || return 1
}

preflight_cutover() {
  test "$old_web_ref" != "$image_ref" || return 1
  validate_release_stack "$rollback_release" "$rollback_image_ref" \
    "$rollback_web_hash" "$rollback_release_sha256" || return 1
  validate_release_stack "$candidate_release" "$image_ref" \
    "$candidate_web_hash" "$candidate_release_sha256" || return 1
  assert_companions_unchanged || return 1
  assert_web_release "$old_web_image" "$old_web_ref" "$old_web_hash" || \
    return 1
  test "$(docker image inspect --format '{{.Id}}' "$image_ref")" = \
    "$candidate_image" || return 1
  test "$(docker image inspect --format '{{.Id}}' \
    "$rollback_image_ref")" = "$old_web_image" || return 1
}

if ! preflight_cutover; then
  printf '%s\n' "Cutover preflight failed; production was not changed." >&2
  exit 1
fi

web_container_touched=0
if ! cutover_web; then
  if ((web_container_touched == 0)); then
    printf '%s\n' \
      "Candidate pre-cutover validation failed; production was untouched." \
      >&2
    exit 1
  fi
  printf '%s\n' "Candidate cutover failed; starting web-only rollback." >&2
  if rollback_web; then
    printf '%s\n' "Automatic web-only rollback succeeded." >&2
    exit 1
  fi
  printf '%s\n' \
    "AUTOMATIC ROLLBACK OR ITS VALIDATION FAILED. Reconnect and inspect using the persisted rollback state." \
    >&2
  exit 2
fi
```

Then validate Tor Browser, Clearnet Browser, ZUPT, Keywave, IRC, and GODS EYE
from a real browser. Keep both the candidate and rollback tags through the agreed
observation window.

## Rollback

If the same shell is still connected, run `rollback_web` from section 5. After a
disconnect, use this self-contained recovery block. It resolves the last state
file through the root-only pointer, validates every persisted identifier before
use, and replaces only the exact Compose `web` container with the dedicated
rollback override and immutable rollback tag. The ordered model remains base +
selected rollback release + exclusion.

```sh
test -n "${BASH_VERSION:-}"
set -Eeuo pipefail
umask 077

active_state="/root/securityos-rollbacks/active-web-state"
test "$(stat --format='%u:%a' "$active_state")" = "0:600"
state_file="$(cat "$active_state")"
case "$state_file" in
  /root/securityos-rollbacks/*/state.env) ;;
  *) printf '%s\n' "Invalid rollback-state path" >&2; exit 1 ;;
esac
test "$(stat --format='%u:%a' "$state_file")" = "0:600"
# shellcheck disable=SC1090
source "$state_file"

[[ "$old_web_image" =~ ^sha256:[0-9a-f]{64}$ ]]
[[ "$old_tor_container" =~ ^[0-9a-f]{64}$ ]]
[[ "$old_proxy_container" =~ ^[0-9a-f]{64}$ ]]
[[ "$old_securenet" =~ ^[0-9a-f]{64}$ ]]
[[ "$old_web_hash" =~ ^[0-9a-f]{64}$ ]]
[[ "$rollback_web_hash" =~ ^[0-9a-f]{64}$ ]]
[[ "$prod_compose_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$old_release_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$rollback_release_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$prod_exclusion_sha256" =~ ^[0-9a-f]{64}$ ]]
[[ "$rollback_id" =~ ^[0-9]{8}T[0-9]{6}Z$ ]]
test "$rollback_image_ref" = "securityos-web:rollback-${rollback_id}"
test -n "$old_web_ref"
test "$state_file" = \
  "/root/securityos-rollbacks/${rollback_id}/state.env"
test "$prod_root" = "/root/secos/securityos"
test "$runtime_root" = "/root/securityos-runtime"
test "$prod_compose" = "$prod_root/docker-compose.yml"
test "$rollback_release" = \
  "/root/securityos-rollbacks/${rollback_id}/docker-compose.release.rollback.yml"
test "$prod_exclusion" = \
  "/root/securityos-runtime/ionos-no-cloudmacs.override.yml"
test "$(stat --format='%u:%a' "$rollback_release")" = "0:600"
test "$(stat --format='%u:%a' "$prod_exclusion")" = "0:600"
test "$(sha256sum "$prod_compose" | awk '{ print $1 }')" = \
  "$prod_compose_sha256"
test "$(sha256sum "$rollback_release" | awk '{ print $1 }')" = \
  "$rollback_release_sha256"
test "$(sha256sum "$prod_exclusion" | awk '{ print $1 }')" = \
  "$prod_exclusion_sha256"
docker compose -p securityos -f "$prod_compose" -f "$rollback_release" \
  -f "$prod_exclusion" config -q
docker compose -p securityos -f "$prod_compose" -f "$rollback_release" \
  -f "$prod_exclusion" config --format json | \
  jq --exit-status --arg rollback_image_ref "$rollback_image_ref" '
    .services.web.image == $rollback_image_ref and
    .services.web.container_name == "securityos" and
    (.services.web.build // null) == null and
    (.services.web.tmpfs | sort) ==
      ["/SecurityOS/.next/cache", "/home/node/.cache", "/tmp"] and
    (.services.cloudmacs // null) == null
  ' >/dev/null
rendered_rollback_web_hash="$(docker compose -p securityos -f "$prod_compose" \
  -f "$rollback_release" -f "$prod_exclusion" \
  config --hash web | awk '$1 == "web" { print $2 }')"
test "$rendered_rollback_web_hash" = "$rollback_web_hash"
test "$(docker image inspect --format '{{.Id}}' \
  "$rollback_image_ref")" = "$old_web_image"

if docker container inspect securityos >/dev/null 2>&1; then
  test "$(docker inspect --format '{{.Name}}' securityos)" = "/securityos"
  test "$(docker inspect --format \
    '{{index .Config.Labels "com.docker.compose.project"}}' securityos)" = \
    "securityos"
  test "$(docker inspect --format \
    '{{index .Config.Labels "com.docker.compose.service"}}' securityos)" = \
    "web"
  docker stop securityos
  docker rm securityos
fi

docker compose -p securityos -f "$prod_compose" -f "$rollback_release" \
  -f "$prod_exclusion" up --detach --no-deps --no-build --pull never web

test "$(docker inspect --format '{{.Name}}' securityos)" = "/securityos"
test "$(docker inspect --format \
  '{{index .Config.Labels "com.docker.compose.project"}}' securityos)" = \
  "securityos"
test "$(docker inspect --format \
  '{{index .Config.Labels "com.docker.compose.service"}}' securityos)" = \
  "web"
test "$(docker inspect --format '{{.Config.Image}}' securityos)" = \
  "$rollback_image_ref"
test "$(docker inspect --format '{{.Image}}' securityos)" = \
  "$old_web_image"
test "$(docker inspect --format \
  '{{index .Config.Labels "com.docker.compose.config-hash"}}' securityos)" = \
  "$rollback_web_hash"
test "$(docker inspect --format '{{.State.Running}}' securityos)" = "true"
test "$(docker inspect --format '{{.Id}}' securityos-tor-1)" = \
  "$old_tor_container"
test "$(docker inspect --format '{{.Id}}' npm-attachment)" = \
  "$old_proxy_container"
test "$(docker network inspect --format '{{.Id}}' \
  securityos_securenet)" = "$old_securenet"
if docker container inspect securityos-cloudmacs >/dev/null 2>&1; then
  printf '%s\n' "Cloudmacs container exists after rollback" >&2
  exit 1
fi
if docker network inspect securityos_cloudmacs-net >/dev/null 2>&1; then
  printf '%s\n' "Cloudmacs network exists after rollback" >&2
  exit 1
fi
test "$(docker inspect --format '{{.State.Running}}' securityos-tor-1)" = \
  "true"
test "$(docker inspect --format '{{.State.Health.Status}}' \
  securityos-tor-1)" = "healthy"
test "$(docker inspect --format '{{.State.Running}}' npm-attachment)" = \
  "true"

docker inspect --format '{{json .NetworkSettings.Ports}}' securityos | \
  jq --exit-status '
    [. | to_entries[] | select(.value != null)] as $published |
    ($published | length) == 1 and
    $published[0].key == "3000/tcp" and
    ($published[0].value | length) >= 1 and
    all($published[0].value[]; .HostPort == "3002")
  ' >/dev/null
docker inspect --format '{{json .NetworkSettings.Networks}}' securityos | \
  jq --exit-status \
  '(keys | sort) == ["securityos_securenet"]' >/dev/null
docker inspect --format '{{json .NetworkSettings.Networks}}' npm-attachment | \
  jq --exit-status \
  'has("securityos_securenet") and (has("securityos_cloudmacs-net") | not)' \
  >/dev/null
docker inspect --format '{{json .NetworkSettings.Networks}}' \
  securityos-tor-1 | jq --exit-status \
  'has("securityos_securenet")' >/dev/null

curl --fail --silent --show-error --output /dev/null \
  --retry 20 --retry-delay 2 --retry-connrefused \
  http://127.0.0.1:3002/
curl --fail --silent --show-error \
  http://127.0.0.1:3002/api/tor-status | \
  jq --exit-status '.configured == true and .tor == true' >/dev/null
curl --fail --silent --show-error \
  'http://127.0.0.1:3002/api/proxy?url=https%3A%2F%2Fcheck.torproject.org%2Fapi%2Fip' | \
  jq --exit-status '.IsTor == true' >/dev/null
curl --fail --silent --show-error --output /dev/null \
  --retry 10 --retry-delay 3 https://os.securityops.co/
```

The production checkout, dirty Compose model, persistent SecurityOS network, Tor
service, and dormant Cloudmacs bind-mount directories remain untouched throughout
the standard web cutover and rollback. The Cloudmacs runtime remains absent.

## Cloudmacs exclusion on the IONOS VPS

Cloudmacs source stays in this repository for optional, separately authorized
deployments, but it is not part of the IONOS production topology. Every release
must prove all of the following:

- no `securityos-cloudmacs` container exists;
- no `securityos_cloudmacs-net` network exists;
- `npm-attachment` is connected to `securityos_securenet` and not to a Cloudmacs
  network;
- the known Cloudmacs host directories are not mounted by any running container;
  and
- the production web image has no Cloudmacs catalog entry, desktop/Start shortcut,
  editor association, dedicated icon assets, or loopback CSP allowance.

The removal rollback directory and exact rollback image tag may be retained
during the observation window. The dormant host directories are user/recovery
data: do not mount, modify, or delete them during a SecurityOS release. Re-enabling
Cloudmacs requires separate authorization and its own rollback-reviewed plan; an
ordinary web deployment must never recreate it.

### One-time transition record

The authorized transition was completed on 2026-09-01. Do not rerun it against
the already-clean topology. Before changing production, the operator resolved the
exact container, image, network, proxy attachment, and mount sources; verified the
Compose project/service labels; and created the root-only rollback snapshot
`/root/securityos-rollbacks/20260901T215828Z-cloudmacs-removal`. That snapshot
contains the redacted container, image, network, reverse-proxy, and effective
Compose evidence plus the exact rollback image tag.

The transition then detached only `npm-attachment` from
`securityos_cloudmacs-net`, stopped and removed only `securityos-cloudmacs`,
removed the now-empty dedicated network, and removed only the active
`securityos-cloudmacs:latest` tag. It did not prune Docker, touch Tor or web, or
delete bind data. A later audit found the stale Nginx Proxy Manager host ID 59 for
`emacs.securityops.co`; its SQLite database and generated configuration were
copied into the same root-only rollback directory before that exact host was
disabled/deleted and Nginx was syntax-checked and reloaded. Certificates and
unrelated hosts were not changed. Post-transition validation proved the web, Tor,
and proxy container IDs were unchanged; the retired container/network, active
image tag, proxy-host row/configuration, and public TLS virtual host were absent;
and no running container mounted the dormant directories. The durable root-only
Compose override prevents recreation only when it is applied last in the required
base + selected release + exclusion stack; it is not auto-loaded.

If rollback is separately authorized during the observation window, use only the
captured snapshot and exact rollback tag. First validate every stored identifier,
reconstruct only the captured Cloudmacs service/network attachment, and prove the
web, Tor, and proxy IDs did not change. Never infer a rollback model from a newer
release file and never delete or rewrite the preserved host directories.

## Forbidden cleanup operations

On this multi-application VPS, never use the following as part of a SecurityOS
release:

- `docker system prune`, `docker image prune`, `docker builder prune`,
  `docker volume prune`, or broad image deletion;
- `docker compose down`, `down -v`, `rm -v`, or `--rmi all`;
- stopping, removing, rebuilding, or recreating `securityos-tor-1` during a
  normal web release;
- recreating `securityos-cloudmacs`, its dedicated network, or its reverse-proxy
  attachment;
- deletion of unnamed or apparently unused volumes without documented ownership;
- deletion of Cloudmacs bind-mount directories;
- `git pull`, `git reset --hard`, `git clean`, or replacement of
  `/root/secos/securityos`;
- overwriting `/root/secos/securityos/docker-compose.yml` with the release copy;
- credentials in Git URLs, command arguments, Compose files, artifacts, or
  documentation.

Any later cleanup must resolve exact image tags or paths first and confirm that
the rollback window has closed. Exact unused SecurityOS web or Cloudmacs image
tags may then be removed; never use a broad prune. Do not remove a rollback tag
until rollback is explicitly retired.
