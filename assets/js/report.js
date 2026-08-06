/**
 * 診断結果のレンダリングとエクスポート
 */
import { SOURCES } from './data-sources.js';
import { CATEGORIES } from './rules.js';
import { scoreArc, hBars, tableView } from './charts.js';
import { esc } from './common.js';
import { templateOf } from './crawler.js';

export { esc };

const STATUS = {
  pass: { icon: '◎', label: '良好', tone: 'good' },
  warn: { icon: '△', label: '要改善', tone: 'warning' },
  fail: { icon: '✕', label: '未対応', tone: 'critical' },
  unknown: { icon: '?', label: '判定不能', tone: 'serious' },
  skip: { icon: '—', label: '対象外', tone: 'muted' },
};

const toneOfPct = (p) => (p >= 80 ? 'good' : p >= 60 ? 'warning' : p >= 40 ? 'serious' : 'critical');
const labelOfPct = (p) => (p >= 80 ? '良好' : p >= 60 ? '要改善' : p >= 40 ? '課題あり' : '重大');
const iconOfPct = (p) => (p >= 80 ? '◎' : p >= 60 ? '△' : p >= 40 ? '▲' : '✕');
const PHASE_LABEL = { P0: '即着手(P0)', P1: '3か月以内(P1)', P2: '6か月〜(P2)' };

function srcChips(keys) {
  return (keys || [])
    .map((k) => SOURCES[k])
    .filter(Boolean)
    .map((s) => `<a class="src-chip" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.claim)}">${esc(s.origin)}<span class="src-grade">${esc(s.grade)}</span></a>`)
    .join('');
}

function section(eyebrow, title, lead, cls = '') {
  const s = document.createElement('section');
  s.className = `card ${cls}`;
  s.innerHTML = `${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}<h2 class="card-title">${esc(title)}</h2>${lead ? `<p class="card-lead">${lead}</p>` : ''}`;
  return s;
}

/* ── サマリー文 ───────────────────────────── */
function summarize(scored, ctx) {
  const worst = [...scored.cats].filter((c) => c.pct !== null).sort((a, b) => a.pct - b.pct)[0];
  const p0 = scored.actions.filter((a) => a.phase === 'P0');
  const lines = [];
  if (ctx.spa.isShell) {
    lines.push('<strong>JavaScriptを実行しないと本文が見えない状態です。</strong>AIクローラーの69%はJSを実行できないため、この状態では他の施策の効果が出ません。最優先はサーバーレンダリングです。');
  } else if (scored.total >= 80) {
    lines.push('オンサイトの基礎は2026年基準で成立しています。ここから先の伸びは<strong>オフサイト(第三者言及)</strong>で決まります — AI検索でのブランド言及の85%は第三者ソース由来です。');
  } else if (worst) {
    lines.push(`最も弱いのは<strong>「${esc(worst.name)}」(${Math.round(worst.pct)}点)</strong>です。${esc(worst.lead)}`);
  }
  if (p0.length) lines.push(`即着手すべき項目(P0)が <strong>${p0.length}件</strong>あります。`);
  const missing = ctx.schema.schemaOnlyMissing.length;
  if (missing) lines.push(`構造化データにしか書かれていない値が ${missing}件あります。これはどのAIプラットフォームも正しく読めません。`);
  return lines.join(' ');
}

/* ── 単一ページのレポート ─────────────────── */
export function renderReport(root, ctx, scored) {
  root.innerHTML = '';
  root.append(scoreCard(ctx, scored));
  root.append(categorySection(scored));
  root.append(aiViewSection(ctx));
  root.append(actionSection(scored));
  root.append(detailSection(scored));
  root.append(botSection(ctx));
  root.append(infoSection(scored));
}

function scoreCard(ctx, scored) {
  const s = document.createElement('section');
  s.className = 'card score-card';
  const gr = scored.grade;
  s.innerHTML = `
    <div class="score-main">
      <div class="score-arc-wrap">
        <div class="score-hero"><span class="score-num">${scored.total}</span><span class="score-den">/ 100</span></div>
      </div>
      <div class="score-meta">
        <p class="eyebrow">AI VISIBILITY SCORE</p>
        <p class="score-grade tone-${gr.tone}"><span class="grade-badge">${esc(gr.label)}</span> ${esc(gr.text)}</p>
        <p class="score-summary">${summarize(scored, ctx)}</p>
        <dl class="score-facts">
          <div><dt>診断URL</dt><dd><a href="${esc(ctx.url)}" target="_blank" rel="noopener noreferrer">${esc(ctx.url)}</a></dd></div>
          <div><dt>取得経路</dt><dd>${esc(ctx.fetchedVia)} / JavaScript未実行</dd></div>
          <div><dt>HTMLサイズ</dt><dd>${Math.round(ctx.htmlBytes / 1024).toLocaleString()} KB</dd></div>
          <div><dt>抽出できた本文</dt><dd>${ctx.textLength.toLocaleString()} 文字</dd></div>
        </dl>
      </div>
    </div>`;
  s.querySelector('.score-arc-wrap').prepend(scoreArc(scored.total, gr.tone));
  return s;
}

function categorySection(scored) {
  const s = section(
    'BREAKDOWN',
    'カテゴリ別スコア',
    'カテゴリの重みは、2026年の実証データにおける「AI可視性への寄与の大きさ」で配分しています。棒の長さがスコア、右のチップが判定です。',
  );
  s.append(
    hBars(
      scored.cats.map((c) => ({
        name: c.name,
        meta: `重み ${c.weight}`,
        value: c.pct === null ? 0 : Math.round(c.pct),
        tone: c.pct === null ? 'muted' : toneOfPct(c.pct),
        statusLabel: c.pct === null ? '対象外' : labelOfPct(c.pct),
        statusIcon: c.pct === null ? '—' : iconOfPct(c.pct),
        sub: c.lead,
      })),
      { max: 100, unit: '点' },
    ),
  );
  s.append(
    tableView(
      ['カテゴリ', 'スコア', '重み', '判定', '対象外の項目'],
      scored.cats.map((c) => [c.name, c.pct === null ? '—' : `${Math.round(c.pct)}点`, `${c.weight}`, c.pct === null ? '—' : labelOfPct(c.pct), `${c.skipped}件`]),
      'カテゴリ別スコア一覧',
    ),
  );
  return s;
}

function aiViewSection(ctx) {
  const s = section(
    'WHAT AI SEES',
    'AIクローラーが見ているページ',
    'JavaScriptを実行せずに取得したHTMLから抽出した本文です。<strong>ChatGPT・Perplexity・Claude などに実際に渡っているのは、原則としてこの範囲だけ</strong>です。ここに無い情報は、画面に表示されていてもAIには存在しません。',
  );
  const preview = ctx.text.slice(0, 1800);
  const box = document.createElement('div');
  box.className = 'ai-view';
  box.innerHTML = `
    <div class="ai-view-bar">
      <span>抽出 ${ctx.textLength.toLocaleString()}文字${ctx.textLength > 1800 ? ' / 先頭1,800文字を表示' : ''}</span>
      <span>見出し ${ctx.headings.length}個 / 段落 ${ctx.paragraphs.count}個 / 表 ${ctx.blocks.tables}個</span>
    </div>
    <pre class="ai-view-body">${esc(preview) || '(本文テキストを抽出できませんでした。クライアント側レンダリングに完全依存している可能性があります)'}</pre>
    <div class="ai-view-heads">
      <h3>抽出された見出し構造</h3>
      ${
        ctx.headings.length
          ? `<ul class="head-tree">${ctx.headings
              .slice(0, 24)
              .map((h) => `<li class="lv${h.level}"><span class="lv-tag">h${h.level}</span>${esc(h.text.slice(0, 90))}</li>`)
              .join('')}</ul>${ctx.headings.length > 24 ? `<p class="muted">ほか ${ctx.headings.length - 24}件</p>` : ''}`
          : '<p class="muted">見出しが1つも抽出できませんでした。</p>'
      }
    </div>`;
  s.append(box);
  return s;
}

function actionSection(scored) {
  const s = section(
    'ACTION PLAN',
    '対策すべき内容(優先度順)',
    'P0=即着手 / P1=3か月以内 / P2=6か月〜。同じ優先度の中では「スコアの失点が大きい順」に並べています。各項目は根拠となる2026年の出典に紐づいています。',
  );
  if (!scored.actions.length) {
    s.insertAdjacentHTML('beforeend', '<p class="empty-state">◎ 減点対象の項目はありません。オンサイトはこの診断の範囲では最適化済みです。次はオフサイト自己診断へ進んでください。</p>');
    return s;
  }
  ['P0', 'P1', 'P2'].forEach((ph) => {
    const list = scored.actions.filter((a) => a.phase === ph);
    if (!list.length) return;
    const g = document.createElement('div');
    g.className = 'action-group';
    g.innerHTML = `<h3 class="action-phase phase-${ph}">${PHASE_LABEL[ph]}<span class="count">${list.length}件</span></h3>`;
    list.forEach((r, i) => {
      const st = STATUS[r.status];
      const item = document.createElement('article');
      item.className = 'action';
      item.innerHTML = `
        <div class="action-head">
          <span class="action-no">${String(i + 1).padStart(2, '0')}</span>
          <div>
            <h4>${esc(r.title)}</h4>
            <p class="action-detail">${esc(r.detail)}</p>
          </div>
          <span class="chip tone-${st.tone}"><i class="chip-icon">${st.icon}</i>${st.label}</span>
        </div>
        <dl class="action-attrs">
          <div><dt>カテゴリ</dt><dd>${esc(CATEGORIES.find((c) => c.id === r.cat).name)}</dd></div>
          <div><dt>インパクト</dt><dd>${esc(r.impact)}</dd></div>
          <div><dt>想定工数</dt><dd>${esc(r.effort)}</dd></div>
          <div><dt>スコア影響</dt><dd>▲${r.lost.toFixed(1)}点</dd></div>
        </dl>
        <p class="action-why"><span class="why-tag">WHY</span>${esc(r.why)}</p>
        <p class="action-fix"><span class="fix-tag">HOW</span>${esc(r.fix)}</p>
        <div class="src-row">${srcChips(r.src)}</div>`;
      g.append(item);
    });
    s.append(g);
  });
  return s;
}

function detailSection(scored) {
  const s = section('ALL CHECKS', '全チェック項目の結果', `${scored.results.length}項目すべての判定です。「対象外」はこのページ種別に該当しないためスコアの分母から除外しています。`);
  scored.cats.forEach((cat) => {
    const d = document.createElement('details');
    d.className = 'cat-details';
    const pass = cat.rules.filter((r) => r.status === 'pass').length;
    d.innerHTML = `
      <summary>
        <span class="cat-name">${esc(cat.name)}</span>
        <span class="cat-score tone-${cat.pct === null ? 'muted' : toneOfPct(cat.pct)}">${cat.pct === null ? '—' : `${Math.round(cat.pct)}点`}</span>
        <span class="cat-count muted">${pass}/${cat.rules.length} 良好</span>
      </summary>
      <p class="cat-lead">${esc(cat.lead)}</p>
      <div class="src-row">${srcChips(cat.src)}</div>
      <ul class="check-list">
        ${cat.rules
          .map((r) => {
            const st = STATUS[r.status];
            return `<li class="check tone-${st.tone}">
              <div class="check-head">
                <span class="check-icon chip-icon">${st.icon}</span>
                <span class="check-title">${esc(r.title)}</span>
                <span class="check-weight muted">重み ${r.weight}</span>
              </div>
              <p class="check-detail">${esc(r.detail)}</p>
              ${r.status === 'pass' || r.status === 'skip' ? '' : `<p class="check-fix">${esc(r.fix)}</p>`}
              <div class="src-row">${srcChips(r.src)}</div>
            </li>`;
          })
          .join('')}
      </ul>`;
    s.append(d);
  });
  return s;
}

function botSection(ctx) {
  const s = section(
    'CRAWLER ACCESS',
    'AIクローラーのアクセス許可状況',
    'ChatGPT・Copilot は Bing、Claude は Brave、Gemini・AI Overviews は Google を索引に使います。<strong>「検索・回答生成に使われるボット」と「学習用ボット」は分けて判断</strong>してください(学習を拒否しつつ検索は許可する設計が可能です)。',
  );
  if (!ctx.robots.found) {
    s.insertAdjacentHTML('beforeend', '<p class="empty-state">robots.txt を取得できませんでした。存在しない場合はすべてのクローラーが暗黙的に許可されます。取得経路が制限されている可能性もあるため、ブラウザで直接 <code>/robots.txt</code> を確認してください。</p>');
    return s;
  }
  const rows = ctx.robots.bots.map((b) => {
    const blocked = b.state === 'blocked';
    const tone = blocked ? 'critical' : b.sitewide ? 'warning' : 'good';
    const lab = blocked ? 'このURLはブロック' : b.sitewide ? 'サイト全体で拒否' : '許可';
    const icon = blocked ? '✕' : b.sitewide ? '△' : '◎';
    return `<tr>
      <th scope="row">${esc(b.name)}${b.critical ? '<span class="crit-tag">検索経路</span>' : ''}</th>
      <td>${esc(b.vendor)}</td><td>${esc(b.role)}</td>
      <td><span class="chip tone-${tone}"><i class="chip-icon">${icon}</i>${lab}</span></td>
      <td class="muted">${esc(b.by)}${b.matched ? ` / 一致: <code>${esc(b.matched)}</code>` : ''}${b.disallowCount ? ` / Disallow ${b.disallowCount}件` : ''}</td>
    </tr>`;
  });
  s.insertAdjacentHTML(
    'beforeend',
    `<div class="table-scroll"><table class="bot-table">
      <thead><tr><th scope="col">ボット</th><th scope="col">提供元</th><th scope="col">用途</th><th scope="col">このURLの判定</th><th scope="col">適用ルール</th></tr></thead>
      <tbody>${rows.join('')}</tbody></table></div>
    ${ctx.robots.sitemaps.length ? `<p class="muted" style="margin-top:10px">robots.txt 内の Sitemap 宣言: ${ctx.robots.sitemaps.slice(0, 5).map((x) => `<code>${esc(x)}</code>`).join(' ')}</p>` : ''}`,
  );
  return s;
}

function infoSection(scored) {
  const s = section('NOT SCORED', '参考情報(スコアに加点しない項目)', '「やっても効かないことが2026年の実証で分かっている施策」を、加点対象から明示的に外しています。優先順位を誤らないための項目です。');
  scored.infos.forEach((i) => {
    const tone = i.level === 'warn' ? 'warning' : i.level === 'ok' ? 'good' : 'muted';
    s.insertAdjacentHTML(
      'beforeend',
      `<div class="info-item tone-${tone}"><h3>${esc(i.title)}</h3><p>${esc(i.detail)}</p><div class="src-row">${srcChips(i.src)}</div></div>`,
    );
  });
  return s;
}

/* ══════════ サイト診断(複数ページ) ══════════ */

/**
 * @param {HTMLElement} root
 * @param {{ctx:object, scored:object, why?:string[]}[]} pages  1件目が起点
 * @param {{failed?:{url:string,reason:string}[], candidateCount?:number}} meta
 */
export function renderSiteReport(root, pages, meta = {}) {
  root.innerHTML = '';
  const ok = pages.filter((p) => p && p.scored);
  if (!ok.length) {
    root.innerHTML = '<p class="empty-state">診断できたページがありません。</p>';
    return;
  }
  const avg = Math.round(ok.reduce((s, p) => s + p.scored.total, 0) / ok.length);
  const gr = gradeLike(avg);

  /* サイト総合 */
  const head = document.createElement('section');
  head.className = 'card score-card';
  const worstPage = [...ok].sort((a, b) => a.scored.total - b.scored.total)[0];
  head.innerHTML = `
    <div class="score-main">
      <div class="score-arc-wrap">
        <div class="score-hero"><span class="score-num">${avg}</span><span class="score-den">/ 100</span></div>
      </div>
      <div class="score-meta">
        <p class="eyebrow">SITE AVERAGE — ${ok.length} PAGES</p>
        <p class="score-grade tone-${gr.tone}"><span class="grade-badge">${esc(gr.label)}</span> ${esc(gr.text)}</p>
        <p class="score-summary">${esc(new URL(ok[0].ctx.url).hostname)} の ${ok.length}ページを診断しました。最も低いのは <a href="${esc(worstPage.ctx.url)}" target="_blank" rel="noopener noreferrer">${esc(pathOf(worstPage.ctx.url))}</a>(${worstPage.scored.total}点)です。テンプレートごとに代表ページを選んでいるため、<strong>同じテンプレートの他ページも同じ課題を抱えている</strong>と考えてください。</p>
        <dl class="score-facts">
          <div><dt>対象サイト</dt><dd>${esc(new URL(ok[0].ctx.url).origin)}</dd></div>
          <div><dt>診断ページ数</dt><dd>${ok.length}ページ${meta.failed && meta.failed.length ? ` / 取得失敗 ${meta.failed.length}件` : ''}</dd></div>
          <div><dt>スコア範囲</dt><dd>${Math.min(...ok.map((p) => p.scored.total))} 〜 ${Math.max(...ok.map((p) => p.scored.total))}点</dd></div>
          <div><dt>テンプレート数</dt><dd>${new Set(ok.map((p) => templateOf(new URL(p.ctx.url).pathname))).size}種</dd></div>
        </dl>
      </div>
    </div>`;
  head.querySelector('.score-arc-wrap').prepend(scoreArc(avg, gr.tone));
  root.append(head);

  /* カテゴリ平均 */
  const catSec = section('SITE BREAKDOWN', 'カテゴリ別のサイト平均', '各ページのカテゴリスコアの平均です。ページごとのばらつきが大きい場合は、テンプレート単位で実装差があることを示します。');
  catSec.append(
    hBars(
      CATEGORIES.map((cat) => {
        const vals = ok.map((p) => p.scored.cats.find((c) => c.id === cat.id)).filter((c) => c && c.pct !== null);
        const pct = vals.length ? Math.round(vals.reduce((s, c) => s + c.pct, 0) / vals.length) : null;
        const min = vals.length ? Math.round(Math.min(...vals.map((c) => c.pct))) : null;
        const max = vals.length ? Math.round(Math.max(...vals.map((c) => c.pct))) : null;
        return {
          name: cat.name,
          meta: `重み ${cat.weight}`,
          value: pct === null ? 0 : pct,
          tone: pct === null ? 'muted' : toneOfPct(pct),
          statusLabel: pct === null ? '対象外' : labelOfPct(pct),
          statusIcon: pct === null ? '—' : iconOfPct(pct),
          sub: pct === null ? '全ページで対象外' : `ページ間のばらつき ${min}〜${max}点`,
        };
      }),
      { max: 100, unit: '点' },
    ),
  );
  root.append(catSec);

  /* 共通課題 */
  const issueSec = section(
    'COMMON ISSUES',
    'サイト全体に共通する課題',
    '複数ページで同時に落ちている項目です。<strong>共通テンプレートの修正1回で全ページ分の効果が出る</strong>ため、ここが投資効率の最も高い領域になります。',
  );
  const byRule = new Map();
  ok.forEach((p) => {
    p.scored.results.forEach((r) => {
      if (r.skip || r.score >= 0.85) return;
      if (!byRule.has(r.id)) byRule.set(r.id, { rule: r, pages: [], lost: 0 });
      const e = byRule.get(r.id);
      e.pages.push(pathOf(p.ctx.url));
      e.lost += r.lost;
    });
  });
  const issues = Array.from(byRule.values()).sort((a, b) => b.pages.length - a.pages.length || b.lost - a.lost);
  const common = issues.filter((i) => i.pages.length >= Math.max(2, Math.ceil(ok.length * 0.5)));
  const partial = issues.filter((i) => !common.includes(i));
  issueSec.insertAdjacentHTML(
    'beforeend',
    `<h3 class="action-phase phase-P0">全体的な課題(${ok.length}ページ中 半数以上)<span class="count">${common.length}件</span></h3>
     ${
       common.length
         ? `<ul class="issue-list">${common
             .map(
               (i) =>
                 `<li><span class="count-tag">${i.pages.length}/${ok.length}</span><span><strong>${esc(i.rule.title)}</strong>(${esc(i.rule.phase)} / ${esc(CATEGORIES.find((c) => c.id === i.rule.cat).name)})<br><span class="muted">${esc(i.rule.fix)}</span></span></li>`,
             )
             .join('')}</ul>`
         : '<p class="empty-state">半数以上のページで共通して落ちている項目はありません。</p>'
     }
     ${
       partial.length
         ? `<h3 class="action-phase" style="margin-top:20px">一部ページのみの課題<span class="count">${partial.length}件</span></h3>
            <ul class="issue-list">${partial
              .slice(0, 14)
              .map(
                (i) =>
                  `<li><span class="count-tag">${i.pages.length}/${ok.length}</span><span><strong>${esc(i.rule.title)}</strong><br><span class="muted">${esc(i.pages.slice(0, 4).join(' , '))}${i.pages.length > 4 ? ' ほか' : ''}</span></span></li>`,
              )
              .join('')}</ul>`
         : ''
     }`,
  );
  root.append(issueSec);

  /* ページ別 */
  const pageSec = section('PAGES', 'ページ別スコア', '各行を開くとそのページのカテゴリ別スコアと未達項目が見られます。個別に詳しく見る場合は「単独で診断」から1ページ診断を実行してください。');
  const rows = document.createElement('div');
  rows.className = 'page-rows';
  [...ok]
    .sort((a, b) => a.scored.total - b.scored.total)
    .forEach((p) => {
      const d = document.createElement('details');
      d.className = 'page-row';
      const t = p.scored.total;
      const notPass = p.scored.results.filter((r) => !r.skip && r.score < 0.85);
      // 起点と同じ title・ほぼ同じ本文量なら、実質同一コンテンツの別URL(重複)である
      const dupOfTop =
        p !== ok[0] && p.ctx.meta.title && p.ctx.meta.title === ok[0].ctx.meta.title && Math.abs(p.ctx.textLength - ok[0].ctx.textLength) < Math.max(80, ok[0].ctx.textLength * 0.05);
      d.innerHTML = `
        <summary>
          <span class="page-score tone-${toneOfPct(t)}">${t}</span>
          <span class="chip tone-${toneOfPct(t)}"><i class="chip-icon">${iconOfPct(t)}</i>${labelOfPct(t)}</span>
          <span class="page-path">${esc(pathOf(p.ctx.url))}</span>
          ${dupOfTop ? '<span class="chip tone-warning"><i class="chip-icon">△</i>起点と実質同一</span>' : ''}
          <span class="page-title muted">${esc((p.ctx.meta.title || '(titleなし)').slice(0, 80))}${p.why && p.why.length ? ` — 選定理由: ${esc(p.why.join(' / '))}` : ''}</span>
        </summary>
        <div class="page-body">
          <div class="mini-cats">
            ${p.scored.cats.map((c) => `<span class="mini-cat">${esc(c.name.replace(/\(.+?\)/, ''))}<b>${c.pct === null ? '—' : Math.round(c.pct)}</b></span>`).join('')}
          </div>
          <ul class="issue-list">
            ${notPass
              .slice(0, 8)
              .map((r) => `<li><span class="count-tag">${esc(r.phase)}</span><span><strong>${esc(r.title)}</strong><br><span class="muted">${esc(r.detail)}</span></span></li>`)
              .join('') || '<li class="muted">未達項目はありません。</li>'}
            ${notPass.length > 8 ? `<li class="muted">ほか ${notPass.length - 8}件</li>` : ''}
          </ul>
          <p style="margin:12px 0 0"><a class="btn btn-ghost btn-sm" href="?url=${encodeURIComponent(p.ctx.url)}">このページを単独で診断</a>
          <a class="btn btn-ghost btn-sm" href="${esc(p.ctx.url)}" target="_blank" rel="noopener noreferrer">ページを開く</a></p>
        </div>`;
      rows.append(d);
    });
  pageSec.append(rows);
  pageSec.append(
    tableView(
      ['ページ', 'スコア', '評価', '本文文字数', '構造化データ'],
      [...ok]
        .sort((a, b) => a.scored.total - b.scored.total)
        .map((p) => [pathOf(p.ctx.url), `${p.scored.total}点`, p.scored.grade.label, `${p.ctx.textLength.toLocaleString()}文字`, p.ctx.schema.types.join(', ') || 'なし']),
      'ページ別スコア一覧',
    ),
  );
  root.append(pageSec);

  /* 起点ページの詳細 */
  const topSec = section('ENTRY PAGE DETAIL', '起点ページの詳細', `${esc(pathOf(ok[0].ctx.url))} の詳細です。AIクローラーの視点・クローラー許可状況はサイト共通の判断材料になります。`);
  root.append(topSec);
  root.append(aiViewSection(ok[0].ctx));
  root.append(botSection(ok[0].ctx));
  root.append(infoSection(ok[0].scored));

  if (meta.failed && meta.failed.length) {
    root.insertAdjacentHTML(
      'beforeend',
      `<section class="card"><p class="eyebrow">SKIPPED</p><h2 class="card-title">取得できなかったページ</h2>
       <ul class="issue-list">${meta.failed.map((f) => `<li><span class="count-tag">失敗</span><span>${esc(f.url)}<br><span class="muted">${esc(f.reason)}</span></span></li>`).join('')}</ul></section>`,
    );
  }
}

function pathOf(u) {
  try {
    const url = new URL(u);
    return (url.pathname + url.search) || '/';
  } catch {
    return u;
  }
}

function gradeLike(n) {
  if (n >= 90) return { label: 'A+', tone: 'good', text: '2026年基準で優秀' };
  if (n >= 80) return { label: 'A', tone: 'good', text: '良好・伸ばす段階' };
  if (n >= 70) return { label: 'B', tone: 'warning', text: '基礎は成立・改善余地大' };
  if (n >= 55) return { label: 'C', tone: 'warning', text: '要改善' };
  if (n >= 40) return { label: 'D', tone: 'serious', text: '構造的な課題あり' };
  return { label: 'E', tone: 'critical', text: 'AIから見えていない可能性が高い' };
}

/* ── エクスポート ─────────────────────────── */
export function toMarkdown(ctx, scored) {
  const L = [];
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ');
  L.push('# AI可視性診断レポート', '');
  L.push(`- 対象URL: ${ctx.url}`);
  L.push(`- 診断日時: ${now}`);
  L.push(`- 取得経路: ${ctx.fetchedVia}(JavaScript未実行 = AIクローラー視点)`);
  L.push(`- 総合スコア: **${scored.total} / 100(${scored.grade.label} — ${scored.grade.text})**`, '');
  L.push('## カテゴリ別スコア', '', '| カテゴリ | スコア | 重み | 判定 |', '|---|---|---|---|');
  scored.cats.forEach((c) => L.push(`| ${c.name} | ${c.pct === null ? '—' : Math.round(c.pct)} | ${c.weight} | ${c.pct === null ? '対象外' : labelOfPct(c.pct)} |`));
  L.push('', '## 対策すべき内容(優先度順)', '');
  ['P0', 'P1', 'P2'].forEach((ph) => {
    const list = scored.actions.filter((a) => a.phase === ph);
    if (!list.length) return;
    L.push(`### ${PHASE_LABEL[ph]}`, '');
    list.forEach((r, i) => {
      L.push(`${i + 1}. **${r.title}**(インパクト ${r.impact} / 工数 ${r.effort} / 失点 ▲${r.lost.toFixed(1)})`);
      L.push(`   - 現状: ${r.detail}`);
      L.push(`   - 打ち手: ${r.fix}`);
      L.push(`   - 根拠: ${r.why}`);
      r.src.forEach((k) => SOURCES[k] && L.push(`   - 出典: ${SOURCES[k].origin} — ${SOURCES[k].url}`));
    });
    L.push('');
  });
  L.push('## 全チェック項目', '');
  scored.cats.forEach((cat) => {
    L.push(`### ${cat.name}(${cat.pct === null ? '—' : Math.round(cat.pct)}点)`, '');
    cat.rules.forEach((r) => L.push(`- ${STATUS[r.status].icon} **${r.title}** — ${r.detail}`));
    L.push('');
  });
  L.push('## 参考情報(加点対象外)', '');
  scored.infos.forEach((i) => L.push(`- **${i.title}**: ${i.detail}`));
  L.push('', '---', '', '本レポートの判定基準はすべて2026年公開の一次情報・実証データに紐づいています。オフサイト(第三者言及)はURL単体では測定できないため、別途オフサイト自己診断を実施してください。');
  return L.join('\n');
}

export function siteToMarkdown(pages, meta = {}) {
  const ok = pages.filter((p) => p && p.scored);
  const avg = Math.round(ok.reduce((s, p) => s + p.scored.total, 0) / ok.length);
  const L = [];
  L.push('# AI可視性診断レポート(サイト単位)', '');
  L.push(`- 対象サイト: ${new URL(ok[0].ctx.url).origin}`);
  L.push(`- 診断日時: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
  L.push(`- 診断ページ数: ${ok.length}${meta.failed && meta.failed.length ? `(取得失敗 ${meta.failed.length})` : ''}`);
  L.push(`- サイト平均スコア: **${avg} / 100(${gradeLike(avg).label})**`, '');
  L.push('## カテゴリ別のサイト平均', '', '| カテゴリ | 平均 | 最小 | 最大 | 重み |', '|---|---|---|---|---|');
  CATEGORIES.forEach((cat) => {
    const vals = ok.map((p) => p.scored.cats.find((c) => c.id === cat.id)).filter((c) => c && c.pct !== null);
    if (!vals.length) {
      L.push(`| ${cat.name} | — | — | — | ${cat.weight} |`);
      return;
    }
    const arr = vals.map((c) => Math.round(c.pct));
    L.push(`| ${cat.name} | ${Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)} | ${Math.min(...arr)} | ${Math.max(...arr)} | ${cat.weight} |`);
  });
  L.push('', '## ページ別スコア', '', '| ページ | スコア | 評価 | 本文文字数 |', '|---|---|---|---|');
  [...ok]
    .sort((a, b) => a.scored.total - b.scored.total)
    .forEach((p) => L.push(`| ${pathOf(p.ctx.url)} | ${p.scored.total} | ${p.scored.grade.label} | ${p.ctx.textLength.toLocaleString()} |`));

  const byRule = new Map();
  ok.forEach((p) =>
    p.scored.results.forEach((r) => {
      if (r.skip || r.score >= 0.85) return;
      if (!byRule.has(r.id)) byRule.set(r.id, { rule: r, pages: [] });
      byRule.get(r.id).pages.push(pathOf(p.ctx.url));
    }),
  );
  const issues = Array.from(byRule.values()).sort((a, b) => b.pages.length - a.pages.length);
  L.push('', '## サイト全体に共通する課題', '');
  issues.forEach((i) => {
    L.push(`### ${i.rule.title}(${i.pages.length}/${ok.length}ページ / ${i.rule.phase})`);
    L.push(`- 打ち手: ${i.rule.fix}`);
    L.push(`- 根拠: ${i.rule.why}`);
    L.push(`- 該当ページ: ${i.pages.join(' , ')}`);
    i.rule.src.forEach((k) => SOURCES[k] && L.push(`- 出典: ${SOURCES[k].origin} — ${SOURCES[k].url}`));
    L.push('');
  });
  L.push('---', '', '共通テンプレート由来の課題は1回の修正で全ページに効きます。該当ページ数の多い項目から着手してください。');
  return L.join('\n');
}

export function toJson(ctx, scored) {
  return JSON.stringify(
    {
      url: ctx.url,
      analyzedAt: new Date().toISOString(),
      fetchedVia: ctx.fetchedVia,
      total: scored.total,
      grade: scored.grade,
      categories: scored.cats.map((c) => ({ id: c.id, name: c.name, weight: c.weight, score: c.pct === null ? null : Math.round(c.pct) })),
      checks: scored.results.map((r) => ({ id: r.id, cat: r.cat, title: r.title, status: r.status, score: r.skip ? null : Number(r.score.toFixed(3)), weight: r.weight, detail: r.detail, fix: r.fix, phase: r.phase, sources: r.src })),
      info: scored.infos.map((i) => ({ id: i.id, title: i.title, level: i.level, detail: i.detail })),
      facts: {
        textLength: ctx.textLength,
        textRatio: Number(ctx.textRatio.toFixed(4)),
        headings: ctx.headings.length,
        schemaTypes: ctx.schema.types,
        schemaOnlyMissing: ctx.schema.schemaOnlyMissing,
        aiBots: ctx.robots.found ? ctx.robots.bots.map((b) => ({ name: b.name, state: b.state, sitewideBlocked: !!b.sitewide, critical: !!b.critical })) : null,
        llmsTxt: ctx.llms.found,
      },
    },
    null,
    2,
  );
}

export function siteToJson(pages, meta = {}) {
  const ok = pages.filter((p) => p && p.scored);
  return JSON.stringify(
    {
      site: new URL(ok[0].ctx.url).origin,
      analyzedAt: new Date().toISOString(),
      pageCount: ok.length,
      average: Math.round(ok.reduce((s, p) => s + p.scored.total, 0) / ok.length),
      failed: meta.failed || [],
      pages: ok.map((p) => ({
        url: p.ctx.url,
        template: templateOf(new URL(p.ctx.url).pathname),
        selectedBecause: p.why || ['起点'],
        total: p.scored.total,
        grade: p.scored.grade.label,
        categories: p.scored.cats.map((c) => ({ id: c.id, score: c.pct === null ? null : Math.round(c.pct) })),
        failing: p.scored.results.filter((r) => !r.skip && r.score < 0.85).map((r) => ({ id: r.id, title: r.title, phase: r.phase, detail: r.detail })),
      })),
    },
    null,
    2,
  );
}

export function download(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
