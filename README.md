# Label Assistant

A **Canva-style label designer for Home Assistant**. Draw with shapes, text in
playful fonts, emoji stickers, photos, QR codes and decorative frames on a
canvas that is exactly your label — then print it with one tap on the
[Label Printer add-on](https://github.com/MaxGramser/label-printer-addon).
Kid-proof and touch-friendly.

- **Canvas = the label.** The canvas takes the exact native geometry of the
  label loaded in your printer (e.g. DYMO 99014 at 54 × 101 mm / 300 dpi, or
  a Zebra shipping label at 104 × 159 mm / 203 dpi), portrait or landscape.
  With multiple printers you pick which one you design for; designs remember
  their label and warn (and scale) when printed on another size.
- **Tools:** text (12 fonts), shapes (star, heart, arrow…), 200+ emoji
  stickers, photo upload, QR codes, one-tap decorative frames.
- **True WYSIWYG printing:** a black & white preview with Floyd–Steinberg
  dithering shows exactly what the thermal printer will produce.
- **Templates:** save designs (with thumbnails) to Home Assistant storage,
  reopen and reprint them anytime; four starter designs included.
- **Fully bilingual** (Dutch when HA is set to Dutch, English otherwise),
  undo/redo, snap guides, mobile layout, confetti on print. 🎉

## Installation

1. Copy `custom_components/label_assistant` into your HA `custom_components`
   (or add this repo to HACS as a custom repository).
2. Restart Home Assistant.
3. Add the **Label Assistant** integration (Settings → Devices & services).
4. A **Labels** item appears in the sidebar.

### Printing requires the Label Printer add-on

Label Assistant has no printer driver of its own — it prints through the
**[Label Printer add-on](https://github.com/MaxGramser/label-printer-addon)**
(USB DYMO LabelWriter + Zebra via CUPS). Install it alongside this
integration:

1. Add `https://github.com/MaxGramser/label-printer-addon` as an add-on
   repository (Settings → Add-ons → Add-on Store → ⋮ → Repositories).
2. Install and start **Label Printer**, and pick which label roll is loaded
   in its configuration (by DYMO part number or Zebra size).
3. Point Label Assistant at it via the integration options if the default
   URL doesn't match — an add-on installed from the repository gets a
   hostname like `http://xxxxxxxx-label-printer:8000` (shown on the add-on's
   page).

Designing works fine without a printer — only printing needs the add-on.

## Architecture

- `panel/label-assistant-panel.js` — the entire editor (vanilla web component
  + vendored [Fabric.js](http://fabricjs.com) 5.3.0 and
  [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator)).
- `websocket_api.py` — designs CRUD + print proxy (the browser never talks to
  the printer directly; HA forwards the finished PNG).
- `store.py` — designs persisted via HA's `Store` helper.
- Fonts are vendored woff2 (Google Fonts, OFL-licensed).

## Privacy

Everything is local: no cloud calls, no external fonts or CDNs at runtime.
