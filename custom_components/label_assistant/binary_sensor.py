"""The binary sensor that finally makes a stuck printer visible in HA.

The add-on has always answered "what needs a human right now" on /attention —
labels out, a jam, a job that has been waiting, a roll it cannot identify. Up
to now nothing in Home Assistant asked. This is the entity to hang an
announce or a push notification off.
"""

from __future__ import annotations

from typing import Any

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .coordinator import PrinterCoordinator
from .entity import PrinterEntity


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry,
                            async_add_entities: AddEntitiesCallback) -> None:
    coordinator: PrinterCoordinator = hass.data[DOMAIN]["coordinator"]
    known: set[str] = set()

    @callback
    def _sync() -> None:
        new: list[BinarySensorEntity] = []
        for printer in coordinator.printers():
            name = printer["name"]
            if name in known:
                continue
            known.add(name)
            new.append(PrinterProblem(coordinator, entry.entry_id, name))
        if new:
            async_add_entities(new)

    _sync()
    entry.async_on_unload(coordinator.async_add_listener(_sync))


class PrinterProblem(PrinterEntity, BinarySensorEntity):
    """On when this printer wants a human."""

    _attr_translation_key = "attention"
    _attr_device_class = BinarySensorDeviceClass.PROBLEM

    def __init__(self, coordinator: PrinterCoordinator, entry_id: str,
                 printer: str) -> None:
        super().__init__(coordinator, entry_id, printer, "attention")

    @property
    def available(self) -> bool:
        # Unlike the other entities this one stays available when the printer
        # reports disconnected: "the printer is gone" is exactly the kind of
        # problem it exists to report, and going unavailable would hide it.
        return self.coordinator.last_update_success and bool(self._entry)

    @property
    def is_on(self) -> bool:
        return bool(self._attention) or not self._entry.get("connected", True)

    @property
    def _attention(self) -> dict[str, Any]:
        return self.coordinator.attention_for(self._printer)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        item = self._attention
        if not item and not self.is_on:
            return {"reason": None, "message": None}
        if not item:
            return {
                "reason": "disconnected",
                # Written to be read aloud as-is by an announce action.
                "message": f"De {self._printer} is niet verbonden.",
            }
        return {
            "reason": item.get("reason"),
            "message": item.get("message"),
            "detail": item.get("detail"),
        }
