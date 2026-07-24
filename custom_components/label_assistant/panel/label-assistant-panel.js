/* Label Assistant panel — a Canva-style editor for DYMO 99014 labels.
 *
 * Fabric.js drives the canvas (vendored, /label_assistant_static/vendor).
 * Everything renders at the label's native 300 dpi geometry (642x1192 px,
 * 54x101 mm) so what you see is exactly what the printer receives.
 *
 * i18n follows the house rule: Dutch when HA's per-user language is Dutch,
 * English for everything else. UI chrome uses ha-icon/MDI; emoji only appear
 * as *content* (stickers) and in toast prose.
 */

const BASE = "/label_assistant_static";

// DYMO 99014 fallback geometry; the backend confirms it via get_state.
const LABEL = { w: 642, h: 1192, dpi: 300 };

// Custom fabric props that must survive (de)serialization.
const EXTRA_PROPS = ["laType", "laQr", "rx", "ry", "selectable", "evented"];

const HISTORY_MAX = 60;

/* ------------------------------------------------------------------ fonts */
// Vendored woff2 fonts (Google Fonts, OFL). Weight is fixed per entry so the
// canvas never needs synthesized bold (unreliable in canvas2d).
const FONTS = [
  { id: "nunito-800", label: "Nunito", family: "Nunito", weight: 800, file: "nunito-800.woff2" },
  { id: "nunito-400", label: "Nunito dun", labelEn: "Nunito light", family: "Nunito", weight: 400, file: "nunito-400.woff2" },
  { id: "fredoka", label: "Fredoka", family: "Fredoka", weight: 600, file: "fredoka-600.woff2" },
  { id: "baloo", label: "Baloo", family: "Baloo 2", weight: 800, file: "baloo2-800.woff2" },
  { id: "bangers", label: "Bangers", family: "Bangers", weight: 400, file: "bangers-400.woff2" },
  { id: "caveat", label: "Caveat", family: "Caveat", weight: 700, file: "caveat-700.woff2" },
  { id: "pacifico", label: "Pacifico", family: "Pacifico", weight: 400, file: "pacifico-400.woff2" },
  { id: "typewriter", label: "Typemachine", labelEn: "Typewriter", family: "Special Elite", weight: 400, file: "specialelite-400.woff2" },
  { id: "playfair", label: "Chic", family: "Playfair Display", weight: 700, file: "playfair-700.woff2" },
  { id: "arial", label: "Arial", family: "Arial", weight: 700, file: null },
  { id: "georgia", label: "Georgia", family: "Georgia", weight: 700, file: null },
  { id: "courier", label: "Courier", family: "Courier New", weight: 700, file: null },
];

const FONT_FACES = FONTS.filter((f) => f.file)
  .map((f) => `@font-face{font-family:"${f.family}";font-weight:${f.weight};` +
    `font-style:normal;font-display:swap;src:url("${BASE}/fonts/${f.file}") format("woff2");}`)
  .join("\n");

/* ----------------------------------------------------------------- colors */
const PALETTE = [
  "#000000", "#5f6368", "#9aa0a6", "#ffffff",
  "#e53935", "#fb8c00", "#fdd835", "#43a047",
  "#00acc1", "#1e88e5", "#8e24aa", "#d81b60",
];

/* --------------------------------------------------------------- stickers */
// Emoji are CONTENT here (they land on the label), so they're allowed.
const STICKERS = [
  { id: "food", icon: "mdi:food-apple", set: "🍎 🍌 🍇 🍓 🍉 🍊 🍋 🍒 🥝 🥑 🥕 🥦 🌽 🍅 🥔 🍞 🥐 🧀 🥚 🍗 🍖 🍔 🍟 🍕 🌭 🌮 🍝 🍜 🍚 🍣 🍤 🍦 🍩 🍪 🎂 🧁 🍫 🍬 🍭 🥛 ☕ 🧃 🥤 🍯" },
  { id: "animals", icon: "mdi:paw", set: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧 🐦 🦆 🦉 🦄 🐴 🐢 🐍 🐙 🦀 🐬 🐳 🐟 🦋 🐌 🐝 🐞 🕷️ 🦖 🦕" },
  { id: "faces", icon: "mdi:emoticon-happy-outline", set: "😀 😃 😄 😁 😆 😂 🙂 😉 😊 😍 🤩 😘 😜 🤪 😝 🤗 🤭 🤫 🤔 😐 😴 🥱 😎 🤓 🥳 🥺 😢 😭 😤 😡 🤯 😱 👻 💩 🤖 👽" },
  { id: "party", icon: "mdi:party-popper", set: "🎉 🎊 🎈 🎁 🎀 🎂 🥳 🪅 ✨ ⭐ 🌟 💫 🎵 🎶 🏆 🥇 🥈 🥉 👑 💎 💖 💗 💛 💚 💙 💜 🧡 ❤️ 🤍 🖤 💯 🔥" },
  { id: "nature", icon: "mdi:flower", set: "☀️ 🌙 ⭐ 🌈 ☁️ ⛅ 🌧️ ❄️ ⛄ ⚡ 🌊 🌸 🌺 🌼 🌻 🌹 🌷 🌵 🌴 🌲 🍀 🍁 🍄 🌍 🪐" },
  { id: "things", icon: "mdi:rocket-launch-outline", set: "⚽ 🏀 🎾 🏈 🎨 🖍️ ✏️ 📚 📖 🚗 🚒 🚜 🚂 🚀 ✈️ 🚁 ⛵ 🚲 🛴 🎮 🕹️ 🧸 🪀 🧩 🔧 🔨 💡 🔑 📦 ✂️ 🧦 👕 👟 🎒 ⏰ 🔬 🔭" },
];

/* ---------------------------------------------------------------- strings */
const STRINGS = {
  nl: {
    appTitle: "Label Assistant",
    loading: "Editor laden…",
    namePlaceholder: "Naam van je label…",
    save: "Opslaan",
    saved: "Opgeslagen ✓",
    print: "Printen",
    undo: "Ongedaan maken",
    redo: "Opnieuw",
    rotate: "Staand / liggend",
    bwPreview: "Zwart-wit voorbeeld",
    designs: "Mijn labels",
    zoomIn: "Inzoomen",
    zoomOut: "Uitzoomen",
    zoomFit: "Passend maken",

    toolSelect: "Selecteren",
    toolText: "Tekst",
    toolShapes: "Vormen",
    toolStickers: "Stickers",
    toolImage: "Foto",
    toolQr: "QR-code",
    toolFrames: "Kaders",
    clearAll: "Alles wissen",
    confirmClear: "Alles van het label wissen?",

    addTextDefault: "Tekst",
    shapesTitle: "Vormen",
    stickersTitle: "Stickers",
    framesTitle: "Kaders",
    catFood: "Eten",
    catAnimals: "Dieren",
    catFaces: "Gezichtjes",
    catParty: "Feest",
    catNature: "Natuur",
    catThings: "Dingen",

    qrTitle: "QR-code",
    qrHint: "Tekst, naam of link — telefoons kunnen 'm scannen.",
    qrPlaceholder: "bv. https://… of een naam",
    qrAdd: "Toevoegen",
    qrUpdate: "Bijwerken",

    frSolid: "Strak",
    frThick: "Dik",
    frDashed: "Streepjes",
    frDouble: "Dubbel",
    frRounded: "Rond",
    frScallop: "Golfjes",

    propsLabel: "Label",
    background: "Achtergrond",
    tipEmpty: "Kies links een gereedschap, of tik iets op het label aan om het te bewerken.",
    fill: "Kleur",
    stroke: "Lijn",
    strokeWidth: "Lijndikte",
    fontTitle: "Lettertype",
    size: "Grootte",
    align: "Uitlijning",
    alignLeft: "Links",
    alignCenter: "Midden",
    alignRight: "Rechts",
    edit: "Bewerken",
    layerUp: "Naar voren",
    layerDown: "Naar achteren",
    duplicate: "Kopie",
    remove: "Weg",
    centerH: "Midden (breedte)",
    centerV: "Midden (hoogte)",
    noColor: "Geen",
    customColor: "Eigen kleur",

    galleryTitle: "Label Assistant",
    gallerySub: "Ontwerp je eigen labels en print ze op de labelprinter — 54 × 101 mm.",
    newLabel: "Nieuw label",
    portrait: "Staand",
    landscape: "Liggend",
    starters: "Voorbeelden om mee te beginnen",
    myDesigns: "Mijn opgeslagen labels",
    emptyDesigns: "Nog geen opgeslagen labels. Begin met een nieuw label of een voorbeeld!",
    open: "Openen",
    deleteDesign: "Verwijderen",
    confirmDelete: (n) => `"${n}" verwijderen?`,
    savedBy: (n) => `door ${n}`,
    continueEditing: "Verder met dit label",

    starterName: "Naamlabel",
    starterJar: "Potje jam",
    starterToy: "Speelgoedbak",
    starterGift: "Cadeautje",

    printTitle: "Label printen",
    printSub: "Zo komt je label uit de printer (zwart-wit, 54 × 101 mm).",
    copies: "Aantal",
    printBtn: "Print!",
    printing: "Printen…",
    printerReady: "Printer is klaar",
    printerNotConnected: "Printer niet gevonden — staat hij aan?",
    printerUnreachable: "Printer add-on niet bereikbaar",
    printedToast: "Label wordt geprint! 🎉",
    printFailedToast: "Printen mislukt",
    reasonPrinterUnreachable: "De printer add-on is niet bereikbaar. Draait de Label Printer add-on?",
    reasonNotConnected: "De printer is niet verbonden. Zet de DYMO aan en probeer opnieuw.",

    savedToast: "Label opgeslagen ✓",
    saveFailedToast: "Opslaan mislukt",
    deleteFailedToast: "Verwijderen mislukt",
    loadFailedToast: "Laden mislukt",
    imageTooBig: "Afbeelding is te groot (max 8 MB).",
    unsaved: "Niet-opgeslagen wijzigingen",
  },
  en: {
    appTitle: "Label Assistant",
    loading: "Loading editor…",
    namePlaceholder: "Name your label…",
    save: "Save",
    saved: "Saved ✓",
    print: "Print",
    undo: "Undo",
    redo: "Redo",
    rotate: "Portrait / landscape",
    bwPreview: "Black & white preview",
    designs: "My labels",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    zoomFit: "Fit to screen",

    toolSelect: "Select",
    toolText: "Text",
    toolShapes: "Shapes",
    toolStickers: "Stickers",
    toolImage: "Photo",
    toolQr: "QR code",
    toolFrames: "Frames",
    clearAll: "Clear all",
    confirmClear: "Clear everything from the label?",

    addTextDefault: "Text",
    shapesTitle: "Shapes",
    stickersTitle: "Stickers",
    framesTitle: "Frames",
    catFood: "Food",
    catAnimals: "Animals",
    catFaces: "Faces",
    catParty: "Party",
    catNature: "Nature",
    catThings: "Things",

    qrTitle: "QR code",
    qrHint: "Text, a name or a link — phones can scan it.",
    qrPlaceholder: "e.g. https://… or a name",
    qrAdd: "Add",
    qrUpdate: "Update",

    frSolid: "Clean",
    frThick: "Thick",
    frDashed: "Dashes",
    frDouble: "Double",
    frRounded: "Rounded",
    frScallop: "Scalloped",

    propsLabel: "Label",
    background: "Background",
    tipEmpty: "Pick a tool on the left, or tap something on the label to edit it.",
    fill: "Color",
    stroke: "Outline",
    strokeWidth: "Outline width",
    fontTitle: "Font",
    size: "Size",
    align: "Alignment",
    alignLeft: "Left",
    alignCenter: "Center",
    alignRight: "Right",
    edit: "Edit",
    layerUp: "Bring forward",
    layerDown: "Send back",
    duplicate: "Copy",
    remove: "Delete",
    centerH: "Center (width)",
    centerV: "Center (height)",
    noColor: "None",
    customColor: "Custom color",

    galleryTitle: "Label Assistant",
    gallerySub: "Design your own labels and print them on the label printer — 54 × 101 mm.",
    newLabel: "New label",
    portrait: "Portrait",
    landscape: "Landscape",
    starters: "Starter ideas",
    myDesigns: "My saved labels",
    emptyDesigns: "No saved labels yet. Start with a new label or a starter!",
    open: "Open",
    deleteDesign: "Delete",
    confirmDelete: (n) => `Delete "${n}"?`,
    savedBy: (n) => `by ${n}`,
    continueEditing: "Continue this label",

    starterName: "Name tag",
    starterJar: "Jam jar",
    starterToy: "Toy box",
    starterGift: "Little gift",

    printTitle: "Print label",
    printSub: "This is how your label will print (black & white, 54 × 101 mm).",
    copies: "Copies",
    printBtn: "Print!",
    printing: "Printing…",
    printerReady: "Printer is ready",
    printerNotConnected: "Printer not found — is it switched on?",
    printerUnreachable: "Printer add-on unreachable",
    printedToast: "Your label is printing! 🎉",
    printFailedToast: "Printing failed",
    reasonPrinterUnreachable: "The printer add-on is unreachable. Is the Label Printer add-on running?",
    reasonNotConnected: "The printer is not connected. Turn on the DYMO and try again.",

    savedToast: "Label saved ✓",
    saveFailedToast: "Saving failed",
    deleteFailedToast: "Deleting failed",
    loadFailedToast: "Loading failed",
    imageTooBig: "Image is too large (max 8 MB).",
    unsaved: "Unsaved changes",
  },
};

/* ---------------------------------------------------------------- helpers */
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

let _vendorPromises = {};
function loadScript(url) {
  if (!_vendorPromises[url]) {
    _vendorPromises[url] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = url;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`Failed to load ${url}`));
      document.head.appendChild(s);
    });
  }
  return _vendorPromises[url];
}

/* ----------------------------------------------------------------- styles */
const STYLES = `
:host{
  --la-bg: var(--primary-background-color, #f2f4fa);
  --la-card: var(--card-background-color, #ffffff);
  --la-text: var(--primary-text-color, #1b1e24);
  --la-muted: var(--secondary-text-color, #70757f);
  --la-line: var(--divider-color, rgba(0,0,0,.10));
  --la-accent: #6c5ce7;
  --la-accent-2: #a29bfe;
  --la-print: linear-gradient(135deg,#ff6b81,#ff9f43);
  --la-radius: 16px;
  --la-shadow: 0 10px 30px rgba(20,20,60,.12);
  display:block; height:100vh; height:100dvh; overflow-x:clip;
  background:var(--la-bg); color:var(--la-text);
  font-family:"Nunito", system-ui, -apple-system, sans-serif;
  overflow:hidden; user-select:none; -webkit-user-select:none;
}
*{box-sizing:border-box}
button{font:inherit;color:inherit;background:none;border:none;padding:0;cursor:pointer;-webkit-tap-highlight-color:transparent}
input{font:inherit;color:inherit}
ha-icon{--mdc-icon-size:22px}

/* minmax(0,1fr) — a plain 1fr track can never shrink below its items'
   min-content, so a topbar that is a hair wider than a phone screen would
   silently widen the WHOLE grid (canvas fit against a too-wide stage,
   toolbar scrolling inside an off-screen box). */
.app{display:grid;height:100%;grid-template-rows:auto 1fr;
  grid-template-columns:64px minmax(0,1fr) 296px;
  grid-template-areas:"top top top" "rail stage props";}

/* ------------------------------------------------------------------- top */
/* Topbar height = HA's own --header-height, so the divider under it is the
   exact continuation of the sidebar's header line (56px default, theme-aware). */
.top{grid-area:top;display:flex;align-items:center;gap:4px;padding:0 12px 0 8px;
  min-height:var(--header-height,56px);padding-top:env(safe-area-inset-top);
  background:var(--la-card);border-bottom:1px solid var(--la-line);z-index:30;}
/* The menu slot only claims the 64px rail column when the hamburger actually
   renders (ha-menu-button draws nothing while HA's sidebar is visible);
   _applyChrome measures it and toggles .has-menu. Centered, the hamburger
   then sits on the same x=32 axis as the tool icons below. */
.menu-slot{width:0;flex:0 0 auto;display:flex;align-items:center;justify-content:center;overflow:hidden}
.menu-slot.has-menu{width:64px;flex:0 0 64px;margin-left:-8px}
.menu-slot ha-menu-button{--mdc-icon-button-size:44px;color:var(--la-text)}
/* Brand icon in a 48px box: its center lands on the rail's icon axis. */
.brand>ha-icon{width:48px;display:inline-flex;justify-content:center;flex:0 0 48px}
.brand{display:flex;align-items:center;gap:2px;font-weight:800;font-size:17px;white-space:nowrap}
.brand ha-icon{color:var(--la-accent)}
.name-wrap{flex:1;min-width:60px;display:flex;align-items:center;gap:6px}
.name{flex:1;min-width:40px;max-width:340px;border:none;background:transparent;font-weight:700;
  font-size:16px;padding:8px 10px;border-radius:10px;border:2px dashed transparent}
.name:hover{border-color:var(--la-line)}
.name:focus{outline:none;border-color:var(--la-accent-2);background:rgba(108,92,231,.06)}
.dirty-dot{width:9px;height:9px;border-radius:50%;background:#fdcb6e;flex:0 0 auto;
  opacity:0;transition:opacity .2s}
.dirty-dot.on{opacity:1}
.top-actions{display:flex;align-items:center;gap:6px}
.icon-btn{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;
  border-radius:12px;color:var(--la-text);transition:background .15s, transform .1s}
.icon-btn:hover{background:rgba(108,92,231,.10)}
.icon-btn:active{transform:scale(.92)}
.icon-btn[disabled]{opacity:.35;pointer-events:none}
.icon-btn.active{background:var(--la-accent);color:#fff}
.btn{display:inline-flex;align-items:center;gap:8px;padding:0 18px;height:44px;border-radius:14px;
  font-weight:800;font-size:15px;transition:transform .1s, box-shadow .15s;white-space:nowrap}
.btn:active{transform:scale(.95)}
.btn-save{background:rgba(108,92,231,.12);color:var(--la-accent)}
.btn-save:hover{background:rgba(108,92,231,.2)}
.btn-print{background:var(--la-print);color:#fff;box-shadow:0 6px 16px rgba(255,107,129,.35)}
.btn-print:hover{box-shadow:0 8px 22px rgba(255,107,129,.5)}

/* ------------------------------------------------------------------ rail */
.rail{grid-area:rail;display:flex;flex-direction:column;align-items:center;gap:6px;
  padding:12px 8px;background:var(--la-card);border-right:1px solid var(--la-line);z-index:20;}
.tool{display:flex;flex-direction:column;align-items:center;justify-content:center;
  width:48px;height:48px;border-radius:14px;color:var(--la-muted);position:relative;
  transition:background .15s,color .15s,transform .1s}
.tool:hover{background:rgba(108,92,231,.10);color:var(--la-accent)}
.tool:active{transform:scale(.9)}
.tool.active{background:var(--la-accent);color:#fff;box-shadow:0 4px 12px rgba(108,92,231,.4)}
.rail .spacer{flex:1}
.tool.danger:hover{background:rgba(229,57,53,.12);color:#e53935}
/* Mobile-only rail tools (rotate/B&W/background) and the sheet grab bar. */
.m-tool{display:none}
.sheet-head{display:none}

/* ----------------------------------------------------------------- stage */
.stage{grid-area:stage;position:relative;overflow:auto;
  background-image:radial-gradient(var(--la-line) 1.2px, transparent 1.2px);
  background-size:22px 22px;}
/* Auto margins (not justify/align) centre the label: identical when it
   fits, but when the canvas overflows the viewport the margins collapse to
   0 so nothing gets pushed off-screen unreachably (flex-centred overflow
   clips the leading edge in a scroll container). */
.stage-inner{min-width:100%;min-height:100%;display:flex;padding:28px;}
.label-wrap{position:relative;border-radius:14px;box-shadow:var(--la-shadow);
  background:#fff;flex:0 0 auto;margin:auto;}
.label-wrap .canvas-holder{border-radius:14px;overflow:hidden;display:block}
.label-wrap canvas{display:block}
.guide{position:absolute;background:#ff4fa3;opacity:0;pointer-events:none;z-index:5;transition:opacity .08s}
.guide.v{top:0;bottom:0;width:2px;left:50%;margin-left:-1px}
.guide.h{left:0;right:0;height:2px;top:50%;margin-top:-1px}
.guide.on{opacity:.85}
.bw-overlay{position:absolute;inset:0;z-index:6;pointer-events:none;border-radius:14px;
  overflow:hidden;display:none;background:#fff}
.bw-overlay img{width:100%;height:100%;display:block;image-rendering:auto}
.bw-overlay.on{display:block}
.zoom-fabs{position:absolute;right:14px;bottom:14px;display:flex;flex-direction:column;gap:6px;z-index:10}
.zoom-fabs .icon-btn{background:var(--la-card);box-shadow:var(--la-shadow)}
.stage-badge{position:absolute;left:14px;bottom:14px;z-index:10;background:var(--la-card);
  border-radius:999px;padding:6px 14px;font-size:12px;font-weight:700;color:var(--la-muted);
  box-shadow:var(--la-shadow);display:flex;align-items:center;gap:6px}
.stage-badge ha-icon{--mdc-icon-size:16px}

/* ----------------------------------------------------------------- props */
.props{grid-area:props;background:var(--la-card);border-left:1px solid var(--la-line);
  overflow-y:auto;padding:16px;z-index:20;overscroll-behavior:contain;}
.props h3{margin:0 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;
  color:var(--la-muted);display:flex;align-items:center;gap:6px}
.props h3 ha-icon{--mdc-icon-size:16px}
.props .section{margin-bottom:20px}
.tip{color:var(--la-muted);font-size:14px;line-height:1.5;background:rgba(108,92,231,.07);
  padding:14px;border-radius:14px}
.swatches{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}
.swatch{width:100%;aspect-ratio:1;border-radius:50%;border:2px solid var(--la-line);
  transition:transform .1s;position:relative}
.swatch:hover{transform:scale(1.12)}
.swatch.sel{border-color:var(--la-accent);box-shadow:0 0 0 3px rgba(108,92,231,.3)}
.swatch.none{background:
  linear-gradient(to top left, transparent 44%, #e53935 46%, #e53935 54%, transparent 56%), #fff}
.swatch.custom{background:conic-gradient(#e53935,#fdd835,#43a047,#1e88e5,#8e24aa,#e53935)}
.slider-row{display:flex;align-items:center;gap:10px}
.slider-row input[type=range]{flex:1;accent-color:var(--la-accent);height:32px}
.slider-val{font-weight:800;font-size:13px;min-width:34px;text-align:right;color:var(--la-muted)}
.font-list{display:flex;flex-direction:column;gap:6px;max-height:250px;overflow-y:auto;
  overscroll-behavior:contain;padding-right:2px}
.font-item{padding:9px 12px;border-radius:12px;border:2px solid var(--la-line);text-align:left;
  font-size:17px;line-height:1.2;transition:border-color .15s;background:var(--la-card)}
.font-item:hover{border-color:var(--la-accent-2)}
.font-item.sel{border-color:var(--la-accent);background:rgba(108,92,231,.08)}
.seg{display:flex;background:rgba(108,92,231,.08);border-radius:12px;padding:3px;gap:3px}
.seg button{flex:1;height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;
  color:var(--la-muted)}
.seg button.sel{background:var(--la-card);color:var(--la-accent);box-shadow:0 2px 6px rgba(0,0,0,.12)}
.act-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.act{display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:12px;
  background:rgba(108,92,231,.07);font-weight:700;font-size:13px;color:var(--la-text)}
.act:hover{background:rgba(108,92,231,.15)}
.act ha-icon{--mdc-icon-size:18px;color:var(--la-accent)}
.act.danger{background:rgba(229,57,53,.08);color:#e53935}
.act.danger ha-icon{color:#e53935}

/* --------------------------------------------------------------- popover */
.popover{position:fixed;z-index:60;background:var(--la-card);border-radius:18px;
  box-shadow:0 16px 48px rgba(10,10,40,.28);padding:14px;min-width:230px;max-width:min(92vw,430px);
  animation:pop .14s ease-out}
@keyframes pop{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
.popover h4{margin:0 0 10px;font-size:13px;color:var(--la-muted);text-transform:uppercase;letter-spacing:.06em}
.shape-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.shape-btn{width:64px;height:64px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:rgba(108,92,231,.06);transition:transform .1s,background .15s}
.shape-btn:hover{background:rgba(108,92,231,.16);transform:scale(1.06)}
.shape-btn svg{width:38px;height:38px;fill:var(--la-text);stroke:var(--la-text)}
.frame-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.frame-btn{display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 6px;
  border-radius:14px;background:rgba(108,92,231,.06);font-size:12px;font-weight:700}
.frame-btn:hover{background:rgba(108,92,231,.16)}
.frame-btn svg{width:44px;height:64px}
.sticker-cats{display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap}
.sticker-cats button{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;
  justify-content:center;color:var(--la-muted)}
.sticker-cats button.sel{background:var(--la-accent);color:#fff}
.sticker-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:2px;max-height:260px;
  overflow-y:auto;overscroll-behavior:contain}
.sticker-grid button{font-size:28px;width:52px;height:52px;border-radius:12px;line-height:1;
  transition:transform .1s}
.sticker-grid button:hover{background:rgba(108,92,231,.1);transform:scale(1.15)}

/* ---------------------------------------------------------------- modals */
.overlay{position:fixed;inset:0;background:rgba(15,15,35,.55);z-index:80;display:flex;
  align-items:center;justify-content:center;padding:18px;animation:fade .16s ease-out;
  backdrop-filter:blur(3px)}
@keyframes fade{from{opacity:0}to{opacity:1}}
.modal{background:var(--la-card);border-radius:22px;box-shadow:0 24px 80px rgba(5,5,30,.45);
  width:100%;max-width:560px;max-height:calc(100dvh - 40px);overflow-y:auto;padding:22px;
  overscroll-behavior:contain;animation:pop .18s ease-out}
.modal.wide{max-width:820px}
.modal h2{margin:0 0 4px;font-size:22px;font-weight:800;display:flex;align-items:center;gap:10px}
.modal h2 ha-icon{color:var(--la-accent)}
.modal .sub{margin:0 0 18px;color:var(--la-muted);font-size:14px;line-height:1.4}
.modal .x{position:absolute;top:14px;right:14px}
.modal-head{position:relative}
.field label{display:block;font-size:13px;font-weight:700;color:var(--la-muted);margin-bottom:6px}
.field input[type=text]{width:100%;height:48px;border-radius:14px;border:2px solid var(--la-line);
  padding:0 14px;font-size:16px;background:var(--la-bg)}
.field input[type=text]:focus{outline:none;border-color:var(--la-accent)}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:18px}

/* --------------------------------------------------------------- gallery */
.g-new{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:22px}
.g-new-btn{flex:1;min-width:150px;display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:18px 12px;border-radius:18px;border:2px dashed var(--la-accent-2);color:var(--la-accent);
  font-weight:800;font-size:15px;transition:background .15s,transform .1s}
.g-new-btn:hover{background:rgba(108,92,231,.08);transform:translateY(-2px)}
.g-new-btn .ph{border:3px solid currentColor;border-radius:6px;opacity:.75}
.g-new-btn .ph.p{width:34px;height:58px}
.g-new-btn .ph.l{width:58px;height:34px}
.g-section{margin-bottom:8px}
.g-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;margin-top:10px}
.g-card{border-radius:16px;background:var(--la-bg);padding:10px;display:flex;flex-direction:column;
  gap:8px;transition:transform .12s,box-shadow .15s;cursor:pointer;position:relative;border:2px solid transparent}
.g-card:hover{transform:translateY(-3px);box-shadow:var(--la-shadow);border-color:var(--la-accent-2)}
.g-thumb{width:100%;aspect-ratio:54/101;border-radius:10px;background:#fff;object-fit:contain;
  box-shadow:0 2px 8px rgba(0,0,0,.12)}
.g-thumb.land{aspect-ratio:101/54}
.g-name{font-weight:800;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.g-meta{font-size:11px;color:var(--la-muted);margin-top:-6px}
.g-del{position:absolute;top:6px;right:6px;width:34px;height:34px;border-radius:10px;
  background:rgba(255,255,255,.9);color:#e53935;display:flex;align-items:center;justify-content:center;
  opacity:0;transition:opacity .15s;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.g-card:hover .g-del{opacity:1}
@media (hover:none){.g-del{opacity:1}}
.g-starter-emoji{font-size:40px;display:flex;align-items:center;justify-content:center;
  width:100%;aspect-ratio:54/101;border-radius:10px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.12)}

/* ----------------------------------------------------------------- print */
.print-flex{display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap}
.print-preview{flex:0 0 auto;width:170px;border-radius:12px;box-shadow:var(--la-shadow);
  background:#fff;overflow:hidden;margin:0 auto}
.print-preview img{display:block;width:100%}
.print-side{flex:1;min-width:200px;display:flex;flex-direction:column;gap:16px}
.chip{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;
  font-weight:700;font-size:13px;align-self:flex-start}
.chip ha-icon{--mdc-icon-size:17px}
.chip.ok{background:rgba(67,160,71,.14);color:#2e7d32}
.chip.bad{background:rgba(229,57,53,.12);color:#c62828}
.chip.wait{background:rgba(108,92,231,.1);color:var(--la-accent)}
.copies-row{display:flex;align-items:center;gap:14px}
.copies-row .cnt{font-size:26px;font-weight:800;min-width:40px;text-align:center}
.copies-row .icon-btn{background:rgba(108,92,231,.1)}
.btn-big-print{height:56px;border-radius:18px;font-size:18px;justify-content:center;display:flex;
  align-items:center;gap:10px;background:var(--la-print);color:#fff;font-weight:800;
  box-shadow:0 8px 24px rgba(255,107,129,.4);width:100%}
.btn-big-print[disabled]{opacity:.55;pointer-events:none}

/* ----------------------------------------------------------------- toast */
.toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(20px);
  background:#23263a;color:#fff;padding:13px 22px;border-radius:999px;font-weight:700;font-size:14px;
  z-index:120;opacity:0;transition:all .25s;box-shadow:0 10px 30px rgba(0,0,0,.35);max-width:88vw;
  text-align:center}
.toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
.toast.err{background:#c62828}

/* -------------------------------------------------------------- confetti */
.confetti{position:fixed;top:-14px;z-index:150;pointer-events:none;border-radius:3px;
  animation:confetti-fall linear forwards}
@keyframes confetti-fall{
  to{transform:translateY(105vh) rotate(720deg);opacity:.9}
}

/* ---------------------------------------------------------------- mobile */
/* Phone layout: topbar / full-height stage / bottom toolbar in the thumb
   zone. The props panel leaves the grid entirely and becomes a bottom sheet
   sliding over the stage (host [data-sheet]), so the canvas NEVER resizes
   when a selection appears. Sheet/drawer anchors use literal offsets with
   env() fallbacks (a failed CSS var would strand them off-screen). */
@media (max-width: 900px){
  .app{grid-template-rows:auto 1fr auto;grid-template-columns:minmax(0,1fr);
    grid-template-areas:"top" "stage" "rail";}
  .menu-slot.has-menu{width:auto;flex:0 0 auto;margin-left:0}
  .brand>ha-icon{width:auto;flex:0 0 auto}
  .brand span{display:none}

  /* Compact topbar: essentials only. Rotate & B/W live in the toolbar.
     Longhand padding only — a shorthand here wipes the base rule's
     padding-top:env(safe-area-inset-top) and shoves the bar under the notch. */
  .top{gap:0;padding-left:4px;padding-right:8px}
  .icon-btn{width:40px;height:40px;border-radius:11px}
  #btn-rotate,#btn-bw{display:none}
  .btn span.lbl{display:none}
  .btn{padding:0 12px;height:40px;border-radius:12px}
  .top-actions{gap:4px}
  .name{max-width:none;font-size:15px;padding:6px 8px}

  /* Bottom toolbar: one horizontally scrollable row, 48px hit targets. */
  .rail{flex-direction:row;justify-content:flex-start;gap:2px;border-right:none;
    border-top:1px solid var(--la-line);overflow-x:auto;scrollbar-width:none;
    padding:6px 10px calc(6px + env(safe-area-inset-bottom));}
  .rail::-webkit-scrollbar{display:none}
  .rail .tool{flex:0 0 48px;height:48px}
  .rail .spacer{display:none}
  .m-tool{display:flex}

  .stage-inner{padding:14px}
  .zoom-fabs{right:10px;bottom:10px;gap:4px}
  .zoom-fabs .icon-btn{width:38px;height:38px}
  .stage-badge{left:10px;bottom:10px;padding:5px 11px;font-size:11px}

  /* Props bottom sheet (anchored above the toolbar). */
  .props{position:fixed;left:0;right:0;bottom:calc(60px + env(safe-area-inset-bottom, 0px));
    z-index:40;border-left:none;border-top:1px solid var(--la-line);
    border-radius:22px 22px 0 0;box-shadow:0 -14px 44px rgba(10,10,40,.22);
    max-height:46dvh;padding:4px 16px 16px;
    transform:translateY(130%);visibility:hidden;
    transition:transform .24s ease,visibility .24s;}
  :host([data-sheet]) .props{transform:none;visibility:visible}
  :host([data-sheet][data-dragging]) .props{transform:translateY(130%);visibility:hidden}
  .sheet-head{display:flex;align-items:center;justify-content:center;
    padding:10px 0 6px;position:sticky;top:0;background:var(--la-card);z-index:2}
  .sheet-grab{width:44px;height:5px;border-radius:99px;background:var(--la-line)}
  .sheet-close{position:absolute;right:-6px;top:2px;width:38px;height:38px;border-radius:12px;
    display:flex;align-items:center;justify-content:center;color:var(--la-muted)}
  .props .tip{display:none}
  .props .section{margin-bottom:16px}
  .props .font-list{max-height:32dvh}

  /* Popovers become bottom drawers just above the toolbar (exact offset is
     set inline by _openPopoverAt from a measured toolbar height). */
  .popover.mobile{left:8px;right:8px;top:auto;
    bottom:calc(68px + env(safe-area-inset-bottom, 0px));
    max-width:none;animation:pop-up .16s ease-out}
  @keyframes pop-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
  .shape-grid{grid-template-columns:repeat(auto-fill,minmax(64px,1fr))}
  .frame-grid{grid-template-columns:repeat(3,1fr)}

  .swatches{grid-template-columns:repeat(8,1fr)}
  .act-grid{grid-template-columns:repeat(2,1fr)}
}
@media (max-width: 520px){
  .swatches{grid-template-columns:repeat(6,1fr)}
  .top{padding-left:2px;padding-right:6px}
  .name{min-width:48px}
}
@media (max-width: 380px){
  #btn-redo{display:none}
}
`;

/* ------------------------------------------------------------------ shell */
const SHELL = `
<div class="app">
  <div class="top">
    <span class="menu-slot" id="menu-slot"></span>
    <div class="brand"><ha-icon icon="mdi:sticker-emoji"></ha-icon><span id="brand-title"></span></div>
    <div class="name-wrap">
      <input id="name" class="name" type="text" maxlength="60" autocomplete="off">
      <span id="dirty" class="dirty-dot" title=""></span>
    </div>
    <div class="top-actions">
      <button id="btn-undo" class="icon-btn" disabled><ha-icon icon="mdi:undo"></ha-icon></button>
      <button id="btn-redo" class="icon-btn" disabled><ha-icon icon="mdi:redo"></ha-icon></button>
      <button id="btn-rotate" class="icon-btn"><ha-icon icon="mdi:phone-rotate-landscape"></ha-icon></button>
      <button id="btn-bw" class="icon-btn"><ha-icon icon="mdi:invert-colors"></ha-icon></button>
      <button id="btn-gallery" class="icon-btn"><ha-icon icon="mdi:view-grid-plus"></ha-icon></button>
      <button id="btn-save" class="btn btn-save"><ha-icon icon="mdi:content-save"></ha-icon><span class="lbl" id="save-lbl"></span></button>
      <button id="btn-print" class="btn btn-print"><ha-icon icon="mdi:printer"></ha-icon><span class="lbl" id="print-lbl"></span></button>
    </div>
  </div>

  <div class="rail" id="rail">
    <button class="tool active" data-tool="select"><ha-icon icon="mdi:cursor-default"></ha-icon></button>
    <button class="tool" data-tool="text"><ha-icon icon="mdi:format-text"></ha-icon></button>
    <button class="tool" data-tool="shapes"><ha-icon icon="mdi:shape"></ha-icon></button>
    <button class="tool" data-tool="stickers"><ha-icon icon="mdi:emoticon-happy-outline"></ha-icon></button>
    <button class="tool" data-tool="image"><ha-icon icon="mdi:image-plus"></ha-icon></button>
    <button class="tool" data-tool="qr"><ha-icon icon="mdi:qrcode"></ha-icon></button>
    <button class="tool" data-tool="frames"><ha-icon icon="mdi:border-all-variant"></ha-icon></button>
    <button class="tool m-tool" data-tool="label"><ha-icon icon="mdi:format-color-fill"></ha-icon></button>
    <span class="spacer"></span>
    <button class="tool m-tool" data-tool="rotate"><ha-icon icon="mdi:phone-rotate-landscape"></ha-icon></button>
    <button class="tool m-tool" data-tool="bw" id="rail-bw"><ha-icon icon="mdi:invert-colors"></ha-icon></button>
    <button class="tool danger" data-tool="clear"><ha-icon icon="mdi:delete-sweep-outline"></ha-icon></button>
  </div>

  <div class="stage" id="stage">
    <div class="stage-inner" id="stage-inner">
      <div class="label-wrap" id="label-wrap">
        <div class="canvas-holder"><canvas id="cv"></canvas></div>
        <div class="guide v" id="guide-v"></div>
        <div class="guide h" id="guide-h"></div>
        <div class="bw-overlay" id="bw-overlay"><img id="bw-img" alt=""></div>
      </div>
    </div>
    <div class="stage-badge" id="stage-badge"><ha-icon icon="mdi:sticker-outline"></ha-icon><span>54 × 101 mm</span></div>
    <div class="zoom-fabs">
      <button id="zoom-in" class="icon-btn"><ha-icon icon="mdi:magnify-plus-outline"></ha-icon></button>
      <button id="zoom-fit" class="icon-btn"><ha-icon icon="mdi:fit-to-screen-outline"></ha-icon></button>
      <button id="zoom-out" class="icon-btn"><ha-icon icon="mdi:magnify-minus-outline"></ha-icon></button>
    </div>
  </div>

  <div class="props" id="props"></div>
</div>
<input type="file" id="file-input" accept="image/*" style="display:none">
`;

class LabelAssistantPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._state = null;
    this._unsub = null;
    this._built = false;
    this._ready = false;        // vendor libs + fonts loaded
    this._canvas = null;        // fabric.Canvas
    this._zoom = 0.5;
    this._userZoom = false;     // user overrode auto-fit
    this._orientation = "portrait";
    this._designId = null;
    this._designName = "";
    this._dirty = false;
    this._history = [];
    this._historyPos = -1;
    this._restoring = false;
    this._bwOn = false;
    this._popover = null;
    this._stickerCat = STICKERS[0].id;
    this._updateBwDebounced = debounce(() => this._updateBw(), 350);
    this._onKeyBound = (e) => this._onKey(e);
    this._onDocClickBound = (e) => this._onDocClick(e);
  }

  /* --------------------------------------------------------- HA plumbing */
  set hass(hass) {
    this._hass = hass;
    if (!this._built) this._init();
    if (!this._unsub && hass) this._subscribe();
    this._applyChrome();
  }
  get hass() { return this._hass; }
  set narrow(v) { this._narrow = v; this._applyChrome(); }
  get narrow() { return this._narrow; }
  set route(v) { this._route = v; }
  get route() { return this._route; }
  set panel(v) { this._panel = v; }
  get panel() { return this._panel; }

  connectedCallback() {
    if (!this._built && this._hass) this._init();
    document.addEventListener("keydown", this._onKeyBound);
    document.addEventListener("pointerdown", this._onDocClickBound, true);
  }
  disconnectedCallback() {
    document.removeEventListener("keydown", this._onKeyBound);
    document.removeEventListener("pointerdown", this._onDocClickBound, true);
    if (this._unsub) { try { this._unsub.then((u) => u()); } catch (e) {} this._unsub = null; }
  }

  _lang() {
    const raw = (this._hass && this._hass.language) || "en";
    return String(raw).split("-")[0].toLowerCase() === "nl" ? "nl" : "en";
  }
  t(key, ...args) {
    const table = STRINGS[this._lang()] || STRINGS.en;
    const v = key in table ? table[key] : STRINGS.en[key];
    return typeof v === "function" ? v(...args) : v;
  }
  _fontLabel(f) {
    return this._lang() === "en" && f.labelEn ? f.labelEn : f.label;
  }

  $(id) { return this.shadowRoot.getElementById(id); }

  /* ---------------------------------------------------------------- init */
  async _init() {
    this._built = true;

    // @font-face must live in the document, not the shadow root; the same
    // fonts are what fabric renders onto the canvas.
    if (!document.getElementById("la-doc-styles")) {
      const st = document.createElement("style");
      st.id = "la-doc-styles";
      st.textContent = FONT_FACES;
      document.head.appendChild(st);
    }

    this.shadowRoot.innerHTML = `<style>${STYLES}</style>${SHELL}`;
    this._applyStaticTexts();
    this._applyChrome();
    this._wireShell();

    try {
      await Promise.all([
        loadScript(`${BASE}/vendor/fabric.min.js`),
        loadScript(`${BASE}/vendor/qrcode.min.js`),
      ]);
      await this._loadFonts();
    } catch (err) {
      this._toast(`Vendor load failed: ${err.message}`, false);
      return;
    }

    this._initFabric();
    this._ready = true;
    this._newBlank("portrait", { silent: true });
    this._openGallery(true);
  }

  _applyStaticTexts() {
    const T = (id, key) => { const el = this.$(id); if (el) el.textContent = this.t(key); };
    this.$("brand-title").textContent = this.t("appTitle");
    this.$("name").placeholder = this.t("namePlaceholder");
    T("save-lbl", "save");
    T("print-lbl", "print");
    this.$("dirty").title = this.t("unsaved");
    const tips = {
      "btn-undo": "undo", "btn-redo": "redo", "btn-rotate": "rotate",
      "btn-bw": "bwPreview", "btn-gallery": "designs",
      "zoom-in": "zoomIn", "zoom-out": "zoomOut", "zoom-fit": "zoomFit",
    };
    for (const [id, key] of Object.entries(tips)) this.$(id).title = this.t(key);
    const toolTips = {
      select: "toolSelect", text: "toolText", shapes: "toolShapes",
      stickers: "toolStickers", image: "toolImage", qr: "toolQr",
      frames: "toolFrames", clear: "clearAll",
      label: "background", rotate: "rotate", bw: "bwPreview",
    };
    this.shadowRoot.querySelectorAll(".tool").forEach((b) => {
      b.title = this.t(toolTips[b.dataset.tool]);
    });
  }

  _applyChrome() {
    if (!this._built) return;
    const slot = this.$("menu-slot");
    if (!slot) return;
    if (!this._menuBtn) {
      this._menuBtn = document.createElement("ha-menu-button");
      slot.appendChild(this._menuBtn);
    }
    this._menuBtn.hass = this._hass;
    this._menuBtn.narrow = this._narrow ?? false;
    // ha-menu-button renders nothing while HA's sidebar is visible; only
    // reserve the 64px rail column when the hamburger is actually there.
    requestAnimationFrame(() => {
      if (this._menuBtn && slot.isConnected) {
        slot.classList.toggle("has-menu", this._menuBtn.offsetWidth > 0);
      }
    });
  }

  async _loadFonts() {
    const jobs = FONTS.filter((f) => f.file).map((f) =>
      document.fonts.load(`${f.weight} 24px "${f.family}"`).catch(() => {})
    );
    await Promise.all(jobs);
    await document.fonts.ready.catch(() => {});
  }

  /* ------------------------------------------------------------ WS layer */
  _ws(type, payload = {}) {
    return this._hass.connection.sendMessagePromise({
      type: `label_assistant/${type}`, ...payload,
    });
  }

  _subscribe() {
    if (!this._hass) return;
    this._unsub = this._hass.connection.subscribeMessage(
      (state) => this._onState(state),
      { type: "label_assistant/subscribe" }
    );
  }

  _onState(state) {
    this._state = state;
    if (state.label) { LABEL.w = state.label.width; LABEL.h = state.label.height; }
    // Live-refresh the gallery if it is open (e.g. someone saved elsewhere).
    const gal = this.shadowRoot.querySelector(".overlay[data-kind='gallery']");
    if (gal) this._renderGalleryContent(gal);
  }

  /* --------------------------------------------------------------- shell */
  _wireShell() {
    this.$("btn-undo").addEventListener("click", () => this._undo());
    this.$("btn-redo").addEventListener("click", () => this._redo());
    this.$("btn-rotate").addEventListener("click", () => this._toggleOrientation());
    this.$("btn-bw").addEventListener("click", () => this._toggleBw());
    this.$("btn-gallery").addEventListener("click", () => this._openGallery(false));
    this.$("btn-save").addEventListener("click", () => this._save());
    this.$("btn-print").addEventListener("click", () => this._openPrintModal());
    this.$("zoom-in").addEventListener("click", () => this._nudgeZoom(1.25));
    this.$("zoom-out").addEventListener("click", () => this._nudgeZoom(1 / 1.25));
    this.$("zoom-fit").addEventListener("click", () => { this._userZoom = false; this._fitZoom(); });

    this.$("name").addEventListener("input", (e) => {
      this._designName = e.target.value;
      this._markDirty();
    });

    this.$("rail").addEventListener("click", (e) => {
      const btn = e.target.closest(".tool");
      if (btn) this._onTool(btn.dataset.tool, btn);
    });

    this.$("file-input").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (file) this._addImageFile(file);
    });

    const ro = new ResizeObserver(() => { if (!this._userZoom) this._fitZoom(); });
    ro.observe(this.$("stage"));
    // iOS companion app: safe-area insets/viewport can settle after first
    // paint without resizing the stage box itself; refit once, late.
    setTimeout(() => { if (!this._userZoom) this._fitZoom(); }, 600);
    window.addEventListener("orientationchange", () =>
      setTimeout(() => { if (!this._userZoom) this._fitZoom(); }, 250));
  }

  /* -------------------------------------------------------------- fabric */
  _initFabric() {
    const f = window.fabric;
    f.Object.prototype.set({
      transparentCorners: false,
      cornerColor: "#6c5ce7",
      cornerStrokeColor: "#ffffff",
      borderColor: "#6c5ce7",
      cornerSize: 12,
      touchCornerSize: 26,
      cornerStyle: "circle",
      borderScaleFactor: 2,
      padding: 4,
    });
    this._canvas = new f.Canvas(this.$("cv"), {
      preserveObjectStacking: true,
      backgroundColor: "#ffffff",
      selection: true,
      stopContextMenu: true,
      fireRightClick: false,
    });

    const c = this._canvas;
    c.on("selection:created", () => { this._renderProps(); this._openSheet(); });
    c.on("selection:updated", () => { this._renderProps(); this._openSheet(); });
    c.on("selection:cleared", () => { this._renderProps(); this._closeSheet(); });
    c.on("object:added", () => this._pushHistory());
    c.on("object:removed", () => this._pushHistory());
    c.on("object:modified", () => this._pushHistory());
    // While transforming, tuck the mobile props sheet away so the object
    // being dragged is never hidden behind it.
    c.on("object:moving", (e) => { this._snap(e); this.setAttribute("data-dragging", ""); });
    c.on("object:scaling", () => this.setAttribute("data-dragging", ""));
    c.on("object:rotating", () => this.setAttribute("data-dragging", ""));
    c.on("mouse:up", () => { this._hideGuides(); this.removeAttribute("data-dragging"); });
    // On phones: keep the sheet out of the way while the keyboard is up for
    // inline text editing; bring the font/color sheet back once typing ends.
    c.on("text:editing:entered", () => this._closeSheet());
    c.on("text:editing:exited", () => this._openSheet());
    c.on("after:render", () => { if (this._bwOn) this._updateBwDebounced(); });
    this._fitZoom();
  }

  _labelSize() {
    return this._orientation === "portrait"
      ? { w: LABEL.w, h: LABEL.h }
      : { w: LABEL.h, h: LABEL.w };
  }

  _applyZoom() {
    const { w, h } = this._labelSize();
    this._canvas.setZoom(this._zoom);
    this._canvas.setDimensions({ width: w * this._zoom, height: h * this._zoom });
    this._canvas.requestRenderAll();
  }

  /* On phones the props panel is a bottom sheet over the stage; it opens on
     selection and slides away on deselect, so the canvas never resizes. */
  _isMobile() { return window.matchMedia("(max-width: 900px)").matches; }
  _openSheet() { if (this._isMobile()) this.setAttribute("data-sheet", ""); }
  _closeSheet() { this.removeAttribute("data-sheet"); }

  _fitZoom() {
    if (!this._canvas) return;
    const stage = this.$("stage");
    const pad = this._isMobile() ? 26 : 64;
    const { w, h } = this._labelSize();
    this._zoom = clamp(
      Math.min((stage.clientWidth - pad) / w, (stage.clientHeight - pad) / h),
      0.08, 1.5
    );
    this._applyZoom();
  }

  _nudgeZoom(factor) {
    this._userZoom = true;
    this._zoom = clamp(this._zoom * factor, 0.08, 3);
    this._applyZoom();
  }

  _toggleOrientation() {
    this._orientation = this._orientation === "portrait" ? "landscape" : "portrait";
    this._userZoom = false;
    this._fitZoom();
    this._pushHistory();
    if (this._bwOn) this._updateBwDebounced();
  }

  /* ------------------------------------------------------------- history */
  _snapshot() {
    return JSON.stringify({
      o: this._orientation,
      j: this._canvas.toJSON(EXTRA_PROPS),
    });
  }

  _pushHistory() {
    if (this._restoring || !this._canvas) return;
    const snap = this._snapshot();
    if (this._history[this._historyPos] === snap) return;
    this._history = this._history.slice(0, this._historyPos + 1);
    this._history.push(snap);
    if (this._history.length > HISTORY_MAX) this._history.shift();
    this._historyPos = this._history.length - 1;
    this._markDirty();
    this._updateUndoButtons();
    if (this._bwOn) this._updateBwDebounced();
  }

  _resetHistory() {
    this._history = [this._snapshot()];
    this._historyPos = 0;
    this._setDirty(false);
    this._updateUndoButtons();
  }

  _undo() { if (this._historyPos > 0) this._restoreSnap(this._history[--this._historyPos]); }
  _redo() {
    if (this._historyPos < this._history.length - 1) {
      this._restoreSnap(this._history[++this._historyPos]);
    }
  }

  _restoreSnap(snap) {
    this._restoring = true;
    const { o, j } = JSON.parse(snap);
    if (o !== this._orientation) {
      this._orientation = o;
      this._userZoom = false;
    }
    this._canvas.loadFromJSON(j, () => {
      this._restoring = false;
      this._fitZoom();
      this._canvas.renderAll();
      this._markDirty();
      this._updateUndoButtons();
      this._renderProps();
      if (this._bwOn) this._updateBwDebounced();
    });
  }

  _updateUndoButtons() {
    this.$("btn-undo").disabled = this._historyPos <= 0;
    this.$("btn-redo").disabled = this._historyPos >= this._history.length - 1;
  }

  _markDirty() { this._setDirty(true); }
  _setDirty(v) {
    this._dirty = v;
    const dot = this.$("dirty");
    if (dot) dot.classList.toggle("on", v);
  }

  /* ------------------------------------------------------------ snapping */
  _snap(e) {
    const obj = e.target;
    if (!obj) return;
    const f = window.fabric;
    const { w, h } = this._labelSize();
    const th = 9 / this._zoom;
    const c1 = obj.getCenterPoint();
    let sx = false;
    if (Math.abs(c1.x - w / 2) < th) {
      obj.setPositionByOrigin(new f.Point(w / 2, c1.y), "center", "center");
      sx = true;
    }
    const c2 = obj.getCenterPoint();
    let sy = false;
    if (Math.abs(c2.y - h / 2) < th) {
      obj.setPositionByOrigin(new f.Point(c2.x, h / 2), "center", "center");
      sy = true;
    }
    this.$("guide-v").classList.toggle("on", sx);
    this.$("guide-h").classList.toggle("on", sy);
  }

  _hideGuides() {
    this.$("guide-v").classList.remove("on");
    this.$("guide-h").classList.remove("on");
  }

  /* --------------------------------------------------------------- tools */
  _onTool(tool, btn) {
    this._closePopover();
    switch (tool) {
      case "text": this._addText(); break;
      case "shapes": this._openShapesPopover(btn); break;
      case "stickers": this._openStickersPopover(btn); break;
      case "image": this.$("file-input").click(); break;
      case "qr": this._openQrModal(null); break;
      case "frames": this._openFramesPopover(btn); break;
      // Mobile-only rail tools; their topbar twins are hidden on narrow.
      case "rotate": this._toggleOrientation(); break;
      case "bw": this._toggleBw(); break;
      case "label":
        this._canvas.discardActiveObject();
        this._canvas.requestRenderAll();
        this._renderProps();
        this._openSheet();
        break;
      case "clear":
        if (confirm(this.t("confirmClear"))) {
          this._canvas.discardActiveObject();
          this._canvas.remove(...this._canvas.getObjects());
          this._canvas.requestRenderAll();
        }
        break;
    }
  }

  _addAndSelect(obj) {
    this._canvas.add(obj);
    this._canvas.setActiveObject(obj);
    this._canvas.requestRenderAll();
    // New objects land at the label centre; make sure that centre is in
    // view (a mis-fitted/scrolled stage otherwise swallows them silently).
    if (!this._userZoom) this._fitZoom();
    const stage = this.$("stage");
    if (stage) {
      stage.scrollTo({
        left: Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2),
        top: Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2),
      });
    }
  }

  _addText() {
    const f = window.fabric;
    const { w, h } = this._labelSize();
    const t = new f.Textbox(this.t("addTextDefault"), {
      left: w / 2, top: h / 2, originX: "center", originY: "center",
      width: Math.round(w * 0.8),
      fontSize: 96, fontFamily: "Nunito", fontWeight: 800,
      fill: "#000000", textAlign: "center",
    });
    this._addAndSelect(t);
    t.enterEditing();
    t.selectAll();
  }

  _addShape(kind) {
    const f = window.fabric;
    const { w, h } = this._labelSize();
    const base = { left: w / 2, top: h / 2, originX: "center", originY: "center" };
    let obj = null;
    switch (kind) {
      case "rect":
        obj = new f.Rect({ ...base, width: 300, height: 220, fill: "#000000" });
        break;
      case "rounded":
        obj = new f.Rect({ ...base, width: 300, height: 220, rx: 42, ry: 42, fill: "#000000" });
        break;
      case "circle":
        obj = new f.Circle({ ...base, radius: 140, fill: "#000000" });
        break;
      case "triangle":
        obj = new f.Triangle({ ...base, width: 290, height: 250, fill: "#000000" });
        break;
      case "star":
        obj = new f.Polygon(starPoints(5, 150, 60), { ...base, fill: "#000000" });
        break;
      case "heart":
        obj = new f.Path(HEART_PATH, { ...base, fill: "#000000" });
        obj.scaleToWidth(300);
        break;
      case "line":
        obj = new f.Rect({ ...base, width: 360, height: 10, rx: 5, ry: 5, fill: "#000000" });
        break;
      case "arrow":
        obj = new f.Path("M 0 26 L 250 26 L 250 0 L 330 40 L 250 80 L 250 54 L 0 54 Z",
          { ...base, fill: "#000000" });
        break;
    }
    if (obj) this._addAndSelect(obj);
  }

  _addSticker(emoji) {
    const f = window.fabric;
    const { w, h } = this._labelSize();
    const t = new f.Text(emoji, {
      left: w / 2, top: h / 2, originX: "center", originY: "center",
      fontSize: 200, fontFamily: "sans-serif", laType: "sticker",
    });
    this._addAndSelect(t);
    this._closePopover();
  }

  async _addImageFile(file) {
    if (file.size > 8 * 1024 * 1024) { this._toast(this.t("imageTooBig"), false); return; }
    let dataUrl;
    try {
      dataUrl = await downscaleImage(file, 1500);
    } catch (err) {
      this._toast(this.t("loadFailedToast"), false);
      return;
    }
    const f = window.fabric;
    const { w, h } = this._labelSize();
    f.Image.fromURL(dataUrl, (img) => {
      const maxW = w * 0.85, maxH = h * 0.6;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      img.set({
        left: w / 2, top: h / 2, originX: "center", originY: "center",
        scaleX: scale, scaleY: scale, laType: "image",
      });
      this._addAndSelect(img);
    });
  }

  /* ------------------------------------------------------------------ QR */
  _qrDataUrl(text, scale = 14) {
    const qr = window.qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 2;
    const size = (n + quiet * 2) * scale;
    const cv = document.createElement("canvas");
    cv.width = size; cv.height = size;
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000000";
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (qr.isDark(r, col)) {
          ctx.fillRect((col + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
    }
    return cv.toDataURL("image/png");
  }

  _insertQr(text, replaceObj) {
    const f = window.fabric;
    const { w, h } = this._labelSize();
    let url;
    try {
      url = this._qrDataUrl(text);
    } catch (err) {
      this._toast(`QR: ${err.message || err}`, false);
      return;
    }
    f.Image.fromURL(url, (img) => {
      img.set({ laType: "qr", laQr: text });
      if (replaceObj) {
        img.set({
          left: replaceObj.left, top: replaceObj.top,
          originX: replaceObj.originX, originY: replaceObj.originY,
          angle: replaceObj.angle,
        });
        img.scaleToWidth(replaceObj.getScaledWidth());
        this._canvas.remove(replaceObj);
      } else {
        img.scaleToWidth(Math.min(360, w * 0.55));
        img.set({ left: w / 2, top: h / 2, originX: "center", originY: "center" });
      }
      this._addAndSelect(img);
    });
  }

  _openQrModal(existing) {
    const value = existing ? existing.laQr || "" : "";
    const ov = this._modal(`
      <div class="modal">
        <div class="modal-head">
          <h2><ha-icon icon="mdi:qrcode"></ha-icon>${esc(this.t("qrTitle"))}</h2>
          <p class="sub">${esc(this.t("qrHint"))}</p>
          <button class="icon-btn x" data-close><ha-icon icon="mdi:close"></ha-icon></button>
        </div>
        <div class="field">
          <input id="qr-text" type="text" placeholder="${esc(this.t("qrPlaceholder"))}" value="${esc(value)}">
        </div>
        <div class="modal-actions">
          <button class="btn btn-print" id="qr-ok">
            <ha-icon icon="mdi:check"></ha-icon>${esc(this.t(existing ? "qrUpdate" : "qrAdd"))}
          </button>
        </div>
      </div>`);
    const input = ov.querySelector("#qr-text");
    const ok = () => {
      const text = input.value.trim();
      if (!text) return;
      this._insertQr(text, existing);
      ov.remove();
    };
    ov.querySelector("#qr-ok").addEventListener("click", ok);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") ok(); });
    setTimeout(() => input.focus(), 60);
  }

  /* -------------------------------------------------------------- frames */
  _applyFrame(styleId) {
    const f = window.fabric;
    const { w, h } = this._labelSize();
    const old = this._canvas.getObjects().find((o) => o.laType === "frame");
    if (old) this._canvas.remove(old);
    const stroke = "#000000";
    const mk = (inset, extra = {}) => new f.Rect({
      left: inset, top: inset, width: w - inset * 2, height: h - inset * 2,
      fill: "", stroke, strokeUniform: false, laType: "frame",
      ...extra,
    });
    let obj = null;
    switch (styleId) {
      case "solid": obj = mk(26, { strokeWidth: 8 }); break;
      case "thick": obj = mk(32, { strokeWidth: 24 }); break;
      case "dashed": obj = mk(28, { strokeWidth: 10, strokeDashArray: [34, 26] }); break;
      case "double":
        obj = new f.Group([
          mk(24, { strokeWidth: 6 }),
          mk(48, { strokeWidth: 14 }),
        ], { laType: "frame" });
        break;
      case "rounded": obj = mk(28, { strokeWidth: 10, rx: 52, ry: 52 }); break;
      case "scallop":
        obj = new f.Path(wavyPath(w, h, 34, 74, 20), {
          fill: "", stroke, strokeWidth: 8, laType: "frame",
        });
        break;
    }
    if (obj) {
      this._canvas.add(obj);
      obj.sendToBack();
      this._canvas.requestRenderAll();
      this._closePopover();
    }
  }

  /* ------------------------------------------------------------ popovers */
  _closePopover() {
    if (this._popover) { this._popover.remove(); this._popover = null; }
  }

  _openPopoverAt(btn, html) {
    this._closePopover();
    const pop = document.createElement("div");
    pop.className = "popover";
    pop.innerHTML = html;
    this.shadowRoot.appendChild(pop);
    if (this._isMobile()) {
      // Phones get a bottom drawer just above the toolbar instead of a
      // floating bubble. Positioned inline from a real measurement of the
      // toolbar, so no CSS-variable resolution can ever strand it off-screen.
      pop.classList.add("mobile");
      const rail = this.$("rail");
      const railH = rail ? Math.ceil(rail.getBoundingClientRect().height) : 60;
      pop.style.left = "8px";
      pop.style.right = "8px";
      pop.style.top = "auto";
      pop.style.bottom = `${railH + 8}px`;
      this._popover = pop;
      return pop;
    }
    const rect = btn.getBoundingClientRect();
    // Measure after insert, then clamp inside the viewport.
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    const left = clamp(rect.right + 12, 8, window.innerWidth - pw - 8);
    const top = clamp(rect.top - 8, 8, window.innerHeight - ph - 8);
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
    this._popover = pop;
    return pop;
  }

  _onDocClick(e) {
    if (!this._popover) return;
    const path = e.composedPath();
    if (!path.includes(this._popover) && !path.some(
      (n) => n.classList && n.classList.contains && n.classList.contains("tool")
    )) {
      this._closePopover();
    }
  }

  _openShapesPopover(btn) {
    const shapes = [
      ["rect", '<rect x="6" y="9" width="26" height="20" rx="2"/>'],
      ["rounded", '<rect x="6" y="9" width="26" height="20" rx="8"/>'],
      ["circle", '<circle cx="19" cy="19" r="12"/>'],
      ["triangle", '<path d="M19 6 L33 30 L5 30 Z"/>'],
      ["star", '<path d="M19 4 l3.7 8.6 9.3.8 -7 6.1 2.1 9.1 -8.1-4.8 -8.1 4.8 2.1-9.1 -7-6.1 9.3-.8 Z"/>'],
      ["heart", '<path d="M19 32 C10 25 4 20 4 13.5 C4 9 7.5 6 11.5 6 C14.5 6 17.5 8 19 11 C20.5 8 23.5 6 26.5 6 C30.5 6 34 9 34 13.5 C34 20 28 25 19 32 Z"/>'],
      ["line", '<rect x="4" y="17" width="30" height="4" rx="2"/>'],
      ["arrow", '<path d="M4 17 L24 17 L24 11 L34 19 L24 27 L24 21 L4 21 Z"/>'],
    ];
    const pop = this._openPopoverAt(btn, `
      <h4>${esc(this.t("shapesTitle"))}</h4>
      <div class="shape-grid">
        ${shapes.map(([id, svg]) =>
          `<button class="shape-btn" data-shape="${id}"><svg viewBox="0 0 38 38">${svg}</svg></button>`
        ).join("")}
      </div>`);
    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-shape]");
      if (b) { this._addShape(b.dataset.shape); this._closePopover(); }
    });
  }

  _openStickersPopover(btn) {
    const catNames = {
      food: "catFood", animals: "catAnimals", faces: "catFaces",
      party: "catParty", nature: "catNature", things: "catThings",
    };
    const pop = this._openPopoverAt(btn, `
      <h4>${esc(this.t("stickersTitle"))}</h4>
      <div class="sticker-cats">
        ${STICKERS.map((c) =>
          `<button data-cat="${c.id}" class="${c.id === this._stickerCat ? "sel" : ""}"
             title="${esc(this.t(catNames[c.id]))}"><ha-icon icon="${c.icon}"></ha-icon></button>`
        ).join("")}
      </div>
      <div class="sticker-grid" id="sticker-grid"></div>`);
    const renderGrid = () => {
      const cat = STICKERS.find((c) => c.id === this._stickerCat) || STICKERS[0];
      pop.querySelector("#sticker-grid").innerHTML = cat.set.split(" ")
        .map((em) => `<button data-emoji="${esc(em)}">${em}</button>`).join("");
    };
    renderGrid();
    pop.addEventListener("click", (e) => {
      const catBtn = e.target.closest("[data-cat]");
      if (catBtn) {
        this._stickerCat = catBtn.dataset.cat;
        pop.querySelectorAll("[data-cat]").forEach((b) =>
          b.classList.toggle("sel", b.dataset.cat === this._stickerCat));
        renderGrid();
        return;
      }
      const emBtn = e.target.closest("[data-emoji]");
      if (emBtn) this._addSticker(emBtn.dataset.emoji);
    });
  }

  _openFramesPopover(btn) {
    const frames = [
      ["solid", "frSolid", '<rect x="6" y="4" width="32" height="56" fill="none" stroke="currentColor" stroke-width="3"/>'],
      ["thick", "frThick", '<rect x="7" y="5" width="30" height="54" fill="none" stroke="currentColor" stroke-width="7"/>'],
      ["dashed", "frDashed", '<rect x="6" y="4" width="32" height="56" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="7 5"/>'],
      ["double", "frDouble", '<rect x="4" y="2" width="36" height="60" fill="none" stroke="currentColor" stroke-width="2"/><rect x="10" y="8" width="24" height="48" fill="none" stroke="currentColor" stroke-width="4"/>'],
      ["rounded", "frRounded", '<rect x="6" y="4" width="32" height="56" rx="10" fill="none" stroke="currentColor" stroke-width="3"/>'],
      ["scallop", "frScallop", '<rect x="7" y="5" width="30" height="54" rx="4" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="0.5 7" stroke-linecap="round"/>'],
    ];
    const pop = this._openPopoverAt(btn, `
      <h4>${esc(this.t("framesTitle"))}</h4>
      <div class="frame-grid">
        ${frames.map(([id, nameKey, svg]) =>
          `<button class="frame-btn" data-frame="${id}">
             <svg viewBox="0 0 44 64">${svg}</svg><span>${esc(this.t(nameKey))}</span>
           </button>`).join("")}
      </div>`);
    pop.addEventListener("click", (e) => {
      const b = e.target.closest("[data-frame]");
      if (b) this._applyFrame(b.dataset.frame);
    });
  }

  /* --------------------------------------------------------- props panel */
  _activeObjects() {
    return this._canvas ? this._canvas.getActiveObjects() : [];
  }

  _renderProps() {
    const el = this.$("props");
    if (!el || !this._canvas) return;
    const objs = this._activeObjects();
    if (!objs.length) { this._renderLabelProps(el); return; }

    const single = objs.length === 1 ? objs[0] : null;
    const isText = single && (single.type === "textbox" || single.type === "i-text");
    const isSticker = single && single.laType === "sticker";
    const isQr = single && single.laType === "qr";
    const isImage = single && single.laType === "image";
    // "Line work" = things you color via stroke, not fill.
    const strokeMain = single && !isText &&
      (single.stroke && (!single.fill || single.fill === ""));

    let html = this._sheetHeadHtml();

    if (isQr) {
      html += `<div class="section">
        <h3><ha-icon icon="mdi:qrcode"></ha-icon>${esc(this.t("qrTitle"))}</h3>
        <button class="act" id="p-qr-edit"><ha-icon icon="mdi:pencil"></ha-icon>${esc(this.t("edit"))}</button>
      </div>`;
    }

    if (isText) {
      const fontSel = `${single.fontFamily}|${single.fontWeight}`;
      html += `<div class="section">
        <h3><ha-icon icon="mdi:format-font"></ha-icon>${esc(this.t("fontTitle"))}</h3>
        <div class="font-list">
          ${FONTS.map((f) => `
            <button class="font-item ${fontSel === `${f.family}|${f.weight}` ? "sel" : ""}"
              data-font="${f.id}"
              style="font-family:'${f.family}';font-weight:${f.weight}">${esc(this._fontLabel(f))}</button>`).join("")}
        </div>
      </div>
      <div class="section">
        <h3><ha-icon icon="mdi:format-size"></ha-icon>${esc(this.t("size"))}</h3>
        <div class="slider-row">
          <input type="range" id="p-fontsize" min="28" max="320" step="2" value="${Math.round(single.fontSize)}">
          <span class="slider-val" id="p-fontsize-val">${Math.round(single.fontSize)}</span>
        </div>
      </div>
      <div class="section">
        <h3><ha-icon icon="mdi:format-align-center"></ha-icon>${esc(this.t("align"))}</h3>
        <div class="seg" id="p-align">
          <button data-align="left" title="${esc(this.t("alignLeft"))}" class="${single.textAlign === "left" ? "sel" : ""}"><ha-icon icon="mdi:format-align-left"></ha-icon></button>
          <button data-align="center" title="${esc(this.t("alignCenter"))}" class="${single.textAlign === "center" ? "sel" : ""}"><ha-icon icon="mdi:format-align-center"></ha-icon></button>
          <button data-align="right" title="${esc(this.t("alignRight"))}" class="${single.textAlign === "right" ? "sel" : ""}"><ha-icon icon="mdi:format-align-right"></ha-icon></button>
        </div>
      </div>`;
    }

    if (!isSticker && !isQr && !isImage) {
      const cur = strokeMain ? single?.stroke : (single ? single.fill : null);
      html += `<div class="section">
        <h3><ha-icon icon="mdi:palette"></ha-icon>${esc(this.t("fill"))}</h3>
        ${this._swatchesHtml("p-fill", cur, { allowNone: !isText && !strokeMain })}
      </div>`;
      if (!isText) {
        const sw = single ? (single.strokeWidth || 0) : 0;
        html += `<div class="section">
          <h3><ha-icon icon="mdi:border-color"></ha-icon>${esc(this.t("stroke"))}</h3>
          ${strokeMain ? "" : this._swatchesHtml("p-stroke", single ? single.stroke : null, { allowNone: true })}
          <div class="slider-row" style="margin-top:10px">
            <input type="range" id="p-strokew" min="0" max="46" step="2" value="${sw}">
            <span class="slider-val" id="p-strokew-val">${sw}</span>
          </div>
        </div>`;
      }
    }

    html += `<div class="section">
      <h3><ha-icon icon="mdi:layers-outline"></ha-icon>${esc(this.t("propsLabel"))}</h3>
      <div class="act-grid">
        <button class="act" id="p-front"><ha-icon icon="mdi:arrange-bring-forward"></ha-icon>${esc(this.t("layerUp"))}</button>
        <button class="act" id="p-back"><ha-icon icon="mdi:arrange-send-backward"></ha-icon>${esc(this.t("layerDown"))}</button>
        <button class="act" id="p-ctrh"><ha-icon icon="mdi:align-horizontal-center"></ha-icon>${esc(this.t("centerH"))}</button>
        <button class="act" id="p-ctrv"><ha-icon icon="mdi:align-vertical-center"></ha-icon>${esc(this.t("centerV"))}</button>
        <button class="act" id="p-dup"><ha-icon icon="mdi:content-copy"></ha-icon>${esc(this.t("duplicate"))}</button>
        <button class="act danger" id="p-del"><ha-icon icon="mdi:trash-can-outline"></ha-icon>${esc(this.t("remove"))}</button>
      </div>
    </div>`;

    el.innerHTML = html;
    this._wireSheetHead(el);
    this._wireProps(objs, { single, isText, strokeMain });
  }

  /* Grab bar + close chevron for the mobile bottom sheet (hidden on desktop). */
  _sheetHeadHtml() {
    return `<div class="sheet-head">
      <span class="sheet-grab"></span>
      <button class="sheet-close" data-sheet-close><ha-icon icon="mdi:chevron-down"></ha-icon></button>
    </div>`;
  }

  _wireSheetHead(el) {
    const btn = el.querySelector("[data-sheet-close]");
    if (btn) btn.addEventListener("click", () => this._closeSheet());
  }

  _swatchesHtml(idPrefix, current, { allowNone } = {}) {
    const norm = (c) => (c || "").toLowerCase();
    return `<div class="swatches" data-swatches="${idPrefix}">
      ${allowNone ? `<button class="swatch none ${!current ? "sel" : ""}" data-color="" title="${esc(this.t("noColor"))}"></button>` : ""}
      ${PALETTE.map((c) => `
        <button class="swatch ${norm(current) === c ? "sel" : ""}" data-color="${c}"
          style="background:${c}" title="${c}"></button>`).join("")}
      <button class="swatch custom" data-custom title="${esc(this.t("customColor"))}"></button>
      <input type="color" data-picker style="position:absolute;width:0;height:0;opacity:0;border:0;padding:0">
    </div>`;
  }

  _wireSwatches(root, idPrefix, apply) {
    const wrap = root.querySelector(`[data-swatches="${idPrefix}"]`);
    if (!wrap) return;
    const picker = wrap.querySelector("[data-picker]");
    wrap.addEventListener("click", (e) => {
      const custom = e.target.closest("[data-custom]");
      if (custom) { picker.click(); return; }
      const sw = e.target.closest("[data-color]");
      if (!sw) return;
      wrap.querySelectorAll(".swatch").forEach((s) => s.classList.remove("sel"));
      sw.classList.add("sel");
      apply(sw.dataset.color || "");
    });
    picker.addEventListener("input", (e) => apply(e.target.value));
    picker.addEventListener("change", () => this._pushHistory());
  }

  _wireProps(objs, { single, isText, strokeMain }) {
    const el = this.$("props");
    const c = this._canvas;
    const commit = () => { c.requestRenderAll(); this._pushHistory(); };

    this._wireSwatches(el, "p-fill", (color) => {
      objs.forEach((o) => {
        if (strokeMain) o.set("stroke", color || "#000000");
        else o.set("fill", color);
      });
      commit();
    });
    this._wireSwatches(el, "p-stroke", (color) => {
      objs.forEach((o) => {
        o.set("stroke", color || null);
        if (color && !o.strokeWidth) o.set("strokeWidth", 8);
      });
      const swEl = el.querySelector("#p-strokew");
      if (swEl && single && single.strokeWidth) swEl.value = single.strokeWidth;
      commit();
    });

    const strokew = el.querySelector("#p-strokew");
    if (strokew) {
      strokew.addEventListener("input", (e) => {
        const v = parseInt(e.target.value, 10);
        el.querySelector("#p-strokew-val").textContent = v;
        objs.forEach((o) => {
          o.set("strokeWidth", v);
          if (v && !o.stroke) o.set("stroke", "#000000");
          o.setCoords();
        });
        c.requestRenderAll();
      });
      strokew.addEventListener("change", () => this._pushHistory());
    }

    const fontsize = el.querySelector("#p-fontsize");
    if (fontsize) {
      fontsize.addEventListener("input", (e) => {
        const v = parseInt(e.target.value, 10);
        el.querySelector("#p-fontsize-val").textContent = v;
        objs.forEach((o) => { o.set("fontSize", v); o.setCoords(); });
        c.requestRenderAll();
      });
      fontsize.addEventListener("change", () => this._pushHistory());
    }

    el.querySelectorAll("[data-font]").forEach((b) => {
      b.addEventListener("click", () => {
        const f = FONTS.find((x) => x.id === b.dataset.font);
        if (!f) return;
        objs.forEach((o) => o.set({ fontFamily: f.family, fontWeight: f.weight }));
        el.querySelectorAll("[data-font]").forEach((x) => x.classList.toggle("sel", x === b));
        commit();
      });
    });

    const align = el.querySelector("#p-align");
    if (align) {
      align.addEventListener("click", (e) => {
        const b = e.target.closest("[data-align]");
        if (!b) return;
        objs.forEach((o) => o.set("textAlign", b.dataset.align));
        align.querySelectorAll("button").forEach((x) => x.classList.toggle("sel", x === b));
        commit();
      });
    }

    const qrEdit = el.querySelector("#p-qr-edit");
    if (qrEdit) qrEdit.addEventListener("click", () => this._openQrModal(single));

    const on = (id, fn) => {
      const b = el.querySelector(`#${id}`);
      if (b) b.addEventListener("click", fn);
    };
    on("p-front", () => { objs.forEach((o) => o.bringForward()); commit(); });
    on("p-back", () => {
      objs.forEach((o) => o.sendBackwards());
      commit();
    });
    on("p-ctrh", () => { objs.forEach((o) => this._centerObj(o, "h")); commit(); });
    on("p-ctrv", () => { objs.forEach((o) => this._centerObj(o, "v")); commit(); });
    on("p-dup", () => this._duplicateSelection());
    on("p-del", () => this._deleteSelection());
  }

  _centerObj(obj, axis) {
    const f = window.fabric;
    const { w, h } = this._labelSize();
    const cp = obj.getCenterPoint();
    const target = axis === "h" ? new f.Point(w / 2, cp.y) : new f.Point(cp.x, h / 2);
    obj.setPositionByOrigin(target, "center", "center");
    obj.setCoords();
  }

  _duplicateSelection() {
    const objs = this._activeObjects();
    if (!objs.length) return;
    const c = this._canvas;
    c.discardActiveObject();
    const clones = [];
    let pending = objs.length;
    objs.forEach((o) => {
      o.clone((cl) => {
        cl.set({ left: cl.left + 30, top: cl.top + 30 });
        c.add(cl);
        clones.push(cl);
        if (--pending === 0) {
          if (clones.length === 1) {
            c.setActiveObject(clones[0]);
          } else {
            const sel = new window.fabric.ActiveSelection(clones, { canvas: c });
            c.setActiveObject(sel);
          }
          c.requestRenderAll();
        }
      }, EXTRA_PROPS);
    });
  }

  _deleteSelection() {
    const objs = this._activeObjects();
    if (!objs.length) return;
    this._canvas.discardActiveObject();
    this._canvas.remove(...objs);
    this._canvas.requestRenderAll();
  }

  _renderLabelProps(el) {
    const bg = this._canvas ? this._canvas.backgroundColor : "#ffffff";
    el.innerHTML = `
      ${this._sheetHeadHtml()}
      <div class="section">
        <h3><ha-icon icon="mdi:sticker-outline"></ha-icon>${esc(this.t("propsLabel"))}</h3>
        <div class="tip">${esc(this.t("tipEmpty"))}</div>
      </div>
      <div class="section">
        <h3><ha-icon icon="mdi:format-color-fill"></ha-icon>${esc(this.t("background"))}</h3>
        ${this._swatchesHtml("p-bg", bg, { allowNone: false })}
      </div>`;
    this._wireSheetHead(el);
    this._wireSwatches(el, "p-bg", (color) => {
      this._canvas.setBackgroundColor(color || "#ffffff", () => {
        this._canvas.requestRenderAll();
        this._pushHistory();
      });
    });
  }

  /* ------------------------------------------------------ modals & toast */
  _modal(html, kind) {
    const ov = document.createElement("div");
    ov.className = "overlay";
    if (kind) ov.dataset.kind = kind;
    ov.innerHTML = html;
    ov.addEventListener("click", (e) => {
      if (e.target === ov || e.target.closest("[data-close]")) ov.remove();
    });
    this.shadowRoot.appendChild(ov);
    return ov;
  }

  _toast(msg, ok = true) {
    const old = this.shadowRoot.querySelector(".toast");
    if (old) old.remove();
    const el = document.createElement("div");
    el.className = `toast ${ok ? "" : "err"}`;
    el.textContent = msg;
    this.shadowRoot.appendChild(el);
    requestAnimationFrame(() => el.classList.add("on"));
    setTimeout(() => { el.classList.remove("on"); setTimeout(() => el.remove(), 350); }, 3200);
  }

  /* ------------------------------------------------------------- gallery */
  _openGallery(isStart) {
    this._closePopover();
    if (this.shadowRoot.querySelector(".overlay[data-kind='gallery']")) return;
    const ov = this._modal(`
      <div class="modal wide">
        <div class="modal-head">
          <h2><ha-icon icon="mdi:sticker-emoji"></ha-icon>${esc(this.t("galleryTitle"))}</h2>
          <p class="sub">${esc(this.t("gallerySub"))}</p>
          <button class="icon-btn x" data-close><ha-icon icon="mdi:close"></ha-icon></button>
        </div>
        <div id="g-body"></div>
      </div>`, "gallery");
    ov.dataset.start = isStart ? "1" : "";
    this._renderGalleryContent(ov);
  }

  _renderGalleryContent(ov) {
    const body = ov.querySelector("#g-body");
    if (!body) return;
    const lang = this._lang();
    const designs = (this._state && this._state.designs) || [];
    const starters = [
      { id: "name", emoji: "⭐", key: "starterName" },
      { id: "jar", emoji: "🍓", key: "starterJar" },
      { id: "toy", emoji: "🧸", key: "starterToy" },
      { id: "gift", emoji: "💝", key: "starterGift" },
    ];
    const h3 = 'style="margin:16px 0 2px;font-size:13px;text-transform:uppercase;letter-spacing:.08em;color:var(--la-muted)"';
    const fmtDate = (iso) => {
      try {
        return new Date(iso).toLocaleDateString(lang === "nl" ? "nl-NL" : "en-GB",
          { day: "numeric", month: "short" });
      } catch (e) { return ""; }
    };
    body.innerHTML = `
      <div class="g-new">
        <button class="g-new-btn" data-new="portrait">
          <span class="ph p"></span>${esc(this.t("newLabel"))} · ${esc(this.t("portrait"))}
        </button>
        <button class="g-new-btn" data-new="landscape">
          <span class="ph l"></span>${esc(this.t("newLabel"))} · ${esc(this.t("landscape"))}
        </button>
      </div>
      <div class="g-section">
        <h3 ${h3}>${esc(this.t("myDesigns"))}</h3>
        ${designs.length ? `<div class="g-grid">
          ${designs.map((d) => `
            <div class="g-card" data-open="${esc(d.id)}">
              ${d.thumbnail
                ? `<img class="g-thumb ${d.orientation === "landscape" ? "land" : ""}" src="${esc(d.thumbnail)}" alt="">`
                : `<div class="g-starter-emoji">🏷️</div>`}
              <div class="g-name">${esc(d.name)}</div>
              <div class="g-meta">${esc(fmtDate(d.updated))}${d.updated_by ? " · " + esc(this.t("savedBy", d.updated_by)) : ""}</div>
              <button class="g-del" data-del="${esc(d.id)}" data-del-name="${esc(d.name)}"
                title="${esc(this.t("deleteDesign"))}"><ha-icon icon="mdi:trash-can-outline"></ha-icon></button>
            </div>`).join("")}
        </div>` : `<div class="tip" style="margin-top:10px">${esc(this.t("emptyDesigns"))}</div>`}
      </div>
      <div class="g-section">
        <h3 ${h3}>${esc(this.t("starters"))}</h3>
        <div class="g-grid">
          ${starters.map((s) => `
            <div class="g-card" data-starter="${s.id}">
              <div class="g-starter-emoji">${s.emoji}</div>
              <div class="g-name">${esc(this.t(s.key))}</div>
            </div>`).join("")}
        </div>
      </div>`;

    body.onclick = async (e) => {
      const del = e.target.closest("[data-del]");
      if (del) {
        e.stopPropagation();
        if (!confirm(this.t("confirmDelete", del.dataset.delName))) return;
        try {
          await this._ws("delete_design", { design_id: del.dataset.del });
          if (this._designId === del.dataset.del) { this._designId = null; this._markDirty(); }
        } catch (err) { this._toast(this.t("deleteFailedToast"), false); }
        return;
      }
      const nw = e.target.closest("[data-new]");
      if (nw) { this._newBlank(nw.dataset.new); ov.remove(); return; }
      const st = e.target.closest("[data-starter]");
      if (st) { this._applyStarter(st.dataset.starter); ov.remove(); return; }
      const op = e.target.closest("[data-open]");
      if (op) { ov.remove(); this._loadDesign(op.dataset.open); }
    };
  }

  /* ------------------------------------------------------ new/load/save */
  _newBlank(orientation, opts = {}) {
    const c = this._canvas;
    this._restoring = true;
    c.discardActiveObject();
    c.clear();
    c.setBackgroundColor("#ffffff", () => {});
    this._restoring = false;
    this._orientation = orientation === "landscape" ? "landscape" : "portrait";
    this._userZoom = false;
    this._designId = null;
    this._designName = "";
    const nameEl = this.$("name");
    if (nameEl) nameEl.value = "";
    this._fitZoom();
    c.requestRenderAll();
    if (!opts.keepHistory) this._resetHistory();
    this._renderProps();
    if (this._bwOn) this._updateBwDebounced();
  }

  async _loadDesign(designId) {
    try {
      const design = await this._ws("load_design", { design_id: designId });
      this._restoring = true;
      this._orientation = design.orientation === "landscape" ? "landscape" : "portrait";
      this._userZoom = false;
      const json = typeof design.json === "string" ? JSON.parse(design.json) : design.json;
      await new Promise((res) => this._canvas.loadFromJSON(json, res));
      this._restoring = false;
      this._designId = design.id;
      this._designName = design.name || "";
      this.$("name").value = this._designName;
      this._fitZoom();
      this._canvas.renderAll();
      this._resetHistory();
      this._renderProps();
      if (this._bwOn) this._updateBwDebounced();
    } catch (err) {
      this._restoring = false;
      this._toast(this.t("loadFailedToast"), false);
    }
  }

  _defaultName() {
    const lang = this._lang();
    const d = new Date().toLocaleDateString(lang === "nl" ? "nl-NL" : "en-GB",
      { day: "numeric", month: "short" });
    return `Label ${d}`;
  }

  _thumbnail() {
    const { w } = this._labelSize();
    try {
      return this._canvas.toDataURL({
        format: "jpeg", quality: 0.72,
        multiplier: 240 / (w * this._zoom),
      });
    } catch (e) { return undefined; }
  }

  async _save() {
    if (!this._ready) return;
    const name = (this._designName || "").trim() || this._defaultName();
    this._canvas.discardActiveObject();
    this._canvas.renderAll();
    const payload = {
      name,
      orientation: this._orientation,
      json: JSON.stringify(this._canvas.toJSON(EXTRA_PROPS)),
    };
    const thumb = this._thumbnail();
    if (thumb) payload.thumbnail = thumb;
    if (this._designId) payload.design_id = this._designId;
    try {
      const res = await this._ws("save_design", payload);
      this._designId = res.id;
      if (!(this._designName || "").trim()) {
        this._designName = name;
        this.$("name").value = name;
      }
      this._setDirty(false);
      this._toast(this.t("savedToast"), true);
    } catch (err) {
      this._toast(`${this.t("saveFailedToast")}${err && err.message ? ": " + err.message : ""}`, false);
    }
  }

  /* ------------------------------------------------------------ starters */
  _applyStarter(id) {
    const f = window.fabric;
    const nl = this._lang() === "nl";
    const orientation = id === "toy" ? "landscape" : "portrait";
    this._newBlank(orientation, { keepHistory: true });
    const { w, h } = this._labelSize();
    const c = this._canvas;
    this._restoring = true;

    const text = (str, opts) => new f.Textbox(str, {
      left: w / 2, originX: "center", originY: "center", width: w * 0.8,
      textAlign: "center", fill: "#000000", ...opts,
    });

    if (id === "name") {
      this._applyFrameSilent("rounded");
      c.add(new f.Polygon(starPoints(5, 95, 38), {
        left: w / 2, top: h * 0.2, originX: "center", originY: "center", fill: "#000000",
      }));
      c.add(text(nl ? "NAAM" : "NAME", {
        top: h * 0.5, fontSize: 150, fontFamily: "Baloo 2", fontWeight: 800,
      }));
      c.add(text(nl ? "die is van mij!" : "this one's mine!", {
        top: h * 0.72, fontSize: 72, fontFamily: "Caveat", fontWeight: 700,
      }));
    } else if (id === "jar") {
      this._applyFrameSilent("scallop");
      c.add(text(nl ? "Aardbeienjam" : "Strawberry jam", {
        top: h * 0.32, fontSize: 110, fontFamily: "Playfair Display", fontWeight: 700,
      }));
      c.add(new f.Path(HEART_PATH, {
        left: w / 2, top: h * 0.52, originX: "center", originY: "center", fill: "#000000",
        scaleX: 1.4, scaleY: 1.4,
      }));
      c.add(text(nl ? "zelfgemaakt · juli 2026" : "homemade · july 2026", {
        top: h * 0.68, fontSize: 62, fontFamily: "Special Elite", fontWeight: 400,
      }));
    } else if (id === "toy") {
      this._applyFrameSilent("thick");
      c.add(new f.Text("🧸", {
        left: w * 0.24, top: h / 2, originX: "center", originY: "center",
        fontSize: 300, fontFamily: "sans-serif", laType: "sticker",
      }));
      c.add(text(nl ? "SPEELGOED" : "TOYS", {
        left: w * 0.64, top: h / 2, width: w * 0.52,
        fontSize: 140, fontFamily: "Baloo 2", fontWeight: 800,
      }));
    } else if (id === "gift") {
      c.add(text(nl ? "Voor jou!" : "For you!", {
        top: h * 0.26, fontSize: 160, fontFamily: "Caveat", fontWeight: 700,
      }));
      c.add(new f.Path(HEART_PATH, {
        left: w / 2, top: h * 0.52, originX: "center", originY: "center",
        fill: "#000000", scaleX: 2.4, scaleY: 2.4,
      }));
      c.add(text(nl ? "van:" : "from:", {
        top: h * 0.78, fontSize: 90, fontFamily: "Caveat", fontWeight: 700,
      }));
    }

    this._restoring = false;
    this._designName = this.t({
      name: "starterName", jar: "starterJar", toy: "starterToy", gift: "starterGift",
    }[id]);
    this.$("name").value = this._designName;
    c.requestRenderAll();
    this._resetHistory();
    this._renderProps();
  }

  _applyFrameSilent(styleId) {
    // Same as _applyFrame but without closing popovers (used by starters).
    const saved = this._popover;
    this._applyFrame(styleId);
    this._popover = saved;
  }

  /* --------------------------------------------------------- B/W preview */
  _toggleBw() {
    this._bwOn = !this._bwOn;
    this.$("btn-bw").classList.toggle("active", this._bwOn);
    const railBw = this.$("rail-bw");
    if (railBw) railBw.classList.toggle("active", this._bwOn);
    this.$("bw-overlay").classList.toggle("on", this._bwOn);
    if (this._bwOn) this._updateBw();
  }

  async _updateBw() {
    if (!this._bwOn || !this._canvas) return;
    try {
      const { dataUrl } = await this._renderDithered(false);
      this.$("bw-img").src = dataUrl;
    } catch (e) { /* preview is best-effort */ }
  }

  /* ------------------------------------------------------ export & print */
  async _renderDithered(rotateToPortrait) {
    const c = this._canvas;
    const { w, h } = this._labelSize();
    const src = c.toDataURL({ format: "png", multiplier: 1 / this._zoom });
    const img = await loadImg(src);
    let off = document.createElement("canvas");
    off.width = w; off.height = h;
    let ctx = off.getContext("2d", { willReadFrequently: true });
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h);
    ditherFS(id);
    ctx.putImageData(id, 0, 0);
    if (rotateToPortrait && this._orientation === "landscape") {
      const rot = document.createElement("canvas");
      rot.width = h; rot.height = w;
      const rctx = rot.getContext("2d");
      rctx.translate(h, 0);
      rctx.rotate(Math.PI / 2);
      rctx.drawImage(off, 0, 0);
      off = rot;
    }
    const dataUrl = off.toDataURL("image/png");
    return { dataUrl, b64: dataUrl.split(",")[1] };
  }

  async _openPrintModal() {
    if (!this._ready) return;
    this._closePopover();
    this._canvas.discardActiveObject();
    this._canvas.renderAll();
    let rendered;
    try {
      rendered = await this._renderDithered(true);
      // Preview in design orientation (what the kid drew), print data rotated.
      var preview = (await this._renderDithered(false)).dataUrl;
    } catch (err) {
      this._toast(`${this.t("printFailedToast")}: ${err.message || err}`, false);
      return;
    }
    const land = this._orientation === "landscape";
    const ov = this._modal(`
      <div class="modal">
        <div class="modal-head">
          <h2><ha-icon icon="mdi:printer"></ha-icon>${esc(this.t("printTitle"))}</h2>
          <p class="sub">${esc(this.t("printSub"))}</p>
          <button class="icon-btn x" data-close><ha-icon icon="mdi:close"></ha-icon></button>
        </div>
        <div class="print-flex">
          <div class="print-preview" style="width:${land ? 280 : 180}px">
            <img src="${preview}" alt="">
          </div>
          <div class="print-side">
            <span class="chip wait" id="pr-chip">
              <ha-icon icon="mdi:timer-sand"></ha-icon><span>…</span>
            </span>
            <div>
              <label style="font-size:13px;font-weight:700;color:var(--la-muted)">${esc(this.t("copies"))}</label>
              <div class="copies-row">
                <button class="icon-btn" id="pr-minus"><ha-icon icon="mdi:minus"></ha-icon></button>
                <span class="cnt" id="pr-count">1</span>
                <button class="icon-btn" id="pr-plus"><ha-icon icon="mdi:plus"></ha-icon></button>
              </div>
            </div>
            <button class="btn-big-print" id="pr-go">
              <ha-icon icon="mdi:printer"></ha-icon>${esc(this.t("printBtn"))}
            </button>
          </div>
        </div>
      </div>`);

    let copies = 1;
    const countEl = ov.querySelector("#pr-count");
    ov.querySelector("#pr-minus").addEventListener("click", () => {
      copies = Math.max(1, copies - 1); countEl.textContent = copies;
    });
    ov.querySelector("#pr-plus").addEventListener("click", () => {
      copies = Math.min(10, copies + 1); countEl.textContent = copies;
    });

    const chip = ov.querySelector("#pr-chip");
    this._ws("printer_status").then((st) => {
      if (!chip.isConnected) return;
      if (st.reachable && st.connected) {
        chip.className = "chip ok";
        chip.innerHTML = `<ha-icon icon="mdi:check-circle"></ha-icon><span>${esc(this.t("printerReady"))}</span>`;
      } else if (st.reachable) {
        chip.className = "chip bad";
        chip.innerHTML = `<ha-icon icon="mdi:printer-off"></ha-icon><span>${esc(this.t("printerNotConnected"))}</span>`;
      } else {
        chip.className = "chip bad";
        chip.innerHTML = `<ha-icon icon="mdi:lan-disconnect"></ha-icon><span>${esc(this.t("printerUnreachable"))}</span>`;
      }
    }).catch(() => {});

    const go = ov.querySelector("#pr-go");
    go.addEventListener("click", async () => {
      go.disabled = true;
      go.innerHTML = `<ha-icon icon="mdi:timer-sand"></ha-icon>${esc(this.t("printing"))}`;
      try {
        const res = await this._ws("print", { png_base64: rendered.b64, copies });
        if (res.printed) {
          ov.remove();
          this._confetti();
          this._toast(this.t("printedToast"), true);
        } else {
          go.disabled = false;
          go.innerHTML = `<ha-icon icon="mdi:printer"></ha-icon>${esc(this.t("printBtn"))}`;
          this._toast(this._printReason(res), false);
        }
      } catch (err) {
        go.disabled = false;
        go.innerHTML = `<ha-icon icon="mdi:printer"></ha-icon>${esc(this.t("printBtn"))}`;
        this._toast(`${this.t("printFailedToast")}${err && err.message ? ": " + err.message : ""}`, false);
      }
    });
  }

  _printReason(res) {
    if (res.reason === "printer_unreachable") return this.t("reasonPrinterUnreachable");
    if (res.reason === "printer_not_connected") return this.t("reasonNotConnected");
    return `${this.t("printFailedToast")}: ${res.reason || "?"}${res.detail ? ` (${res.detail})` : ""}`;
  }

  _confetti() {
    const colors = ["#ff6b81", "#feca57", "#48dbfb", "#1dd1a1", "#a29bfe", "#ff9f43"];
    for (let i = 0; i < 90; i++) {
      const p = document.createElement("div");
      p.className = "confetti";
      const size = 6 + Math.random() * 8;
      p.style.left = `${Math.random() * 100}vw`;
      p.style.width = `${size}px`;
      p.style.height = `${size * (Math.random() > 0.5 ? 1 : 0.4)}px`;
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = `${1.7 + Math.random() * 1.6}s`;
      p.style.animationDelay = `${Math.random() * 0.5}s`;
      this.shadowRoot.appendChild(p);
      setTimeout(() => p.remove(), 4000);
    }
  }

  /* ------------------------------------------------------------ keyboard */
  _onKey(e) {
    if (!this._ready || !this.isConnected) return;
    const target = e.composedPath()[0];
    const tag = target && target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || (target && target.isContentEditable)) return;
    const active = this._canvas.getActiveObject();
    if (active && active.isEditing) return;
    const mod = e.ctrlKey || e.metaKey;
    const key = (e.key || "").toLowerCase();

    if (mod && key === "z" && !e.shiftKey) { e.preventDefault(); this._undo(); return; }
    if (mod && (key === "y" || (key === "z" && e.shiftKey))) { e.preventDefault(); this._redo(); return; }
    if (mod && key === "d") { e.preventDefault(); this._duplicateSelection(); return; }
    if (mod && key === "s") { e.preventDefault(); this._save(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && this._activeObjects().length) {
      e.preventDefault(); this._deleteSelection(); return;
    }
    if (e.key === "Escape") {
      this._closePopover();
      this._canvas.discardActiveObject();
      this._canvas.requestRenderAll();
      return;
    }
    if (e.key.startsWith("Arrow") && this._activeObjects().length) {
      e.preventDefault();
      const step = e.shiftKey ? 12 : 3;
      const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
      this._activeObjects().forEach((o) => {
        o.set({ left: o.left + dx, top: o.top + dy });
        o.setCoords();
      });
      this._canvas.requestRenderAll();
    }
  }
}

/* ------------------------------------------------- module-level helpers */
const HEART_PATH =
  "M 0 -22 C -16 -50 -60 -44 -60 -10 C -60 18 -28 40 0 62 " +
  "C 28 40 60 18 60 -10 C 60 -44 16 -50 0 -22 Z";

function starPoints(spikes, outer, inner) {
  const pts = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    pts.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
  }
  return pts;
}

// A wavy rectangle path (bumps point inward so it stays on the label).
function wavyPath(w, h, inset, seg, amp) {
  const wave = (x0, y0, x1, y1) => {
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    const n = Math.max(3, Math.round(len / seg));
    const ux = dx / n, uy = dy / n;
    const px = (-dy / len) * amp, py = (dx / len) * amp;
    let s = "", cx = x0, cy = y0;
    for (let i = 0; i < n; i++) {
      const nx = cx + ux, ny = cy + uy;
      s += `Q ${(cx + ux / 2 + px).toFixed(1)} ${(cy + uy / 2 + py).toFixed(1)} ` +
           `${nx.toFixed(1)} ${ny.toFixed(1)} `;
      cx = nx; cy = ny;
    }
    return s;
  };
  return `M ${inset} ${inset} ` +
    wave(inset, inset, w - inset, inset) +
    wave(w - inset, inset, w - inset, h - inset) +
    wave(w - inset, h - inset, inset, h - inset) +
    wave(inset, h - inset, inset, inset) + "Z";
}

function loadImg(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

// Floyd–Steinberg dither to pure black/white — the DYMO is a thermal
// printer, so this preview/print pipeline is exactly what comes out.
function ditherFS(imageData) {
  const { data, width, height } = imageData;
  const lum = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3] / 255;
    // Composite on white, then Rec. 601 luma.
    const r = data[i] * a + 255 * (1 - a);
    const g = data[i + 1] * a + 255 * (1 - a);
    const b = data[i + 2] * a + 255 * (1 - a);
    lum[p] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      const old = lum[p];
      const val = old < 128 ? 0 : 255;
      const err = old - val;
      lum[p] = val;
      if (x + 1 < width) lum[p + 1] += (err * 7) / 16;
      if (y + 1 < height) {
        if (x > 0) lum[p + width - 1] += (err * 3) / 16;
        lum[p + width] += (err * 5) / 16;
        if (x + 1 < width) lum[p + width + 1] += (err * 1) / 16;
      }
    }
  }
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const v = lum[p];
    data[i] = data[i + 1] = data[i + 2] = v;
    data[i + 3] = 255;
  }
}

async function downscaleImage(file, maxSide) {
  const dataUrl = await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const img = await loadImg(dataUrl);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  if (scale >= 1) return dataUrl;
  const cv = document.createElement("canvas");
  cv.width = Math.round(img.width * scale);
  cv.height = Math.round(img.height * scale);
  cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
  return file.type === "image/png"
    ? cv.toDataURL("image/png")
    : cv.toDataURL("image/jpeg", 0.85);
}

customElements.define("label-assistant-panel", LabelAssistantPanel);
