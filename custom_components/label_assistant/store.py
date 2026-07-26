"""Design storage for Label Assistant, persisted via HA Store."""

from __future__ import annotations

import logging
import uuid
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util

from .const import DOMAIN, STORAGE_KEY, STORAGE_VERSION

_LOGGER = logging.getLogger(__name__)

# Fields a client may set on a design; everything else is server-managed.
# media/width/height/dpi record which label the design was made for, so the
# panel can warn (and scale) when printing on a printer with another label.
_CLIENT_FIELDS = ("name", "orientation", "json", "thumbnail",
                  "media", "width", "height", "dpi")


class LabelStore:
    """Persist label designs (fabric.js JSON + metadata)."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._hass = hass
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
        self.designs: list[dict[str, Any]] = []

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.designs = data.get("designs", [])

    async def async_save(self) -> None:
        await self._store.async_save({"designs": self.designs})

    # ------------------------------------------------------------- queries
    def sorted_designs(self) -> list[dict[str, Any]]:
        return sorted(self.designs, key=lambda d: d.get("updated") or "",
                      reverse=True)

    def get(self, design_id: str) -> dict[str, Any] | None:
        return next((d for d in self.designs if d["id"] == design_id), None)

    # ----------------------------------------------------------- mutations
    async def upsert(
        self, payload: dict[str, Any], *, user_name: str | None = None
    ) -> dict[str, Any]:
        now = dt_util.utcnow().isoformat()
        design_id = payload.get("design_id")
        existing = self.get(design_id) if design_id else None

        if existing is None:
            existing = {
                "id": design_id or uuid.uuid4().hex[:12],
                "created": now,
            }
            self.designs.append(existing)

        for field in _CLIENT_FIELDS:
            if field in payload:
                existing[field] = payload[field]
        existing["orientation"] = (
            "landscape" if existing.get("orientation") == "landscape"
            else "portrait"
        )
        existing["name"] = (existing.get("name") or "").strip() or "Label"
        existing["updated"] = now
        if user_name:
            existing["updated_by"] = user_name

        await self.async_save()
        return existing

    async def remove(self, design_id: str) -> bool:
        before = len(self.designs)
        self.designs = [d for d in self.designs if d["id"] != design_id]
        if len(self.designs) == before:
            return False
        await self.async_save()
        return True
