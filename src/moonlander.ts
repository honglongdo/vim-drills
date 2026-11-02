// ZSA Moonlander layout, built from the Oryx source export (keymap.c).
// To update it, paste the arguments of each LAYOUT_moonlander(...) call
// from a fresh export into LAYERS below.

export type MoonKey = {
  // KeyboardEvent.code the key sends; used for Vim hints and highlighting.
  code?: string
  label: string
  // Character the key types with Shift held.
  shift?: string
  // The key sends Shift+code by itself, e.g. ( is Shift+9.
  shifted?: boolean
  // Short text under the label and hover text, for layer keys.
  note?: string
  title?: string
  // KC_TRANSPARENT: the key falls through to the base layer.
  transparent?: boolean
}

export type PlacedKey = MoonKey & {
  half: 'left' | 'right'
  row: number
  col: number
  span: number
}

const LAYER_NAMES = ['Base', 'Symbols', 'Layer 2']
// Shorter names that fit on a keycap.
const LAYER_LABELS = ['Base', 'Sym', 'L2']

const LAYERS: string[] = [
  `
    KC_ESCAPE,      KC_1,           KC_2,           KC_3,           KC_4,           KC_5,           KC_INSERT,                                      KC_DELETE,      KC_6,           KC_7,           KC_8,           KC_9,           KC_0,           KC_PSCR,
    KC_TAB,         KC_Q,           KC_W,           KC_E,           KC_R,           KC_T,           KC_LEFT,                                        KC_UP,          KC_Y,           KC_U,           KC_I,           KC_O,           KC_P,           KC_TRANSPARENT,
    KC_ESCAPE,      KC_A,           KC_S,           KC_D,           KC_F,           KC_G,           KC_RIGHT,                                                                       KC_DOWN,        KC_H,           KC_J,           KC_K,           KC_L,           KC_SCLN,        KC_BSPC,
    KC_LEFT_SHIFT,  KC_Z,           KC_X,           KC_C,           KC_V,           KC_B,                                           KC_N,           KC_M,           KC_COMMA,       KC_DOT,         KC_SLASH,       KC_RIGHT_SHIFT,
    KC_LEFT_CTRL,   KC_TRANSPARENT, KC_RIGHT_ALT,   KC_LEFT_GUI,    KC_LEFT_ALT,    OSL(1),                                                                                                         OSL(1),         KC_LEFT_CTRL,   KC_LEFT,        KC_DOWN,        KC_UP,          KC_RIGHT,
    KC_SPACE,       KC_ENTER,       MO(1),                          MO(1),          KC_ENTER,       KC_SPACE
  `,
  `
    KC_TRANSPARENT, KC_F1,          KC_F2,          KC_F3,          KC_F4,          KC_F5,          KC_F6,                                          KC_F7,          KC_F8,          KC_F9,          KC_F10,         KC_F11,         KC_F12,         KC_TRANSPARENT,
    KC_TRANSPARENT, KC_EXLM,        KC_AT,          KC_HASH,        KC_DLR,         KC_PERC,        KC_TRANSPARENT,                                 KC_TRANSPARENT, KC_CIRC,        KC_AMPR,        KC_ASTR,        KC_BSLS,        KC_PIPE,        TG(2),
    KC_TRANSPARENT, KC_TILD,        KC_LPRN,        KC_LBRC,        KC_LCBR,        KC_TRANSPARENT, KC_TRANSPARENT,                                                                 KC_TRANSPARENT, KC_QUOTE,       KC_DQUO,        KC_COLN,        KC_MINUS,       KC_PLUS,        KC_TRANSPARENT,
    KC_TRANSPARENT, KC_GRAVE,       KC_RPRN,        KC_RBRC,        KC_RCBR,        KC_TRANSPARENT,                                 KC_QUES,        KC_LABK,        KC_RABK,        KC_UNDS,        KC_EQUAL,       KC_TRANSPARENT,
    KC_TRANSPARENT, KC_TRANSPARENT, KC_TRANSPARENT, KC_TRANSPARENT, KC_TRANSPARENT, KC_TRANSPARENT,                                                                                                 KC_TRANSPARENT, KC_TRANSPARENT, KC_TRANSPARENT, KC_TRANSPARENT, KC_TRANSPARENT, KC_TRANSPARENT,
    KC_TRANSPARENT, KC_TRANSPARENT, KC_TRANSPARENT,                 KC_TRANSPARENT, KC_TRANSPARENT, KC_TRANSPARENT
  `,
]

const QMK: Record<string, MoonKey> = {
  KC_ESCAPE: { code: 'Escape', label: 'Esc' },
  KC_TAB: { code: 'Tab', label: 'Tab' },
  KC_BSPC: { code: 'Backspace', label: 'Bksp' },
  KC_ENTER: { code: 'Enter', label: 'Enter' },
  KC_SPACE: { code: 'Space', label: 'Space' },
  KC_DELETE: { code: 'Delete', label: 'Del' },
  KC_INSERT: { code: 'Insert', label: 'Ins' },
  KC_PSCR: { code: 'PrintScreen', label: 'PrtSc' },
  KC_LEFT: { code: 'ArrowLeft', label: '←' },
  KC_UP: { code: 'ArrowUp', label: '↑' },
  KC_DOWN: { code: 'ArrowDown', label: '↓' },
  KC_RIGHT: { code: 'ArrowRight', label: '→' },
  KC_LEFT_SHIFT: { code: 'ShiftLeft', label: 'Shift' },
  KC_RIGHT_SHIFT: { code: 'ShiftRight', label: 'Shift' },
  KC_LEFT_CTRL: { code: 'ControlLeft', label: 'Ctrl' },
  KC_LEFT_ALT: { code: 'AltLeft', label: 'Alt' },
  KC_RIGHT_ALT: { code: 'AltRight', label: 'AltGr' },
  KC_LEFT_GUI: { code: 'MetaLeft', label: 'Win' },
}

for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
  QMK[`KC_${c}`] = { code: `Key${c}`, label: c }
}
for (let n = 1; n <= 12; n++) {
  QMK[`KC_F${n}`] = { code: `F${n}`, label: `F${n}` }
}

// [plain keycode, shifted keycode, event code, plain char, shifted char]
const SYMBOLS: [string, string, string, string, string][] = [
  ['KC_1', 'KC_EXLM', 'Digit1', '1', '!'],
  ['KC_2', 'KC_AT', 'Digit2', '2', '@'],
  ['KC_3', 'KC_HASH', 'Digit3', '3', '#'],
  ['KC_4', 'KC_DLR', 'Digit4', '4', '$'],
  ['KC_5', 'KC_PERC', 'Digit5', '5', '%'],
  ['KC_6', 'KC_CIRC', 'Digit6', '6', '^'],
  ['KC_7', 'KC_AMPR', 'Digit7', '7', '&'],
  ['KC_8', 'KC_ASTR', 'Digit8', '8', '*'],
  ['KC_9', 'KC_LPRN', 'Digit9', '9', '('],
  ['KC_0', 'KC_RPRN', 'Digit0', '0', ')'],
  ['KC_GRAVE', 'KC_TILD', 'Backquote', '`', '~'],
  ['KC_MINUS', 'KC_UNDS', 'Minus', '-', '_'],
  ['KC_EQUAL', 'KC_PLUS', 'Equal', '=', '+'],
  ['KC_LBRC', 'KC_LCBR', 'BracketLeft', '[', '{'],
  ['KC_RBRC', 'KC_RCBR', 'BracketRight', ']', '}'],
  ['KC_BSLS', 'KC_PIPE', 'Backslash', '\\', '|'],
  ['KC_SCLN', 'KC_COLN', 'Semicolon', ';', ':'],
  ['KC_QUOTE', 'KC_DQUO', 'Quote', "'", '"'],
  ['KC_COMMA', 'KC_LABK', 'Comma', ',', '<'],
  ['KC_DOT', 'KC_RABK', 'Period', '.', '>'],
  ['KC_SLASH', 'KC_QUES', 'Slash', '/', '?'],
]
for (const [plain, shifted, code, char, shiftChar] of SYMBOLS) {
  QMK[plain] = { code, label: char, shift: shiftChar }
  QMK[shifted] = { code, label: shiftChar, shifted: true }
}

const LAYER_KEYS: Record<string, { note: string; verb: string }> = {
  MO: { note: 'hold', verb: 'Hold to use the' },
  OSL: { note: 'one-shot', verb: 'Tap, then the next key comes from the' },
  TG: { note: 'toggle', verb: 'Tap to turn on or off the' },
}

function parseKey(keycode: string): MoonKey {
  if (keycode === 'KC_TRANSPARENT') return { label: '', transparent: true }
  const layer = keycode.match(/^(\w+)\((\d+)\)$/)
  if (layer && LAYER_KEYS[layer[1]]) {
    const { note, verb } = LAYER_KEYS[layer[1]]
    const n = Number(layer[2])
    const name = LAYER_NAMES[n] ?? `Layer ${n}`
    return { label: LAYER_LABELS[n] ?? `L${n}`, note, title: `${verb} ${name} layer (${keycode}).` }
  }
  return QMK[keycode] ?? { label: keycode.replace(/^KC_/, '') }
}

// [row, column, column span] of each key in LAYOUT_moonlander argument order.
// Rows 0-4 are the main grid; row 4 ends (left) or starts (right) with the
// big red thumb key, and row 5 is the three-key thumb cluster.
const POSITIONS: (Omit<PlacedKey, keyof MoonKey>)[] = []
const place = (half: 'left' | 'right', row: number, cols: number[], span = 1) => {
  for (const col of cols) POSITIONS.push({ half, row, col, span })
}
for (let row = 0; row < 3; row++) {
  place('left', row, [1, 2, 3, 4, 5, 6, 7])
  place('right', row, [1, 2, 3, 4, 5, 6, 7])
}
place('left', 3, [1, 2, 3, 4, 5, 6])
place('right', 3, [2, 3, 4, 5, 6, 7])
place('left', 4, [1, 2, 3, 4, 5])
place('left', 4, [6], 2)
place('right', 4, [1], 2)
place('right', 4, [3, 4, 5, 6, 7])
place('left', 5, [5, 6, 7])
place('right', 5, [1, 2, 3])

function parseLayer(source: string): MoonKey[] {
  const keycodes = source.split(',').map((s) => s.trim()).filter(Boolean)
  if (keycodes.length !== POSITIONS.length) {
    throw new Error(`Moonlander layer has ${keycodes.length} keys, expected ${POSITIONS.length}`)
  }
  return keycodes.map(parseKey)
}

const base = parseLayer(LAYERS[0])

export const MOONLANDER_LAYERS: { name: string; keys: PlacedKey[] }[] = LAYERS.map(
  (source, layer) => ({
    name: LAYER_NAMES[layer],
    keys: parseLayer(source).map((key, i) => ({
      ...(key.transparent && layer > 0 ? { ...base[i], transparent: true } : key),
      ...POSITIONS[i],
    })),
  }),
)
