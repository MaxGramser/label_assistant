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
        "label": {
            "width": LABEL_W,
            "height": LABEL_H,
            "dpi": LABEL_DPI,
            "media": LABEL_MEDIA,
            "name": LABEL_NAME,
        },
        "printer_url": _printer_url(runtime),
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
    }
)
@websocket_api.async_response
async def ws_save_design(hass, connection, msg) -> None:
    runtime = _runtime(hass)
    user = connection.user
    design = await runtime.store.upsert(
        {k: msg[k] for k in ("design_id", "name", "orientation", "json",
                             "thumbnail") if k in msg},
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
    }
)
@websocket_api.async_response
async def ws_print(hass, connection, msg) -> None:
    """Forward a finished PNG to the generic Label Printer add-on."""
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
    form.add_field("media", LABEL_MEDIA)
    form.add_field("copies", str(msg["copies"]))

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
