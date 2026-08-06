/**
 * 配下ページの選定
 *
 * 「ドメインで検索したときの上位」に相当するページを、静的サイトから特定する方法。
 * 検索APIはブラウザから叩けない(キーとCORSの制約)ため、次の3つの信号で近似する。
 *
 *   1. sitemap.xml に載っている(サイト側が「収録してほしい」と宣言しているURL)
 *   2. トップページからリンクされている(内部リンクは重要度の主張そのもの)
 *   3. グローバルナビに入っている(サイト構造上の主要導線)
 *
 * 実際の検索順位とは一致しないが、「サイトが自ら重要と位置づけているページ」を選ぶため、
 * テンプレート単位の傾向を掴む目的では実用的な近似になる。
 * 加えて、同じURLパターン(テンプレート)からは最大2件までに絞り、
 * 商品詳細ばかり10件並ぶのを防いで診断のカバー範囲を広げる。
 */

/* 診断対象にしても意味がない(あるいは会員限定で中身が出ない)ページは除外する */
const EXCLUDE_RE =
  /\/(cart|basket|checkout|login|logout|signin|signup|register|entry|mypage|my|customer|account|member|password|reminder|search|inquiry|form|confirm|complete|thanks|favorite|wishlist|order|history|preview|print|amp)(\/|$|\?|\.)|\.(pdf|jpe?g|png|gif|webp|svg|zip|csv|xlsx?|docx?|mp4|mp3|ico|css|js|rss|xml)$|[?&](page|p|pg|sort|order|view|utm_)/i;

/* 定型ページ。診断はできるが、AI可視性の改善対象としての優先度は低い */
const LOW_VALUE_RE = /\/(privacy|policy|terms|sitemap|agreement|law|tokushoho|copyright|cookie|contact)(\/|$|\.)/i;

/* AI可視性の主戦場になりやすいテンプレート。優先的に診断枠を割く */
const HIGH_VALUE_RE = /\/(product|products|item|items|goods|detail|g|p)(\/|$|\.)/i;
const MID_VALUE_RE = /\/(category|categories|c|list|ranking|feature|features|special|topics|topic|column|blog|articles?|news|guide|faq|help|about|pages)(\/|$|\.)/i;

/** URL をテンプレート単位のパターンへ正規化(数字・IDを潰す) */
export function templateOf(pathname) {
  return (
    pathname
      .replace(/\/$/, '')
      .split('/')
      .map((seg) => {
        if (!seg) return seg;
        if (/^\d+$/.test(seg)) return ':num';
        if (/^[0-9a-f]{8,}$/i.test(seg)) return ':id';
        if (/\d{4,}/.test(seg)) return ':id';
        return seg;
      })
      .join('/') || '/'
  );
}

/** sitemap.xml / sitemapindex から <loc> を取り出す */
export function parseSitemap(xml) {
  if (!xml) return { urls: [], children: [] };
  const isIndex = /<sitemapindex/i.test(xml);
  const locs = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)).map((m) => m[1].replace(/&amp;/g, '&'));
  return isIndex ? { urls: [], children: locs } : { urls: locs, children: [] };
}

/**
 * 診断対象の配下ページを選ぶ
 * @param {object} opts
 * @param {string} opts.origin           対象オリジン
 * @param {string} opts.topUrl           トップ(起点)のURL
 * @param {string[]} opts.internalUrls   トップページ内の内部リンク
 * @param {string[]} opts.navUrls        グローバルナビ内のリンク
 * @param {string[]} opts.sitemapUrls    sitemap.xml のURL
 * @param {number} opts.limit            最大件数(起点を除く)
 * @returns {{url:string, template:string, score:number, why:string[]}[]}
 */
export function selectPages({ origin, topUrl, internalUrls = [], navUrls = [], sitemapUrls = [], limit = 9 }) {
  const topClean = clean(topUrl);
  const navSet = new Set(navUrls.map(clean));
  const linkSet = new Set(internalUrls.map(clean));
  const sitemapSet = new Set(
    sitemapUrls
      .filter((u) => {
        try {
          return new URL(u).origin === origin;
        } catch {
          return false;
        }
      })
      .map(clean),
  );
  // sitemap の並び順は「サイト側が上位に置いた順」なので順位情報として使う
  const sitemapRank = new Map();
  Array.from(sitemapSet).forEach((u, i) => sitemapRank.set(u, i));

  const candidates = new Map();
  const add = (url) => {
    if (!url || url === topClean) return;
    let u;
    try {
      u = new URL(url);
    } catch {
      return;
    }
    if (u.origin !== origin) return;
    if (EXCLUDE_RE.test(u.pathname + u.search)) return;
    if (candidates.has(url)) return;

    const depth = u.pathname.split('/').filter(Boolean).length;
    const why = [];
    let score = 0;
    if (navSet.has(url)) {
      score += 40;
      why.push('グローバルナビ');
    }
    if (linkSet.has(url)) {
      score += 25;
      why.push('トップからリンク');
    }
    if (sitemapRank.has(url)) {
      const rank = sitemapRank.get(url);
      score += 20 + Math.max(0, 15 - Math.floor(rank / 20));
      why.push(`sitemap ${rank + 1}番目`);
    }
    score += Math.max(0, 14 - depth * 4);
    if (HIGH_VALUE_RE.test(u.pathname)) {
      score += 22;
      why.push('商品系テンプレート');
    } else if (MID_VALUE_RE.test(u.pathname)) {
      score += 12;
      why.push('一覧・特集系');
    }
    if (LOW_VALUE_RE.test(u.pathname)) score -= 45;
    candidates.set(url, { url, template: templateOf(u.pathname), depth, score, why });
  };

  navUrls.map(clean).forEach(add);
  internalUrls.map(clean).forEach(add);
  Array.from(sitemapSet).forEach(add);

  const sorted = Array.from(candidates.values()).sort((a, b) => b.score - a.score || a.depth - b.depth || a.url.localeCompare(b.url));

  // 同一テンプレートは最大2件まで。まず1件ずつ広く取り、余りを2件目で埋める
  const picked = [];
  const perTemplate = new Map();
  for (const pass of [1, 2]) {
    for (const c of sorted) {
      if (picked.length >= limit) break;
      const used = perTemplate.get(c.template) || 0;
      if (used >= pass) continue;
      if (picked.includes(c)) continue;
      perTemplate.set(c.template, used + 1);
      picked.push(c);
    }
    if (picked.length >= limit) break;
  }
  return picked.slice(0, limit);
}

function clean(u) {
  try {
    const url = new URL(u);
    url.hash = '';
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return u;
  }
}
