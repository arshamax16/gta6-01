// Solmar Bay — keyboard + mouse input. Tracks held keys, edge-triggered
// presses (so E / P / F fire once per tap), and the mouse position in
// canvas pixels plus world coordinates (filled in by the camera each frame).

export const ACTION_CONFIRM = 'confirm'; // Enter / Space / click
export const ACTION_PAUSE = 'pause';     // P or Escape
export const ACTION_INTERACT = 'interact'; // E
export const ACTION_ATTACK = 'attack';   // F (melee) — mouse click shoots
export const ACTION_MUTE = 'mute';       // M
export const ACTION_SPRINT = 'sprint';   // Shift

const KEY_BINDINGS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyE: 'interact',
  KeyF: 'attack',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute',
  Enter: 'confirm', Space: 'confirm',
  KeyH: 'help',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set(); // edge-triggered: consumed by takePressed()
  const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, clicked: false };

  function onKeyDown(e) {
    const action = KEY_BINDINGS[e.code];
    if (action) {
      if (!e.repeat) pressed.add(action);
      held.add(action);
      e.preventDefault();
    }
  }
  function onKeyUp(e) {
    const action = KEY_BINDINGS[e.code];
    if (action) held.delete(action);
  }
  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  }
  function onMouseDown(e) {
    if (e.button === 0) { mouse.down = true; mouse.clicked = true; }
  }
  function onMouseUp(e) {
    if (e.button === 0) mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  // A key released while the tab is hidden never sends keyup.
  window.addEventListener('blur', () => held.clear());

  return {
    held,
    mouse,
    isHeld(action) { return held.has(action); },
    // True once after the key went down; clears on read.
    takePressed(action) {
      if (pressed.has(action)) { pressed.delete(action); return true; }
      return false;
    },
    takeClick() {
      if (mouse.clicked) { mouse.clicked = false; return true; }
      return false;
    },
    // Movement vector from held keys, normalised.
    moveVector() {
      let x = 0, y = 0;
      if (held.has('left')) x -= 1;
      if (held.has('right')) x += 1;
      if (held.has('up')) y -= 1;
      if (held.has('down')) y += 1;
      if (x !== 0 && y !== 0) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
      return { x, y };
    },
    endFrame() { pressed.clear(); mouse.clicked = false; },
  };
}
