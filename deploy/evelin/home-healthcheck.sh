#!/bin/sh
set -u

probe_shared() {
  shared_healthy=0
  matrix_state=failed
  os_state=failed
  segfault_state=failed
  if curl -fsS --max-time 6 http://127.0.0.1:28080/_matrix/client/versions >/dev/null 2>&1; then
    matrix_state=healthy
    shared_healthy=$((shared_healthy + 1))
  fi
  if curl -fsS --max-time 6 http://127.0.0.1:28082/ >/dev/null 2>&1; then
    os_state=healthy
    shared_healthy=$((shared_healthy + 1))
  fi
  if curl -fsS --max-time 6 'http://127.0.0.1:28083/socket.io/?EIO=4&transport=polling' >/dev/null 2>&1; then
    segfault_state=healthy
    shared_healthy=$((shared_healthy + 1))
  fi
}

probe_shared
if [ "$shared_healthy" -eq 0 ]; then
  logger -t evelin-home-healthcheck 'All shared home probes failed; restarting their forwarding service once'
  if ! systemctl restart evelin-home-services-forward.service; then
    logger -t evelin-home-healthcheck 'Shared forwarding service restart failed'
    exit 1
  fi
  sleep 5
  probe_shared
fi
if [ "$shared_healthy" -ne 3 ]; then
  logger -t evelin-home-healthcheck "Shared tunnels degraded: matrix=$matrix_state os=$os_state segfault=$segfault_state; preserving healthy streams"
  exit 1
fi

for unit in evelin-home-tor-bridge-forward.service tor@bridge.service; do
  if ! systemctl is-active --quiet "$unit"; then
    logger -t evelin-home-healthcheck "$unit was inactive; restarting it"
    systemctl restart "$unit"
  fi
done
