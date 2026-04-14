// settings.js - Settings page logic
// Reads and writes configuration to chrome.storage.sync

// === Language ===
async function loadLanguage() {
  const { language = 'en' } = await chrome.storage.sync.get({ language: 'en' });
  applyI18n(language);
}

function setupLanguageButtons() {
  document.querySelectorAll('.btn-lang').forEach(btn => {
    btn.addEventListener('click', async () => {
      const lang = btn.dataset.lang;
      await chrome.storage.sync.set({ language: lang });
      applyI18n(lang);
    });
  });
}

const DEFAULTS = {
  baseUrl:         'https://api.openai.com/v1',
  apiKey:          '',
  modelName:       'gpt-4o-mini',
  systemPrompt:    'You are a helpful assistant. When analyzing web pages, be concise, clear, and use markdown formatting for better readability.',
  summarizePrompt: 'Please summarize this page concisely. Highlight the main topic, key points, and any important details. Use markdown formatting with bullet points.'
};

// === Load settings on page open ===
async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  document.getElementById('base-url').value        = stored.baseUrl;
  document.getElementById('api-key').value         = stored.apiKey;
  document.getElementById('model-name').value      = stored.modelName;
  document.getElementById('system-prompt').value   = stored.systemPrompt;
  document.getElementById('summarize-prompt').value = stored.summarizePrompt;
}

// === Save settings ===
async function saveSettings() {
  const settings = {
    baseUrl:         document.getElementById('base-url').value.trim(),
    apiKey:          document.getElementById('api-key').value.trim(),
    modelName:       document.getElementById('model-name').value.trim(),
    systemPrompt:    document.getElementById('system-prompt').value.trim(),
    summarizePrompt: document.getElementById('summarize-prompt').value.trim()
  };

  // Basic validation
  if (!settings.baseUrl) {
    showToast('Base URL is required', 'error');
    return;
  }
  if (!settings.modelName) {
    showToast('Model name is required', 'error');
    return;
  }

  await chrome.storage.sync.set(settings);
  showToast(t('saved'));
}

// === Reset to defaults ===
async function resetSettings() {
  if (!confirm(t('resetConfirm'))) return;
  await chrome.storage.sync.set({ ...DEFAULTS, builtinCommandOverrides: null });
  await loadSettings();
  builtinCommands = BUILTIN_COMMANDS_DEFAULT.map(c => ({ ...c }));
  renderAllCommands();
  showToast(t('saved'));
}

// === Test connection ===
async function testConnection() {
  const baseUrl   = document.getElementById('base-url').value.trim();
  const apiKey    = document.getElementById('api-key').value.trim();
  const modelName = document.getElementById('model-name').value.trim();

  const statusEl = document.getElementById('connection-status');
  statusEl.className = 'status-box status-pending';
  statusEl.textContent = t('testingConn');
  statusEl.classList.remove('hidden');

  try {
    // Use a minimal chat completion request — works universally across providers
    // (MiniMax, OpenAI, Ollama, etc. — /models endpoint is not always available)
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
        stream: false
      }),
      signal: AbortSignal.timeout(12000)
    });

    if (res.ok) {
      statusEl.className = 'status-box status-ok';
      statusEl.innerHTML = `✓ Connected — model <strong>${modelName}</strong> is working`;
    } else {
      const errText = await res.text();
      let msg = errText.slice(0, 200);
      try { msg = JSON.parse(errText)?.error?.message ?? msg; } catch {}
      statusEl.className = 'status-box status-error';
      statusEl.textContent = `Error ${res.status}: ${msg}`;
    }
  } catch (err) {
    statusEl.className = 'status-box status-error';
    if (err.name === 'TimeoutError') {
      statusEl.textContent = t('connTimeout');
    } else {
      statusEl.textContent = t('connFailed') + err.message;
    }
  }
}

// === Toggle API key visibility ===
function toggleKeyVisibility() {
  const input = document.getElementById('api-key');
  const iconOff = document.getElementById('icon-eye-off');
  const iconOn  = document.getElementById('icon-eye-on');

  if (input.type === 'password') {
    input.type = 'text';
    iconOff.classList.add('hidden');
    iconOn.classList.remove('hidden');
  } else {
    input.type = 'password';
    iconOff.classList.remove('hidden');
    iconOn.classList.add('hidden');
  }
}

// === Model preset buttons ===
function setupPresets() {
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('model-name').value = btn.dataset.model;
    });
  });
}

// === Toast notification ===
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show';

  if (type === 'error') {
    toast.style.background = 'rgba(255,59,48,0.9)';
  } else {
    toast.style.background = 'rgba(28,28,30,0.88)';
  }

  setTimeout(() => {
    toast.className = 'toast hidden';
  }, 2400);
}

// === Built-in Commands (mirrored from panel.js) ===

const BUILTIN_COMMANDS_VERSION = 2;  // must match panel.js
const BUILTIN_COMMANDS_DEFAULT = [
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

// === Unified Commands ===
// builtinCommands: working copy of built-ins (may be edited)
// customCommands:  user-added commands
let builtinCommands = [];
let customCommands = [];

async function loadAllCommands() {
  const stored = await chrome.storage.sync.get({ builtinCommandOverrides: null, customCommands: [], builtinCommandsVersion: 0 });
  // Reset overrides when built-in commands are updated in code
  if (stored.builtinCommandOverrides && stored.builtinCommandsVersion >= BUILTIN_COMMANDS_VERSION) {
    builtinCommands = stored.builtinCommandOverrides;
  } else {
    builtinCommands = BUILTIN_COMMANDS_DEFAULT.map(c => ({ ...c }));
    chrome.storage.sync.set({ builtinCommandOverrides: null, builtinCommandsVersion: BUILTIN_COMMANDS_VERSION });
  }
  customCommands = stored.customCommands;
  renderAllCommands();
}

function renderAllCommands() {
  const list = document.getElementById('all-commands-list');

  const builtinHTML = builtinCommands.map((cmd, i) => `
    <div class="custom-cmd-item" data-type="builtin" data-index="${i}">
      <div class="custom-cmd-row">
        <input class="input input-sm cmd-name-input" value="${escapeAttr(cmd.name)}"
          placeholder="command-name" spellcheck="false" data-type="builtin" data-field="name" data-index="${i}">
        <input class="input input-sm cmd-icon-input" value="${escapeAttr(cmd.icon || '')}"
          placeholder="🔖" data-type="builtin" data-field="icon" data-index="${i}" maxlength="2">
        <button class="btn-cmd-delete" data-type="builtin" data-index="${i}" title="Delete">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <input class="input input-sm cmd-desc-input" value="${escapeAttr(cmd.desc)}"
        placeholder="Short description" data-type="builtin" data-field="desc" data-index="${i}">
      <textarea class="input textarea-sm cmd-prompt-input" placeholder="Prompt sent to the AI…"
        data-type="builtin" data-field="prompt" data-index="${i}">${escapeAttr(cmd.prompt)}</textarea>
    </div>
  `).join('');

  const customHTML = customCommands.length === 0 ? '' : customCommands.map((cmd, i) => `
    <div class="custom-cmd-item" data-type="custom" data-index="${i}">
      <div class="custom-cmd-row">
        <input class="input input-sm cmd-name-input" value="${escapeAttr(cmd.name)}"
          placeholder="command-name" spellcheck="false" data-type="custom" data-field="name" data-index="${i}">
        <input class="input input-sm cmd-icon-input" value="${escapeAttr(cmd.icon || '')}"
          placeholder="🔖" data-type="custom" data-field="icon" data-index="${i}" maxlength="2">
        <button class="btn-cmd-delete" data-index="${i}" title="Delete">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M2 2l9 9M11 2L2 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <input class="input input-sm cmd-desc-input" value="${escapeAttr(cmd.desc)}"
        placeholder="Short description" data-type="custom" data-field="desc" data-index="${i}">
      <textarea class="input textarea-sm cmd-prompt-input" placeholder="Prompt sent to the AI…"
        data-type="custom" data-field="prompt" data-index="${i}">${escapeAttr(cmd.prompt)}</textarea>
    </div>
  `).join('');

  list.innerHTML = builtinHTML + customHTML;

  // Update add button state
  const btnAdd = document.getElementById('btn-add-cmd');
  const atLimit = customCommands.length >= MAX_CUSTOM_COMMANDS;
  btnAdd.disabled = atLimit;
  btnAdd.title = atLimit ? t('maxCommands') : '';

  list.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input', (e) => {
      const idx = parseInt(e.target.dataset.index);
      const field = e.target.dataset.field;
      if (e.target.dataset.type === 'builtin') {
        builtinCommands[idx][field] = e.target.value;
      } else {
        customCommands[idx][field] = e.target.value;
      }
    });
  });

  list.querySelectorAll('.btn-cmd-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index);
      if (btn.dataset.type === 'builtin') {
        builtinCommands.splice(idx, 1);
      } else {
        customCommands.splice(idx, 1);
      }
      renderAllCommands();
    });
  });
}

const MAX_CUSTOM_COMMANDS = 5;

function addCustomCommand() {
  if (customCommands.length >= MAX_CUSTOM_COMMANDS) {
    showToast(t('maxCommands'), 'error');
    return;
  }
  customCommands.push({ name: '', icon: '⚡', desc: '', prompt: '' });
  renderAllCommands();
  const inputs = document.querySelectorAll('#all-commands-list [data-type="custom"] .cmd-name-input');
  if (inputs.length > 0) inputs[inputs.length - 1].focus();
}

async function saveAllCommands() {
  await chrome.storage.sync.set({ builtinCommandOverrides: builtinCommands, builtinCommandsVersion: BUILTIN_COMMANDS_VERSION });
  const valid = customCommands.filter(c => c.name.trim() && c.prompt.trim());
  valid.forEach(c => { c.name = c.name.trim().toLowerCase().replace(/\s+/g, '-'); });
  await chrome.storage.sync.set({ customCommands: valid });
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

// === Init ===
document.addEventListener('DOMContentLoaded', () => {
  loadLanguage();
  setupLanguageButtons();
  loadSettings();
  loadAllCommands();
  setupPresets();

  document.getElementById('btn-save').addEventListener('click', async () => {
    await saveAllCommands();
    await saveSettings();
  });
  document.getElementById('btn-reset').addEventListener('click', resetSettings);
  document.getElementById('btn-test').addEventListener('click', testConnection);
  document.getElementById('btn-toggle-key').addEventListener('click', toggleKeyVisibility);
  document.getElementById('btn-add-cmd').addEventListener('click', addCustomCommand);

  // Save on Ctrl/Cmd+S
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      saveAllCommands().then(saveSettings);
    }
  });
});
