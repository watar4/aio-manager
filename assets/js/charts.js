/**
 * チャート描画(依存ライブラリなし・素のSVG)
 *
 * 設計方針
 * - 単一の値はチャートにしない(ヒーロー数値 + 状態ラベル)。ゲージは補助の円弧のみ。
 * - カテゴリ別スコアは横棒。棒の色はスコアで塗り分けない(長さと色の二重エンコードを避ける)。
 *   判定は アイコン+ラベル のチップで別チャネルに載せる。
 * - 値ラベルは絶対配置しない(他の要素と重なるため)。ラベル行のフロー内に置く。
 * - グリッド・軸はヘアラインの実線。破線は使わない。
 * - 2系列以上には必ず凡例。すべてのチャートに表(テーブルビュー)を併設する。
 * - 文字列は必ず esc() を通して埋め込む(取得先ページの文字列がそのまま入るため)。
 */
import { esc } from './common.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => {
  const n = document.createElementNS(NS, name);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, String(v)));
  return n;
};

/** 総合スコアの円弧(値そのものは別途ヒーロー数値として表示する) */
export function scoreArc(value, tone) {
  const size = 140;
  const r = 59;
  const c = 2 * Math.PI * r;
  const svg = el('svg', { viewBox: `0 0 ${size} ${size}`, class: 'arc', 'aria-hidden': 'true' });
  svg.append(
    el('circle', { cx: size / 2, cy: size / 2, r, fill: 'none', stroke: 'var(--grid)', 'stroke-width': 9 }),
    el('circle', {
      cx: size / 2,
      cy: size / 2,
      r,
      fill: 'none',
      stroke: `var(--status-${tone})`,
      'stroke-width': 9,
      'stroke-linecap': 'round',
      'stroke-dasharray': `${(c * Math.max(value, 1)) / 100} ${c}`,
      transform: `rotate(-90 ${size / 2} ${size / 2})`,
    }),
  );
  return svg;
}

/**
 * 横棒チャート(1系列)
 * items: [{ name, meta, value, unit, tone, statusLabel, statusIcon, sub }]
 * すべてプレーンテキストで渡す(内部でエスケープする)。
 */
export function hBars(items, { max = 100, unit = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'metrics';
  items.forEach((it) => {
    const pct = Math.max(0, Math.min(100, (it.value / max) * 100));
    const row = document.createElement('div');
    row.className = 'metric';
    const valueText = it.value === null || it.value === undefined ? '—' : `${it.value}`;
    row.innerHTML = `
      <div class="metric-top">
        <span class="metric-name">${esc(it.name)}</span>
        ${it.meta ? `<span class="pill">${esc(it.meta)}</span>` : ''}
        <span class="metric-spacer"></span>
        <span class="metric-num">${esc(valueText)}${unit ? `<span class="metric-unit">${esc(unit)}</span>` : ''}</span>
        ${it.statusLabel ? `<span class="chip tone-${esc(it.tone || 'muted')}">${it.statusIcon ? `<i class="chip-icon">${esc(it.statusIcon)}</i>` : ''}${esc(it.statusLabel)}</span>` : ''}
      </div>
      <div class="metric-track" role="img" aria-label="${esc(`${it.name} ${valueText}${unit}${it.statusLabel ? ` — ${it.statusLabel}` : ''}`)}">
        <div class="metric-fill" style="width:${pct.toFixed(1)}%"></div>
      </div>
      ${it.sub ? `<p class="metric-sub">${esc(it.sub)}</p>` : ''}`;
    wrap.append(row);
  });
  return wrap;
}

/**
 * 折れ線チャート + クロスヘア + ツールチップ
 * series: [{name, color, points:[{x(label), y(number)}]}]
 */
export function lineChart(series, { yMax = 100, yUnit = '%', height = 230 } = {}) {
  const W = 760;
  const H = height;
  const pad = { t: 16, r: 20, b: 34, l: 42 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;
  const labels = series[0]?.points.map((p) => p.x) || [];
  const n = labels.length;

  const box = document.createElement('div');
  box.className = 'chart-box';

  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'line-chart', role: 'img' });
  const xAt = (i) => (n <= 1 ? pad.l + plotW / 2 : pad.l + (plotW * i) / (n - 1));
  const yAt = (v) => pad.t + plotH - (plotH * Math.max(0, Math.min(v, yMax))) / yMax;

  [0, 25, 50, 75, 100].forEach((p) => {
    const v = (yMax * p) / 100;
    const y = yAt(v);
    svg.append(el('line', { x1: pad.l, x2: W - pad.r, y1: y, y2: y, stroke: 'var(--grid)', 'stroke-width': 1 }));
    const t = el('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', class: 'axis-tick' });
    t.textContent = `${Math.round(v)}${yUnit}`;
    svg.append(t);
  });
  svg.append(el('line', { x1: pad.l, x2: W - pad.r, y1: pad.t + plotH, y2: pad.t + plotH, stroke: 'var(--axis)', 'stroke-width': 1 }));

  const step = Math.ceil(n / 8) || 1;
  labels.forEach((lab, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    const t = el('text', { x: xAt(i), y: H - 12, 'text-anchor': 'middle', class: 'axis-tick' });
    t.textContent = lab;
    svg.append(t);
  });

  series.forEach((s) => {
    if (!s.points.length) return;
    const d = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${xAt(i)},${yAt(p.y)}`).join(' ');
    svg.append(el('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    s.points.forEach((p, i) => {
      svg.append(el('circle', { cx: xAt(i), cy: yAt(p.y), r: 4, fill: 'var(--surface)', stroke: s.color, 'stroke-width': 2 }));
    });
    const last = s.points.length - 1;
    const t = el('text', { x: xAt(last) - 7, y: yAt(s.points[last].y) - 11, 'text-anchor': 'end', class: 'series-endlabel' });
    t.textContent = `${s.points[last].y}${yUnit}`;
    svg.append(t);
  });

  const cross = el('line', { y1: pad.t, y2: pad.t + plotH, stroke: 'var(--axis)', 'stroke-width': 1, opacity: 0 });
  svg.append(cross);
  const hit = el('rect', { x: pad.l, y: pad.t, width: plotW, height: plotH, fill: 'transparent', style: 'cursor:crosshair' });
  svg.append(hit);

  const tip = document.createElement('div');
  tip.className = 'chart-tip';
  tip.hidden = true;

  const show = (i, clientX) => {
    const x = xAt(i);
    cross.setAttribute('x1', x);
    cross.setAttribute('x2', x);
    cross.setAttribute('opacity', '1');
    tip.hidden = false;
    tip.innerHTML = `<strong>${esc(labels[i])}</strong>${series
      .map((s) => `<span class="tip-row"><i style="background:${esc(s.color)}"></i>${esc(s.name)} <b>${esc(String(s.points[i]?.y ?? '—'))}${esc(yUnit)}</b></span>`)
      .join('')}`;
    const rect = box.getBoundingClientRect();
    const px = clientX != null ? clientX - rect.left : (x / W) * rect.width;
    tip.style.left = `${Math.min(Math.max(px, 74), Math.max(rect.width - 74, 74))}px`;
  };
  const hide = () => {
    cross.setAttribute('opacity', '0');
    tip.hidden = true;
  };
  const nearest = (ev) => {
    const rect = svg.getBoundingClientRect();
    const rel = ((ev.clientX - rect.left) / rect.width) * W;
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < n; i += 1) {
      const d = Math.abs(xAt(i) - rel);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  };
  hit.addEventListener('pointermove', (ev) => show(nearest(ev), ev.clientX));
  hit.addEventListener('pointerleave', hide);
  svg.setAttribute('tabindex', '0');
  let focusIdx = n - 1;
  svg.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowRight') focusIdx = Math.min(n - 1, focusIdx + 1);
    else if (ev.key === 'ArrowLeft') focusIdx = Math.max(0, focusIdx - 1);
    else if (ev.key === 'Escape') {
      hide();
      return;
    } else return;
    ev.preventDefault();
    show(focusIdx);
  });
  svg.addEventListener('blur', hide);

  box.append(svg, tip);
  return box;
}

/** 凡例(2系列以上で必須) */
export function legend(series) {
  const ul = document.createElement('ul');
  ul.className = 'legend';
  series.forEach((s) => {
    const li = document.createElement('li');
    li.innerHTML = `<i style="background:${esc(s.color)}"></i>${esc(s.name)}`;
    ul.append(li);
  });
  return ul;
}

/** 表(テーブルビュー)— どのチャートにも同じ値を表で用意する。セルはプレーンテキストで渡す */
export function tableView(headers, rows, caption) {
  const details = document.createElement('details');
  details.className = 'table-view';
  details.innerHTML = `<summary>数値を表で見る</summary>
    <div class="table-scroll"><table>${caption ? `<caption>${esc(caption)}</caption>` : ''}
      <thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td>${esc(c)}</td>`)).join('')}</tr>`)
        .join('')}</tbody>
    </table></div>`;
  return details;
}

export const SERIES_COLORS = { primary: 'var(--series-1)', secondary: 'var(--series-2)' };
