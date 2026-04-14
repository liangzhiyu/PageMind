# PageMind — AI Page Summarizer & Chat Assistant

**[English](#english) · [中文](#中文) · [日本語](#日本語) · [한국어](#한국어) · [Deutsch](#deutsch) · [Français](#français)**

---

<a name="english"></a>
## 🇺🇸 English

> Summarize any web page and chat with it using your own AI model — right in the Chrome side panel.

### Features

- **One-click summarize** — Click the toolbar icon and PageMind instantly reads and summarizes the current page. No copy-paste needed.
- **Multi-turn chat** — Ask follow-up questions about the page content. PageMind maintains conversation context across turns.
- **Slash commands** — Type `/` to trigger built-in commands: `/mindmap`, `/tldr`, `/critique`. Fully customizable in Settings.
- **Custom AI model** — Works with any OpenAI-compatible API: OpenAI, Ollama (local), LM Studio, MiniMax, and more. You bring your own key.
- **Streaming responses** — Answers stream in real-time, word by word, with a smooth iMessage-style bubble UI.
- **Reasoning model support** — Displays `<think>` reasoning blocks in a collapsible section, with animated indicator while the model is thinking.
- **Dark mode** — Automatically follows your system appearance.
- **Multi-language UI** — Interface available in English, 中文, 日本語, 한국어, Deutsch, Français.

### Installation

**Chrome Web Store:** Search **PageMind** and click **Add to Chrome**.

**Load Unpacked (Developer):**
1. Clone or download this repository
2. Go to `chrome://extensions`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder

### Quick Start

1. Open any web page you want to understand
2. Click the **PageMind icon** in the toolbar → side panel opens and summarization starts automatically
3. Read the summary, then type follow-up questions in the chat box
4. Type `/` to see available slash commands

### Configuration

Click the **⚙️ gear icon** to open Settings.

| Field | Description | Default |
|-------|-------------|---------|
| API Base URL | Your AI provider's endpoint | `https://api.openai.com/v1` |
| API Key | Stored locally, never shared | — |
| Model Name | Any model your provider supports | `gpt-4o-mini` |
| System Prompt | Customize the assistant's persona | Built-in default |

```
OpenAI:    https://api.openai.com/v1
Ollama:    http://localhost:11434/v1
LM Studio: http://localhost:1234/v1
MiniMax:   https://api.minimaxi.chat/v1
```

### Slash Commands

| Command | Description |
|---------|-------------|
| `/mindmap` | Text-based mind map of the page structure |
| `/tldr` | 3-sentence ultra-short summary |
| `/critique` | Critical analysis: arguments, evidence quality, bias |

### Privacy

- **No backend, no telemetry, no account required.**
- API key is stored locally in `chrome.storage.sync` and sent only to your configured provider.
- Page content is sent only to your AI provider when you trigger a summarize or send a message.

### Permissions

| Permission | Reason |
|------------|--------|
| `sidePanel` | Display the chat panel beside the page |
| `activeTab` | Read the current tab's URL and title |
| `scripting` | Inject content script to extract page text |
| `storage` | Save API settings and preferences |
| `tabs` | Detect tab switches to update panel context |

---

<a name="中文"></a>
## 🇨🇳 中文

> 一键总结任意网页，并使用你自己的 AI 模型与页面内容对话 — 就在 Chrome 侧边栏中。

### 功能特点

- **一键总结** — 点击工具栏图标，PageMind 立即读取并总结当前页面，无需复制粘贴。
- **多轮对话** — 针对页面内容进行追问，全程保持上下文。
- **斜杠命令** — 输入 `/` 触发内置命令：`/mindmap`、`/tldr`、`/critique`，可在设置中自定义。
- **自定义 AI 模型** — 支持任意 OpenAI 兼容 API：OpenAI、Ollama（本地）、LM Studio、MiniMax 等，使用你自己的 Key。
- **流式响应** — 回答实时逐字流出，配合 iMessage 风格气泡 UI。
- **推理模型支持** — `<think>` 推理过程以可折叠区块展示，思考中时有动态动画提示。
- **深色模式** — 自动跟随系统外观。
- **多语言界面** — 支持英文、中文、日语、韩语、德语、法语。

### 安装方式

**Chrome 网上应用店：** 搜索 **PageMind**，点击 **添加至 Chrome**。

**开发者加载（手动安装）：**
1. 克隆或下载本仓库
2. 打开 `chrome://extensions`
3. 开启右上角 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择项目文件夹

### 快速上手

1. 打开任意你想了解的网页
2. 点击工具栏的 **PageMind 图标** → 侧边栏打开并自动开始总结
3. 阅读总结内容，在输入框输入追问
4. 输入 `/` 查看可用的斜杠命令

### 配置说明

点击侧边栏的 **⚙️ 齿轮图标** 进入设置。

| 字段 | 说明 | 默认值 |
|------|------|--------|
| API Base URL | AI 服务提供商的接口地址 | `https://api.openai.com/v1` |
| API Key | 本地存储，不会上传到任何第三方 | — |
| Model Name | 你的服务商支持的任意模型名 | `gpt-4o-mini` |
| System Prompt | 自定义助手的角色与行为 | 内置默认值 |

```
OpenAI:    https://api.openai.com/v1
Ollama:    http://localhost:11434/v1
LM Studio: http://localhost:1234/v1
MiniMax:   https://api.minimaxi.chat/v1
```

### 斜杠命令

| 命令 | 说明 |
|------|------|
| `/mindmap` | 生成页面结构的文字思维导图 |
| `/tldr` | 极简 3 句话总结 |
| `/critique` | 批判性分析：论点、证据质量、潜在偏差 |

在设置中可以编辑、重命名、删除内置命令，并添加最多 5 个自定义命令。

### 隐私说明

- **无后端，无数据收集，无需注册账号。**
- API Key 仅存储在本地 `chrome.storage.sync` 中，只发送给你配置的 AI 服务商。
- 页面内容仅在你主动触发总结或发送消息时，发送给你的 AI 服务商，不经过任何中间服务器。

### 权限说明

| 权限 | 用途 |
|------|------|
| `sidePanel` | 在页面旁展示聊天侧边栏 |
| `activeTab` | 读取当前标签页的 URL 和标题 |
| `scripting` | 注入内容脚本以提取页面文字 |
| `storage` | 保存 API 配置和用户偏好 |
| `tabs` | 检测标签页切换以更新上下文 |

---

<a name="日本語"></a>
## 🇯🇵 日本語

> 任意のウェブページを要約し、自分のAIモデルを使ってページ内容とチャットできます — Chromeのサイドパネルで。

### 機能

- **ワンクリック要約** — ツールバーアイコンをクリックするだけで、現在のページを即座に要約。コピー&ペースト不要。
- **マルチターンチャット** — ページ内容について追加質問ができます。会話コンテキストを維持します。
- **スラッシュコマンド** — `/` を入力して組み込みコマンドを起動：`/mindmap`、`/tldr`、`/critique`。設定でカスタマイズ可能。
- **カスタムAIモデル** — OpenAI互換APIに対応：OpenAI、Ollama（ローカル）、LM Studio、MiniMaxなど。自分のAPIキーを使用。
- **ストリーミングレスポンス** — リアルタイムで回答が流れ、iMessageスタイルのバブルUIで表示。
- **推論モデル対応** — `<think>` 推論ブロックを折りたたみセクションで表示。
- **ダークモード** — システムの外観設定に自動追従。
- **多言語UI** — 英語、中国語、日本語、韓国語、ドイツ語、フランス語に対応。

### インストール

**Chromeウェブストア：** **PageMind** を検索して **Chromeに追加** をクリック。

**開発者モード（手動）：**
1. リポジトリをクローンまたはダウンロード
2. `chrome://extensions` を開く
3. **デベロッパーモード** を有効化（右上のトグル）
4. **パッケージ化されていない拡張機能を読み込む** → プロジェクトフォルダを選択

### クイックスタート

1. 調べたいウェブページを開く
2. ツールバーの **PageMindアイコン** をクリック → サイドパネルが開き、自動的に要約を開始
3. 要約を読み、チャットボックスに追加の質問を入力
4. `/` を入力してスラッシュコマンドを表示

### プライバシー

- **バックエンドなし、データ収集なし、アカウント不要。**
- APIキーはローカルの `chrome.storage.sync` にのみ保存され、設定したAIプロバイダーにのみ送信されます。
- ページコンテンツは要約やメッセージ送信時にのみ、設定したAIプロバイダーに送信されます。

---

<a name="한국어"></a>
## 🇰🇷 한국어

> 자신의 AI 모델로 웹 페이지를 요약하고 대화하세요 — Chrome 사이드 패널에서 바로.

### 기능

- **원클릭 요약** — 툴바 아이콘을 클릭하면 PageMind가 즉시 현재 페이지를 읽고 요약합니다. 복사/붙여넣기 불필요.
- **멀티턴 채팅** — 페이지 내용에 대해 추가 질문을 할 수 있습니다. 대화 컨텍스트가 유지됩니다.
- **슬래시 명령어** — `/`를 입력해 내장 명령어 실행: `/mindmap`, `/tldr`, `/critique`. 설정에서 커스터마이즈 가능.
- **커스텀 AI 모델** — OpenAI 호환 API 지원: OpenAI, Ollama(로컬), LM Studio, MiniMax 등. 자신의 키를 사용.
- **스트리밍 응답** — 실시간으로 답변이 흐르며 iMessage 스타일 버블 UI로 표시.
- **추론 모델 지원** — `<think>` 추론 블록을 접을 수 있는 섹션으로 표시.
- **다크 모드** — 시스템 외관 설정에 자동으로 따릅니다.
- **다국어 UI** — 영어, 중국어, 일본어, 한국어, 독일어, 프랑스어 지원.

### 설치

**Chrome 웹 스토어:** **PageMind** 검색 후 **Chrome에 추가** 클릭.

**개발자 로드(수동):**
1. 저장소 클론 또는 다운로드
2. `chrome://extensions` 열기
3. **개발자 모드** 활성화(우측 상단 토글)
4. **압축해제된 확장 프로그램 로드** → 프로젝트 폴더 선택

### 프라이버시

- **백엔드 없음, 데이터 수집 없음, 계정 불필요.**
- API 키는 로컬 `chrome.storage.sync`에만 저장되며 설정한 AI 제공업체에만 전송됩니다.
- 페이지 내용은 요약 트리거 또는 메시지 전송 시에만 설정한 AI 제공업체로 전송됩니다.

---

<a name="deutsch"></a>
## 🇩🇪 Deutsch

> Fasse beliebige Webseiten zusammen und chatte darüber mit deinem eigenen KI-Modell — direkt im Chrome-Seitenpanel.

### Funktionen

- **Ein-Klick-Zusammenfassung** — Klicke auf das Toolbar-Icon und PageMind fasst die aktuelle Seite sofort zusammen. Kein Kopieren nötig.
- **Mehrstufiger Chat** — Stelle Folgefragen zum Seiteninhalt. PageMind behält den Gesprächskontext bei.
- **Slash-Befehle** — Tippe `/` für integrierte Befehle: `/mindmap`, `/tldr`, `/critique`. In den Einstellungen anpassbar.
- **Eigenes KI-Modell** — Funktioniert mit jeder OpenAI-kompatiblen API: OpenAI, Ollama (lokal), LM Studio, MiniMax u.v.m.
- **Streaming-Antworten** — Antworten erscheinen in Echtzeit mit iMessage-ähnlicher Bubble-Oberfläche.
- **Dunkler Modus** — Folgt automatisch den Systemeinstellungen.
- **Mehrsprachige UI** — Verfügbar auf Englisch, Chinesisch, Japanisch, Koreanisch, Deutsch, Französisch.

### Datenschutz

- **Kein Backend, keine Datenerfassung, keine Registrierung erforderlich.**
- Der API-Schlüssel wird lokal in `chrome.storage.sync` gespeichert und nur an deinen konfigurierten Anbieter gesendet.
- Seiteninhalte werden nur beim Auslösen einer Zusammenfassung oder beim Senden einer Nachricht an deinen KI-Anbieter übertragen.

---

<a name="français"></a>
## 🇫🇷 Français

> Résumez n'importe quelle page web et discutez de son contenu avec votre propre modèle d'IA — directement dans le panneau latéral Chrome.

### Fonctionnalités

- **Résumé en un clic** — Cliquez sur l'icône de la barre d'outils et PageMind résume instantanément la page en cours. Aucun copier-coller nécessaire.
- **Chat multi-tours** — Posez des questions de suivi sur le contenu de la page. Le contexte de la conversation est conservé.
- **Commandes slash** — Tapez `/` pour les commandes intégrées : `/mindmap`, `/tldr`, `/critique`. Personnalisables dans les paramètres.
- **Modèle IA personnalisé** — Compatible avec toute API OpenAI : OpenAI, Ollama (local), LM Studio, MiniMax, etc.
- **Réponses en streaming** — Les réponses s'affichent en temps réel avec une interface de bulles style iMessage.
- **Mode sombre** — Suit automatiquement l'apparence du système.
- **Interface multilingue** — Disponible en anglais, chinois, japonais, coréen, allemand, français.

### Confidentialité

- **Pas de backend, pas de collecte de données, pas de compte requis.**
- La clé API est stockée localement dans `chrome.storage.sync` et envoyée uniquement à votre fournisseur configuré.
- Le contenu des pages n'est transmis à votre fournisseur IA qu'au moment de la synthèse ou de l'envoi d'un message.

---

## Tech Stack

- **Manifest V3** Chrome Extension
- Vanilla JavaScript — no framework, no bundler
- Inline Markdown renderer — no external dependencies
- OpenAI-compatible streaming SSE API

## File Structure

```
pagemind/
├── manifest.json          # MV3 manifest
├── background.js          # Service worker — opens side panel, routes messages
├── sidepanel/
│   ├── panel.html         # Side panel UI
│   ├── panel.css          # Apple-inspired design system
│   └── panel.js           # Chat logic, streaming, Markdown renderer
├── content/
│   └── content.js         # Page text extractor
├── settings/
│   ├── settings.html      # Settings page
│   ├── settings.css
│   └── settings.js
├── shared/
│   └── i18n.js            # Multi-language support
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## License

MIT
