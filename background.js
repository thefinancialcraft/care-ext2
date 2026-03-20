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
  chunkSize: 10, // Chunk size can be adjusted
  isPaused: false,
  isError: false,
  errorMessage: ''
};

function startUploadLoop() {
  if (uploadState.currentIndex >= uploadState.total) {
    console.log('✅ Upload complete.');
    sendUpdateToContent('UPLOAD_COMPLETE', {
      total: uploadState.total,
      uploaded: uploadState.uploaded
    });
    return;
  }

  if (uploadState.isPaused) {
    console.log('⏸ Upload Paused at index', uploadState.currentIndex);
    return; // Wait for resume
  }

  const chunk = tableDataToUpload.slice(
    uploadState.currentIndex,
    uploadState.currentIndex + uploadState.chunkSize
  );

  if (chunk.length === 0) return;

  const encodedChunk = 'data=' + encodeURIComponent(JSON.stringify(chunk));

  fetch('https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: encodedChunk
  })
  .then(response => response.json())
  .then(result => {
    if (result.status === 'success') {
      uploadState.uploaded += chunk.length;
      uploadState.currentIndex += uploadState.chunkSize;
      
      const percent = Math.min(Math.round((uploadState.uploaded / uploadState.total) * 100), 100);
      
      console.log(`🔄 Uploading... ${uploadState.uploaded}/${uploadState.total} rows (${percent}%)`);

      sendUpdateToContent('UPLOAD_PROGRESS', {
        progressPercent: percent,
        uploadedCount: uploadState.uploaded,
        totalCount: uploadState.total
      });

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
      chunkSize: 10,
      isPaused: false,
      isError: false,
      errorMessage: ''
    };
    startUploadLoop();
  }
  else if (message.type === 'PAUSE_UPLOAD') {
    uploadState.isPaused = true;
    sendResponse({status: "paused"});
  }
  else if (message.type === 'RESUME_UPLOAD') {
    uploadState.isPaused = false;
    uploadState.isError = false; 
    startUploadLoop();
  }
  else if (message.type === 'RESTART_UPLOAD') {
    uploadState.isPaused = false;
    uploadState.isError = false;
    uploadState.uploaded = 0;
    uploadState.currentIndex = 0;
    startUploadLoop();
  }
});
