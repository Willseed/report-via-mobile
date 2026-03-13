#!/usr/bin/env python3
"""Static file server that omits the Server response header.

Usage:
    python3 serve-static-no-server-header.py --port 4200 --directory dist/

Serves files from --directory on --port, behaving like `python3 -m http.server`
but without leaking Python/version information in the Server header.
"""

import argparse
import http.server
import os


class _NoServerHeaderHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler with the Server header removed."""

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

    handler = lambda *a, **kw: _NoServerHeaderHandler(  # noqa: E731
        *a, directory=directory, **kw
    )

    with http.server.ThreadingHTTPServer(("", args.port), handler) as httpd:
        print(f"Serving {directory!r} on http://localhost:{args.port}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
