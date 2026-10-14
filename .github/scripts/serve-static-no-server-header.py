#!/usr/bin/env python3
"""Serve the repository's production build for local ZAP scans.

Usage:
    python3 .github/scripts/serve-static-no-server-header.py --port 4200

Serves dist/report-via-mobile/browser relative to the repository root, without
leaking Python/version information in the Server header.
HTML responses use the same CSP builder as the production Cloudflare Worker.
All responses mirror its cross-origin isolation headers, including worker scripts.
"""

import argparse
import http.server
from pathlib import Path
import subprocess


BUILD_DIRECTORY = Path(__file__).resolve().parents[2] / "dist/report-via-mobile/browser"


class _NoServerHeaderHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler with the Server header removed."""

    def __init__(self, *args, content_security_policy, **kwargs):
        self.content_security_policy = content_security_policy
        super().__init__(*args, **kwargs)

    def send_response(self, code, message=None):
        # Call the grandparent (BaseHTTPRequestHandler) to write the status
        # line and Date header, skipping SimpleHTTPRequestHandler entirely so
        # we can intercept before 'Server' is added.
        http.server.BaseHTTPRequestHandler.send_response(self, code, message)

    def send_header(self, keyword, value):
        # Drop the Server header unconditionally.
        if keyword.lower() == "server":
            return
        super().send_header(keyword, value)
        if keyword.lower() == "content-type" and value.lower().startswith("text/html"):
            super().send_header("Content-Security-Policy", self.content_security_policy)

    def end_headers(self):
        super().send_header("Cross-Origin-Opener-Policy", "same-origin")
        super().send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()


def build_content_security_policy(directory):
    """Read build hashes through the actual Worker policy builder without altering HTML."""
    script = Path(__file__).with_name("scan-csp-header.mjs")
    result = subprocess.run(
        ["node", str(script)],
        input=(Path(directory) / "index.html").read_bytes(),
        check=True,
        capture_output=True,
    )
    return result.stdout.decode("utf8").strip()


def main():
    parser = argparse.ArgumentParser(
        description="Serve the repository's production build with the Worker CSP for ZAP scans."
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="TCP port to listen on (default: 8000)",
    )
    args = parser.parse_args()

    directory = BUILD_DIRECTORY
    if not directory.is_dir():
        parser.error(f"Production build not found: {directory}. Run npm run build first.")
    content_security_policy = build_content_security_policy(directory)

    handler = lambda *a, **kw: _NoServerHeaderHandler(  # noqa: E731
        *a, directory=directory, content_security_policy=content_security_policy, **kw
    )

    with http.server.ThreadingHTTPServer(("", args.port), handler) as httpd:
        print(f"Serving {directory!r} on http://localhost:{args.port}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
