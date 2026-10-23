/**
 * 取得層
 *
 * GitHub Pages は静的ホスティングなのでサーバー側で fetch できない。
 * そのため公開CORSプロキシを順に試し、すべて失敗した場合は
 * 「HTMLソースを貼り付ける」手動モードに退避させる。
 *
 * 重要: どの経路でも JavaScript は実行されない。
 * これは制約ではなく仕様であり、JSを実行できないAIクローラー(全体の69%)の
 * 視点を再現するために必要な条件である。
 *
 * 日本のサイトは Shift_JIS / EUC-JP のページが今も残っているため、
 * バイト列で受け取ってから文字コードを判定してデコードする。
 */

const PROXIES = [
  { id: 'corsproxy', label: 'corsproxy.io', build: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}` },
  { id: 'allorigins', label: 'AllOrigins', build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}` },
  { id: 'codetabs', label: 'CodeTabs', build: (u) => `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(u)}` },
  { id: 'isomorphic', label: 'isomorphic-git proxy', build: (u) => `https://cors.isomorphic-git.org/${u}` },
];

export const PROXY_LIST = PROXIES.map((p) => ({ id: p.id, label: p.label }));

/* ── 文字コード判定 ─────────────────────────── */
const CHARSET_ALIASES = {
  'shift-jis': 'shift_jis',
  shift_jis: 'shift_jis',
  sjis: 'shift_jis',
  'x-sjis': 'shift_jis',
  'ms932': 'shift_jis',
  'windows-31j': 'shift_jis',
  cp932: 'shift_jis',
  'euc-jp': 'euc-jp',
  eucjp: 'euc-jp',
  'x-euc-jp': 'euc-jp',
  'iso-2022-jp': 'iso-2022-jp',
  utf8: 'utf-8',
  'utf-8': 'utf-8',
};

function normalizeCharset(cs) {
  if (!cs) return null;
  const key = cs.trim().toLowerCase().replace(/["';]/g, '');
  return CHARSET_ALIASES[key] || key;
}

function decodeBytes(buf, charset) {
  try {
    return new TextDecoder(charset, { fatal: false }).decode(buf);
  } catch {
    return null;
  }
}

function brokenRatio(s) {
  if (!s) return 1;
  const bad = (s.match(/�/g) || []).length;
  return bad / Math.max(s.length, 1);
}

/** バイト列 → 文字列。meta charset を優先し、化けていれば日本語系エンコーディングを試す */
function bytesToText(buf, headerContentType) {
  const u8 = new Uint8Array(buf);
  if (u8[0] === 0xef && u8[1] === 0xbb && u8[2] === 0xbf) return { text: decodeBytes(buf, 'utf-8'), charset: 'utf-8 (BOM)' };

  const head = new TextDecoder('windows-1252').decode(u8.subarray(0, Math.min(u8.length, 8192)));
  const declared =
    normalizeCharset((head.match(/<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_-]+)/i) || [])[1]) ||
    normalizeCharset((head.match(/encoding\s*=\s*["']([a-z0-9_-]+)["']/i) || [])[1]) ||
    normalizeCharset((String(headerContentType || '').match(/charset=([a-z0-9_-]+)/i) || [])[1]);

  const candidates = [declared, 'utf-8', 'shift_jis', 'euc-jp'].filter(Boolean);
  let best = null;
  for (const cs of candidates) {
    const text = decodeBytes(buf, cs);
    if (text == null) continue;
    const ratio = brokenRatio(text);
    if (ratio < 0.0005) return { text, charset: cs };
    if (!best || ratio < best.ratio) best = { text, charset: cs, ratio };
  }
  return best ? { text: best.text, charset: `${best.charset}(一部デコード不能)` } : { text: new TextDecoder().decode(buf), charset: 'utf-8' };
}

function withTimeout(promise, ms, label, controller) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        if (controller) controller.abort();
        reject(new Error(`${label} がタイムアウトしました(${ms / 1000}秒)`));
      }, ms),
    ),
  ]);
}

async function tryFetch(url, { timeout = 20000, expect = 'html', stopOn404 = false } = {}) {
  const errors = [];
  for (const p of PROXIES) {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    try {
      const res = await withTimeout(fetch(p.build(url), { redirect: 'follow', signal: ctl ? ctl.signal : undefined }), timeout, p.label, ctl);
      if (!res.ok) {
        errors.push(`${p.label}: HTTP ${res.status}`);
        // 補助ファイルが 404 なら「存在しない」と確定できる。他の経路を試す必要はない
        if (stopOn404 && (res.status === 404 || res.status === 410)) break;
        continue;
      }
      const buf = await res.arrayBuffer();
      if (!buf || buf.byteLength < 30) {
        errors.push(`${p.label}: 空のレスポンス`);
        continue;
      }
      const { text, charset } = bytesToText(buf, res.headers.get('content-type'));
      if (expect === 'html' && !/<[a-z!]/i.test(text)) {
        errors.push(`${p.label}: HTMLではないレスポンス`);
        continue;
      }
      return { text, via: p.label, viaId: p.id, charset, bytes: buf.byteLength, errors };
    } catch (e) {
      errors.push(`${p.label}: ${e.name === 'AbortError' ? '中断(タイムアウト)' : e.message}`);
    }
  }
  const err = new Error('すべての取得経路が失敗しました');
  err.details = errors;
  throw err;
}

/** 補助ファイル(robots.txt など)。失敗しても null を返して続行する */
async function tryFetchOptional(url, timeout = 12000) {
  try {
    const r = await tryFetch(url, { timeout, expect: 'text', stopOn404: true });
    return r.text;
  } catch {
    return null;
  }
}

export function normalizeUrl(input) {
  let s = (input || '').trim();
  if (!s) throw new Error('URLを入力してください');
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let u;
  try {
    u = new URL(s);
  } catch {
    throw new Error('URLの形式が正しくありません');
  }
  if (!/^https?:$/.test(u.protocol)) throw new Error('http / https のURLを入力してください');
  if (u.username || u.password) throw new Error('認証情報を含むURLは外部の取得サービスへ送信できません');
  const host = u.hostname.toLowerCase();
  if (/^(?:0|10|127)\./.test(host) || /^169\.254\./.test(host) || /^192\.168\./.test(host) || /^172\.(?:1[6-9]|2\d|3[01])\./.test(host) || /(?:^|\.)(?:localhost|local)$/.test(host)) {
    throw new Error('公開サイトのURLを指定してください');
  }
  for (const key of u.searchParams.keys()) {
    const compact = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['apikey', 'accesstoken', 'idtoken', 'refreshtoken', 'authtoken', 'clientsecret'].includes(compact) || /(?:^|[_-])(?:token|secret|password|signature|credential|authorization|auth|key|sig)(?:$|[_-])/i.test(key) || /^x-(?:amz|goog)-/i.test(key)) {
      throw new Error('認証キー・署名を含むURLは外部の取得サービスへ送信できません');
    }
  }
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/i.test(u.hostname)) throw new Error('ローカルホストのURLは診断できません(公開URLを指定してください)');
  if (!u.hostname.includes('.')) throw new Error('ホスト名が正しくありません');
  // Fragments are browser-only state and may carry OAuth tokens. Never proxy them.
  u.hash = '';
  return u.toString();
}

/**
 * ページ本体 + robots.txt + sitemap.xml + llms.txt をまとめて取得
 * @param {string} rawUrl
 * @param {(msg:string, pct:number)=>void} onProgress
 */
export async function fetchTarget(rawUrl, onProgress = () => {}) {
  const url = normalizeUrl(rawUrl);
  const origin = new URL(url).origin;

  onProgress('ページのHTMLソースを取得しています(JavaScriptは実行しません)', 15);
  const main = await tryFetch(url, { timeout: 25000 });

  onProgress('robots.txt を取得しています', 45);
  const robotsTxt = await tryFetchOptional(`${origin}/robots.txt`);

  onProgress('sitemap.xml / llms.txt を確認しています', 65);
  const [sitemapXml, llmsTxt] = await Promise.all([tryFetchOptional(`${origin}/sitemap.xml`, 12000), tryFetchOptional(`${origin}/llms.txt`, 10000)]);

  onProgress('診断ルールを適用しています', 85);
  return { url, html: main.text, fetchedVia: `${main.via} / 文字コード ${main.charset}`, robotsTxt, sitemapXml, llmsTxt, fetchErrors: main.errors };
}

/**
 * 配下ページ用: HTMLだけを取得する。
 * robots.txt / sitemap.xml はサイト共通なので、起点ページで取得したものを使い回す。
 */
export async function fetchPageOnly(url, shared = {}) {
  const main = await tryFetch(url, { timeout: 22000 });
  return {
    url,
    html: main.text,
    fetchedVia: `${main.via} / 文字コード ${main.charset}`,
    robotsTxt: shared.robotsTxt ?? null,
    sitemapXml: shared.sitemapXml ?? null,
    llmsTxt: shared.llmsTxt ?? null,
    fetchErrors: main.errors,
  };
}

/** 補助ファイル(sitemap の子など)を単体で取得する */
export async function fetchTextOnly(url, timeout = 14000) {
  return tryFetchOptional(url, timeout);
}

/** 手動貼り付けモード。補助ファイルだけは取得を試みる */
export async function fromPastedHtml(rawUrl, html, onProgress = () => {}) {
  const url = normalizeUrl(rawUrl);
  const origin = new URL(url).origin;
  onProgress('robots.txt / sitemap.xml を取得しています', 40);
  const [robotsTxt, sitemapXml, llmsTxt] = await Promise.all([
    tryFetchOptional(`${origin}/robots.txt`, 12000),
    tryFetchOptional(`${origin}/sitemap.xml`, 12000),
    tryFetchOptional(`${origin}/llms.txt`, 10000),
  ]);
  onProgress('診断ルールを適用しています', 85);
  return { url, html, fetchedVia: '手動貼り付け', robotsTxt, sitemapXml, llmsTxt, fetchErrors: [] };
}
