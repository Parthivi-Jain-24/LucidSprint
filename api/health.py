import sys
from pathlib import Path
from http.server import BaseHTTPRequestHandler

sys.path.append(str(Path(__file__).resolve().parent))

from lucid_core import send_json


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        send_json(self, {"ok": True, "name": "LucidSprint Vercel API"})

    def do_POST(self):
        send_json(self, {"ok": True, "name": "LucidSprint Vercel API"})
