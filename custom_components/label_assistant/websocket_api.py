"""WebSocket API for the Label Assistant panel."""

from __future__ import annotations

import base64
import binascii
import logging
from typing import Any

import aiohttp
import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.dispatcher import (
    async_dispatcher_connect,
    async_dispatcher_send,
)

from .const import (
    CONF_DEFAULT_PRINTER,
    CONF_PRINTER_URL,
    DEFAULT_PRINTER_URL,
    DOMAIN,
    LABEL_DPI,
    LABEL_H,
    LABEL_MEDIA,
    LABEL_NAME,
    LABEL_W,
    MAX_COPIES,
    MAX_DESIGN_JSON,
    MAX_PRINT_PNG,
    MAX_THUMBNAIL,
    SIGNAL_UPDATED,
)

_LOGGER = logging.getLogger(__name__)


def async_register_websocket(hass: HomeAssistant) -> None:
    websocket_api.async_register_command(hass, ws_subscribe)
    websocket_api.async_register_command(hass, ws_get_state)
    websocket_api.async_register_command(hass, ws_load_design)
    websocket_api.async_register_command(hass, ws_save_design)
    websocket_api.async_register_command(hass, ws_delete_design)
    websocket_api.async_register_command(hass, ws_print)
    websocket_api.async_register_command(hass, ws_printer_status)
    websocket_api.async_register_command(hass, ws_printers)


def _runtime(hass: HomeAssistant):
    return hass.data[DOMAIN]["runtime"]


def _printer_url(runtime) -> str:
    url = (runtime.entry.options.get(CONF_PRINTER_URL) or DEFAULT_PRINTER_URL)
    return url.strip().rstrip("/")


def _design_meta(design: dict[str, Any]) -> dict[str, Any]:
    """Design without the (potentially large) fabric JSON."""
    return {k: v for k, v in design.items() if k != "json"}


def _serialize_state(runtime) -> dict[str, Any]:
    return {
        "designs": [_design_meta(d) for d in runtime.store.sorted_designs()],
        # Fallback canvas for when the add-on is unreachable; the panel asks
        # the live geometry via the "printers" command.
        "label": {
            "width": LABEL_W,
            "height": LABEL_H,
            "dpi": LABEL_DPI,
            "media": LABEL_MEDIA,
            "name": LABEL_NAME,
        },
        "default_printer": runtime.entry.options.get(CONF_DEFAULT_PRINTER) or "",
        "printer_url": _printer_url(runtime),
    }


def _fallback_printer_entry(health: dict[str, Any]) -> dict[str, Any]:
    """One printer synthesized from /health for add-ons predating /printers."""
    media = health.get("default_media") or LABEL_MEDIA
    entry = {
        "media": media,
        "label": LABEL_NAME if media == LABEL_MEDIA else media,
        "native_px": [LABEL_W, LABEL_H] if media == LABEL_MEDIA else None,
    }
    return {
        "name": health.get("printer") or "dymo",
        "kind": "dymo",
        "model": health.get("model") or "",
        "connected": bool(health.get("connected")),
        "media": media,
        "dpi": LABEL_DPI,
        "native_px": entry["native_px"],
        "loaded": entry,
        "supported": [entry],
        "custom_media": False,
        "accepts": ["png", "pdf", "jpg"],
        "default": True,
    }


@callback
def _notify_changed(hass: HomeAssistant) -> None:
    async_dispatcher_send(hass, SIGNAL_UPDATED)


# ----------------------------------------------------------------- commands
@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/subscribe"})
@websocket_api.async_response
async def ws_subscribe(hass, connection, msg) -> None:
    runtime = _runtime(hass)

    @callback
    def _forward() -> None:
        connection.send_message(
            websocket_api.event_message(msg["id"], _serialize_state(runtime))
        )

    connection.subscriptions[msg["id"]] = async_dispatcher_connect(
        hass, SIGNAL_UPDATED, _forward
    )
    connection.send_result(msg["id"])
    _forward()


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/get_state"})
@websocket_api.async_response
async def ws_get_state(hass, connection, msg) -> None:
    connection.send_result(msg["id"], _serialize_state(_runtime(hass)))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/load_design",
        vol.Required("design_id"): str,
    }
)
@websocket_api.async_response
async def ws_load_design(hass, connection, msg) -> None:
    design = _runtime(hass).store.get(msg["design_id"])
    if design is None:
        connection.send_error(msg["id"], "not_found", "Design not found")
        return
    connection.send_result(msg["id"], design)


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/save_design",
        vol.Optional("design_id"): str,
        vol.Required("name"): str,
        vol.Required("orientation"): vol.In(["portrait", "landscape"]),
        vol.Required("json"): vol.All(str, vol.Length(max=MAX_DESIGN_JSON)),
        vol.Optional("thumbnail"): vol.All(str, vol.Length(max=MAX_THUMBNAIL)),
        # Which label the design targets (portrait px + CUPS media name).
        vol.Optional("media"): str,
        vol.Optional("width"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("height"): vol.All(vol.Coerce(int), vol.Range(min=1)),
        vol.Optional("dpi"): vol.All(vol.Coerce(int), vol.Range(min=1)),
    }
)
@websocket_api.async_response
async def ws_save_design(hass, connection, msg) -> None:
    runtime = _runtime(hass)
    user = connection.user
    design = await runtime.store.upsert(
        {k: msg[k] for k in ("design_id", "name", "orientation", "json",
                             "thumbnail", "media", "width", "height", "dpi")
         if k in msg},
        user_name=(user.name if user else None),
    )
    _notify_changed(hass)
    connection.send_result(msg["id"], _design_meta(design))


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/delete_design",
        vol.Required("design_id"): str,
    }
)
@websocket_api.async_response
async def ws_delete_design(hass, connection, msg) -> None:
    removed = await _runtime(hass).store.remove(msg["design_id"])
    if removed:
        _notify_changed(hass)
    connection.send_result(msg["id"], {"removed": removed})


@websocket_api.websocket_command(
    {
        vol.Required("type"): f"{DOMAIN}/print",
        vol.Required("png_base64"): vol.All(str, vol.Length(max=MAX_PRINT_PNG)),
        vol.Optional("copies", default=1): vol.All(
            vol.Coerce(int), vol.Range(min=1, max=MAX_COPIES)
        ),
        vol.Optional("printer"): str,
    }
)
@websocket_api.async_response
async def ws_print(hass, connection, msg) -> None:
    """Forward a finished PNG to the generic Label Printer add-on.

    No media is sent: the PNG is rendered at the target printer's native_px,
    and the queue's own loaded-label setting does the rest (add-on contract:
    clients never hard-code sizes).
    """
    runtime = _runtime(hass)
    url = _printer_url(runtime)
    try:
        png = base64.b64decode(msg["png_base64"], validate=True)
    except (binascii.Error, ValueError):
        connection.send_result(
            msg["id"], {"printed": False, "reason": "invalid_png"}
        )
        return

    form = aiohttp.FormData()
    form.add_field("file", png, filename="label.png", content_type="image/png")
    form.add_field("copies", str(msg["copies"]))
    printer = msg.get("printer") or ""
    if printer:
        form.add_field("printer", printer)

    session = async_get_clientsession(hass)
    try:
        async with session.post(
            f"{url}/print", data=form,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            body = await resp.json(content_type=None)
            ok = resp.status == 200 and bool(body.get("ok"))
            connection.send_result(msg["id"], {
                "printed": ok,
                "reason": None if ok else (body.get("error") or f"http_{resp.status}"),
                "detail": body.get("detail") or body.get("hint"),
                "copies": msg["copies"],
                "printer": body.get("printer") or printer or None,
            })
    except aiohttp.ClientError as err:
        connection.send_result(msg["id"], {
            "printed": False, "reason": "printer_unreachable",
            "detail": f"{url}: {err}",
        })
    except Exception as err:  # noqa: BLE001 - printing must never crash the WS
        _LOGGER.exception("Print failed")
        connection.send_result(msg["id"], {
            "printed": False, "reason": "print_failed", "detail": str(err),
        })


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/printer_status"})
@websocket_api.async_response
async def ws_printer_status(hass, connection, msg) -> None:
    runtime = _runtime(hass)
    url = _printer_url(runtime)
    session = async_get_clientsession(hass)
    try:
        async with session.get(
            f"{url}/health", timeout=aiohttp.ClientTimeout(total=5)
        ) as resp:
            body = await resp.json(content_type=None)
            connection.send_result(msg["id"], {
                "reachable": True,
                "connected": bool(body.get("connected")),
                "printer": body.get("printer"),
                "model": body.get("model"),
            })
    except Exception:  # noqa: BLE001 - status is best-effort
        connection.send_result(msg["id"], {
            "reachable": False, "connected": False,
        })


@websocket_api.websocket_command({vol.Required("type"): f"{DOMAIN}/printers"})
@websocket_api.async_response
async def ws_printers(hass, connection, msg) -> None:
    """The add-on's printer list: per printer its loaded label, supported
    media (with native_px render sizes) and connection state."""
    runtime = _runtime(hass)
    url = _printer_url(runtime)
    session = async_get_clientsession(hass)
    default_printer = runtime.entry.options.get(CONF_DEFAULT_PRINTER) or ""
    try:
        async with session.get(
            f"{url}/printers", timeout=aiohttp.ClientTimeout(total=5)
        ) as resp:
            if resp.status == 404:  # add-on predates /printers: use /health
                async with session.get(
                    f"{url}/health", timeout=aiohttp.ClientTimeout(total=5)
                ) as health_resp:
                    health = await health_resp.json(content_type=None)
                connection.send_result(msg["id"], {
                    "reachable": True,
                    "api_version": 0,
                    "default": health.get("printer") or "dymo",
                    "default_printer": default_printer,
                    "printers": [_fallback_printer_entry(health)],
                })
                return
            body = await resp.json(content_type=None)
            connection.send_result(msg["id"], {
                "reachable": True,
                "api_version": body.get("api_version", 0),
                "default": body.get("default"),
                "default_printer": default_printer,
                "printers": body.get("printers") or [],
            })
    except Exception:  # noqa: BLE001 - the panel falls back to its own canvas
        connection.send_result(msg["id"], {
            "reachable": False, "api_version": 0,
            "default_printer": default_printer, "printers": [],
        })
