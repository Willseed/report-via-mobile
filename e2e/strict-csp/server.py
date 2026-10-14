"""Production scan server with two real, hash-valid PWA releases for browser tests.

Release B changes a precached text resource and its manifest hash. HTML, JavaScript,
CSS and their CSP remain the unmodified production build. No files are overwritten.
The release switch only exists on this loopback test server, never in the app.
"""

import argparse
from functools import partial
import hashlib
from http.server import ThreadingHTTPServer
import importlib.util
import json
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]
HARNESS_PATH = ROOT / ".github/scripts/serve-static-no-server-header.py"
SPEC = importlib.util.spec_from_file_location("production_scan_server", HARNESS_PATH)
HARNESS = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(HARNESS)
MANIFEST_PATH = "/ngsw.json"
UPDATE_RESOURCE_PATH = "/llms.txt"


class ReleaseState:
    def __init__(self, directory):
        original_manifest = (directory / MANIFEST_PATH.lstrip("/")).read_bytes()
        original_resource = (directory / UPDATE_RESOURCE_PATH.lstrip("/")).read_bytes()
        updated_resource = original_resource + b"\nCSP browser test release B.\n"
        updated_manifest = json.loads(original_manifest)
        if UPDATE_RESOURCE_PATH not in updated_manifest["hashTable"]:
            raise ValueError("The update probe must be a hashed PWA resource.")
        # Angular manifests use SHA-1 for asset consistency, not authentication.
        # nosemgrep: python.lang.security.insecure-hash-algorithms.insecure-hash-algorithm-sha1
        updated_manifest["hashTable"][UPDATE_RESOURCE_PATH] = hashlib.sha1(
            updated_resource, usedforsecurity=False
        ).hexdigest()
        updated_manifest["timestamp"] += 1
        self.releases = {
            "a": {MANIFEST_PATH: original_manifest, UPDATE_RESOURCE_PATH: original_resource},
            "b": {
                MANIFEST_PATH: json.dumps(updated_manifest).encode("utf8"),
                UPDATE_RESOURCE_PATH: updated_resource,
            },
        }
        self.active = "a"


class ReleaseHandler(HARNESS._NoServerHeaderHandler):
    def __init__(self, *args, release_state, **kwargs):
        self.release_state = release_state
        super().__init__(*args, **kwargs)

    def do_GET(self):
        pathname = urlsplit(self.path).path
        release = self.release_state.releases[self.release_state.active]
        if pathname in release:
            self.send_bytes(
                release[pathname],
                "application/json" if pathname == MANIFEST_PATH else "text/plain; charset=utf-8",
            )
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/__csp-test-release":
            self.send_error(404)
            return
        if self.headers.get("Content-Length") != "1":
            self.send_error(400)
            return
        selected = self.rfile.read(1).decode("ascii", errors="replace")
        if selected not in self.release_state.releases:
            self.send_error(400)
            return
        self.release_state.active = selected
        self.send_bytes(b"ok", "text/plain")

    def send_bytes(self, content, content_type):
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=4300)
    args = parser.parse_args()
    directory = ROOT / "dist/report-via-mobile/browser"
    policy = HARNESS.build_content_security_policy(directory)
    handler = partial(
        ReleaseHandler,
        directory=directory,
        content_security_policy=policy,
        release_state=ReleaseState(directory),
    )
    with ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        server.serve_forever()


if __name__ == "__main__":
    main()
