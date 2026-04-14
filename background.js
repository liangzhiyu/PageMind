// background.js - Service Worker

// User clicked the toolbar icon → enable and open panel scoped to this tab only
// No default_path in manifest → other tabs have no panel registered → Chrome hides automatically
chrome.action.onClicked.addListener(async (tab) => {
  // Set session flag before open() so panel's init() finds it (panel load takes longer than storage write)
  chrome.storage.session.set({ [`autoSummarize_${tab.id}`]: true });
  chrome.sidePanel.setOptions({ tabId: tab.id, path: 'sidepanel/panel.html', enabled: true });
  await chrome.sidePanel.open({ tabId: tab.id }).catch(console.error);
  // Send message AFTER open() resolves — panel is now guaranteed to be loaded and listening
  chrome.runtime.sendMessage({ type: 'AUTO_SUMMARIZE', tabId: tab.id }).catch(() => {});
});

// Tab switch → notify panel (for page context handling)
chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.runtime.sendMessage({ type: 'TAB_CHANGED', tabId }).catch(() => {});
});

// Page navigation within same tab
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    chrome.runtime.sendMessage({ type: 'PAGE_LOADED', tabId, url: tab.url }).catch(() => {});
  }
});

// Message hub
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_PAGE_CONTENT') {
    handleGetPageContent(sendResponse);
    return true;
  }
  if (message.type === 'OPEN_SETTINGS') {
    chrome.runtime.openOptionsPage();
  }
  // Panel asks background when ready: avoids race condition where message arrives before listener is set up
  if (message.type === 'CHECK_AUTO_SUMMARIZE') {
    const key = `autoSummarize_${message.tabId}`;
    chrome.storage.session.get(key).then(result => {
      if (result[key]) {
        chrome.storage.session.remove(key);
        sendResponse({ shouldSummarize: true });
      } else {
        sendResponse({ shouldSummarize: false });
      }
    });
    return true;
  }
});

async function handleGetPageContent(sendResponse) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return sendResponse({ error: 'No active tab found' });
    if (!tab.url ||
        tab.url.startsWith('chrome://') ||
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('about:') ||
        tab.url.startsWith('edge://')) {
      return sendResponse({ error: 'Cannot access this page type' });
    }
    try {
      sendResponse(await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' }));
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/content.js'] });
      sendResponse(await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONTENT' }));
    }
  } catch (err) {
    sendResponse({ error: err.message });
  }
}
