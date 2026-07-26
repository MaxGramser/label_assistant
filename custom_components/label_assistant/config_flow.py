"""Config and options flow for Label Assistant."""

from __future__ import annotations

from typing import Any

import aiohttp
import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers import selector
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    CONF_DEFAULT_PRINTER,
    CONF_PRINTER_URL,
    DEFAULT_PRINTER_URL,
    DOMAIN,
)


class LabelAssistantConfigFlow(ConfigFlow, domain=DOMAIN):
    """Zero-question setup; settings live in the options flow."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        if user_input is None:
            return self.async_show_form(step_id="user", data_schema=vol.Schema({}))
        return self.async_create_entry(title="Label Assistant", data={})

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: ConfigEntry) -> OptionsFlow:
        return LabelAssistantOptionsFlow()


class LabelAssistantOptionsFlow(OptionsFlow):
    """Printer settings."""

    async def _printer_names(self, url: str) -> list[str]:
        """Queue names the add-on reports; empty when unreachable."""
        session = async_get_clientsession(self.hass)
        try:
            async with session.get(
                f"{url.strip().rstrip('/')}/printers",
                timeout=aiohttp.ClientTimeout(total=4),
            ) as resp:
                body = await resp.json(content_type=None)
                return [
                    p["name"] for p in body.get("printers") or [] if p.get("name")
                ]
        except Exception:  # noqa: BLE001 - offline add-on must not block options
            return []

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            data = dict(user_input)
            if isinstance(data.get(CONF_PRINTER_URL), str):
                data[CONF_PRINTER_URL] = data[CONF_PRINTER_URL].strip()
            if isinstance(data.get(CONF_DEFAULT_PRINTER), str):
                data[CONF_DEFAULT_PRINTER] = data[CONF_DEFAULT_PRINTER].strip()
            return self.async_create_entry(title="", data=data)

        options = self.config_entry.options
        url = options.get(CONF_PRINTER_URL, DEFAULT_PRINTER_URL)
        current_printer = options.get(CONF_DEFAULT_PRINTER, "")
        names = await self._printer_names(url)
        if current_printer and current_printer not in names:
            names.append(current_printer)
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_PRINTER_URL,
                        description={"suggested_value": url},
                    ): selector.TextSelector(),
                    # Empty = follow the add-on's own default queue. custom_value
                    # lets a name be typed when the add-on is offline right now.
                    vol.Optional(
                        CONF_DEFAULT_PRINTER,
                        description={"suggested_value": current_printer},
                    ): selector.SelectSelector(
                        selector.SelectSelectorConfig(
                            options=names,
                            custom_value=True,
                            mode=selector.SelectSelectorMode.DROPDOWN,
                        )
                    ),
                }
            ),
        )
