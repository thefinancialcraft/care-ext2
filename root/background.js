function handlePopupInjection(tabId, url) {
  if (!url) return;

  if (url.startsWith('https://faveo.careinsurance.com/NewFaveo') && !url.includes('#auth/login') && !url.includes('#/auth/resetpwd')) {
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

function triggerSheetsSync() {
  console.log('🔄 Triggering Supabase Edge Function to sync all data to Google Sheets...');
  fetch('https://qfbeskgvxjwqccaraulv.supabase.co/functions/v1/sync-to-sheets', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  })
  .then(res => res.json())
  .then(data => {
    console.log('✅ Supabase Edge Function Sync Complete:', data);
  })
  .catch(err => {
    console.error('❌ Failed to trigger Supabase Edge Function Sync:', err);
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
    logSyncToSupabase('SUCCESS', uploadState.total, uploadState.uploaded, null);

    chrome.storage.local.get(['useGoogleSheet'], (res) => {
      if (!res.useGoogleSheet) {
        triggerSheetsSync();
      }
    });

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

  chrome.storage.local.get(['useGoogleSheet'], (res) => {
    const useGoogleSheet = res.useGoogleSheet || false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    if (!useGoogleSheet) {
      const parseNumeric = (val) => {
        if (val === undefined || val === null || val === '') return null;
        const clean = String(val).replace(/,/g, '').trim();
        const num = parseFloat(clean);
        return isNaN(num) ? null : num;
      };

      const parseIntValue = (val) => {
        if (val === undefined || val === null || val === '') return null;
        const clean = String(val).replace(/,/g, '').trim();
        const num = parseInt(clean, 10);
        return isNaN(num) ? null : num;
      };

      const formattedRows = chunk.map(row => {
        const normalized = {};
        for (let key in row) {
          if (key && key.trim()) {
            const cleanKey = key.trim().toUpperCase().replace(/\.+$/, '');
            normalized[cleanKey] = row[key];
          }
        }

        return {
          proposal_no: normalized['PROPOSAL_NO']?.toString().trim() || null,
          customer_name: normalized['CUSTOMER_NAME']?.toString().trim() || null,
          payment_amount: parseNumeric(normalized['PAYMENT_AMOUNT']),
          gwp: parseNumeric(normalized['GWP']),
          login_date: normalized['LOGIN_DATE']?.toString().trim() || null,
          proposal_status: normalized['PROPOSAL_STATUS']?.toString().trim() || null,
          policy_no: normalized['POLICY_NO']?.toString().trim() || null,
          policy_start_date: normalized['POLICY_START_DATE']?.toString().trim() || null,
          no_of_lives: parseIntValue(normalized['NO._OF_LIVES']) || parseIntValue(normalized['NO_OF_LIVES']),
          business_type: normalized['BUSINESS_TYPE']?.toString().trim() || null,
          plan: normalized['PLAN']?.toString().trim() || null,
          agent_name: normalized['AGENT_NAME']?.toString().trim() || null,
          updated_at: new Date().toISOString()
        };
      }).filter(r => r.proposal_no);

      const uniqueRowsMap = new Map();
      formattedRows.forEach(row => {
        uniqueRowsMap.set(row.proposal_no, row);
      });
      const uniqueFormattedRows = Array.from(uniqueRowsMap.values());

      if (uniqueFormattedRows.length === 0) {
        clearTimeout(timeoutId);
        uploadState.uploaded += chunk.length;
        uploadState.currentIndex += uploadState.chunkSize;
        uploadState.isLoopRunning = false;
        startUploadLoop();
        return;
      }

      const SUPABASE_URL = 'https://qfbeskgvxjwqccaraulv.supabase.co/rest/v1/faveo_data?on_conflict=proposal_no';
      const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmYmVza2d2eGp3cWNjYXJhdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjQwMTQsImV4cCI6MjA5NzIwMDAxNH0.IPCGYN-v7UkRDygrvcGyZC-3uxjFoiSy7lTUoVe_l9M';

      fetch(SUPABASE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(uniqueFormattedRows),
        signal: controller.signal
      })
        .then(response => {
          clearTimeout(timeoutId);
          if (!response.ok) {
            return response.text().then(text => {
              throw new Error(`Supabase Error: ${response.status} - ${text}`);
            });
          }
          uploadState.uploaded += chunk.length;
          uploadState.currentIndex += uploadState.chunkSize;
          const percent = Math.min(Math.round((uploadState.uploaded / uploadState.total) * 100), 100);

          const lastBatchTime = Date.now() - startTime;
          const duration = lastBatchTime / 1000;
          if (!uploadState.chunkHistory) uploadState.chunkHistory = [];
          uploadState.chunkHistory.push(duration);
          if (uploadState.chunkHistory.length > 10) uploadState.chunkHistory.shift();

          const avgChunkTime = uploadState.chunkHistory.reduce((a, b) => a + b, 0) / uploadState.chunkHistory.length;
          const remainingChunks = Math.ceil((uploadState.total - uploadState.uploaded) / uploadState.chunkSize);
          const estSecondsLeft = Math.round(remainingChunks * avgChunkTime);
          const totalChunks = Math.ceil(uploadState.total / uploadState.chunkSize);
          const totalEstSeconds = Math.round(totalChunks * avgChunkTime);

          sendUpdateToContent('UPLOAD_PROGRESS', {
            progressPercent: percent,
            uploadedCount: uploadState.uploaded,
            totalCount: uploadState.total,
            estSecondsLeft: estSecondsLeft,
            totalEstSeconds: totalEstSeconds,
            currentLead: chunk[0],
            avgChunkTime: avgChunkTime,
            lastBatchTime: lastBatchTime,
            chunkHistory: uploadState.chunkHistory,
            chunkSize: uploadState.chunkSize
          });

          syncStateToStorage();
          uploadState.isLoopRunning = false;
          setTimeout(startUploadLoop, 1000);
        })
        .catch(err => {
          clearTimeout(timeoutId);
          uploadState.isLoopRunning = false;
          handleUploadError(err.message);
        });

    } else {
      const encodedChunk = 'data=' + encodeURIComponent(JSON.stringify(chunk));

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
            uploadState.uploaded += chunk.length;
            uploadState.currentIndex += uploadState.chunkSize;
            const percent = Math.min(Math.round((uploadState.uploaded / uploadState.total) * 100), 100);

            const lastBatchTime = Date.now() - startTime;
            const duration = lastBatchTime / 1000;
            if (!uploadState.chunkHistory) uploadState.chunkHistory = [];
            uploadState.chunkHistory.push(duration);
            if (uploadState.chunkHistory.length > 10) uploadState.chunkHistory.shift();

            const avgChunkTime = uploadState.chunkHistory.reduce((a, b) => a + b, 0) / uploadState.chunkHistory.length;
            const remainingChunks = Math.ceil((uploadState.total - uploadState.uploaded) / uploadState.chunkSize);
            const estSecondsLeft = Math.round(remainingChunks * avgChunkTime);
            const totalChunks = Math.ceil(uploadState.total / uploadState.chunkSize);
            const totalEstSeconds = Math.round(totalChunks * avgChunkTime);

            sendUpdateToContent('UPLOAD_PROGRESS', {
              progressPercent: percent,
              uploadedCount: uploadState.uploaded,
              totalCount: uploadState.total,
              estSecondsLeft: estSecondsLeft,
              totalEstSeconds: totalEstSeconds,
              currentLead: chunk[0],
              avgChunkTime: avgChunkTime,
              lastBatchTime: lastBatchTime,
              chunkHistory: uploadState.chunkHistory,
              chunkSize: uploadState.chunkSize
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
  });
}

function logSyncToSupabase(status, totalRecords = 0, uploadedRecords = 0, errorMessage = null) {
  chrome.storage.local.get(['selectedAgentId', 'selectedAgentName', 'filterStartDate', 'filterEndDate'], (res) => {
    const SUPABASE_LOGS_URL = 'https://qfbeskgvxjwqccaraulv.supabase.co/rest/v1/faveo_logs';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmYmVza2d2eGp3cWNjYXJhdWx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MjQwMTQsImV4cCI6MjA5NzIwMDAxNH0.IPCGYN-v7UkRDygrvcGyZC-3uxjFoiSy7lTUoVe_l9M';

    let startDate = null;
    let endDate = null;

    if (Array.isArray(tableDataToUpload) && tableDataToUpload.length > 0) {
      const dates = tableDataToUpload
        .map(row => {
          let dVal = null;
          for (let key in row) {
            if (key) {
              const cleanKey = key.trim().toUpperCase().replace(/\.+$/, '');
              if (cleanKey === 'LOGIN_DATE' || cleanKey === 'POLICY_START_DATE' || cleanKey.includes('DATE')) {
                dVal = row[key];
                if (cleanKey === 'LOGIN_DATE') break; // Prioritize LOGIN_DATE
              }
            }
          }
          return dVal ? dVal.toString().trim() : null;
        })
        .filter(Boolean);

      if (dates.length > 0) {
        // Parse and sort dates to find min (start_date) and max (end_date)
        const parsed = dates.map(d => {
          const parts = d.split(/[\/\-\.]/);
          let dateObj = null;
          if (parts.length === 3) {
            if (parts[0].length === 4) dateObj = new Date(parts[0], parts[1] - 1, parts[2]); // YYYY-MM-DD
            else dateObj = new Date(parts[2], parts[1] - 1, parts[0]); // DD/MM/YYYY
          } else {
            dateObj = new Date(d);
          }
          return { raw: d, time: dateObj && !isNaN(dateObj.getTime()) ? dateObj.getTime() : null };
        }).filter(item => item.time !== null);

        if (parsed.length > 0) {
          parsed.sort((a, b) => a.time - b.time);
          startDate = parsed[0].raw;
          endDate = parsed[parsed.length - 1].raw;
        }
      }
    }

    // Fallback to page filter dates if extracted row dates are null
    if (!startDate) startDate = res.filterStartDate || null;
    if (!endDate) endDate = res.filterEndDate || null;

    const generate6CharId = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const logPayload = {
      id: generate6CharId(),
      agent_id: res.selectedAgentId || null,
      agent_name: res.selectedAgentName || null,
      status: status,
      total_records: totalRecords,
      uploaded_records: uploadedRecords,
      start_date: startDate,
      end_date: endDate,
      error_message: errorMessage,
      timestamp: new Date().toISOString()
    };

    fetch(SUPABASE_LOGS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      },
      body: JSON.stringify(logPayload)
    })
      .then(res => {
        if (!res.ok) console.warn('⚠️ Supabase Log insert returned status:', res.status);
        else console.log('📝 Sync Log updated in faveo_logs table:', status);
      })
      .catch(err => {
        console.error('❌ Error updating faveo_logs table:', err);
      });
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
  logSyncToSupabase('ERROR', uploadState.total, uploadState.uploaded, errMsg);
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
    if (uploadState.currentIndex < uploadState.total) {
      startUploadLoop();
    }
    else sendUpdateToContent('UPLOAD_COMPLETE', { total: uploadState.total, uploaded: uploadState.uploaded, preChecked: true });
  }
  else if (message.type === 'PAUSE_UPLOAD') {
    uploadState.isPaused = true;
    syncStateToStorage();
    sendResponse({ status: "paused" });
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
    chrome.storage.local.get(['favExtId'], function (res) {
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
    fetch(url).then(res => res.json()).then(data => sendResponse(data)).catch(err => sendResponse({ success: false, error: err.message, message: 'Network / Connection Error. Please try again.' }));
    return true;
  }
  else if (message.type === 'VERIFY_USER_OTP') {
    const url = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=verify_user_otp&extId=' + message.payload.extId + '&otp=' + message.payload.otp;
    fetch(url).then(res => res.json()).then(data => sendResponse(data)).catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  else if (message.type === 'REOPEN_LOGIN_TAB') {
    const loginUrl = 'https://faveo.careinsurance.com/NewFaveo/#auth/login';
    const targetTabId = sender.tab ? sender.tab.id : null;
    chrome.tabs.create({ url: loginUrl }, function() {
      if (targetTabId) {
        chrome.tabs.remove(targetTabId);
      }
    });
    sendResponse({ success: true });
    return true;
  }
  else if (message.type === 'SET_MASTER_MODE') {
    const isMaster = message.payload.isMaster;
    if (isMaster) {
      chrome.storage.local.get(['favExtId'], function(res) {
        const extId = res.favExtId || '';
        const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyJcoGYhZOCybJRgvZTRial7Kb1XA4R4rIYKx2bkYJ-xgyPhYvsKM8f1T8V85OJJQIM/exec?action=forlogin&extId=' + extId;
        fetch(APPS_SCRIPT_URL)
          .then(r => r.json())
          .then(agents => {
            chrome.storage.local.set({
              is_master_extension: true,
              is_autopilot_active: true,
              autopilot_paused: false,
              autopilot_index: 0,
              autopilot_next_login_time: 0,
              autopilot_agents: agents
            }, function() {
              chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0] && tabs[0].url && tabs[0].url.includes('faveo.careinsurance.com')) {
                  chrome.tabs.update(tabs[0].id, { url: 'https://faveo.careinsurance.com/NewFaveo/#auth/login' });
                }
              });
              sendResponse({ success: true });
            });
          })
          .catch(err => {
            sendResponse({ success: false, error: err.message });
          });
      });
    } else {
      chrome.storage.local.set({
        is_master_extension: false,
        is_autopilot_active: false,
        autopilot_paused: false
      }, function() {
        chrome.storage.local.remove(['autopilot_agents', 'autopilot_index', 'autopilot_next_login_time'], function() {
          sendResponse({ success: true });
        });
      });
    }
    return true;
  }
});

let unlockedExtensions = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // ... existing message handling ...
  if (message.type === 'UNLOCK_EXTENSIONS') {
    unlockedExtensions = true;
    chrome.tabs.update(sender.tab.id, { url: 'chrome://extensions/' });
    
    let secondsLeft = 15;
    chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
    chrome.action.setBadgeText({ text: String(secondsLeft) });
    
    const countdownInterval = setInterval(() => {
      secondsLeft--;
      if (secondsLeft > 0) {
        chrome.action.setBadgeText({ text: String(secondsLeft) });
      } else {
        clearInterval(countdownInterval);
        chrome.action.setBadgeText({ text: '' });
      }
    }, 1000);

    // Lock it back after 15 seconds and close the extension tabs
    setTimeout(() => {
      unlockedExtensions = false;
      
      // Close the specific tab that was opened for extensions
      if (sender.tab && sender.tab.id) {
         chrome.tabs.remove(sender.tab.id).catch(() => {});
      }
      
      // Also try to find any other chrome://extensions tabs (fallback)
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(t => {
          if (t.url && (t.url === 'chrome://extensions/' || t.url.startsWith('chrome://extensions/?'))) {
            chrome.tabs.remove(t.id).catch(() => {});
          }
        });
      });
    }, 15 * 1000);
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.url && tab.url.includes('chrome://extensions/?id=')) {
    chrome.tabs.remove(tabId);
  } else if (tab.url && (tab.url === 'chrome://extensions/' || tab.url.startsWith('chrome://extensions/?')) && !unlockedExtensions) {
    // Redirect to a custom extension page to ask for password
    chrome.tabs.update(tabId, { url: chrome.runtime.getURL('auth.html') });
  }
});

// 🤖 Autopilot Tab Redirector Loop
setInterval(() => {
  chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
    if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused) {
      chrome.tabs.query({}, (tabs) => {
        const faveoTab = tabs.find(tab => tab.url && tab.url.includes('faveo.careinsurance.com'));
        if (!faveoTab) {
          chrome.tabs.query({ active: true, currentWindow: true }, (activeTabs) => {
            if (activeTabs[0] && activeTabs[0].url && !activeTabs[0].url.startsWith('chrome://')) {
              chrome.tabs.update(activeTabs[0].id, { url: 'https://faveo.careinsurance.com/NewFaveo/#auth/login' });
            } else {
              chrome.tabs.create({ url: 'https://faveo.careinsurance.com/NewFaveo/#auth/login' });
            }
          });
        } else {
          const url = faveoTab.url.toLowerCase();
          if (!url.includes('newfaveo/#auth/login') && !url.includes('newfaveo/#/portal')) {
            chrome.tabs.update(faveoTab.id, { url: 'https://faveo.careinsurance.com/NewFaveo/#auth/login' });
          }
        }
      });
    }
  });
}, 8000);

