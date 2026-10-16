#!/usr/bin/env python3
"""Exercise the exact shell script with isolated command stubs and no network."""

import itertools
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(sys.argv.pop(1)).resolve()
STUB = """#!PYTHON
import json, os, pathlib, sys
root=pathlib.Path(os.environ["STUB_STATE"])
name=pathlib.Path(sys.argv[0]).name
args=sys.argv[1:]
with (root/"calls").open("a") as out: out.write(json.dumps([name,*args])+"\\n")
if name=="curl":
    assert args[:3]==["-fsS","--max-time","6"]
    port=int(args[-1].split(":")[2].split("/")[0])
    index={28080:0,28082:1,28083:2}[port]
    phase="AFTER" if (root/"restarted").exists() else "BEFORE"
    sys.exit(0 if os.environ["STUB_"+phase][index]=="1" else 22)
if name=="systemctl":
    if args[0]=="restart":
        if args[1]=="evelin-home-services-forward.service":
            (root/"restarted").touch()
            sys.exit(int(os.environ.get("STUB_RESTART_EXIT","0")))
        sys.exit(0)
    if args[0]=="is-active": sys.exit(0 if os.environ.get("STUB_AUX_ACTIVE","1")=="1" else 3)
sys.exit(0)
""".replace("PYTHON", sys.executable)


class WatchdogTests(unittest.TestCase):
    def run_case(self, before, after="111", restart_exit=0, aux_active=1):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            for name in ("curl", "systemctl", "logger", "sleep"):
                p = root / name
                p.write_text(STUB)
                p.chmod(0o700)
            env = {
                "PATH": str(root),
                "STUB_STATE": str(root),
                "STUB_BEFORE": before,
                "STUB_AFTER": after,
                "STUB_RESTART_EXIT": str(restart_exit),
                "STUB_AUX_ACTIVE": str(aux_active),
            }
            result = subprocess.run(
                ["/bin/sh", str(SCRIPT)],
                env=env,
                text=True,
                capture_output=True,
                timeout=5,
                check=False,
            )
            calls = [json.loads(s) for s in (root / "calls").read_text().splitlines()]
            restarts = [
                c
                for c in calls
                if c[:2] == ["systemctl", "restart"]
                and c[2] == "evelin-home-services-forward.service"
            ]
            probes = [c for c in calls if c[0] == "curl"]
            return result, calls, restarts, probes

    def test_all_eight_initial_health_combinations(self):
        for bits in itertools.product("01", repeat=3):
            before = "".join(bits)
            with self.subTest(before=before):
                result, calls, restarts, probes = self.run_case(before)
                expected_restart = int(before == "000")
                expected_exit = int(before not in {"000", "111"})
                self.assertEqual(len(restarts), expected_restart, calls)
                self.assertEqual(result.returncode, expected_exit, result.stderr)
                self.assertEqual(len(probes), 6 if expected_restart else 3)
                if expected_exit:
                    self.assertTrue(
                        any(
                            c[0] == "logger" and "degraded" in " ".join(c)
                            for c in calls
                        )
                    )

    def test_total_failure_recovers_only_once_and_stays_failed(self):
        result, _, restarts, probes = self.run_case("000", "000")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(restarts), 1)
        self.assertEqual(len(probes), 6)

    def test_partial_failure_after_recovery_remains_failed(self):
        result, _, restarts, probes = self.run_case("000", "110")
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(restarts), 1)
        self.assertEqual(len(probes), 6)

    def test_restart_command_failure_is_reported_without_retry(self):
        result, _, restarts, probes = self.run_case("000", restart_exit=1)
        self.assertEqual(result.returncode, 1)
        self.assertEqual(len(restarts), 1)
        self.assertEqual(len(probes), 3)

    def test_existing_auxiliary_unit_recovery_is_preserved(self):
        result, calls, restarts, probes = self.run_case("111", aux_active=0)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(restarts, [])
        self.assertEqual(len(probes), 3)
        self.assertEqual(
            [c[2] for c in calls if c[:2] == ["systemctl", "restart"]],
            ["evelin-home-tor-bridge-forward.service", "tor@bridge.service"],
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
