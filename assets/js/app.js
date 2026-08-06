/** 診断ページの制御 */
import { boot, store, toast, esc } from './common.js';
import { fetchTarget, fromPastedHtml, fetchPageOnly, fetchTextOnly, normalizeUrl } from './fetcher.js';
import { analyze } from './analyzer.js';
import { score } from './rules.js';
import { selectPages, parseSitemap } from './crawler.js';
import { renderReport, renderSiteReport, toMarkdown, toJson, siteToMarkdown, siteToJson, download } from './report.js';

boot();

const $ = (sel) => document.querySelector(sel);
const form = $('#diag-form');
const urlInput = $('#url-input');
const crawlToggle = $('#crawl-toggle');
const crawlLimit = $('#crawl-limit');
const progress = $('#progress');
const progressBar = $('#progress-bar');
const progressMsg = $('#progress-msg');
const progressSub = $('#progress-sub');
const cancelBtn = $('#cancel-btn');
const errorBox = $('#error-box');
const results = $('#results');
const exportBar = $('#export-bar');
const historyBox = $('#history');
const pasteDialog = $('#paste-dialog');

const HISTORY_KEY = 'aio.history';
let current = null; // { ctx, scored }
let currentSite = null; // { pages, meta }
let cancelled = false;

/* ── 進捗表示 ─────────────────────────────── */
function setProgress(msg, pct, sub = '') {
  progress.hidden = false;
  progressBar.style.width = `${pct}%`;
  progressMsg.textContent = msg;
  progressSub.textContent = sub;
}
function endProgress() {
  progressBar.style.width = '100%';
  setTimeout(() => {
    progress.hidden = true;
    progressBar.style.width = '0%';
    progressSub.textContent = '';
  }, 350);
}
function showError(title, detailLines = [], showPaste = false) {
  errorBox.hidden = false;
  errorBox.innerHTML = `
    <h3>${esc(title)}</h3>
    ${detailLines.length ? `<ul>${detailLines.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    ${
      showPaste
        ? `<p>対象サイトが外部プロキシからのアクセスを拒否している場合(WAF・Cloudflare等)は、<strong>HTMLソースを貼り付けて診断</strong>できます。ブラウザで対象ページを開き <code>Ctrl+U</code> → 全選択 → コピーで取得してください。</p>
           <button type="button" class="btn" data-open-paste>HTMLソースを貼り付けて診断</button>`
        : ''
    }`;
}

/* ── 単一ページ診断 ───────────────────────── */
async function runSingle(kind, payload) {
  reset();
  try {
    const fetched = kind === 'paste' ? await fromPastedHtml(payload.url, payload.html, setProgress) : await fetchTarget(payload.url, setProgress);
    const ctx = analyze(fetched);
    const scored = score(ctx);
    current = { ctx, scored };
    currentSite = null;
    renderReport(results, ctx, scored);
    finish(ctx.url, scored);
  } catch (e) {
    endProgress();
    if (e.details) showError('ページを取得できませんでした', e.details, true);
    else showError(e.message || '診断に失敗しました', [], true);
  }
}

/* ── サイト診断(起点 + 配下ページ) ─────────── */
async function runSite(startUrl, limit) {
  reset();
  cancelBtn.hidden = false;
  try {
    setProgress('起点ページを取得しています', 6, startUrl);
    const top = await fetchTarget(startUrl, (m, p) => setProgress(m, Math.min(p * 0.18, 18), startUrl));
    const topCtx = analyze(top);
    const pages = [{ ctx: topCtx, scored: score(topCtx), why: ['起点'] }];
    const shared = { robotsTxt: top.robotsTxt, sitemapXml: top.sitemapXml, llmsTxt: top.llmsTxt };
    const origin = new URL(top.url).origin;

    // sitemap を集める(index 形式なら子を2件まで展開)
    setProgress('sitemap から主要ページを探しています', 22);
    let sitemapUrls = [];
    const parsed = parseSitemap(top.sitemapXml);
    sitemapUrls = parsed.urls;
    const childSitemaps = parsed.children.length ? parsed.children : top.robotsTxt ? (top.robotsTxt.match(/^\s*sitemap:\s*(\S+)/gim) || []).map((l) => l.split(/:\s*/).slice(1).join(':').trim()) : [];
    for (const child of childSitemaps.slice(0, 2)) {
      if (cancelled) break;
      const xml = await fetchTextOnly(child, 14000);
      if (xml) sitemapUrls = sitemapUrls.concat(parseSitemap(xml).urls);
      if (sitemapUrls.length > 800) break;
    }

    const candidates = selectPages({
      origin,
      topUrl: top.url,
      internalUrls: topCtx.links.internalUrls,
      navUrls: topCtx.links.navUrls,
      sitemapUrls,
      limit: limit - 1,
    });

    if (!candidates.length) {
      toast('配下ページを特定できなかったため、起点ページのみ診断しました', 'critical');
      current = { ctx: topCtx, scored: pages[0].scored };
      currentSite = null;
      renderReport(results, topCtx, pages[0].scored);
      finish(top.url, pages[0].scored);
      return;
    }

    const failed = [];
    for (let i = 0; i < candidates.length; i += 1) {
      if (cancelled) break;
      const c = candidates[i];
      const pct = 26 + Math.round((i / candidates.length) * 68);
      setProgress(`配下ページを診断しています(${i + 1}/${candidates.length})`, pct, c.url);
      try {
        const fetched = await fetchPageOnly(c.url, shared);
        const ctx = analyze(fetched);
        pages.push({ ctx, scored: score(ctx), why: c.why });
      } catch (e) {
        failed.push({ url: c.url, reason: e.details ? e.details.slice(0, 2).join(' / ') : e.message });
      }
    }

    setProgress('サイト全体のレポートを作成しています', 96);
    currentSite = { pages, meta: { failed, candidateCount: candidates.length } };
    current = pages[0];
    renderSiteReport(results, pages, currentSite.meta);
    pages.forEach((p) => pushHistory(p.ctx.url, p.scored, false));
    renderHistory();
    endProgress();
    cancelBtn.hidden = true;
    exportBar.hidden = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (cancelled) toast(`中断しました(${pages.length}ページ分の結果を表示しています)`, 'critical');
  } catch (e) {
    endProgress();
    cancelBtn.hidden = true;
    if (e.details) showError('起点ページを取得できませんでした', e.details, true);
    else showError(e.message || '診断に失敗しました', [], true);
  }
}

function reset() {
  cancelled = false;
  errorBox.hidden = true;
  results.innerHTML = '';
  exportBar.hidden = true;
  cancelBtn.hidden = true;
}

function finish(url, scored) {
  endProgress();
  cancelBtn.hidden = true;
  exportBar.hidden = false;
  pushHistory(url, scored);
  results.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

cancelBtn.addEventListener('click', () => {
  cancelled = true;
  cancelBtn.disabled = true;
  setTimeout(() => {
    cancelBtn.disabled = false;
  }, 1200);
});

form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  let url;
  try {
    url = normalizeUrl(urlInput.value);
  } catch (e) {
    showError(e.message);
    return;
  }
  if (crawlToggle.checked) runSite(url, Number(crawlLimit.value) || 10);
  else runSingle('fetch', { url });
});

document.querySelectorAll('[data-sample]').forEach((b) =>
  b.addEventListener('click', () => {
    urlInput.value = b.dataset.sample;
    urlInput.focus();
  }),
);

/* ── 手動貼り付け ─────────────────────────── */
document.addEventListener('click', (ev) => {
  if (ev.target.closest('[data-open-paste]')) {
    $('#paste-url').value = urlInput.value || '';
    pasteDialog.showModal();
  }
});
$('#paste-cancel').addEventListener('click', () => pasteDialog.close());
$('#paste-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const url = $('#paste-url').value;
  const html = $('#paste-html').value;
  if (!html || html.length < 100) {
    toast('HTMLソースを貼り付けてください', 'critical');
    return;
  }
  try {
    normalizeUrl(url);
  } catch (e) {
    toast(e.message, 'critical');
    return;
  }
  pasteDialog.close();
  urlInput.value = url;
  runSingle('paste', { url, html });
});

/* ── エクスポート ─────────────────────────── */
const stamp = () => new Date().toISOString().slice(0, 10);
const hostOf = () => {
  try {
    return new URL(current.ctx.url).hostname;
  } catch {
    return 'report';
  }
};
$('#btn-md').addEventListener('click', () => {
  if (!current) return;
  const md = currentSite ? siteToMarkdown(currentSite.pages, currentSite.meta) : toMarkdown(current.ctx, current.scored);
  download(`aio-report_${hostOf()}_${stamp()}.md`, md, 'text/markdown;charset=utf-8');
});
$('#btn-json').addEventListener('click', () => {
  if (!current) return;
  const json = currentSite ? siteToJson(currentSite.pages, currentSite.meta) : toJson(current.ctx, current.scored);
  download(`aio-report_${hostOf()}_${stamp()}.json`, json, 'application/json');
});
$('#btn-copy').addEventListener('click', async () => {
  if (!current) return;
  const md = currentSite ? siteToMarkdown(currentSite.pages, currentSite.meta) : toMarkdown(current.ctx, current.scored);
  try {
    await navigator.clipboard.writeText(md);
    toast('レポートをMarkdownでコピーしました');
  } catch {
    toast('コピーできませんでした。ダウンロードをお使いください', 'critical');
  }
});
$('#btn-print').addEventListener('click', () => window.print());
$('#btn-open-all').addEventListener('click', () => {
  const shouldOpen = document.querySelectorAll('#results details:not([open])').length > 0;
  document.querySelectorAll('#results details').forEach((d) => {
    d.open = shouldOpen;
  });
  $('#btn-open-all').textContent = shouldOpen ? 'すべて閉じる' : 'すべて開く';
});

window.addEventListener('beforeprint', () => {
  document.querySelectorAll('#results details').forEach((d) => {
    d.dataset.wasOpen = d.open ? '1' : '';
    d.open = true;
  });
});
window.addEventListener('afterprint', () => {
  document.querySelectorAll('#results details').forEach((d) => {
    d.open = d.dataset.wasOpen === '1';
  });
});

/* ── 履歴 ─────────────────────────────────── */
function pushHistory(url, scored, rerender = true) {
  const list = store.get(HISTORY_KEY, []);
  const entry = { url, at: Date.now(), total: scored.total, grade: scored.grade.label };
  const next = [entry, ...list.filter((h) => h.url !== url)].slice(0, 20);
  store.set(HISTORY_KEY, next);
  if (rerender) renderHistory();
}

function renderHistory() {
  const list = store.get(HISTORY_KEY, []);
  if (!list.length) {
    historyBox.hidden = true;
    return;
  }
  historyBox.hidden = false;
  historyBox.innerHTML = `
    <p class="eyebrow">HISTORY</p>
    <h2 class="card-title">診断履歴<button type="button" class="btn btn-ghost btn-sm" id="clear-history">履歴を削除</button></h2>
    <p class="card-lead">この端末のブラウザにのみ保存されます(サーバーへの送信はありません)。同じURLを再診断すると上書きされます。</p>
    <div class="table-scroll"><table>
      <thead><tr><th scope="col">URL</th><th scope="col">スコア</th><th scope="col">評価</th><th scope="col">診断日時</th><th scope="col"></th></tr></thead>
      <tbody>${list
        .map(
          (h) => `<tr>
            <th scope="row" class="url-cell">${esc(h.url)}</th>
            <td class="num">${h.total}</td>
            <td>${esc(h.grade)}</td>
            <td class="muted">${new Date(h.at).toLocaleString('ja-JP', { dateStyle: 'short', timeStyle: 'short' })}</td>
            <td><button type="button" class="btn btn-ghost btn-sm" data-rerun="${esc(h.url)}">再診断</button></td>
          </tr>`,
        )
        .join('')}</tbody>
    </table></div>`;
  historyBox.querySelector('#clear-history').addEventListener('click', () => {
    store.del(HISTORY_KEY);
    renderHistory();
    toast('履歴を削除しました');
  });
  historyBox.querySelectorAll('[data-rerun]').forEach((b) =>
    b.addEventListener('click', () => {
      urlInput.value = b.dataset.rerun;
      crawlToggle.checked = false;
      runSingle('fetch', { url: b.dataset.rerun });
    }),
  );
}
renderHistory();

/* ── クエリからの自動実行 ──────────────────── */
const params = new URLSearchParams(location.search);
const q = params.get('url');
if (q) {
  urlInput.value = q;
  const wantSite = params.get('site') === '1';
  crawlToggle.checked = wantSite;
  if (wantSite) runSite(q, Number(params.get('limit')) || 10);
  else runSingle('fetch', { url: q });
}
