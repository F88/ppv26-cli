# 作品概要

## ProtoPedia

### Title

ProtoPedia Viewer CLI tools

### Summary (100)

```text
ProtoPedia を探索する 3 つの CLI (ppv-cli / ppex / pptop)。全作品を snapshot にしてローカル保存し、オフラインで検索・調査できる。
```

### Story

```text
ProtoPedia API Ver 2.0 を使ってアプリケーションを開発する開発者向けのツール群です。全作品を一度だけ取得してローカルの snapshot ファイルに保存し、以降は API を叩かずに、フィールド値・raw JSON・件数といった実データをオフラインで検索・絞り込み・調査できます。

🧰 PROMIDAS (https://protopedia.net/prototype/7917) の上に構築されており、API レスポンスの一部は扱いやすい形に正規化されています (日時にはタイムゾーンオフセットが付き、users や tags のようなパイプ区切り文字列は配列になります)。

3 つのツールは同じ snapshot ファイルを共有し、それぞれ異なる UI スタイルを試しています:

- ppv-cli: ワンショットでパイプしやすい UNIX 風 CLI。結果は stdout (JSON またはタブ区切り)、ログは stderr
- ppex: インタラクティブな探索ツール (Ink 製。ProtoPedia EXplorer)。検索フォームで即時絞り込みし、raw JSON まで掘れる
- pptop: top(1) スタイルの snapshot モニター (Ink 製)。集計ヘッダとソート・フィルタ可能なテーブル

インストール: npm install -g ppv26-cli

npm: https://www.npmjs.com/package/ppv26-cli
GitHub: https://github.com/F88/ppv26-cli
```
