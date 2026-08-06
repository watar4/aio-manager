/**
 * 出典レジストリ
 * すべての診断ロジック・スコア重み・推奨アクションは、この一覧のいずれかの出典に紐づく。
 * 出典は「2026年に公開・発表された情報」を原則とする(素材レポートの方針に準拠)。
 * grade: 事実 = 一次情報・公開データ / 推定 = 解釈 / 参考 = 集計系メディア経由
 */
export const SOURCES = {
  /* ── レンダリング・技術 ───────────────────────────── */
  torres_js: {
    claim: 'AIクローラーの69%はJavaScriptを実行できない。Googleで上位表示できていてもAIからはほぼ空のページに見える。重要コンテンツはサーバーレンダリングHTML内に置くこと',
    origin: 'SMX Advanced 2026(2026-06-03〜05・ボストン)/ Sam Torres',
    kind: 'カンファレンス発表',
    url: 'https://www.arcintermedia.com/shoptalk/smx-advanced-boston-2026-recap-what-you-should-know/',
    grade: '事実',
  },
  brighton_bot_traffic: {
    claim: 'AIクローラー・エージェントがウェブトラフィックの約12%を占める',
    origin: 'BrightonSEO Spring 2026(2026-04-30〜05-01・ブライトン)',
    kind: 'カンファレンス発表',
    url: 'https://strategiq.co/hub/brighton-seo-april-2026-takeaways/',
    grade: '事実',
  },
  law_index: {
    claim: 'ChatGPTはBingインデックス、ClaudeはBrave、GeminiはGoogleを利用。従来検索でのランキング実績がAI検索での被引用の強い予測指標',
    origin: 'BrightonSEO Spring 2026 / Ryan Law(Ahrefs)',
    kind: 'カンファレンス発表',
    url: 'https://marswebsites.co.uk/brightonseo-2026-takeaways-an-ai-search-reality-check/',
    grade: '事実',
  },
  capper_viewport: {
    claim: '中央値の1位デスクトップ結果は画面上端から635ピクセル下(ビューポート800〜900px)。中央値の2位は画面外',
    origin: 'SMX Advanced 2026 / Tom Capper',
    kind: 'カンファレンス発表',
    url: 'https://www.level.agency/perspectives/smx-advanced-2026-recap/',
    grade: '事実',
  },

  /* ── 構造化データ ───────────────────────────────── */
  otterly_schema: {
    claim: '統制実験(2025-12-07〜2026-03-07)でスキーマ実装後のブランド可視性は Google AI Overviews +611% / AI Mode +42% / Perplexity 0% / Gemini ▲35% / Copilot ▲64% / ChatGPT ▲71%',
    origin: 'Otterly AI 統制実験(2026年公開)',
    kind: '統制実験',
    url: 'https://otterly.ai/blog/schema-markup-real-impact-ai-search/',
    grade: '事実',
  },
  otterly_schema_only: {
    claim: 'スキーマにのみ存在する情報は、全プラットフォームが正しく回答できなかった。スキーマ取得テストに成功したのはGeminiのみ(Google AI Modeは存在しないスキーマをハルシネーション)',
    origin: 'Otterly AI 統制実験(2026年公開)',
    kind: '統制実験',
    url: 'https://otterly.ai/blog/schema-markup-real-impact-ai-search/',
    grade: '事実',
  },
  brighton_schema_1500: {
    claim: 'スキーママークアップはGoogle AI Overviewsでの可視性を最大1,500%改善する(他AIプラットフォームには波及しない)',
    origin: 'BrightonSEO Spring 2026',
    kind: 'カンファレンス発表',
    url: 'https://www.adaptworldwide.com/2026/05/14/brightonseo-april-2026-9-key-takeaways-you-need-to-know/',
    grade: '事実',
  },

  /* ── llms.txt ──────────────────────────────────── */
  peham_llmstxt: {
    claim: '12か月のGEO実験の結果、llms.txt は全AIボット流入のわずか0.1%しか獲得していない',
    origin: 'BrightonSEO Spring 2026 / Thomas Peham(Otterly AI)',
    kind: 'カンファレンス発表',
    url: 'https://www.glow-ai.co.uk/post/brightonseo-april-2026-what-the-event-taught-us-about-ai-search-and-the-future-of-seo',
    grade: '事実',
  },
  ahrefs_llmstxt: {
    claim: '137,210ドメインのボットログ分析で、有効な llms.txt の97%は当月一度もリクエストされず、リクエストの約77%は非AIソース由来',
    origin: 'Ahrefs(2026年5月)',
    kind: '大規模ログ分析',
    url: 'https://ahrefs.com/blog/llmstxt-study/',
    grade: '事実',
  },
  google_llmstxt: {
    claim: 'Google は llms.txt を「サポートしないし予定もない」と確認(Search Central Live / Gary Illyes)',
    origin: 'Google(2026年)',
    kind: 'プラットフォーム公式',
    url: 'https://www.searchenginejournal.com/google-says-llms-txt-is-purely-speculative-for-now/577576/',
    grade: '事実',
  },

  /* ── コンテンツ・エンティティ ─────────────────────── */
  meyers_fanout: {
    claim: 'キーワード研究は「孤立したロングテール」から「ファンアウトクエリのネットワーク管理」へ転換。シードキーワード2〜4個から10〜12ワードのプロンプトへ拡張しクラスタ分析する',
    origin: 'BrightonSEO Spring 2026 閉会基調講演 / Dr Pete Meyers(Moz)',
    kind: 'カンファレンス発表',
    url: 'https://strategiq.co/hub/brighton-seo-april-2026-takeaways/',
    grade: '事実',
  },
  anderson_graph: {
    claim: 'RAGシステムではコンテンツ構造が重要。エンティティ関係を写像した「コンテキストグラフ」が必須',
    origin: 'SMX Advanced 2026 / Dawn Anderson',
    kind: 'カンファレンス発表',
    url: 'https://www.level.agency/perspectives/smx-advanced-2026-recap/',
    grade: '事実',
  },
  simmons_entity: {
    claim: 'エンティティ獲得の4領域フレームワーク=エンティティマッピング / オンページシグナル / スキーマ / 内部リンク構造',
    origin: 'SMX Advanced 2026 / Grant Simmons',
    kind: 'カンファレンス発表',
    url: 'https://www.level.agency/perspectives/smx-advanced-2026-recap/',
    grade: '事実',
  },
  petrovic_brand: {
    claim: '単語1語のブランド名は複数語ブランドより約8倍多くAIに推奨される。YouTubeコンテンツが過度に引用される傾向',
    origin: 'Ahrefs Evolve 2026(2026年5月・シンガポール)/ Dan Petrovic(DEJAN)',
    kind: 'カンファレンス発表',
    url: 'https://www.gravitykit.com/takeaways-from-ahrefs-evolve-2026/',
    grade: '事実',
  },
  davies_freshness: {
    claim: '8つの検索回復シグナル(コンテンツ更新・エンティティ整合・技術的アクセス性など)。見せかけの「鮮度」では不十分で実質的な更新が必須',
    origin: 'SMX Advanced 2026 / Dave Davies',
    kind: 'カンファレンス発表',
    url: 'https://www.arcintermedia.com/shoptalk/smx-advanced-boston-2026-recap-what-you-should-know/',
    grade: '事実',
  },
  evolve_commodity: {
    claim: 'AIが既存情報から合成できるコンテンツは市場価値を失う。逆に具体的な実装チュートリアル・ハウツーは高い被引用価値を保つ',
    origin: 'Ahrefs Evolve 2026',
    kind: 'カンファレンス発表',
    url: 'https://www.gravitykit.com/takeaways-from-ahrefs-evolve-2026/',
    grade: '事実',
  },
  geo_survey: {
    claim: '統計・数値・引用・権威ある出典の明示が生成エンジンでの採用率を上げる。GEO研究の批判的サーベイ',
    origin: 'arXiv 2607.14035「A Critical Survey of Generative Engine Optimization」(2026-07-15版)',
    kind: '学術論文',
    url: 'https://arxiv.org/pdf/2607.14035',
    grade: '事実',
  },

  /* ── オフサイト・第三者言及 ───────────────────────── */
  evolve_85: {
    claim: 'AI検索におけるブランド言及の85%が第三者ソース由来',
    origin: 'Ahrefs Evolve 2026',
    kind: 'カンファレンス発表',
    url: 'https://www.gravitykit.com/takeaways-from-ahrefs-evolve-2026/',
    grade: '事実',
  },
  ahrefs_youtube: {
    claim: '75,000ブランド調査で、YouTube上のブランド言及が全シグナル中で最強の相関(約0.737)',
    origin: 'Ahrefs(2026-05-26発表)',
    kind: '大規模調査',
    url: 'https://ahrefs.com/blog/ai-overview-brand-correlation/',
    grade: '事実',
  },
  brighton_youtube: {
    claim: 'YouTubeはLLMで2番目に多く引用されるソーシャルプラットフォーム。Redditは実質的にAIモデルのデータベースとして機能している',
    origin: 'BrightonSEO Spring 2026',
    kind: 'カンファレンス発表',
    url: 'https://strategiq.co/hub/brighton-seo-april-2026-takeaways/',
    grade: '事実',
  },
  semrush_thirdparty: {
    claim: 'AIは統計的パターンに基づいて答えを生成するため事実をライブソースに照合しない。最も効果的なアプローチは公式サイトのみを更新することではなく、AIが参照している第三者ソースを修正すること',
    origin: 'Semrush(2026-05-08)',
    kind: '業界調査',
    url: 'https://www.semrush.com/blog/fix-ai-brand-misinformation/',
    grade: '事実',
  },
  ziptie_frequency: {
    claim: 'LLMは「何が公式か」を知らず「何が頻繁に言及されているか」を知っている。古い比較記事・レビューが自社サイトの記述を上回る',
    origin: 'ZipTie.dev(2026年)',
    kind: '業界調査',
    url: 'https://ziptie.dev/blog/how-to-fix-incorrect-ai-brand-information/',
    grade: '事実',
  },

  /* ── 測定・KPI ─────────────────────────────────── */
  goodman_no_replace: {
    claim: 'AI経由トラフィックは失われたオーガニッククリックを代替しない。従来のアナリティクスは多くのユーザー相互作用を見落としている。可視性がトラフィックに代わる中心指標へ',
    origin: 'SMX Advanced 2026 / Eli Goodman',
    kind: 'カンファレンス発表',
    url: 'https://www.level.agency/perspectives/smx-advanced-2026-recap/',
    grade: '事実',
  },
  virji_measure: {
    claim: '企業は「時間短縮」「生成コンテンツ数」というAI活動量を測っており、実際のビジネス成果を測っていない。AI戦略は売上・成長・効率・競争優位に紐づけるべき',
    origin: 'SMX Advanced 2026 / Purna Virji',
    kind: 'カンファレンス発表',
    url: 'https://www.level.agency/perspectives/smx-advanced-2026-recap/',
    grade: '事実',
  },
  negrescu_volume: {
    claim: '「プロンプトボリューム」の推定値は監査不可能で一貫性がない。LLM引用トラッキングツールはマーケティング的側面が強い',
    origin: 'BrightonSEO Spring 2026 / Cosmin Negrescu(SEOmonitor)',
    kind: 'カンファレンス発表',
    url: 'https://marswebsites.co.uk/brightonseo-2026-takeaways-an-ai-search-reality-check/',
    grade: '事実',
  },
  demandlocal_23: {
    claim: 'AI OverviewsまたはLLMの引用を獲得したブランドは、直接クリックがなくても続く30日間で指名検索が23%増加',
    origin: 'Demand Local「28 AI Citation Brand Lift Statistics in 2026」',
    kind: '業界調査',
    url: 'https://www.demandlocal.com/blog/ai-citation-brand-lift-statistics/',
    grade: '参考',
  },
  airops_selfreport: {
    claim: '自己申告アトリビューションがAI検索の成果捕捉に最も有効な手法。デジタル計測ツールが取りこぼすチャネルの30〜50%を捕捉できる',
    origin: 'AirOps / KDG(2026年)',
    kind: '業界調査',
    url: 'https://www.airops.com/blog/ai-search-pipeline-attribution',
    grade: '参考',
  },
  goodfirms_14: {
    claim: '89%のブランドがすでにAI検索結果に登場している一方、AI引用の可視性を能動的に追跡しているマーケターは14%のみ',
    origin: 'Goodfirms(2026年)',
    kind: '業界調査',
    url: 'https://www.goodfirms.co/resources/seo-statistics-ai-search-rankings-zero-click-trends',
    grade: '参考',
  },
  churn_domains: {
    claim: '引用ドメインは毎月40〜60%が入れ替わる',
    origin: 'BrightonSEO Spring 2026 ほか',
    kind: 'カンファレンス発表',
    url: 'https://search.agency/blog/ai-search-measurement',
    grade: '参考',
  },

  /* ── 市場・行動変化 ─────────────────────────────── */
  ahrefs_ctr58: {
    claim: 'AI Overviews 表示時、オーガニック1位のCTRは▲58%(2025年4月時点の▲34.5%からほぼ倍に拡大)',
    origin: 'Ahrefs(2026年2月公開)',
    kind: '大規模調査',
    url: 'https://contently.com/2026/04/27/ai-overview-traffic-impact/',
    grade: '事実',
  },
  ahrefs_jp47: {
    claim: '日本におけるAI Overviews表示率は47%。2026年5月時点でGoogle検索クエリの48%超にAI Overviewsが出現',
    origin: 'Ahrefs(2026年4月調査)',
    kind: '大規模調査',
    url: 'https://contently.com/2026/04/27/ai-overview-traffic-impact/',
    grade: '事実',
  },
  mozcon_88: {
    claim: '情報探索型クエリの約88%がAI Overviewsに至る。従来のSEO手法ではなくインテント起点の可視性が成否を分ける',
    origin: 'MozCon 2026(NYC)',
    kind: 'カンファレンス発表',
    url: 'https://thenextweb.com/news/seo-conferences-2026-mozcon-ahrefs-evolve-brightonseo-spotlight-smx',
    grade: '事実',
  },
  webfx_92: {
    claim: '約60万AIセッションの分析で、AIセッションの92%が「比較検討段階」または「意思決定段階」のコンテンツに着地。認知段階のページはわずか2.3%',
    origin: 'WebFX(2026年)',
    kind: '大規模実測',
    url: 'https://www.prweb.com/releases/webfx-study-analyzes-nearly-600-000-ai-sessions-finds-92-of-traffic-lands-on-consideration-and-decision-stage-content-302834597.html',
    grade: '事実',
  },
  brightedge_42_79: {
    claim: '比較検討段階ではブランド自社コンテンツが引用の42〜79%を占め、レビュー・比較アグリゲーターは1〜7%にとどまる',
    origin: 'BrightEdge(8業種調査・2026年)',
    kind: '業界調査',
    url: 'https://www.brightedge.com/resources/weekly-ai-search-insights/why-middle-ai-search-funnel-still-matters-brand-owned-content-wins',
    grade: '事実',
  },
  lseo_midfunnel: {
    claim: 'ミドルファネルで問われるのは製品比較・導入時の懸念・ベンダー間の差・顧客適合性・価格の論理・成果の証明',
    origin: 'lseo(2026年)',
    kind: '業界調査',
    url: 'https://lseo.com/generative-engine-optimization/owning-the-comparison-layer-how-ai-search-reshapes-mid-funnel-content/',
    grade: '事実',
  },
  aicas: {
    claim: 'AI時代の消費者購買行動モデル「AICAS」。AISASの Search が Ask(AIへの相談)と Confirm(確認)に置き換わる。500人独自調査に基づく',
    origin: '日経クロストレンド(2026-04-15提唱)',
    kind: '独自調査',
    url: 'https://xtrend.nikkei.com/atcl/contents/18/01354/00006/',
    grade: '事実',
  },
  neo_65: {
    claim: 'AI利用者の65.8%が「AIへの相談が購買に直結した」と回答、86.9%が今後も利用する意向。生成AI利用者の62.5%が商品選定にAIを活用',
    origin: 'ネオマーケティング 1,000人調査(2026年)',
    kind: '独自調査',
    url: 'https://note.com/neo_media/n/nf97b642ffcb3',
    grade: '事実',
  },
  semrush_cep: {
    claim: 'CEP(カテゴリーエントリーポイント)をAI検索戦略の起点に据える。1つのCEPから複数のプロンプト表現が生まれ、AIは表現が数十通り違っても同じ記事を引用し続けた。公開1週間でシェア・オブ・ボイス15%→26%',
    origin: 'Semrush(2026-06-18)',
    kind: '実験付き業界調査',
    url: 'https://www.semrush.com/blog/category-entry-points-ai-search/',
    grade: '事実',
  },
  solis_geo_is_seo: {
    claim: 'GEOとしてパッケージ化されているものの多くは、枠組みを外せば強固な基礎SEO。AI回答に引用されるブランドは、従来検索で上位表示されたのと同じ理由で引用を得ている',
    origin: 'SMX Advanced 2026 / Aleyda Solis',
    kind: 'カンファレンス発表',
    url: 'https://searchengineland.com/smx/advanced/agenda',
    grade: '事実',
  },
  scott_ops: {
    claim: 'GEOはオペレーション課題。3本柱=明確性・接続性・遍在性(Clarity/Connectivity/Ubiquity)。勝つ組織は情報をウェブ全体で作成・検証・流通・監視する反復可能なプロセスを持つ組織',
    origin: 'SMX Advanced 2026 / Will Scott(Search Influence)',
    kind: 'カンファレンス発表',
    url: 'https://www.searchinfluence.com/blog/will-scott-smx-advanced-agentic-seo-geo-2026/',
    grade: '事実',
  },
  google_ai_guide: {
    claim: 'Googleが2026年に初の公式「AI検索最適化ガイド」を公開。「生成AI検索への最適化は検索体験への最適化であり、したがって依然としてSEOである」と明記。生成AIモデルが再現できない独自視点・一次体験・専門的な深さを持つコンテンツを推奨',
    origin: 'Google Search Central(最終更新 2026-07-10)',
    kind: 'プラットフォーム公式',
    url: 'https://developers.google.com/search/docs/fundamentals/ai-optimization-guide',
    grade: '事実',
  },
  google_io_2026: {
    claim: 'AI Mode が Gemini 3.5 Flash 搭載で全世界のデフォルト検索体験に。月間10億ユーザーを突破。Information Agents を2026年夏提供開始',
    origin: 'Google公式ブログ(2026-05-19)',
    kind: 'プラットフォーム公式',
    url: 'https://blog.google/products-and-platforms/products/search/search-io-2026/',
    grade: '事実',
  },

  /* ── エージェンティックコマース ───────────────────── */
  ucp: {
    claim: '2026年1月にGoogle UCPを公開、3月にカート対応と商品カタログアクセスを追加。Merchant Centerが「AIがマーチャントのオファーを解釈する一次ソース」になる。`native_commerce`属性、`/.well-known/ucp`マニフェスト、商品IDと決済APIの一致、`consumer_notice`属性が要件。UCP取引は従来のGoogle Analyticsに記録されないためサーバー側追跡が必要',
    origin: 'Google公式 UCPドキュメント / Semrush(2026-03-26)',
    kind: 'プラットフォーム公式',
    url: 'https://developers.google.com/merchant/ucp',
    grade: '事実',
  },
  acp: {
    claim: '2026-02-16 にACPベースの Instant Checkout をローンチ、2026-03-04 に「マーチャント主導のチェックアウト」モデルへ方針転換。UCP/ACP両対応マーチャントは単一プロトコル店舗より40%多くのエージェント経由トラフィックを獲得',
    origin: 'OpenAI / Dataiads・ecorpit(2026年)',
    kind: '業界調査',
    url: 'https://www.dataiads.io/en/blog/google-ucp-openai-acp-protocol-checklist-agentic-commerce',
    grade: '参考',
  },
  risley_agentic: {
    claim: 'エージェントコマースの3本柱=アクセス可能性・理解可能性・権威性。データフィード同期とProduct Schema実装を推奨',
    origin: 'SMX Advanced 2026 / Kyle Risley',
    kind: 'カンファレンス発表',
    url: 'https://www.level.agency/perspectives/smx-advanced-2026-recap/',
    grade: '事実',
  },
  nrf_agentic: {
    claim: '2025年末時点で消費者のほぼ60%がすでに買い物にAIを利用。McKinseyは2030年までに米国小売売上の9,000億〜1兆ドルがAIエージェント経由に再編されると予測。商品データ品質が「共通通貨」として機能する',
    origin: 'NRF 2026 / Shoptalk 2026',
    kind: 'カンファレンス発表',
    url: 'https://www.columbusglobal.com/services/digital-commerce/agentic-commerce/nrf-2026-key-takeaways-summary/',
    grade: '事実',
  },

  /* ── 日本市場 ─────────────────────────────────── */
  jp_market: {
    claim: '国内のAI検索利用率は全体26.7%、10〜20代では47.4%。AI検索は情報探索型トラフィックを確実に減らすが、ECの購買意図クエリは相対的に保護される',
    origin: 'AI検索パートナーズ / 0120.co.jp ほか(2026年)',
    kind: '業界調査',
    url: 'https://ai-search.techsuite.co.jp/4629/',
    grade: '参考',
  },
};

/** AIクローラー・エージェントの一覧(robots.txt 判定用) */
export const AI_BOTS = [
  { name: 'OAI-SearchBot', vendor: 'OpenAI', role: 'ChatGPT検索のインデックス', critical: true },
  { name: 'ChatGPT-User', vendor: 'OpenAI', role: 'ユーザー操作による取得', critical: true },
  { name: 'GPTBot', vendor: 'OpenAI', role: '学習用クロール', critical: false },
  { name: 'PerplexityBot', vendor: 'Perplexity', role: '検索インデックス', critical: true },
  { name: 'Perplexity-User', vendor: 'Perplexity', role: 'ユーザー操作による取得', critical: true },
  { name: 'ClaudeBot', vendor: 'Anthropic', role: 'クロール', critical: true },
  { name: 'Claude-User', vendor: 'Anthropic', role: 'ユーザー操作による取得', critical: true },
  { name: 'Google-Extended', vendor: 'Google', role: 'Gemini / AI Overviews のグラウンディング', critical: true },
  { name: 'bingbot', vendor: 'Microsoft', role: 'ChatGPT・Copilot の索引元', critical: true },
  { name: 'CCBot', vendor: 'Common Crawl', role: '学習データ源', critical: false },
  { name: 'Applebot-Extended', vendor: 'Apple', role: 'Apple Intelligence', critical: false },
  { name: 'meta-externalagent', vendor: 'Meta', role: 'Meta AI', critical: false },
  { name: 'Amazonbot', vendor: 'Amazon', role: 'Alexa / Rufus', critical: false },
  { name: 'DuckAssistBot', vendor: 'DuckDuckGo', role: 'DuckAssist', critical: false },
  { name: 'MistralAI-User', vendor: 'Mistral', role: 'Le Chat', critical: false },
  { name: 'Bytespider', vendor: 'ByteDance', role: 'Doubao', critical: false },
];

/** 手動での可視性チェックに使うAI検索サービス */
export const AI_ENGINES = [
  { id: 'chatgpt', name: 'ChatGPT', deepLink: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}`, index: 'Bing' },
  { id: 'aimode', name: 'Google AI Mode', deepLink: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}&udm=50`, index: 'Google' },
  { id: 'aio', name: 'Google AI Overviews', deepLink: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`, index: 'Google' },
  { id: 'perplexity', name: 'Perplexity', deepLink: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`, index: '独自 + 各種' },
  { id: 'copilot', name: 'Copilot', deepLink: (q) => `https://copilot.microsoft.com/?q=${encodeURIComponent(q)}`, index: 'Bing' },
  { id: 'claude', name: 'Claude', deepLink: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`, index: 'Brave' },
];
