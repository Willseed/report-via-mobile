#!/usr/bin/env python3
"""Static file server that omits the Server response header.

Usage:
    python3 serve-static-no-server-header.py --port 4200 --directory dist/

Serves files from --directory on --port, behaving like `python3 -m http.server`
but without leaking Python/version information in the Server header.
HTML responses use the same CSP builder as the production Cloudflare Worker.
"""

import argparse
import http.server
import os
from pathlib import Path
import subprocess


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


def build_content_security_policy(directory):
    """Read build hashes through the actual Worker policy builder without altering HTML."""
    script = Path(__file__).with_name("scan-csp-header.mjs")
    result = subprocess.run(
        ["node", str(script), str(Path(directory) / "index.html")],
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def main():
    parser = argparse.ArgumentParser(
        description="Serve static files without leaking version info in the Server header."
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8000,
        help="TCP port to listen on (default: 8000)",
    )
    parser.add_argument(
        "--directory",
        default=".",
        help="Directory to serve files from (default: current directory)",
    )
    args = parser.parse_args()

    directory = os.path.abspath(args.directory)
    if not os.path.isdir(directory):
        parser.error(f"Directory not found: {directory}")
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
