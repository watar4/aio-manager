/** 全ページ共通: テーマ切替・ストレージ・HTMLエスケープ */

/** 取得したページの文字列をそのまま画面に出すため、埋め込みは必ずこれを通す */
export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const THEME_KEY = 'aio.theme';

export function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
  const btn = document.querySelector('[data-theme-toggle]');
  if (!btn) return;
  const sync = () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    btn.setAttribute('aria-label', cur === 'dark' ? 'ライトテーマに切り替え' : 'ダークテーマに切り替え');
    btn.textContent = cur === 'dark' ? '☀' : '☾';
  };
  btn.addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem(THEME_KEY, next);
    sync();
  });
  sync();
}

export function markActiveNav() {
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach((a) => {
    const target = (a.getAttribute('href') || '').split('/').pop();
    if (target === here) a.setAttribute('aria-current', 'page');
  });
}

export const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  del(key) {
    localStorage.removeItem(key);
  },
};

export function toast(msg, tone = 'good') {
  let host = document.querySelector('.toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    document.body.append(host);
  }
  const t = document.createElement('div');
  t.className = `toast tone-${tone}`;
  t.textContent = msg;
  host.append(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 400);
  }, 2600);
}

export function boot() {
  initTheme();
  markActiveNav();
}
