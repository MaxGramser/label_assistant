"""Sensors for what is loaded in each label printer, and how much is left."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity, SensorStateClass
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
        """Add entities for printers that have appeared since the last poll.

        Printers are hot-pluggable and the add-on registers them as they turn
        up, so the entity list cannot be decided once at setup.
        """
        new: list[SensorEntity] = []
        for printer in coordinator.printers():
            name = printer["name"]
            if name in known:
                continue
            known.add(name)
            new.append(LoadedLabelSensor(coordinator, entry.entry_id, name))
            new.append(RollSensor(coordinator, entry.entry_id, name))
        if new:
            async_add_entities(new)

    _sync()
    entry.async_on_unload(coordinator.async_add_listener(_sync))


class LoadedLabelSensor(PrinterEntity, SensorEntity):
    """Which label is in the printer, as a size a human reads."""

    _attr_translation_key = "loaded_label"
    _attr_icon = "mdi:label"

    def __init__(self, coordinator: PrinterCoordinator, entry_id: str,
                 printer: str) -> None:
        super().__init__(coordinator, entry_id, printer, "loaded_label")

    @property
    def native_value(self) -> str | None:
        return self._entry.get("label") or None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        entry = self._entry
        alr = entry.get("alr") or {}
        attrs: dict[str, Any] = {
            "media": entry.get("media"),
            "native_px": entry.get("native_px"),
            "dpi": entry.get("dpi"),
        }
        if alr:
            # Where the size came from, so an automation (or a human reading
            # the more-info dialog) can tell a detected roll from a configured
            # one without guessing.
            attrs.update({
                "detected": True,
                "sku": alr.get("sku") or None,
                "part": alr.get("part") or None,
                "status": alr.get("bay_text"),
            })
        else:
            attrs["detected"] = False
        return attrs


class RollSensor(PrinterEntity, SensorEntity):
    """How many labels are left on the roll."""

    _attr_translation_key = "roll_left"
    _attr_icon = "mdi:paper-roll"
    _attr_native_unit_of_measurement = "labels"
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, coordinator: PrinterCoordinator, entry_id: str,
                 printer: str) -> None:
        super().__init__(coordinator, entry_id, printer, "roll_left")

    @property
    def _roll(self) -> dict[str, Any]:
        return self._entry.get("roll") or {}

    @property
    def native_value(self) -> int | None:
        left = self._roll.get("left")
        return int(left) if isinstance(left, (int, float)) else None

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        roll = self._roll
        return {
            "capacity": roll.get("capacity"),
            "percentage": roll.get("pct"),
            "level": roll.get("level"),
            # "alr" = the printer counted them off the roll's own tag,
            # "estimate" = we counted the jobs we sent, which drifts.
            "source": roll.get("source"),
            "since": roll.get("since") or None,
        }
