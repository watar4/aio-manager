/**
 * プロンプト設計(CEP)+ AI可視性トラッカー
 *
 * 出典:
 * - Semrush(2026-06-18): CEP(Problem State / Uncertainty / Trigger Moment)をAI検索戦略の起点に据える。
 *   1つのCEPから複数のプロンプト表現が生まれ、AIは表現が数十通り違っても同じ記事を引用し続けた。
 * - BrightonSEO 2026 / Dr Pete Meyers: シード2〜4語 → 10〜12ワードのプロンプトへ拡張 → クラスタ分析。
 * - SMX Advanced 2026 / Eli Goodman: AI経由トラフィックは失われたクリックを代替しない。可視性を中心指標に。
 * - BrightonSEO 2026 / Cosmin Negrescu: プロンプトボリューム推定値は監査不可能。絶対値ではなく推移と競合比で見る。
 * - Goodfirms 2026: AI引用の可視性を能動的に追跡しているマーケターは14%のみ。
 */
import { boot, store, toast } from './common.js';
import { AI_ENGINES } from './data-sources.js';
import { lineChart, legend, tableView, SERIES_COLORS } from './charts.js';
import { esc, download } from './report.js';

boot();
const $ = (s) => document.querySelector(s);
const KEY = 'aio.prompts.v1';

const PRESETS = {
  regional: {
    name: 'EC・地域産品/お取り寄せ',
    what: ['地域の食品', 'お取り寄せスイーツ', '海産物・干物', '地酒・クラフトビール', '鉄道グッズ'],
    who: ['30〜40代の帰省者', '50〜60代の女性', '共働きの子育て世帯', '鉄道好きの親子', '職場でお礼を配る人'],
    when: ['お盆・年末年始の帰省', 'お中元・お歳暮の時期', '週末の家飲み', '夏休みの旅行前', '母の日・父の日'],
    why: ['実家への手土産を探している', '目上の人への贈り物にしたい', '家族で少し贅沢したい', '子どもへのプレゼントにしたい', '冷凍で日持ちするものがいい'],
  },
  saas: {
    name: 'BtoB SaaS',
    what: ['MAツール', 'CDP', 'BIダッシュボード', '問い合わせ管理ツール'],
    who: ['従業員300名規模の事業会社', '情報システム部門の担当者', 'マーケティング責任者', '一人情シス'],
    when: ['来期の予算計上前', '既存ツールの契約更新前', '基幹システム刷新と同時期'],
    why: ['既存ツールが使いこなせていない', '部門ごとにデータが分断している', '手作業のレポート作成をやめたい', 'セキュリティ要件を満たす必要がある'],
  },
  local: {
    name: '実店舗・サービス業',
    what: ['歯科クリニック', '美容室', '車の板金修理', '英会話教室'],
    who: ['小さな子どもがいる親', '転居してきたばかりの人', '平日夜しか動けない会社員', '高齢の親を連れて行く人'],
    when: ['引っ越した直後', '土日しか時間が取れないとき', '急に痛みが出たとき'],
    why: ['駐車場があるところがいい', '土曜も診てほしい', '料金を事前に知りたい', '初めてで不安がある'],
  },
  media: {
    name: 'メディア・情報サイト',
    what: ['確定申告のやり方', '住宅ローンの選び方', '子どもの習い事の選び方'],
    who: ['初めて申告する個人事業主', '共働きで世帯年収800万円の夫婦', '小学生の保護者'],
    when: ['申告期限の1か月前', '物件を内見した直後', '新学期が始まる前'],
    why: ['何から手を付けるべきか分からない', '損をしていないか確認したい', '費用の相場を知りたい'],
  },
};

/** 空の文脈要素は助詞ごと省くため、パーツを組み立ててから連結する */
const TEMPLATES = [
  (c) => [c.who && `${c.who}が`, c.when && `${c.when}に`, `${c.what}を探しています。`, c.why && `${c.why}という条件だと、`, 'どれがおすすめですか?'].filter(Boolean).join(''),
  (c) =>
    c.who
      ? [c.why, c.who, `に向いている${c.what}を、選ぶ基準ごとに比較して`].filter(Boolean).join('')
      : [c.why && `${c.why}場合に`, `適した${c.what}を、選ぶ基準ごとに比較して`].filter(Boolean).join(''),
  (c) => [c.when && `${c.when}に`, `${c.what}を用意したいです。`, c.why && `${c.why}場合、`, '候補を3つ、理由つきで挙げて'].filter(Boolean).join(''),
  (c) => [`${c.what}を選ぶとき、`, c.who && `${c.who}は`, '何を基準にすべきですか?', c.why && `${c.why}という前提で教えて`].filter(Boolean).join(''),
  (c) => [c.when && `${c.when}向けの`, `${c.what}で、`, c.who && `${c.who}に`, '評判がいいものはどれ?'].filter(Boolean).join(''),
  (c) => [c.why && `${c.why}のですが、`, `${c.what}はどう選べばいいですか。判断材料も教えて`].filter(Boolean).join(''),
];

const state = store.get(KEY, { brand: '', competitors: '', prompts: [], rounds: [] });
let generated = [];

/* ── プリセット ─────────────────────────── */
function fillPreset(key) {
  const p = PRESETS[key];
  if (!p) return;
  $('#in-what').value = p.what.join('\n');
  $('#in-who').value = p.who.join('\n');
  $('#in-when').value = p.when.join('\n');
  $('#in-why').value = p.why.join('\n');
}
$('#preset').addEventListener('change', (e) => fillPreset(e.target.value));
fillPreset('regional');
$('#in-brand').value = state.brand || '';
$('#in-competitors').value = state.competitors || '';

const lines = (id) =>
  $(id)
    .value.split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

/* 決定的な擬似乱数(再現性のため) */
function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

$('#gen-form').addEventListener('submit', (ev) => {
  ev.preventDefault();
  const what = lines('#in-what');
  const who = lines('#in-who');
  const when = lines('#in-when');
  const why = lines('#in-why');
  if (!what.length) {
    toast('コア変数(What)は1行以上入力してください', 'critical');
    return;
  }
  const limit = Number($('#gen-limit').value) || 50;
  const rnd = mulberry(what.join().length * 7919 + who.length * 104729 + limit);
  const combos = [];
  what.forEach((w) => {
    (who.length ? who : ['']).forEach((h) => {
      (when.length ? when : ['']).forEach((t) => {
        (why.length ? why : ['']).forEach((y) => {
          combos.push({ what: w, who: h, when: t, why: y });
        });
      });
    });
  });
  // 組み合わせ爆発を避けつつ、What全体を必ずカバーするようサンプリング
  const byWhat = new Map();
  combos.forEach((c) => {
    if (!byWhat.has(c.what)) byWhat.set(c.what, []);
    byWhat.get(c.what).push(c);
  });
  const perWhat = Math.max(1, Math.ceil(limit / byWhat.size));
  const picked = [];
  byWhat.forEach((arr) => {
    const shuffled = arr.slice().sort(() => rnd() - 0.5);
    picked.push(...shuffled.slice(0, perWhat));
  });
  generated = picked.slice(0, limit).map((c, i) => ({
    id: `p${Date.now().toString(36)}${i}`,
    text: TEMPLATES[i % TEMPLATES.length](c).replace(/。という/g, 'という').replace(/、、/g, '、'),
    cep: c,
  }));
  state.brand = $('#in-brand').value.trim();
  state.competitors = $('#in-competitors').value.trim();
  store.set(KEY, state);
  renderGenerated();
});

function renderGenerated() {
  const box = $('#gen-results');
  if (!generated.length) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `
    <div class="bar">
      <p class="muted">${generated.length}件のプロンプトを生成しました。プロンプトボリュームの推定値は監査不可能とされているため(BrightonSEO 2026)、<strong>件数の網羅より「実際に顧客が置かれている状況を写しているか」</strong>で選別してください。</p>
      <div class="bar-actions">
        <button type="button" class="btn btn-sm" id="g-copy">全件コピー</button>
        <button type="button" class="btn btn-sm" id="g-csv">CSVで保存</button>
        <button type="button" class="btn btn-primary btn-sm" id="g-track">観測リストに登録</button>
      </div>
    </div>
    <ol class="prompt-list">
      ${generated
        .map(
          (p) => `<li>
            <label class="pick"><input type="checkbox" checked data-pick="${p.id}"><span>${esc(p.text)}</span></label>
            <div class="cep-tags">
              ${p.cep.what ? `<span class="tag">What: ${esc(p.cep.what)}</span>` : ''}
              ${p.cep.who ? `<span class="tag">Who: ${esc(p.cep.who)}</span>` : ''}
              ${p.cep.when ? `<span class="tag">When/Where: ${esc(p.cep.when)}</span>` : ''}
              ${p.cep.why ? `<span class="tag">Why: ${esc(p.cep.why)}</span>` : ''}
            </div>
            <div class="engine-links">${AI_ENGINES.map((e) => `<a class="btn btn-ghost btn-xs" href="${e.deepLink(p.text)}" target="_blank" rel="noopener noreferrer">${e.name} で試す</a>`).join('')}</div>
          </li>`,
        )
        .join('')}
    </ol>`;
  const picked = () => generated.filter((p) => box.querySelector(`[data-pick="${p.id}"]`)?.checked);
  $('#g-copy').addEventListener('click', async () => {
    await navigator.clipboard.writeText(picked().map((p) => p.text).join('\n'));
    toast(`${picked().length}件をコピーしました`);
  });
  $('#g-csv').addEventListener('click', () => {
    const rows = [['prompt', 'what', 'who', 'when_where', 'why'], ...picked().map((p) => [p.text, p.cep.what, p.cep.who, p.cep.when, p.cep.why])];
    const csv = `﻿${rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')}`;
    download(`aio-prompts_${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv;charset=utf-8');
  });
  $('#g-track').addEventListener('click', () => {
    const add = picked();
    const existing = new Set(state.prompts.map((p) => p.text));
    const fresh = add.filter((p) => !existing.has(p.text));
    state.prompts.push(...fresh);
    store.set(KEY, state);
    renderTracker();
    toast(`${fresh.length}件を観測リストに追加しました(重複 ${add.length - fresh.length}件は除外)`);
    $('#tracker').scrollIntoView({ behavior: 'smooth' });
  });
}

/* ── トラッカー ───────────────────────────── */
function renderTracker() {
  const box = $('#tracker-body');
  if (!state.prompts.length) {
    box.innerHTML = '<p class="empty-state">観測対象のプロンプトがまだありません。上のフォームで生成し「観測リストに登録」を押してください。</p>';
    $('#trend').innerHTML = '';
    return;
  }
  const rounds = state.rounds;
  box.innerHTML = `
    <div class="bar">
      <div class="bar-actions">
        <label class="field-inline">観測ラウンド
          <select id="round-select">
            ${rounds.map((r, i) => `<option value="${i}">${esc(r.label)} / ${esc(r.engine)}</option>`).join('')}
            ${rounds.length ? '' : '<option value="">(未作成)</option>'}
          </select>
        </label>
        <button type="button" class="btn btn-ghost btn-sm" id="del-round">このラウンドを削除</button>
        <button type="button" class="btn btn-ghost btn-sm" id="reset-all">観測リストを初期化</button>
      </div>
      <div class="bar-actions">
        <label class="field-inline">新規<input id="new-round-label" type="text" size="8" value="${new Date().toISOString().slice(0, 7)}" style="width:10ch"></label>
        <label class="field-inline"><select id="new-round-engine">${AI_ENGINES.map((e) => `<option value="${esc(e.name)}">${esc(e.name)}</option>`).join('')}</select></label>
        <button type="button" class="btn btn-sm" id="new-round">ラウンドを追加</button>
      </div>
    </div>
    <div id="round-area"></div>`;

  $('#new-round').addEventListener('click', () => {
    const label = $('#new-round-label').value.trim();
    const engine = $('#new-round-engine').value;
    if (!label) {
      toast('ラウンド名を入力してください(例: 2026-08)', 'critical');
      return;
    }
    if (state.rounds.some((r) => r.label === label && r.engine === engine)) {
      toast('同じラウンド名と対象AIの組み合わせが既に存在します', 'critical');
      return;
    }
    state.rounds.push({ label, engine, results: {} });
    store.set(KEY, state);
    renderTracker();
    toast(`${label} / ${engine} のラウンドを追加しました`);
  });
  $('#reset-all').addEventListener('click', () => {
    if (!confirm('観測リストと全ラウンドの記録を削除します。よろしいですか?')) return;
    state.prompts = [];
    state.rounds = [];
    store.set(KEY, state);
    renderTracker();
  });

  const sel = $('#round-select');
  const paint = () => {
    const idx = Number(sel.value);
    const round = state.rounds[idx];
    const area = $('#round-area');
    if (!round) {
      area.innerHTML = '<p class="empty-state">「ラウンドを追加」で観測回を作成してください(例: 2026-08 / ChatGPT)。同じプロンプト群を毎月同じ条件で回すことで、絶対値ではなく推移として読めるようになります。</p>';
      return;
    }
    area.innerHTML = `
      <p class="muted">${esc(round.label)} / ${esc(round.engine)} — 各プロンプトをAIに投げ、自社が挙がったかを記録します。${state.brand ? `対象ブランド: <strong>${esc(state.brand)}</strong>` : ''}</p>
      <div class="table-scroll"><table class="track-table">
        <thead><tr><th scope="col">プロンプト</th><th scope="col">言及</th><th scope="col">内容の正確性</th><th scope="col">実行</th></tr></thead>
        <tbody>${state.prompts
          .map((p) => {
            const rec = round.results[p.id] || {};
            return `<tr>
              <th scope="row" class="prompt-cell">${esc(p.text)}</th>
              <td>
                <select data-m="${p.id}">
                  <option value="" ${!rec.mention ? 'selected' : ''}>未確認</option>
                  <option value="yes" ${rec.mention === 'yes' ? 'selected' : ''}>言及あり</option>
                  <option value="no" ${rec.mention === 'no' ? 'selected' : ''}>言及なし</option>
                </select>
              </td>
              <td>
                <select data-a="${p.id}" ${rec.mention === 'yes' ? '' : 'disabled'}>
                  <option value="" ${!rec.accuracy ? 'selected' : ''}>—</option>
                  <option value="ok" ${rec.accuracy === 'ok' ? 'selected' : ''}>正確</option>
                  <option value="partial" ${rec.accuracy === 'partial' ? 'selected' : ''}>一部誤り</option>
                  <option value="wrong" ${rec.accuracy === 'wrong' ? 'selected' : ''}>誤り</option>
                </select>
              </td>
              <td>${(AI_ENGINES.find((e) => e.name === round.engine) || AI_ENGINES[0]).deepLink ? `<a class="btn btn-ghost btn-xs" href="${(AI_ENGINES.find((e) => e.name === round.engine) || AI_ENGINES[0]).deepLink(p.text)}" target="_blank" rel="noopener noreferrer">開く</a>` : ''}</td>
            </tr>`;
          })
          .join('')}</tbody>
      </table></div>`;
    area.querySelectorAll('[data-m]').forEach((s) =>
      s.addEventListener('change', () => {
        const id = s.dataset.m;
        round.results[id] = { ...(round.results[id] || {}), mention: s.value };
        if (s.value !== 'yes') delete round.results[id].accuracy;
        store.set(KEY, state);
        paint();
        renderTrend();
      }),
    );
    area.querySelectorAll('[data-a]').forEach((s) =>
      s.addEventListener('change', () => {
        const id = s.dataset.a;
        round.results[id] = { ...(round.results[id] || {}), accuracy: s.value };
        store.set(KEY, state);
        renderTrend();
      }),
    );
    $('#del-round').onclick = () => {
      if (!confirm(`${round.label} / ${round.engine} の記録を削除します。`)) return;
      state.rounds.splice(idx, 1);
      store.set(KEY, state);
      renderTracker();
    };
  };
  sel.addEventListener('change', paint);
  if (state.rounds.length) sel.value = String(state.rounds.length - 1);
  paint();
  renderTrend();
}

function roundStats(round) {
  const recs = Object.values(round.results).filter((r) => r.mention);
  const checked = recs.length;
  const yes = recs.filter((r) => r.mention === 'yes').length;
  const accurate = recs.filter((r) => r.mention === 'yes' && r.accuracy === 'ok').length;
  return {
    checked,
    mentionRate: checked ? Math.round((yes / checked) * 100) : 0,
    accurateRate: checked ? Math.round((accurate / checked) * 100) : 0,
  };
}

function renderTrend() {
  const host = $('#trend');
  const rounds = state.rounds.filter((r) => Object.keys(r.results).length);
  if (rounds.length < 1) {
    host.innerHTML = '<p class="empty-state">記録が入ると、ここに言及率の推移が表示されます。指名検索数(Search Console)と並べて見ると、AI引用がブランドリフトに効いているかを判断できます — AI引用を獲得したブランドは続く30日間で指名検索が23%増加という調査があります。</p>';
    return;
  }
  const series = [
    { name: '自社言及率', color: SERIES_COLORS.primary, points: rounds.map((r) => ({ x: r.label, y: roundStats(r).mentionRate })) },
    { name: 'うち内容が正確', color: SERIES_COLORS.secondary, points: rounds.map((r) => ({ x: r.label, y: roundStats(r).accurateRate })) },
  ];
  host.innerHTML = '<h3>言及率の推移</h3>';
  host.append(legend(series), lineChart(series, { yMax: 100, yUnit: '%' }));
  host.append(
    tableView(
      ['ラウンド', '対象AI', '確認済み件数', '言及率', '正確な言及率'],
      rounds.map((r) => {
        const s = roundStats(r);
        return [esc(r.label), esc(r.engine), `${s.checked}件`, `${s.mentionRate}%`, `${s.accurateRate}%`];
      }),
      '観測ラウンド別の言及率',
    ),
  );
}

renderTracker();
