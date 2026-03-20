function handlePopupInjection() {
  chrome.tabs.query({}, (tabs) => {
    const targetTab = tabs.find(t => t.url === 'https://faveo.careinsurance.com/NewFaveo/#/portal/dashboard');

    if (targetTab) {
      chrome.scripting.executeScript({
        target: { tabId: targetTab.id },
        files: ['showPopup.js'],
      });
      console.log('✅ Script executed on the target tab!');
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
        if (activeTabs[0]) {
          chrome.scripting.executeScript({
            target: { tabId: activeTabs[0].id },
            files: ['showCustomPopup.js'],
          });
        }
      });
    }
  });
}

// 🔘 Triggered when extension icon is clicked
chrome.action.onClicked.addListener(() => {
  handlePopupInjection();
});

// 🔁 Triggered when a URL loads completely
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.url.startsWith('https://faveo.careinsurance.com/NewFaveo/#/portal/dashboard')) {
    handlePopupInjection();
  }
}, {
  url: [{ urlMatches: 'https://faveo.careinsurance.com/NewFaveo/#/portal/dashboard' }]
});

// 🌀 Triggered when tab URL is updated (hash change etc.)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url &&
      tab.url.startsWith('https://faveo.careinsurance.com/NewFaveo/#/portal/dashboard')) {
    handlePopupInjection();
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
  errorMessage: ''
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
  console.log('📦 Background state restored from storage');
});

function startUploadLoop() {
  if (uploadState.currentIndex >= uploadState.total) {
    console.log('✅ Upload complete.');
    sendUpdateToContent('UPLOAD_COMPLETE', {
      total: uploadState.total,
      uploaded: uploadState.uploaded
    });
    syncStateToStorage();
    return;
  }

  if (uploadState.isPaused) {
    console.log('⏸ Upload Paused at index', uploadState.currentIndex);
    syncStateToStorage();
    return; // Wait for resume
  }

  const chunk = tableDataToUpload.slice(
    uploadState.currentIndex,
    uploadState.currentIndex + uploadState.chunkSize
  );

  if (chunk.length === 0) return;

  const startTime = Date.now();
  const encodedChunk = 'data=' + encodeURIComponent(JSON.stringify(chunk));

  fetch('https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodedChunk
  })
  .then(response => response.json())
  .then(result => {
    if (result.status === 'success') {
      const timeTaken = Date.now() - startTime;
      
      // Update the running average for chunk time
      if (!uploadState.avgChunkTime) {
         uploadState.avgChunkTime = timeTaken + 1000; // adding the delay as well
      } else {
         uploadState.avgChunkTime = (uploadState.avgChunkTime * 0.7) + ((timeTaken + 1000) * 0.3);
      }

      uploadState.uploaded += chunk.length;
      uploadState.currentIndex += uploadState.chunkSize;
      
      const remainingLeads = uploadState.total - uploadState.uploaded;
      const remainingChunks = Math.ceil(remainingLeads / uploadState.chunkSize);
      const estSecondsLeft = Math.ceil((remainingChunks * uploadState.avgChunkTime) / 1000);

      const percent = Math.min(Math.round((uploadState.uploaded / uploadState.total) * 100), 100);
      
      console.log(`🔄 Uploading... ${uploadState.uploaded}/${uploadState.total} rows (${percent}%) | Time: ${estSecondsLeft}s left`);

      sendUpdateToContent('UPLOAD_PROGRESS', {
        progressPercent: percent,
        uploadedCount: uploadState.uploaded,
        totalCount: uploadState.total,
        estSecondsLeft: estSecondsLeft,
        currentLead: chunk[0] // 🏠 Send current lead data for live display
      });

      syncStateToStorage();
      // Avoid blocking, schedule next chunk
      setTimeout(startUploadLoop, 1000);
    } else {
      console.error('❌ Server Error:', result.message);
      handleUploadError('Server Error: ' + result.message);
    }
  })
  .catch(err => {
    console.error('❌ Network Error:', err);
    handleUploadError('Network Error: ' + err.message);
  });
}

function handleUploadError(errMsg) {
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
    console.log('Received table data in background.js');
    if (sender && sender.tab) {
      sourceTabId = sender.tab.id; // Remember which tab is showing the UI
    }
    tableDataToUpload = message.payload;
    uploadState = {
      total: tableDataToUpload.length,
      uploaded: 0,
      currentIndex: 0,
      chunkSize: 10, // 🚀 1 by 1 for precise tracking and pausing
      isPaused: false,
      isError: false,
      errorMessage: ''
    };
    syncStateToStorage();
    startUploadLoop();
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
});
