# 作品概要

## Title

ProtoPedia Viewer CLI tools

## Summary (100)

CLIでもProtoPediaを探索。作品のメタデータ確認や調査が捗るかもしれません。基本的には開発者向きのツールです。

## Story (2000)

APIを利用するアプリケーションの開発では、調査、デバッグなど、頻繁なデータ探索が不可欠。とはいえ毎回APIを叩くのはお行儀も悪く非効率、NW障害などの障害耐性も低い。

我々のために、調査、開発を助けるツールがあればなにかと便利なはず、MCPサーバーまで登場したこの時代にAIフリーなツールです。

## 概要

ProtoPedia API Ver 2.0 を使ってアプリケーションを開発する開発者向けのツール群です。取得したデータをローカルのsnapshotとして保存し、フィールド値・raw JSON・件数といった実データをオフラインで検索・絞り込み・調査できます。
調査の為に毎回APIを叩かずに済むので、開発者の作業効率が上がるかもしれません。

## 3つのツール

- pptop: top(1) スタイルの作品モニター。集計ヘッダとソート・フィルタ可能なテーブル。
- ppex: インタラクティブな探索ツール (ProtoPedia EXplorer)。
- ppv-cli: ワンショットでパイプしやすい UNIX 風 CLI。結果は stdout (JSON またはタブ区切り)、ログは stderr

## 動作環境

- Node.js 22 以上
- ProtoPedia API Ver 2.0 トークン <https://protopediav2.docs.apiary.io/>

## クイックガイド

インストール

```shell
npm install -g ppv26-cli
```

API トークンを設定

```shell
ppv-cli config set-token
```

スナップショット作成 (APIアクセス)

```shell
ppv-cli snapshot create
```

あとはオフラインで即座に利用出来ます。

```text
ppex                       # 対話型の探索ツール
pptop                      # top(1) 風モニター
ppv-cli prototype show 1   # 1 作品を JSON で表示
```
