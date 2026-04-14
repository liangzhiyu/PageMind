# PageMind Privacy Policy

> **Summary:** PageMind does not collect, store, or transmit any of your personal data. It has no backend server, no analytics, no telemetry, and no user accounts. All data stays on your device.

## 1. Overview

PageMind is a Chrome extension that summarizes web pages and enables AI-powered chat using your own API key and AI provider. This privacy policy explains what data PageMind accesses, how it is used, and how it is protected.

## 2. Data We Collect

**None.** PageMind does not collect any personal information or usage data. There is no server-side component, no analytics service, and no tracking of any kind.

## 3. Data Stored Locally

The following data is stored locally on your device using Chrome's `chrome.storage` API:

- **API configuration** — your API base URL, API key, and model name
- **User preferences** — language, system prompt, and custom slash commands

This data never leaves your device except when sent to your configured AI provider (see Section 5).

## 4. Permissions and Their Purpose

| Permission | Purpose |
|------------|---------|
| `sidePanel` | Display the chat interface beside the web page |
| `activeTab` | Read the current tab's URL and title for context |
| `scripting` | Inject a content script to extract page text for summarization |
| `storage` | Save your API settings and preferences locally |
| `tabs` | Detect tab switches to update the panel context |

## 5. Data Sent to Third Parties

When you trigger a summarization or send a chat message, PageMind sends the following to **your configured AI provider** (e.g., OpenAI, Ollama, or any OpenAI-compatible API):

- The extracted text content of the current web page
- Your chat messages and conversation history
- Your API key (as authentication)

**Important:**

- Data is sent **only** to the API endpoint you configure in Settings — no other third party receives your data.
- PageMind has **no intermediary server**. Requests go directly from your browser to your AI provider.
- If you use a local AI provider (e.g., Ollama, LM Studio), your data never leaves your machine.

## 6. Data We Do NOT Collect

- No personal information (name, email, etc.)
- No browsing history or activity tracking
- No analytics or telemetry
- No cookies or fingerprinting
- No crash reports

## 7. Data Security

Your API key and settings are stored using Chrome's built-in `chrome.storage.sync` API, which is encrypted by Chrome and tied to your Google account. PageMind does not implement any additional server-side storage.

## 8. Children's Privacy

PageMind does not knowingly collect any data from anyone, including children under 13.

## 9. Changes to This Policy

If this privacy policy is updated, the changes will be reflected on this page with an updated date. Since PageMind collects no data, significant changes are unlikely.
