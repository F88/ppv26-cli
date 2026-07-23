# PRD: ppv-cli - ProtoPedia データ調査 CLI ツール

本書は実装済みの現行仕様の要約である。使い方と設定の詳細は [README.md](README.md)、開発情報は [DEVELOPMENT.md](DEVELOPMENT.md) を参照。設計判断の経緯と棄却した代替案は本書のメンテナンス対象から外した。必要なら git 履歴 (簡素化前の PRD) と Issue / PR の記録を参照する。

## 1. 概要

ProtoPedia のデータをローカル環境で調査するための CLI ツール群。 [promidas](https://www.npmjs.com/package/promidas) / [promidas-utils](https://www.npmjs.com/package/promidas-utils) / [protopedia-api-v2-client](https://www.npmjs.com/package/protopedia-api-v2-client) を組み合わせて構築する。

ProtoPedia API から取得したデータは snapshot としてローカルファイルに保存し、以降の起動では既存 snapshot をロードして利用する。これにより API への不要なリクエストを避け、オフラインでもデータ調査ができ、取得時点の異なる snapshot を比較・参照できる。

### 1.1 スコープ

- 配布は npm パッケージ (`npm install`) として行う。
- 単一バイナリ化などのバイナリファイル提供は行わない。

## 2. 動作環境

| 項目           | 要件                                  |
| -------------- | ------------------------------------- |
| OS             | macOS / Windows (両対応必須)          |
| ランタイム     | Node.js >= 22 (promidas の要件に準拠) |
| モジュール形式 | ESM                                   |
| 言語           | TypeScript                            |

Windows 対応のため、パス操作は `node:path` を使用し、パス区切り文字やホームディレクトリ解決を OS 依存にしない。

## 3. 用語

| 用語             | 意味                                                                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| snapshot         | ある時点で ProtoPedia API から取得した全 prototype データの集合。promidas の `SerializableSnapshot` を JSON ファイルとして保存したもの |
| repository       | promidas の `ProtopediaInMemoryRepository`。in-memory store と fetcher を統合した高レベル API                                          |
| ワンショット実行 | `ppv-cli <subcommand>` 形式で 1 回の実行で 1 操作を行う利用形態                                                                        |
| 対話モード       | 画面を占有する対話型の利用形態 (ppex / pptop)                                                                                          |

## 4. 提供機能

3 つのバイナリが同じ snapshot ファイルを共有する。

- `ppv-cli`: UNIX 風ワンショット CLI (パイプ前提)
- `ppex`: 対話エクスプローラ (Ink、日本語 UI)
- `pptop`: top(1) 風モニター (Ink、英語 UI)

### 4.1 ppv-cli (ワンショット CLI)

コマンド体系は「名詞 (操作対象) → 動詞」の 2 階層。操作対象は `config` (CLI 自体の設定) / `data` (ロード済みデータ全体) / `prototype` (個々の作品) / `snapshot` (ディスク上のファイル) の 4 種類。

```console
ppv-cli config init                 # ~/.ppv-cli/config をテンプレートで生成
ppv-cli config set-token            # トークンの対話設定
ppv-cli config show                 # 設定ファイルの中身・状態の表示
ppv-cli data analyze                # ロード済みデータの分析 (ID min/max)
ppv-cli data stats                  # ロード済みデータの状態表示 (getStats)
ppv-cli prototype list --last 20    # 最新 20 件を一覧 (ID 昇順)
ppv-cli prototype search LED cube   # キーワード検索 (複数指定は AND)
ppv-cli prototype search --tag M5Stack   # ファセットで絞り込み
ppv-cli prototype show 1234         # ID 指定で詳細 (JSON) 表示
ppv-cli snapshot create             # API から全件取得して snapshot 保存
ppv-cli snapshot list               # snapshot 一覧 (新しい順)
```

- 検索構文: キーワードは `prototypeNm` / `summary` への部分一致で複数指定は AND。ファセット (`--id` / `--tag` / `--user` / `--event` / `--material` / `--status`) は同一ファセット内 OR、ファセット間 AND。`--id` / `--status` は完全一致、他は部分一致。条件なしの実行はエラー。結果は ID 昇順のタブ区切り (ID・作品名・ユーザー)。
- `prototype list` は範囲指定必須 (`--all` / `--first <n>` / `--last <n>` のいずれか 1 つ)。出力形式は search と同一。
- データ系コマンドは明示指定がなければ最新 snapshot を無言でロードする。`--snapshot <file>` で特定ファイルを指定できる。
- `snapshot create` だけが API を呼ぶ (トークン必須)。取得は利用者の明示操作のみで、自動 fetch はしない。既存 snapshot は上書きせず新ファイルとして追加する。

### 4.2 ppex (対話エクスプローラ)

- 起動すると snapshot picker を提示する (最新がデフォルト選択、`[作成して選択]` あり、m キーで snapshot manager へ)。
- 検索機能は「作品探索」に統合: 6 フィールド (ID / 作品名 / 概要 / タグ / 素材 / ユーザー) のライブフィルタ + 選択追従のプレビューカード + 詳細表示 (JSON / カードのタブ切替、`r` で Raw 全文、`c` でクリップボードコピー)。
- 検索フォームの意味論: フィールド内スペース区切りは AND、フィールド間も AND。ID フィールドのみ前方一致かつスペース区切り OR。
- 端末幅 110 桁以上ではプレビューを右カラムに配置するレスポンシブレイアウト。非 TTY での起動は明示エラー。

### 4.3 pptop (top(1) 風モニター)

- 起動すると最新 snapshot を自動ロードし、即メイン画面に入る (なければ空テーブル)。
- top(1) 風の集計ヘッダ (時刻・経過時間・stale 表示、Newborns、ステータス内訳と %、engagement 合計、distinct 数) をテーブルの上に常時表示する。
- キーはコマンドとして扱う: `s` (snapshot 管理) / `/` (検索入力モード、ppex と共有の 6 フィールド) / ↑↓ PgUp PgDn (行選択) / Enter (詳細) / `R` (ソート反転) / `<` `>` (ソート列移動、PID が第 2 キー) / `?` `h` (ヘルプ) / `q` (終了)。
- テーブルはレスポンシブで、狭い端末では優先度の低い列から非表示になる。レイアウトは手計算せず `measureElement` の実測から導出する。

### 4.4 snapshot picker / manager (共有 UI)

- picker: snapshot 一覧の選択 UI。最新がデフォルトで Enter だけでロードできる。`[作成して選択]` と m キー (manager) を含む。
- manager: 既存の snapshots を UI から削除できる唯一の機能 (ppex / pptop 共通の 1 実装、`lang` prop で言語切替)。表示は検証済みの実測値のみで、ファイル名からの推定は出さない。一覧を開くと裏で 1 件ずつ自動検証する。Space でマーク → d で確認付き完全削除 (Trash は使わない)。c で作成 (ファイルを作るだけでロードしない)。

## 5. 設定

- 設定ファイルは `~/.ppv-cli/config` ただ 1 つ (KEY=VALUE の dotenv 互換形式)。トークンを含む全設定値の単一情報源 (SSOT) で、環境変数や `.env` は読まない。process.env には何も書き込まない。
- 有効なキーは 4 つ: `PROTOPEDIA_API_V2_TOKEN` / `PPV_CLI_SNAPSHOT_DIR` / `PPV_CLI_LOG_LEVEL` / `PPV_CLI_SNAPSHOT_STALE_HOURS`。各キーの意味とデフォルトは [README.md](README.md) を参照。認識されないキーは黙って無視する。
- 一回性の上書きは CLI オプションのみ (`--snapshot-dir` / `--snapshot` / `--verbose` / `--quiet`)。
- 起動時に 1 回だけ読み込み、無検証の生値 + 読み取り状態 (read / missing / unreadable) として保持する。unreadable のとき、設定を消費するコマンドはエラー停止する (config コマンドは修復手段なので除く)。
- 値の検証にフォールバックはない: 規定値が値に内在する 2 キー (`PPV_CLI_LOG_LEVEL` / `PPV_CLI_SNAPSHOT_STALE_HOURS`) は起動時に検査し、不正ならエラー停止する。デフォルトはキーが無い場合のみ適用する。
- config サブコマンドの規則: 結果は stdout、診断は stderr 直書き (ログ設定から独立)。トークンの完全値は決して出力しない (`****` + 末尾 4 文字)。ファイルを作成できるのは init だけで、読めないファイルをテンプレートで作り直すことはしない。
- 普通の利用者は `config set-token` のみで完結する。設定変更はファイル直接編集で、テンプレートのコメントが編集方法を説明する。

## 6. snapshot 仕様

- 形式: promidas の `SerializableSnapshot` (version / serializedAt / prototypes) をそのまま JSON 化。独自ラッパーは追加しない。
- ファイル命名: `snapshot-<serializedAt の UTC タイムスタンプ>-<件数>.json` (例: `snapshot-20260715T100000Z-1234.json`)。ファイル名だけで一覧表示を構成でき、正式なメタ情報はファイル内の `serializedAt` を正とする。
- 保存先の解決順序: `--snapshot-dir` オプション → 設定の `PPV_CLI_SNAPSHOT_DIR` → デフォルト `~/.ppv-cli/snapshots/`。
- 「最新」の判定はファイル名タイムスタンプの降順。規則外のファイル名は一覧の末尾に回す。
- 鮮度: ロードした snapshot がしきい値 (デフォルト 1 時間、`PPV_CLI_SNAPSHOT_STALE_HOURS` で変更) より古い場合、更新を促す警告を出す。自動 fetch はしない。鮮度はファイル名のタイムスタンプで判定し、同じ値を store の TTL にも使う。
- 世代管理 (自動削除・prune) は行わない。

## 7. 設計原則

- レイヤ構成: `ppxxx/` (各バイナリ) → `ui/` (共有 Ink コンポーネント) → `core/` (共有の非 React ロジック) → promidas / promidas-utils → protopedia-api-v2-client。依存方向は一方通行で、ワンショット系 (ppv-cli) は `ui/` を import しない (Ink の閉じ込めをこの規則で保証する)。
- バイナリ 1 つ = src 直下のエントリ 1 ファイル + 同名ディレクトリ 1 つ。bin 追加は package.json に 1 行足すだけ。
- 出力規約: コマンドの結果 (JSON 等) は stdout、ログ・診断は stderr。終了コードは正常 0 / エラー 1 (スクリプト利用を考慮)。
- ロガー: 解決順序は `--quiet` (error のみ) > `--verbose` (debug) > `PPV_CLI_LOG_LEVEL` > デフォルト info。ライブラリ層は通常 warn 以上に抑制する。UI 表示中は silent。
- エラーハンドリング: promidas-utils/file-io の Result 型 (`FileIoError.kind`) を判定してユーザー向けメッセージに変換する。`SETUP_FAILED` は `toLocalizedMessage()` の日本語メッセージを表示する。エラー表現の網羅はエコシステムの責務とし、アプリ側で再実装しない。
- repository 生成は `PromidasRepositoryBuilder` (factory 関数は使わない)。進捗表示は promidas のイベント + `FetchProgressEvent` を消費し、4xx/5xx のエラー本文の転送を成功と表示しない (`status` を確認する)。
- 主要ライブラリ: promidas (repository / 型) / promidas-utils (token / file-io / エラー変換) / dotenv (parse のみ) / commander (ppv-cli) / ink (ppex / pptop)。

## 8. 非機能要件

- 既存 snapshot 利用時はネットワーク接続なしで全機能が動作すること (fetch を除く)。
- snapshot のロードと検索は、数千件規模のデータで体感上ストレスのない速度で動作すること。
- 文字化けなく日本語データを扱えること (UTF-8)。
- エラー時は原因がわかるメッセージを日本語で表示すること (pptop の UI 文言のみ英語)。
- JSON 出力はパイプ処理可能な形式で stdout に出すこと。
