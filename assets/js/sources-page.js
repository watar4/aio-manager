/** 出典・スコアリングロジックの開示ページ */
import { boot } from './common.js';
import { SOURCES, AI_BOTS } from './data-sources.js';
import { CATEGORIES, RULES, INFO_CHECKS } from './rules.js';
import { hBars, tableView } from './charts.js';
import { esc } from './report.js';

boot();
const $ = (s) => document.querySelector(s);

/* ── カテゴリ重み ─────────────────────────── */
const wHost = $('#weights');
wHost.append(
  hBars(
    CATEGORIES.map((c) => ({
      name: c.name,
      value: c.weight,
      tone: 'muted',
      statusLabel: `${RULES.filter((r) => r.cat === c.id).length}項目`,
      sub: c.lead,
    })),
    { max: 30, unit: '点' },
  ),
);
wHost.append(
  tableView(
    ['カテゴリ', '重み', '項目数', '項目重みの合計'],
    CATEGORIES.map((c) => {
      const rs = RULES.filter((r) => r.cat === c.id);
      return [c.name, `${c.weight}`, `${rs.length}`, `${rs.reduce((s, r) => s + r.weight, 0)}`];
    }),
    'カテゴリ重みの配分',
  ),
);

/* ── ルール一覧 ───────────────────────────── */
$('#rules').innerHTML = `
  <div class="table-scroll"><table class="rule-table">
    <thead><tr><th scope="col">チェック項目</th><th scope="col">カテゴリ</th><th scope="col">重み</th><th scope="col">優先度</th><th scope="col">根拠(出典)</th></tr></thead>
    <tbody>${RULES.map(
      (r) => `<tr>
      <th scope="row"><span class="rule-title">${esc(r.title)}</span><span class="rule-why">${esc(r.why)}</span></th>
      <td>${esc(CATEGORIES.find((c) => c.id === r.cat).name)}</td>
      <td class="num">${r.weight}</td>
      <td><span class="phase-tag phase-${r.phase}">${r.phase}</span></td>
      <td>${r.src
        .map((k) => SOURCES[k])
        .filter(Boolean)
        .map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.origin)}</a>`)
        .join('<br>')}</td>
    </tr>`,
    ).join('')}</tbody>
  </table></div>`;

/* ── 加点しない項目 ───────────────────────── */
$('#nonscoring').innerHTML = INFO_CHECKS.map(
  (i) => `<div class="info-item tone-muted">
    <h3>${esc(i.title)}</h3>
    <div class="src-row">${i.src
      .map((k) => SOURCES[k])
      .filter(Boolean)
      .map((s) => `<a class="src-chip" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.origin)}<span class="src-grade">${esc(s.grade)}</span></a>`)
      .join('')}</div>
    <ul>${i.src
      .map((k) => SOURCES[k])
      .filter(Boolean)
      .map((s) => `<li>${esc(s.claim)}</li>`)
      .join('')}</ul>
  </div>`,
).join('');

/* ── 出典一覧 ─────────────────────────────── */
const KIND_ORDER = ['カンファレンス発表', '統制実験', '大規模調査', '大規模実測', '大規模ログ分析', 'プラットフォーム公式', '独自調査', '実験付き業界調査', '業界調査', '学術論文'];
const byKind = new Map();
Object.entries(SOURCES).forEach(([id, s]) => {
  if (!byKind.has(s.kind)) byKind.set(s.kind, []);
  byKind.get(s.kind).push({ id, ...s });
});
const kinds = [...byKind.keys()].sort((a, b) => {
  const ia = KIND_ORDER.indexOf(a);
  const ib = KIND_ORDER.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
});
$('#sources').innerHTML = kinds
  .map(
    (kind) => `<section class="card">
      <h2 class="card-title">${esc(kind)}<span class="w">${byKind.get(kind).length}件</span></h2>
      <ul class="source-list">
        ${byKind
          .get(kind)
          .map(
            (s) => `<li>
              <div class="source-head">
                <span class="grade-tag grade-${s.grade}">${esc(s.grade)}</span>
                <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.origin)}</a>
              </div>
              <p>${esc(s.claim)}</p>
            </li>`,
          )
          .join('')}
      </ul>
    </section>`,
  )
  .join('');

/* ── AIボット一覧 ─────────────────────────── */
$('#bots').innerHTML = `
  <div class="table-scroll"><table>
    <thead><tr><th scope="col">ボット名</th><th scope="col">提供元</th><th scope="col">用途</th><th scope="col">検索・回答経路</th></tr></thead>
    <tbody>${AI_BOTS.map(
      (b) => `<tr><th scope="row"><code>${esc(b.name)}</code></th><td>${esc(b.vendor)}</td><td>${esc(b.role)}</td><td>${b.critical ? '<span class="chip tone-good"><span aria-hidden="true">◎</span>該当</span>' : '<span class="muted">学習・その他</span>'}</td></tr>`,
    ).join('')}</tbody>
  </table></div>`;
