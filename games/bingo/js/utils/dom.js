// DOM 小工具：建立元素、提示訊息、確認彈窗

/** 開始下一局前向大廳確認（未登入時大廳會詢問同意條款）；回傳 false 就不開始 */
export const nextOk = async () => { try { return window.MiniHub ? await MiniHub.requestNext() : true; } catch { return true; } };

/** 大廳「鍵盤操作」設定（單獨開啟時預設開啟） */
export const kbdOn = () => { try { return window.MiniHub ? MiniHub.kbdOn() : true; } catch { return true; } };

/** el('div', {class:'x', onClick: fn}, '文字', childNode) */
export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (/^on[A-Z]/.test(key)) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  appendAll(node, children);
  return node;
}

function appendAll(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** 畫面下方短暫提示。type: 'info' | 'error' */
export function toast(message, type = 'info') {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = el('div', { id: 'toast-root', 'aria-live': 'polite' });
    document.body.append(root);
  }
  const item = el('div', { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' }, message);
  root.append(item);
  setTimeout(() => item.remove(), 2800);
}

/** 彈窗關閉：先播淡出動畫再移除 */
function dismiss(overlay) {
  overlay.classList.add('is-closing');
  setTimeout(() => overlay.remove(), 180);
}

/** 確認彈窗，回傳 Promise<boolean> */
export function confirmDialog({ title, message, confirmText = '確定', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    const close = (result) => {
      document.removeEventListener('keydown', onKey);
      dismiss(overlay);
      if (previous && previous.focus) previous.focus();
      resolve(result);
    };
    const onKey = (e) => {
      if (e.key === 'Escape' && kbdOn()) close(false);
    };
    const cancelBtn = el('button', { type: 'button', class: 'btn btn-secondary', onClick: () => close(false) }, cancelText);
    const okBtn = el('button', { type: 'button', class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, onClick: () => close(true) }, confirmText);
    const overlay = el(
      'div',
      { class: 'modal-overlay', onClick: (e) => e.target === overlay && close(false) },
      el(
        'div',
        { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        el('h3', { class: 'modal-title' }, title),
        el('p', { class: 'modal-message' }, message),
        el('div', { class: 'modal-actions' }, cancelBtn, okBtn)
      )
    );
    document.body.append(overlay);
    document.addEventListener('keydown', onKey);
    cancelBtn.focus();
  });
}

/**
 * 通用彈窗。actions: [{ text, kind:'primary'|'secondary'|'danger'|'danger-outline', onClick }]，
 * onClick 回傳 false 代表不關閉；沒有 onClick 則直接關閉。回傳 { close }。
 */
export function showModal({ title, content, actions = [], wide = false, onClose } = {}) {
  const previous = document.activeElement;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    dismiss(overlay);
    if (previous && previous.focus) previous.focus();
    if (onClose) onClose();
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && kbdOn()) close();
  };
  const buttons = actions.map((a) =>
    el('button', {
      type: 'button',
      class: `btn btn-${a.kind ?? 'secondary'}`,
      onClick: async () => {
        const keepOpen = a.onClick ? (await a.onClick()) === false : false;
        if (!keepOpen) close();
      },
    }, a.text)
  );
  const overlay = el('div', { class: 'modal-overlay', onClick: (e) => e.target === overlay && close() },
    el('div', { class: `modal${wide ? ' modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      el('h3', { class: 'modal-title' }, title),
      el('div', { class: 'modal-body' }, content),
      buttons.length ? el('div', { class: 'modal-actions' }, ...buttons) : null
    )
  );
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  const focusable = overlay.querySelector('input, .modal-actions .btn:last-child');
  if (focusable) focusable.focus();
  return { close };
}
