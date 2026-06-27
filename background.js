function handlePopupInjection(tabId, url) {
  if (!url) return;
  
  if (url.startsWith('https://faveo.careinsurance.com/NewFaveo/#/portal/dashboard') || url.includes('/portal/rEportability/portabilityQuotation')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['showPopup.js'],
    });
    console.log('✅ Dashboard/Quotation UI Injected into tab:', tabId);
  }
  else if (url.includes('#auth/login') || (url.includes('faveo') && url.includes('/login'))) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['favLogin.js'],
    });
    console.log('✅ Login UI Injected into tab:', tabId);
  }
}

chrome.action.onClicked.addListener((tab) => {
  handlePopupInjection(tab.id, tab.url);
});

chrome.webNavigation.onCompleted.addListener((details) => {
  handlePopupInjection(details.tabId, details.url);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    handlePopupInjection(tabId, tab.url);
  }
});

// 🔒 [SESSION SECURITY] Reset authorization on browser startup or extension reload
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.set({ isAuthorized: false });
  console.log('🔄 Browser Restart: Session Locked.');
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    const newId = Math.floor(10000000 + Math.random() * 90000000).toString();
    chrome.storage.local.set({ favExtId: newId, isAuthorized: false });
    chrome.storage.sync.set({ favExtId: newId });
    console.log('✨ First Install: Generated Ext ID', newId);
  } else {
    chrome.storage.local.set({ isAuthorized: false });
    console.log('📦 Extension Reloaded: Session Locked.');
  }
});

let tableDataToUpload = [];
let uploadState = {
  total: 0,
  uploaded: 0,
  currentIndex: 0,
  chunkSize: 10,
  isPaused: false,
  isError: false,
  errorMessage: '',
  isLoopRunning: false,
  chunkHistory: []
};
let sourceTabId = null;

function syncStateToStorage() {
  chrome.storage.local.set({ 
    tableDataToUpload, 
    uploadState 
  });
}

function startUploadLoop() {
  if (uploadState.isLoopRunning && !uploadState.isPaused && !uploadState.isError) {
      return; 
  }

  if (uploadState.currentIndex >= uploadState.total) {
    uploadState.isLoopRunning = false;
    sendUpdateToContent('UPLOAD_COMPLETE', {
      total: uploadState.total,
      uploaded: uploadState.uploaded
    });
    syncStateToStorage();
    return;
  }

  if (uploadState.isPaused) {
    uploadState.isLoopRunning = true; // Wait for explicit resume
    return;
  }

  uploadState.isLoopRunning = true;
  const chunk = tableDataToUpload.slice(
    uploadState.currentIndex,
    uploadState.currentIndex + uploadState.chunkSize
  );

  if (chunk.length === 0) {
    uploadState.isLoopRunning = false;
    return;
  }

  const startTime = Date.now();
  const encodedChunk = 'data=' + encodeURIComponent(JSON.stringify(chunk));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  fetch('https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodedChunk,
    signal: controller.signal
  })
  .then(response => response.text())
  .then(text => {
    clearTimeout(timeoutId);
    let result;
    try { result = JSON.parse(text); } catch (e) { throw new Error('Invalid Server Response'); }

    if (result.status === 'success') {
      const timeTaken = Date.now() - startTime;
      uploadState.uploaded += chunk.length;
      uploadState.currentIndex += uploadState.chunkSize;
      
      const percent = Math.min(Math.round((uploadState.uploaded / uploadState.total) * 100), 100);
      
      sendUpdateToContent('UPLOAD_PROGRESS', {
        progressPercent: percent,
        uploadedCount: uploadState.uploaded,
        totalCount: uploadState.total,
        currentLead: chunk[0]
      });

      syncStateToStorage();
      uploadState.isLoopRunning = false;
      setTimeout(startUploadLoop, 1000);
    } else {
      throw new Error(result.message || 'Server Logic Error');
    }
  })
  .catch(err => {
    clearTimeout(timeoutId);
    uploadState.isLoopRunning = false;
    handleUploadError(err.message);
  });
}

function handleUploadError(errMsg) {
  uploadState.isPaused = true;
  uploadState.isError = true;
  uploadState.errorMessage = errMsg;
  sendUpdateToContent('UPLOAD_ERROR', {
    total: uploadState.total,
    uploaded: uploadState.uploaded,
    error: errMsg
  });
  syncStateToStorage();
}

function sendUpdateToContent(type, payload) {
  if (sourceTabId) {
    chrome.tabs.sendMessage(sourceTabId, { type, payload });
  } else {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type, payload });
    });
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TABLE_DATA') {
    if (sender && sender.tab) sourceTabId = sender.tab.id;
    tableDataToUpload = message.payload;
    const firstPending = tableDataToUpload.findIndex(l => !l.isUploaded);
    
    uploadState = {
      total: tableDataToUpload.length,
      uploaded: tableDataToUpload.filter(l => l.isUploaded).length,
      currentIndex: firstPending === -1 ? tableDataToUpload.length : firstPending,
      chunkSize: 10,
      isPaused: false,
      isError: false,
      errorMessage: '',
      sessionStartTime: Date.now()
    };
    syncStateToStorage();
    if (uploadState.currentIndex < uploadState.total) startUploadLoop();
    else sendUpdateToContent('UPLOAD_COMPLETE', { total: uploadState.total, uploaded: uploadState.uploaded, preChecked: true });
  }
  else if (message.type === 'PAUSE_UPLOAD') {
    uploadState.isPaused = true;
    syncStateToStorage();
    sendResponse({status: "paused"});
  }
  else if (message.type === 'RESUME_UPLOAD') {
    chrome.storage.local.get(['tableDataToUpload', 'uploadState'], (result) => {
      if (result.tableDataToUpload) tableDataToUpload = result.tableDataToUpload;
      if (result.uploadState) uploadState = result.uploadState;
      uploadState.isPaused = false;
      uploadState.isError = false; 
      syncStateToStorage();
      startUploadLoop();
    });
  }
  else if (message.type === 'RESTART_UPLOAD') {
    uploadState.isPaused = false;
    uploadState.isError = false;
    uploadState.uploaded = 0;
    uploadState.currentIndex = 0;
    syncStateToStorage();
    startUploadLoop();
  }
  else if (message.type === 'PING') {
    sendResponse({ type: 'PONG' });
  } 
  else if (message.type === 'FETCH_AGENTS') {
    chrome.storage.local.get(['favExtId'], function(res) {
      const extId = res.favExtId || '';
      const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=forlogin&extId=' + extId;
      fetch(APPS_SCRIPT_URL)
        .then(res => res.json())
        .then(agents => sendResponse({ success: true, agents }))
        .catch(err => sendResponse({ success: false, error: err.message }));
    });
    return true;
  }
  else if (message.type === 'UPDATE_PASSWORD') {
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=update_password';
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(message.payload)
    })
    .then(res => res.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  else if (message.type === 'GET_ALL_USERS') {
    fetch(`${APPS_SCRIPT_URL}?action=get_all_users`)
      .then(response => response.json())
      .then(data => sendResponse(data))
      .catch(error => sendResponse({ success: false, message: error.message }));
    return true; // Keep channel open
  }
  else if (message.type === 'SEND_ADMIN_OTP') {
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=send_admin_otp';
    fetch(APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
    .then(res => res.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  else if (message.type === 'VERIFY_ADMIN_OTP') {
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=verify_admin_otp';
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(message.payload)
    })
    .then(res => res.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  else if (message.type === 'REGISTER_USER') {
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=register_user';
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(message.payload)
    })
    .then(res => res.json())
    .then(data => sendResponse(data))
    .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  else if (message.type === 'CHECK_AUTH') {
    const timestamp = Date.now();
    let url = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=check_auth&extId=' + message.payload.extId + '&t=' + timestamp;
    if (message.payload.email) url += '&email=' + encodeURIComponent(message.payload.email);
    fetch(url).then(res => res.json()).then(data => sendResponse(data)).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  else if (message.type === 'VERIFY_USER_OTP') {
    const url = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=verify_user_otp&extId=' + message.payload.extId + '&otp=' + message.payload.otp;
    fetch(url).then(res => res.json()).then(data => sendResponse(data)).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
