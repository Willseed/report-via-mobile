"""DAST must observe the real Worker CSP while receiving the unchanged PWA asset bytes."""

from functools import partial
from http.server import ThreadingHTTPServer
import importlib.util
from pathlib import Path
import shutil
import subprocess
import tempfile
from threading import Thread
import unittest
from unittest.mock import patch
from urllib.request import urlopen


SCRIPT_DIRECTORY = Path(__file__).resolve().parent
ROOT = SCRIPT_DIRECTORY.parent.parent
SPEC = importlib.util.spec_from_file_location(
    "scan_server", SCRIPT_DIRECTORY / "serve-static-no-server-header.py"
)
scan_server = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(scan_server)


class ScanServerTest(unittest.TestCase):
    def test_passes_html_as_input_without_a_directory_command_argument(self):
        with tempfile.TemporaryDirectory(prefix="scan build -- ") as directory:
            homepage = Path(directory) / "index.html"
            shutil.copyfile(ROOT / "worker/fixtures/auto-csp.html", homepage)
            with patch.object(scan_server.subprocess, "run", wraps=subprocess.run) as run:
                policy = scan_server.build_content_security_policy(directory)
            self.assertEqual(
                run.call_args.args[0],
                ["node", str(SCRIPT_DIRECTORY / "scan-csp-header.mjs")],
            )
            self.assertEqual(run.call_args.kwargs["input"], homepage.read_bytes())
            self.assertIn("script-src 'sha256-", policy)

    def test_serves_worker_csp_without_changing_html(self):
        with tempfile.TemporaryDirectory() as directory:
            homepage = Path(directory) / "index.html"
            shutil.copyfile(ROOT / "worker/fixtures/auto-csp.html", homepage)
            shutil.copyfile(homepage, Path(directory) / "404.html")
            (Path(directory) / "asset.txt").write_text("static asset", encoding="utf8")
            policy = scan_server.build_content_security_policy(directory)
            self.assertIn("default-src 'self'", policy)
            self.assertIn("form-action 'self'", policy)
            self.assertIn("frame-ancestors 'none'", policy)
            self.assertIn("script-src 'sha256-", policy)
            handler = partial(
                scan_server._NoServerHeaderHandler,
                directory=directory,
                content_security_policy=policy,
            )
            with ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
                thread = Thread(target=server.serve_forever)
                thread.start()
                try:
                    origin = f"http://127.0.0.1:{server.server_port}"
                    for path in ["/", "/index.html", "/404.html"]:
                        with urlopen(origin + path) as response:
                            self.assertEqual(response.headers["Content-Security-Policy"], policy)
                            self.assertIsNone(response.headers.get("Server"))
                            self.assertEqual(response.read(), homepage.read_bytes())
                    with urlopen(origin + "/asset.txt") as response:
                        self.assertIsNone(response.headers.get("Content-Security-Policy"))
                finally:
                    server.shutdown()
                    thread.join()

    def test_rejects_build_without_script_hashes(self):
        with tempfile.TemporaryDirectory() as directory:
            shutil.copyfile(ROOT / "worker/fixtures/legacy.html", Path(directory) / "index.html")
            with self.assertRaises(subprocess.CalledProcessError):
                scan_server.build_content_security_policy(directory)


if __name__ == "__main__":
    unittest.main()
