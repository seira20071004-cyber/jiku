# Googleログインの設定と運用

Google認証のサーバー実装は `worker/auth.js` にあります。公開版はGoogle認証に切り替える構成です。Sites側の入口とアプリ本体の認証を分離し、アプリ本体はGoogleの許可アカウントだけに提供します。

melloで使った方式はFirebaseではなく、Google CloudのOAuthクライアントを使うサーバー側の認証でした。既存のクライアントを流用する場合も、jiku用のコールバックURLを追加する必要があります。melloの秘密情報はこのリポジトリにはコピーしていません。

## 必要な設定

1. Google Cloudの「Google Auth Platform → クライアント」で利用するWebアプリケーションのOAuthクライアントを選択します。
2. 承認済みリダイレクトURIに次の値を追加します（既存のmelloのURIは残します）。

   `https://jiku-life-tree.seira20071004.chatgpt.site/api/auth/google/callback`

3. 公開先の秘密設定に `.env.example` に記載した変数を登録します。セッション署名キーはJiku専用の新しいランダムな32バイト以上の値を使います。`JIKU_ALLOWED_EMAILS` はまず所有者だけのGoogleメールアドレスにします。既存の設定を維持したまま利用者を追加する場合は、`JIKU_ADDITIONAL_ALLOWED_EMAILS` に追加で許可するGoogleメールアドレスをカンマ区切りで登録します。
4. `.openai/hosting.json` から `static` の指定を外して `npm run build` を実行し、生成された `dist/server/index.js` をデプロイします。秘密情報はビルド時には埋め込まれず、ランタイム環境変数から読み込みます。
5. 現在のSitesの外側のChatGPTログインとGoogleログインは別の認証です。Googleのみを入口とするには、Sites側の入口のアクセス設定変更、または別の公開先への配置が必要です。これは公開範囲の変更になるため、所有者が方針を選んでから行います。入口を公開してもGoogleモードのサーバーは許可されたアカウント以外にアプリのHTML・JS・データ操作を提供しません。
6. Googleでの実ログイン、許可外アカウントの拒否、ログアウト、アカウントを切り替えた際のデータ分離を実環境で確認します。

Googleログイン後の記録もブラウザ内保存です。保存キーはGoogleのユーザーIDごとに分かれ、ログインだけでは端末間同期されません。従来の記録は `jiku-v1` に残り、Googleアカウントの記録は `jiku-v1:<user-id>` に保存されます。同じブラウザでの初回Googleログイン時に、既存の記録を引き継ぐか選べます。元の記録は削除しません。バックアップを本人のアカウントでログインしてから読み込む方法でも引き継げます。

## 保護

- OAuthコード交換・ユーザー情報取得はサーバーのみ。アクセストークンとクライアントシークレットをブラウザには返しません。
- PKCE S256、署名付きstate cookie、10分の認証フロー期限、HttpOnly/Secure/SameSite=Lax Cookieを使用します。
- メール確認済みの許可アカウントだけに、7日間の署名付きセッションを発行します。
- ログアウトは同一オリジンのPOSTだけを許可します。
- 公開WorkerはGoogle認証が無効または必要な設定が不足していると、認証を省略せず503で停止します。

Google公式資料: https://developers.google.com/identity/protocols/oauth2/web-server
