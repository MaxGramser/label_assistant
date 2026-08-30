"""Shared base for the printer entities."""

from __future__ import annotations

from typing import Any

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN
from .coordinator import PrinterCoordinator


def printer_title(entry: dict[str, Any]) -> str:
    """A name a human recognises on a device card."""
    kind = (entry.get("kind") or "").lower()
    if kind == "dymo":
        return f"DYMO {entry.get('model', '').upper().replace('LW', '')}".strip()
    if kind == "zebra":
        return "Zebra"
    return entry.get("name") or "Printer"


class PrinterEntity(CoordinatorEntity[PrinterCoordinator]):
    """One entity about one printer queue."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: PrinterCoordinator, entry_id: str,
                 printer: str, key: str) -> None:
        super().__init__(coordinator)
        self._printer = printer
        self._entry_id = entry_id
        self._attr_unique_id = f"{entry_id}_{printer}_{key}"

    @property
    def _entry(self) -> dict[str, Any]:
        return self.coordinator.printer(self._printer)

    @property
    def available(self) -> bool:
        # A printer the add-on no longer lists, or lists as disconnected, has
        # nothing truthful to report -- better unavailable than a stale value
        # that looks current.
        return (super().available and bool(self._entry)
                and bool(self._entry.get("connected")))

    @property
    def device_info(self) -> DeviceInfo:
        entry = self._entry
        return DeviceInfo(
            identifiers={(DOMAIN, f"{self._entry_id}_{self._printer}")},
            name=printer_title(entry),
            manufacturer=(entry.get("kind") or "").upper() or None,
            model=entry.get("model") or None,
            configuration_url=self.coordinator.url,
        )
