function handlePopupInjection(tabId, url) {
  if (!url) return;
  
  // 📊 DASHBOARD: Show Progress/Extraction Popup
  if (url.startsWith('https://faveo.careinsurance.com/NewFaveo/#/portal/dashboard')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['showPopup.js'],
    });
    console.log('✅ Dashboard UI Injected into tab:', tabId);
  } 
  // 🔑 LOGIN: Show Agent Selector Popup
  else if (url.includes('#auth/login') || (url.includes('faveo') && url.includes('/login'))) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['favLogin.js'],
    });
    console.log('✅ Login UI Injected into tab:', tabId);
  }
}

// 🔘 Triggered when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  handlePopupInjection(tab.id, tab.url);
});

// 🔁 Triggered when a URL loads completely
chrome.webNavigation.onCompleted.addListener((details) => {
  handlePopupInjection(details.tabId, details.url);
});

// 🌀 Triggered when tab URL is updated (hash change etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    handlePopupInjection(tabId, tab.url);
  }
});


let tableDataToUpload = [];
let uploadState = {
  total: 0,
  uploaded: 0,
  currentIndex: 0,
  chunkSize: 10, // 🚀 Process 1 by 1 for better tracking and resume logic
  isPaused: false,
  isError: false,
  errorMessage: '',
  isLoopRunning: false,
  chunkHistory: [] // 📈 Track history for the graph
};

function syncStateToStorage() {
  chrome.storage.local.set({ 
    tableDataToUpload, 
    uploadState 
  });
}

// 📦 Try to restore state on Service Worker startup
chrome.storage.local.get(['tableDataToUpload', 'uploadState'], (result) => {
  if (result.tableDataToUpload) tableDataToUpload = result.tableDataToUpload;
  if (result.uploadState) uploadState = result.uploadState;
  const count = tableDataToUpload ? tableDataToUpload.length : 0;
  console.log(`%c[SYSTEM] %cMemory Restored: %c${count} leads found.`, "color:#9c27b0; font-weight:bold;", "color:#e67e22; font-weight:bold;", "color:#9c27b0; font-weight:bold;");
});

function startUploadLoop() {
  if (uploadState.isLoopRunning && !uploadState.isPaused && !uploadState.isError) {
      console.warn('⚠️ Loop already running. Check in-flight request.');
      return; 
  }

  if (uploadState.currentIndex >= uploadState.total) {
    const totalTime = ((Date.now() - (uploadState.sessionStartTime || Date.now())) / 1000).toFixed(1);
    const avgSpeed = (uploadState.total / totalTime).toFixed(2);

    console.group(`%c🏁 SESSION COMPLETE | Final Audit`, "background:#f1c40f; color:white; padding:2px 5px; font-weight:bold; border-radius:3px;");
    console.log(`%c✅ Total Successfully Uploaded: %c${uploadState.uploaded}/${uploadState.total}`, "color:#e67e22; font-weight:bold;", "color:#f1c40f; font-weight:bold;");
    console.log(`%c⏱️ Total Session Duration: %c${totalTime}s`, "color:#e67e22; font-weight:bold;", "color:#0065b3; font-weight:bold;");
    console.log(`%c🚀 Effective Upload Speed: %c${avgSpeed} leads/sec`, "color:#e67e22; font-weight:bold;", "color:#ff9800; font-weight:bold;");
    console.groupEnd();

    uploadState.isLoopRunning = false;
    sendUpdateToContent('UPLOAD_COMPLETE', {
      total: uploadState.total,
      uploaded: uploadState.uploaded
    });
    syncStateToStorage();
    return;
  }

  if (uploadState.isPaused) {
    console.log('⏸ Upload Paused at index', uploadState.currentIndex);
    uploadState.isLoopRunning = false;
    syncStateToStorage();
    return; // Wait for resume
  }

  uploadState.isLoopRunning = true;
  const chunk = tableDataToUpload.slice(
    uploadState.currentIndex,
    uploadState.currentIndex + uploadState.chunkSize
  );

  if (chunk.length === 0) {
    console.log('🏁 Batch empty. All leads uploaded.');
    uploadState.isLoopRunning = false;
    return;
  }

  const startTime = Date.now();
  const batchNum = Math.floor(uploadState.currentIndex / uploadState.chunkSize) + 1;
  const totalBatches = Math.ceil(uploadState.total / uploadState.chunkSize);

  console.group(`%c🚀 BATCH ${batchNum}/${totalBatches} (%c${chunk.length} leads%c)`, "color:#0065b3; font-weight:bold;", "color:#e91e63; font-weight:bold;", "color:#0065b3;");
  console.log(`---------------------------------------------------------`);
  
  const encodedChunk = 'data=' + encodeURIComponent(JSON.stringify(chunk));
  console.log(`%c📤 [BG -> APPSCRIPT] %cSending Payload...`, "color:#f1c40f; font-weight:bold;", "color:#e67e22; font-weight:bold;");

  // ⏱️ 45s Timeout for large batches or slow DB
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
     console.warn(`⏳ [TIMEOUT] Batch ${batchNum} took > 45s! Aborting...`);
     controller.abort();
  }, 45000);

  fetch('https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodedChunk,
    signal: controller.signal
  })
  .then(response => {
    console.log(`---------------------------------------------------------`);
    console.log(`%c📥 [APPSCRIPT -> BG] %cReceived HTTP ${response.status}`, "color:#ff9800; font-weight:bold;", "color:#e67e22; font-weight:bold;");
    return response.text();
  })
  .then(text => {
    clearTimeout(timeoutId);
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      uploadState.isLoopRunning = false;
      console.log(`---------------------------------------------------------`);
      console.error(`%c❌ [ERROR] %cInvalid response: %c${text.substring(0, 100)}`, "color:red; font-weight:bold;", "color:#e67e22; font-weight:bold;", "color:red;");
      handleUploadError('Invalid Server Response');
      console.groupEnd();
      return;
    }

    if (result.status === 'success') {
      const timeTaken = Date.now() - startTime;
      const totalUploadedNow = uploadState.uploaded + chunk.length;
      const percent = Math.min(Math.round((totalUploadedNow / uploadState.total) * 100), 100);
      const remainingLeads = uploadState.total - totalUploadedNow;
      const remainingChunks = Math.ceil(remainingLeads / uploadState.chunkSize);

      console.log(`---------------------------------------------------------`);
      console.log(`%c✅ [SUCCESS] %cBatch finished in %c${(timeTaken/1000).toFixed(1)}s`, "color:#f1c40f; font-weight:bold;", "color:#e67e22; font-weight:bold;", "color:#f1c40f; font-weight:bold;");
      console.log(`%c📊 [PROGRESS] %c${percent}% Completed. ${remainingLeads} leads remaining.`, "color:#0065b3; font-weight:bold;", "color:#e67e22; font-weight:bold;");
      console.log(`---------------------------------------------------------`);
      console.groupEnd();

      uploadState.uploaded = totalUploadedNow;
      uploadState.currentIndex += uploadState.chunkSize;

      // 🕒 Update Average Batch Time (Weighted Moving Average)
      // We add 1.5s for scheduling overhead
      const currentBatchFullTime = timeTaken + 1500; 
      if (!uploadState.avgChunkTime) {
          uploadState.avgChunkTime = currentBatchFullTime;
      } else {
          uploadState.avgChunkTime = (uploadState.avgChunkTime * 0.7) + (currentBatchFullTime * 0.3);
      }
      
      const estSecondsLeft = Math.ceil((remainingChunks * uploadState.avgChunkTime) / 1000);
      
      // 📈 Append to history for the graph
      if (!uploadState.chunkHistory) uploadState.chunkHistory = [];
      uploadState.chunkHistory.push(Number((timeTaken / 1000).toFixed(2)));

      sendUpdateToContent('UPLOAD_PROGRESS', {
        progressPercent: percent,
        uploadedCount: uploadState.uploaded,
        totalCount: uploadState.total,
        estSecondsLeft: estSecondsLeft,
        chunkSize: uploadState.chunkSize, 
        avgChunkTime: uploadState.avgChunkTime,
        lastBatchTime: timeTaken, 
        chunkHistory: uploadState.chunkHistory, 
        currentLead: chunk[0]
      });

      syncStateToStorage();
      uploadState.isLoopRunning = false;
      setTimeout(startUploadLoop, 1000);
    } else {
      uploadState.isLoopRunning = false;
      console.error('❌ [DB ERROR] Server Business Logic Error:', result);
      handleUploadError('Server Error: ' + (result.message || JSON.stringify(result)));
    }
  })
  .catch(err => {
    clearTimeout(timeoutId);
    uploadState.isLoopRunning = false;
    const msg = err.name === 'AbortError' ? 'Request Timeout (30s)' : 'Network Error';
    console.error(`❌ ${msg}:`, err);
    handleUploadError(msg + ': ' + err.message);
  });
}

function handleUploadError(errMsg) {
  console.warn(`🛑 [UPLOAD TERMINATED] Reason: ${errMsg} | State: Paused at index ${uploadState.currentIndex}`);
  uploadState.isPaused = true;
  uploadState.isError = true;
  uploadState.errorMessage = errMsg;
  sendUpdateToContent('UPLOAD_ERROR', {
    total: uploadState.total,
    uploaded: uploadState.uploaded,
    error: errMsg,
    index: uploadState.currentIndex
  });
  syncStateToStorage();
}

let sourceTabId = null;

function sendUpdateToContent(type, payload) {
  console.log(`%c📤 [BG -> POPUP] %cSending: %c${type}`, "color:#2196f3; font-weight:bold;", "color:#e67e22; font-weight:bold;", "color:#2196f3; font-weight:bold;");
  if (sourceTabId) {
    // Send reliably to the exact tab that started the process, even if it's in the background
    chrome.tabs.sendMessage(sourceTabId, { type, payload });
  } else {
    // Fallback just in case
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type, payload });
    });
  }
}

// Listener to start the process
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TABLE_DATA') {
    const rowCount = message.payload ? message.payload.length : 0;
    const tabName = (sender && sender.tab) ? sender.tab.title : 'Unknown Tab';
    
    console.groupCollapsed(`%c📥 [NEW PAYLOAD] %cReceived %c${rowCount} leads %cfrom: %c${tabName}`, "color:#f1c40f; font-weight:bold;", "color:#e67e22; font-weight:bold;", "color:#f1c40f; font-weight:bold;", "color:#e67e22; font-weight:bold;", "color:#0065b3; font-weight:bold;");
    
    if (sender && sender.tab) {
      sourceTabId = sender.tab.id; // Remember which tab is showing the UI
    }
    tableDataToUpload = message.payload;
    
    // 🚀 Smart Start: Skip leads that were already marked as uploaded in the payload
    const firstPending = tableDataToUpload.findIndex(l => !l.isUploaded);
    const uploadedInPayload = tableDataToUpload.filter(l => l.isUploaded).length;

    console.log(`🔍 [ANALYSIS] Found %c${uploadedInPayload} already uploaded.`, "color:#ff9800; font-weight:bold;");
    console.log(`📍 [POINTER] Resuming from first pending at: %cIndex ${firstPending}`, "color:#9c27b0; font-weight:bold;");
    console.groupEnd();

    uploadState = {
      total: tableDataToUpload.length,
      uploaded: uploadedInPayload,
      currentIndex: firstPending === -1 ? tableDataToUpload.length : firstPending,
      chunkSize: 10,
      isPaused: false,
      isError: false,
      errorMessage: '',
      sessionStartTime: Date.now() // 🕒 Track session start for summary
    };
    syncStateToStorage();
    if (uploadState.currentIndex < uploadState.total) {
        startUploadLoop();
    } else {
        console.log('All leads in payload already uploaded.');
        sendUpdateToContent('UPLOAD_COMPLETE', { 
            total: uploadState.total, 
            uploaded: uploadState.uploaded, 
            preChecked: true 
        });
    }
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
    const pulseCount = (uploadState.pulseCount || 0) + 1;
    uploadState.pulseCount = pulseCount;
    if (pulseCount % 30 === 0) console.log(`%c💓 [HEARTBEAT] %cService Worker is Active.`, "color:#f1c40f; font-weight:bold;", "color:#f1c40f;");
    sendResponse({ type: 'PONG' });
  } 
  else if (message.type === 'FETCH_AGENTS') {
    // 🚀 UNIFIED URL with 'forlogin' action
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=forlogin';
    
    fetch(APPS_SCRIPT_URL)
      .then(res => res.json())
      .then(agents => sendResponse({ success: true, agents }))
      .catch(err => {
        console.error('❌ Failed to fetch agents:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep channel open
  }
  else if (message.type === 'UPDATE_PASSWORD') {
    // 🚀 NEW: Update password in Google Sheet via Apps Script
    const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=update_password';
    
    fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(message.payload)
    })
    .then(res => res.json())
    .then(data => {
        console.log('✅ Sheet Update Result:', data);
        sendResponse(data);
    })
    .catch(err => {
        console.error('❌ Failed to update password in Sheet:', err);
        sendResponse({ success: false, error: err.message });
    });
    return true; // Keep channel open
  }
});

