#!/usr/bin/env python3
"""Local preview server for the Tutee Connect Singapore landing page.

    python3 serve.py            # http://localhost:8000
    python3 serve.py 3000       # pick a port

Binds dual-stack (IPv6 + IPv4) so `localhost`, `127.0.0.1` and `[::1]` all
work — the stock `python3 -m http.server` binds IPv4 only, and on macOS
`localhost` resolves to `::1` first.

Serves from this file's own directory, so it doesn't matter where you run it
from. Sends no-cache headers so a browser reload always shows your latest edit.
"""
import http.server
import os
import socket
import socketserver
import sys
import webbrowser

try:
    sys.stdout.reconfigure(line_buffering=True)
except (AttributeError, ValueError):
    pass

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = dict(http.server.SimpleHTTPRequestHandler.extensions_map)
    extensions_map.update({
        '.webp': 'image/webp',
        '.woff2': 'font/woff2',
        '.js': 'text/javascript',
        '.mjs': 'text/javascript',
    })

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # always serve fresh files while editing
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        status = args[1] if len(args) > 1 else ''
        # only surface problems, not every 200
        if not str(status).startswith('2'):
            sys.stderr.write('  %s %s\n' % (status, args[0] if args else ''))


class DualStackServer(socketserver.ThreadingTCPServer):
    address_family = socket.AF_INET6
    daemon_threads = True
    allow_reuse_address = True

    def server_bind(self):
        # accept IPv4 connections on the same socket
        try:
            self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
        except (AttributeError, OSError):
            pass
        super().server_bind()


def bind(preferred):
    """Take the requested port, or the next free one. 'Address already in use'
    is the usual reason a local preview appears not to work."""
    for port in range(preferred, preferred + 20):
        try:
            return DualStackServer(('::', port), Handler), port
        except OSError:
            continue
    sys.exit('No free port between %d and %d. Close whatever is using them, '
             'or pass a port: python3 serve.py 4000' % (preferred, preferred + 19))


if __name__ == '__main__':
    if not os.path.exists(os.path.join(ROOT, 'index.html')):
        sys.exit('index.html is not next to serve.py — expected it in %s' % ROOT)

    server, PORT = bind(PORT)
    url = 'http://localhost:%d/' % PORT

    print('Tutee Connect Singapore — serving %s' % ROOT)
    print('')
    print('  Home page:    %s' % url)
    print('  Universities: %suniversities.html' % url)
    print('')
    if PORT != (int(sys.argv[1]) if len(sys.argv) > 1 else 8000):
        print('  (port %d was busy, used %d instead)' % (
            int(sys.argv[1]) if len(sys.argv) > 1 else 8000, PORT))
        print('')
    print('Leave this window open while you browse. Press Ctrl+C to stop.\n')
    try:
        webbrowser.open(url)
    except Exception:
        pass
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
