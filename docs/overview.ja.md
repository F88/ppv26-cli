# 作品概要

## Title

ProtoPedia Viewer CLI tools

## Summary (100)

CLIでもProtoPediaを探索。作品のメタデータ確認や調査が捗るかもしれません。基本的には開発者向きのツールです。

## Story (2000)

### 動作環境

- Node.js 22 以上
- ProtoPedia API Ver 2.0 トークン (<https://protopediav2.docs.apiary.io/>)

### 概要

ProtoPedia API Ver 2.0 を使ってアプリケーションを開発する開発者向けのツール群です。取得したデータをローカルのsnapshotとして保存し、フィールド値・raw JSON・件数といった実データをオフラインで検索・絞り込み・調査できます。
調査の為に毎回APIを叩かずに済むので、開発者の作業効率が上がるかもしれません。

本ツールは 🧰 PROMIDAS (<https://protopedia.net/prototype/7917>) の上に構築されており、API レスポンスの一部は扱いやすい形に正規化されています (日時にはタイムゾーンオフセットが付き、users や tags のようなパイプ区切り文字列は配列になります)。

3つのツールを提供中

- pptop: top(1) スタイルの作品モニター。集計ヘッダとソート・フィルタ可能なテーブル。
- ppex: インタラクティブな探索ツール (ProtoPedia EXplorer)。
- ppv-cli: ワンショットでパイプしやすい UNIX 風 CLI。結果は stdout (JSON またはタブ区切り)、ログは stderr

### クイックガイド

1. インストール

```shell
npm install -g ppv26-cli
```

1. API トークンを設定

```shell
ppv-cli config set-token
```

1. スナップショット作成 (APIアクセス)

```shell
ppv-cli snapshot create
```

あとはオフラインで即座に利用出来ます。

```text
ppex                       # 対話型の探索ツール
pptop                      # top(1) 風モニター
ppv-cli prototype show 1   # 1 作品を JSON で表示
```
