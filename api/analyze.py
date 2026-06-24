import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from lucid_core import JsonRoute, analyze


class handler(JsonRoute):
    route = staticmethod(analyze)
