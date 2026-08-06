/**
 * 解析エンジン
 *
 * ここで扱う HTML は fetch で取得した「JavaScript を実行していない生HTML」であり、
 * DOMParser はスクリプトを実行しない。したがってこの解析結果は
 * 「JavaScript を実行できない AI クローラーが見ているページ」とほぼ等価である。
 * 出典: SMX Advanced 2026 / Sam Torres「AIクローラーの69%はJavaScriptを実行できない」
 */
import { AI_BOTS } from './data-sources.js';

const STRIP_SELECTOR = 'script,style,noscript,template,svg,iframe,canvas,object';

/* ── 日本語・英語混在テキストの判定に使うパターン ───────── */
const RE_QUESTION = /[?？]|とは$|とは[ 　]|なぜ|どうやって|どのように|どうすれば|いくら|何が|どれ|おすすめ|選び方|違い|比較|方法|ですか|でしょうか|できる[?？]?$|メリット|デメリット|注意点|手順|やり方|^Q[.．:：]|how |what |why |which |best |vs\.? /i;
const RE_NUM_UNIT = /[0-9０-９][0-9０-９,，.．]*\s*(?:円|ドル|％|%|kg|g|mg|ml|mL|L|ℓ|cm|mm|km|m|個|枚|本|袋|缶|缺|セット|人前|人|名|件|年|ヶ月|か月|カ月|箇月|月|日|時間|分|秒|位|点|倍|℃|度|kcal|台|室|席|坪|㎡|回|種|品|色|サイズ|営業日|日間|泊|号|階)/g;
const RE_DATE = /(20[0-9]{2})[-/年.](1[0-2]|0?[1-9])[-/月.](3[01]|[12][0-9]|0?[1-9])/g;

const CONFIRM_PATTERNS = {
  shipping: { label: '送料・配送条件', re: /送料|配送料|お届け日|発送|配送方法|クール便|冷凍便|宅配/ },
  returns: { label: '返品・キャンセル', re: /返品|返金|交換|キャンセル|不良品/ },
  payment: { label: '支払方法', re: /支払|決済|クレジットカード|代金引換|コンビニ払い|後払い/ },
  stock: { label: '在庫・入手可能性', re: /在庫|売り切れ|品切れ|SOLD ?OUT|予約受付|入荷/i },
  spec: { label: '規格・仕様の数値', re: /内容量|規格|サイズ|重量|原材料|賞味期限|消費期限|産地|生産者|保存方法|アレルギー|成分|スペック|型番/ },
  faq: { label: 'FAQ・よくある質問', re: /よくある(?:ご)?質問|FAQ|Q ?& ?A|お客様の声/i },
  contact: { label: '問い合わせ窓口', re: /お問い?合わせ|問合せ|カスタマーサポート|お客様(?:窓口|センター)|電話番号|受付時間/ },
  legal: { label: '事業者情報・法定表記', re: /特定商取引|会社概要|運営会社|運営者情報|プライバシーポリシー|所在地|代表者/ },
};

const EEAT_PATTERNS = {
  author: /著者|執筆|監修|ライター|編集部|author/i,
  company: /会社概要|運営会社|企業情報|about ?us|会社案内/i,
  privacy: /プライバシーポリシー|個人情報|privacy/i,
  contact: /お問い?合わせ|contact/i,
};

const SPA_MARKERS = [
  { re: /__NEXT_DATA__|\/_next\//, name: 'Next.js' },
  { re: /window\.__NUXT__|\/_nuxt\//, name: 'Nuxt' },
  { re: /data-reactroot|react-dom|__REACT_DEVTOOLS/, name: 'React' },
  { re: /ng-version=|ng-app|angular\./, name: 'Angular' },
  { re: /data-v-app|__VUE|vue\.runtime/, name: 'Vue' },
  { re: /__remixContext/, name: 'Remix' },
  { re: /__sveltekit|data-sveltekit/, name: 'SvelteKit' },
  { re: /window\.__INITIAL_STATE__|__PRELOADED_STATE__/, name: 'クライアント側ハイドレーション' },
];

const EMPTY_ROOT_SELECTORS = ['#root', '#app', '#__next', '#__nuxt', '#application', '[data-reactroot]', 'main#app'];

/* ── ユーティリティ ────────────────────────────── */
function textOf(el) {
  if (!el) return '';
  const clone = el.cloneNode(true);
  clone.querySelectorAll(STRIP_SELECTOR).forEach((n) => n.remove());
  return (clone.textContent || '').replace(/[\s　]+/g, ' ').trim();
}

function countMatches(str, re) {
  const m = str.match(re);
  return m ? m.length : 0;
}

function safeUrl(href, base) {
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}

/* ── JSON-LD ──────────────────────────────────── */
function flattenJsonLd(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((n) => flattenJsonLd(n, out));
    return;
  }
  if (node['@graph']) flattenJsonLd(node['@graph'], out);
  if (node['@type']) out.push(node);
  Object.keys(node).forEach((k) => {
    if (k === '@graph' || k === '@context') return;
    const v = node[k];
    if (v && typeof v === 'object') flattenJsonLd(v, out);
  });
}

function typeList(node) {
  const t = node['@type'];
  if (!t) return [];
  return (Array.isArray(t) ? t : [t]).map(String);
}

/**
 * 「構造化データにしか書かれていない情報」を洗い出す。
 * 出典: Otterly AI 統制実験 — スキーマにのみ存在する情報は全プラットフォームが正しく回答できなかった
 */
const SCHEMA_ONLY_KEYS = [
  { path: ['offers', 'price'], label: '価格' },
  { path: ['offers', 'priceCurrency'], label: '通貨', skipCheck: true },
  { path: ['price'], label: '価格' },
  { path: ['aggregateRating', 'ratingValue'], label: 'レビュー評点' },
  { path: ['aggregateRating', 'reviewCount'], label: 'レビュー件数' },
  { path: ['sku'], label: 'SKU', skipCheck: true },
  { path: ['gtin13'], label: 'GTIN', skipCheck: true },
  { path: ['brand', 'name'], label: 'ブランド名' },
  { path: ['telephone'], label: '電話番号' },
  { path: ['address', 'streetAddress'], label: '住所' },
  { path: ['openingHours'], label: '営業時間' },
  { path: ['deliveryTime'], label: '配送日数' },
  { path: ['returnPolicyCategory'], label: '返品ポリシー' },
];

function dig(obj, path) {
  let cur = obj;
  for (const key of path) {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) cur = cur[0];
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  if (Array.isArray(cur)) cur = cur[0];
  return typeof cur === 'object' ? undefined : cur;
}

function normalizeForCompare(v) {
  return String(v)
    .replace(/[,，\s　]/g, '')
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

/* ── robots.txt ───────────────────────────────── */
export function parseRobots(txt) {
  const groups = [];
  const sitemaps = [];
  let cur = null;
  txt.split(/\r?\n/).forEach((raw) => {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) return;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) return;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === 'sitemap') {
      sitemaps.push(val);
      return;
    }
    if (key === 'user-agent') {
      if (!cur || cur.hasRules) {
        cur = { agents: [], rules: [], hasRules: false };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      return;
    }
    if (!cur) return;
    if (key === 'disallow' || key === 'allow') {
      cur.hasRules = true;
      cur.rules.push({ type: key, path: val });
    }
  });
  return { groups, sitemaps };
}

/** robots.txt のパスパターン(* と 末尾$ に対応)を正規表現へ */
function robotsPathRegex(pattern) {
  let p = pattern;
  let anchorEnd = false;
  if (p.endsWith('$')) {
    anchorEnd = true;
    p = p.slice(0, -1);
  }
  const escaped = p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  try {
    return new RegExp(`^${escaped}${anchorEnd ? '$' : ''}`);
  } catch {
    return null;
  }
}

/**
 * 対象パスがそのボットに対して許可されているかを判定する。
 * 最長一致優先・同長ならAllow優先(Google/Bingの実装に準拠)。
 */
function judgeBot(parsed, botName, targetPath = '/') {
  const lower = botName.toLowerCase();
  const exact = parsed.groups.filter((g) => g.agents.includes(lower));
  const wildcard = parsed.groups.filter((g) => g.agents.includes('*'));
  const applicable = exact.length ? exact : wildcard;
  const by = !applicable.length ? 'ルールなし(暗黙の許可)' : exact.length ? `User-agent: ${botName}` : 'User-agent: *';
  if (!applicable.length) return { state: 'allowed', by, disallowCount: 0, sitewide: false };

  const rules = applicable.flatMap((g) => g.rules);
  const disallows = rules.filter((r) => r.type === 'disallow' && r.path);
  let best = null;
  rules.forEach((r) => {
    if (!r.path) return; // 空のDisallowは「制限なし」
    const rx = robotsPathRegex(r.path);
    if (!rx || !rx.test(targetPath)) return;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.type === 'allow')) best = r;
  });
  const sitewide = disallows.some((r) => r.path === '/' || r.path === '/*');
  const blocked = best && best.type === 'disallow';
  return { state: blocked ? 'blocked' : 'allowed', by, disallowCount: disallows.length, sitewide, matched: best ? `${best.type}: ${best.path}` : null };
}

/* ── 本体 ─────────────────────────────────────── */
export function analyze({ url, html, robotsTxt, llmsTxt, sitemapXml, fetchedVia, httpStatus, headers }) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const base = url;
  const urlObj = safeUrl(url, 'https://example.com') || { hostname: '', origin: '', pathname: '/' };

  /* --- テキスト --- */
  const bodyText = textOf(doc.body);
  const mainEl = doc.querySelector('main, article, [role="main"], #main, .main-content');
  const mainText = textOf(mainEl);
  const textLength = bodyText.length;
  const textRatio = html.length ? bodyText.length / html.length : 0;

  /* --- SPA / レンダリング --- */
  const scripts = Array.from(doc.querySelectorAll('script'));
  const inlineScriptBytes = scripts.reduce((s, el) => s + (el.textContent || '').length, 0);
  const markers = SPA_MARKERS.filter((m) => m.re.test(html)).map((m) => m.name);
  const emptyRoots = EMPTY_ROOT_SELECTORS.filter((sel) => {
    const el = doc.querySelector(sel);
    return el && textOf(el).length < 60;
  });
  const noscriptEls = Array.from(doc.querySelectorAll('noscript'));
  const noscriptText = noscriptEls.map((n) => (n.textContent || '').trim()).join(' ');
  const noscriptWarns = /JavaScript|ジャバスクリプト|スクリプト/i.test(noscriptText) && /有効|オン|enable|on/i.test(noscriptText);
  const isShell = (textLength < 700 && scripts.length >= 3) || (emptyRoots.length > 0 && textLength < 1500);

  /* --- 見出し --- */
  const headingEls = Array.from(doc.querySelectorAll('h1,h2,h3,h4,h5,h6'));
  const headings = headingEls.map((el) => ({ level: Number(el.tagName[1]), text: textOf(el) })).filter((h) => h.text);
  const h1s = headings.filter((h) => h.level === 1);
  const questionHeadings = headings.filter((h) => RE_QUESTION.test(h.text));
  let hierarchyJumps = 0;
  let prev = 0;
  headings.forEach((h) => {
    if (prev && h.level > prev + 1) hierarchyJumps += 1;
    prev = h.level;
  });

  /* --- 段落・構造ブロック --- */
  const paraLens = Array.from(doc.querySelectorAll('p'))
    .map((p) => textOf(p).length)
    .filter((n) => n > 0);
  const paraAvg = paraLens.length ? Math.round(paraLens.reduce((a, b) => a + b, 0) / paraLens.length) : 0;
  const tables = doc.querySelectorAll('table').length;
  const lists = doc.querySelectorAll('ul,ol').length;
  const defLists = doc.querySelectorAll('dl').length;
  const anchors = doc.querySelectorAll('a[href^="#"]').length;

  /* --- 検証可能な事実 --- */
  const numHits = countMatches(bodyText, RE_NUM_UNIT);
  const per1k = textLength ? (numHits / textLength) * 1000 : 0;

  /* --- リンク --- */
  let internal = 0;
  let external = 0;
  const externalHosts = new Set();
  const internalHrefs = new Set();
  const internalUrls = new Set();
  const navUrls = new Set();
  let genericAnchors = 0;
  const anchorEls = Array.from(doc.querySelectorAll('a[href]'));
  anchorEls.forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (/^(mailto:|tel:|javascript:|#)/i.test(href)) return;
    const u = safeUrl(href, base);
    if (!u) return;
    const label = textOf(a);
    if (label && /^(こちら|詳細|もっと見る|more|read more|click here|リンク|続きを読む)$/i.test(label)) genericAnchors += 1;
    if (u.hostname === urlObj.hostname) {
      internal += 1;
      internalHrefs.add(u.pathname);
      const clean = `${u.origin}${u.pathname}`;
      if (internalUrls.size < 400) internalUrls.add(clean);
      if (a.closest('nav, header, [role="navigation"], .nav, .gnav, .global-nav')) navUrls.add(clean);
    } else {
      external += 1;
      externalHosts.add(u.hostname.replace(/^www\./, ''));
    }
  });

  /* --- メタ --- */
  const metaOf = (name) => {
    const el = doc.querySelector(`meta[name="${name}"]`) || doc.querySelector(`meta[property="${name}"]`);
    return el ? (el.getAttribute('content') || '').trim() : '';
  };
  const title = (doc.querySelector('title')?.textContent || '').trim();
  const description = metaOf('description');
  const robotsMetaRaw = metaOf('robots').toLowerCase();
  const canonicalEl = doc.querySelector('link[rel="canonical"]');
  const canonical = canonicalEl ? canonicalEl.getAttribute('href') : '';
  const lang = doc.documentElement.getAttribute('lang') || '';
  const hasViewport = !!doc.querySelector('meta[name="viewport"]');
  const og = {
    title: metaOf('og:title'),
    description: metaOf('og:description'),
    image: metaOf('og:image'),
    siteName: metaOf('og:site_name'),
    type: metaOf('og:type'),
  };
  const hreflangs = Array.from(doc.querySelectorAll('link[rel="alternate"][hreflang]')).map((l) => l.getAttribute('hreflang'));

  /* --- 画像 --- */
  const imgs = Array.from(doc.querySelectorAll('img'));
  const imgWithAlt = imgs.filter((i) => (i.getAttribute('alt') || '').trim().length > 0).length;
  const imgEmptyAlt = imgs.filter((i) => i.hasAttribute('alt') && !(i.getAttribute('alt') || '').trim()).length;
  const lazyImgOnly = imgs.filter((i) => !i.getAttribute('src') && (i.getAttribute('data-src') || i.getAttribute('data-original'))).length;

  /* --- JSON-LD --- */
  const ldBlocks = [];
  const ldErrors = [];
  Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).forEach((el, i) => {
    const raw = (el.textContent || '').trim();
    if (!raw) return;
    try {
      ldBlocks.push(JSON.parse(raw));
    } catch (e) {
      ldErrors.push(`ブロック${i + 1}: ${e.message}`);
    }
  });
  const ldNodes = [];
  flattenJsonLd(ldBlocks, ldNodes);
  const ldTypes = Array.from(new Set(ldNodes.flatMap(typeList)));
  const microdataTypes = Array.from(new Set(Array.from(doc.querySelectorAll('[itemtype]')).map((el) => (el.getAttribute('itemtype') || '').split('/').pop())));

  const compareText = normalizeForCompare(bodyText);
  const schemaOnly = [];
  const seenPairs = new Set();
  ldNodes.forEach((node) => {
    const types = typeList(node);
    SCHEMA_ONLY_KEYS.forEach((k) => {
      if (k.skipCheck) return;
      const v = dig(node, k.path);
      if (v === undefined || v === null || String(v).length < 2) return;
      const norm = normalizeForCompare(v);
      if (norm.length < 2) return;
      const dedupeKey = `${k.label}|${norm}`;
      if (seenPairs.has(dedupeKey)) return;
      seenPairs.add(dedupeKey);
      schemaOnly.push({ type: types[0] || '?', key: k.label, value: String(v).slice(0, 60), foundInText: compareText.includes(norm) });
    });
  });
  const schemaOnlyMissing = schemaOnly.filter((s) => !s.foundInText);

  const orgNode = ldNodes.find((n) => typeList(n).some((t) => /Organization|Corporation|LocalBusiness|Store|OnlineStore|NewsMediaOrganization/.test(t)));
  const siteNode = ldNodes.find((n) => typeList(n).includes('WebSite'));
  const productNodes = ldNodes.filter((n) => typeList(n).includes('Product'));
  const articleNodes = ldNodes.filter((n) => typeList(n).some((t) => /Article|BlogPosting|NewsArticle/.test(t)));
  const sameAs = []
    .concat(orgNode?.sameAs || [], siteNode?.sameAs || [])
    .flat()
    .filter((s) => typeof s === 'string');

  /* --- エンティティ・ブランド --- */
  const brandCandidates = [orgNode?.name, og.siteName, siteNode?.name].filter((s) => typeof s === 'string' && s.trim());
  const brandName = brandCandidates[0] || (title.split(/[|｜\-–—:：]/).pop() || '').trim();
  const brandTokens = brandName ? brandName.trim().split(/[\s　・]+/).filter(Boolean) : [];
  const brandConsistent = brandCandidates.length >= 2 ? new Set(brandCandidates.map((s) => normalizeForCompare(s))).size === 1 : null;
  const socialHosts = ['youtube.com', 'x.com', 'twitter.com', 'instagram.com', 'facebook.com', 'note.com', 'linkedin.com', 'tiktok.com', 'wikipedia.org', 'wikidata.org'];
  const socialLinks = Array.from(new Set([...sameAs, ...Array.from(externalHosts)].map(String))).filter((s) => socialHosts.some((h) => s.includes(h)));
  const hasYouTube = socialLinks.some((s) => s.includes('youtube.com')) || /youtube\.com|youtu\.be/.test(html);
  const hasWiki = socialLinks.some((s) => /wikipedia\.org|wikidata\.org/.test(s));

  /* --- E-E-A-T / 鮮度 --- */
  const linkTextBlob = anchorEls.map((a) => `${textOf(a)} ${a.getAttribute('href') || ''}`).join(' ');
  const eeat = {};
  Object.entries(EEAT_PATTERNS).forEach(([k, re]) => {
    eeat[k] = re.test(linkTextBlob) || re.test(bodyText.slice(0, 4000));
  });
  const authorSchema = !!(articleNodes.find((n) => n.author) || ldNodes.find((n) => n.author));
  const dateModified = ldNodes.map((n) => n.dateModified || n.datePublished).find(Boolean) || metaOf('article:modified_time') || '';
  const textDates = Array.from(bodyText.matchAll(RE_DATE)).map((m) => m[0]);
  const newestDate = [dateModified, ...textDates]
    .map((d) => {
      const t = Date.parse(String(d).replace(/年|月/g, '-').replace(/日/g, ''));
      return Number.isNaN(t) ? null : t;
    })
    .filter(Boolean)
    .sort((a, b) => b - a)[0] || null;

  /* --- Confirm(AICAS)対応 --- */
  const confirm = {};
  Object.entries(CONFIRM_PATTERNS).forEach(([k, def]) => {
    confirm[k] = { label: def.label, found: def.re.test(bodyText) || def.re.test(linkTextBlob) };
  });

  /* --- robots.txt / sitemap / llms.txt --- */
  let robots = { found: false, bots: [], sitemaps: [], text: '' };
  if (robotsTxt && typeof robotsTxt === 'string' && robotsTxt.trim() && !/^<(!doctype|html)/i.test(robotsTxt.trim())) {
    const parsed = parseRobots(robotsTxt);
    robots = {
      found: true,
      text: robotsTxt.slice(0, 4000),
      sitemaps: parsed.sitemaps,
      bots: AI_BOTS.map((b) => ({ ...b, ...judgeBot(parsed, b.name, urlObj.pathname || '/') })),
    };
  }
  const sitemap = { found: false, urlCount: 0 };
  if (sitemapXml && /<(urlset|sitemapindex)/i.test(sitemapXml)) {
    sitemap.found = true;
    sitemap.urlCount = countMatches(sitemapXml, /<loc>/g);
    sitemap.isIndex = /<sitemapindex/i.test(sitemapXml);
  } else if (robots.sitemaps.length) {
    sitemap.declaredInRobots = true;
  }
  const llms = { found: !!(llmsTxt && llmsTxt.trim() && !/^<(!doctype|html)/i.test(llmsTxt.trim())) };

  return {
    url,
    host: urlObj.hostname,
    origin: urlObj.origin,
    fetchedVia,
    httpStatus,
    headers: headers || {},
    htmlBytes: html.length,

    text: bodyText,
    textLength,
    textRatio,
    mainText,
    mainTextLength: mainText.length,
    hasMainLandmark: !!mainEl,

    spa: { isShell, markers, emptyRoots, scriptCount: scripts.length, inlineScriptBytes },
    noscript: { count: noscriptEls.length, warns: noscriptWarns, text: noscriptText.slice(0, 300) },

    headings,
    h1s,
    h1Count: h1s.length,
    questionHeadings,
    hierarchyJumps,

    paragraphs: { count: paraLens.length, avg: paraAvg },
    blocks: { tables, lists, defLists, anchors },

    facts: { numHits, per1k },

    links: {
      internal,
      external,
      uniqueInternal: internalHrefs.size,
      externalHosts: Array.from(externalHosts),
      genericAnchors,
      total: anchorEls.length,
      internalUrls: Array.from(internalUrls),
      navUrls: Array.from(navUrls),
    },

    meta: { title, titleLen: title.length, description, descLen: description.length, robotsMeta: robotsMetaRaw, canonical, lang, hasViewport, hreflangs },
    og,

    images: { total: imgs.length, withAlt: imgWithAlt, emptyAlt: imgEmptyAlt, lazyOnly: lazyImgOnly },

    schema: {
      blockCount: ldBlocks.length,
      errors: ldErrors,
      types: ldTypes,
      microdataTypes,
      nodes: ldNodes,
      hasOrg: !!orgNode,
      hasWebSite: !!siteNode,
      hasBreadcrumb: ldTypes.includes('BreadcrumbList') || microdataTypes.includes('BreadcrumbList'),
      products: productNodes,
      articles: articleNodes,
      schemaOnly,
      schemaOnlyMissing,
    },

    entity: { brandName, brandTokens, brandConsistent, sameAs, socialLinks, hasYouTube, hasWiki },
    eeat: { ...eeat, authorSchema, dateModified, newestDate },
    confirm,
    robots,
    sitemap,
    llms,
  };
}

/** ページ種別の推定(ルール側の適用可否判定に使う) */
export function guessPageKind(ctx) {
  if (ctx.schema.products.length || /カートに入れる|購入手続き|add to cart|税込|在庫/.test(ctx.text.slice(0, 6000))) return 'product';
  if (ctx.schema.articles.length || ctx.paragraphs.count > 12) return 'article';
  if (ctx.url && /\/?$/.test(ctx.url) && (ctx.meta.canonical || '').replace(/\/$/, '') === (ctx.origin || '')) return 'home';
  return 'other';
}
