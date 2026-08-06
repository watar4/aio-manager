/**
 * オフサイト自己診断
 *
 * URL単体では測定できない領域を、出典に紐づいた設問で自己評価する。
 * 出典の要点: AI検索におけるブランド言及の85%は第三者ソース由来(Ahrefs Evolve 2026)、
 * 75,000ブランド調査ではYouTube言及が全シグナル中で最強の相関(約0.737)。
 */
import { boot, store, toast } from './common.js';
import { SOURCES } from './data-sources.js';
import { hBars, tableView, scoreArc } from './charts.js';
import { esc, download } from './report.js';
import { gradeOf } from './rules.js';

boot();
const $ = (s) => document.querySelector(s);
const KEY = 'aio.offsite.v1';
const HISTORY_KEY = 'aio.history';

const GROUPS = [
  {
    id: 'thirdparty',
    name: '第三者による言及',
    weight: 30,
    lead: 'AI検索におけるブランド言及の85%が第三者ソース由来。LLMは「何が公式か」ではなく「何が頻繁に言及されているか」を手がかりにする。',
    src: ['evolve_85', 'ziptie_frequency'],
    items: [
      { id: 't1', q: '業界メディア・ニュースサイトへの掲載が、過去12か月で継続的に発生している', fix: '独自データ調査をPRの中核資産にする(James Norquay / Ahrefs Evolve 2026)。プレスリリースは配信だけで終わらせず、記事化まで追う。', src: ['evolve_85'] },
      { id: 't2', q: '比較サイト・まとめ記事・ランキング記事に自社が掲載されている', fix: '主要な比較・まとめ記事を洗い出し、掲載漏れは掲載依頼、誤記載は訂正依頼を出す。', src: ['semrush_thirdparty'] },
      { id: 't3', q: 'レビュー・口コミ(UGC)が継続的に増えている', fix: 'レビュー投稿導線を注文完了後の流れに組み込む。件数と評点は本文HTMLにも出力する。', src: ['brightedge_42_79'] },
      { id: 't4', q: 'Q&Aサイト・掲示板・SNS(X / note / Yahoo!知恵袋等)で自社が話題になっている', fix: 'RedditがAIモデルのデータベースとして機能しているのと同様に、日本語圏ではQ&A・note・Xが参照される。指名の言及が生まれる企画を打つ。', src: ['brighton_youtube'] },
      { id: 't5', q: '自治体・業界団体・取引先の公式サイトから言及・リンクを得ている', fix: '権威ドメインからの言及は最も置き換えが難しい資産。既存の取引関係を掲載機会に変える。', src: ['evolve_85'] },
    ],
  },
  {
    id: 'youtube',
    name: 'YouTube・動画',
    weight: 18,
    lead: '75,000ブランド調査で、YouTube上のブランド言及が全シグナル中で最強の相関(約0.737)。LLMで2番目に多く引用されるソーシャルプラットフォームでもある。',
    src: ['ahrefs_youtube', 'brighton_youtube', 'petrovic_brand'],
    items: [
      { id: 'y1', q: '自社公式のYouTubeチャンネルがあり、直近3か月に投稿がある', fix: '更新の止まったチャンネルはシグナルにならない。月1本でも継続する体制を作る。', src: ['ahrefs_youtube'] },
      { id: 'y2', q: '動画の説明欄・字幕に、ブランド名と主要な事実(産地・規格・条件)がテキストで入っている', fix: 'AIが読むのは映像ではなくテキスト。説明欄・字幕・チャプター名に事実を書く。', src: ['ahrefs_youtube'] },
      { id: 'y3', q: '第三者(レビュアー・インフルエンサー・取引先)の動画で自社が扱われている', fix: '自社チャンネル以上に第三者動画が効く。商品提供・取材協力を動画チャネルにも広げる。', src: ['petrovic_brand'] },
    ],
  },
  {
    id: 'misinfo',
    name: 'AIの認識ズレの是正',
    weight: 14,
    lead: 'AIは統計的パターンで答えを生成し、事実をライブソースに照合しない。したがって公式サイトを直すだけでは足りず、AIが参照している第三者ソース側を直す必要がある。',
    src: ['semrush_thirdparty', 'ziptie_frequency'],
    items: [
      { id: 'm1', q: '主要AI(ChatGPT / AI Mode / Perplexity)に自社について尋ね、回答内容の正確性を確認している', fix: 'プロンプト観測ページで月次の定点観測に組み込む。回答文そのものを保存して差分を追う。', src: ['semrush_thirdparty'] },
      { id: 'm2', q: 'AIが自社の事業内容・取扱ジャンル・価格帯を誤認していないか確認済み', fix: '「〇〇の会社」と誤って学習されていると、本来の主戦場のプロンプトで候補に挙がらない。実態に即した記述へ第三者側を揃える。', src: ['ziptie_frequency'] },
      { id: 'm3', q: '古い情報(旧社名・旧価格・終了サービス)を載せた外部記事に訂正依頼を出したことがある', fix: '反映には数週間〜数か月かかる。件数が多い場合は言及数の多い順に着手する。', src: ['semrush_thirdparty'] },
    ],
  },
  {
    id: 'entity',
    name: '呼称とエンティティの一貫性',
    weight: 12,
    lead: '1語のブランド名は複数語ブランドより約8倍多くAIに推奨される。表記が揺れるとシグナルが分散する。',
    src: ['petrovic_brand', 'simmons_entity'],
    items: [
      { id: 'e1', q: '短い呼称(できれば1語)を決めており、社内外で一貫して使っている', fix: '正式名称は変えなくてよい。短い呼称を1つ決め、本文・見出し・SNS・プレスリリース・第三者向け資料で統一する。', src: ['petrovic_brand'] },
      { id: 'e2', q: 'Wikipedia / Wikidata / 業界データベースに正確な情報で登録されている', fix: '外部の確立されたIDに紐づくことで、同名の別主体との混同を防げる。', src: ['simmons_entity'] },
      { id: 'e3', q: '公式SNS・外部プロフィールの説明文が、サイトの説明文と同じ表現で揃っている', fix: 'プロフィール文の表現を1つのマスターから配る運用にする。', src: ['ziptie_frequency'] },
    ],
  },
  {
    id: 'agentic',
    name: '商品フィード・エージェンティックコマース',
    weight: 14,
    lead: '2026年にGoogle UCPとOpenAI ACPが実運用段階に入った。Merchant Centerが「AIがマーチャントのオファーを解釈する一次ソース」になり、商品データ品質が業界の共通通貨として機能する。',
    src: ['ucp', 'acp', 'risley_agentic', 'nrf_agentic'],
    items: [
      { id: 'a1', q: 'Merchant Center のフィードに、GTIN等の識別子・在庫・価格が鮮度を保って同期されている', fix: 'エージェント経由の適格性は属性品質で決まる。識別子・在庫・価格鮮度・画像・タイトルを総点検する。', src: ['ucp', 'risley_agentic'] },
      { id: 'a2', q: 'Merchant Center に返品ポリシーとカスタマーサポート情報を明確に定義している', fix: 'UCP適格性の必要条件。返品ポリシーの明確な定義とサポート情報の提供が要件に含まれる。', src: ['ucp'] },
      { id: 'a3', q: '商品ID・SKUが決済側システムのIDと一致している', fix: 'UCPは商品IDと決済APIの一致を要件にしている。基幹側との突合を先に済ませる。', src: ['ucp'] },
      { id: 'a4', q: 'UCPの仕様(`native_commerce` 属性 / `/.well-known/ucp` マニフェスト / `consumer_notice`)を把握している', fix: '日本展開時に即応できるよう仕様把握だけ先行する。実装は各ECプラットフォーム側の対応方針と合わせて判断。', src: ['ucp'] },
      { id: 'a5', q: 'エージェント経由の取引を捕捉できるサーバー側の注文追跡を設計している', fix: 'UCP取引は従来のGoogle Analyticsに記録されない。サーバー側での注文データ追跡が必要になる。', src: ['ucp'] },
    ],
  },
  {
    id: 'measure',
    name: '計測・KPI体制',
    weight: 12,
    lead: 'AI経由トラフィックは失われたオーガニッククリックを代替しない。可視性を独立したKPIとして持ち、指名検索リフトと自己申告アトリビューションで補うのが2026年の標準形。追跡している企業は14%しかない。',
    src: ['goodman_no_replace', 'demandlocal_23', 'airops_selfreport', 'goodfirms_14', 'negrescu_volume'],
    items: [
      { id: 'k1', q: '想定プロンプト50〜100件を定義し、月次で自社言及率を定点観測している', fix: 'プロンプト観測ページで運用する。プロンプトボリューム推定値は監査不可能なので、絶対値ではなく自社の推移と競合比で見る。', src: ['negrescu_volume', 'goodfirms_14'] },
      { id: 'k2', q: 'GA4でAI参照元(chatgpt.com / perplexity.ai / copilot / gemini)をセグメント化している', fix: '参照元セグメントを作る。ただし流入量を主KPIに据えない — 代替は起きないという前提で設計する。', src: ['goodman_no_replace'] },
      { id: 'k3', q: '指名検索数(Search Console)をKGIとして月次で追っている', fix: 'AI引用を獲得したブランドは、直接クリックがなくても続く30日間で指名検索が23%増加という調査がある。引用獲得時期との重ね合わせで効果を読む。', src: ['demandlocal_23'] },
      { id: 'k4', q: '購入・問い合わせ後のアンケートに「AIで知った」の選択肢を用意している', fix: '自己申告アトリビューションはデジタル計測が取りこぼすチャネルの30〜50%を捕捉できる。注文完了後アンケートに1問足すだけで始められる。', src: ['airops_selfreport'] },
      { id: 'k5', q: 'AI施策の評価を「活動量」ではなく売上・成長・効率に紐づけている', fix: '生成コンテンツ数や時間短縮はAI活動量にすぎない。ビジネス成果に接続した指標へ置き換える。', src: ['virji_measure'] },
    ],
  },
];

const state = store.get(KEY, { answers: {}, updatedAt: null });

function srcChips(keys) {
  return (keys || [])
    .map((k) => SOURCES[k])
    .filter(Boolean)
    .map((s) => `<a class="src-chip" href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.claim)}">${esc(s.origin)}<span class="src-grade">${esc(s.grade)}</span></a>`)
    .join('');
}

function render() {
  const host = $('#groups');
  host.innerHTML = GROUPS.map(
    (gr) => `
    <section class="card">
      <h2 class="card-title">${esc(gr.name)}<span class="pill">重み ${gr.weight}</span></h2>
      <p class="card-lead">${esc(gr.lead)}</p>
      <div class="src-row">${srcChips(gr.src)}</div>
      <ul class="q-list">
        ${gr.items
          .map((it) => {
            const v = state.answers[it.id] ?? '';
            return `<li class="q-item" data-q="${it.id}">
              <p class="q-text">${esc(it.q)}</p>
              <div class="q-controls" role="radiogroup" aria-label="${esc(it.q)}">
                ${[
                  ['1', '対応済み'],
                  ['0.5', '一部'],
                  ['0', '未対応'],
                  ['skip', '該当なし'],
                ]
                  .map(
                    ([val, lab]) =>
                      `<label class="radio${String(v) === val ? ' on' : ''}"><input type="radio" name="q_${it.id}" value="${val}" ${String(v) === val ? 'checked' : ''}>${lab}</label>`,
                  )
                  .join('')}
              </div>
              <p class="q-fix"${String(v) === '1' || String(v) === 'skip' ? ' hidden' : ''}><span class="fix-tag">打ち手</span>${esc(it.fix)}</p>
              <div class="src-row">${srcChips(it.src)}</div>
            </li>`;
          })
          .join('')}
      </ul>
    </section>`,
  ).join('');

  host.querySelectorAll('input[type="radio"]').forEach((r) =>
    r.addEventListener('change', () => {
      const li = r.closest('.q-item');
      state.answers[li.dataset.q] = r.value;
      state.updatedAt = Date.now();
      store.set(KEY, state);
      li.querySelectorAll('.radio').forEach((l) => l.classList.toggle('on', l.querySelector('input').checked));
      const fix = li.querySelector('.q-fix');
      if (fix) fix.hidden = r.value === '1' || r.value === 'skip';
      renderScore();
    }),
  );
  renderScore();
}

function compute() {
  const cats = GROUPS.map((gr) => {
    const active = gr.items.filter((it) => state.answers[it.id] !== undefined && state.answers[it.id] !== '' && state.answers[it.id] !== 'skip');
    const answered = active.length;
    const sum = active.reduce((s, it) => s + Number(state.answers[it.id]), 0);
    const pct = answered ? (sum / answered) * 100 : null;
    const unanswered = gr.items.filter((it) => state.answers[it.id] === undefined || state.answers[it.id] === '').length;
    return { ...gr, pct, answered, unanswered };
  });
  const denom = cats.filter((c) => c.pct !== null).reduce((s, c) => s + c.weight, 0);
  const num = cats.filter((c) => c.pct !== null).reduce((s, c) => s + c.weight * c.pct, 0);
  const total = denom ? Math.round(num / denom) : null;
  return { cats, total, coverage: denom };
}

function renderScore() {
  const { cats, total, coverage } = compute();
  const host = $('#offsite-score');
  const onsite = store.get(HISTORY_KEY, [])[0] || null;
  const combined = total !== null && onsite ? Math.round(onsite.total * 0.6 + total * 0.4) : null;
  const gr = gradeOf(combined ?? total ?? 0);

  host.innerHTML = `
    <div class="score-main">
      <div class="score-arc-wrap">
        <div class="score-hero"><span class="score-num">${total === null ? '—' : total}</span><span class="score-den">/ 100</span></div>
      </div>
      <div class="score-meta">
        <p class="eyebrow">OFFSITE SELF-ASSESSMENT</p>
        <p class="score-summary">${
          total === null
            ? '設問に回答するとスコアが算出されます。「該当なし」を選んだ設問は分母から除外されます。'
            : `回答済みの重みは全体の ${coverage}/100 です。${
                onsite
                  ? `直近のオンサイト診断(<a href="index.html?url=${encodeURIComponent(onsite.url)}">${esc(onsite.url)}</a> / ${onsite.total}点)と合算した<strong>統合AI可視性スコアは ${combined}点(${esc(gr.label)})</strong>です。`
                  : '<a href="index.html">オンサイト診断</a>を実行すると、両者を合算した統合スコアも表示されます。'
              }`
        }</p>
        ${
          onsite && total !== null
            ? `<p class="muted">統合スコアの配分はオンサイト60 : オフサイト40。オンサイトは自動測定で客観性が高く、オフサイトは自己申告のため重みを下げています。AI検索でのブランド言及の85%が第三者由来である点を踏まえ、オフサイトを無視しない配分としています。</p>`
            : ''
        }
      </div>
    </div>`;
  host.querySelector('.score-arc-wrap').prepend(scoreArc(total ?? 0, total === null ? 'muted' : gradeOf(total).tone));

  const chartHost = $('#offsite-chart');
  chartHost.innerHTML =
    '<p class="eyebrow">OFFSITE BREAKDOWN</p><h2 class="card-title">領域別スコア</h2><p class="card-lead">未回答が残っている領域は分母から外れているため、スコアが実態より高く出ることがあります。回答率も併せて確認してください。</p>';
  chartHost.append(
    hBars(
      cats.map((c) => ({
        name: c.name,
        meta: `重み ${c.weight}`,
        value: c.pct === null ? 0 : Math.round(c.pct),
        tone: c.pct === null ? 'muted' : c.pct >= 80 ? 'good' : c.pct >= 60 ? 'warning' : c.pct >= 40 ? 'serious' : 'critical',
        statusLabel: c.pct === null ? '未回答' : c.pct >= 80 ? '良好' : c.pct >= 60 ? '要改善' : c.pct >= 40 ? '課題あり' : '重大',
        statusIcon: c.pct === null ? '—' : c.pct >= 80 ? '◎' : c.pct >= 60 ? '△' : c.pct >= 40 ? '▲' : '✕',
        sub: c.unanswered ? `未回答 ${c.unanswered}件` : '全設問に回答済み',
      })),
      { max: 100, unit: '点' },
    ),
  );
  chartHost.append(
    tableView(
      ['領域', 'スコア', '重み', '回答済み', '未回答'],
      cats.map((c) => [c.name, c.pct === null ? '—' : `${Math.round(c.pct)}点`, `${c.weight}`, `${c.answered}件`, `${c.unanswered}件`]),
      'オフサイト自己診断の領域別スコア',
    ),
  );
}

$('#btn-export').addEventListener('click', () => {
  const { cats, total } = compute();
  const L = ['# オフサイトAI可視性 自己診断', '', `- 実施日: ${new Date().toISOString().slice(0, 10)}`, `- 総合: ${total === null ? '未算出' : `${total}/100`}`, '', '| 領域 | スコア | 重み |', '|---|---|---|'];
  cats.forEach((c) => L.push(`| ${c.name} | ${c.pct === null ? '—' : Math.round(c.pct)} | ${c.weight} |`));
  L.push('', '## 未対応・一部対応の項目', '');
  GROUPS.forEach((gr) => {
    const todo = gr.items.filter((it) => ['0', '0.5'].includes(String(state.answers[it.id])));
    if (!todo.length) return;
    L.push(`### ${gr.name}`, '');
    todo.forEach((it) => {
      L.push(`- [${state.answers[it.id] === '0.5' ? '一部' : '未対応'}] ${it.q}`);
      L.push(`  - 打ち手: ${it.fix}`);
      it.src.forEach((k) => SOURCES[k] && L.push(`  - 出典: ${SOURCES[k].origin} — ${SOURCES[k].url}`));
    });
    L.push('');
  });
  download(`aio-offsite_${new Date().toISOString().slice(0, 10)}.md`, L.join('\n'), 'text/markdown;charset=utf-8');
});

$('#btn-reset').addEventListener('click', () => {
  if (!confirm('回答をすべて削除します。よろしいですか?')) return;
  state.answers = {};
  store.set(KEY, state);
  render();
  toast('回答を初期化しました');
});

render();
