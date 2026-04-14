// panel.js - Side Panel Logic

// === Per-tab state ===
// Each tab has its own conversation history and page context
const tabStates = new Map();
// tabStates[tabId] = { conversationHistory: [], pageContext: null }

let activeTabId = null;
let isStreaming = false;
let abortController = null;          // AbortController for cancelling streaming fetch
let pendingAutoSummarize = false;    // set true if AUTO_SUMMARIZE arrives before activeTabId is ready
let pendingAutoSummarizeTabId = null; // which tab the pending summarize is for

// --- Throttle helpers ---
let _rafScroll = 0;
function scrollToBottomThrottled(force = false) {
  if (_rafScroll) return;
  _rafScroll = requestAnimationFrame(() => {
    _rafScroll = 0;
    scrollToBottom(force);
  });
}

let _rafRender = 0;
let _pendingRender = null;
function renderStreamThrottled(el, fullResponse) {
  _pendingRender = { el, fullResponse };
  if (_rafRender) return;
  _rafRender = requestAnimationFrame(() => {
    _rafRender = 0;
    if (_pendingRender) {
      const { el: e, fullResponse: r } = _pendingRender;
      _pendingRender = null;
      e.innerHTML = renderMarkdown(r);
      e.querySelectorAll('.think-block.streaming .think-content').forEach(content => {
        content.scrollTop = content.scrollHeight;
      });
      scrollToBottomThrottled();
    }
  });
}

function getTabState(tabId) {
  if (!tabStates.has(tabId)) {
    tabStates.set(tabId, { conversationHistory: [], pageContext: null, pageContextLost: false, streaming: null });
  }
  return tabStates.get(tabId);
}

// Convenience getters/setters for the active tab
function get(key) { return activeTabId ? getTabState(activeTabId)[key] : null; }
function set(key, val) { if (activeTabId) getTabState(activeTabId)[key] = val; }

// === Header page info ===
function updateHeaderPageInfo(pageContext) {
  const wrap   = document.getElementById('header-page-info');
  const favicon = document.getElementById('header-favicon');
  const domain  = document.getElementById('header-domain');
  if (pageContext && pageContext.url) {
    try {
      const host = new URL(pageContext.url).hostname;
      favicon.src = `https://www.google.com/s2/favicons?domain=${host}&sz=32`;
      favicon.onerror = () => { favicon.style.display = 'none'; };
      domain.textContent = host.replace(/^www\./, '');
      wrap.classList.remove('hidden');
    } catch { wrap.classList.add('hidden'); }
  } else {
    wrap.classList.add('hidden');
  }
}

// === DOM refs ===
const chatMessages = document.getElementById('chat-messages');
const emptyState   = document.getElementById('empty-state');
const userInput    = document.getElementById('user-input');
const btnSend      = document.getElementById('btn-send');
const tabNotice    = document.getElementById('tab-notice');
const cmdPicker    = document.getElementById('cmd-picker');
const cmdList      = document.getElementById('cmd-list');

// === Built-in slash commands ===
const BUILTIN_COMMANDS_VERSION = 2;  // bump this when built-in commands change
const BUILTIN_COMMANDS = [
  {
    name: 'tldr',
    icon: '⚡',
    desc: 'Ultra-short summary in a few sentences',
    prompt: `Give an ultra-short summary of this page. Adapt your length to the content — 2 sentences for a simple page, up to 5 for a dense one. Cover: what this is, the core point, and one key takeaway. No headings, no bullet points — just plain, tight prose. Write directly with no preamble.`
  },
  {
    name: 'keypoints',
    icon: '📌',
    desc: 'Extract key points as a checklist',
    prompt: `Extract the most important points from this page as a concise bullet list.
Rules:
- 5–10 bullets maximum, each one sentence
- Lead each bullet with the most important word/phrase in **bold**
- Order by importance, not by appearance on the page
- Skip filler, intros, and CTAs — only substantive points
- If the page has data or numbers, include the key ones
Write directly, no intro sentence.`
  },
  {
    name: 'translate',
    icon: '🌐',
    desc: 'Translate page content to your language',
    prompt: `Translate the main content of this page into the language I'm chatting in (detect from my previous messages; default to Chinese if unclear).
Rules:
- Translate the substance, not the boilerplate (skip nav, footer, ads)
- Keep the original structure (headings, lists, paragraphs)
- For technical terms, keep the English original in parentheses on first use, e.g. "向量数据库 (vector database)"
- Keep it natural and readable — not machine-translation style
Write the translation directly, no preamble.`
  }
];

// === Init ===
document.addEventListener('DOMContentLoaded', init);

async function init() {
  // Load language
  const { language = 'en' } = await chrome.storage.sync.get({ language: 'en' });
  applyI18n(language);

  // Get current active tab (lastFocusedWindow is more reliable from side panel context)
  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (tab) activeTabId = tab.id;
  } catch {}

  // Scroll-to-bottom FAB
  const btnScrollBottom = document.getElementById('btn-scroll-bottom');
  btnScrollBottom.addEventListener('click', () => scrollToBottom(true));
  chatMessages.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = chatMessages;
    const distFromBottom = scrollHeight - scrollTop - clientHeight;
    btnScrollBottom.classList.toggle('hidden', distFromBottom < 120);
  });

  // Wire up buttons
  document.getElementById('btn-summarize-empty').addEventListener('click', summarizePage);
  document.getElementById('btn-settings').addEventListener('click', openSettings);
  document.getElementById('btn-new-chat').addEventListener('click', newChat);
  document.getElementById('btn-dismiss-notice').addEventListener('click', () => tabNotice.classList.add('hidden'));
  btnSend.addEventListener('click', () => {
    if (isStreaming) { stopStreaming(); } else { handleSend(); }
  });
  const btnSlash = document.getElementById('btn-slash');
  btnSlash.addEventListener('mousedown', (e) => e.preventDefault()); // prevent textarea blur
  btnSlash.addEventListener('click', () => {
    userInput.value = '/';
    userInput.focus();
    userInput.dispatchEvent(new Event('input'));
  });

  // Textarea: auto-resize + Enter to send + slash command trigger
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    updateSendButton();
    handleSlashInput();
  });

  userInput.addEventListener('keydown', handleInputKeydown);
  userInput.addEventListener('blur', () => {
    // Delay so click on picker item can fire first
    setTimeout(hideCmdPicker, 150);
  });

  // Listen for tab changes from background.js
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'AUTO_SUMMARIZE') {
      if (activeTabId && message.tabId === activeTabId) {
        chrome.storage.session.remove(`autoSummarize_${activeTabId}`);
        const state = getTabState(activeTabId);
        if (state.conversationHistory.length > 0) newChat();
        summarizePage();
      } else {
        // activeTabId not yet updated to the new tab — defer until TAB_CHANGED arrives
        pendingAutoSummarize = true;
        pendingAutoSummarizeTabId = message.tabId;
      }
    }
    if (message.type === 'TAB_CHANGED') {
      const newTabId = message.tabId;
      if (newTabId === activeTabId) return;
      activeTabId = newTabId;
      renderTabState();
      updateHeaderPageInfo(get('pageContext'));
      // Consume pending auto-summarize triggered by icon click on this tab
      if (pendingAutoSummarize && pendingAutoSummarizeTabId === newTabId) {
        pendingAutoSummarize = false;
        pendingAutoSummarizeTabId = null;
        chrome.storage.session.remove(`autoSummarize_${activeTabId}`);
        const state = getTabState(activeTabId);
        if (state.conversationHistory.length > 0) newChat();
        summarizePage();
      }
    }
    if (message.type === 'PAGE_LOADED') {
      // Page navigated within same tab - clear page context for that tab
      if (message.tabId === activeTabId) {
        const state = getTabState(activeTabId);
        if (state.pageContext !== null) {
          state.pageContext = null;
          state.pageContextLost = true;
          // Only show notice if there's an existing conversation
          if (state.conversationHistory.length > 0) {
            tabNotice.classList.remove('hidden');
          }
        }
      } else {
        // Pre-clear page context for the other tab
        if (tabStates.has(message.tabId)) {
          const state = tabStates.get(message.tabId);
          if (state.pageContext !== null) {
            state.pageContext = null;
            state.pageContextLost = true;
          }
        }
      }
    }
  });

  // Re-sync when panel becomes visible again (hidden→visible on tab switch)
  // Covers the case where TAB_CHANGED was missed while panel was frozen
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (tab && tab.id !== activeTabId) {
        activeTabId = tab.id;
        renderTabState();
        updateHeaderPageInfo(get('pageContext'));
      }
    } catch {}
    // Check for pending auto-summarize flag in session storage
    if (activeTabId) {
      try {
        const resp = await chrome.runtime.sendMessage({ type: 'CHECK_AUTO_SUMMARIZE', tabId: activeTabId });
        if (resp?.shouldSummarize) {
          const state = getTabState(activeTabId);
          if (state.conversationHistory.length > 0) newChat();
          summarizePage();
        }
      } catch {}
    }
  });

  // Check if API is configured
  const settings = await chrome.storage.sync.get({ apiKey: '', baseUrl: '' });
  if (!settings.apiKey || !settings.baseUrl) {
    appendSystemMessage(t('welcomeMsg'));
  }

  renderTabState();

  // Auto-summarize if triggered by icon click.
  // Ask background (pull model) — avoids race where AUTO_SUMMARIZE message arrives before listener is registered.
  if (activeTabId) {
    let shouldSummarize = false;
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'CHECK_AUTO_SUMMARIZE', tabId: activeTabId });
      shouldSummarize = resp?.shouldSummarize === true;
    } catch {}
    // Fallback: AUTO_SUMMARIZE message arrived before init() set up its listener
    if (!shouldSummarize && pendingAutoSummarize && pendingAutoSummarizeTabId === activeTabId) {
      shouldSummarize = true;
      pendingAutoSummarize = false;
      pendingAutoSummarizeTabId = null;
    }
    if (shouldSummarize) {
      const state = getTabState(activeTabId);
      if (state.conversationHistory.length > 0) newChat();
      summarizePage();
    }
  }
}

// Render chat area for the current active tab
function renderTabState() {
  if (!activeTabId) return;
  const state = getTabState(activeTabId);

  // Clear existing messages
  Array.from(chatMessages.children).forEach(child => {
    if (child.id !== 'empty-state') child.remove();
  });

  if (state.conversationHistory.length === 0) {
    emptyState.classList.remove('hidden');
    tabNotice.classList.add('hidden');
  } else {
    emptyState.classList.add('hidden');
    // Re-render all messages
    for (const msg of state.conversationHistory) {
      const msgEl = document.createElement('div');
      msgEl.className = `message ${msg.role === 'user' ? 'user' : 'ai'}`;
      const bubbleEl = document.createElement('div');
      bubbleEl.className = 'bubble';
      if (msg.role === 'user') {
        bubbleEl.textContent = msg.content;
      } else {
        bubbleEl.innerHTML = renderMarkdown(msg.content);
      }
      msgEl.appendChild(bubbleEl);
      if (msg.role === 'assistant') {
        msgEl.appendChild(createMsgActions(msg.content));
      }
      chatMessages.appendChild(msgEl);
    }
    // If this tab has an ongoing streaming response, re-attach a live bubble
    if (state.streaming) {
      const newBubble = appendMessage('ai', '', true);
      newBubble.innerHTML = renderMarkdown(state.streaming.fullResponse);
      state.streaming.bubbleEl = newBubble; // redirect ongoing fetch writes here
    }

    scrollToBottom(true);
    // Only show notice if this tab had a conversation but page context was cleared
    if (state.pageContext === null && state.conversationHistory.length > 0 && state.pageContextLost) {
      tabNotice.classList.remove('hidden');
    }
  }
}

// === Page Summarization ===
async function summarizePage() {
  tabNotice.classList.add('hidden');
  hideEmptyState();

  const loadingMsg = appendLoadingMessage();

  const response = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' });
  removeMessage(loadingMsg);

  if (response.error) {
    appendSystemMessage(`Could not read page: ${response.error}`);
    return;
  }

  set('pageContext', response);
  set('pageContextLost', false);
  updateHeaderPageInfo(response);
  appendPageContextBadge(response.title, response.url);

  const { summarizePrompt = 'Please summarize this page concisely. Highlight the main topic, key points, and any important details. Use markdown formatting with bullet points.' } = await chrome.storage.sync.get('summarizePrompt');
  await streamChat(summarizePrompt);
}

// === Send Message ===
async function handleSend() {
  const text = userInput.value.trim();
  if (!text || isStreaming) return;

  // Check for slash command execution
  if (text.startsWith('/')) {
    const cmdName = text.slice(1).split(' ')[0].toLowerCase();
    const allCmds = await getAllCommands();
    const cmd = allCmds.find(c => c.name.toLowerCase() === cmdName);
    if (cmd) {
      hideEmptyState();
      userInput.value = '';
      userInput.style.height = 'auto';
      btnSend.disabled = true;
      hideCmdPicker();
      appendMessage('user', `/${cmd.name}`);
      scrollToBottom(true);
      // Ensure page context for commands that need it
      if (!get('pageContext')) {
        const loadingMsg = appendLoadingMessage();
        const response = await chrome.runtime.sendMessage({ type: 'GET_PAGE_CONTENT' });
        removeMessage(loadingMsg);
        if (!response.error) {
          set('pageContext', response);
          appendPageContextBadge(response.title, response.url);
        }
      }
      await streamChat(cmd.prompt);
      return;
    }
  }

  hideEmptyState();
  userInput.value = '';
  userInput.style.height = 'auto';
  btnSend.disabled = true;
  hideCmdPicker();

  appendMessage('user', text);
  scrollToBottom(true);
  await streamChat(text);
}

// === Core: Streaming AI Call ===
async function streamChat(userMessage) {
  const settings = await chrome.storage.sync.get({
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    modelName: 'gpt-4o-mini',
    systemPrompt: 'You are a helpful assistant. When analyzing web pages, be concise, clear, and use markdown formatting for better readability.'
  });

  if (!settings.apiKey) {
    appendSystemMessage(t('noApiKey'));
    return;
  }

  const state = getTabState(activeTabId);

  // Build system message
  const DEFAULT_SYSTEM_PROMPT = 'You are a helpful assistant. When analyzing web pages, be concise, clear, and use markdown formatting for better readability.';
  let systemContent = settings.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  if (state.pageContext) {
    systemContent += `\n\nYou are currently helping the user with this web page:\nTitle: "${state.pageContext.title}"\nURL: ${state.pageContext.url}\n\nPage content (may be truncated):\n${state.pageContext.content.slice(0, 8000)}`;
  }

  const messages = [
    { role: 'system', content: systemContent },
    ...state.conversationHistory,
    { role: 'user', content: userMessage }
  ];

  state.conversationHistory.push({ role: 'user', content: userMessage });

  const bubbleEl = appendMessage('ai', '', true);
  state.streaming = { fullResponse: '', bubbleEl };
  isStreaming = true;
  abortController = new AbortController();
  updateSendButton();

  try {
    const res = await fetch(`${settings.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.modelName,
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048
      }),
      signal: abortController.signal
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`API ${res.status}: ${errText.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) {
            state.streaming.fullResponse += delta;
            renderStreamThrottled(state.streaming.bubbleEl, state.streaming.fullResponse);
          }
        } catch { /* skip malformed chunks */ }
      }
    }

    const el = state.streaming.bubbleEl;
    el.classList.remove('streaming');
    // Re-render final content: completed think blocks auto-render as collapsed "Thought"
    el.innerHTML = renderMarkdown(state.streaming.fullResponse);
    state.conversationHistory.push({ role: 'assistant', content: state.streaming.fullResponse });
    // Add action buttons after streaming completes
    el.parentElement.appendChild(createMsgActions(state.streaming.fullResponse));

  } catch (err) {
    const el = state.streaming.bubbleEl;
    el.classList.remove('streaming');
    if (err.name === 'AbortError') {
      // User cancelled — keep partial response if any
      if (state.streaming.fullResponse.trim()) {
        el.innerHTML = renderMarkdown(state.streaming.fullResponse);
        state.conversationHistory.push({ role: 'assistant', content: state.streaming.fullResponse });
        el.parentElement.appendChild(createMsgActions(state.streaming.fullResponse));
      } else {
        el.parentElement?.remove();
        state.conversationHistory.pop();
      }
    } else {
      el.classList.add('error-bubble');
      el.textContent = `Error: ${err.message}`;
      const failedMsg = state.conversationHistory.pop();
      // Add retry button
      const retryActions = document.createElement('div');
      retryActions.className = 'msg-actions';
      retryActions.style.opacity = '1';
      const retryBtn = document.createElement('button');
      retryBtn.className = 'btn-msg-action';
      retryBtn.title = 'Retry';
      retryBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M1.5 6.5a5 5 0 019-3M11.5 6.5a5 5 0 01-9 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M10.5 1v2.5H8M2.5 12V9.5H5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      retryBtn.addEventListener('click', () => {
        el.parentElement.remove();
        retryActions.remove();
        if (failedMsg) streamChat(failedMsg.content);
      });
      retryActions.appendChild(retryBtn);
      el.parentElement.appendChild(retryActions);
    }
  } finally {
    state.streaming = null;
    isStreaming = false;
    abortController = null;
    updateSendButton();
    scrollToBottom();
  }
}

// === Slash Command Picker ===

async function getAllCommands() {
  const stored = await chrome.storage.sync.get({ customCommands: [], builtinCommandOverrides: null, builtinCommandsVersion: 0 });
  // Reset overrides when built-in commands are updated in code
  let builtins;
  if (stored.builtinCommandOverrides && stored.builtinCommandsVersion >= BUILTIN_COMMANDS_VERSION) {
    builtins = stored.builtinCommandOverrides;
  } else {
    builtins = BUILTIN_COMMANDS;
    // Clear stale overrides so settings page also picks up the new defaults
    chrome.storage.sync.set({ builtinCommandOverrides: null, builtinCommandsVersion: BUILTIN_COMMANDS_VERSION });
  }
  return [...builtins, ...stored.customCommands];
}

function handleSlashInput() {
  const val = userInput.value;
  if (!val.startsWith('/')) {
    hideCmdPicker();
    return;
  }
  const query = val.slice(1).toLowerCase();
  showCmdPicker(query);
}

async function showCmdPicker(query = '') {
  const allCmds = await getAllCommands();
  const filtered = query
    ? allCmds.filter(c => c.name.toLowerCase().includes(query) || c.desc.toLowerCase().includes(query))
    : allCmds;

  if (filtered.length === 0) {
    hideCmdPicker();
    return;
  }

  cmdList.innerHTML = filtered.map((cmd, i) => `
    <div class="cmd-item" data-name="${cmd.name}" data-index="${i}">
      <span class="cmd-icon">${cmd.icon || '⚡'}</span>
      <div class="cmd-info">
        <span class="cmd-name">/${cmd.name}</span>
        <span class="cmd-desc">${escapeHtml(cmd.desc)}</span>
      </div>
    </div>
  `).join('');

  // Click to select
  cmdList.querySelectorAll('.cmd-item').forEach(item => {
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent blur on textarea
      selectCommand(item.dataset.name);
    });
  });

  cmdPicker.classList.remove('hidden');
  highlightCmd(0);
}

function hideCmdPicker() {
  cmdPicker.classList.add('hidden');
  cmdList.innerHTML = '';
}

function highlightCmd(index) {
  const items = cmdList.querySelectorAll('.cmd-item');
  items.forEach((item, i) => item.classList.toggle('cmd-item-active', i === index));
}

function getHighlightedIndex() {
  const items = cmdList.querySelectorAll('.cmd-item');
  for (let i = 0; i < items.length; i++) {
    if (items[i].classList.contains('cmd-item-active')) return i;
  }
  return -1;
}

async function selectCommand(name) {
  const allCmds = await getAllCommands();
  const cmd = allCmds.find(c => c.name === name);
  if (!cmd) return;

  userInput.value = `/${cmd.name} `;
  userInput.dispatchEvent(new Event('input'));
  hideCmdPicker();
  userInput.focus();
}

function handleInputKeydown(e) {
  // Ignore all keydown events during IME composition (e.g. Chinese/Japanese/Korean input)
  if (e.isComposing || e.keyCode === 229) return;

  // Slash command picker navigation
  if (!cmdPicker.classList.contains('hidden')) {
    const items = cmdList.querySelectorAll('.cmd-item');
    const current = getHighlightedIndex();

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlightCmd(Math.min(current + 1, items.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlightCmd(Math.max(current - 1, 0));
      return;
    }
    if (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      const active = cmdList.querySelector('.cmd-item-active');
      if (active) selectCommand(active.dataset.name);
      return;
    }
    if (e.key === 'Escape') {
      hideCmdPicker();
      return;
    }
  }

  // Escape to stop streaming
  if (e.key === 'Escape' && isStreaming) {
    e.preventDefault();
    stopStreaming();
    return;
  }

  // Normal enter to send
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!btnSend.disabled) handleSend();
  }
}

// === Send / Stop button state ===
function updateSendButton() {
  if (isStreaming) {
    btnSend.disabled = false;
    btnSend.classList.add('btn-stop');
    btnSend.title = 'Stop (Esc)';
  } else {
    btnSend.classList.remove('btn-stop');
    btnSend.disabled = userInput.value.trim() === '';
    btnSend.title = 'Send (Enter)';
  }
}

function stopStreaming() {
  if (abortController) abortController.abort();
}

// === UI Helpers ===

function appendMessage(role, content, streaming = false) {
  const msgEl = document.createElement('div');
  msgEl.className = `message ${role}`;

  const bubbleEl = document.createElement('div');
  bubbleEl.className = `bubble${streaming ? ' streaming' : ''}`;

  if (streaming) {
    bubbleEl.innerHTML = `<details class="think-block streaming" open><summary>✦ <span class="think-label">Thinking…</span><span class="think-dots"><span></span><span></span><span></span></span></summary></details>`;
  } else if (content) {
    if (role === 'user') {
      bubbleEl.textContent = content;
    } else {
      bubbleEl.innerHTML = renderMarkdown(content);
    }
  }

  msgEl.appendChild(bubbleEl);

  // Add action buttons for non-streaming AI messages
  if (role === 'ai' && !streaming && content) {
    msgEl.appendChild(createMsgActions(content));
  }

  chatMessages.appendChild(msgEl);
  scrollToBottom();
  return bubbleEl;
}

function createMsgActions(textContent) {
  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn-msg-action';
  copyBtn.title = 'Copy';
  copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M9 4V2.5A1.5 1.5 0 007.5 1h-5A1.5 1.5 0 001 2.5v5A1.5 1.5 0 002.5 9H4" stroke="currentColor" stroke-width="1.3"/></svg>';
  copyBtn.addEventListener('click', async () => {
    // Get raw text from the bubble sibling
    const bubble = actions.previousElementSibling;
    const text = bubble ? bubble.innerText : textContent;
    await navigator.clipboard.writeText(text);
    copyBtn.classList.add('copied');
    copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2.5 7l3 3 5-5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    setTimeout(() => {
      copyBtn.classList.remove('copied');
      copyBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M9 4V2.5A1.5 1.5 0 007.5 1h-5A1.5 1.5 0 001 2.5v5A1.5 1.5 0 002.5 9H4" stroke="currentColor" stroke-width="1.3"/></svg>';
    }, 1500);
  });
  actions.appendChild(copyBtn);

  return actions;
}

function appendSystemMessage(markdown) {
  const msgEl = document.createElement('div');
  msgEl.className = 'message ai';
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'bubble';
  bubbleEl.style.cssText = 'background:transparent;color:var(--text-secondary);font-size:12.5px;padding:4px 0';
  bubbleEl.innerHTML = renderMarkdown(markdown);
  msgEl.appendChild(bubbleEl);
  chatMessages.appendChild(msgEl);
  scrollToBottom();
}

function appendPageContextBadge(title, url) {
  const divider = document.createElement('div');
  divider.className = 'date-divider';
  const shortTitle = title.length > 40 ? title.slice(0, 40) + '…' : title;
  divider.innerHTML = `<span>📄 ${escapeHtml(shortTitle)}</span>`;
  chatMessages.appendChild(divider);
}

function appendLoadingMessage() {
  const msgEl = document.createElement('div');
  msgEl.className = 'message ai';
  msgEl.dataset.loading = 'true';
  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'bubble';
  bubbleEl.style.cssText = 'color:var(--text-secondary);font-size:13px';
  bubbleEl.innerHTML = `<div class="loading-dots"><span></span><span></span><span></span></div>`;
  msgEl.appendChild(bubbleEl);
  chatMessages.appendChild(msgEl);
  scrollToBottom();
  return msgEl;
}

function removeMessage(el) {
  if (el && el.parentNode) el.remove();
}

function hideEmptyState() {
  emptyState.classList.add('hidden');
}

function scrollToBottom(force = false) {
  const { scrollTop, scrollHeight, clientHeight } = chatMessages;
  const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
  if (force || distanceFromBottom < 80) {
    chatMessages.scrollTop = scrollHeight;
  }
}

function newChat() {
  if (!activeTabId) return;
  tabStates.set(activeTabId, { conversationHistory: [], pageContext: null });
  tabNotice.classList.add('hidden');
  updateHeaderPageInfo(null);
  Array.from(chatMessages.children).forEach(child => {
    if (child.id !== 'empty-state') child.remove();
  });
  emptyState.classList.remove('hidden');
  userInput.value = '';
  userInput.style.height = 'auto';
  btnSend.disabled = true;
}

function openSettings() {
  chrome.runtime.sendMessage({ type: 'OPEN_SETTINGS' });
}

// === Markdown Renderer ===

function renderMarkdown(text) {
  if (!text) return '';

  // 0. Handle <think>...</think> blocks (MiniMax / reasoning models)
  // Completed blocks (has closing tag) → label "Thought", collapsed
  // Incomplete blocks (still streaming) → label "Thinking…", open with streaming dots
  text = text.replace(/<think>([\s\S]*?)<\/think>/g, (_, thinking) => {
    const trimmed = thinking.trim();
    if (!trimmed) return '';
    return `\x01THINK_DONE\x01${trimmed}\x01ENDTHINK\x01`;
  });
  const openThink = text.indexOf('<think>');
  if (openThink !== -1 && text.indexOf('</think>') === -1) {
    const thinking = text.slice(openThink + 7).trim();
    text = text.slice(0, openThink) + `\x01THINK_LIVE\x01${thinking}\x01ENDTHINK\x01`;
  }

  let html = escapeHtml(text);

  html = html.replace(/```(\w+)?\n?([\s\S]*?)```/g, (_, lang, code) =>
    `<pre><code class="lang-${lang || 'text'}">${code.trim()}</code></pre>`
  );
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^---+$/gm, '<hr>');
  html = html.replace(/^\*\*\*+$/gm, '<hr>');
  html = html.replace(/^[ \t]*[-\*\+] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]+?<\/li>)(?=\n(?!<li>)|$)/g, '<ul>$1</ul>');
  html = html.replace(/^[ \t]*\d+\. (.+)$/gm, '<li class="ol-item">$1</li>');
  html = html.replace(/(<li class="ol-item">[\s\S]+?<\/li>)(?=\n(?!<li)|$)/g, '<ol>$1</ol>');
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Tables: match block of lines containing |
  html = html.replace(
    /^(\|.+\|\n)([ \t]*\|[ \t]*[-:]+[-| \t:]*\|\n)((?:\|.+\|\n?)*)/gm,
    (_, header, _sep, body) => {
      const parseRow = (row) =>
        row.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const headers = parseRow(header);
      const rows = body.trim() ? body.trim().split('\n').map(parseRow) : [];
      const th = headers.map(h => `<th>${h}</th>`).join('');
      const tr = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
      return `<table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`;
    }
  );

  // Completed think block: collapsed, label "Thought", no streaming dots
  html = html.replace(
    /\x01THINK_DONE\x01([\s\S]*?)\x01ENDTHINK\x01/g,
    (_, content) => {
      const lines = content.trim().replace(/\n/g, '<br>');
      return `<details class="think-block"><summary>💭 <span class="think-label">Thought</span></summary><div class="think-content">${lines}</div></details>`;
    }
  );
  // Live/streaming think block: open, label "Thinking…", animated dots
  html = html.replace(
    /\x01THINK_LIVE\x01([\s\S]*?)\x01ENDTHINK\x01/g,
    (_, content) => {
      const lines = content.trim().replace(/\n/g, '<br>');
      return `<details class="think-block streaming" open><summary>💭 <span class="think-label">Thinking…</span><span class="think-dots"><span></span><span></span><span></span></span></summary><div class="think-content">${lines}</div></details>`;
    }
  );

  const paras = html.split(/\n{2,}/);
  html = paras.map(para => {
    para = para.trim();
    if (!para) return '';
    if (/^<(h[1-6]|ul|ol|li|blockquote|pre|hr|table|details)/.test(para)) return para;
    para = para.replace(/\n/g, '<br>');
    return `<p>${para}</p>`;
  }).join('\n');

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
