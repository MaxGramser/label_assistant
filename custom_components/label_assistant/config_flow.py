"""Config and options flow for Label Assistant."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import (
    ConfigEntry,
    ConfigFlow,
    ConfigFlowResult,
    OptionsFlow,
)
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import CONF_PRINTER_URL, DEFAULT_PRINTER_URL, DOMAIN


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

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        if user_input is not None:
            data = dict(user_input)
            if isinstance(data.get(CONF_PRINTER_URL), str):
                data[CONF_PRINTER_URL] = data[CONF_PRINTER_URL].strip()
            return self.async_create_entry(title="", data=data)

        current = self.config_entry.options.get(
            CONF_PRINTER_URL, DEFAULT_PRINTER_URL
        )
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_PRINTER_URL,
                        description={"suggested_value": current},
                    ): selector.TextSelector(),
                }
            ),
        )
