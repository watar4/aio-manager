/**
 * 診断ルール定義
 *
 * 各ルールは 0〜1 のスコアを返す。カテゴリ重みは 2026年の実証データにおける
 * 「AI可視性への寄与の大きさ」に基づいて配分している(合計100)。
 * skip:true を返したルールは、そのカテゴリの分母から除外される(該当しないページ種別など)。
 */
import { guessPageKind } from './analyzer.js';

export const CATEGORIES = [
  {
    id: 'render',
    name: 'AI可読性(レンダリング)',
    weight: 25,
    short: 'AIが読めているか',
    lead: 'JavaScript を実行せずに読めるHTMLに、意味のある情報が入っているか。AI可視性の前提条件であり、ここが落ちていると他をいくら整えても届かない。',
    src: ['torres_js', 'brighton_bot_traffic'],
  },
  {
    id: 'schema',
    name: '構造化データ',
    weight: 16,
    short: 'Google AI Overviews対策',
    lead: 'Google AI Overviews に対しては極めて効く(可視性+611%)が、ChatGPT等には波及しない。かつ「スキーマにしか書いていない情報」はどのAIも読めない。',
    src: ['otterly_schema', 'otterly_schema_only'],
  },
  {
    id: 'content',
    name: 'コンテンツ構造(RAG適合)',
    weight: 20,
    short: '引用しやすい形か',
    lead: 'ファンアウトされた個別クエリに対して、そのまま引用できる自己完結した塊になっているか。検証可能な数値の密度も採用率に効く。',
    src: ['meyers_fanout', 'anderson_graph', 'geo_survey'],
  },
  {
    id: 'entity',
    name: 'エンティティ・信頼シグナル',
    weight: 16,
    short: '誰の情報か伝わるか',
    lead: 'AIは「何が公式か」ではなく「何が頻繁に、一貫して言及されているか」を見る。ブランド表記の一貫性と外部接続が土台になる。',
    src: ['simmons_entity', 'petrovic_brand', 'ziptie_frequency'],
  },
  {
    id: 'tech',
    name: '技術基盤・クロール許可',
    weight: 15,
    short: '入口が開いているか',
    lead: 'AIクローラーが robots.txt で弾かれていないか、索引の元になる従来検索の基礎が整っているか。',
    src: ['law_index', 'solis_geo_is_seo'],
  },
  {
    id: 'confirm',
    name: 'Confirm対応(AICAS)',
    weight: 8,
    short: '確認に応えられるか',
    lead: 'AIが挙げた候補を、ユーザーは公式サイトで必ず確認する(AICASの Confirm)。この確認材料の充足度は、AI時代でも直接的な成果要因になる。',
    src: ['aicas', 'lseo_midfunnel'],
  },
];

const g = (score, detail, extra = {}) => ({ score: Math.max(0, Math.min(1, score)), detail, ...extra });

/** 取引条件の評価は、商品・サービスを販売しているページにのみ適用する */
const isCommercial = (c) =>
  c.schema.products.length > 0 ||
  /税込|税抜|カートに入れる|購入手続き|ご購入|注文|お買い物|販売価格|価格は|送料|在庫|申し込み|お申込|月額|料金プラン|円\(|円\s*\(/.test(c.text);
const band = (v, stops) => {
  // stops: [[閾値, スコア], ...] 降順
  for (const [th, s] of stops) if (v >= th) return s;
  return 0;
};

export const RULES = [
  /* ══════════ AI可読性(25) ══════════ */
  {
    id: 'render.shell',
    cat: 'render',
    weight: 8,
    title: 'クライアント側レンダリング依存になっていないか',
    why: 'AIクローラーの69%はJavaScriptを実行できない。JSで後から流し込まれる本文はAIから見えない。',
    src: ['torres_js'],
    phase: 'P0',
    impact: '高',
    effort: '高',
    fix: 'SSR / SSG / 動的レンダリングを導入し、商品名・価格・在庫・レビュー・本文をHTMLソースに含める。既存サイトなら「主要テンプレートだけ先にサーバー出力へ寄せる」段階導入が現実的。',
    run(c) {
      const { isShell, markers, emptyRoots, scriptCount } = c.spa;
      if (isShell) {
        return g(0, `本文テキスト ${c.textLength.toLocaleString()}文字 / script ${scriptCount}本。JSなしではほぼ空のページに見えています${markers.length ? `(検出フレームワーク: ${markers.join(', ')})` : ''}`, { evidence: emptyRoots });
      }
      if (emptyRoots.length) {
        return g(0.45, `空のマウント要素 (${emptyRoots.join(', ')}) を検出。一部コンテンツがJS依存の可能性があります`);
      }
      if (markers.length && c.textLength < 3000) {
        return g(0.7, `${markers.join(', ')} を検出。本文 ${c.textLength.toLocaleString()}文字はHTMLに出力済みですが、追加情報(レビュー・在庫等)のJS依存を個別確認してください`);
      }
      return g(1, `JSなしで本文 ${c.textLength.toLocaleString()}文字を取得できました${markers.length ? `(${markers.join(', ')} を使用しつつサーバー出力あり)` : ''}`);
    },
  },
  {
    id: 'render.volume',
    cat: 'render',
    weight: 6,
    title: '生HTML内の本文テキスト量',
    why: 'AIが引用できるのはHTMLソースに存在する文字だけ。極端に少ないページは候補にすら入らない。',
    src: ['torres_js', 'geo_survey'],
    phase: 'P0',
    impact: '高',
    effort: '中',
    fix: '各ページで「そのページだけが答えられる情報」を本文に足す。テンプレート由来の共通文言ではなく、固有の事実(産地・規格・使い方・比較軸)を書く。',
    run(c) {
      const n = c.textLength;
      const s = band(n, [[2500, 1], [1500, 0.9], [900, 0.75], [500, 0.55], [250, 0.3], [1, 0.1]]);
      return g(s, `本文テキスト ${n.toLocaleString()}文字(日本語ページの目安は1,500文字以上 / 最低 500文字)`);
    },
  },
  {
    id: 'render.ratio',
    cat: 'render',
    weight: 3,
    title: 'テキスト/HTML比率',
    why: 'マークアップと埋め込みJSが本文を圧倒しているページは、抽出時にノイズが勝ちやすい。',
    src: ['torres_js'],
    phase: 'P1',
    impact: '低',
    effort: '中',
    fix: 'インラインJSON・巨大なインラインスクリプトを外部化し、テンプレートの入れ子を浅くする。',
    run(c) {
      const r = c.textRatio;
      const s = band(r, [[0.15, 1], [0.1, 0.85], [0.06, 0.65], [0.03, 0.4], [0.012, 0.2]]);
      return g(s, `テキスト比率 ${(r * 100).toFixed(1)}%(HTML ${Math.round(c.htmlBytes / 1024)}KB 中、うちインラインJS ${Math.round(c.spa.inlineScriptBytes / 1024)}KB)`);
    },
  },
  {
    id: 'render.headings-in-html',
    cat: 'render',
    weight: 3,
    title: '見出しがHTMLソースに存在するか',
    why: 'RAGはまず見出し単位でチャンク化する。見出しがJS生成だと構造情報そのものが欠落する。',
    src: ['anderson_graph'],
    phase: 'P0',
    impact: '中',
    effort: '中',
    fix: 'h1〜h3をサーバー出力に含める。タブやアコーディオン内の見出しも初期HTMLに書き出す。',
    run(c) {
      const h2plus = c.headings.filter((h) => h.level >= 2).length;
      if (!c.headings.length) return g(0, '見出し要素がHTMLソースに1つもありません');
      const s = band(h2plus, [[5, 1], [3, 0.85], [2, 0.7], [1, 0.5]]);
      return g(Math.max(s, c.h1Count ? 0.35 : 0), `h1 ${c.h1Count}個 / h2以下 ${h2plus}個をHTMLソースで検出`);
    },
  },
  {
    id: 'render.main-landmark',
    cat: 'render',
    weight: 3,
    title: '本文領域のランドマーク(main / article)',
    why: '抽出器は main / article を手がかりに本文とナビゲーションを切り分ける。無い場合はメニューやフッターが混入する。',
    src: ['anderson_graph'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: '本文を <main> または <article> で囲む。ヘッダー・サイド・フッターは <header>/<aside>/<footer> に分ける。',
    run(c) {
      if (!c.hasMainLandmark) return g(0.2, 'main / article / role="main" のいずれも見つかりません。本文とナビの境界がAIに伝わりません');
      const share = c.textLength ? c.mainTextLength / c.textLength : 0;
      const s = band(share, [[0.5, 1], [0.3, 0.85], [0.15, 0.6], [0.05, 0.4]]);
      return g(s, `main内テキストが全体の ${(share * 100).toFixed(0)}%(${c.mainTextLength.toLocaleString()}文字)`);
    },
  },
  {
    id: 'render.noscript',
    cat: 'render',
    weight: 2,
    title: 'JS無効時の代替表示',
    why: 'noscriptで「JavaScriptを有効にしてください」しか出ないページは、AIクローラーにはその文言だけが見える。',
    src: ['torres_js'],
    phase: 'P0',
    impact: '中',
    effort: '中',
    fix: 'noscript に「有効化のお願い」ではなく実際のコンテンツ(または要約と静的リンク)を出力する。',
    run(c) {
      if (c.noscript.warns && c.textLength < 1500) return g(0, `noscriptがJS有効化を要求しており、かつ本文が ${c.textLength}文字しかありません`);
      if (c.noscript.warns) return g(0.6, 'noscriptにJS有効化の要求文があります(本文自体は出力されています)');
      return g(1, c.noscript.count ? 'noscriptに代替情報が出力されています' : 'JS無効化の要求文なし');
    },
  },

  /* ══════════ 構造化データ(16) ══════════ */
  {
    id: 'schema.present',
    cat: 'schema',
    weight: 4,
    title: 'JSON-LD が有効な形で設置されているか',
    why: '構造化データ実装で Google AI Overviews でのブランド可視性は+611%、AI Overviews出現率は+1,500%。ここはGoogle経路の最大レバー。',
    src: ['otterly_schema', 'brighton_schema_1500'],
    phase: 'P0',
    impact: '高',
    effort: '低',
    fix: 'JSON-LD形式で実装し、Rich Results Test / スキーマ検証で構文エラーをゼロにする。',
    run(c) {
      if (c.schema.errors.length) return g(0.3, `JSON-LDの構文エラー ${c.schema.errors.length}件: ${c.schema.errors[0]}`);
      if (!c.schema.blockCount && !c.schema.microdataTypes.length) return g(0, '構造化データ(JSON-LD / microdata)が設置されていません');
      if (!c.schema.blockCount) return g(0.4, `microdata (${c.schema.microdataTypes.slice(0, 3).join(', ')}) のみ。JSON-LDへの移行が推奨されます`);
      return g(1, `JSON-LD ${c.schema.blockCount}ブロック / 型: ${c.schema.types.join(', ') || '型指定なし'}`);
    },
  },
  {
    id: 'schema.core-types',
    cat: 'schema',
    weight: 4,
    title: 'Organization / WebSite / BreadcrumbList の実装',
    why: '運営主体・サイト・階層の3点は、エンティティとしてサイトを認識させる基礎。AI Overviews向けの最優先実装。',
    src: ['otterly_schema', 'simmons_entity'],
    phase: 'P0',
    impact: '高',
    effort: '低',
    fix: '全ページ共通で Organization(logo/url/sameAs付き)と WebSite、下層ページに BreadcrumbList を出力する。',
    run(c) {
      const have = [c.schema.hasOrg && 'Organization', c.schema.hasWebSite && 'WebSite', c.schema.hasBreadcrumb && 'BreadcrumbList'].filter(Boolean);
      const s = have.length / 3;
      return g(s === 1 ? 1 : s, have.length ? `実装済み: ${have.join(' / ')}(未実装: ${['Organization', 'WebSite', 'BreadcrumbList'].filter((t) => !have.includes(t)).join(' / ') || 'なし'})` : '3種いずれも未実装');
    },
  },
  {
    id: 'schema.page-type',
    cat: 'schema',
    weight: 3,
    title: 'ページ種別に対応した型の実装',
    why: 'リッチリザルトの対象になる型がないと、AI Overviewsに拾われる経路が減る。',
    src: ['otterly_schema'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: '商品ページはProduct、記事はArticle、Q&AはFAQPage、一覧はItemList、店舗はLocalBusinessを実装する。',
    run(c) {
      const kind = guessPageKind(c);
      const t = c.schema.types;
      const wants = { product: ['Product'], article: ['Article', 'BlogPosting', 'NewsArticle'], home: ['WebSite', 'Organization'], other: ['WebPage', 'ItemList', 'CollectionPage', 'FAQPage', 'Article', 'Product'] }[kind];
      const hit = wants.filter((w) => t.includes(w));
      if (hit.length) return g(1, `ページ種別「${kind}」に適した ${hit.join(', ')} を検出`);
      const anyRich = t.some((x) => /Product|Article|FAQPage|ItemList|Recipe|Event|LocalBusiness|HowTo/.test(x));
      return g(anyRich ? 0.6 : 0.15, `ページ種別「${kind}」に対して ${wants.join(' / ')} が未実装(検出型: ${t.join(', ') || 'なし'})`);
    },
  },
  {
    id: 'schema.product-detail',
    cat: 'schema',
    weight: 2,
    title: 'Product スキーマの属性充足',
    why: 'エージェンティックコマースの前提は商品データの機械可読性。価格・在庫・識別子・評価が揃って初めて候補になる。',
    src: ['risley_agentic', 'ucp'],
    phase: 'P1',
    impact: '中',
    effort: '中',
    fix: 'offers(price/priceCurrency/availability)、sku または gtin13、aggregateRating、shippingDetails、hasMerchantReturnPolicy を追加する。',
    run(c) {
      if (!c.schema.products.length) return { skip: true, detail: 'このページに Product スキーマはありません(商品ページのみ対象)' };
      const p = c.schema.products[0];
      const offers = Array.isArray(p.offers) ? p.offers[0] : p.offers;
      const checks = [
        ['価格', !!(offers && (offers.price || offers.lowPrice))],
        ['在庫状態', !!(offers && offers.availability)],
        ['識別子(sku/gtin)', !!(p.sku || p.gtin13 || p.gtin || p.mpn)],
        ['レビュー集計', !!p.aggregateRating],
        ['画像', !!p.image],
        ['ブランド', !!p.brand],
        ['配送情報', !!(offers && offers.shippingDetails)],
        ['返品ポリシー', !!(offers && offers.hasMerchantReturnPolicy)],
      ];
      const ok = checks.filter((x) => x[1]);
      return g(ok.length / checks.length, `Product属性 ${ok.length}/${checks.length} 充足(不足: ${checks.filter((x) => !x[1]).map((x) => x[0]).join(', ') || 'なし'})`);
    },
  },
  {
    id: 'schema.only-in-schema',
    cat: 'schema',
    weight: 3,
    title: '構造化データにしか書かれていない情報がないか',
    why: 'Otterly AIの統制実験では「スキーマにのみ存在する情報は、全プラットフォームが正しく回答できなかった」。スキーマは本文の代わりにならない。',
    src: ['otterly_schema_only'],
    phase: 'P0',
    impact: '高',
    effort: '低',
    fix: '価格・評点・産地・受賞歴・配送条件などは、構造化データと本文HTMLの両方に書く。',
    run(c) {
      const all = c.schema.schemaOnly;
      if (!all.length) return { skip: true, detail: '照合対象となる値が構造化データにありません' };
      const missing = c.schema.schemaOnlyMissing;
      const rate = 1 - missing.length / all.length;
      const s = band(rate, [[1, 1], [0.8, 0.8], [0.6, 0.55], [0.4, 0.3]]);
      return g(s, missing.length ? `構造化データにあるが本文に見つからない値 ${missing.length}/${all.length}件: ${missing.slice(0, 4).map((m) => `${m.key}「${m.value}」`).join(' / ')}` : `照合した ${all.length}件すべてが本文HTMLにも記載されています`, { evidence: missing });
    },
  },

  /* ══════════ コンテンツ構造(20) ══════════ */
  {
    id: 'content.question-headings',
    cat: 'content',
    weight: 4,
    title: '質問形・意図起点の見出し',
    why: 'AI検索はクエリをファンアウトして個別の問いに分解する。問いの形の見出しは、その分解された問いに直接当たる。',
    src: ['meyers_fanout', 'mozcon_88'],
    phase: 'P1',
    impact: '高',
    effort: '中',
    fix: 'CEP(誰が・いつ・なぜ)から想定プロンプトを起こし、その問いをそのまま見出しにして、直下の段落で完結して答える。',
    run(c) {
      const n = c.questionHeadings.length;
      const total = c.headings.length;
      if (!total) return g(0, '見出しがありません');
      const s = band(n, [[5, 1], [3, 0.85], [2, 0.65], [1, 0.45]]);
      return g(s, `質問形・意図起点の見出し ${n}個 / 全見出し ${total}個${n ? `(例: ${c.questionHeadings.slice(0, 3).map((h) => `「${h.text.slice(0, 30)}」`).join(' ')})` : ''}`);
    },
  },
  {
    id: 'content.verifiable-facts',
    cat: 'content',
    weight: 4,
    title: '検証可能な数値・事実の密度',
    why: 'GEO研究のサーベイでは、統計・数値・引用・権威ある出典の明示が生成エンジンでの採用率を上げると整理されている。',
    src: ['geo_survey', 'lseo_midfunnel'],
    phase: 'P1',
    impact: '高',
    effort: '中',
    fix: '「美味しい」「豊富な品揃え」のような形容を、単位付きの数値(内容量・産地・受賞年・件数・所要日数)に置き換える。',
    run(c) {
      const per1k = c.facts.per1k;
      const s = band(per1k, [[12, 1], [8, 0.85], [5, 0.65], [3, 0.45], [1, 0.25]]);
      return g(s, `単位付き数値 ${c.facts.numHits}件 / 本文1,000文字あたり ${per1k.toFixed(1)}件(目標 8件以上)`);
    },
  },
  {
    id: 'content.self-contained',
    cat: 'content',
    weight: 3,
    title: '段落が自己完結しているか',
    why: 'RAGは段落単位で切り出す。前後の文脈に依存した短文の羅列は、切り出された時点で意味を失う。',
    src: ['anderson_graph'],
    phase: 'P1',
    impact: '中',
    effort: '中',
    fix: '1段落=1論点。主語を省略せず、その段落だけ読んでも成立する形にする(80〜300文字が目安)。',
    run(c) {
      const { count, avg } = c.paragraphs;
      if (!count) return g(0.15, '段落要素(p)がありません。divの羅列やテーブルレイアウトになっている可能性があります');
      const s = avg >= 80 && avg <= 320 ? 1 : avg >= 50 && avg <= 450 ? 0.75 : avg > 450 ? 0.5 : 0.35;
      return g(s, `段落 ${count}個 / 平均 ${avg}文字(目安 80〜320文字)`);
    },
  },
  {
    id: 'content.structured-blocks',
    cat: 'content',
    weight: 2,
    title: '表・リストによる構造化',
    why: '比較・スペック・手順は、表やリストの形の方がそのまま引用されやすい。比較検討段階のクエリはAIセッションの主戦場である。',
    src: ['webfx_92', 'lseo_midfunnel'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: '仕様・比較・手順を table / ul / dl に置き換える。画像内の表は必ずテキストでも併記する。',
    run(c) {
      const { tables, lists, defLists } = c.blocks;
      const total = tables * 2 + lists + defLists * 2;
      const s = band(total, [[6, 1], [4, 0.85], [2, 0.6], [1, 0.4]]);
      return g(s, `table ${tables} / ul・ol ${lists} / dl ${defLists}`);
    },
  },
  {
    id: 'content.heading-structure',
    cat: 'content',
    weight: 2,
    title: '見出し階層の整合性',
    why: '見出しの階層はコンテキストグラフの骨格になる。h1複数やレベル飛びは親子関係を壊す。',
    src: ['anderson_graph', 'simmons_entity'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: 'h1は1ページ1つ。レベルを飛ばさず、見た目の大きさではなく階層でタグを選ぶ。',
    run(c) {
      const issues = [];
      if (c.h1Count === 0) issues.push('h1なし');
      if (c.h1Count > 1) issues.push(`h1が${c.h1Count}個`);
      if (c.hierarchyJumps) issues.push(`レベル飛び ${c.hierarchyJumps}箇所`);
      const s = issues.length === 0 ? 1 : issues.length === 1 ? 0.6 : 0.3;
      return g(s, issues.length ? `課題: ${issues.join(' / ')}` : `h1 1個・レベル飛びなし(見出し計 ${c.headings.length}個)`);
    },
  },
  {
    id: 'content.freshness',
    cat: 'content',
    weight: 2,
    title: '更新日と実質的な鮮度',
    why: '検索回復シグナルの1つは実質的なコンテンツ更新。見せかけの鮮度(日付だけの更新)では足りない。',
    src: ['davies_freshness'],
    phase: 'P1',
    impact: '中',
    effort: '中',
    fix: 'dateModified を構造化データと本文の両方に出す。更新時は日付だけでなく、価格・在庫・比較対象・データを実際に洗い替える。',
    run(c) {
      const d = c.eeat.newestDate;
      if (!d) return g(0.2, '構造化データ・本文のいずれにも日付情報が見つかりません');
      const days = Math.floor((Date.now() - d) / 86400000);
      const s = band(-days, [[-90, 1], [-180, 0.85], [-365, 0.6], [-730, 0.35]]);
      return g(s, `検出された最新日付は ${new Date(d).toISOString().slice(0, 10)}(${days}日前)${c.eeat.dateModified ? ' / dateModified あり' : ' / dateModified は未設定'}`);
    },
  },
  {
    id: 'content.commodity',
    cat: 'content',
    weight: 3,
    title: '一次情報の存在(AIが合成できない内容か)',
    why: 'AIが既存情報から合成できるコンテンツは市場価値を失う。Google公式ガイドも「生成AIが再現できない独自視点・一次体験」を推奨している。',
    src: ['evolve_commodity', 'google_ai_guide'],
    phase: 'P1',
    impact: '高',
    effort: '高',
    fix: '生産者・現場の一次取材、自社データ、実測値、失敗例、具体的な手順を入れる。他社サイトの言い換えで足りる内容は投資対象から外す。',
    run(c) {
      const t = c.text;
      const signals = [
        ['一次情報の語彙', /取材|インタビュー|生産者|製造元|開発者|現地|実測|試食|検証した|独自調査|自社調査|体験|受賞|品評会/.test(t)],
        ['固有名詞の密度', (t.match(/[一-龥]{1,4}(?:県|市|町|村|区|社|店|駅|港|島|温泉|山|川|浜|藩|大学|工房|牧場|窯)/g) || []).length >= 3],
        ['数値の裏付け', c.facts.per1k >= 5],
        ['外部権威への参照', c.links.externalHosts.length >= 1],
        ['具体的な手順・使い方', /手順|ステップ|使い方|レシピ|やり方|注意点|保存方法|調理/.test(t)],
      ];
      const ok = signals.filter((s) => s[1]);
      return g(ok.length / signals.length, `一次情報シグナル ${ok.length}/${signals.length}(不足: ${signals.filter((s) => !s[1]).map((s) => s[0]).join(', ') || 'なし'})`);
    },
  },

  /* ══════════ エンティティ(16) ══════════ */
  {
    id: 'entity.brand-consistency',
    cat: 'entity',
    weight: 3,
    title: 'ブランド表記の一貫性',
    why: 'LLMは「何が公式か」を知らず「何が頻繁に、同じ形で言及されているか」を手がかりにする。表記揺れはシグナルを分散させる。',
    src: ['ziptie_frequency', 'simmons_entity'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: 'title / og:site_name / Organization.name / 各種SNSプロフィールで、同一の正式表記を使う。略称は1つに決めて併記する。',
    run(c) {
      const { brandName, brandConsistent } = c.entity;
      if (!brandName) return g(0.2, 'ブランド名を特定できません(Organization.name / og:site_name が未設定)');
      if (brandConsistent === null) return g(0.6, `ブランド名「${brandName}」は1箇所からのみ検出。og:site_name と Organization.name の両方に明記してください`);
      return g(brandConsistent ? 1 : 0.4, brandConsistent ? `ブランド名「${brandName}」が複数箇所で一致` : `ブランド名の表記が箇所によって異なります(検出: ${brandName} ほか)`);
    },
  },
  {
    id: 'entity.brand-brevity',
    cat: 'entity',
    weight: 2,
    title: '呼称の短さ(1語ブランドの優位)',
    why: '1語のブランド名は複数語ブランドより約8倍多くAIに推奨される(Ahrefs Evolve 2026 / Dan Petrovic)。',
    src: ['petrovic_brand'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: '正式名称は変えなくてよい。短い呼称(1語)を1つ決め、本文・見出し・SNS・第三者向け資料で意図的に一貫使用する。',
    run(c) {
      const n = c.entity.brandTokens.length;
      if (!n) return { skip: true, detail: 'ブランド名を特定できませんでした' };
      const s = n === 1 ? 1 : n === 2 ? 0.65 : n === 3 ? 0.4 : 0.25;
      return g(s, `ブランド名「${c.entity.brandName}」は ${n}語構成。${n > 1 ? '短い呼称の一貫使用を併せて設計してください' : '1語ブランドはAI推奨で有利です'}`);
    },
  },
  {
    id: 'entity.sameas',
    cat: 'entity',
    weight: 3,
    title: '外部エンティティとの接続(sameAs)',
    why: 'エンティティ獲得の4領域の1つ。外部の確立されたIDに紐づくことで、同名の別主体との混同を防げる。',
    src: ['simmons_entity', 'evolve_85'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: 'Organization スキーマに sameAs を並べる(公式SNS、YouTubeチャンネル、Wikipedia / Wikidata、業界団体ページ)。',
    run(c) {
      const { sameAs, socialLinks, hasWiki, hasYouTube } = c.entity;
      const pts = (sameAs.length ? 0.5 : 0) + (socialLinks.length >= 2 ? 0.2 : 0) + (hasYouTube ? 0.15 : 0) + (hasWiki ? 0.15 : 0);
      return g(pts, `sameAs ${sameAs.length}件 / 外部プロフィールリンク ${socialLinks.length}件${hasYouTube ? ' / YouTube接続あり' : ' / YouTube接続なし'}${hasWiki ? ' / Wikipedia・Wikidata接続あり' : ''}`);
    },
  },
  {
    id: 'entity.eeat',
    cat: 'entity',
    weight: 3,
    title: '発信主体・著者情報の明示',
    why: 'BrightonSEO 2026 の全体テーマは「信頼」。AIに引用されるのは「信じる理由が最も多い」事業者である。',
    src: ['simmons_entity', 'google_ai_guide'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: '運営会社・所在地・問い合わせ先を全ページから辿れるようにし、記事には著者/監修者と経歴を付ける。Article.author も出力する。',
    run(c) {
      const checks = [['運営会社・企業情報', c.eeat.company], ['プライバシーポリシー', c.eeat.privacy], ['問い合わせ先', c.eeat.contact], ['著者・監修表記', c.eeat.author || c.eeat.authorSchema]];
      const ok = checks.filter((x) => x[1]);
      return g(ok.length / checks.length, `${ok.length}/${checks.length} を検出(不足: ${checks.filter((x) => !x[1]).map((x) => x[0]).join(', ') || 'なし'})`);
    },
  },
  {
    id: 'entity.internal-links',
    cat: 'entity',
    weight: 3,
    title: '内部リンク構造',
    why: 'エンティティ関係を写像した「コンテキストグラフ」の実体は内部リンク。関連の張り方がそのまま関係の主張になる。',
    src: ['anderson_graph', 'simmons_entity'],
    phase: 'P1',
    impact: '中',
    effort: '中',
    fix: '「こちら」「詳細」ではなく、リンク先の主題語をアンカーテキストにする。関連商品・関連特集・上位カテゴリへの相互リンクを張る。',
    run(c) {
      const { uniqueInternal, genericAnchors, total } = c.links;
      const s1 = band(uniqueInternal, [[30, 1], [15, 0.85], [8, 0.6], [3, 0.4]]);
      const penalty = total ? Math.min(0.4, genericAnchors / Math.max(total, 1) * 2) : 0;
      return g(s1 - penalty, `内部リンク ${uniqueInternal}種(全リンク ${total}件)${genericAnchors ? ` / 「こちら」等の汎用アンカー ${genericAnchors}件` : ''}`);
    },
  },
  {
    id: 'entity.external-citations',
    cat: 'entity',
    weight: 2,
    title: '外部の権威ソースへの参照',
    why: '検証可能な出典の明示は生成エンジンでの採用率に効く。参照の連結はコンテキストグラフの一部にもなる。',
    src: ['geo_survey', 'semrush_thirdparty'],
    phase: 'P2',
    impact: '低',
    effort: '低',
    fix: '規格・統計・受賞・自治体情報などを引くときは、出典元に直接リンクする(nofollowでも可)。',
    run(c) {
      const n = c.links.externalHosts.length;
      const s = band(n, [[5, 1], [3, 0.8], [2, 0.6], [1, 0.4]]);
      return g(s, `外部ドメインへの参照 ${n}ドメイン${n ? `(${c.links.externalHosts.slice(0, 4).join(', ')})` : ''}`);
    },
  },

  /* ══════════ 技術基盤(15) ══════════ */
  {
    id: 'tech.ai-bots',
    cat: 'tech',
    weight: 5,
    title: 'robots.txt でのAIクローラー許可状況',
    why: '入口が閉じていれば他の施策はすべて無効。ChatGPTはBing、ClaudeはBrave、GeminiはGoogleを索引に使うため、従来ボットの許可も同時に必要。',
    src: ['law_index', 'torres_js'],
    phase: 'P0',
    impact: '高',
    effort: '低',
    fix: '検索・回答生成に使われるボット(OAI-SearchBot / ChatGPT-User / PerplexityBot / Claude-User / Google-Extended / bingbot)は許可する。学習用途のみブロックしたい場合は GPTBot / CCBot を個別に扱う。',
    run(c) {
      if (!c.robots.found) return g(0.5, 'robots.txt を取得できませんでした(存在しない場合は暗黙的に全許可)', { unknown: true });
      const crit = c.robots.bots.filter((b) => b.critical);
      const blocked = crit.filter((b) => b.state === 'blocked');
      const sitewide = crit.filter((b) => b.sitewide);
      const learnBlocked = c.robots.bots.filter((b) => !b.critical && b.sitewide);
      const notes = [];
      if (learnBlocked.length) notes.push(`学習用ボット ${learnBlocked.length}件はサイト全体を拒否(${learnBlocked.map((b) => b.name).join(', ')})— これは経営判断のため減点していません`);
      const dis = c.robots.bots[0]?.disallowCount || 0;
      if (dis) notes.push(`このURLに適用されるグループのDisallowは ${dis}件`);
      if (blocked.length) {
        return g(0, `診断対象URLが ${blocked.length}件の重要なAIクローラーに対してブロックされています: ${blocked.map((b) => `${b.name}(${b.matched})`).join(', ')}`, { evidence: c.robots.bots });
      }
      if (sitewide.length) {
        return g(0.15, `重要なAIクローラー ${sitewide.length}件がサイト全体で拒否されています: ${sitewide.map((b) => b.name).join(', ')}`, { evidence: c.robots.bots });
      }
      return g(1, `重要なAIクローラー ${crit.length}件すべてがこのURLをクロール可能${notes.length ? `。${notes.join(' / ')}` : ''}`, { evidence: c.robots.bots });
    },
  },
  {
    id: 'tech.robots-meta',
    cat: 'tech',
    weight: 2,
    title: 'robots meta / スニペット制御',
    why: 'nosnippet や max-snippet:0 は、AI Overviews での引用そのものを止める。noindexは索引から外す。',
    src: ['google_ai_guide'],
    phase: 'P0',
    impact: '高',
    effort: '低',
    fix: '可視性を取りたいページでは noindex / nosnippet / max-snippet:0 を外す。逆に引用させたくない領域だけ意図的に付ける。',
    run(c) {
      const m = c.meta.robotsMeta;
      if (!m) return g(1, 'robots meta による制限なし');
      const bad = ['noindex', 'nosnippet', 'max-snippet:0', 'noai', 'noimageai'].filter((k) => m.includes(k));
      if (bad.includes('noindex')) return g(0, `robots meta に noindex が設定されています(${m})`);
      if (bad.length) return g(0.3, `引用を妨げる指定があります: ${bad.join(', ')}`);
      return g(1, `robots meta: ${m}(制限なし)`);
    },
  },
  {
    id: 'tech.title-desc',
    cat: 'tech',
    weight: 2,
    title: 'title / meta description の品質',
    why: 'GEOとして売られる施策の多くは基礎SEO。従来検索での順位実績がAI検索での被引用の強い予測指標である。',
    src: ['solis_geo_is_seo', 'law_index'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: 'title は 20〜60文字で主題語を前方に。description は 70〜160文字で、そのページ固有の内容を書く。',
    run(c) {
      const { titleLen, descLen, title } = c.meta;
      let s = 0;
      const notes = [];
      if (!titleLen) notes.push('titleなし');
      else if (titleLen >= 15 && titleLen <= 65) s += 0.6;
      else { s += 0.3; notes.push(`title ${titleLen}文字(推奨15〜65)`); }
      if (!descLen) notes.push('description未設定');
      else if (descLen >= 45 && descLen <= 170) s += 0.4;
      else { s += 0.2; notes.push(`description ${descLen}文字(日本語の推奨は45〜170)`); }
      return g(s, notes.length ? notes.join(' / ') : `title ${titleLen}文字「${title.slice(0, 40)}」/ description ${descLen}文字`);
    },
  },
  {
    id: 'tech.canonical-lang',
    cat: 'tech',
    weight: 2,
    title: 'canonical / lang / viewport',
    why: '重複の整理と言語宣言は、どのURLをエンティティの代表として扱うかの指示になる。',
    src: ['solis_geo_is_seo'],
    phase: 'P1',
    impact: '低',
    effort: '低',
    fix: 'self-canonical を全ページに出力し、html lang を正しく設定する(日本語サイトは lang="ja")。',
    run(c) {
      const checks = [['canonical', !!c.meta.canonical], ['html lang', !!c.meta.lang], ['viewport', c.meta.hasViewport]];
      const ok = checks.filter((x) => x[1]);
      return g(ok.length / checks.length, `${ok.map((x) => x[0]).join(' / ') || 'なし'} を検出${ok.length < checks.length ? `(不足: ${checks.filter((x) => !x[1]).map((x) => x[0]).join(', ')})` : ''}`);
    },
  },
  {
    id: 'tech.sitemap',
    cat: 'tech',
    weight: 2,
    title: 'sitemap.xml',
    why: '発見性の基礎。AI検索側の索引(Bing / Google)への収録速度に影響する。',
    src: ['law_index'],
    phase: 'P1',
    impact: '低',
    effort: '低',
    fix: 'sitemap.xml を生成し robots.txt に Sitemap 行で宣言する。lastmod は実際の更新日を入れる。',
    run(c) {
      if (c.sitemap.found) return g(1, `sitemap を検出(${c.sitemap.isIndex ? 'インデックス形式・' : ''}URL ${c.sitemap.urlCount}件)`);
      if (c.sitemap.declaredInRobots) return g(0.7, `robots.txt に Sitemap 宣言あり(${c.robots.sitemaps[0]})。ファイル本体は取得できませんでした`);
      return g(0.2, '/sitemap.xml が見つからず、robots.txt にも Sitemap 宣言がありません');
    },
  },
  {
    id: 'tech.images',
    cat: 'tech',
    weight: 2,
    title: '画像の代替テキストと遅延読み込み',
    why: 'AIクローラーの多くはJSを実行しないため、data-src だけの遅延読み込み画像は存在しないのと同じになる。',
    src: ['torres_js'],
    phase: 'P1',
    impact: '低',
    effort: '低',
    fix: 'src を必ず出力し、遅延読み込みは loading="lazy" で行う。alt には画像内の文字情報と主題を書く。',
    run(c) {
      const { total, withAlt, lazyOnly } = c.images;
      if (!total) return { skip: true, detail: '画像要素がありません' };
      const rate = withAlt / total;
      let s = band(rate, [[0.9, 1], [0.7, 0.8], [0.5, 0.55], [0.25, 0.3]]);
      if (lazyOnly) s = Math.min(s, 0.5);
      return g(s, `alt付き ${withAlt}/${total}枚(${Math.round(rate * 100)}%)${lazyOnly ? ` / src未出力のJS遅延読み込み ${lazyOnly}枚` : ''}`);
    },
  },

  /* ══════════ Confirm対応(8) ══════════ */
  {
    id: 'confirm.commerce',
    cat: 'confirm',
    weight: 3,
    title: '取引条件(送料・返品・支払・在庫)の明記',
    why: 'AICASの Confirm 段階で、ユーザーはAIの推薦をそのまま受け入れず公式サイトで条件を確認する。UCP適格性の要件とも重なる。',
    src: ['aicas', 'ucp'],
    phase: 'P0',
    impact: '高',
    effort: '低',
    fix: '送料・お届け目安・返品条件・支払方法・在庫状況を商品ページ本文に書く(別ページへのリンクだけにしない)。',
    run(c) {
      if (!isCommercial(c)) return { skip: true, detail: '商品・サービスを販売しているページではないため対象外です' };
      const keys = ['shipping', 'returns', 'payment', 'stock'];
      const ok = keys.filter((k) => c.confirm[k].found);
      return g(ok.length / keys.length, `${ok.length}/${keys.length} 記載あり(不足: ${keys.filter((k) => !c.confirm[k].found).map((k) => c.confirm[k].label).join(', ') || 'なし'})`);
    },
  },
  {
    id: 'confirm.spec',
    cat: 'confirm',
    weight: 2,
    title: '規格・仕様の数値情報',
    why: '比較検討段階で問われるのは製品比較・顧客適合性・価格の論理といった具体条件である。',
    src: ['lseo_midfunnel', 'geo_survey'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: '内容量・サイズ・原材料・賞味期限・保存方法・産地・生産者を、単位付きの数値で本文に書く。',
    run(c) {
      if (!isCommercial(c)) return { skip: true, detail: '商品・サービスを販売しているページではないため対象外です' };
      const found = c.confirm.spec.found;
      const dense = c.facts.per1k >= 6;
      return g(found && dense ? 1 : found ? 0.65 : 0.2, found ? `規格・仕様の語彙を検出${dense ? '・数値密度も十分' : '(ただし数値の記載が少なめ)'}` : '内容量・規格・産地・賞味期限などの記載が見つかりません');
    },
  },
  {
    id: 'confirm.faq',
    cat: 'confirm',
    weight: 2,
    title: 'FAQ・想定質問への回答',
    why: '比較検討段階ではブランド自社コンテンツが引用の42〜79%を占め、レビュー・比較サイトは1〜7%にとどまる。自社で問いに答えれば自社が引用される。',
    src: ['brightedge_42_79', 'webfx_92'],
    phase: 'P1',
    impact: '中',
    effort: '低',
    fix: '想定プロンプトから起こしたQ&Aを本文に置き、FAQPage スキーマも併記する(本文とスキーマの両方に書く)。',
    run(c) {
      const hasText = c.confirm.faq.found;
      const hasSchema = c.schema.types.includes('FAQPage') || c.schema.types.includes('QAPage');
      return g(hasText && hasSchema ? 1 : hasText ? 0.7 : hasSchema ? 0.5 : 0.15, `本文のFAQ: ${hasText ? 'あり' : 'なし'} / FAQPageスキーマ: ${hasSchema ? 'あり' : 'なし'}`);
    },
  },
  {
    id: 'confirm.trust',
    cat: 'confirm',
    weight: 1,
    title: '事業者情報・問い合わせ窓口',
    why: '確認行動の最後に見られるのは事業者の実在性。信頼の裏付けが弱いと、確認段階で離脱する。',
    src: ['aicas'],
    phase: 'P1',
    impact: '低',
    effort: '低',
    fix: '特定商取引法に基づく表記、会社概要、問い合わせ窓口(電話・フォーム・受付時間)への導線を全ページに置く。',
    run(c) {
      const ok = ['contact', 'legal'].filter((k) => c.confirm[k].found);
      return g(ok.length / 2, `${ok.map((k) => c.confirm[k].label).join(' / ') || 'いずれも検出できず'}`);
    },
  },
];

/** 加点しないが必ず報告する情報項目 */
export const INFO_CHECKS = [
  {
    id: 'info.llmstxt',
    title: 'llms.txt',
    src: ['peham_llmstxt', 'ahrefs_llmstxt', 'google_llmstxt'],
    run(c) {
      return c.llms.found
        ? { level: 'note', detail: '/llms.txt を検出しました。ただし2026年の複数の実証(全AIボット流入の0.1%、有効な llms.txt の97%が当月未リクエスト、Googleは非対応を明言)により、本診断ではスコアに加点していません。設置自体は無害ですが、追加の工数投下は非推奨です。' }
        : { level: 'ok', detail: '/llms.txt は未設置です。2026年の実証では効果が確認されておらず、対応不要で問題ありません(優先度ゼロ)。' };
    },
  },
  {
    id: 'info.ai-index-path',
    title: 'AI検索の索引経路',
    src: ['law_index'],
    run(c) {
      const bing = c.robots.found ? c.robots.bots.find((b) => b.name === 'bingbot') : null;
      const gext = c.robots.found ? c.robots.bots.find((b) => b.name === 'Google-Extended') : null;
      const st = (b) => (!b ? '不明' : b.state === 'blocked' ? 'このURLはブロック' : b.sitewide ? 'サイト全体で拒否' : '許可');
      const parts = ['ChatGPT・Copilot は Bing インデックス、Claude は Brave、Gemini・AI Overviews は Google を経由します。'];
      if (bing) parts.push(`bingbot: ${st(bing)}。`);
      if (gext) parts.push(`Google-Extended: ${st(gext)}。`);
      parts.push('従来検索での順位実績そのものがAI被引用の強い予測指標であるため、基礎SEOの継続が最短経路になります。');
      return { level: bing && (bing.state === 'blocked' || bing.sitewide) ? 'warn' : 'note', detail: parts.join(' ') };
    },
  },
  {
    id: 'info.offsite',
    title: 'この診断で測れない領域(オフサイト)',
    src: ['evolve_85', 'ahrefs_youtube'],
    run() {
      return { level: 'note', detail: 'AI検索におけるブランド言及の85%は第三者ソース由来で、75,000ブランド調査ではYouTube上の言及が全シグナル中で最強の相関(約0.737)でした。この領域はURL単体では測定できないため、オフサイト自己診断ページで別途評価してください。' };
    },
  },
];

/* ── スコア集計 ──────────────────────────────── */
export function score(ctx) {
  const results = RULES.map((rule) => {
    let out;
    try {
      out = rule.run(ctx);
    } catch (e) {
      out = { skip: true, detail: `評価できませんでした(${e.message})` };
    }
    const status = out.skip ? 'skip' : out.unknown ? 'unknown' : out.score >= 0.85 ? 'pass' : out.score >= 0.5 ? 'warn' : 'fail';
    return { ...rule, ...out, status, lost: out.skip ? 0 : rule.weight * (1 - out.score) };
  });

  const cats = CATEGORIES.map((cat) => {
    const rs = results.filter((r) => r.cat === cat.id);
    const active = rs.filter((r) => !r.skip);
    const denom = active.reduce((s, r) => s + r.weight, 0);
    const num = active.reduce((s, r) => s + r.weight * r.score, 0);
    const pct = denom ? (num / denom) * 100 : null;
    return { ...cat, rules: rs, pct, denom, skipped: rs.length - active.length };
  });

  const wDenom = cats.filter((c) => c.pct !== null).reduce((s, c) => s + c.weight, 0);
  const wNum = cats.filter((c) => c.pct !== null).reduce((s, c) => s + c.weight * c.pct, 0);
  const total = wDenom ? Math.round(wNum / wDenom) : 0;

  const infos = INFO_CHECKS.map((i) => ({ ...i, ...i.run(ctx) }));

  const actions = results
    .filter((r) => !r.skip && r.score < 0.85)
    .sort((a, b) => {
      const ph = { P0: 0, P1: 1, P2: 2 };
      if (ph[a.phase] !== ph[b.phase]) return ph[a.phase] - ph[b.phase];
      return b.lost - a.lost;
    });

  return { total, grade: gradeOf(total), cats, results, infos, actions };
}

export function gradeOf(n) {
  if (n >= 90) return { label: 'A+', tone: 'good', text: '2026年基準で優秀' };
  if (n >= 80) return { label: 'A', tone: 'good', text: '良好・伸ばす段階' };
  if (n >= 70) return { label: 'B', tone: 'warning', text: '基礎は成立・改善余地大' };
  if (n >= 55) return { label: 'C', tone: 'warning', text: '要改善' };
  if (n >= 40) return { label: 'D', tone: 'serious', text: '構造的な課題あり' };
  return { label: 'E', tone: 'critical', text: 'AIから見えていない可能性が高い' };
}
