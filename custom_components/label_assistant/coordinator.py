"""Polls the Label Printer add-on so its state can become HA entities.

The add-on has always exposed everything needed for this — `/health` returns
the printer list plus whatever currently needs a human — and its own comment
on `/attention` calls it "the endpoint Home Assistant polls". Nothing did, so
an empty roll or a jammed printer was visible only to someone who happened to
open the add-on's dashboard. This is the piece that was missing.

One request covers every printer: `/health` carries the printers (each with
its loaded label, `alr` block and roll level) and the attention list, so there
is no reason to fan out per entity.
"""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

import aiohttp

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import CONF_PRINTER_URL, DEFAULT_PRINTER_URL, DOMAIN

_LOGGER = logging.getLogger(__name__)

# The add-on re-reads the printer every 5s; polling it faster than half a
# minute would only add HTTP round trips to a number that cannot move that
# fast. A roll swap shows up within 30s, which is well inside "walked back
# to the laptop" territory.
SCAN_INTERVAL = timedelta(seconds=30)
REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10)


class PrinterCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    """Keeps one snapshot of the add-on's state for all printer entities."""

    def __init__(self, hass: HomeAssistant, entry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN} printers",
            update_interval=SCAN_INTERVAL,
            config_entry=entry,
        )

    @property
    def url(self) -> str:
        raw = self.config_entry.options.get(CONF_PRINTER_URL) or DEFAULT_PRINTER_URL
        return raw.strip().rstrip("/")

    async def _async_update_data(self) -> dict[str, Any]:
        session = async_get_clientsession(self.hass)
        try:
            async with session.get(
                f"{self.url}/health", timeout=REQUEST_TIMEOUT
            ) as resp:
                resp.raise_for_status()
                body = await resp.json(content_type=None)
        except (aiohttp.ClientError, TimeoutError) as err:
            # The add-on being down is itself worth showing, but as
            # "unavailable" on the entities rather than as a stack trace on
            # every tick.
            raise UpdateFailed(f"Label Printer add-on unreachable: {err}") from err
        if not isinstance(body, dict):
            raise UpdateFailed("Label Printer add-on returned an unexpected body")
        return body

    # -- helpers the entities read -----------------------------------------

    def printers(self) -> list[dict[str, Any]]:
        return [p for p in (self.data or {}).get("printers") or []
                if isinstance(p, dict) and p.get("name")]

    def printer(self, name: str) -> dict[str, Any]:
        for entry in self.printers():
            if entry.get("name") == name:
                return entry
        return {}

    def attention_for(self, name: str) -> dict[str, Any]:
        """The first thing wanting a human for this printer, or {}."""
        for item in (self.data or {}).get("attention") or []:
            if isinstance(item, dict) and item.get("printer") == name:
                return item
        return {}
