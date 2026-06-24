import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from lucid_core import JsonRoute, draft_email


class handler(JsonRoute):
    route = staticmethod(draft_email)
