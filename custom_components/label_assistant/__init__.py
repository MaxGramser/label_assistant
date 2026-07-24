"""The Label Assistant integration — a Canva-style editor for DYMO labels."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from pathlib import Path

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    DOMAIN,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    PANEL_WEBCOMPONENT,
    URL_BASE,
    VERSION,
)
from .store import LabelStore
from .websocket_api import async_register_websocket

_LOGGER = logging.getLogger(__name__)

_STATIC_REGISTERED = "static_registered"


@dataclass
class LabelRuntime:
    """Everything the websocket API needs."""

    entry: ConfigEntry
    store: LabelStore


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Label Assistant from a config entry."""
    domain_data = hass.data.setdefault(DOMAIN, {})

    store = LabelStore(hass)
    await store.async_load()
    domain_data["runtime"] = LabelRuntime(entry=entry, store=store)

    await _async_register_static(hass)
    await _async_register_panel(hass)
    async_register_websocket(hass)

    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    hass.data[DOMAIN].pop("runtime", None)
    if PANEL_URL_PATH in hass.data.get(frontend.DATA_PANELS, {}):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
    return True


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload when options (printer URL) change."""
    await hass.config_entries.async_reload(entry.entry_id)


async def _async_register_static(hass: HomeAssistant) -> None:
    if hass.data[DOMAIN].get(_STATIC_REGISTERED):
        return
    panel_dir = Path(__file__).parent / "panel"
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(f"{URL_BASE}/panel.js",
                             str(panel_dir / "label-assistant-panel.js"), False),
            StaticPathConfig(f"{URL_BASE}/vendor",
                             str(panel_dir / "vendor"), True),
            StaticPathConfig(f"{URL_BASE}/fonts",
                             str(panel_dir / "fonts"), True),
        ]
    )
    hass.data[DOMAIN][_STATIC_REGISTERED] = True


async def _async_register_panel(hass: HomeAssistant) -> None:
    if PANEL_URL_PATH in hass.data.get(frontend.DATA_PANELS, {}):
        return
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_WEBCOMPONENT,
        # Versioned URL so a normal reload always picks up the newest panel.
        module_url=f"{URL_BASE}/panel.js?v={VERSION}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        require_admin=False,
        config={},
        embed_iframe=False,
    )
