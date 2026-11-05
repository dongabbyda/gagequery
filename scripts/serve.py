#!/usr/bin/env python3
"""Serve dist/ locally with the same response headers as production (public/_headers).

Usage: python3 scripts/serve.py [port]      default port 8000
"""
import functools, http.server, os, socketserver, sys, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')


def load_headers(path=os.path.join(ROOT, 'public', '_headers')):
    """Parse the '/*' block of a Netlify/Cloudflare-style _headers file."""
    out = []
    for line in open(path, encoding='utf-8'):
        if line.startswith((' ', '\t')) and ':' in line:
            k, v = line.strip().split(':', 1)
            out.append((k.strip(), v.strip()))
    return out


HEADERS = load_headers()


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        for k, v in HEADERS:
            self.send_header(k, v)
        super().end_headers()

    def log_message(self, *args):
        pass


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def start(port=0, root=DIST):
    """Start in a background thread; returns the server (server.server_address[1] is the port)."""
    srv = Server(('127.0.0.1', port), functools.partial(Handler, directory=root))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv


if __name__ == '__main__':
    if not os.path.exists(os.path.join(DIST, 'index.html')):
        sys.exit('dist/index.html is missing. Run: npm run build')
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    srv = Server(('127.0.0.1', port), functools.partial(Handler, directory=DIST))
    print('GageQuery on http://127.0.0.1:%d  (Ctrl+C to stop)' % port)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
