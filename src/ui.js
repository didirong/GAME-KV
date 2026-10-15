// Overlay order matches styles.css. Only the top dialog receives keyboard focus.
const DIALOG_IDS = ['load', 'endv', 'ov', 'bk', 'mg'];
let activeDialog = null;
let returnFocus = null;
function topDialog() {
  return (
    DIALOG_IDS.map((id) => document.getElementById(id)).find(
      (element) => getComputedStyle(element).display !== 'none',
    ) ?? null
  );
}
function focusable(dialog) {
  return [...dialog.querySelectorAll('button, [tabindex="0"]')].filter(
    (element) =>
      !element.disabled &&
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden',
  );
}
export function isModalOpen() {
  return Boolean(topDialog());
}
export function closeTopModal() {
  const dialog = topDialog();
  const closeId = { ov: 'cx', bk: 'bkx', mg: 'mgq', endv: 'endx' }[dialog?.id];
  if (!closeId) return;
  const button = document.getElementById(closeId);
  if (button.getClientRects().length) button.click();
}
export function setupDialogs() {
  const stage = document.getElementById('w');
  function sync() {
    const next = topDialog();
    for (const child of stage.children) {
      // The leave button remains available outside the mini-game introduction dialog.
      const inert = Boolean(next && child !== next && !(next.id === 'mg' && child.id === 'mgq'));
      if (child.inert !== inert) child.inert = inert;
    }
    if (next !== activeDialog) {
      if (!activeDialog) returnFocus = document.activeElement;
      activeDialog = next;
      if (next) {
        next.tabIndex = -1;
        (focusable(next)[0] ?? next).focus({ preventScroll: true });
      } else {
        (returnFocus?.isConnected ? returnFocus : document.getElementById('c')).focus({
          preventScroll: true,
        });
      }
    } else if (next && document.activeElement === next && focusable(next).length) {
      focusable(next)[0].focus({ preventScroll: true });
    }
  }
  const observer = new MutationObserver(sync);
  for (const id of [...DIALOG_IDS, 'lgo', 'endx']) {
    observer.observe(document.getElementById(id), { attributes: true, attributeFilter: ['style'] });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab' || !activeDialog) return;
    const buttons = focusable(activeDialog);
    if (activeDialog.id === 'mg') buttons.push(document.getElementById('mgq'));
    if (!buttons.length) {
      event.preventDefault();
      return;
    }
    const current = buttons.indexOf(document.activeElement);
    if (event.shiftKey && current <= 0) {
      event.preventDefault();
      buttons.at(-1).focus();
    } else if (!event.shiftKey && (current === buttons.length - 1 || current === -1)) {
      event.preventDefault();
      buttons[0].focus();
    }
  });
  sync();
}
