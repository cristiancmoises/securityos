# Shared forwarding health check

`home-healthcheck.sh` monitors the existing shared Evelin forwards for Matrix,
SecurityOS and Segfault. Install it only after reviewing the service names and
loopback ports against the target host. It is an operator script, not part of
the web container, and requires `curl`, `logger` and `systemctl`.

- All probes healthy: success; retain the existing auxiliary Tor bridge checks.
- Some probes fail: log each service's state and exit 1; keep healthy streams.
- All probes fail: restart the shared forwarding service once, then probe again.
  A failed restart or incomplete recovery still exits 1.

This policy prevents an unavailable application from restarting unrelated
healthy forwards every timer cycle. An exit code of 1 still requires attention;
it does not mean every forward is down. Configure service alerts accordingly.
There is no automatic installation or timer modification in this directory.

Run the isolated regression checks without network or service access:

```sh
sh -n deploy/evelin/home-healthcheck.sh
python3 deploy/evelin/test_home_healthcheck.py deploy/evelin/home-healthcheck.sh
```

The tests substitute every external command and cover all eight initial probe
combinations, failed/partial recovery, restart failure, and auxiliary recovery.

Before replacing a live copy, save its exact bytes, owner and permissions in a
root-only directory. Install by atomic rename, preserving those attributes.
Observe at least two timer cycles with an intentionally unchanged partial
failure: the shared service PID must remain stable, healthy endpoints must still
respond, and the monitor must continue to report failure. Roll back by atomically
restoring the saved script; restarting the tunnel is unnecessary.

## Português

O monitor testa cada encaminhamento separadamente. Uma falha parcial continua
visível com código de saída 1, mas preserva as conexões saudáveis. Somente a falha
de todos os testes permite uma tentativa de reinício e uma nova verificação.
Revise portas e nomes dos serviços antes da instalação. Preserve uma cópia
restrita do arquivo original e acompanhe pelo menos dois ciclos do temporizador.
