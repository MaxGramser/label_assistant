"""Constants for Label Assistant."""

from __future__ import annotations

from typing import Final

DOMAIN: Final = "label_assistant"

# Keep in sync with manifest.json; busts the panel.js browser cache.
VERSION: Final = "0.4.0"

PANEL_URL_PATH: Final = "label-assistant"
PANEL_WEBCOMPONENT: Final = "label-assistant-panel"
PANEL_ICON: Final = "mdi:sticker-emoji"
PANEL_TITLE: Final = "Labels"
URL_BASE: Final = "/label_assistant_static"

CONF_PRINTER_URL: Final = "printer_url"
CONF_DEFAULT_PRINTER: Final = "default_printer"
DEFAULT_PRINTER_URL: Final = "http://local-label-printer:8000"

# DYMO 99014 (54 x 101 mm) at 300 dpi, portrait. Only a FALLBACK canvas for
# when the add-on cannot be reached (or is too old to report printers); the
# real geometry comes from GET /printers per printer (loaded/supported media
# with native_px) so nothing is hard-coded to one label.
# 639x1191 is what the add-on measures by pushing a blank page through
# cupsfilter and reading the raster header back — the size CUPS really
# produces. The w154h286 media NAME rounds up and lies, and the PaperDimension
# arithmetic that used to say 638 here is a dot short of the truth.
LABEL_DPI: Final = 300
LABEL_W: Final = 639
LABEL_H: Final = 1191
LABEL_MEDIA: Final = "w154h286"
LABEL_NAME: Final = "99014"

STORAGE_KEY: Final = f"{DOMAIN}.data"
STORAGE_VERSION: Final = 1

# Guard rails for stored designs (fabric JSON can embed uploaded images).
MAX_DESIGN_JSON: Final = 4_000_000
MAX_THUMBNAIL: Final = 400_000
MAX_PRINT_PNG: Final = 8_000_000
MAX_COPIES: Final = 10

SIGNAL_UPDATED: Final = f"{DOMAIN}_updated"


def resolve_language(hass) -> str:
    """NL when HA runs in Dutch, English for everything else."""
    raw = (getattr(hass.config, "language", None) or "").strip()
    return "nl" if raw.split("-")[0].lower() == "nl" else "en"


def localized(lang: str, nl: str, en: str) -> str:
    return nl if lang == "nl" else en
