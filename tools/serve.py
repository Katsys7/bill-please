"""Serve the portable site locally with no browser cache and no dependencies."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from pathlib import Path
import argparse

SITE = Path(__file__).resolve().parents[1] / "site"

class PreviewHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=4173)
    address = ("127.0.0.1", parser.parse_args().port)
    print(f"bill, please: http://{address[0]}:{address[1]}/")
    print("Press Ctrl+C to stop. If the port is occupied, stop the earlier preview first.")
    try:
        ThreadingHTTPServer(address, partial(PreviewHandler, directory=str(SITE))).serve_forever()
    except KeyboardInterrupt:
        print("\nPreview stopped.")
