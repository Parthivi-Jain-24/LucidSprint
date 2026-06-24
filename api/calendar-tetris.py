import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from lucid_core import JsonRoute, optimize_calendar


class handler(JsonRoute):
    route = staticmethod(optimize_calendar)
