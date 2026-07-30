(function () {
    // 🛡️ STOP IF ORPHANED: Check if chrome context is already invalidated
    if (!chrome.runtime?.id) {
       console.error('Extension context is invalidated. Refresh the page to continue.');
       return;
    }

    // 🛡️ PREVENT DUAL RUNS: Stop if a version is already active
    if (window.careExtInitialized) {
       console.warn('showPopup.js already running. Stopping redundant instance.');
       return;
    }
    window.careExtInitialized = true;
    let extensionGlobalActive = true;
    let isAutoSyncRunning = false;
    let isUploadPaused = false; // 🚀 New flag for error/pause states   // 🚀 Auto-pilot state
    let isBackgroundActive = true;   // 🚀 Tracking the service worker heartbeat
    let lastKnownPulse = Date.now(); // 🚀 Last known heartbeat time
    let isGamePlaying = false;       // 🚀 Tic-Tac-Toe state
    let tableData = [];              // 🚀 Extraction cache
    let accumulatedData = [];        // 🚀 Final data set
    let syncStartTime = null;        // 🚀 Timer tracking
    let isNameFetchComplete = false; // 🚀 Flag to delay sidebar cleanup

    const stopAllExtensionProcesses = () => {
        console.warn('🛑 stopAllExtensionProcesses CALLED! Deactivating global state.');
        extensionGlobalActive = false;
        isAutoSyncRunning = false; // 🚀 Reset UI state
        // Wipe data
        tableData = [];
        accumulatedData = [];
        
        // Cleanup UI
        removeExtractionOverlay();
        updateMinimizedStatus(); // 🔄 Force refresh UI

        const popup = document.getElementById('my-dashboard-popup');
        const miniBar = document.getElementById('compactStatusBar');
        console.log(`🧹 [CLEANUP] Removing UI Elements. Popup exists: ${!!popup} | MiniBar exists: ${!!miniBar}`);
        if (popup) popup.remove();
        if (miniBar) miniBar.remove();
        document.querySelectorAll('#loader-spinner').forEach(s => s.remove()); // 🧹 Cleanup any stray spinners

        // Stop background upload
        if (chrome.runtime?.id) {
            chrome.runtime.sendMessage({ type: 'PAUSE_UPLOAD' });
        }
        
        console.log('🛑 Extension: All processes stopped and data erased.');
    };

    // ====== ICON LOADERS ======
    const loadIconCDN = () => {
      const loadCDN = (href) => {
        if (!document.querySelector(`link[href="${href}"]`)) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          document.head.appendChild(link);
        }
      };
  
      loadCDN('https://cdn-uicons.flaticon.com/3.0.0/uicons-thin-straight/css/uicons-thin-straight.css'); // Drag Icon
      loadCDN('https://cdn-uicons.flaticon.com/2.6.0/uicons-bold-rounded/css/uicons-bold-rounded.css'); // Cross Icon
      loadCDN('https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css'); // Minimize Icon
      loadCDN('https://cdn-uicons.flaticon.com/3.0.0/uicons-thin-rounded/css/uicons-thin-rounded.css'); // Thin Rounded Icons (New)
    };
    
    // ====== SPINNER CREATION ======
    const createSpinner = () => {
      const spinnerContainer = document.createElement('div');
      spinnerContainer.id = 'loader-spinner'; // 🚀 Added ID for easier cleanup
      spinnerContainer.style.display = 'none'; // 🚀 Hidden by default now!
      spinnerContainer.style.position = 'absolute';
      spinnerContainer.style.justifyContent = 'center';
      spinnerContainer.style.alignItems = 'center';
      spinnerContainer.style.right = '20px';
      spinnerContainer.style.top = '60px';
  
      const spinner = document.createElement('div');
      spinner.style.border = '4px solid #f3f3f3';
      spinner.style.borderTop = '4px solid #0065b3';
      spinner.style.borderRadius = '50%';
      spinner.style.width = '30px';
      spinner.style.height = '30px';
      spinner.style.animation = 'spin 1s linear infinite';
      spinnerContainer.appendChild(spinner);
      return spinnerContainer;
    };
  
    const addSpinnerStyle = () => {
      const style = document.createElement('style');
      style.innerHTML = `
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    };


  
    // ====== TOP BAR CREATION ======
    const createTopBar = (popup) => {
      const topContainer = document.createElement('div');
      Object.assign(topContainer.style, {
        display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        width: '100%', height: '40px', borderBottom: '1px solid #bcbcbc', marginBottom: '10px', padding: '0 10px',
        boxSizing: 'border-box'
      });

      // 🧹 Cleanup Observer: Handle sidebar elements visibility based on permissions
      const observer = new MutationObserver(() => {
          if (!isNameFetchComplete) return; // 🛡️ Wait until name fetch is done

          chrome.storage.local.get(['renewal_visible', 'profile_visible'], function(res) {
              const renewalVisible = res.renewal_visible !== false; 
              const profileVisible = res.profile_visible !== false;

              // Cleanup Renewal
              if (renewalVisible === false) {
                  const unwantedUl = document.querySelector('ul.list-group.panel:has(.side_renewal_navigation)');
                  if (unwantedUl) {
                      unwantedUl.remove();
                      console.log('🧹 Cleaned up unwanted Renewal sidebar element (Permission: FALSE).');
                  }
                  
                  // Cleanup Renewal Notification dropdown
                  const renewalNotificationLink = document.querySelector('a[title="Policy Renewal Notification"]');
                  if (renewalNotificationLink) {
                      const notificationLi = renewalNotificationLink.closest('li');
                      if (notificationLi) {
                          notificationLi.remove();
                          console.log('🧹 Cleaned up unwanted Policy Renewal Notification element (Permission: FALSE).');
                      }
                  }
                  
                  // Cleanup Renew Policy Now button/link
                  document.querySelectorAll('a').forEach(a => {
                      if (a.textContent.trim().toLowerCase() === 'renew policy now') {
                          a.remove();
                          console.log('🧹 Cleaned up unwanted Renew Policy Now button (Permission: FALSE).');
                      }
                  });
              }

              // Cleanup Profile
              if (profileVisible === false) {
                  // Find all My Profile links regardless of class
                  document.querySelectorAll('a').forEach(a => {
                      if (a.textContent.trim().toLowerCase() === 'my profile') {
                          const li = a.closest('li');
                          if (li) {
                              li.remove();
                              console.log('🧹 Cleaned up unwanted My Profile sidebar element (Permission: FALSE).');
                          }
                      }
                  });
              }
          });
      });
      observer.observe(document.body, { childList: true, subtree: true });
  
      const dragIcon = document.createElement('span');
      dragIcon.className = 'fi flex fi-ts-scrubber';
      Object.assign(dragIcon.style, {
        cursor: 'move', fontSize: '15px', color: '#bcbcbc', display: 'flex', alignItems: 'center', justifyContent: 'center'
      });

      // ⏱️ Auto Sync Timer Element
      const timerSpan = document.createElement('span');
      timerSpan.id = 'autoSyncTimer';
      timerSpan.className = 'flex'; // 🚀 Added Flex class
      Object.assign(timerSpan.style, {
          fontSize: '11px', fontWeight: 'bold', color: '#0065b3', 
          display: 'flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle',
          background: 'transparent', padding: '0px',
          marginLeft: '10px'
      });
      timerSpan.innerHTML = '<span id="timerVal" class="flex">--</span>';

      const pulseDot = document.createElement('div');
      pulseDot.id = 'mainPulseDot';
      Object.assign(pulseDot.style, {
          width: '7px', height: '7px', borderRadius: '50%', 
          background: '#4caf50',
          marginLeft: '8px', transition: 'all 0.3s ease'
      });
      pulseDot.title = 'Background Active';
  
      const topBtnGroup = document.createElement('div');
      topBtnGroup.style.display = 'flex';
      topBtnGroup.style.gap = '8px';
      topBtnGroup.style.alignItems = 'center';

      const minimizeBtn = document.createElement('button');
      minimizeBtn.id = 'toggleMinimizeBtn';
      minimizeBtn.innerHTML = '<i class="fi flex fi-rr-angle-small-down"></i>';
      Object.assign(minimizeBtn.style, {
        background: 'transparent', color: '#bcbcbc', border: 'none', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
      });
      minimizeBtn.onclick = () => toggleMinimize();

      topBtnGroup.appendChild(minimizeBtn);
  
      const leftPart = document.createElement('div');
      Object.assign(leftPart.style, {
          display: 'flex', alignItems: 'center', gap: '5px'
      });
      leftPart.appendChild(dragIcon);
      leftPart.appendChild(pulseDot); // 🚀 Heartbeat Dot (BEFORE Timer)
      leftPart.appendChild(timerSpan); // 🚀 Autopilot Timer

      topContainer.appendChild(leftPart);
      topContainer.appendChild(topBtnGroup);
  
      makeDraggable(popup, dragIcon);

      // 🕒 Persistent Cooldown Checker
      const checkCooldown = () => {
          const timerUi = document.getElementById('autoSyncTimer');
          const timerVal = document.getElementById('timerVal');
          if (!timerUi || !timerVal) return;

          const AUTO_RUN_KEY = 'last_auto_sync_time';
          const COOLDOWN_MS = 2 * 60 * 60 * 1000;
          const lastRun = localStorage.getItem(AUTO_RUN_KEY);
          const now = Date.now();

          if (lastRun && !isAutoSyncRunning) {
              const diff = now - parseInt(lastRun);
              if (diff < COOLDOWN_MS) {
                  const msLeft = COOLDOWN_MS - diff;
                  const h = Math.floor(msLeft / 3600000);
                  const m = Math.floor((msLeft % 3600000) / 60000);
                  const s = Math.floor((msLeft % 60000) / 1000);

                  const hStr = h > 0 ? `${h}h ` : '';
                  const mStr = String(m).padStart(2, '0') + 'm ';
                  const sStr = String(s).padStart(2, '0') + 's';

                  timerUi.style.display = 'flex';
                  timerUi.style.color = '#ef6c00'; // 🟠 More readable Orange
                  timerVal.innerText = `Autopilot: ${hStr}${mStr}${sStr}`; // 🚀 Smooth countdown
                  timerUi.title = `Auto-pilot on cooldown. Ready in ${hStr}${mStr}${sStr}`;
                  return;
              }
          }

          if (!isAutoSyncRunning) {
              timerUi.style.display = 'flex';
              timerUi.style.color = '#0065b3'; 
              timerVal.innerText = '--';
              timerUi.title = 'No active cooldown';
          }
      };
      
      setInterval(checkCooldown, 1000); // 🚀 1s Update for smooth ticking
      checkCooldown(); // Initial check

      return topContainer;
    };

    let isSuperCompactMode = true; // 🚀 EXTRA-COMPACT by default now!
    console.log("%c[UI] %cSuper-Compact Mode Initialized: %c" + isSuperCompactMode, "color:#4FC3F7; font-weight:bold;", "color:#EEEEEE;", "color:#FFB74D; font-weight:bold;");

    const createMinimizedBar = () => {
        let bar = document.getElementById('compactStatusBar');
        if (bar) {
            console.log("%c[UI] %cChecking/Repairing existing compactStatusBar...", "color:#4FC3F7; font-weight:bold;", "color:#BDBDBD; font-style:italic;");
            
            // 🚀 Ensure missing buttons are added if bar is reused
            const missingIds = ['miniResumeBtn', 'miniPauseBtn', 'miniNameText', 'miniNameHandle'];
            let needsRepair = false;
            missingIds.forEach(id => { if (!document.getElementById(id)) needsRepair = true; });

            if (needsRepair) {
                console.log("%c[UI] %cBar is outdated, repairing...", "color:#4FC3F7; font-weight:bold;", "color:#FFB74D;");
                bar.remove();
                bar = null;
            } else {
                return bar;
            }
        }

        console.log("%c[UI] %cCreating new compactStatusBar...", "color:#4FC3F7; font-weight:bold;", "color:#FFB74D; font-weight:bold;");
        bar = document.createElement('div');
        bar.id = 'compactStatusBar';
        Object.assign(bar.style, {
            position: 'fixed', top: '10px', right: '15px', 
            background: 'linear-gradient(135deg, #1e3a5f 0%, #0065b3 100%)', 
            border: 'none',
            borderRadius: '12px', 
            padding: '8px 18px',
            zIndex: '10000',
            boxShadow: '0 8px 32px rgba(0, 101, 179, 0.25)',
            display: 'none', alignItems: 'center', 
            gap: '10px',
            minWidth: 'auto',
            height: '44px', 
            cursor: 'pointer', overflow: 'hidden',
            backdropFilter: 'blur(8px)',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), background 0.4s, opacity 0.4s',
            transformOrigin: 'right center' // 🚀 Crucial for Right-to-Left expansion
        });

        // 📊 Bottom Mini Progress Bar
        const miniProgress = document.createElement('div');
        miniProgress.id = 'miniProgressLine';
        Object.assign(miniProgress.style, {
            position: 'absolute', bottom: '0', left: '0', 
            height: '3px', background: '#f1c40f', width: '0%', 
            transition: 'width 0.5s ease'
        });

        // 🚀 Super-Compact Toggle Button
        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'superCompactToggle';
        toggleBtn.innerHTML = '<i class="fi flex fi-tr-angle-small-right"></i>'; // 🚀 Point right to expand
        Object.assign(toggleBtn.style, {
            background: 'transparent', border: 'none', color: '#fff', 
            fontSize: '12px', cursor: 'pointer', padding: '0 1px 0 0', height: '20px',
            display: 'flex', alignItems: 'center', transition: 'all 0.3s'
        });
        toggleBtn.title = 'Super-Compact Mode';

        toggleBtn.onclick = (e) => {
            e.stopPropagation();
            isSuperCompactMode = !isSuperCompactMode;
            console.log("%c[UI] %cSuper-Compact Toggle Clicked: %c" + isSuperCompactMode, "color:#4FC3F7; font-weight:bold;", "color:#EEEEEE;", "color:#FFB74D; font-weight:bold;");
            updateMinimizedStatus(true); // 🚀 Force refresh on manual toggle
        };

        const nameHandle = document.createElement('div');
        nameHandle.id = 'miniNameHandle';
        Object.assign(nameHandle.style, {
            display: 'flex', // 🚀 Default Visible
            alignItems: 'center', gap: '6px', 
            cursor: 'move', minWidth: '80px'
        });
        
        const nameText = document.createElement('span');
        nameText.id = 'miniNameText';
        Object.assign(nameText.style, {
            color: '#fff', fontSize: '12px', fontWeight: 'bold', letterSpacing: '0.3px'
        });
        nameHandle.appendChild(nameText);

        const miniDot = document.getElementById('miniPulseDot') || document.createElement('div');
        miniDot.id = 'miniPulseDot';
        if (!miniDot.parentElement) {
            Object.assign(miniDot.style, {
                width: '6px', height: '6px', borderRadius: '50%', 
                background: '#4caf50', transition: 'all 0.3s ease'
            });
            nameHandle.appendChild(miniDot);
        }

        const statsArea = document.createElement('div');
        statsArea.id = 'miniStatsArea';
        Object.assign(statsArea.style, {
            display: 'none', // 🚀 Default Hidden
            alignItems: 'center', gap: '15px', 
            flexGrow: '1', cursor: 'default'
        });

        const autoPilotBtn = document.createElement('button');
        autoPilotBtn.id = 'miniAutoSyncBtn';
        autoPilotBtn.innerHTML = '⚡';
        Object.assign(autoPilotBtn.style, {
            display: 'flex', // 🚀 Default Visible
            background: 'transparent', border: 'none', color: '#ffeb3b', 
            fontSize: '16px', cursor: 'pointer', padding: '4px', borderRadius: '50%',
            width: '28px', height: '28px', alignItems: 'center', justifyContent: 'center',
            transition: 'transform 0.2s', filter: 'drop-shadow(0 0 5px rgba(255, 235, 59, 0.5))'
        });
        autoPilotBtn.title = 'Start Auto-Pilot (Extraction + Upload)';
        autoPilotBtn.onclick = (e) => {
            e.stopPropagation();
            autoPilotBtn.style.display = 'none'; // 🚀 Hide once clicked
            handleAutoSyncClick();
        };
        autoPilotBtn.onmouseover = () => autoPilotBtn.style.transform = 'scale(1.2) rotate(15deg)';
        autoPilotBtn.onmouseout = () => autoPilotBtn.style.transform = 'scale(1) rotate(0deg)';

        const expandBtn = document.createElement('button');
        expandBtn.id = 'miniExpandBtn';
        expandBtn.innerHTML = '<i class="fi flex fi-tr-browsers"></i>';
        Object.assign(expandBtn.style, {
            display: 'none', // 🚀 Hidden by default
            background: 'transparent', border: 'none', color: '#fff',
            fontSize: '14px', cursor: 'pointer', padding: '4px', borderRadius: '50%',
            width: '28px', height: '28px', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.2s'
        });
        expandBtn.title = 'Expand Dashboard';
        expandBtn.onmouseover = () => expandBtn.style.background = 'rgba(255,255,255,0.2)';
        expandBtn.onmouseout = () => expandBtn.style.background = 'transparent';
        
        expandBtn.onclick = (e) => {
            e.stopPropagation();
            toggleMinimize();
        };

        const resumeBtn = document.createElement('button');
        resumeBtn.id = 'miniResumeBtn';
        resumeBtn.innerHTML = '<i class="fi flex fi-rr-play"></i>'; // 🚀 RR is safer in Faveo
        Object.assign(resumeBtn.style, {
            display: 'none', // 🚀 Hidden by default
            background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff',
            fontSize: '14px', cursor: 'pointer', padding: '4px', borderRadius: '50%',
            width: '30px', height: '30px', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s', boxShadow: '0 0 10px rgba(0,0,0,0.2)'
        });
        resumeBtn.title = 'Resume Upload';
        resumeBtn.onclick = (e) => {
            e.stopPropagation();
            console.log("%c[UI] %cResume Button Clicked in Mini Bar", "color:#4FC3F7; font-weight:bold;", "color:#EEEEEE;");
            isUploadPaused = false; 
            updateMinimizedStatus(true);
            resumeBackgroundProcess(); // 🚀 Trigger existing resume logic
        };

        bar.append(toggleBtn, nameHandle, statsArea, autoPilotBtn, resumeBtn, expandBtn, miniProgress);
        document.body.appendChild(bar);

        // 🚀 Enable Dragging ONLY for the Name Handle
        makeDraggable(bar, nameHandle);

        return bar;
    };

    // 🚀 Helper to set style only if it changed (Prevents transition flickering)
    const setSafeStyle = (el, prop, val) => {
        if (el && el.style[prop] !== val) {
            el.style[prop] = val;
        }
    };

    const setMinimizedView = (shouldBeMinimized = true) => {
        chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
            if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused) {
                shouldBeMinimized = false; // Force expanded view in Master Autopilot Mode
            }

            const popup = document.getElementById('my-dashboard-popup');
            const compactBar = document.getElementById('compactStatusBar') || createMinimizedBar();
            
            console.log("%c[UI] %csetMinimizedView called: %c" + (shouldBeMinimized ? "MINIMIZE" : "EXPAND"), "color:#4FC3F7; font-weight:bold;", "color:#EEEEEE;", "color:#FFB74D; font-weight:bold;");
            
            if (shouldBeMinimized) {
                // MINIMIZE
                if (popup) popup.style.display = 'none';
                compactBar.style.display = 'flex';
                updateMinimizedStatus(true);
            } else {
                // EXPAND
                compactBar.style.display = 'none';
                if (popup) popup.style.display = 'flex';
            }
        });
    };

    const toggleMinimize = () => {
        const compactBar = document.getElementById('compactStatusBar');
        const isCurrentlyCompact = compactBar && compactBar.style.display === 'flex';
        setMinimizedView(!isCurrentlyCompact);
    };

    let lastIconType = null;
    const updateMinimizedStatus = (isInitial = false) => {
        const compactBar = document.getElementById('compactStatusBar');
        const nameHandle = document.getElementById('miniNameHandle');
        const statsArea = document.getElementById('miniStatsArea');
        const miniBtn = document.getElementById('miniAutoSyncBtn'); 
        const expandBtn = document.getElementById('miniExpandBtn');
        const closeBtn = document.getElementById('miniCloseBtn');
        const toggleBtn = document.getElementById('superCompactToggle');
        const resumeBtn = document.getElementById('miniResumeBtn');

        if (!nameHandle || !statsArea || !compactBar || compactBar.style.display === 'none') return;
        
        const fullAgentName = document.getElementById('agentName')?.textContent?.trim() || 'Agent';
        const agentName = fullAgentName.split(' ')[0]; 
        const progressRaw = document.getElementById('uploadProgressText')?.textContent || '';
        const liveTotal = document.getElementById('liveExtTotal')?.textContent || '0';
        
        let total = liveTotal;
        if (progressRaw.includes('Total Leads:')) {
           total = progressRaw.split('|')[0].replace('Total Leads:', '').trim();
        }

        const uploaded = progressRaw.includes('|') ? progressRaw.split('|')[1]?.replace('Uploaded: ', '').trim() : '0';
        const percent = progressRaw.includes('%') ? progressRaw.match(/\d+%/)[0] : '0%';
        const timerText = document.getElementById('estTimeText')?.textContent || '';
        const timerRaw = timerText.replace('Estimated Time: ', '').split('|')[0].trim();
        const timer = (timerRaw && timerRaw !== 'null') ? timerRaw : '--';

        // 🚀 Update progress line
        const miniProgress = document.getElementById('miniProgressLine');
        if (miniProgress) {
            miniProgress.style.width = percent;
            setSafeStyle(miniProgress, 'background', isUploadPaused ? '#ff5252' : '#f1c40f');
        }

        // 🚀 BG Gradient Sync
        const normalBg = 'linear-gradient(135deg, #1e3a5f 0%, #0065b3 100%)';
        const errorBg = 'linear-gradient(135deg, #d32f2f 0%, #b71c1c 100%)'; 
        const criticalBg = 'linear-gradient(135deg, #424242 0%, #212121 100%)'; // 🌑 Deep Dark for Disconnected
        
        let targetBg = isUploadPaused ? errorBg : normalBg;
        if (!isBackgroundActive) targetBg = criticalBg; 
        
        setSafeStyle(compactBar, 'background', targetBg);

        // 🚀 Centralized Visibility Logic
        if (isSuperCompactMode) {
            // ⬛ SUPER-COMPACT PILL (Stable width)
            setSafeStyle(compactBar, 'minWidth', isAutoSyncRunning ? '140px' : '180px');
            setSafeStyle(compactBar, 'padding', '8px 18px');
            setSafeStyle(compactBar, 'gap', '10px');
            
            const iconHtml = '<i class="fi flex fi-tr-angle-small-right"></i>';
            if (toggleBtn && lastIconType !== 'right') {
                toggleBtn.innerHTML = iconHtml;
                lastIconType = 'right';
            }

            if (isAutoSyncRunning || isUploadPaused) {
                // 🚀 Syncing or Paused
                setSafeStyle(nameHandle, 'display', 'none');
                setSafeStyle(miniBtn, 'display', 'none');
                setSafeStyle(statsArea, 'display', 'flex'); // 🚀 Always keep stats visible now
                setSafeStyle(resumeBtn, 'display', isUploadPaused ? 'flex' : 'none');
            } else {
                // 🚀 Idle
                setSafeStyle(nameHandle, 'display', 'flex');
                setSafeStyle(miniBtn, 'display', 'flex');
                setSafeStyle(statsArea, 'display', 'none');
                setSafeStyle(resumeBtn, 'display', 'none');
            }
            if (expandBtn) setSafeStyle(expandBtn, 'display', 'none');
            if (closeBtn) setSafeStyle(closeBtn, 'display', 'none');
        } else {
            // ⬜ COMPACT BAR (Expanded Arrow)
            setSafeStyle(compactBar, 'minWidth', '320px');
            setSafeStyle(compactBar, 'padding', '8px 16px');
            setSafeStyle(compactBar, 'gap', '15px');
            
            const iconHtml = '<i class="fi flex fi-tr-angle-small-left"></i>';
            if (toggleBtn && lastIconType !== 'left') {
                toggleBtn.innerHTML = iconHtml;
                lastIconType = 'left';
            }

            setSafeStyle(nameHandle, 'display', 'flex'); 
            setSafeStyle(statsArea, 'display', 'flex'); 
            setSafeStyle(resumeBtn, 'display', isUploadPaused ? 'flex' : 'none'); 
            
            if (isAutoSyncRunning || isUploadPaused) {
                setSafeStyle(miniBtn, 'display', 'none'); 
            } else {
                setSafeStyle(miniBtn, 'display', 'flex'); 
            }
            if (expandBtn) setSafeStyle(expandBtn, 'display', 'flex');
            if (closeBtn) setSafeStyle(closeBtn, 'display', 'flex');
        }

        // 🚀 Always ensure content is up-to-date (Without wiping the Pulse Dot)
        const nameText = document.getElementById('miniNameText');
        if (nameText && nameText.innerText !== agentName) {
            console.log("%c[UI] %cUpdating Agent Name: %c" + agentName, "color:#4FC3F7; font-weight:bold;", "color:#EEEEEE;", "color:#81C784; font-weight:bold;");
            nameText.innerText = agentName;
        }


        if (isAutoSyncRunning || (!isSuperCompactMode && percent !== '100%')) {
            const newStatsHtml = `
                <div style="display:flex; align-items:center; gap:6px; color:#fff; font-size:12px; font-weight:bold;">
                    <span>${total}</span>
                </div>
                <div style="height:14px; width:1px; background:rgba(255,255,255,0.3);"></div>
                <div style="display:flex; align-items:center; gap:6px; color:#fff; font-size:12px; font-weight:bold;">
                    <i class="fi flex fi-rr-clock-three" style="color:#bbdefb;"></i>
                    <span data-timer="sync">${timer}</span>
                </div>
                <div style="height:14px; width:1px; background:rgba(255,255,255,0.3);"></div>
                <div style="display:flex; align-items:center; gap:6px; color:#fff; font-size:12px; font-weight:bold;">
                    <i class="fi flex fi-rr-check-circle" style="color:#c8e6c9;"></i>
                    <span>${uploaded}</span>
                </div>
            `;
            if (statsArea.innerHTML !== newStatsHtml) {
                console.log("%c[UI] %cUpdating statsArea content (Sync/Timer Change)", "color:#4FC3F7; font-weight:bold;", "color:#BDBDBD; font-style:italic;");
                statsArea.innerHTML = newStatsHtml;
            }
        } else if (!isSuperCompactMode && percent === '100%') {
            const successHtml = `
                <div style="height:14px; width:1px; background:rgba(255,255,255,0.3);"></div>
                <div style="display:flex; align-items:center; gap:6px; color:#c8e6c9; font-size:12px; font-weight:bold;">
                    <i class="fi flex fi-rr-check-circle" style="font-size:14px; display:flex; align-items:center; justify-content:center;"></i>
                    <span>Success</span>
                </div>
            `;
            if (statsArea.innerHTML !== successHtml) {
                statsArea.innerHTML = successHtml;
            }
        }
    };


  
    // ====== BUTTON CONTAINER CREATION ======
    const createButtonContainer = (popup) => {
      const existing = document.getElementById('mainActBtn');
      if (existing) return existing;

      const container = document.createElement('div');
      container.id = 'mainActBtn';
      Object.assign(container.style, {
        marginTop: '10px', display: 'none', flexWrap: 'wrap', gap: '10px', flexDirection: 'row',
      });
  
      const buttonNames = ['Current Month', '1 Month', '2 Months', '3 Months', 'Custom Month', '⚡ Auto Sync'];
      buttonNames.forEach((name) => {
        const btn = document.createElement('button');
        btn.innerText = name;
        Object.assign(btn.style, {
          padding: '6px 12px', border: '1px solid #ccc', borderRadius: '5px',
          cursor: 'pointer', background: '#fff', fontSize: '12px',
          color: '#0065b3', fontWeight: 'bold', transition: 'all 0.1s ease'
        });
  
        btn.onmouseover = () => { btn.style.background = '#0065b3'; btn.style.color = '#fff'; };
        btn.onmouseout = () => { btn.style.background = '#fff'; btn.style.color = '#0065b3'; };
  
        if (name === 'Current Month') {
          btn.onclick = () => handleCurrentMonthClick(popup);
        } else if (name === '1 Month') {
          btn.onclick = () => handleCustomMonthClick(popup, 1);
        } else if (name === '2 Months') {
          btn.onclick = () => handleCustomMonthClick(popup, 2);
        } else if (name === '3 Months') {
          btn.onclick = () => handleCustomMonthClick(popup, 3);
        } else if (name === 'Custom Month') {
          btn.onclick = () => handleCustomMonthClick(popup);
        } else if (name === '⚡ Auto Sync') {
          btn.onclick = () => handleAutoSyncClick(popup);
        }
  
        container.appendChild(btn);
      });

      // ====== PREMIUM TOGGLE SWITCH FOR GOOGLE SHEET ======
      const switchContainer = document.createElement('div');
      Object.assign(switchContainer.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginTop: '12px',
        width: '100%',
        padding: '8px 0 0 0',
        borderTop: '1px dashed #ccc'
      });

      const switchLabelText = document.createElement('span');
      switchLabelText.innerText = 'Google Sheet Sync';
      Object.assign(switchLabelText.style, {
        fontSize: '12px',
        fontWeight: 'bold',
        color: '#0065b3'
      });

      const label = document.createElement('label');
      Object.assign(label.style, {
        position: 'relative',
        display: 'inline-block',
        width: '36px',
        height: '20px'
      });

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.id = 'googleSheetToggle';
      Object.assign(input.style, {
        opacity: '0',
        width: '0',
        height: '0'
      });

      const slider = document.createElement('span');
      Object.assign(slider.style, {
        position: 'absolute',
        cursor: 'pointer',
        top: '0', left: '0', right: '0', bottom: '0',
        backgroundColor: '#ccc',
        transition: '.3s',
        borderRadius: '20px'
      });

      const knob = document.createElement('span');
      Object.assign(knob.style, {
        position: 'absolute',
        content: '""',
        height: '14px', width: '14px',
        left: '3px', bottom: '3px',
        backgroundColor: 'white',
        transition: '.3s',
        borderRadius: '50%'
      });
      slider.appendChild(knob);

      label.appendChild(input);
      label.appendChild(slider);

      const updateToggleStyle = (checked) => {
        if (checked) {
          slider.style.backgroundColor = '#0065b3';
          knob.style.transform = 'translateX(16px)';
        } else {
          slider.style.backgroundColor = '#ccc';
          knob.style.transform = 'translateX(0px)';
        }
      };

      chrome.storage.local.get(['useGoogleSheet'], (res) => {
        input.checked = res.useGoogleSheet || false;
        updateToggleStyle(input.checked);
      });

      input.onchange = (e) => {
        const checked = e.target.checked;
        chrome.storage.local.set({ useGoogleSheet: checked }, () => {
          updateToggleStyle(checked);
          console.log('Google Sheet Sync toggled to:', checked);
        });
      };

      switchContainer.appendChild(switchLabelText);
      switchContainer.appendChild(label);
      container.appendChild(switchContainer);
  
      return container;
    };
  
    function createMessageDiv() {
        const messageDiv = document.createElement('div');
        messageDiv.id = 'messageDiv';
        messageDiv.style.borderTop = '1px solid #bcbcbc';
        messageDiv.style.borderBottom = '1px solid #bcbcbc';
        messageDiv.style.marginTop = '12px';
        messageDiv.style.width = '100%';
        messageDiv.style.height = '300px';
        messageDiv.style.overflow = 'hidden'; // both axes
        messageDiv.style.overflowY = 'auto'; // both axes
        messageDiv.style.scrollbarWidth = 'none'; // Firefox
        messageDiv.style.msOverflowStyle = 'none'; // IE/Edge
        // messageDiv.style.padding = '10px';
        messageDiv.borderRadius = '10px';
        messageDiv.style.fontWeight = 'bold';
        messageDiv.style.textAlign = 'center';
      
        // Hide scroll bar for Chrome/Safari
        if (!document.getElementById('hideScrollbarStyle')) {
          const style = document.createElement('style');
          style.id = 'hideScrollbarStyle';
          style.textContent = `
            #messageDiv::-webkit-scrollbar {
              display: none;
            }
          `;
          document.head.appendChild(style);
        }
      
        return messageDiv;
      }


    // ====== DATA UI CREATION ======
    
    function createDataUiContainer() {
      const container = document.createElement('div');
      container.id = 'dataUi';
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.alignItems = 'center';
      container.style.gap = '12px';
      container.style.paddingTop = '20px';

      container.style.width = '100%';
      container.style.height = '100%';
      container.style.fontFamily = 'Arial, sans-serif';
      return container;
  }
  
  function createBlockUi() {
    const block = document.createElement('div');
    block.id = 'blockUi';
    block.style.display = 'flex';
    block.style.flexDirection = 'row';
    block.style.alignItems = 'center';
    block.style.justifyContent = 'center';
    // block.marginBottom = '10px';
    block.style.width = '100%';
    block.style.height = '100px';
    block.style.fontFamily = 'Arial, sans-serif';
    // block.style.backgroundColor = '#f9f9f9';
    block.style.borderRadius = '10px';

  
    // Call the createHalfCirBarWithPercentage function, passing the parent element and the percentage

    return block;
  }
  

  function createHalfCirBarWithPercentage(percent) {
    const style = document.createElement('style');
    style.innerHTML = `
      .half-circular-progress {
        --size: 100;
        --stroke-width: 10;
        --radius: calc((var(--size) - var(--stroke-width)) / 2);
        --circumference: calc(3.1416 * var(--radius));
        width: 80px;
        height: 35px;
        position: relative;
      }

      .half-circular-progress circle {
        cx: 50;
        cy: 50;
        r: calc((var(--size) - var(--stroke-width)) / 2);
        fill: none;
        stroke-width: var(--stroke-width);
        stroke-linecap: round;
      }

      .half-circular-progress .bg {
        stroke:rgba(218, 239, 255, 0.14);
        stroke-dasharray: calc(3.1416 * ((var(--size) - var(--stroke-width)) / 2));
        stroke-dashoffset: 0;
        transform: rotate(-180deg);
        transform-origin: 50px 50px;
        stroke-linecap: round; /* ✅ Add this */
      }

      .half-circular-progress .fg {
        stroke: #FFFFFF;
        stroke-dasharray: calc(3.1416 * ((var(--size) - var(--stroke-width)) / 2));
        transform: rotate(-180deg);
        transform-origin: 50px 50px;
      }

      .percent-text {
        position: absolute;
        top: 18px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 14px;
        font-weight: bold;
        color: #FFFFFF;
      }

      .status-label {
        margin-top: 1px;
        font-size: 11px;
        font-weight: 600;
        margin-top: 6px;
        color: #FFFFFF;

      }
    `;
    document.head.appendChild(style);
    // Parent container
    const parentElement = createBlockUi();
    
    // Create main div container for halfCirBar
    const halfCirBar = document.createElement("div");
    halfCirBar.id = "halfCirBar";
    halfCirBar.style.display = "flex";
    halfCirBar.style.flexDirection = "column";
    halfCirBar.style.alignItems = "center"; 
    halfCirBar.style.justifyContent = "center";
    halfCirBar.style.width = "100px";
    halfCirBar.style.height = "80px";
    halfCirBar.style.backgroundColor = "#0065b3";
    halfCirBar.style.position = "relative";
    halfCirBar.style.borderRadius = "10px";
    
    // Create half-circular progress div
    const progressDiv = document.createElement("div");
    progressDiv.classList.add("half-circular-progress");
  
    // Create SVG for the half circle
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "80");
    svg.setAttribute("height", "35");
    svg.setAttribute("viewBox", "0 0 100 50");
  
    // Create background circle (static)
    const bgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    bgCircle.classList.add("bg");
  
    // Create foreground circle (dynamic progress)
    const fgCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    fgCircle.classList.add("fg");
    fgCircle.id = "progress-circle";
  
    // Append circles to SVG
    svg.appendChild(bgCircle);
    svg.appendChild(fgCircle);
  
    // Create percentage display
    const percentText = document.createElement("div");
    percentText.classList.add("percent-text");
    percentText.id = "percent-display";
    percentText.textContent = `${percent}%`;
  
    // Create status label
    const statusLabel = document.createElement("div");
    statusLabel.classList.add("status-label");
    statusLabel.textContent = "Issued Case"; // Default status
  
    // Append everything to the halfCirBar div
    progressDiv.appendChild(svg);
    progressDiv.appendChild(percentText);
    halfCirBar.appendChild(progressDiv);
    halfCirBar.appendChild(statusLabel);
    
    // Append the halfCirBar to the parent element
    parentElement.appendChild(halfCirBar);
  
    // Set up the progress functionality
    const radius = (100 - 10) / 2;
    const halfCircumference = Math.PI * radius;
  
    let currentPercent = 0;
    let animationInterval = null;
  
    fgCircle.style.strokeDasharray = halfCircumference;
    fgCircle.style.strokeDashoffset = halfCircumference;
  
    function setHalfProgressSmooth(targetPercent) {
      if (animationInterval) clearInterval(animationInterval);
  
      animationInterval = setInterval(() => {
        if (currentPercent === targetPercent) {
          clearInterval(animationInterval);
          return;
        }
  
        if (currentPercent < targetPercent) currentPercent++;
        else currentPercent--;
  
        const offset = halfCircumference * (1 - currentPercent / 100);
        fgCircle.style.strokeDashoffset = offset;
        percentText.textContent = `${currentPercent}%`;
  
        if (currentPercent === 0) {
          fgCircle.style.stroke = "transparent";
          fgCircle.style.opacity = "0";
        } else {
          fgCircle.style.stroke = "#FFFFFF";
          fgCircle.style.opacity = "1";
        }
      }, 10);
    }
  
    // Call the function to animate the progress
    setHalfProgressSmooth(percent);
    
    
 
  
    // Return the created halfCirBar element
    return halfCirBar;
  }
  

  function createPaymentBox(amount) {
    // Parent container
    const parentElement = createBlockUi();

    // Create the <style> element for CSS
    const style = document.createElement("style");
    style.textContent = `

      #ttlAmt p {
        font-size: 12px;
        color: #e67e22; font-weight:bold;
        margin-top: -5px;
      }

      #ttlAmt #ttlUpcPay {
        color: #0065b3;
        margin-top: -8px;
        font-size: 24px !important;
        font-weight: 800;

      }
    `;
    // Append the style to the document's head
    document.head.appendChild(style);

    // Create the main div for ttlAmt
    const ttlAmt = document.createElement("div");
    ttlAmt.id = "ttlAmt";
    ttlAmt.style.display = "flex";
    ttlAmt.style.flexDirection = "column";
    ttlAmt.style.alignItems = "center";
    ttlAmt.style.justifyContent = "center";
    ttlAmt.style.width = "200px";
    ttlAmt.style.height = "80px";
    ttlAmt.style.boxSizing = "border-box";
    ttlAmt.style.padding = "20px";
    ttlAmt.style.fontSize = "24px";
    ttlAmt.style.border = "none";

    // Create the p element (Upcoming Payment text)
    const p = document.createElement("p");
    p.textContent = "Upcoming payment";

    // Create the h1 element (for the amount)
    const h1 = document.createElement("h1");
    h1.id = "ttlUpcPay";
    h1.textContent = amount;

    // Append p and h1 to ttlAmt div
    ttlAmt.appendChild(p);
    ttlAmt.appendChild(h1);

    // Append ttlAmt div to parentElement
    parentElement.appendChild(ttlAmt);

    // Return the created ttlAmt element
    return ttlAmt;
  }

  function createPaymentComponentFromObject(dataObj) {
    // 1. Inject style
    const style = document.createElement('style');
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;700&display=swap');
      @import url('https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css');
  
      #container-c {
        background-color: #0065b3;
        width: 320px;
        padding: 3px;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        align-items: center;
        font-family: 'Roboto', sans-serif;
        box-sizing: border-box;
      }
  
      .con-hd {
        width: 95%;
        height: 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 600;
        color: #ffffff;
        font-size: 16px;
      }
  
      .con-hd p {
        color: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0px;

      }
  
      .div-tabel {
        width: 100%;
        background-color: #ffffff;
        border-radius: 10px;
        display: flex;
        flex-direction: column;
        font-size: 11px;
        font-style: italic;
        font-weight: 400;
        overflow: hidden;
        transition: height 0.1s ease, padding 0.3s ease;
        height: 0;
      }
  
      .div-tabel.collapsed {
        height: auto !important;
        padding: 10px 0px;
      }
  
      
      .div-hd, .div-bdy {
        width: 95%;
        display: flex;
        flex-direction: column;
        margin: auto;
      }
  
      .div-hd {
        flex-direction: row;
        justify-content: space-between;
        background-color: #0065b3;
        color: #ffffff;
        padding: 5px;
        border-radius: 10px;
      }
  
      .div-dt1 {
        width: 60%;
        padding: 2px 0 2px 10px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        text-align: left;
      }
  
      .div-dt2, .div-dt3 {
        width: 25%;
        text-align: center;
        padding: 2px 0;
      }
  
      .div-rw {
        width: 100%;
        display: flex;
        justify-content: space-between;
        padding: 12px 0;
        border-bottom: 1px solid #bebebe46;
      }
  
      #toggleIcon {
        transition: transform 0.3s ease;
        cursor: pointer;
        font-size: 20px;
        transform: rotate(0deg);
        display:flex;
        justify-content: center;
        align-item: center;

      }
  
      #toggleIcon.rotated {
        transform: rotate(90deg);
      }
    `;
    document.head.appendChild(style);
  
    // 2. Create elements
    const container = document.createElement('div');
    container.id = 'container-c';
  
    const conHd = document.createElement('div');
    conHd.className = 'con-hd';
  
    const p = document.createElement('p');
    p.textContent = 'Payment Summary';
  
    const toggleIcon = document.createElement('i');
    toggleIcon.className = 'fi fi-rr-angle-small-right';
    toggleIcon.id = 'toggleIcon';
  
    conHd.appendChild(p);
    conHd.appendChild(toggleIcon);
  
    const tableBox = document.createElement('div');
    tableBox.className = 'div-tabel';
  
    // 3. Header
    const header = document.createElement('div');
    header.className = 'div-hd';
  
    const head1 = document.createElement('div');
    head1.className = 'div-dt1';
    head1.textContent = 'Status';
  
    const head2 = document.createElement('div');
    head2.className = 'div-dt2';
    head2.textContent = 'Nop';
  
    const head3 = document.createElement('div');
    head3.className = 'div-dt3';
    head3.textContent = 'Payment';
  
    header.appendChild(head1);
    header.appendChild(head2);
    header.appendChild(head3);
  
    // 4. Body
    const body = document.createElement('div');
    body.className = 'div-bdy';
  
    Object.keys(dataObj).forEach(statusKey => {
      const item = dataObj[statusKey];
      if (!item || typeof item !== 'object') return;
  
      const row = document.createElement('div');
      row.className = 'div-rw';
  
      const div1 = document.createElement('div');
      div1.className = 'div-dt1';
      div1.textContent = statusKey;
  
      const div2 = document.createElement('div');
      div2.className = 'div-dt2';
      div2.textContent = item.count || 0;
  
      const div3 = document.createElement('div');
      div3.className = 'div-dt3';
      div3.textContent = 'Rs ' + (item.sum || 0).toLocaleString();
  
      row.appendChild(div1);
      row.appendChild(div2);
      row.appendChild(div3);
      body.appendChild(row);
  
      row.addEventListener('click', () => {
        showDesireData(item.entries || []);
        const tabelBtn = document.getElementById('showdata');
        if (tabelBtn) tabelBtn.innerHTML = 'Hide Data';
      });
    });
  
    // 5. Assemble
    tableBox.appendChild(header);
    tableBox.appendChild(body);
    container.appendChild(conHd);
    container.appendChild(tableBox);
  
    // 6. Toggle logic
    toggleIcon.addEventListener('click', () => {
      tableBox.classList.toggle('collapsed');
      toggleIcon.classList.toggle('rotated');

    });
  
    return container;
  }
  

  
  function createDataUi(monthlySum, upcomingSum, pendingSum, cancelationSum, businesstype, proposalStatusStats) {
    const popup = document.getElementById('my-dashboard-popup');
    if (!popup) return console.log('Popup element not found.');
  
    const dataUi = createDataUiContainer();
    const blockUi = createBlockUi();
    const messageDiv = createMessageDiv();
    const statusTabel = createPaymentComponentFromObject(proposalStatusStats);
   


     // 🔢 Count all entries
  const totalUpcomingEntries = Object.values(upcomingSum).reduce((sum, item) => sum + (item.entries?.length || 0), 0);
  const totalIssuedEntries = Object.values(monthlySum).reduce((sum, item) => sum + (item.entries?.length || 0), 0);

  // 📊 Calculate percentage
  let pendingPercentage = totalUpcomingEntries > 0 
    ? Math.round((totalIssuedEntries / totalUpcomingEntries) * 100) 
    : 0;

    const halfCirBar = createHalfCirBarWithPercentage(pendingPercentage);
  
    // 🔽 Calculate the total of all "upcomingSum[month].total" values
    let grandUpcomingTotal = Object.values(upcomingSum).reduce((sum, obj) => sum + (obj?.total || 0), 0);
    const formattedTotal = "₹" + grandUpcomingTotal.toLocaleString("en-IN");
  
    const ttlAmt = createPaymentBox(formattedTotal); // ✅ Use actual calculated total
  
    popup.appendChild(messageDiv);
    messageDiv.appendChild(dataUi);
    dataUi.appendChild(blockUi);
    blockUi.appendChild(ttlAmt);
    blockUi.appendChild(halfCirBar);
    dataUi.appendChild(statusTabel);


  
// Show all monthly entries
halfCirBar.onclick = () => {
  let allEntries = [];
  Object.values(monthlySum).forEach(item => {
    if (item.entries && Array.isArray(item.entries)) {
      allEntries = allEntries.concat(item.entries);
    }
  });
  showDesireData(allEntries);
  const tabelBtn = document.getElementById('showdata');
  tabelBtn.innerHTML = 'Hide Data';
};

// Show all upcoming entries
ttlAmt.onclick = () => {
  let allEntries = [];
  Object.values(upcomingSum).forEach(item => {
    if (item.entries && Array.isArray(item.entries)) {
      allEntries = allEntries.concat(item.entries);
    }
  });
  showDesireData(allEntries);
  const tabelBtn = document.getElementById('showdata');
  tabelBtn.innerHTML = 'Hide Data';
};

  
  
    console.log("Issued Sum:", monthlySum);
    console.log("Upcoming Sum:", upcomingSum);
    console.log("Pending Sum:", pendingSum);
    console.log("Cancelation Sum:", cancelationSum);
    console.log("Business Type Summary:", businesstype);
    console.log("Proposal Status", proposalStatusStats);
  }


  const showDesireData = (data) => {
    const messageDiv = document.getElementById('messageDiv');
    if (!messageDiv) {
      console.warn('messageDiv not found!');
      return;
    }
  
    messageDiv.innerHTML = ''; // Clear existing content
  
    // Create and append style if not already present
    if (!document.getElementById('customTableStyle')) {
      const style = document.createElement('style');
      style.id = 'customTableStyle';
      style.textContent = `
        @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');
        .custom-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px !important;  
          font-family: 'Roboto', sans-serif;
          position: relative;
        }
        .custom-table th, .custom-table td {
          padding: 8px 10px;
          text-align: center;
          font-style: italic;
          white-space: nowrap;
          border-bottom: 1px solid #bcbcbc;
          color: rgb(114, 114, 114);
        }
        .custom-table th {
          background: #0065b3;
          color: #fff;
          font-weight: bold;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        #dataTable {
          max-height: 300px;
          overflow: auto;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
        }
        #dataTable::-webkit-scrollbar {
          display: none; /* Chrome, Safari */
        }
      `;
      document.head.appendChild(style);
    }
  
    // Create inner container
    const container = document.createElement('div');
    container.id = 'dataTable';
    container.style.overflow = 'auto';
    container.style.maxHeight = '300px';
    messageDiv.appendChild(container);
    messageDiv.style.display = 'block';
  
    if (!Array.isArray(data) || data.length === 0) {
      container.textContent = 'No data available.';
      return;
    }
  
    // Determine valid keys (exclude undefined keys and keys with only undefined/null values)
    const validKeys = Object.keys(data[0]).filter(
      key => key !== 'undefined' && data.some(row => row[key] !== undefined && row[key] !== null)
    );
  
    // Build the table
    const table = document.createElement('table');
    table.className = 'custom-table';
  
    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
  
    // Add Sno. column
    const snoTh = document.createElement('th');
    snoTh.textContent = 'Sno.';
    headerRow.appendChild(snoTh);
  
    // Add dynamic headers
    validKeys.forEach(key => {
      const th = document.createElement('th');
      th.textContent = key.replace(/_/g, ' ');
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);
  
    // Body
    const tbody = document.createElement('tbody');
    data.forEach((row, index) => {
      const tr = document.createElement('tr');
  
      // Add Sno.
      const snoTd = document.createElement('td');
      snoTd.textContent = index + 1;
      tr.appendChild(snoTd);
  
      // Add valid data cells
      validKeys.forEach(key => {
        const td = document.createElement('td');
        td.textContent = row[key] ?? '';
        tr.appendChild(td);
      });
  
      tbody.appendChild(tr);
    });
  
    table.appendChild(tbody);
    container.appendChild(table);
  };
  
  



  // Function to process and accumulate data
  function processData(accumulatedData) {
    let proposalStatusStats = {};  // For storing counts, sums, and entries
    let monthlySum = {};
    let upcomingSum = {};
    let pendingSum = {};
    let cancelationSum = {};
    let businesstype = {
      NEWBUSINESS: { monthly: {}, pending: {}, upcoming: {} },
      PORTABILITY: { monthly: {}, pending: {}, upcoming: {} },
      RENEWAL: { monthly: {}, pending: {}, upcoming: {} }
    };
  
    accumulatedData.forEach(entry => {
      const column4Value = parseFloat(entry.GWP.replace(/,/g, '')) || 0;
      const column6Value = entry.PROPOSAL_STATUS;
      const businessType = entry.BUSINESS_TYPE;
      const date = new Date(entry.POLICY_START_DATE);
      const monthYear = date.toLocaleString('default', { month: 'short', year: 'numeric' }).toUpperCase();
  
      // Helper to update structure with total and entries
      const updateSum = (sumObj) => {
        sumObj[monthYear] = sumObj[monthYear] || { total: 0, entries: [] };
        sumObj[monthYear].total += column4Value;
        sumObj[monthYear].entries.push(entry);
      };


             // Initialize if not already
       if (!proposalStatusStats[column6Value]) {
         proposalStatusStats[column6Value] = {
           count: 0,
           sum: 0,
           entries: []
         };
       }
       
       // Update
       proposalStatusStats[column6Value].count += 1;
       proposalStatusStats[column6Value].sum += column4Value;
       proposalStatusStats[column6Value].entries.push(entry);
       
  
  
      // For Issuance
      if (column6Value === 'Inforce' || column6Value === 'Primary:InforceSecondary:BOT Failed') {
        updateSum(monthlySum);
        updateSum(upcomingSum);
      }
  
      // For Pending
      const pendingStatuses = [
        'Primary:Branch CPU Resolution',
        'Primary:Pending Underwriting Review',
        'Primary:Pending Tele Q',
        'Primary:Pending Underwriting',
        'Primary:Payment not cleared',
        'Primary:Pending UW requirement'
      ];
      if (pendingStatuses.includes(column6Value)) {
        updateSum(pendingSum);
        updateSum(upcomingSum);
      }
  
      // For Cancelation
      const cancelStatuses = [
        'Primary:Declined',
        'Primary:DeclinedSecondary:AUTHORISED',
        'Primary:CancelledSecondary:AUTHORISED',
        'Primary:Cancelled'
      ];
      if (cancelStatuses.includes(column6Value)) {
        updateSum(cancelationSum);
      }
  
      // For Business Type Summary
      if (businesstype[businessType]) {
        if (column6Value === 'Inforce' || column6Value === 'Primary:InforceSecondary:BOT Failed') {
          updateSum(businesstype[businessType].monthly);
          updateSum(businesstype[businessType].upcoming);
        }
        if (pendingStatuses.includes(column6Value)) {
          updateSum(businesstype[businessType].pending);
        }
      }
    });
  

    createDataUi(monthlySum,
      upcomingSum,
      pendingSum,
      cancelationSum,
      businesstype,
      proposalStatusStats); // Create the UI after processing data

  

  }
  


  
    // ====== SECONDARY BUTTON CONTAINER CREATION ======
    const createSecondaryButtonContainer = () => {
        const container = document.createElement('div');
        container.id = 'secActBtn';
        Object.assign(container.style, {
          marginTop: '10px',
          display: 'flex',  // Initially hidden
          flexDirection: 'column',
          gap: '10px',
          width: '100%',
        });
      
        const buttonGroups = [
          ['Add More', 'Send to Api'],
          ['Main Menu', 'Show Data']
        ];
      
        buttonGroups.forEach(group => {
          const span = document.createElement('span');
          Object.assign(span.style, {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            marginTop: '10px',  
          });
      
          group.forEach(name => {
            const btn = document.createElement('button');
            btn.innerText = name;
            btn.id = name.replace(/\s+/g, '').toLowerCase(); // Set ID based on button name
            Object.assign(btn.style, {
              width: '48%',
              height: '30px',
              border: '1px solid #fff',
              borderRadius: '5px',
              cursor: 'pointer',
              background: '#0065b3',
              fontSize: '12px',
              color: '#fff',
              fontWeight: 'bold',
              transition: 'all 0.1s ease'
            });
      
            btn.addEventListener('mouseover', () => {
              btn.style.background = '#fff';
              btn.style.color = '#0065b3';
              btn.style.border = '1px solid #0065b3';
            });
            btn.addEventListener('mouseout', () => {
              btn.style.background = '#0065b3';
              btn.style.color = '#fff';
              btn.style.border = '1px solid #fff';
            });
      
            // Button click actions can be defined here
            btn.addEventListener('click', () => {
              console.log(`${name} button clicked`);
            });
      
            btn.addEventListener('click', () => {

              if (btn.innerText === 'Show Data') {
                restoreExtractionSummaryUI(); // 🚀 Force summary view
                renderExtractedTable(); // Show the table
                btn.innerText = 'Hide Data';
                
              } else if (btn.innerText === 'Hide Data') {
                const popup = document.getElementById('my-dashboard-popup');
               
                const oldMessageDiv = document.getElementById('messageDiv');
                if (oldMessageDiv) oldMessageDiv.remove();
            
                // 🧹 Remove existing buttonContainer if present
                const oldButtonContainer = document.getElementById('secActBtn');
                if (oldButtonContainer) oldButtonContainer.remove();
                processData(accumulatedData);   // Create new UI
                const secActBtn = createSecondaryButtonContainer(); // Recreate the button container
                popup.appendChild(secActBtn); // Append the new button container
                secActBtn.style.display = 'block';
                // Hide the table
                btn.innerText = 'Show Data';
              } else {
                console.log(`${name} button clicked`);
              }
            });
            
            btn.addEventListener('click', () => {
              if (name === 'Send to Api') {
                sendDataToAppScript(); // ✅ Trigger only when "Send to Api" button is clicked
              } else {
                console.log(`${name} button clicked`);
              }
            });

            btn.addEventListener('click', () => {
              if (name === 'Main Menu') {
                restoreExtractionSummaryUI(); // 🚀 Restore summary before navigating
                const popup = document.getElementById('my-dashboard-popup');
            
                // 🧹 Remove existing messageDiv if present
                const oldMessageDiv = document.getElementById('messageDiv');
                if (oldMessageDiv) oldMessageDiv.remove();
            
                // 🧹 Remove existing buttonContainer if present
                const oldButtonContainer = document.getElementById('secActBtn');
                if (oldButtonContainer) oldButtonContainer.remove();
            
                // 👉 Also trigger click on sidebar's "Dashboard" <a> element
                const dashboardLink = document.querySelector('.side_dash_navigation .dropdown11');
                if (dashboardLink) dashboardLink.click();
                document.getElementById('sidebarwrapper')?.classList.remove('toggled');
                document.getElementById('sideBackdrop')?.classList.remove('backdrop1');
                
            
                // 🚀 Create and show new button container
                const actionUI = createButtonContainer();
                popup.appendChild(actionUI);
                actionUI.style.display = 'flex';
            
              } else {
                console.log(`${name} button clicked`);
              }
            });
            

              btn.addEventListener('click', () => {
                if (name === 'Add More') {
                  handleAddMoreClick(tableData);
                } else {
                  console.log(`${name} button clicked`);
                }
              });
              

            span.appendChild(btn);
          });
      
          container.appendChild(span);
        });
      
        return container;
      };



    // ====== ADD MORE BUTTON FUNCTION ======
    function handleAddMoreClick() {
      restoreExtractionSummaryUI(); // 🚀 Restore summary
      const popup = document.getElementById('my-dashboard-popup');
    
      // 🧹 Remove existing messageDiv if present
      const oldMessageDiv = document.getElementById('messageDiv');
      if (oldMessageDiv) oldMessageDiv.remove();
    
      // 🧹 Remove existing buttonContainer if present
      const oldButtonContainer = document.getElementById('secActBtn');
      if (oldButtonContainer) oldButtonContainer.remove();
    
     
    
      const actionUI = createCustomMonthActionUI();
      popup.appendChild(actionUI);
      actionUI.style.display = 'flex';
    }
    


    // ====== UPLOAD PROGRESS DIV CREATION ======
      function createUploadProgressDiv() {
        // Inject blinking dot CSS only once
        if (!document.getElementById('blinking-dot-style')) {
          const style = document.createElement('style');
          style.id = 'blinking-dot-style';
          style.innerHTML = `
            .dot {
              width: 6px;
              height: 6px;
              background-color: #e67e22; font-weight:bold;
              border-radius: 50%;
              animation: blink 1s infinite;
            }
            .dot:nth-child(2) { animation-delay: 0.2s; }
            .dot:nth-child(3) { animation-delay: 0.4s; }
      
            @keyframes blink {
              0%, 80%, 100% { opacity: 0; }
              40% { opacity: 1; }
            }
          `;
          document.head.appendChild(style);
        }
      
        const container = document.createElement('div');
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        container.style.padding = '16px';
        container.style.borderRadius = '12px';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.fontFamily = 'Arial, sans-serif';
        
        // Top span with icons and blinking dots
        const iconRow = document.createElement('span');
        iconRow.style.display = 'flex';
        iconRow.style.alignItems = 'center';
        iconRow.style.gap = '12px';
        iconRow.style.fontSize = '24px';
      
        const icon1 = document.createElement('i');
        icon1.className = 'fi fi-rr-document';
      
        const icon2 = document.createElement('i');
        icon2.className = 'fi fi-rr-folder-open';
      
        const dots = document.createElement('span');
        dots.style.display = 'flex';
        dots.style.gap = '4px';
        dots.id = 'blinkingDotsSpan';
        dots.innerHTML = '<span class="dot"></span><span class="dot"></span><span class="dot"></span>';
      
        iconRow.appendChild(icon1);
        iconRow.appendChild(dots);
        iconRow.appendChild(icon2);
      
        // Bottom span with progress label, bar and ESTIMATED TIME
        const progressSpan = document.createElement('span');
        progressSpan.style.width = '100%';
        progressSpan.style.marginTop = '12px';
        progressSpan.style.display = 'flex';
        progressSpan.style.flexDirection = 'column';
        progressSpan.style.alignItems = 'center';
      
        const progressText = document.createElement('div');
        progressText.id = 'uploadProgressText';
        progressText.style.fontSize = '12px';
        progressText.style.fontWeight = 'bold';
        progressText.style.marginBottom = '6px';
        progressText.innerText = `Total Leads: ${accumulatedData ? accumulatedData.length : 0} | Uploaded: 0 | 0%`;

        const estTimeText = document.createElement('div');
        estTimeText.id = 'estTimeText';
        estTimeText.style.fontSize = '11px';
        estTimeText.style.color = '#1565c0'; // Blue
        estTimeText.style.marginBottom = '6px';
        estTimeText.style.fontWeight = 'bold';
        estTimeText.innerText = `Estimated Time: Calculating...`;
        
        const progressBar = document.createElement('div');
        progressBar.style.height = '8px';
        progressBar.style.width = '80%';
        progressBar.style.background = '#eee';
        progressBar.style.borderRadius = '4px';
        progressBar.innerHTML = `
        <div id="progressInner" style="
          width: 0%;
          height: 100%;
          background: linear-gradient(to right, #f1c40f, #8bc34a);
          border-radius: 4px;
          transition: width 0.4s ease;"></div>
      `;
      
        const currentLeadInfo = document.createElement('div');
        currentLeadInfo.id = 'currentLeadInfo';
        currentLeadInfo.style.fontSize = '12px';
        currentLeadInfo.style.color = '#333';
        currentLeadInfo.style.marginTop = '10px';
        currentLeadInfo.style.fontWeight = '500';
        currentLeadInfo.style.textAlign = 'center';
        currentLeadInfo.style.minHeight = '18px';
        currentLeadInfo.innerText = '-';

        progressSpan.appendChild(progressText);
        progressSpan.appendChild(estTimeText);
        progressSpan.appendChild(progressBar);
        progressSpan.appendChild(currentLeadInfo);

        // Upload Control Buttons container
        const controlBtns = document.createElement('div');
        controlBtns.style.display = 'flex';
        controlBtns.style.gap = '10px';
        controlBtns.style.marginTop = '15px';
        
        const pauseBtn = document.createElement('button');
        pauseBtn.id = 'pauseUploadBtn';
        pauseBtn.innerText = '⏸ Pause';
        Object.assign(pauseBtn.style, { padding: '5px 10px', borderRadius: '5px', border: '1px solid #ff9800', background: '#fff3e0', color: '#e65100', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' });
        
        const resumeBtn = document.createElement('button');
        resumeBtn.id = 'resumeUploadBtn';
        resumeBtn.innerText = '▶ Resume';
        Object.assign(resumeBtn.style, { display: 'none', padding: '5px 10px', borderRadius: '5px', border: '1px solid #f1c40f', background: '#e8f5e9', color: '#2e7d32', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' });
        
        const restartBtn = document.createElement('button');
        restartBtn.id = 'restartUploadBtn';
        restartBtn.innerText = '🔄 Restart';
        Object.assign(restartBtn.style, { display: 'none', padding: '5px 10px', borderRadius: '5px', border: '1px solid #2196f3', background: '#e3f2fd', color: '#0d47a1', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' });
        
        controlBtns.append(pauseBtn, resumeBtn, restartBtn);

        // Summary Div
        const summaryDiv = document.createElement('div');
        summaryDiv.id = 'uploadSummaryDiv';
        Object.assign(summaryDiv.style, {
          display: 'none',
          fontSize: '12px',
          marginTop: '10px',
          padding: '8px',
          background: '#f5f5f5',
          borderRadius: '5px',
          textAlign: 'center',
          fontWeight: 'bold',
          width: '90%'
        });

        pauseBtn.addEventListener('click', () => {
          if (!chrome.runtime?.id) return alert('Session Expired. Please refresh the page.');
          chrome.runtime.sendMessage({ type: 'PAUSE_UPLOAD' });
          pauseBtn.style.display = 'none';
          resumeBtn.style.display = 'block';
          restartBtn.style.display = 'block';
          summaryDiv.style.display = 'block';
          summaryDiv.style.color = '#e65100';
          summaryDiv.style.background = '#fff3e0';
          
          const textEl = document.getElementById('uploadProgressText');
          const currentText = textEl ? textEl.innerText.replace(' | ', '\n') : '';
          summaryDiv.innerText = `Paused.\n${currentText}`;
          dots.style.display = 'none'; // hide blinking dots
          if (countdownInterval) clearInterval(countdownInterval);
        });
        
        resumeBtn.addEventListener('click', () => {
          if (!chrome.runtime?.id) return alert('Session Expired. Please refresh the page.');
          chrome.runtime.sendMessage({ type: 'RESUME_UPLOAD' });
          pauseBtn.style.display = 'block';
          resumeBtn.style.display = 'none';
          restartBtn.style.display = 'none';
          summaryDiv.style.display = 'none';
          dots.style.display = 'flex';
        });
        
        restartBtn.addEventListener('click', () => {
          if (!chrome.runtime?.id) return alert('Session Expired. Please refresh the page.');
          chrome.runtime.sendMessage({ type: 'RESTART_UPLOAD' });
          pauseBtn.style.display = 'block';
          resumeBtn.style.display = 'none';
          restartBtn.style.display = 'none';
          summaryDiv.style.display = 'none';
          dots.style.display = 'flex';
          updateProgress(0, 0, accumulatedData.length); // reset UI immediately
        });
      
        container.appendChild(iconRow);
        container.appendChild(progressSpan);
        container.appendChild(summaryDiv);
        container.appendChild(controlBtns);
      
        return container;
      }
      


    // ====== UI Component Function ======
    
const createCustomMonthActionUI = (monthsBack) => {
    const container = document.createElement('div');
    container.id = 'customMonthActions';
    Object.assign(container.style, {
      display: 'flex',
      width: '100%',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '10px',
      marginTop: '10px',
      borderTop: '1px solid #bcbcbc',
    });
  
    // 📅 UI for selecting dates in the Popup
    const inputArea = document.createElement('div');
    inputArea.style.margin = '15px 0 0 0';
    inputArea.style.display = 'flex';
    inputArea.style.flexDirection = 'column';
    inputArea.style.gap = '8px';
    inputArea.style.width = '80%';
    inputArea.id = 'popupDateInputBox';
    
    // Using type="date" to get the browser's custom visual calendar, but with styling
    inputArea.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <label style="font-size:12px; font-weight:bold; color:#e67e22; font-weight:bold;">Start Date:</label>
        <input type="date" id="popStart" style="width:115px; padding:3px 5px; border:1px solid #0065b3; border-radius:4px; font-size:11px; background:#f8fbff; cursor:pointer;">
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <label style="font-size:12px; font-weight:bold; color:#e67e22; font-weight:bold;">End Date:</label>
        <input type="date" id="popEnd" style="width:115px; padding:3px 5px; border:1px solid #0065b3; border-radius:4px; font-size:11px; background:#f8fbff; cursor:pointer;">
      </div>
    `;
    container.appendChild(inputArea);

    const instruction = document.createElement('p');
    instruction.id = 'dateInstruction';
    instruction.innerText = 'Please Select date';
    instruction.style.margin = '12px 0 2px 0';
    instruction.style.fontSize = '14px';
    instruction.style.fontWeight = 'bold';
    container.appendChild(instruction);
    
    // Conversion helpers: Website expects DD/MM/YYYY, Browser uses YYYY-MM-DD
    const webToNative = (val) => {
        if (!val || val.length < 10) return '';
        const parts = val.split('/');
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    };
    const nativeToWeb = (val) => {
        if (!val || val.length < 10) return '';
        const parts = val.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    };

    const getFormattedWebDate = (date) => {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    let firstOfMonth;
    if (monthsBack !== undefined) {
        const todayTemp = new Date();
        firstOfMonth = new Date(todayTemp.getFullYear(), todayTemp.getMonth() - monthsBack, 1);
    } else {
        firstOfMonth = new Date();
        firstOfMonth.setDate(1);
    }
    const today = new Date();

    const getNativeDate = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const nativeStart = getNativeDate(firstOfMonth);
    const nativeToday = getNativeDate(today);

    // Auto-update DOM helper
    const syncToDom = (targetId, val) => {
        const domInput = document.getElementById(targetId) || document.getElementById(targetId + '1');
        // 'val' here is web format DD/MM/YYYY
        if (domInput && val && val.length >= 10) {
            domInput.value = val;
            domInput.dispatchEvent(new Event('input', { bubbles: true }));
            domInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    };

    // Auto-select initial dates and setup listeners
    setTimeout(() => {
        const popStart = document.getElementById('popStart');
        const popEnd = document.getElementById('popEnd');
        const fromInput = document.getElementById('from_date') || document.getElementById('from_date1');
        const toInput = document.getElementById('to_date') || document.getElementById('to_date1');

        // Set initial defaults in popup UI (must be YYYY-MM-DD)
        if (popStart) popStart.value = nativeStart;
        if (popEnd) popEnd.value = nativeToday;

        // Sync defaults to the actual website DOM immediately (must be DD/MM/YYYY)
        syncToDom('from_date', nativeToWeb(nativeStart));
        syncToDom('to_date', nativeToWeb(nativeToday));

        // Click search to reload table with new dates!
        setTimeout(() => {
            const proposalBtn = document.querySelector('.button.view_proposals_btn');
            if (proposalBtn) {
                console.log('🤖 Autopilot/CustomMonth: Clicking View Proposals to apply dates...');
                proposalBtn.click();
            }
        }, 300);

        if (popStart) popStart.addEventListener('change', (e) => syncToDom('from_date', nativeToWeb(e.target.value)));
        if (popEnd) popEnd.addEventListener('change', (e) => syncToDom('to_date', nativeToWeb(e.target.value)));

        // Enhancement: Still try to physically click 1st day to wake up website's internal state
        if (fromInput) {
            fromInput.click(); 
            let attempts = 0;
            const findAndClickDate = setInterval(() => {
                attempts++;
                const firstDayLink = document.querySelector('.ui-datepicker-calendar tbody a[data-date="1"]');
                if (firstDayLink || attempts > 15) {
                    clearInterval(findAndClickDate);
                    if (firstDayLink) firstDayLink.click();
                    
                    // After clicking, read the automatic value back into the popup!
                    setTimeout(() => {
                        if (fromInput && popStart) popStart.value = webToNative(fromInput.value);
                        if (toInput && popEnd) popEnd.value = webToNative(toInput.value);

                        // 🤖 Autopilot: Extraction is now managed by the state machine watchdog.
                        // Do NOT trigger extraction here to avoid duplicate calls.
                        chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
                            if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused) {
                                console.log('🤖 Autopilot: 2-Month filter applied. State machine will handle extraction.');
                                chrome.storage.local.set({ autopilot_last_active_time: Date.now() });
                                const customUI = document.getElementById('customMonthActions');
                                if (customUI) customUI.remove();
                            }
                        });
                    }, 500);
                }
            }, 200);
        }
    }, 800);
  
    const buttonRow = document.createElement('div');
    Object.assign(buttonRow.style, {
      display: 'flex',
      gap: '10px',
    });
  
    const buttons = ['Start Extracting', 'Back to Home'];
    buttons.forEach(label => {
      const btn = document.createElement('button');
      btn.innerText = label;
      Object.assign(btn.style, {
        
        padding: '6px 12px',
        border: '1px solid #ccc',
        borderRadius: '5px',
        cursor: 'pointer',
        background: '#fff',
        fontSize: '12px',
        color: '#0065b3',
        marginBottom: '10px',
        fontWeight: 'bold',
        transition: 'all 0.2s ease'
      });
  
     
      btn.addEventListener('mouseover', () => {
        btn.style.background = '#0065b3';
        btn.style.color = '#fff';
      });
      btn.addEventListener('mouseout', () => {
        btn.style.background = '#fff';
        btn.style.color = '#0065b3';
      });
  
      btn.addEventListener('click', () => {
        console.log(`${label} clicked`);
  
        if (label === 'Start Extracting') {
          const fromInput = document.getElementById('from_date1') || document.getElementById('from_date');
          const toInput = document.getElementById('to_date1') || document.getElementById('to_date');
          
          const fromDate = fromInput?.value;
          const toDate = toInput?.value;

  
          if (fromDate && toDate) {
            extractRenewalTableData(); // ✅ Run function
            const customUI = document.getElementById('customMonthActions');
            if (customUI) customUI.remove();
            

          } else {
            const instructionText = document.getElementById('dateInstruction');
            if (instructionText) instructionText.innerText = 'Please select both dates first';
          }
        }
  
        if (label === 'Back to Home') {
          const popup = document.getElementById('my-dashboard-popup');
        
  
          const customUI = document.getElementById('customMonthActions');
          if (customUI) customUI.remove();

                          // 👉 Also trigger click on sidebar's "Dashboard" <a> element
                          const dashboardLink = document.querySelector('.side_dash_navigation .dropdown11');
                          if (dashboardLink) dashboardLink.click();
                          document.getElementById('sidebarwrapper')?.classList.remove('toggled');
                          document.getElementById('sideBackdrop')?.classList.remove('backdrop1');
                          
                      
                          // 🚀 Create and show new button container
                          const actionUI = createButtonContainer();
                          popup.appendChild(actionUI);
                          actionUI.style.display = 'flex';
        }
      });
  
      buttonRow.appendChild(btn);
    });
  
    container.appendChild(buttonRow);
    return container;
  };

  // 🌫️ Initial Overlay for Name Fetching
  const showInitialOverlay = () => {
      const currentUrl = window.location.href;
      if (currentUrl.includes('proposalGuid=') || currentUrl.includes('portability') || currentUrl.includes('portSummary') || currentUrl.includes('#auth/login') || currentUrl.includes('#/auth/resetpwd') || currentUrl.includes('#/auth/verifyotp') || currentUrl.includes('#/auth/changepwd')) {
          console.log('🛑 [showPopup] Login/Portability URL detected! Skipping initial overlay.');
          return;
      }
      const existing = document.getElementById('initial-fetch-overlay');
      if (existing) return;

      const overlay = document.createElement('div');
      overlay.id = 'initial-fetch-overlay';
      Object.assign(overlay.style, {
          position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
          background: 'rgba(255, 255, 255, 0.7)', backdropFilter: 'blur(4px)',
          zIndex: '10001', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif'
      });

      const msgBox = document.createElement('div');
      Object.assign(msgBox.style, {
          padding: '20px 40px', background: '#fff', borderRadius: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)', border: '1px solid #0065b3',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px'
      });

      const spinner = document.createElement('div');
      Object.assign(spinner.style, {
          width: '40px', height: '40px', border: '4px solid #f3f3f3',
          borderTop: '4px solid #0065b3', borderRadius: '50%',
          animation: 'spin 1s linear infinite'
      });

      const text = document.createElement('div');
      text.id = 'initial-fetch-msg'; // 🆔 Added ID
      text.innerText = 'Fetching agent name...';
      Object.assign(text.style, {
          fontSize: '16px', fontWeight: 'bold', color: '#0065b3'
      });

      msgBox.append(spinner, text);
      overlay.appendChild(msgBox);
      document.body.appendChild(overlay);
  };

  const removeInitialOverlay = () => {
      document.getElementById('initial-fetch-overlay')?.remove();
  };



    // ====== MAIN POPUP CREATION ======
    const createPopup = () => {
      const popup = document.createElement('div');
      popup.id = 'my-dashboard-popup';
      Object.assign(popup.style, {
        position: 'fixed', top: '20px', right: '20px', background: '#fff', color: '#303030',
        padding: '10px', cursor: 'pointer', borderRadius: '10px', border: '1px solid #bcbcbc',
        zIndex: '9999', boxShadow: '0 0 10px rgba(187, 187, 187, 0.5)', fontFamily: 'sans-serif',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        minWidth: '350px', maxWidth: '350px', height: 'auto', transition: 'height 0.5s ease',
      });
  
      const greet = document.createElement('span');
      greet.innerText = 'Welcome to the Dashboard!';
      greet.style.fontSize = '12px';
  
      const nameSpan = document.createElement('span');
      nameSpan.id = 'agentName';
      Object.assign(nameSpan.style, {
        fontWeight: 'bold', color: '#0065b3', fontSize: '18px'
      });
      nameSpan.innerText = 'Fetching name...';
  
      const buttonContainer = createButtonContainer(popup);
      const spinner = createSpinner();
      spinner.style.display = 'flex'; // 🚀 Show it for initial fetch
  
      // Create Minimized Status Bar (Hidden by default)
      const minStatus = document.createElement('div');
      minStatus.id = 'minimizedStatus';
      Object.assign(minStatus.style, {
          display: 'none', width: '100%', flexGrow: '1', alignItems: 'center', justifyContent: 'flex-start'
      });
  
      popup.append(greet, nameSpan, buttonContainer, spinner);
      const topBar = createTopBar(popup);
      topBar.id = 'top-bar-container';
      popup.insertBefore(topBar, popup.firstChild);

      createMinimizedBar(); // Create the hidden bar initially

      showInitialOverlay(); // 🌫️ Show overlay initially
      document.body.appendChild(popup);
      return { popup, nameSpan, spinner, buttonContainer };
    };
  
    // ====== DRAGGABLE SUPPORT ======
    const makeDraggable = (popup, dragHandle) => {
      dragHandle.addEventListener('mousedown', (e) => {
        const offsetX = e.clientX - popup.offsetLeft;
        const offsetY = e.clientY - popup.offsetTop;
        
        // 🚀 Smooth Dragging: Disable transition temporarily
        const originalTransition = popup.style.transition;
        popup.style.transition = 'none';
  
        const onMouseMove = (e) => {
          popup.style.left = `${e.clientX - offsetX}px`;
          popup.style.top = `${e.clientY - offsetY}px`;
          popup.style.right = 'auto';
        };
  
        const onMouseUp = () => {
          // 🚀 Restore transition
          popup.style.transition = originalTransition;
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
        };
  
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      });
    };
    
  
    // ====== DASHBOARD HANDLERS ======
    const tryClickProfile = (nameSpan, spinner, buttonContainer) => {
        const currentUrl = window.location.href;
        if (currentUrl.includes('proposalGuid=') || currentUrl.includes('portability') || currentUrl.includes('portSummary') || currentUrl.includes('#auth/login') || currentUrl.includes('#/auth/resetpwd') || currentUrl.includes('#/auth/verifyotp') || currentUrl.includes('#/auth/changepwd')) {
            console.log('🛑 [showPopup] Login/Portability URL detected! Skipping agent name fetching.');
            if (nameSpan) nameSpan.innerText = 'Agent';
            if (spinner) spinner.style.display = 'none';
            if (buttonContainer) buttonContainer.style.display = 'flex';
            updateMinimizedStatus();
            removeInitialOverlay();
            return;
        }

        let attempts = 0;
        const maxAttempts = 5;

        const attemptFetch = () => {
            attempts++;
            console.log(`🌀 Name Fetch Attempt: ${attempts}/${maxAttempts}`);
            
            // Show attempt count in overlay
            const overlayMsg = document.getElementById('initial-fetch-msg');
            if (overlayMsg) overlayMsg.innerText = `Fetching agent name... (Attempt ${attempts}/${maxAttempts})`;

            // 🚀 1. Try quick selectors first
            const quickSelectors = ['h5.Prof_holder', '.user-name', '.profile-name', '.welcome-msg span', '.user-profile .name', '.agent-name', '.user-name-profile'];
            for (let selector of quickSelectors) {
                const el = document.querySelector(selector);
                const text = el?.innerText?.trim();
                if (text && text !== 'Fetching name...' && text.toLowerCase() !== 'agent') {
                    const cleanedName = text.replace(/\s+/g, ' '); 
                    console.log('✅ Name found via:', selector);
                    nameSpan.innerText = cleanedName;
                    spinner.style.display = 'none';
                    buttonContainer.style.display = 'flex';
                    updateMinimizedStatus();
                    removeInitialOverlay();
                    isNameFetchComplete = true; // ✅ Name found, cleanup can start

                    // If we found it on profile page, let's go back to dashboard
                    const isProfilePage = window.location.href.includes('profile');
                    if (isProfilePage) {
                        const dashboardLink = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Dashboard');
                        dashboardLink?.click();
                    }
                    return; 
                }
            }

            // 🚀 2. If not found and haven't hit max, navigate and retry
            if (attempts < maxAttempts) {
                const profileLink = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'My Profile');
                const dashboardLink = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Dashboard');

                if (window.location.href.includes('profile')) {
                    // We are on profile but didn't find it? Go back to dashboard to refresh state
                    dashboardLink?.click();
                } else if (profileLink) {
                    // On dashboard/other? Go to profile
                    profileLink.click();
                }

                // Wait for page load/navigation and retry
                setTimeout(attemptFetch, 2500); 
            } else {
                // 🚀 3. Max attempts reached (5 attempts failed)
                console.warn('⚠️ Could not fetch specific agent name after 5 attempts. Using fallback: System User');
                nameSpan.innerText = 'System User'; 
                spinner.style.display = 'none';
                buttonContainer.style.display = 'flex';
                updateMinimizedStatus();
                removeInitialOverlay();
                isNameFetchComplete = true; // ✅ Max attempts hit, cleanup can start
                
                // Return to dashboard gracefully without closing tab
                const dashboardLink = [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'Dashboard');
                dashboardLink?.click();
            }
        };

        attemptFetch();
    };
  
    const handleCurrentMonthClick = () => {
      
      const popup = document.getElementById('my-dashboard-popup');

        if (!popup) return console.log('Popup element not found.');


        const buttonContainer = document.getElementById('mainActBtn');
         if (buttonContainer) buttonContainer.remove();

      
        popup.style.maxHeight = '500px';
        const proposalBtn = document.querySelector('.button.view_proposals_btn');
        if (!proposalBtn) return console.log('Proposal link not found.');
      
        proposalBtn.click();
        const spinner = createSpinner();
        spinner.style.display = 'flex'; // 🌪️ Show explicitly for extraction
        popup.appendChild(spinner);
      
        setTimeout(() => {
          const currYearButton = document.querySelector('#currYear');
          if (currYearButton) {
            currYearButton.click();
          }
      
          setTimeout(() => {
            extractRenewalTableData();  // Assuming extractRenewalTableData is defined elsewhere
            spinner.remove();
          
          }, 1500);
        }, 1000);
      };

      const handleMonthRangeSync = (passedPopup, monthsBack) => {
        let popup = passedPopup;
        if (!popup) popup = document.getElementById('my-dashboard-popup');
        if (!popup) return console.log('Popup element not found.');

        const buttonContainer = document.getElementById('mainActBtn');
        if (buttonContainer) buttonContainer.remove();

        const spinner = createSpinner();
        spinner.style.display = 'flex'; // 🌪️ Show explicitly for extraction
        popup.appendChild(spinner);

        const today = new Date();
        const startDate = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1);
        
        const formatDate = (date) => {
          const dd = String(date.getDate()).padStart(2, '0');
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const yyyy = date.getFullYear();
          return `${dd}/${mm}/${yyyy}`;
        };

        const startVal = formatDate(startDate);
        const endVal = formatDate(today);
        console.log(`🔍 Intent: Applying filter [${startVal}] to [${endVal}]`);

        const proposalBtn = document.querySelector('.button.view_proposals_btn');
        proposalBtn?.click();

        setTimeout(() => {
          const fromInput = document.getElementById('from_date') || document.getElementById('from_date1');
          const toInput = document.getElementById('to_date') || document.getElementById('to_date1');

          if (fromInput && toInput) {
            fromInput.value = startVal;
            fromInput.dispatchEvent(new Event('input', { bubbles: true }));
            fromInput.dispatchEvent(new Event('change', { bubbles: true }));

            toInput.value = endVal;
            toInput.dispatchEvent(new Event('input', { bubbles: true }));
            toInput.dispatchEvent(new Event('change', { bubbles: true }));
          }

          setTimeout(() => {
            spinner.remove();
            extractRenewalTableData();
          }, 1500);
        }, 3000);
      };

      // Main Handler Function
const handleCustomMonthClick = (passedPopup, monthsBack) => {

    const popup = passedPopup || document.getElementById('my-dashboard-popup');

    popup.style.maxHeight = '500px';
  
    const buttonContainer = document.getElementById('mainActBtn');
    if (buttonContainer) buttonContainer.remove();

  
    const spinner = createSpinner();
    spinner.style.display = 'flex'; // 🌪️ Show explicitly for extraction
    popup.appendChild(spinner);
  
    setTimeout(() => {
      spinner.remove();
  
      const customUI = createCustomMonthActionUI(monthsBack);
      popup.appendChild(customUI);
    }, 3000);
  
    const proposalBtn = document.querySelector('.button.view_proposals_btn');
    proposalBtn?.click();
  };
  
  const handleAutoSyncClick = (passedPopup) => {
    let popup = passedPopup;
    if (!popup) popup = document.getElementById('my-dashboard-popup');
    if (!popup) return console.log('Popup element not found.');

    isAutoSyncRunning = true; // 🚀 Enable auto-pilot mode for this run
    extensionGlobalActive = true; // 🛡️ Force enable
    popup.style.maxHeight = '500px';
    
    // Show minimize button and auto-minimize only if not already minimized
    const compactBar = document.getElementById('compactStatusBar');
    const isAlreadyMinimized = compactBar && compactBar.style.display === 'flex';

    const minBtn = document.getElementById('toggleMinimizeBtn');
    if (minBtn) {
        minBtn.style.display = 'block';
        // 🚀 Removed auto-minimize here to keep timer visible in Maximized Popup
    }

    const buttonContainer = document.getElementById('mainActBtn');
    if (buttonContainer) buttonContainer.remove();

    const spinner = createSpinner();
    spinner.style.display = 'flex'; // 🌪️ Show explicitly for extraction
    popup.appendChild(spinner);

    // 🚀 SHOW ENTERTAINMENT OVERLAY IMMEDIATELY
    createExtractionOverlay();
    syncStartTime = Date.now(); // 🚀 Track start time

    // 1. Calculate dates
    const today = new Date();
    const firstOfPrevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    console.log(`📅 Setup: Calculating sync range from ${firstOfPrevMonth.toDateString()} to ${today.toDateString()}`);
    
    const formatDate = (date) => {
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yyyy = date.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    };

    const startVal = formatDate(firstOfPrevMonth);
    const endVal = formatDate(today);
    console.log(`🔍 Intent: Applying filter [${startVal}] to [${endVal}]`);

    // 🔒 RECORD DATES IMMEDIATELY TO STORAGE BEFORE ANY UI ACTION / EXTRACTION
    const domFromVal = document.getElementById('from_date')?.value?.trim() || document.querySelector('input[id*="from_date"]')?.value?.trim();
    const domToVal = document.getElementById('to_date')?.value?.trim() || document.querySelector('input[id*="to_date"]')?.value?.trim();
    chrome.storage.local.set({
        filterStartDate: domFromVal || startVal,
        filterEndDate: domToVal || endVal
    });

    // 2. Click proposals link
    const proposalBtn = document.querySelector('.button.view_proposals_btn');
    proposalBtn?.click();

    // ⏱️ Start Visual Countdown
    const timerUi = document.getElementById('autoSyncTimer');
    const timerVal = document.getElementById('timerVal');
    if (timerUi) timerUi.style.display = 'flex';
    
    let secondsLeft = 6;
    if (timerVal) timerVal.innerText = secondsLeft + 's';
    
    const countdownInterval = setInterval(() => {
        secondsLeft--;
        if (timerVal) timerVal.innerText = secondsLeft + 's';
        if (secondsLeft <= 0) {
            clearInterval(countdownInterval);
            if (timerUi) timerUi.style.display = 'none';
        }
    }, 1000);

    // 🚀 Update Cooldown for Next Run (after extraction finishes)
    const setNextAutoSyncTime = () => {
        const nextRun = Date.now() + (2 * 60 * 60 * 1000); // 2 Hours from now
        chrome.storage.local.set({ nextAutoSyncTime: nextRun });
    };

    setTimeout(() => {
        // 3. Sync to DOM
        const fromInput = document.getElementById('from_date') || document.querySelector('input[id*="from_date"]');
        const toInput = document.getElementById('to_date') || document.querySelector('input[id*="to_date"]');

        if (fromInput && toInput) {
            if (!fromInput.value) {
                fromInput.value = startVal;
                fromInput.dispatchEvent(new Event('input', { bubbles: true }));
                fromInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            if (!toInput.value) {
                toInput.value = endVal;
                toInput.dispatchEvent(new Event('input', { bubbles: true }));
                toInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            const activeFrom = fromInput.value.trim() || startVal;
            const activeTo = toInput.value.trim() || endVal;
            chrome.storage.local.set({ filterStartDate: activeFrom, filterEndDate: activeTo });
        } else {
            chrome.storage.local.set({ filterStartDate: startVal, filterEndDate: endVal });
        }

        // 4. Start Extraction
        setTimeout(() => {
            spinner.remove();
            
            // Read fresh values right before extraction
            const currentFrom = document.getElementById('from_date')?.value?.trim() || document.querySelector('input[id*="from_date"]')?.value?.trim();
            const currentTo = document.getElementById('to_date')?.value?.trim() || document.querySelector('input[id*="to_date"]')?.value?.trim();
            if (currentFrom || currentTo) {
                chrome.storage.local.set({
                    filterStartDate: currentFrom || startVal,
                    filterEndDate: currentTo || endVal
                });
            }
            
            extractRenewalTableData();
        }, 1500);

    }, 6000); // 🚀 Wait 6 seconds for initial table/page load before filling dates
  };
  
      

      
    // ====== TABLE DATA EXTRACTOR ======
    let currentPageNum = 1; // 🚀 Global storage for pages scanned


    const extractRenewalTableData = () => {
      extensionGlobalActive = true; // 🛡️ Force globally active before starting

      // Save exact date filter inputs from DOM
      const domFrom = document.getElementById('from_date')?.value?.trim();
      const domTo = document.getElementById('to_date')?.value?.trim();
      if (domFrom || domTo) {
          chrome.storage.local.set({
              filterStartDate: domFrom || null,
              filterEndDate: domTo || null
          });
      }

      // PREVENT MULTIPLE CONCURRENT EXTRACTIONS
      if (document.getElementById('liveExtractModal')) {
         console.warn('-- Extraction is already running --');
         return;
      }

      // Cleanup old completed modals if user starts a totally fresh run
      const oldCompleted = document.querySelectorAll('#completedExtractModal');
      oldCompleted.forEach(m => m.remove());

      let retryCount = 0;
      const maxRetries = 40; // 🚀 Wait up to 20 seconds

      const startExtractionWithWait = () => {
        // ⏳ Bypassing retries only if Faveo portal loading spinner is physically visible
        // BUT: Once autopilot state machine is in START_EXTRACTION, do NOT pause for spinner
        const faveoLoader = document.querySelector('.main-loading') || document.querySelector('div.loading');
        const isLoaderVisible = faveoLoader && (
            faveoLoader.offsetWidth > 0 || 
            faveoLoader.offsetHeight > 0 || 
            window.getComputedStyle(faveoLoader).display !== 'none'
        );

        // Only pause for spinner if extraction hasn't started yet (autopilotState != 'START_EXTRACTION')
        const shouldPauseForSpinner = typeof autopilotState !== 'undefined' && autopilotState === 'START_EXTRACTION' ? false : true;
        if (isLoaderVisible && shouldPauseForSpinner) {
            console.log('⏳ Faveo page loading spinner is visible. Pausing extraction retries...');
            setTimeout(startExtractionWithWait, 1000);
            return;
        }

        // 🚀 Faveo loading finished! Create & show extraction overlay and live modal now
        if (!document.getElementById('liveExtractModal')) {
            const spinner = createSpinner();
            const popup = document.getElementById('my-dashboard-popup');  
            if (spinner && popup) {
                spinner.style.display = 'flex';
                popup.appendChild(spinner);
            }

            // 🚀 SHOW ENTERTAINMENT OVERLAY
            createExtractionOverlay();
            if (popup) {
                popup.appendChild(spinner);
                
                // 🚀 Add Live Extraction Modal
                const extModal = document.createElement('div');
                extModal.id = 'liveExtractModal';

                // Show minimize button whenever any extraction starts
                const minBtn = document.getElementById('toggleMinimizeBtn');
                if (minBtn) minBtn.style.display = 'block';

                Object.assign(extModal.style, {
                  marginTop: '10px', width: '100%', padding: '10px', 
                  background: '#e3f2fd', border: '1px solid #90caf9', 
                  borderRadius: '8px', textAlign: 'center', fontFamily: 'sans-serif',
                  boxSizing: 'border-box'
                });
                extModal.innerHTML = `
                   <h4 style="margin:0 0 8px 0; color:#1565c0; font-size:14px;">Extracting Leads...</h4>
                   <div style="font-size:12px; color:#e67e22; font-weight:bold; line-height:1.5;">
                      <p style="margin:0;">Current Page: <b id="liveExtPage">1</b></p>
                      <p style="margin:0;">Rows Found: <b id="liveExtRows">0</b></p>
                      <p style="margin:0;">Total Extracted: <b id="liveExtTotal">0</b></p>
                   </div>
                `;
                popup.appendChild(extModal);
            }
        }

        const table = document.querySelector('.proposalDetails-tbl');
        const rows = table ? table.querySelectorAll('tbody tr') : [];
        const hasData = rows.length > 0 && !rows[0].textContent.toLowerCase().includes('no record');
        if (!table || !hasData) {
          if (retryCount < maxRetries) {
            console.log(`Waiting for table data... (Retry ${retryCount+1}/${maxRetries})`);
            retryCount++;
            setTimeout(startExtractionWithWait, 500);
            return;
          }
          console.log('Renewal table data not found after retries.');
          chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
              if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused) {
                  console.log('🤖 Autopilot: Table loading failed. Retrying extraction in 10 seconds...');
                  setTimeout(() => {
                      retryCount = 0;
                      startExtractionWithWait();
                  }, 10000);
              }
          });
          return;
        }

        console.log(`✅ Table and ${rows.length} rows found!`);
        
        tableData = []; // clear previous
        const headerElements = table.querySelectorAll('thead tr th');
        let headers = [];
        headerElements.forEach(header => {
            let key = header.textContent.trim().toUpperCase().replace(/\s+/g, '_');
            if (key !== 'ACTION') headers.push(key);
        });
        headers.push('AGENT_NAME');
        console.log(`📑 Headers Extracted: ${headers.join(', ')}`);

        // --- SUB-FUNCTIONS ---
        const extractTableData = () => {
            try {
                const currentTable = document.querySelector('.proposalDetails-tbl');
                if (!currentTable) {
                    console.warn('%c❌ [EXTRACT] %cTable lost during scan!', "color:red; font-weight:bold;", "color:#e67e22; font-weight:bold;");
                    return;
                }
                const currentRows = currentTable.querySelectorAll('tbody tr');
                const agentName = document.getElementById('agentName')?.textContent.trim() || 'UNKNOWN';
                
                console.groupCollapsed(`%c📡 [SCAN] %cPage ${currentPageNum} | %c${currentRows.length} rows found`, "color:#0065b3; font-weight:bold;", "color:#e67e22; font-weight:bold;", "color:#0065b3; font-weight:bold;");
                console.log(`---------------------------------------------------------`);
                if (headers.length === 0) console.warn('⚠️ WARNING: Headers array is empty!');

                currentRows.forEach((row, rIdx) => {
                    const cells = row.querySelectorAll('td');
                    const rowData = {};
                    let cellCounter = 0;
                    cells.forEach((cell) => {
                        if (headers[cellCounter]) {
                            rowData[headers[cellCounter]] = cell.textContent.trim();
                            cellCounter++;
                        }
                    });
                    rowData['AGENT_NAME'] = agentName;
                    rowData['isUploaded'] = false;
                    tableData.push(rowData);
                });

                // Update UI
                const liveExtRows = document.getElementById('liveExtRows');
                const liveExtTotal = document.getElementById('liveExtTotal');
                if (liveExtRows) liveExtRows.innerText = currentRows.length;
                if (liveExtTotal) liveExtTotal.innerText = tableData.length;
                
                updateMinimizedStatus();
                console.log(`%c✅ [OK] %cCollected Page ${currentPageNum}. Batch size: ${currentRows.length}`);
                console.log(`📊 [STATS] Total records so far: ${tableData.length}`);
                console.log(`---------------------------------------------------------`);
                console.groupEnd();
            } catch (err) {
                console.error('%c❌ [CRITICAL] %cError inside extractTableData:', "color:red; font-weight:bold;", "color:#e67e22; font-weight:bold;", err);
            }
        };

        const finishExtractionSuccess = () => {
            console.log(`🎉 Success: Finished extracting all pages. Total leads: ${tableData.length}`);
            isExtractionPhaseDone = true;

            if (!isGamePlaying) removeExtractionOverlay();

            const copiedData = JSON.parse(JSON.stringify(tableData));
            copiedData.forEach(row => {
              const isDuplicate = accumulatedData.some(existing => JSON.stringify(existing) === JSON.stringify(row));
              if (!isDuplicate) accumulatedData.push(row);
            });
            
            processData(accumulatedData);
            
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
               chrome.storage.local.set({ lastExtractedPages: currentPageNum });
            }
            
            const liveModal = document.getElementById('liveExtractModal');
            if (liveModal) {
               liveModal.id = 'completedExtractModal';
               liveModal.style.background = '#f1f8e9'; 
               liveModal.style.borderColor = '#c5e1a3';
               liveModal.innerHTML = `
                  <div style="display:flex; align-items:center; justify-content:center; gap:10px; padding:2px 5px; font-family:sans-serif;">
                      <div style="font-size:13px; color:#e67e22; font-weight:bold; font-weight:bold; display:flex; gap:8px;">
                         <span>Page: <span style="color:#1565c0;">${currentPageNum}</span></span>
                         <span style="opacity:0.3;">|</span>
                         <span>Lead: <span style="color:#d32f2f;">${accumulatedData.length}</span></span>
                      </div>
                      <button id="clearExtDataBtn" title="Clear All Data" style="background:none; border:none; cursor:pointer; color:#d32f2f; font-size:16px; padding:2px; display:flex; align-items:center;">
                        <i class="fi fi-rr-trash"></i>
                      </button>
                  </div>
                `;

               document.getElementById('clearExtDataBtn')?.addEventListener('click', () => {
                  if (confirm('Are you sure you want to clear all extracted data?')) {
                      accumulatedData = [];
                      tableData = [];
                      document.getElementById('completedExtractModal')?.remove();
                      document.getElementById('messageDiv')?.remove();
                      document.querySelector('#secActBtn')?.remove();

                      const popup = document.getElementById('my-dashboard-popup');
                      if (popup) {
                          const actionUI = createButtonContainer();
                          popup.appendChild(actionUI);
                          actionUI.style.display = 'flex';
                      }
                   }
               });
            }

            let messageDiv = document.getElementById('messageDiv');
            if (!messageDiv) createDataUi();
    
            const secondaryButtonContainer = createSecondaryButtonContainer();
            if (secondaryButtonContainer) {
                const popup = document.getElementById('my-dashboard-popup');
                if (popup) popup.appendChild(secondaryButtonContainer);
                secondaryButtonContainer.style.display = 'block';
            }

            setTimeout(() => {
                document.querySelectorAll('.spinner, #loader-spinner').forEach(el => el.remove());
            }, 1000);

            chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
                const autopilotActive = res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused;
                if (isAutoSyncRunning || autopilotActive) {
                    console.log('⚡ Autopilot/AutoSync: Extraction complete. Starting automatic API upload in 10s...');
                    setTimeout(() => { sendDataToAppScript(); }, 10000);
                }
            });
        };

        const pauseExtractionWithError = (msg, page) => {
            console.error(`❌ Error: ${msg} (Page ${page})`);
            chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
                const isMasterMode = res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused;
                if (isMasterMode) {
                    console.warn(`🤖 Master Extension Mode Active: Extraction Timeout on page ${page}. Uploading already extracted data (${accumulatedData.length} items), skipping pending pages & redirecting to dashboard...`);
                    finishExtractionSuccess();
                    setTimeout(() => {
                        window.location.hash = '#/portal/dashboard';
                    }, 2000);
                } else {
                    // 👤 Master Mode Disabled: Show Resume button modal for manual agent action
                    const liveModal = document.getElementById('liveExtractModal');
                    if (liveModal) {
                       liveModal.style.background = '#ffebee';
                       liveModal.style.borderColor = '#ef5350';
                       liveModal.innerHTML = `
                          <h4 style="margin:0 0 8px 0; color:#c62828; font-size:14px;">⚠️ Extraction Paused (Error)</h4>
                          <div style="font-size:12px; color:#e67e22; font-weight:bold; line-height:1.5;">
                             <p style="margin:0; color:#d32f2f;"><b>Error:</b> ${msg}</p>
                             <p style="margin:4px 0 0 0;">Failed at Page: <b>${page}</b></p>
                          </div>
                          <div id="errBtns" style="margin-top:10px; display:flex; justify-content:center; gap:10px;">
                            <button id="resumeExtBtn" style="padding:5px 10px; background:#f1c40f; color:#fff; border:none; border-radius:4px; font-weight:bold; cursor:pointer;">▶ Resume</button>
                          </div>
                       `;
                       document.getElementById('resumeExtBtn')?.addEventListener('click', () => {
                           processNextPage();
                       });
                    }
                }
            });
        };

        function processNextPage() {
            console.log(`📄 Scanning: Page ${currentPageNum}... (GlobalActive: ${extensionGlobalActive})`);
            extractTableData();

            const nextBtn = document.querySelector('.pagination .page-item a[aria-label="Next"]');
            const isDisabled = nextBtn?.parentElement?.classList.contains('disabled');

            if (!nextBtn || isDisabled) {
                console.log('🏁 End: No more pages.');
                finishExtractionSuccess();
                return;
            }

            const nextPage = currentPageNum + 1;
            console.log(`⏭️ Action: Moving to Page ${nextPage}...`);
            
            const beforeContent = document.querySelector('.proposalDetails-tbl tbody')?.innerText.trim();
            nextBtn.click();

            let attempts = 0;
            const checkLoad = setInterval(() => {
                attempts++;
                const nowContent = document.querySelector('.proposalDetails-tbl tbody')?.innerText.trim();
                const nowRows = document.querySelectorAll('.proposalDetails-tbl tbody tr').length;
                
                if ((nowContent !== beforeContent && nowRows > 0) || attempts > 180) {
                    clearInterval(checkLoad);
                    if (attempts > 180) {
                        pauseExtractionWithError('Timeout waiting for page load.', nextPage);
                        return;
                    }
                    setTimeout(() => {
                        if (!extensionGlobalActive) return;
                        currentPageNum = nextPage;
                        const livePage = document.getElementById('liveExtPage');
                        if (livePage) livePage.innerText = currentPageNum;
                        processNextPage();
                    }, 1000);
                }
            }, 500);
        }

        // --- START ---
        currentPageNum = 1;
        console.log(`%c🚀 [START] %cInitiating Extraction Process...`, "background:#0065b3; color:white; padding:2px 5px; font-weight:bold;");
        if (extensionGlobalActive) {
            processNextPage();
        } else {
            console.warn('%c🛑 [STOP] %cCancelled: extensionGlobalActive is false.', "color:red; font-weight:bold;", "color:#e67e22; font-weight:bold;");
        }
      };

      // 🚀 START THE EXTRACTION PROCESS
      startExtractionWithWait();
    };


    // ====== SEND DATA TO SUPABASE ======
    function sendDataToSupabase() {

      const buttonContainer = document.getElementById('secActBtn');
      if (buttonContainer) {
        buttonContainer.style.display = 'none';
      }

      if (!tableData || tableData.length === 0) {
        console.warn('No table data to send.');
        return;
      }

    
      const messageDiv = document.getElementById('messageDiv');
      if (!messageDiv) {
        console.warn('messageDiv not found!');
        return;
      }

      
      if (messageDiv) {
        messageDiv.innerHTML = ''; // Clear the existing content
      }
    
      // Clear existing progress divs if any
      const existingProgress = document.getElementById('progressInner');
      if (existingProgress) {
        existingProgress.closest('div').remove();
      }
    
      // Create and append new upload progress UI
      const uploadProgressDiv = createUploadProgressDiv();
      messageDiv.appendChild(uploadProgressDiv);
    
      // Give the DOM some time to paint
      setTimeout(() => {
        updateProgress(0, 0, accumulatedData.length);  // Start from 0%
      }, 100);
    
      // 📦 Verify context validity before sending
      if (!chrome.runtime?.id) {
         console.warn('-- Extension Context Invalidated. Refresh needed. --');
         isBackgroundActive = false;
         updateMinimizedStatus(); // 🌑 Bar turns dark
         if (messageDiv) {
            messageDiv.innerHTML = `<div style="color:#d32f2f; padding:20px; font-weight:bold;">⚠️ Connection Lost.<br>This usually happens when the extension is updated.<br>Please Refresh the page to synchronize.</div>`;
         } else {
            alert('Extension connection lost. Please refresh the page.');
         }
         return;
      }

      try {
          console.log(`📡 Sending ${accumulatedData.length} records to background for Supabase API upload...`);
          // Send data to background
          chrome.runtime.sendMessage({
            type: 'TABLE_DATA',
            payload: accumulatedData
          });
      } catch (e) {
          console.error('Failed to send message:', e);
      }
    }
    const sendDataToAppScript = sendDataToSupabase;
    
    

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!chrome.runtime?.id) return; // Safety check
      if (message.type === 'UPLOAD_PROGRESS') {
        const p = message.payload;
        isAutoSyncRunning = true;

        // 🚀 UI Persistency: If popup was reopened, reconstruct the transmission UI
        const progressDiv = document.getElementById('progressInner');
        if (!progressDiv) {
            console.log('🔄 Reconstructing transmission UI for active background process...');
            const messageDiv = document.getElementById('messageDiv');
            if (messageDiv) {
                messageDiv.innerHTML = ''; // Clear greeting/extract summary
                messageDiv.appendChild(createUploadProgressDiv());
            }
        }
        
        console.groupCollapsed(`%c📡 [SYNC] %cProgress Update: %c${p.progressPercent}%`, "color:#2196f3; font-weight:bold;", "color:#e67e22; font-weight:bold;", "color:#2196f3; font-weight:bold;");
        console.log(`---------------------------------------------------------`);
        
        // 🚀 Smart Flag Sync: Mark uploaded row indices as finished
        if (accumulatedData && accumulatedData.length > 0) {
            console.log(`✅ [FLAGS] Updating ${p.uploadedCount} leads to 'Uploaded: true'`);
            console.log(`---------------------------------------------------------`);
            for (let i = 0; i < p.uploadedCount && i < accumulatedData.length; i++) {
                if (!accumulatedData[i].isUploaded) {
                   accumulatedData[i].isUploaded = true;
                }
            }
        }

        updateProgress(
          p.progressPercent, 
          p.uploadedCount, 
          p.totalCount, 
          p.estSecondsLeft, 
          p.currentLead, 
          p.avgChunkTime, 
          p.lastBatchTime, 
          p.chunkHistory, 
          p.chunkSize,
          false,
          p.totalEstSeconds
        );
        console.log(`📊 [UI] Progress bar and stats updated.`);
        console.log(`---------------------------------------------------------`);
        console.groupEnd();

      } else if (message.type === 'UPLOAD_ERROR') {
        console.error(`%c❌ [UPLOAD ERROR] %cBackground Failed: %c${message.payload.error}`, "color:red; font-weight:bold;", "color:#e67e22; font-weight:bold;", "color:red;");
        isAutoSyncRunning = false; // 🚀 Reset UI state on error
        handleUploadErrorUI(message.payload);
        updateMinimizedStatus(); // 🔄 Reset UI

        // 🤖 Autopilot Skip on Error
        chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused', 'autopilot_index', 'autopilot_agents'], (res) => {
            if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused && res.autopilot_agents) {
                const nextIndex = (res.autopilot_index + 1) % res.autopilot_agents.length;
                const delayMs = (nextIndex === 0) ? (10 * 60 * 1000) : (2 * 60 * 1000);
                chrome.storage.local.set({
                    autopilot_index: nextIndex,
                    autopilot_account_attempts: 0,
                    autopilot_next_login_time: Date.now() + delayMs
                }, function() {
                    console.log(`⚠️ Autopilot: Upload failed, skipping to next agent index ${nextIndex} in ${delayMs / 60000}m...`);
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                });
            }
        });

      } else if (message.type === 'UPLOAD_COMPLETE') {
        const p = message.payload;
        console.log(`%c🏆 [COMPLETE] %cBackground confirmed final transmission.`, "color:#f1c40f; font-weight:bold; font-size:12px;", "color:#e67e22; font-weight:bold;");
        isAutoSyncRunning = false; // 🚀 Finished! Reset for next run
        isExtractionPhaseDone = true;
        updateProgress(100, p.total, p.total, 0, null, null, null, null, 10, p.preChecked);
        updateMinimizedStatus(); // 🔄 Reset Super-Compact UI
        if (!isGamePlaying && !isBirdPlaying) {
            removeExtractionOverlay();
        }

        // 🤖 Autopilot Logout Trigger
        chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused', 'autopilot_index', 'autopilot_agents'], (res) => {
            if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused && res.autopilot_agents) {
                console.log('🤖 Autopilot: Sync complete! Automatically logging out in 10 seconds...');
                setTimeout(() => {
                    const logoutBtn = document.querySelector('li.logout a') || document.querySelector('.logout a') || [...document.querySelectorAll('a')].find(a => a.textContent.toLowerCase().includes('log out') || a.textContent.toLowerCase().includes('logout'));
                    if (logoutBtn) {
                        const nextIndex = (res.autopilot_index + 1) % res.autopilot_agents.length;
                        // 🚀 2 mins (120s) between normal agents, 10 mins (600s) when restarting full cycle at 1st agent (index 0)
                        const delayMs = (nextIndex === 0) ? (10 * 60 * 1000) : (2 * 60 * 1000);
                        chrome.storage.local.set({
                            autopilot_index: nextIndex,
                            autopilot_next_login_time: Date.now() + delayMs
                        }, function() {
                            logoutBtn.click();
                            console.log(`🤖 Autopilot: Clicked logout button. Next agent index ${nextIndex} in ${delayMs / 60000} minutes.`);
                        });
                    } else {
                        console.error('⚠️ Autopilot: Logout button not found! Attempting reload to retry...');
                        window.location.reload();
                    }
                }, 10000);
            }
        });
      }
    });

    // 🚀 HEARTBEAT & RESUME LOGIC
    let popupPulseCount = 0;
    const startHeartbeat = () => {
        setInterval(() => {
            if (!chrome.runtime?.id) {
                isBackgroundActive = false;
                updateMinimizedStatus();
                return;
            }

            chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
                const wasActive = isBackgroundActive;
                popupPulseCount++;
                
                // 📡 Log every 30 pulses (approx 2 mins)
                if (popupPulseCount % 30 === 0) {
                   console.log(`💓 [HEARTBEAT] Connection with Background is Healthy.`);
                }

                if (chrome.runtime.lastError) {
                    isBackgroundActive = false;
                } else {
                    isBackgroundActive = (response && response.type === 'PONG');
                }

                // Update both dots (Mini bar vs Main Popup Header)
                if (wasActive !== isBackgroundActive) {
                    const pColor = isBackgroundActive ? '#4caf50' : '#f44336';
                    console.log(`💓 [HEARTBEAT] Status: %c${isBackgroundActive ? 'ACTIVE' : 'DISCONNECTED'}`, `color:${pColor}; font-weight:bold;`);
                    
                    // 1. Update Main UI Dot
                    const mainDot = document.getElementById('mainPulseDot');
                    if (mainDot) {
                        mainDot.style.background = pColor;
                        mainDot.title = isBackgroundActive ? 'Bridge Active' : 'Bridge Broken (Background Suspended)';
                    }

                    // 2. Update Mini Bar Dot
                    const miniDot = document.getElementById('miniPulseDot');
                    if (miniDot) {
                        miniDot.style.background = pColor;
                        miniDot.title = isBackgroundActive ? 'Bridge Active' : 'Bridge Broken';
                    }

                    if (!isBackgroundActive && isAutoSyncRunning) {
                        console.warn('❌ [CRITICAL] Background Heartbeat Lost during active process!');
                        isUploadPaused = true; // 🚨 Set paused state visually
                        showBackgroundKilledUI();
                    }
                }
            });
        }, 4000); // 4 seconds pulse 💓
    };

    const showBackgroundKilledUI = () => {
        const msgDiv = document.getElementById('uploadSummaryDiv');
        if (msgDiv && isAutoSyncRunning) {
            msgDiv.style.background = '#ffebee';
            msgDiv.style.color = '#d32f2f';
            msgDiv.innerHTML = `⚠️ <b>Background Terminated</b> (Chrome put helper to sleep)<br><button id="resumeKillBtn" style="margin-top:5px; background:#d32f2f; color:#fff; border:none; padding:4px 10px; border-radius:4px; font-weight:bold; cursor:pointer;">Resume Now</button>`;
            
            document.getElementById('resumeKillBtn')?.addEventListener('click', () => {
                isBackgroundActive = true;
                updateMinimizedStatus();
                resumeBackgroundProcess();
            });
        }
    };

    const resumeBackgroundProcess = () => {
        console.log('⚡ Resuming process from local state storage...');
        // Find unuploaded leads
        const pending = accumulatedData.filter(l => !l.isUploaded);
        if (pending.length > 0) {
            // Trigger sendDataToAppScript but reuse SAME accumulatedData
            sendDataToAppScript(); 
        } else {
            console.log('No pending leads to resume.');
        }
    };

    // Start monitoring host health
    startHeartbeat();

    function handleUploadErrorUI(payload) {
      isAutoSyncRunning = false; // 🚀 Reset UI state on error
      isUploadPaused = true; // 🚨 New state
      if (countdownInterval) clearInterval(countdownInterval);
      removeExtractionOverlay(); // 🚀 Force remove game overlay on error
      updateMinimizedStatus(); // 🔄 Sync changes to bar immediately 
      const summaryDiv = document.getElementById('uploadSummaryDiv');
      const pauseBtn = document.getElementById('pauseUploadBtn');
      const resumeBtn = document.getElementById('resumeUploadBtn');
      const restartBtn = document.getElementById('restartUploadBtn');
      const dots = document.getElementById('blinkingDotsSpan');
      
      if (pauseBtn) pauseBtn.style.display = 'none';
      if (resumeBtn) resumeBtn.style.display = 'block';
      if (restartBtn) restartBtn.style.display = 'block';
      if (dots) dots.style.display = 'none';

      // ⚡ Show mini auto-sync button again on error
      const miniBtn = document.getElementById('miniAutoSyncBtn');
      if (miniBtn) miniBtn.style.display = 'flex';

      if (summaryDiv) {
        summaryDiv.style.display = 'block';
        summaryDiv.style.color = '#c62828'; // red
        summaryDiv.style.background = '#ffebee';
        summaryDiv.innerHTML = `⚠️ System Auto Paused.<br>Error at lead index ${payload.index}:<br>${payload.error}<br><br>${payload.uploaded} Passed | ${payload.total - payload.uploaded} Pending`;
      }
    }

    let countdownInterval = null;
    let globalRemainingSeconds = 0;
    let globalAvgChunkTime = 0; // 🚀 Global storage for speed stats
    let showGraphInModal = true; // 🚀 Flag to toggle graph vs static summary

    function formatTime(totalSeconds) {
       if (totalSeconds <= 0) return '0s';
       const h = Math.floor(totalSeconds / 3600);
       const m = Math.floor((totalSeconds % 3600) / 60);
       const s = totalSeconds % 60;
       
       let res = '';
       if (h > 0) res += `${h}h `;
       if (m > 0) res += `${m}m `;
       if (s > 0 || res === '') res += `${s}s`;
       return res.trim();
    }

    function restoreExtractionSummaryUI() {
        showGraphInModal = false;
        document.getElementById('loader-spinner')?.remove(); // 🌪️ Remove active spinner if still present
        const resultModal = document.getElementById('completedExtractModal') || document.getElementById('liveExtractModal');
        if (resultModal) {
            resultModal.id = 'completedExtractModal';
            resultModal.style.background = '#f1f8e9';
            resultModal.style.borderColor = '#c5e1a3';
            resultModal.innerHTML = `
                  <div style="display:flex; align-items:center; justify-content:center; gap:10px; padding:2px 5px; font-family:sans-serif;">
                      <div style="font-size:13px; color:#333; font-weight:bold; display:flex; gap:8px;">
                         <span>Page: <span style="color:#1565c0;">${currentPageNum || '1'}</span></span>
                         <span style="opacity:0.3;">|</span>
                         <span>Lead: <span style="color:#d32f2f;">${accumulatedData ? accumulatedData.length : 0}</span></span>
                      </div>
                      <button id="clearExtDataBtn" title="Clear All Data" style="background:none; border:none; cursor:pointer; color:#d32f2f; font-size:16px; padding:2px; display:flex; align-items:center;">
                        <i class="fi fi-rr-trash"></i>
                      </button>
                  </div>
            `;
            // Re-attach clear event
            document.getElementById('clearExtDataBtn')?.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear all extracted data?')) {
                    accumulatedData = [];
                    tableData = [];
                    document.getElementById('completedExtractModal')?.remove();
                    document.getElementById('secActBtn')?.remove();
                    const actionUI = createButtonContainer();
                    document.getElementById('my-dashboard-popup')?.appendChild(actionUI);
                }
            });
        }
    }

    function updateProgress(percent, uploadedCount = 0, totalCount = 0, estSecondsLeft = null, currentLead = null, avgChunkTime = null, lastBatchTime = null, chunkHistory = [], chunkSize = 10, preChecked = false, totalEstSeconds = null) {
      if (avgChunkTime !== null) globalAvgChunkTime = avgChunkTime;
      
      // 🚀 Minimalist Interactive Line Graph
      const resultModal = document.getElementById('completedExtractModal') || document.getElementById('liveExtractModal');
      if (resultModal && chunkHistory && chunkHistory.length > 0 && totalCount > 0 && showGraphInModal) {
          const totalChunks = Math.ceil(totalCount / chunkSize);
          const maxVal = Math.max(...chunkHistory, 10); 
          const width = 280;
          const height = 70;
          
          const points = chunkHistory.map((h, i) => {
              const x = (i / (totalChunks - 1 || 1)) * width; 
              const y = height - (Math.min(h, maxVal) / maxVal) * height;
              return `${x},${y}`;
          }).join(' ');

          const currentX = ((chunkHistory.length - 1) / (totalChunks - 1 || 1)) * width;
          const fillPoints = `0,${height} ${points} ${currentX},${height}`;
          
          // Hover Points HTML
          const hoverPoints = chunkHistory.map((h, i) => {
              const x = (i / (totalChunks - 1 || 1)) * width;
              const y = height - (Math.min(h, maxVal) / maxVal) * height;
              return `<circle cx="${x}" cy="${y}" r="6" fill="transparent" class="graph-point" style="cursor:pointer;" title="Chunk ${i+1} | ${h}s">
                        <title>Chunk ${i+1}: ${h}s</title>
                      </circle>
                      <circle cx="${x}" cy="${y}" r="2" fill="#2196f3" class="graph-dot" style="pointer-events:none; opacity:0.6;" />`;
          }).join('');

          resultModal.innerHTML = `
            <div style="padding:15px 10px; font-family:sans-serif;">
                <div style="position:relative; width:${width}px; height:${height}px; background:transparent; overflow:visible; margin:0 auto; border:none;">
                    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow:visible;">
                        <defs>
                            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="#2196f3" />
                                <stop offset="100%" stop-color="#4caf50" />
                            </linearGradient>
                            <linearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stop-color="rgba(33, 150, 243, 0.12)" />
                                <stop offset="100%" stop-color="rgba(76, 175, 80, 0)" />
                            </linearGradient>
                        </defs>
                        <!-- Area -->
                        <polygon points="${fillPoints}" fill="url(#fillGrad)" style="transition: all 0.5s ease;" />
                        <!-- Line -->
                        <polyline points="${points}" fill="none" stroke="url(#lineGrad)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: all 0.5s ease;" />
                        
                        <!-- Interactivity Layers -->
                        ${hoverPoints}
                    </svg>
                </div>
                <div style="text-align:center; font-size:11px; color:#555; margin-top:10px; font-weight:bold; letter-spacing:0.5px; font-family:sans-serif;">
                    <span style="color:#1565c0;">LAST BATCH (#${chunkHistory.length}):</span> 
                    <span style="color:#2e7d32; padding:2px 6px; background:#e8f5e9; border-radius:5px;">${chunkHistory[chunkHistory.length-1]}s</span>
                </div>
            </div>
          `;
      }
      const inner = document.getElementById('progressInner');
      const progressText = document.getElementById('uploadProgressText');
      const estTimeText = document.getElementById('estTimeText');
      const summaryDiv = document.getElementById('uploadSummaryDiv');
      const leadInfo = document.getElementById('currentLeadInfo');

      // 🏠 Update Live Lead Info
      if (leadInfo && currentLead) {
          const keys = Object.keys(currentLead);
          
          // 🔎 Prioritize the exact headers from your data schema
          const proposalKey = keys.find(k => k === 'PROPOSAL_NO.' || k.includes('PROPOSAL')) || keys[0];
          const nameKey = keys.find(k => k === 'CUSTOMER_NAME' || (k.includes('CUSTOMER') && k.includes('NAME'))) || keys[1];
          
          const pNo = currentLead[proposalKey] || '-';
          const cName = currentLead[nameKey] || '-';
          
          leadInfo.innerHTML = `<span style="color:#0065b3;">${pNo}</span> &nbsp;|&nbsp; <span style="color:#616161;">${cName}</span>`;
      }

      if (estSecondsLeft !== null) {
         globalRemainingSeconds = estSecondsLeft;
         const totalText = totalEstSeconds ? ` (Total: ${formatTime(totalEstSeconds)})` : '';
         const speedText = lastBatchTime ? ` | Batch: ${(lastBatchTime/1000).toFixed(1)}s` : '';
         if (estTimeText) estTimeText.innerText = `Estimated Time: ${formatTime(globalRemainingSeconds)}${totalText}${speedText}`;
         
         const resumeBtn = document.getElementById('resumeUploadBtn');
         const isPaused = resumeBtn && resumeBtn.style.display !== 'none';

         if (countdownInterval) clearInterval(countdownInterval);
         
         if (!isPaused && isAutoSyncRunning) {
             countdownInterval = setInterval(() => {
                if (globalRemainingSeconds > 0 && isAutoSyncRunning) {
                   globalRemainingSeconds--;
                   if (estTimeText) { 
                       estTimeText.innerText = `Estimated Time: ${formatTime(globalRemainingSeconds)}${totalText}${speedText}`;
                       updateMinimizedStatus();
                   }
                } else {
                   clearInterval(countdownInterval);
                }
             }, 1000);
         }
      }
      
      if (progressText && totalCount > 0) {
        progressText.innerText = `Total Leads: ${totalCount} | Uploaded: ${uploadedCount} | ${percent}%`;
        
        // If summary is currently showing (e.g. paused) and isn't showing an error, update it too
        if (summaryDiv && summaryDiv.style.display !== 'none' && !summaryDiv.innerHTML.includes('Error')) {
          summaryDiv.innerText = `Paused.\nTotal Leads: ${totalCount}\nUploaded: ${uploadedCount}`;
        }
      }

      // 🚀 ALWAYS UPDATE MINIMIZED BAR IF ACTIVE
      updateMinimizedStatus();

      if (inner) {
          inner.style.width = percent + '%';
      }

      // 🏁 Completion Logic (STRICT CHECK)
      if (percent >= 100 && uploadedCount === totalCount && totalCount > 0) {
          isAutoSyncRunning = false; // 🚀 Officially Finished
          updateMinimizedStatus(); // 🔄 Reset UI
          showGraphInModal = false; // Reset for next run
          
          const buttonContainer = document.getElementById('secActBtn');
          if (buttonContainer) buttonContainer.style.display = 'block';

          // 🧹 ALWAYS Cleanup Spinners on Success
          document.querySelectorAll('#loader-spinner').forEach(s => s.remove());

          // 🚀 Success Message update
          setTimeout(() => {
              const messageDiv = document.getElementById('messageDiv');
              if (messageDiv) {
                  messageDiv.innerHTML = '';
                  const successDiv = document.createElement('div');
                  successDiv.style.width = '100%';
                  successDiv.style.height = '100%';
                  successDiv.style.display = 'flex';
                  successDiv.style.flexDirection = 'column';
                  successDiv.style.alignItems = 'center';
                  successDiv.style.justifyContent = 'center';
                  successDiv.style.fontFamily = 'Arial, sans-serif';
    
            // Animated check icon
            const checkIcon = document.createElement('i');
            checkIcon.className = 'fi flex fi-br-check animated-check'; // Added flex class
            checkIcon.style.fontSize = '28px';
    
            // Inject animation CSS once
            if (!document.getElementById('check-style')) {
              const style = document.createElement('style');
              style.id = 'check-style';
              style.innerHTML = `
                @keyframes bounce {
                  0%, 100% { transform: scale(1); }
                  50% { transform: scale(1.2); }
                }
                .animated-check {
                  animation: bounce 1s ease-in-out infinite;
                  font-size: 48px;
                  color: #4caf50;
                }
              `;
              document.head.appendChild(style);
            }
    
            const messageText = document.createElement('p');
            messageText.innerText = preChecked ? 'Already Uploaded' : 'Upload Successful';
            messageText.style.fontSize = '20px';
            messageText.style.color = preChecked ? '#e67e22' : '#f1c40f';
            messageText.style.fontWeight = 'bold';
            messageText.style.margin = '10px 0 5px 0';
            successDiv.appendChild(messageText);

            // 🚀 Stats display
            const syncDuration = syncStartTime ? (Date.now() - syncStartTime) : 0;
            const timeTaken = formatTime(Math.round(syncDuration / 1000));
            const subText = document.createElement('p');
            subText.innerHTML = preChecked ? `All ${totalCount} records confirmed.` : `Leads: ${totalCount} | Time: ${timeTaken} | Avg: ${globalAvgChunkTime}s`;
            subText.style.fontSize = '12px';
            subText.style.color = '#666';
            subText.style.margin = '0';
            // Construct UI
            successDiv.appendChild(checkIcon);
            successDiv.appendChild(messageText);
            successDiv.appendChild(subText);
            messageDiv.appendChild(successDiv);

            // 🧹 Cleanup: Remove any remaining spinners
            document.querySelectorAll('#loader-spinner').forEach(s => s.remove());
          }
        }, 600); 
    }
}
    
    
    

    
      
    // ====== TABLE RENDERING ======

    const renderExtractedTable = () => {
      const messageDiv = document.getElementById('messageDiv');
      if (!messageDiv) {
        console.warn('messageDiv not found!');
        return;
      }
    
      messageDiv.innerHTML = ''; // Clear existing content
    
      // Create and append style if not already present
      if (!document.getElementById('customTableStyle')) {
        const style = document.createElement('style');
        style.id = 'customTableStyle';
        style.textContent = `
          @import url('https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap');
          .custom-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px !important;  
            font-family: 'Roboto', sans-serif;
            position: relative;
          }
          .custom-table th, .custom-table td {
            padding: 8px 10px;
            text-align: center;
            font-style: italic;
            white-space: nowrap;
            border-bottom: 1px solid #bcbcbc;
            color:rgb(114, 114, 114);
          }
          .custom-table th {
            background: #0065b3;
            color: #fff;
            font-weight: bold;
            position: sticky;
            top: 0;
            z-index: 1;
          }
          #dataTable {
            max-height: 300px;
            overflow: auto;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
          }
          #dataTable::-webkit-scrollbar {
            display: none; /* Chrome, Safari */
          }
        `;
        document.head.appendChild(style);
      }
    
      // Create inner container
      const container = document.createElement('div');
      container.id = 'dataTable';
      container.style.overflow = 'auto';
      container.style.maxHeight = '300px';
      messageDiv.appendChild(container);
      messageDiv.style.display = 'block';
    
      if (!Array.isArray(accumulatedData) || accumulatedData.length === 0) {
        container.textContent = 'No data available.';
        return;
      }
    
      // Determine valid keys (remove keys with all undefined values or that are themselves undefined)
      const validKeys = Object.keys(accumulatedData[0]).filter(key =>
        key !== 'undefined' &&
        accumulatedData.some(row => row[key] !== undefined && row[key] !== null)
      );
    
      // Build the table
      const table = document.createElement('table');
      table.className = 'custom-table';
    
      // Build thead
      const thead = document.createElement('thead');
      const headerRow = document.createElement('tr');
    
      // Add Sno. header
      const snoTh = document.createElement('th');
      snoTh.textContent = 'Sno.';
      headerRow.appendChild(snoTh);
    
      // Add other valid headers
      validKeys.forEach(key => {
        const th = document.createElement('th');
        th.textContent = key.replace(/_/g, ' ');
        headerRow.appendChild(th);
      });
    
      thead.appendChild(headerRow);
      table.appendChild(thead);
    
      // Build tbody
      const tbody = document.createElement('tbody');
      accumulatedData.forEach((row, index) => {
        const tr = document.createElement('tr');
    
        // Add serial number
        const snoTd = document.createElement('td');
        snoTd.textContent = index + 1;
        tr.appendChild(snoTd);
    
        // Add valid data cells
        validKeys.forEach(key => {
          const td = document.createElement('td');
          td.textContent = row[key] ?? ''; // fallback to empty string
          tr.appendChild(td);
        });
    
        tbody.appendChild(tr);
      });
    
      table.appendChild(tbody);
      container.appendChild(table);
    };


    // 📢 Banner & Backdrop Cleaner (Continuous Watcher)
    let globalCleanerActive = false;
    const startGlobalCleaner = () => {
        if (globalCleanerActive) return;
        globalCleanerActive = true;
        
        const observer = new MutationObserver(() => {
            // Clean banners
            const banner = document.getElementById('myBannersModal');
            if (banner) {
                const btn = banner.querySelector('button.close[data-bs-dismiss="modal"]');
                if (btn && banner.style.display !== 'none') {
                    console.log('📢 Mutation: Banner detected. Closing...');
                    btn.click();
                }
            }
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
    };


  
    // 🎮 Game Overlay Variables
    let isExtractionPhaseDone = false;
    let extractionOverlayEl = null;
    let tttBoard = Array(9).fill(null);
    let tttCurrentTurn = 'X'; // Symbol that moves next
    let tttHumanSymbol = 'X'; 
    let tttComputerSymbol = 'O';
    let tttGameCount = 0; // 📉 Track games to prevent 1st match human win
    let tttIsBotDumbThisMatch = false; // 🤖 Match-level difficulty flag

    // 🎵 Synthesized Web Audio API sound effects for mini games
    const playGameSound = (type) => {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            const now = ctx.currentTime;
            if (type === 'X') {
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'O') {
                osc.frequency.setValueAtTime(600, now);
                osc.frequency.exponentialRampToValueAtTime(300, now + 0.1);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
            } else if (type === 'win') {
                osc.frequency.setValueAtTime(523.25, now);
                osc.frequency.setValueAtTime(659.25, now + 0.1);
                osc.frequency.setValueAtTime(783.99, now + 0.2);
                gain.gain.setValueAtTime(0.2, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
                osc.start(now);
                osc.stop(now + 0.35);
            } else if (type === 'draw') {
                osc.frequency.setValueAtTime(300, now);
                osc.frequency.linearRampToValueAtTime(150, now + 0.2);
                gain.gain.setValueAtTime(0.15, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
            }
        } catch (e) {}
    };

    // 🐦 Bird Game Variables
    let isBirdPlaying = false;
    let birdCanvas = null;
    let birdCtx = null;
    let birdAnimationId = null;
    let birdY = 200;
    let birdV = 0;
    const birdG = 0.25;
    const birdJump = -4.5;
    const birdRadius = 12;
    let obstacles = [];
    let birdScore = 0;
    let birdFrameCount = 0;
    let startBirdGame = null;

    const handleJump = (e) => {
        const container = document.getElementById('bird-game-container');
        if (!container || container.style.display === 'none') return;

        if (!isBirdPlaying) {
            if (e.type === 'keydown' && e.code !== 'Space') return;
            if (e.type === 'keydown') e.preventDefault();
            if (typeof startBirdGame === 'function') startBirdGame();
            return;
        }
        if (e.type === 'keydown' && e.code !== 'Space') return;
        if (e.type === 'keydown') e.preventDefault(); // prevent scrolling
        birdV = birdJump;
    };

    const removeExtractionOverlay = (force = false) => {
        chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
            const isMasterMode = !!(res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused);
            
            // 🔒 In Master Mode, NEVER remove the Master Overlay for any step unless forced
            if (isMasterMode && !force) {
                console.log('🤖 Autopilot: Master Mode active. Overlay removal skipped to keep Master Overlay all-time active.');
                return;
            }

            if (extractionOverlayEl) {
                window.removeEventListener('keydown', handleJump);
                isBirdPlaying = false;
                if (birdAnimationId) cancelAnimationFrame(birdAnimationId);
                extractionOverlayEl.style.opacity = '0';
                setTimeout(() => {
                    extractionOverlayEl?.remove();
                    extractionOverlayEl = null;
                }, 500);
            }
        });
    };

    const createExtractionOverlay = () => {
        if (extractionOverlayEl) return;
        isExtractionPhaseDone = false;
        isGamePlaying = false;
        isBirdPlaying = false;
        tttBoard = Array(9).fill(null);

        const overlay = document.createElement('div');
        overlay.id = 'extraction-game-overlay';
        extractionOverlayEl = overlay;

        chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused', 'autopilot_agents', 'autopilot_index'], (res) => {
            if (!extractionOverlayEl || extractionOverlayEl !== overlay) return;

            const isMasterMode = !!(res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused);

            if (isMasterMode) {
                // 👑 MASTER MODE: Light Bright Frosted Glassy Overlay with macOS Browser Window Card
                Object.assign(overlay.style, {
                    position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                    backgroundColor: 'rgba(255, 255, 255, 0.35)',
                    backdropFilter: 'blur(8px) saturate(120%)',
                    webkitBackdropFilter: 'blur(8px) saturate(120%)',
                    zIndex: '10001', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#0f172a',
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                    transition: 'all 0.4s ease', opacity: '1'
                });

                let currentAgentName = '';
                if (res.autopilot_agents && res.autopilot_agents.length > 0) {
                    const idx = res.autopilot_index || 0;
                    const agentObj = res.autopilot_agents[idx % res.autopilot_agents.length];
                    if (agentObj && (agentObj.name || agentObj.email)) {
                        currentAgentName = agentObj.name || agentObj.email;
                    }
                }

                const savedOpacityStr = localStorage.getItem('master_overlay_opacity');
                const savedOpacity = savedOpacityStr !== null ? parseInt(savedOpacityStr, 10) : 100;

                const agentInfoHtml = currentAgentName 
                    ? `<div style="margin-top: 10px; font-size: 12px; color: #475569; font-weight: 500; display: inline-flex; align-items: center; gap: 6px; background: rgba(241, 245, 249, 0.85); padding: 4px 14px; border-radius: 20px; border: 1px solid #e2e8f0;">
                         <span>Active Profile:</span> <strong style="color: #1e40af;">${currentAgentName}</strong>
                       </div>` 
                    : '';

                overlay.innerHTML = `
                    <!-- macOS Dialog Window -->
                    <div class="mac-dialog-window" style="
                        width: 90%;
                        max-width: 520px;
                        background: rgba(255, 255, 255, 0.96);
                        backdrop-filter: blur(25px);
                        -webkit-backdrop-filter: blur(25px);
                        border-radius: 16px;
                        border: 1px solid rgba(255, 255, 255, 0.9);
                        box-shadow: 0 30px 60px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.08);
                        overflow: hidden;
                        animation: macWindowPop 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                        text-align: left;
                        transition: opacity 0.2s ease;
                    ">
                        <!-- macOS Title Bar -->
                        <div style="
                            height: 42px;
                            background: linear-gradient(180deg, #f8f9fa 0%, #e9ecef 100%);
                            border-bottom: 1px solid #dee2e6;
                            display: flex;
                            align-items: center;
                            padding: 0 16px;
                            position: relative;
                            user-select: none;
                        ">
                            <!-- Traffic Light Control Buttons -->
                            <div style="display: flex; align-items: center; gap: 8px; position: absolute; left: 16px;">
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: #ff5f56; border: 0.5px solid #e0443e; box-shadow: inset 0 1px 1px rgba(0,0,0,0.1);"></div>
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: #ffbd2e; border: 0.5px solid #dea123; box-shadow: inset 0 1px 1px rgba(0,0,0,0.1);"></div>
                                <div style="width: 12px; height: 12px; border-radius: 50%; background: #27c93f; border: 0.5px solid #1aab29; box-shadow: inset 0 1px 1px rgba(0,0,0,0.1);"></div>
                            </div>

                            <!-- Mac Address Pill -->
                            <div style="
                                margin: 0 auto;
                                background: #ffffff;
                                border: 1px solid #ced4da;
                                border-radius: 7px;
                                padding: 4px 16px;
                                font-size: 11.5px;
                                font-weight: 600;
                                color: #495057;
                                display: flex;
                                align-items: center;
                                gap: 6px;
                                box-shadow: inset 0 1px 2px rgba(0,0,0,0.03);
                                letter-spacing: 0.2px;
                            ">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                                </svg>
                                <span>master.extension // security-controlled</span>
                            </div>
                        </div>

                        <!-- Card Body -->
                        <div style="padding: 32px 28px 26px 28px; text-align: center; color: #1e293b;">
                            <!-- Shield Icon Badge -->
                            <div style="position: relative; display: inline-block; margin-bottom: 20px;">
                                <div style="
                                    width: 72px;
                                    height: 72px;
                                    border-radius: 22px;
                                    background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%);
                                    display: flex;
                                    align-items: center;
                                    justify-content: center;
                                    margin: 0 auto;
                                    box-shadow: 0 12px 25px -6px rgba(37, 99, 235, 0.45);
                                ">
                                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
                                        <path d="m9 12 2 2 4-4"></path>
                                    </svg>
                                </div>
                                <div style="
                                    position: absolute;
                                    top: -5px; left: -5px; right: -5px; bottom: -5px;
                                    border-radius: 26px;
                                    border: 2px solid rgba(59, 130, 246, 0.4);
                                    animation: masterPulseRing 2s infinite ease-in-out;
                                    pointer-events: none;
                                "></div>
                            </div>

                            <!-- Header -->
                            <h2 style="
                                margin: 0 0 10px 0;
                                font-size: 20px;
                                font-weight: 750;
                                color: #0f172a;
                                letter-spacing: -0.4px;
                                line-height: 1.35;
                            ">
                                This site is controlled by Master Extension
                            </h2>

                            <!-- Description -->
                            <p style="
                                margin: 0 0 16px 0;
                                font-size: 13.5px;
                                line-height: 1.6;
                                color: #64748b;
                                max-width: 430px;
                                margin-left: auto;
                                margin-right: auto;
                            ">
                                Automated data extraction & autopilot sequence is actively running in this browser window. Please do not close or navigate away from this tab.
                            </p>

                            ${agentInfoHtml}

                            <!-- Live Status Badge -->
                            <div style="margin-top: 18px;">
                                <div style="
                                    display: inline-flex;
                                    align-items: center;
                                    gap: 10px;
                                    background: #f0fdf4;
                                    border: 1px solid #bbf7d0;
                                    padding: 9px 20px;
                                    border-radius: 30px;
                                    color: #15803d;
                                    font-size: 13px;
                                    font-weight: 600;
                                    box-shadow: 0 2px 6px rgba(34, 197, 94, 0.08);
                                ">
                                    <span style="
                                        width: 9px;
                                        height: 9px;
                                        border-radius: 50%;
                                        background: #22c55e;
                                        box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.25);
                                        animation: statusPulseDot 1.5s infinite;
                                    "></span>
                                    <span>Master Autopilot Active &bull; Syncing System Data</span>
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div style="
                            background: #f8fafc;
                            border-top: 1px solid #e2e8f0;
                            padding: 12px 20px;
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            font-size: 11.5px;
                            color: #94a3b8;
                            font-weight: 500;
                        ">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="width: 6px; height: 6px; border-radius: 50%; background: #2563eb; display: inline-block;"></span>
                                <span>Protected Master Session</span>
                            </div>
                            <span>Faveo Care Extension</span>
                        </div>
                    </div>

                    <!-- 🔘 Trigger Tooltip Button (Fixed on LEFT Screen Edge) -->
                    <button id="overlay-sidebar-toggle-btn" title="Glass Visibility Controls" style="
                        position: fixed;
                        left: 0;
                        top: 50%;
                        transform: translateY(-50%);
                        z-index: 10006;
                        background: rgba(255, 255, 255, 0.95);
                        backdrop-filter: blur(15px);
                        -webkit-backdrop-filter: blur(15px);
                        border: 1px solid rgba(226, 232, 240, 0.9);
                        border-left: none;
                        border-radius: 0 12px 12px 0;
                        padding: 10px 7px;
                        box-shadow: 4px 0 15px rgba(0, 0, 0, 0.15);
                        cursor: pointer;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 4px;
                        color: #2563eb;
                        transition: transform 0.3s ease, opacity 0.3s ease;
                        pointer-events: auto !important;
                    ">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                        <span style="writing-mode: vertical-rl; text-orientation: mixed; font-size: 9px; font-weight: 700; letter-spacing: 1px; color: #475569; text-transform: uppercase;">GLASS</span>
                    </button>

                    <!-- 🎛️ Fixed-Width Auto-Hiding Glass Visibility Sidebar (Left Side with 10px Gap) -->
                    <div id="overlay-sidebar-control" style="
                        position: fixed;
                        left: 10px;
                        top: 50%;
                        transform: translateY(-50%) translateX(-140%);
                        width: 60px;
                        z-index: 10005;
                        background: rgba(255, 255, 255, 0.96);
                        backdrop-filter: blur(20px);
                        -webkit-backdrop-filter: blur(20px);
                        border-radius: 16px;
                        border: 1px solid rgba(255, 255, 255, 0.9);
                        box-shadow: 0 15px 35px -5px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
                        padding: 14px 8px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 10px;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        user-select: none;
                        box-sizing: border-box;
                        opacity: 0;
                        pointer-events: none;
                        transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
                    ">
                        <!-- Header Icon -->
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 3px; color: #1e293b;">
                            <div style="
                                width: 30px; height: 30px; border-radius: 9px;
                                background: linear-gradient(135deg, #2563eb, #3b82f6);
                                display: flex; align-items: center; justify-content: center;
                                color: #fff; box-shadow: 0 3px 8px rgba(37, 99, 235, 0.3);
                            ">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"></path>
                                    <circle cx="12" cy="12" r="3"></circle>
                                </svg>
                            </div>
                        </div>

                        <!-- Value Badge -->
                        <span id="glassOpacityVal" style="
                            font-size: 11px; font-weight: 800; color: #1e40af; background: #eff6ff;
                            padding: 2px 6px; border-radius: 8px; border: 1px solid #bfdbfe;
                            min-width: 34px; text-align: center;
                        ">${savedOpacity}%</span>

                        <!-- Vertical Range Slider -->
                        <div style="height: 100px; display: flex; align-items: center; justify-content: center; padding: 2px 0;">
                            <input type="range" id="glassOpacitySlider" min="0" max="100" value="${savedOpacity}" style="
                                writing-mode: bt-lr;
                                -webkit-appearance: slider-vertical;
                                width: 8px;
                                height: 90px;
                                cursor: pointer;
                                accent-color: #2563eb;
                            ">
                        </div>

                        <!-- Presets -->
                        <div style="display: flex; flex-direction: column; gap: 4px; width: 100%;">
                            <button id="preset100Btn" style="
                                border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-size: 9px; font-weight: 700;
                                padding: 3px 4px; border-radius: 5px; cursor: pointer; transition: all 0.15s; width: 100%;
                            " title="Full Glass Opacity">100%</button>
                            <button id="preset0Btn" style="
                                border: 1px solid #cbd5e1; background: #f8fafc; color: #334155; font-size: 9px; font-weight: 700;
                                padding: 3px 4px; border-radius: 5px; cursor: pointer; transition: all 0.15s; width: 100%;
                            " title="0% Glass Opacity (Transparent Background)">0%</button>
                        </div>
                    </div>

                    <style>
                        @keyframes macWindowPop {
                            from { opacity: 0; transform: scale(0.92) translateY(12px); }
                            to { opacity: 1; transform: scale(1) translateY(0); }
                        }
                        @keyframes masterPulseRing {
                            0% { transform: scale(0.97); opacity: 0.8; }
                            50% { transform: scale(1.06); opacity: 0.15; }
                            100% { transform: scale(0.97); opacity: 0.8; }
                        }
                        @keyframes statusPulseDot {
                            0%, 100% { opacity: 1; transform: scale(1); }
                            50% { opacity: 0.35; transform: scale(0.8); }
                        }
                    </style>
                `;

                // 🎛️ Bind Glass Visibility Slider & Auto-Hide Control Logic
                setTimeout(() => {
                    const toggleBtn = overlay.querySelector('#overlay-sidebar-toggle-btn');
                    const sidebar = overlay.querySelector('#overlay-sidebar-control');
                    const slider = overlay.querySelector('#glassOpacitySlider');
                    const valLabel = overlay.querySelector('#glassOpacityVal');
                    const preset100 = overlay.querySelector('#preset100Btn');
                    const preset0 = overlay.querySelector('#preset0Btn');
                    const mainCard = overlay.querySelector('.mac-dialog-window');

                    let autoHideTimer = null;
                    let isSidebarOpen = false;

                    const hideSidebar = () => {
                        if (!sidebar) return;
                        sidebar.style.transform = 'translateY(-50%) translateX(-140%)';
                        sidebar.style.opacity = '0';
                        sidebar.style.pointerEvents = 'none';
                        isSidebarOpen = false;
                        if (autoHideTimer) clearTimeout(autoHideTimer);

                        // Show trigger tooltip button when sidebar hides
                        if (toggleBtn) {
                            toggleBtn.style.opacity = '1';
                            toggleBtn.style.pointerEvents = 'auto';
                            toggleBtn.style.transform = 'translateY(-50%) translateX(0)';
                        }
                    };

                    const showSidebar = () => {
                        if (!sidebar) return;
                        sidebar.style.transform = 'translateY(-50%) translateX(0)';
                        sidebar.style.opacity = '1';
                        sidebar.style.pointerEvents = 'auto';
                        isSidebarOpen = true;

                        // Hide trigger tooltip button when sidebar shows
                        if (toggleBtn) {
                            toggleBtn.style.opacity = '0';
                            toggleBtn.style.pointerEvents = 'none';
                            toggleBtn.style.transform = 'translateY(-50%) translateX(-100%)';
                        }
                        resetAutoHideTimer();
                    };

                    const resetAutoHideTimer = () => {
                        if (autoHideTimer) clearTimeout(autoHideTimer);
                        if (isSidebarOpen) {
                            autoHideTimer = setTimeout(() => {
                                hideSidebar();
                            }, 5000); // 5 seconds inactivity auto-hide
                        }
                    };

                    if (toggleBtn) {
                        toggleBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            if (isSidebarOpen) hideSidebar();
                            else showSidebar();
                        });
                    }

                    if (sidebar) {
                        sidebar.addEventListener('mouseenter', () => {
                            if (autoHideTimer) clearTimeout(autoHideTimer);
                        });
                        sidebar.addEventListener('mouseleave', () => {
                            resetAutoHideTimer();
                        });
                        sidebar.addEventListener('mousemove', () => {
                            resetAutoHideTimer();
                        });
                    }

                    const updateOverlayOpacity = (value) => {
                        const numericVal = parseInt(value, 10);
                        const alpha = numericVal / 100;
                        
                        if (valLabel) valLabel.innerText = numericVal + '%';
                        if (slider) slider.value = numericVal;

                        // 🛡️ Mac browser dialog window is NOT impacted - stays 100% visible
                        if (mainCard) {
                            mainCard.style.opacity = '1';
                        }
                        
                        // 🪟 ONLY background glass backdrop & blur are controlled by the slider
                        overlay.style.backgroundColor = `rgba(255, 255, 255, ${0.35 * alpha})`;
                        overlay.style.backdropFilter = numericVal === 0 ? 'none' : `blur(${8 * alpha}px) saturate(${100 + 20 * alpha}%)`;
                        overlay.style.webkitBackdropFilter = numericVal === 0 ? 'none' : `blur(${8 * alpha}px) saturate(${100 + 20 * alpha}%)`;

                        localStorage.setItem('master_overlay_opacity', numericVal);
                        resetAutoHideTimer();
                    };

                    updateOverlayOpacity(savedOpacity);

                    if (slider) {
                        slider.addEventListener('input', (e) => updateOverlayOpacity(e.target.value));
                    }
                    if (preset100) {
                        preset100.addEventListener('click', () => updateOverlayOpacity(100));
                    }
                    if (preset0) {
                        preset0.addEventListener('click', () => updateOverlayOpacity(0));
                    }
                }, 0);
            } else {
                // 🎮 STANDARD MODE: Interactive Mini Games (Tic-Tac-Toe & Bird Game)
                Object.assign(overlay.style, {
                    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(10px)',
                    zIndex: '10001', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', color: '#fff',
                    fontFamily: 'sans-serif', transition: 'all 0.5s ease', opacity: '1'
                });

                overlay.innerHTML = `
                    <div id="ttt-intro-box" style="text-align:center; max-width:400px; padding:20px; animation:fadeIn 0.8s ease;">
                        <div style="display:flex; justify-content:center; gap:8px; margin-bottom:20px;">
                            <div style="width:12px; height:12px; border-radius:50%; background:#e3f2fd; animation:dot-dance 1.4s infinite ease-in-out both;"></div>
                            <div style="width:12px; height:12px; border-radius:50%; background:#e3f2fd; animation:dot-dance 1.4s infinite ease-in-out both; animation-delay: 0.2s;"></div>
                            <div style="width:12px; height:12px; border-radius:50%; background:#e3f2fd; animation:dot-dance 1.4s infinite ease-in-out both; animation-delay: 0.4s;"></div>
                        </div>
                        <p style="font-size:16px; line-height:1.6; color:rgba(255,255,255,0.9); margin-bottom:25px;">
                            Sorry for the inconvenience, this scanning process will take a short amount of time. 
                            Want to play a quick game while we work?
                        </p>
                        <div style="display:flex; gap:12px; justify-content:center; flex-wrap:wrap;">
                          <button id="start-ttt-btn" style="
                              padding:10px 20px; border:none; border-radius:30px; 
                              background: linear-gradient(135deg, #00c853, #64dd17); 
                              color:#fff; font-weight:bold; font-size:14px; cursor:pointer; 
                              box-shadow: 0 4px 15px rgba(0,200,83,0.3); transition: transform 0.2s;">
                              Play Tic-Tac-Toe
                          </button>
                          <button id="start-bird-btn" style="
                              padding:10px 20px; border:none; border-radius:30px; 
                              background: linear-gradient(135deg, #ff9100, #ffab40); 
                              color:#fff; font-weight:bold; font-size:14px; cursor:pointer; 
                              box-shadow: 0 4px 15px rgba(255,145,0,0.3); transition: transform 0.2s;">
                              Play Bird Game
                          </button>
                          <button id="start-cricket-btn" style="
                              padding:10px 20px; border:none; border-radius:30px; 
                              background: linear-gradient(135deg, #0288d1, #00bcd4); 
                              color:#fff; font-weight:bold; font-size:14px; cursor:pointer; 
                              box-shadow: 0 4px 15px rgba(2,136,209,0.3); transition: transform 0.2s;">
                              🏏 Cricket Doodle
                          </button>
                        </div>
                    </div>
                    
                    <div id="ttt-game-container" style="display:none; text-align:center; animation:zoomIn 0.5s ease;">
                        <h3 id="ttt-status" style="margin-bottom:20px; color:#e3f2fd;">Your Turn (X)</h3>
                        <div id="ttt-grid-wrapper" style="position:relative; display:inline-block;">
                            <div id="ttt-grid" style="
                                display:grid; grid-template-columns: repeat(3, 100px); 
                                grid-template-rows: repeat(3, 100px); gap:10px; 
                                background:rgba(255,255,255,0.1); padding:10px; border-radius:15px;
                                border: 2px solid rgba(255,255,255,0.2);">
                                ${Array(9).fill(0).map((_, i) => '<div class="ttt-cell" data-index="' + i + '" style="width:100px; height:100px; background:rgba(255,255,255,0.05); border-radius:10px; display:flex; align-items:center; justify-content:center; font-size:40px; font-weight:bold; cursor:pointer; transition:0.2s;"></div>').join('')}
                            </div>
                            <!-- ✍️ Winning Line -->
                            <div id="ttt-win-line" style="
                                position:absolute; background:#fff; height:6px; border-radius:3px;
                                display:none; pointer-events:none; transition: width 0.5s ease, opacity 0.3s;
                                box-shadow: 0 0 15px #fff, 0 0 30px #4fc3f7; z-index:10; transform-origin: left center;">
                            </div>
                        </div>
                        <div id="ttt-msg" style="margin-top:20px; font-weight:bold; min-height:60px;"></div>
                        <button id="back-ttt-btn" style="
                            margin-top:15px; padding:8px 22px; border:none; border-radius:20px; 
                            background:rgba(255,255,255,0.2); color:#fff; font-weight:bold; font-size:12px; cursor:pointer; 
                            transition:background 0.2s;">
                            Back to Menu
                        </button>
                    </div>

                    <div id="bird-game-container" style="display:none; text-align:center; animation:zoomIn 0.5s ease;">
                        <h3 id="bird-status" style="margin-bottom:10px; color:#e3f2fd;">Press SPACE or Click Canvas to Fly</h3>
                        <div style="position:relative; display:inline-block; background:#70c5ce; border:4px solid #fff; border-radius:15px; overflow:hidden;">
                            <canvas id="bird-canvas" width="320" height="400" style="display:block; cursor:pointer;"></canvas>
                        </div>
                        <div id="bird-msg" style="margin-top:15px; font-weight:bold; min-height:40px; color:#fff; font-size:16px;">Score: 0</div>
                        <div style="display:flex; gap:10px; justify-content:center; margin-top:10px;">
                            <button id="restart-bird-btn" style="
                                display:none; padding:8px 20px; border:none; border-radius:20px; 
                                background:#fff; color:#ff9100; font-weight:bold; cursor:pointer; font-size:14px;
                                box-shadow:0 4px 10px rgba(0,0,0,0.2);">
                                Play Again
                            </button>
                            <button id="back-bird-btn" style="
                                padding:8px 20px; border:none; border-radius:20px; 
                                background:rgba(255,255,255,0.2); color:#fff; font-weight:bold; font-size:12px; cursor:pointer; 
                                transition:background 0.2s;">
                                Back to Menu
                            </button>
                        </div>
                    </div>

                    <div id="cricket-game-container" style="display:none; text-align:center; animation:zoomIn 0.5s ease;">
                        <h3 id="cricket-status" style="margin-bottom:10px; color:#e3f2fd;">🏏 Tap/Click or Press SPACE to Swing Bat!</h3>
                        <div style="position:relative; display:inline-block; background:#388e3c; border:4px solid #fff; border-radius:15px; overflow:hidden; box-shadow:0 10px 30px rgba(0,0,0,0.4);">
                            <canvas id="cricket-canvas" width="560" height="360" style="display:block; cursor:pointer;"></canvas>
                        </div>
                        <div id="cricket-msg" style="margin-top:10px; font-weight:bold; min-height:30px; color:#fff; font-size:16px;">Score: 0 | Wickets: 0/3</div>
                        <div style="display:flex; gap:10px; justify-content:center; margin-top:8px;">
                            <button id="hit-cricket-btn" style="
                                padding:8px 25px; border:none; border-radius:20px; 
                                background:linear-gradient(135deg, #ffeb3b, #fbc02d); color:#333; font-weight:bold; cursor:pointer; font-size:14px;
                                box-shadow:0 4px 10px rgba(0,0,0,0.2);">
                                🏏 HIT BAT
                            </button>
                            <button id="restart-cricket-btn" style="
                                display:none; padding:8px 20px; border:none; border-radius:20px; 
                                background:#fff; color:#0288d1; font-weight:bold; cursor:pointer; font-size:14px;
                                box-shadow:0 4px 10px rgba(0,0,0,0.2);">
                                Play Again
                            </button>
                            <button id="back-cricket-btn" style="
                                padding:8px 20px; border:none; border-radius:20px; 
                                background:rgba(255,255,255,0.2); color:#fff; font-weight:bold; font-size:12px; cursor:pointer; 
                                transition:background 0.2s;">
                                Back to Menu
                            </button>
                        </div>
                    </div>

                    <style>
                        @keyframes fadeIn { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
                        @keyframes zoomIn { from { transform: scale(0.8); opacity:0; } to { transform: scale(1); opacity:1; } }
                        @keyframes dot-dance { 0%, 80%, 100% { transform: scale(0); opacity: 0.3; } 40% { transform: scale(1); opacity: 1; } }
                        @keyframes glitter-fall { 0% { transform: translateY(-50px) rotate(0deg); opacity: 1; } 100% { transform: translateY(600px) rotate(720deg); opacity: 0; } }
                        @keyframes win-scale { 0% { transform: scale(1); } 50% { transform: scale(1.2); } 100% { transform: scale(1); } }
                        .ttt-cell:hover { background: rgba(255,255,255,0.15) !important; transform: scale(0.95); }
                        .ttt-cell.taken { cursor: default; }
                        .ttt-celebration-text { animation: win-scale 1s infinite ease-in-out; font-size: 24px; text-shadow: 0 0 10px rgba(255,255,255,0.5); }
                        .glitter { position: fixed; width: 10px; height: 10px; pointer-events: none; z-index: 10005; animation: glitter-fall 2s ease-out forwards; }
                        #close-overlay-btn:hover { color: #fff !important; transform: scale(1.1); }
                    </style>
                `;

                const determineFirstTurn = () => {
                    tttBoard = Array(9).fill(null);
                    const cells = overlay.querySelectorAll('.ttt-cell');
                    cells.forEach(c => {
                        c.innerText = '';
                        c.classList.remove('taken');
                    });
                    const msgEl = overlay.querySelector('#ttt-msg');
                    if (msgEl) msgEl.innerHTML = '';
                    const winLine = overlay.querySelector('#ttt-win-line');
                    if (winLine) winLine.style.display = 'none';

                    tttHumanSymbol = 'X';
                    tttComputerSymbol = 'O';

                    const statusTxt = overlay.querySelector('#ttt-status');
                    tttCurrentTurn = 'X';
                    if (statusTxt) statusTxt.innerText = "Your Turn ('X')";
                };

                const startBtn = overlay.querySelector('#start-ttt-btn');
                if (startBtn) {
                    startBtn.addEventListener('click', () => {
                        isGamePlaying = true;
                        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                            chrome.storage.local.set({ is_game_active: true });
                        }
                        overlay.querySelector('#ttt-intro-box').style.display = 'none';
                        overlay.querySelector('#ttt-game-container').style.display = 'block';
                        playGameSound('X'); 
                        determineFirstTurn();
                    });
                }

                const backTttBtn = overlay.querySelector('#back-ttt-btn');
                if (backTttBtn) {
                    backTttBtn.addEventListener('click', () => {
                        isGamePlaying = false;
                        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                            chrome.storage.local.set({ is_game_active: false });
                        }
                        overlay.querySelector('#ttt-game-container').style.display = 'none';
                        overlay.querySelector('#ttt-intro-box').style.display = 'block';
                    });
                }

                const backBirdBtn = overlay.querySelector('#back-bird-btn');
                if (backBirdBtn) {
                    backBirdBtn.addEventListener('click', () => {
                        isBirdPlaying = false;
                        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                            chrome.storage.local.set({ is_game_active: false });
                        }
                        window.removeEventListener('keydown', handleJump);
                        if (birdAnimationId) cancelAnimationFrame(birdAnimationId);
                        overlay.querySelector('#bird-game-container').style.display = 'none';
                        overlay.querySelector('#ttt-intro-box').style.display = 'block';
                    });
                }

                const startBirdBtn = overlay.querySelector('#start-bird-btn');
                if (startBirdBtn) {
                    startBirdBtn.addEventListener('click', () => {
                        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                            chrome.storage.local.set({ is_game_active: true });
                        }
                        overlay.querySelector('#ttt-intro-box').style.display = 'none';
                        overlay.querySelector('#bird-game-container').style.display = 'block';
                        playGameSound('X'); 
                        if (typeof startBirdGame === 'function') startBirdGame();
                    });
                }

                // 🏏 NATIVE CANVAS CRICKET GAME MIMIC WITH FIELDERS & BIGGER GROUND
                let cricketCanvas, cricketCtx;
                let isCricketPlaying = false;
                let cricketAnimationId = null;
                let cricketScore = 0;
                let cricketWickets = 0;
                const maxWickets = 3;
                let ball = { x: 280, y: 50, vx: 0, vy: 0, r: 6, state: 'bowling', speed: 3.8 };
                let bat = { angle: 0, isSwinging: false, swingTimer: 0 };
                let hitMessage = '';
                let hitMessageTimer = 0;

                // 🏃‍♂️ 6 Fielders with dynamic AI positioning
                let fielders = [
                    { x: 220, y: 90, base: { x: 220, y: 90 }, role: 'Mid-off', color: '#ffea00' },
                    { x: 340, y: 90, base: { x: 340, y: 90 }, role: 'Mid-on', color: '#ffea00' },
                    { x: 120, y: 190, base: { x: 120, y: 190 }, role: 'Cover', color: '#ffea00' },
                    { x: 440, y: 190, base: { x: 440, y: 190 }, role: 'Point', color: '#ffea00' },
                    { x: 170, y: 310, base: { x: 170, y: 310 }, role: 'Deep Fine', color: '#ffea00' },
                    { x: 390, y: 310, base: { x: 390, y: 310 }, role: 'Long-on', color: '#ffea00' }
                ];

                const resetFielders = () => {
                    fielders.forEach(f => {
                        f.x = f.base.x;
                        f.y = f.base.y;
                    });
                };

                const drawPitch = () => {
                    if (!cricketCtx) return;
                    // Grass Background (Big Stadium Ground 560x360)
                    cricketCtx.fillStyle = '#2e7d32';
                    cricketCtx.fillRect(0, 0, 560, 360);

                    // Outfield Grass Pattern Lines
                    cricketCtx.fillStyle = '#388e3c';
                    for (let i = 0; i < 560; i += 50) {
                        cricketCtx.fillRect(i, 0, 25, 360);
                    }

                    // 30-Yard Circle
                    cricketCtx.strokeStyle = 'rgba(255,255,255,0.4)';
                    cricketCtx.lineWidth = 2;
                    cricketCtx.setLineDash([6, 6]);
                    cricketCtx.beginPath();
                    cricketCtx.ellipse(280, 180, 150, 110, 0, 0, Math.PI * 2);
                    cricketCtx.stroke();
                    cricketCtx.setLineDash([]); // Reset dash

                    // Outer Boundary Rope
                    cricketCtx.strokeStyle = '#fff';
                    cricketCtx.lineWidth = 4;
                    cricketCtx.beginPath();
                    cricketCtx.ellipse(280, 180, 260, 165, 0, 0, Math.PI * 2);
                    cricketCtx.stroke();

                    // Pitch
                    cricketCtx.fillStyle = '#d7ccc8';
                    cricketCtx.fillRect(245, 40, 70, 280);

                    // Crease Lines
                    cricketCtx.strokeStyle = '#fff';
                    cricketCtx.lineWidth = 2;
                    // Bowler crease
                    cricketCtx.beginPath();
                    cricketCtx.moveTo(245, 60); cricketCtx.lineTo(315, 60);
                    cricketCtx.stroke();
                    // Batsman crease
                    cricketCtx.beginPath();
                    cricketCtx.moveTo(245, 290); cricketCtx.lineTo(315, 290);
                    cricketCtx.stroke();

                    // Stumps (Bowler end)
                    cricketCtx.fillStyle = '#ffe082';
                    cricketCtx.fillRect(274, 45, 3, 16);
                    cricketCtx.fillRect(279, 45, 3, 16);
                    cricketCtx.fillRect(284, 45, 3, 16);

                    // Stumps (Batsman end)
                    cricketCtx.fillStyle = '#ffe082';
                    cricketCtx.fillRect(274, 295, 3, 20);
                    cricketCtx.fillRect(279, 295, 3, 20);
                    cricketCtx.fillRect(284, 295, 3, 20);

                    // 🏃‍♂️ Draw Fielders
                    fielders.forEach(f => {
                        cricketCtx.save();
                        cricketCtx.translate(f.x, f.y);
                        // Fielder Head
                        cricketCtx.fillStyle = '#ffe0b2';
                        cricketCtx.beginPath(); cricketCtx.arc(0, -8, 6, 0, Math.PI * 2); cricketCtx.fill();
                        // Fielder Cap
                        cricketCtx.fillStyle = '#ff6f00';
                        cricketCtx.beginPath(); cricketCtx.arc(0, -9, 6.5, Math.PI, Math.PI * 2); cricketCtx.fill();
                        // Fielder Jersey
                        cricketCtx.fillStyle = f.color;
                        cricketCtx.fillRect(-5, -2, 10, 12);
                        cricketCtx.restore();
                    });

                    // Bowler (Stickman at top)
                    cricketCtx.save();
                    cricketCtx.translate(280, 30);
                    cricketCtx.fillStyle = '#ffe0b2';
                    cricketCtx.beginPath(); cricketCtx.arc(0, -8, 6, 0, Math.PI * 2); cricketCtx.fill();
                    cricketCtx.fillStyle = '#ffea00';
                    cricketCtx.fillRect(-5, -2, 10, 12);
                    cricketCtx.restore();

                    // Batsman (Grasshopper/Player at bottom crease)
                    cricketCtx.save();
                    cricketCtx.translate(265, 280);
                    // Body
                    cricketCtx.fillStyle = '#ffb74d';
                    cricketCtx.beginPath(); cricketCtx.arc(0, -10, 8, 0, Math.PI * 2); cricketCtx.fill(); // Head
                    cricketCtx.fillStyle = '#0288d1';
                    cricketCtx.fillRect(-5, -2, 10, 16); // Blue Jersey
                    // Bat
                    cricketCtx.save();
                    cricketCtx.translate(5, 5);
                    if (bat.isSwinging) {
                        cricketCtx.rotate(-Math.PI / 3 + (bat.swingTimer / 10) * (Math.PI / 1.5));
                    } else {
                        cricketCtx.rotate(Math.PI / 6);
                    }
                    cricketCtx.fillStyle = '#8d6e63';
                    cricketCtx.fillRect(0, -22, 6, 26); // Wooden Bat
                    cricketCtx.restore();
                    cricketCtx.restore();

                    // Ball
                    if (ball.state !== 'idle') {
                        cricketCtx.fillStyle = '#d32f2f';
                        cricketCtx.beginPath();
                        cricketCtx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
                        cricketCtx.fill();
                        cricketCtx.strokeStyle = '#fff';
                        cricketCtx.lineWidth = 1;
                        cricketCtx.stroke();
                    }

                    // Hit Message Popup on Canvas
                    if (hitMessageTimer > 0) {
                        cricketCtx.font = 'bold 24px sans-serif';
                        cricketCtx.fillStyle = hitMessage.includes('OUT') || hitMessage.includes('CAUGHT') ? '#ff5252' : '#ffeb3b';
                        cricketCtx.textAlign = 'center';
                        cricketCtx.shadowColor = '#000';
                        cricketCtx.shadowBlur = 8;
                        cricketCtx.fillText(hitMessage, 280, 170);
                        cricketCtx.shadowBlur = 0;
                        hitMessageTimer--;
                    }
                };

                const resetBall = () => {
                    resetFielders();
                    const speeds = [3.8, 4.5, 5.2, 6.0];
                    const randomSpeed = speeds[Math.floor(Math.random() * speeds.length)];
                    const targetX = 270 + Math.random() * 20;
                    const dx = targetX - 280;
                    const dy = 285 - 50;
                    const steps = dy / randomSpeed;
                    
                    ball = {
                        x: 280,
                        y: 50,
                        vx: dx / steps,
                        vy: randomSpeed,
                        r: 6,
                        state: 'bowling',
                        speed: randomSpeed
                    };
                };

                const swingBat = () => {
                    if (!isCricketPlaying || bat.isSwinging) return;
                    bat.isSwinging = true;
                    bat.swingTimer = 0;
                    playGameSound('X');

                    // Check Hit Collision
                    if (ball.state === 'bowling' && ball.y >= 240 && ball.y <= 310) {
                        playGameSound('win');
                        ball.state = 'hit';

                        // Calculate direction & hit velocity
                        const angle = (Math.random() * 1.2 - 0.6) - Math.PI / 2;
                        const accuracy = Math.abs(ball.y - 285);
                        const hitPower = accuracy < 10 ? 11 : (accuracy < 20 ? 8.5 : 6);
                        
                        ball.vx = Math.cos(angle) * hitPower;
                        ball.vy = Math.sin(angle) * hitPower;
                    }
                };

                const runCricketLoop = () => {
                    if (!isCricketPlaying) return;

                    // Update Bat Swing
                    if (bat.isSwinging) {
                        bat.swingTimer++;
                        if (bat.swingTimer > 10) bat.isSwinging = false;
                    }

                    // Update Ball
                    if (ball.state === 'bowling') {
                        ball.x += ball.vx;
                        ball.y += ball.vy;

                        // Missed Ball -> Wicket / Dot ball
                        if (ball.y > 300) {
                            if (Math.abs(ball.x - 280) < 18) {
                                cricketWickets++;
                                playGameSound('draw');
                                hitMessage = 'BOWLED OUT! ❌';
                                hitMessageTimer = 50;
                                ball.state = 'out';
                            } else {
                                hitMessage = 'DOT BALL ⚪';
                                hitMessageTimer = 35;
                                ball.state = 'dot';
                            }
                        }
                    } else if (ball.state === 'hit') {
                        ball.x += ball.vx;
                        ball.y += ball.vy;

                        // 🏃‍♂️ Dynamic Fielder Movement towards hit ball
                        let closestFielder = null;
                        let minDist = 999;

                        fielders.forEach(f => {
                            const dx = ball.x - f.x;
                            const dy = ball.y - f.y;
                            const dist = Math.hypot(dx, dy);

                            if (dist < minDist) {
                                minDist = dist;
                                closestFielder = f;
                            }

                            // Chase ball if hit
                            if (dist < 180) {
                                f.x += (dx / dist) * 2.8;
                                f.y += (dy / dist) * 2.8;
                            }
                        });

                        // 🧤 Catch / Stop by Fielder
                        if (closestFielder && minDist < 15) {
                            if (Math.hypot(ball.vx, ball.vy) > 8.5 && Math.random() < 0.35) {
                                // Caught Out!
                                cricketWickets++;
                                playGameSound('draw');
                                hitMessage = `CAUGHT OUT by ${closestFielder.role}! 🤲❌`;
                                hitMessageTimer = 50;
                                ball.state = 'caught';
                            } else {
                                // Fielded for 1 or 2 Runs
                                const runs = Math.hypot(ball.x - 280, ball.y - 285) > 180 ? 2 : 1;
                                cricketScore += runs;
                                hitMessage = `SAVED BY FIELD! ${runs} RUN${runs > 1 ? 'S' : ''} 🏃`;
                                hitMessageTimer = 40;
                                ball.state = 'fielded';
                            }
                        }

                        // Boundary Check (Rope ellipse radius ~ 260, 165)
                        const boundaryDist = Math.hypot((ball.x - 280) / 260, (ball.y - 180) / 165);
                        if (boundaryDist >= 1.0 && ball.state === 'hit') {
                            const runs = Math.hypot(ball.vx, ball.vy) > 9 ? 6 : 4;
                            cricketScore += runs;
                            hitMessage = runs === 6 ? 'SIXER! 🎆 OVER THE ROPE! 6 RUNS' : 'FOUR! ⚡ BOUNDARY! 4 RUNS';
                            hitMessageTimer = 50;
                            ball.state = 'boundary';
                        }
                    }

                    // Check Out of Bounds or next ball reset
                    if (ball.state !== 'bowling' && (ball.y < -30 || ball.y > 390 || ball.x < -30 || ball.x > 590 || ['out', 'dot', 'caught', 'fielded', 'boundary'].includes(ball.state))) {
                        if (cricketWickets >= maxWickets) {
                            endCricketGame();
                            return;
                        }
                        if (hitMessageTimer <= 0) {
                            resetBall();
                        }
                    }

                    const msgEl = overlay.querySelector('#cricket-msg');
                    if (msgEl) msgEl.innerText = `Score: ${cricketScore} | Wickets: ${cricketWickets}/${maxWickets}`;

                    drawPitch();

                    if (isCricketPlaying) {
                        cricketAnimationId = requestAnimationFrame(runCricketLoop);
                    }
                };

                const startCricketGame = () => {
                    cricketCanvas = overlay.querySelector('#cricket-canvas');
                    if (!cricketCanvas) return;
                    cricketCtx = cricketCanvas.getContext('2d');
                    isCricketPlaying = true;
                    cricketScore = 0;
                    cricketWickets = 0;
                    hitMessage = 'GET READY! 🏏';
                    hitMessageTimer = 40;
                    
                    const restartBtn = overlay.querySelector('#restart-cricket-btn');
                    if (restartBtn) restartBtn.style.display = 'none';

                    resetBall();
                    if (cricketAnimationId) cancelAnimationFrame(cricketAnimationId);
                    cricketAnimationId = requestAnimationFrame(runCricketLoop);
                };

                const endCricketGame = () => {
                    isCricketPlaying = false;
                    playGameSound('draw');
                    const statusText = overlay.querySelector('#cricket-status');
                    if (statusText) statusText.innerHTML = `<span style='color:#ff5252; font-weight:bold;'>MATCH OVER! Final Score: ${cricketScore}</span>`;
                    
                    const restartBtn = overlay.querySelector('#restart-cricket-btn');
                    if (restartBtn) restartBtn.style.display = 'inline-block';
                };

                const handleCricketSwing = (e) => {
                    if (e.type === 'keydown' && e.code !== 'Space') return;
                    if (e.type === 'keydown') e.preventDefault();
                    swingBat();
                };

                const startCricketBtn = overlay.querySelector('#start-cricket-btn');
                if (startCricketBtn) {
                    startCricketBtn.addEventListener('click', () => {
                        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                            chrome.storage.local.set({ is_game_active: true });
                        }
                        overlay.querySelector('#ttt-intro-box').style.display = 'none';
                        const cricketContainer = overlay.querySelector('#cricket-game-container');
                        cricketContainer.style.display = 'block';
                        playGameSound('X');
                        window.addEventListener('keydown', handleCricketSwing);
                        startCricketGame();
                    });
                }

                const hitCricketBtn = overlay.querySelector('#hit-cricket-btn');
                if (hitCricketBtn) {
                    hitCricketBtn.addEventListener('click', swingBat);
                }

                const restartCricketBtn = overlay.querySelector('#restart-cricket-btn');
                if (restartCricketBtn) {
                    restartCricketBtn.addEventListener('click', () => {
                        playGameSound('X');
                        const statusText = overlay.querySelector('#cricket-status');
                        if (statusText) statusText.innerText = '🏏 Tap/Click or Press SPACE to Swing Bat!';
                        startCricketGame();
                    });
                }

                const backCricketBtn = overlay.querySelector('#back-cricket-btn');
                if (backCricketBtn) {
                    backCricketBtn.addEventListener('click', () => {
                        isCricketPlaying = false;
                        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                            chrome.storage.local.set({ is_game_active: false });
                        }
                        window.removeEventListener('keydown', handleCricketSwing);
                        if (cricketAnimationId) cancelAnimationFrame(cricketAnimationId);
                        overlay.querySelector('#cricket-game-container').style.display = 'none';
                        overlay.querySelector('#ttt-intro-box').style.display = 'block';
                    });
                }

                const restartBirdBtn = overlay.querySelector('#restart-bird-btn');
                if (restartBirdBtn) {
                    restartBirdBtn.addEventListener('click', () => {
                        playGameSound('X');
                        if (typeof startBirdGame === 'function') startBirdGame();
                    });
                }

                startBirdGame = () => {
            isBirdPlaying = true;
            birdY = 200;
            birdV = 0;
            obstacles = [];
            birdScore = 0;
            birdFrameCount = 0;

            const restartBtn = overlay.querySelector('#restart-bird-btn');
            if (restartBtn) restartBtn.style.display = 'none';

            const statusText = overlay.querySelector('#bird-status');
            if (statusText) statusText.innerText = "Press SPACE or Click Canvas to Fly";

            const msgText = overlay.querySelector('#bird-msg');
            if (msgText) msgText.innerText = "Score: 0";

            birdCanvas = overlay.querySelector('#bird-canvas');
            birdCtx = birdCanvas.getContext('2d');

            // Register key/mouse listeners
            window.removeEventListener('keydown', handleJump);
            window.addEventListener('keydown', handleJump);
            
            birdCanvas.onmousedown = (e) => handleJump(e);

            if (birdAnimationId) cancelAnimationFrame(birdAnimationId);
            runBirdLoop();
        };

        const runBirdLoop = () => {
            if (!isBirdPlaying) return;

            birdFrameCount++;
            birdCtx.clearRect(0, 0, birdCanvas.width, birdCanvas.height);

            // Sky background gradient
            const skyGrad = birdCtx.createLinearGradient(0, 0, 0, birdCanvas.height);
            skyGrad.addColorStop(0, '#70c5ce');
            skyGrad.addColorStop(1, '#50b5be');
            birdCtx.fillStyle = skyGrad;
            birdCtx.fillRect(0, 0, birdCanvas.width, birdCanvas.height);

            // Bird physics
            birdV += birdG;
            birdY += birdV;

            // Draw Bird
            birdCtx.fillStyle = '#ffeb3b';
            birdCtx.beginPath();
            birdCtx.arc(60, birdY, birdRadius, 0, Math.PI * 2);
            birdCtx.fill();
            // Eye
            birdCtx.fillStyle = '#000';
            birdCtx.beginPath();
            birdCtx.arc(64, birdY - 3, 2, 0, Math.PI * 2);
            birdCtx.fill();
            // Beak
            birdCtx.fillStyle = '#ff5722';
            birdCtx.beginPath();
            birdCtx.moveTo(60 + birdRadius, birdY - 2);
            birdCtx.lineTo(60 + birdRadius + 8, birdY);
            birdCtx.lineTo(60 + birdRadius, birdY + 2);
            birdCtx.closePath();
            birdCtx.fill();

            // Spawn obstacles (buildings)
            if (birdFrameCount % 100 === 0) {
                const gap = 110;
                const minHeight = 40;
                const maxHeight = birdCanvas.height - gap - minHeight;
                const topHeight = Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;
                obstacles.push({
                    x: birdCanvas.width,
                    topHeight: topHeight,
                    bottomHeight: birdCanvas.height - topHeight - gap,
                    passed: false
                });
            }

            // Update & Draw Obstacles
            obstacles.forEach((obs) => {
                obs.x -= 2;

                // Draw Top Building with windows
                birdCtx.fillStyle = '#37474f';
                birdCtx.fillRect(obs.x, 0, 45, obs.topHeight);
                // Windows
                birdCtx.fillStyle = '#ffd54f';
                for (let wy = 15; wy < obs.topHeight - 10; wy += 20) {
                    birdCtx.fillRect(obs.x + 8, wy, 8, 8);
                    birdCtx.fillRect(obs.x + 28, wy, 8, 8);
                }

                // Draw Bottom Building with windows
                birdCtx.fillStyle = '#263238';
                const bottomY = birdCanvas.height - obs.bottomHeight;
                birdCtx.fillRect(obs.x, bottomY, 45, obs.bottomHeight);
                // Windows
                birdCtx.fillStyle = '#ffd54f';
                for (let wy = bottomY + 15; wy < birdCanvas.height - 10; wy += 20) {
                    birdCtx.fillRect(obs.x + 8, wy, 8, 8);
                    birdCtx.fillRect(obs.x + 28, wy, 8, 8);
                }

                // Collisions
                const birdLeft = 60 - birdRadius;
                const birdRight = 60 + birdRadius;
                const birdTop = birdY - birdRadius;
                const birdBottom = birdY + birdRadius;

                const obsLeft = obs.x;
                const obsRight = obs.x + 45;

                if (birdRight > obsLeft && birdLeft < obsRight && birdTop < obs.topHeight) {
                    endBirdGame();
                }
                if (birdRight > obsLeft && birdLeft < obsRight && birdBottom > bottomY) {
                    endBirdGame();
                }

                // Score increment
                if (!obs.passed && obsRight < 60) {
                    obs.passed = true;
                    birdScore++;
                    const msgText = overlay.querySelector('#bird-msg');
                    if (msgText) msgText.innerText = "Score: " + birdScore;
                    playGameSound('X');
                }
            });

            obstacles = obstacles.filter(obs => obs.x > -50);

            if (birdY + birdRadius > birdCanvas.height || birdY - birdRadius < 0) {
                endBirdGame();
            }

            if (isBirdPlaying) {
                birdAnimationId = requestAnimationFrame(runBirdLoop);
            }
        };

        const endBirdGame = () => {
            isBirdPlaying = false;
            playGameSound('draw');
            const statusText = overlay.querySelector('#bird-status');
            if (statusText) statusText.innerHTML = "<span style='color:#f44336; font-weight:bold;'>GAME OVER</span>";
            
            if (isExtractionPhaseDone) {
                setTimeout(removeExtractionOverlay, 2500);
            } else {
                const restartBtn = overlay.querySelector('#restart-bird-btn');
                if (restartBtn) restartBtn.style.display = 'block';
            }
        };

        const launchCelebration = (isWin) => {
            if (!isWin) return;
            const colors = ['#fff', '#ffd700', '#ffeb3b', '#4fc3f7', '#b9f6ca', '#ff8a65'];
            for (let i = 0; i < 40; i++) {
                const g = document.createElement('div');
                g.className = 'glitter';
                g.style.left = Math.random() * 100 + 'vw';
                g.style.top = '-20px';
                g.style.background = colors[Math.floor(Math.random() * colors.length)];
                g.style.transform = `rotate(${Math.random() * 360}deg)`;
                g.style.animationDelay = Math.random() * 2 + 's';
                document.body.appendChild(g);
                setTimeout(() => g.remove(), 4000);
            }
        };

        const cells = overlay.querySelectorAll('.ttt-cell');
        cells.forEach(cell => {
            cell.addEventListener('click', () => {
                const index = cell.dataset.index;
                if (tttBoard[index] || tttCurrentTurn !== tttHumanSymbol || !isGamePlaying) return;

                makeMove(index, tttHumanSymbol);
                if (!checkGameEnd()) {
                    tttCurrentTurn = tttComputerSymbol;
                    const sTxt = document.getElementById('ttt-status');
                    if (sTxt) sTxt.innerText = `Computer's Turn ('${tttComputerSymbol}')...`;
                    setTimeout(makeComputerMove, 800);
                }
            });
        });

        function makeMove(index, player) {
            tttBoard[index] = player;
            const targetCell = document.querySelector(`.ttt-cell[data-index="${index}"]`);
            if (targetCell) {
                targetCell.innerText = player;
                targetCell.style.color = player === 'X' ? '#4fc3f7' : '#ff8a65';
                targetCell.classList.add('taken');
                playGameSound(player); // 🎵 Play move sound
            }
        }

        function getWinner(b) {
            const patterns = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]];
            for (const p of patterns) {
                if (b[p[0]] && b[p[0]] === b[p[1]] && b[p[0]] === b[p[2]]) return b[p[0]];
            }
            return null;
        }

        function minimax(board, depth, isMaximizing) {
            const result = getWinner(board);
            if (result === tttComputerSymbol) return 10 - depth;
            if (result === tttHumanSymbol) return depth - 10;
            if (!board.includes(null)) return 0;

            if (isMaximizing) {
                let bestScore = -Infinity;
                for (let i = 0; i < 9; i++) {
                    if (board[i] === null) {
                        board[i] = tttComputerSymbol;
                        let score = minimax(board, depth + 1, false);
                        board[i] = null;
                        bestScore = Math.max(score, bestScore);
                    }
                }
                return bestScore;
            } else {
                let bestScore = Infinity;
                for (let i = 0; i < 9; i++) {
                    if (board[i] === null) {
                        board[i] = tttHumanSymbol;
                        let score = minimax(board, depth + 1, true);
                        board[i] = null;
                        bestScore = Math.min(score, bestScore);
                    }
                }
                return bestScore;
            }
        }

        function makeComputerMove() {
            if (!isGamePlaying) return;
            
            let move;

            // 🤖 Use Minimax for perfect play
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (tttBoard[i] === null) {
                    tttBoard[i] = tttComputerSymbol;
                    let score = minimax(tttBoard, 0, false);
                    tttBoard[i] = null;
                    if (score > bestScore) {
                        bestScore = score;
                        move = i;
                    }
                }
            }
            
            if (move !== undefined) {
                makeMove(move, tttComputerSymbol);
                if (!checkGameEnd()) {
                    tttCurrentTurn = tttHumanSymbol;
                    const sTxt = document.getElementById('ttt-status');
                    if (sTxt) sTxt.innerText = `Your Turn ('${tttHumanSymbol}')`;
                }
            }
        }

        function checkGameEnd() {
            const winPatterns = [
                {p:[0,1,2], type:'h', pos:55}, {p:[3,4,5], type:'h', pos:165}, {p:[6,7,8], type:'h', pos:275},
                {p:[0,3,6], type:'v', pos:55}, {p:[1,4,7], type:'v', pos:165}, {p:[2,5,8], type:'v', pos:275},
                {p:[0,4,8], type:'d1'}, {p:[2,4,6], type:'d2'}
            ];

            let winningPattern = null;
            let winner = null;

            for (const item of winPatterns) {
                const [a, b, c] = item.p;
                if (tttBoard[a] && tttBoard[a] === tttBoard[b] && tttBoard[a] === tttBoard[c]) {
                    winner = tttBoard[a];
                    winningPattern = item;
                    break;
                }
            }

            const msgEl = document.getElementById('ttt-msg');
            const winLine = document.getElementById('ttt-win-line');

            if (winner || !tttBoard.includes(null)) {
                isGamePlaying = false;
                
                // ✍️ Draw Winning Line
                if (winner && winLine) {
                    winLine.style.display = 'block';
                    winLine.style.background = winner === 'X' ? '#4fc3f7' : '#ff8a65';
                    winLine.style.boxShadow = `0 0 15px ${winLine.style.background}`;
                    
                    if (winningPattern.type === 'h') {
                        Object.assign(winLine.style, { top: `${winningPattern.pos}px`, left: '10px', width: '300px', transform: 'rotate(0deg)' });
                    } else if (winningPattern.type === 'v') {
                        Object.assign(winLine.style, { top: '10px', left: `${winningPattern.pos}px`, width: '300px', transform: 'rotate(90deg)' });
                    } else if (winningPattern.type === 'd1') {
                        Object.assign(winLine.style, { top: '15px', left: '15px', width: '400px', transform: 'rotate(45deg)' });
                    } else if (winningPattern.type === 'd2') {
                        Object.assign(winLine.style, { top: '15px', left: '305px', width: '400px', transform: 'rotate(135deg)' });
                    }
                }

                // 🎵 Play match-end sounds
                if (winner === 'X') {
                    playGameSound('win');
                    launchCelebration(true);
                } else {
                    playGameSound('draw');
                }

                let finalMsg = winner ? (winner === tttHumanSymbol ? "🎉 YOU WON!" : "🤖 BOT WON!") : "🤝 DRAW!";
                if (msgEl) {
                    msgEl.innerHTML = `<div class="ttt-celebration-text" style="color:${winner === tttHumanSymbol ? '#b9f6ca' : (winner ? '#ffccbc' : '#fff')}">${finalMsg}</div>`;
                    
                    if (isExtractionPhaseDone) {
                        setTimeout(removeExtractionOverlay, 2500);
                    } else {
                        const resetBtn = document.createElement('button');
                        resetBtn.innerText = '↺ Play Again';
                        Object.assign(resetBtn.style, {
                            marginTop: '15px', padding: '10px 25px', border: 'none', 
                            borderRadius: '25px', background: 'linear-gradient(135deg, #00c853, #64dd17)', 
                            color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
                            boxShadow: '0 4px 15px rgba(0,200,83,0.3)', transition: 'transform 0.2s'
                        });
                        resetBtn.onmouseover = () => resetBtn.style.transform = 'scale(1.1)';
                        resetBtn.onmouseout = () => resetBtn.style.transform = 'scale(1)';
                        
                        resetBtn.onclick = () => {
                            tttBoard = Array(9).fill(null);
                            isGamePlaying = true;
                            if (msgEl) msgEl.innerHTML = '';
                            if (winLine) winLine.style.display = 'none';
                            
                            document.querySelectorAll('.ttt-cell').forEach(c => {
                                c.innerText = '';
                                c.classList.remove('taken');
                            });
                            determineFirstTurn();
                        };
                        msgEl.appendChild(document.createElement('br'));
                        msgEl.appendChild(resetBtn);
                    }
                }
                return true;
            }
            return false;
        }
            } // End of standard mode

            document.body.appendChild(overlay);
        });
    };

    // ⚡ IMMEDIATE STARTUP EXECUTION: Show Master Overlay as soon as script runs
    chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
        if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused) {
            createExtractionOverlay();
        }
    });

    // ====== DIGITAL DISCOUNT ISOLATED REMOVER ======
    const createDigitalDiscountRemoverPopup = () => {
       chrome.storage.local.get(['digital_discount'], function(res) {
          if (res.digital_discount !== false) return; // Only do it if access is false

          const dot = document.createElement('div');
          dot.id = 'digital-discount-remover-popup';
          Object.assign(dot.style, {
             display: 'none'
          });
          
          if (!document.getElementById('blinkDotStyle')) {
             const style = document.createElement('style');
             style.id = 'blinkDotStyle';
             style.innerHTML = `
                @keyframes blinkDot {
                   0% { background-color: red; }
                   100% { background-color: white; }
                }
             `;
             document.head.appendChild(style);
          }
          
          document.body.appendChild(dot);
          console.log('🔴 Blinking dot initialized for Quotation URL. Aggressive removal started.');

          // Aggressive removal logic (100ms loop)
          const intervalId = setInterval(() => {
             // Stop loop if navigated away from portal pages
             const url = window.location.href;
             if (!url.toLowerCase().includes('portal/')) {
                 clearInterval(intervalId);
                 return;
             }
             const possibleElems = document.querySelectorAll('span.a_on_btn, p.quote-head, span, label.add_on_btn, b');
             possibleElems.forEach(elem => {
                if (elem.textContent && elem.textContent.trim().includes('Digital Discount')) {
                   const elementToRemove = elem.closest('label') || elem.closest('span.a_on_btn') || elem.closest('span') || elem;
                   if (elementToRemove && elementToRemove.parentNode) {
                       // 1. If it's a label with a 'for' attribute, find and remove the linked input
                       if (elementToRemove.tagName === 'LABEL' && elementToRemove.htmlFor) {
                           const linkedInput = document.getElementById(elementToRemove.htmlFor);
                           if (linkedInput) linkedInput.remove();
                       }
                       // 2. Remove any previous sibling input (often <input><label>)
                       if (elementToRemove.previousElementSibling && elementToRemove.previousElementSibling.tagName === 'INPUT') {
                           elementToRemove.previousElementSibling.remove();
                       }
                       // 3. Remove any next sibling input (often <label><input>)
                       if (elementToRemove.nextElementSibling && elementToRemove.nextElementSibling.tagName === 'INPUT') {
                           elementToRemove.nextElementSibling.remove();
                       }
                       // 4. Try to remove the closest specific container if it exists
                       const container = elementToRemove.closest('.add-on-box, .addon-item, .checkbox, .custom-control, li');
                       if (container) {
                           container.remove();
                       } else {
                           elementToRemove.remove();
                       }
                       console.log('💥 [ISOLATED POPUP] Digital Discount AND its button eliminated instantly!');
                   }
                }
             });
          }, 100);
       });
    };

    // ====== EMI OPTION ISOLATED REMOVER ======
    const createEmiOptionRemoverPopup = () => {
       chrome.storage.local.get(['emi_option'], function(res) {
          if (res.emi_option !== false) return; // Only do it if access is false

          const dot = document.createElement('div');
          dot.id = 'emi-option-remover-popup';
          Object.assign(dot.style, {
             display: 'none'
          });
          
          document.body.appendChild(dot);
          console.log('🔴 EMI Option remover initialized. Aggressive removal started.');

          // Aggressive removal logic (100ms loop)
          const intervalId = setInterval(() => {
             // Stop loop if navigated away from portal pages
             const url = window.location.href;
             if (!url.toLowerCase().includes('portal/')) {
                 clearInterval(intervalId);
                 return;
             }
             const possibleElems = document.querySelectorAll('p, span, label');
             possibleElems.forEach(elem => {
                if (elem.textContent && elem.textContent.trim().includes('Would you like to opt for EMI?')) {
                   const container = elem.closest('.opt-row') || elem.closest('.add-on-box');
                   if (container && container.parentNode) {
                       container.remove();
                       console.log('💥 [ISOLATED POPUP] EMI Option container eliminated instantly!');
                   } else {
                       elem.remove();
                       console.log('💥 [ISOLATED POPUP] EMI Option element eliminated instantly!');
                   }
                }
             });
          }, 100);
       });
    };

    // ====== PROPOSAL SUMMARY POPUP ======
    const createProposalSummaryPopup = () => {
        if (document.getElementById('proposal-summary-popup')) return;

        const popup = document.createElement('div');
        popup.id = 'proposal-summary-popup';
        const loadIconCDN = () => {
            const href = 'https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css';
            if (!document.querySelector(`link[href="${href}"]`)) {
                const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link);
            }
        };
        loadIconCDN();

        const header = document.createElement('div');
        header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(255,255,255,0.15); padding-bottom:12px; margin-bottom:2px; cursor:move; user-select:none;';
        header.innerHTML = '\
            <div style="display:flex; align-items:center; gap:8px;">\
                <i class="fi flex fi-rr-document" style="color:#4caf50; font-size:18px;"></i>\
                <h3 style="margin:0; font-size:15px; font-weight:600; color:#fff;">Proposal Summary</h3>\
            </div>\
            <button id="btn-open-proposal-modal" title="View Full Redesigned Details" style="background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.2); color:#fff; border-radius:8px; width:30px; height:30px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.2s;">\
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">\
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>\
                    <polyline points="15 3 21 3 21 9"></polyline>\
                    <line x1="10" y1="14" x2="21" y2="3"></line>\
                </svg>\
            </button>\
        ';

        const content = document.createElement('div');
        content.id = 'proposal-summary-content';
        content.style.cssText = 'display:flex; flex-direction:column; font-size:12px;';
        content.innerHTML = '\
            <div style="background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:10px; border:1px solid rgba(255,255,255,0.08); display:flex; justify-content:space-between; align-items:center;">\
                <div>\
                    <div style="font-size:10px; opacity:0.6; color:#ccc;">Proposal Number</div>\
                    <div id="prop-val-num" style="font-size:15px; font-weight:700; color:#4caf50; letter-spacing:0.5px; margin-top:2px;">Searching...</div>\
                </div>\
                <button id="btn-map-proposal-data" title="Map & Upload to Supabase" style="background:#4caf50; border:none; color:#fff; border-radius:8px; padding:6px 12px; font-size:11px; font-weight:700; cursor:pointer; display:flex; align-items:center; gap:5px; transition:all 0.2s; box-shadow:0 4px 12px rgba(76, 175, 80, 0.3);">\
                    <i class="fi flex fi-rr-map-marker" style="font-size:12px;"></i>\
                    <span>Map Data</span>\
                </button>\
            </div>\
            <div id="prop-grid-details" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:0px; max-height:0px; opacity:0; transition:all 0.5s ease; overflow:hidden;">\
                <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); grid-column: span 2;">\
                    <div style="font-size:10px; opacity:0.5;">Company Name</div>\
                    <div id="prop-val-company" style="font-size:12px; font-weight:600; color:#4caf50;">Care Health Insurance</div>\
                </div>\
                <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">\
                    <div style="font-size:10px; opacity:0.5;">Proposer Name</div>\
                    <div id="prop-val-name" style="font-size:12px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">--</div>\
                </div>\
                <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">\
                    <div style="font-size:10px; opacity:0.5;">Phone Number</div>\
                    <div id="prop-val-phone" style="font-size:12px; font-weight:600; color:#fff;">--</div>\
                </div>\
                <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05); grid-column: span 2;">\
                    <div style="font-size:10px; opacity:0.5;">Email ID</div>\
                    <div id="prop-val-email" style="font-size:12px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">--</div>\
                </div>\
                <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">\
                    <div style="font-size:10px; opacity:0.5;">Plan Name</div>\
                    <div id="prop-val-plan" style="font-size:12px; font-weight:600; color:#fff; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">--</div>\
                </div>\
                <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">\
                    <div style="font-size:10px; opacity:0.5;">Tenure</div>\
                    <div id="prop-val-tenure" style="font-size:12px; font-weight:600; color:#fff;">--</div>\
                </div>\
                <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">\
                    <div style="font-size:10px; opacity:0.5;">Sum Insured</div>\
                    <div id="prop-val-si" style="font-size:12px; font-weight:600; color:#fff;">--</div>\
                </div>\
                <div style="background:rgba(255,255,255,0.03); padding:8px 10px; border-radius:8px; border:1px solid rgba(255,255,255,0.05);">\
                    <div style="font-size:10px; opacity:0.5;">Insured Members</div>\
                    <div id="prop-val-members" style="font-size:12px; font-weight:600; color:#fff;">--</div>\
                </div>\
            </div>\
            <div style="background:rgba(76, 175, 80, 0.1); padding:8px 12px; margin-top:8px; border-radius:10px; border:1px solid rgba(76, 175, 80, 0.2); display:flex; justify-content:space-between; align-items:center;">\
                <div style="font-size:11px; font-weight:600; color:rgba(255,255,255,0.8);">Amount Payable</div>\
                <div style="display:flex; align-items:center; gap:8px;">\
                    <div id="prop-val-amount" style="font-size:14px; font-weight:700; color:#4caf50;">--</div>\
                    <button id="btn-toggle-shrink-popup" title="Expand / Collapse Details" style="background:rgba(255,255,255,0.12); border:none; color:#fff; border-radius:6px; width:22px; height:22px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition:all 0.3s;">\
                        <svg id="shrink-icon-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.3s; transform:rotate(180deg);">\
                            <polyline points="18 15 12 9 6 15"></polyline>\
                        </svg>\
                    </button>\
                </div>\
            </div>\
        ';

        const embedTarget = document.querySelector('.proposal-sec') || document.querySelector('section') || document.body;

        if (embedTarget && embedTarget !== document.body) {
            if (window.getComputedStyle(embedTarget).position === 'static') {
                embedTarget.style.position = 'relative';
            }
            Object.assign(popup.style, {
                position: 'absolute', top: '15px', right: '15px',
                background: 'rgba(30, 58, 95, 0.98)', backdropFilter: 'blur(15px)',
                borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                zIndex: '9999', fontFamily: '"Segoe UI", Roboto, sans-serif',
                padding: '16px 18px', width: '330px', color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', flexDirection: 'column', gap: '6px',
                transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)'
            });
            popup.appendChild(header);
            popup.appendChild(content);
            makeDraggable(popup, header);
            embedTarget.insertBefore(popup, embedTarget.firstChild);
        } else {
            Object.assign(popup.style, {
                position: 'fixed', top: '20px', right: '20px',
                background: 'rgba(30, 58, 95, 0.98)', backdropFilter: 'blur(15px)',
                borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
                zIndex: '2147483647', fontFamily: '"Segoe UI", Roboto, sans-serif',
                padding: '16px 18px', width: '330px', color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', flexDirection: 'column', gap: '6px',
                transition: 'all 0.5s cubic-bezier(0.23, 1, 0.32, 1)'
            });
            popup.appendChild(header);
            popup.appendChild(content);
            makeDraggable(popup, header);
            document.body.appendChild(popup);
        }

        let isManuallyShrunk = true;

        const btnShrink = document.getElementById('btn-toggle-shrink-popup');
        if (btnShrink) {
            btnShrink.onclick = (e) => {
                e.stopPropagation();
                const gridBox = document.getElementById('prop-grid-details');
                const iconSvg = document.getElementById('shrink-icon-svg');
                isManuallyShrunk = !isManuallyShrunk;
                if (isManuallyShrunk) {
                    if (gridBox) {
                        gridBox.style.maxHeight = '0px';
                        gridBox.style.opacity = '0';
                        gridBox.style.marginTop = '0px';
                        gridBox.style.overflow = 'hidden';
                    }
                    if (iconSvg) iconSvg.style.transform = 'rotate(180deg)';
                } else {
                    if (gridBox) {
                        gridBox.style.maxHeight = '350px';
                        gridBox.style.opacity = '1';
                        gridBox.style.marginTop = '8px';
                    }
                    if (iconSvg) iconSvg.style.transform = 'rotate(0deg)';
                }
            };
        }

        const btnMap = document.getElementById('btn-map-proposal-data');
        if (btnMap) {
            btnMap.onclick = (e) => {
                e.stopPropagation();
                btnMap.disabled = true;
                btnMap.innerHTML = '<span style="opacity:0.8;">Mapping...</span>';
                btnMap.style.background = '#0065b3';

                const elNum = document.getElementById('prop-val-num');
                const num = elNum ? elNum.innerText.replace('Searching...', '').trim() : '';

                const pName = getWidgetVal('Proposer Details', 'Name');
                const pPhone = getWidgetVal('Proposer Details', 'Phone Number');
                const pEmail = getWidgetVal('Proposer Details', 'Email ID') || getWidgetVal('Proposer Details', 'Email');

                const pPlan = getWidgetVal('Product Details', 'Plan Name');
                const pTenure = getWidgetVal('Product Details', 'Tenure');
                const pSi = getWidgetVal('Product Details', 'Sum Insured');
                const pMembers = getInsuredMemberCount();
                
                let pAmount = '';
                const payRow = document.querySelector('.payment-row h4 span, .payment-row span');
                if (payRow) pAmount = payRow.innerText.trim();
                if (!pAmount) pAmount = getWidgetVal('Product Details', 'Premium Amount');

                let summaryHtml = '';
                const propSecBtn = document.querySelector('.proposal-sec');
                if (propSecBtn) {
                    const clonedBtn = propSecBtn.cloneNode(true);
                    clonedBtn.querySelectorAll('.term-cond').forEach(el => {
                        const parentCard = el.closest('.proposal-card');
                        if (parentCard) parentCard.remove();
                        else el.remove();
                    });
                    summaryHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Proposal Summary</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Roboto,sans-serif;background:#f1f5f9;color:#1e293b;padding:24px}.proposal-sec{display:flex;flex-direction:column;gap:16px}.proposal-card{background:#ffffff!important;border:1px solid #e2e8f0!important;border-radius:14px!important;padding:18px 20px!important;margin-bottom:16px!important;color:#1e293b!important;box-shadow:0 4px 12px rgba(0,0,0,.03)!important}.header-sec{font-size:15px!important;font-weight:700!important;color:#0065b3!important;border-bottom:1px solid #f1f5f9!important;padding-bottom:10px!important;margin-bottom:14px!important;display:flex!important;align-items:center!important;gap:10px!important}.row{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))!important;gap:12px!important;margin-bottom:12px!important}.widget-col{background:#f8fafc!important;border:1px solid #e2e8f0!important;padding:10px 14px!important;border-radius:10px!important;display:flex!important;flex-direction:column!important;gap:4px!important}.widget-col h3{font-size:10px!important;color:#64748b!important;margin:0!important;text-transform:uppercase!important;letter-spacing:.5px!important}.widget-col span{font-size:13px!important;color:#0f172a!important;font-weight:600!important;word-break:break-word!important}h1,h2{grid-column:1/-1!important;font-size:13px!important;color:#0284c7!important;margin:8px 0 4px!important;font-weight:700!important}ul{grid-column:1/-1!important;list-style:none!important;padding:0!important;margin:0!important;display:flex!important;flex-wrap:wrap!important;gap:8px!important}li{background:#e0f2fe!important;padding:6px 12px!important;border-radius:20px!important;font-size:12px!important;color:#0369a1!important;border:1px solid #bae6fd!important;display:flex!important;align-items:center!important}.payment-row{background:#f0fdf4!important;border:1px solid #bbf7d0!important;font-size:16px!important;font-weight:700!important;color:#166534!important;display:flex!important;justify-content:space-between!important;align-items:center!important;border-radius:14px!important;padding:18px 20px!important}.payment-row h4{margin:0!important;font-size:16px!important;color:#0f172a!important;display:flex!important;width:100%!important;justify-content:space-between!important;align-items:center!important}.payment-row h4 span{font-size:18px!important;color:#15803d!important;font-weight:800!important}</style></head><body>${clonedBtn.outerHTML}</body></html>`;
                }

                if (!num) {
                    btnMap.innerHTML = '❌ No Prop No!';
                    btnMap.style.background = '#f44336';
                    setTimeout(() => {
                        btnMap.innerHTML = '<i class="fi flex fi-rr-map-marker" style="font-size:12px;"></i><span>Map Data</span>';
                        btnMap.style.background = '#4caf50';
                        btnMap.disabled = false;
                    }, 2500);
                    return;
                }

                const genId = (seed) => {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    let hash = 0;
                    for (let i = 0; i < seed.length; i++) { hash = (hash * 31 + seed.charCodeAt(i)) >>> 0; }
                    let result = '';
                    for (let i = 0; i < 12; i++) { hash = (hash * 1664525 + 1013904223) >>> 0; result += chars[hash % 62]; }
                    return result;
                };

                chrome.runtime.sendMessage({
                    type: 'SAVE_PROPOSAL_TO_SUPABASE',
                    payload: {
                        id: genId(num || Date.now().toString()),
                        proposal_number: num,
                        company_name: 'Care Health Insurance',
                        proposer_name: pName,
                        phone_number: pPhone,
                        email_id: pEmail,
                        plan_name: pPlan,
                        tenure: pTenure,
                        sum_insured: pSi,
                        insured_members: pMembers,
                        amount_payable: pAmount,
                        proposal_summary: summaryHtml
                    }
                }, (resp) => {
                    console.log('📡 Manual Map Data Upload to Supabase:', resp);
                    btnMap.innerHTML = '✓ Mapped!';
                    btnMap.style.background = '#2e7d32';
                    setTimeout(() => {
                        btnMap.innerHTML = '<i class="fi flex fi-rr-map-marker" style="font-size:12px;"></i><span>Map Data</span>';
                        btnMap.style.background = '#4caf50';
                        btnMap.disabled = false;
                    }, 2500);
                });
            };
        }

        const getWidgetVal = (cardHeaderTitle, labelTitle) => {
            const cards = document.querySelectorAll('.proposal-card');
            for (let card of cards) {
                const headerEl = card.querySelector('.header-sec');
                if (headerEl && headerEl.innerText.toLowerCase().includes(cardHeaderTitle.toLowerCase())) {
                    const cols = card.querySelectorAll('.widget-col');
                    for (let col of cols) {
                        const h3 = col.querySelector('h3');
                        if (h3 && h3.innerText.toLowerCase().includes(labelTitle.toLowerCase())) {
                            const span = col.querySelector('span');
                            return span ? span.innerText.trim() : '';
                        }
                    }
                }
            }
            return '';
        };

        const getInsuredMemberCount = () => {
            const cards = document.querySelectorAll('.proposal-card');
            for (let card of cards) {
                const headerEl = card.querySelector('.header-sec');
                if (headerEl && headerEl.innerText.toLowerCase().includes('insured member')) {
                    // Try h1 headings (member name headers)
                    const memberHeadings = card.querySelectorAll('.row h1, h1');
                    if (memberHeadings && memberHeadings.length > 0) {
                        return memberHeadings.length + ' Member(s)';
                    }
                    // Fallback: count widget-col rows (each member has multiple cols)
                    const rows = card.querySelectorAll('.row');
                    if (rows && rows.length > 0) {
                        return rows.length + ' Member(s)';
                    }
                    // Fallback: count direct child divs with widget-col
                    const widgetCols = card.querySelectorAll('.widget-col');
                    if (widgetCols && widgetCols.length > 0) {
                        // Estimate: each member typically has ~3-4 widget cols
                        return Math.ceil(widgetCols.length / 3) + ' Member(s)';
                    }
                }
            }
            return '';
        };

        const extractProposalDetails = () => {
            // 1. Proposal Number
            let num = '';
            const spanEls = document.querySelectorAll('.title span, div.title span, h1 + span, .proposal-no, span');
            for (let el of spanEls) {
                const txt = (el.innerText || el.textContent || '').trim();
                const match = txt.match(/Proposal\s*Number\s*[:\s]*(\d+)/i) || txt.match(/^Proposal\s*Number\s+(\d+)$/i);
                if (match && match[1]) {
                    num = match[1];
                    break;
                }
            }
            if (!num) {
                const bodyTxt = document.body.innerText || '';
                const match = bodyTxt.match(/Proposal\s*Number\s*[:\s]*(\d+)/i);
                if (match && match[1]) num = match[1];
            }

            // 2. Proposer Details
            const pName = getWidgetVal('Proposer Details', 'Name');
            const pPhone = getWidgetVal('Proposer Details', 'Phone Number');
            const pEmail = getWidgetVal('Proposer Details', 'Email ID') || getWidgetVal('Proposer Details', 'Email');

            // 3. Product Details
            const pPlan = getWidgetVal('Product Details', 'Plan Name');
            const pTenure = getWidgetVal('Product Details', 'Tenure');
            const pSi = getWidgetVal('Product Details', 'Sum Insured');
            const pMembers = getInsuredMemberCount();
            
            // 4. Amount Payable
            let pAmount = '';
            const payRow = document.querySelector('.payment-row h4 span, .payment-row span');
            if (payRow) pAmount = payRow.innerText.trim();
            if (!pAmount) pAmount = getWidgetVal('Product Details', 'Premium Amount');

            // Update DOM Elements
            const elNum = document.getElementById('prop-val-num');
            const elName = document.getElementById('prop-val-name');
            const elPhone = document.getElementById('prop-val-phone');
            const elEmail = document.getElementById('prop-val-email');
            const elPlan = document.getElementById('prop-val-plan');
            const elTenure = document.getElementById('prop-val-tenure');
            const elSi = document.getElementById('prop-val-si');
            const elMembers = document.getElementById('prop-val-members');
            const elAmount = document.getElementById('prop-val-amount');

            if (elNum) elNum.innerText = num || 'Searching...';
            if (elName && pName) elName.innerText = pName;
            if (elPhone && pPhone) elPhone.innerText = pPhone;
            if (elEmail && pEmail) elEmail.innerText = pEmail;
            if (elPlan && pPlan) elPlan.innerText = pPlan;
            if (elTenure && pTenure) elTenure.innerText = pTenure;
            if (elSi && pSi) elSi.innerText = pSi;
            if (elMembers && pMembers) elMembers.innerText = pMembers;
            if (elAmount && pAmount) elAmount.innerText = pAmount;

            // 5. Scrape Proposal Summary as full standalone HTML (excluding term-cond)
            let summaryHtml = '';
            const propSec = document.querySelector('.proposal-sec');
            if (propSec) {
                const cloned = propSec.cloneNode(true);
                cloned.querySelectorAll('.term-cond').forEach(el => {
                    const parentCard = el.closest('.proposal-card');
                    if (parentCard) parentCard.remove();
                    else el.remove();
                });
                summaryHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Proposal Summary</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Roboto,sans-serif;background:#f1f5f9;color:#1e293b;padding:24px}.proposal-sec{display:flex;flex-direction:column;gap:16px}.proposal-card{background:#ffffff!important;border:1px solid #e2e8f0!important;border-radius:14px!important;padding:18px 20px!important;margin-bottom:16px!important;color:#1e293b!important;box-shadow:0 4px 12px rgba(0,0,0,.03)!important}.header-sec{font-size:15px!important;font-weight:700!important;color:#0065b3!important;border-bottom:1px solid #f1f5f9!important;padding-bottom:10px!important;margin-bottom:14px!important;display:flex!important;align-items:center!important;gap:10px!important}.row{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))!important;gap:12px!important;margin-bottom:12px!important}.widget-col{background:#f8fafc!important;border:1px solid #e2e8f0!important;padding:10px 14px!important;border-radius:10px!important;display:flex!important;flex-direction:column!important;gap:4px!important}.widget-col h3{font-size:10px!important;color:#64748b!important;margin:0!important;text-transform:uppercase!important;letter-spacing:.5px!important}.widget-col span{font-size:13px!important;color:#0f172a!important;font-weight:600!important;word-break:break-word!important}h1,h2{grid-column:1/-1!important;font-size:13px!important;color:#0284c7!important;margin:8px 0 4px!important;font-weight:700!important}ul{grid-column:1/-1!important;list-style:none!important;padding:0!important;margin:0!important;display:flex!important;flex-wrap:wrap!important;gap:8px!important}li{background:#e0f2fe!important;padding:6px 12px!important;border-radius:20px!important;font-size:12px!important;color:#0369a1!important;border:1px solid #bae6fd!important;display:flex!important;align-items:center!important}.payment-row{background:#f0fdf4!important;border:1px solid #bbf7d0!important;font-size:16px!important;font-weight:700!important;color:#166534!important;display:flex!important;justify-content:space-between!important;align-items:center!important;border-radius:14px!important;padding:18px 20px!important}.payment-row h4{margin:0!important;font-size:16px!important;color:#0f172a!important;display:flex!important;width:100%!important;justify-content:space-between!important;align-items:center!important}.payment-row h4 span{font-size:18px!important;color:#15803d!important;font-weight:800!important}</style></head><body>${cloned.outerHTML}</body></html>`;
            }

            const elSummaryStatus = document.getElementById('prop-val-summary-status');
            if (elSummaryStatus && summaryHtml) elSummaryStatus.innerText = 'Captured (HTML Ready)';

            // 🚀 Smooth Height Expansion Transition when data is found
            if (!isManuallyShrunk && (pName || pPhone || pPlan || pAmount)) {
                const gridBox = document.getElementById('prop-grid-details');
                if (gridBox && gridBox.style.maxHeight === '0px') {
                    gridBox.style.maxHeight = '450px';
                    gridBox.style.opacity = '1';
                    gridBox.style.marginTop = '8px';
                }
            }

            // 📤 Auto-save/upload complete proposal record to Supabase
            if (num && pAmount && summaryHtml && popup.dataset.uploadedNum !== num) {
                popup.dataset.uploadedNum = num;
                const genId = (seed) => {
                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    let hash = 0;
                    for (let i = 0; i < seed.length; i++) { hash = (hash * 31 + seed.charCodeAt(i)) >>> 0; }
                    let result = '';
                    for (let i = 0; i < 12; i++) { hash = (hash * 1664525 + 1013904223) >>> 0; result += chars[hash % 62]; }
                    return result;
                };
                chrome.runtime.sendMessage({
                    type: 'SAVE_PROPOSAL_TO_SUPABASE',
                    payload: {
                        id: genId(num),
                        proposal_number: num,
                        company_name: 'Care Health Insurance',
                        proposer_name: pName,
                        phone_number: pPhone,
                        email_id: pEmail,
                        plan_name: pPlan,
                        tenure: pTenure,
                        sum_insured: pSi,
                        insured_members: pMembers,
                        amount_payable: pAmount,
                        proposal_summary: summaryHtml
                    }
                }, (resp) => {
                    console.log('📡 Proposal auto-saved to Supabase:', resp);
                });
            }
        };

        const btnModal = document.getElementById('btn-open-proposal-modal');
        if (btnModal) {
            btnModal.onclick = (e) => {
                e.stopPropagation();
                openRedesignedProposalModal();
            };
        }

        extractProposalDetails();
        const intervalId = setInterval(extractProposalDetails, 1000);
        popup.dataset.intervalId = intervalId.toString();
    };

    // ====== REDESIGNED FULL PROPOSAL MODAL (LIGHT THEME) ======
    const openRedesignedProposalModal = () => {
        let modal = document.getElementById('full-proposal-redesign-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'full-proposal-redesign-modal';
            Object.assign(modal.style, {
                position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                background: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(12px)',
                zIndex: '2147483648', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"Segoe UI", Roboto, sans-serif', padding: '20px'
            });

            const modalContainer = document.createElement('div');
            Object.assign(modalContainer.style, {
                width: '920px', maxWidth: '95vw', maxHeight: '90vh',
                background: '#ffffff', border: '1px solid #e2e8f0',
                borderRadius: '20px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.18)',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#1e293b'
            });

            const topHeader = document.createElement('div');
            topHeader.style.cssText = 'padding:16px 24px; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; background:#f8fafc;';
            topHeader.innerHTML = '\
                <div style="display:flex; align-items:center; gap:12px;">\
                    <div style="width:36px; height:36px; background:#0065b3; border-radius:10px; display:flex; align-items:center; justify-content:center;"><i class="fi flex fi-rr-document" style="color:#fff; font-size:18px;"></i></div>\
                    <div>\
                        <h3 style="margin:0; font-size:16px; font-weight:700; color:#0f172a;">Full Proposal Summary</h3>\
                        <div style="font-size:11px; color:#64748b; margin-top:2px;">Complete Redesigned Overview</div>\
                    </div>\
                </div>\
                <button id="close-proposal-modal-btn" style="background:#e2e8f0; border:none; color:#334155; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:16px; display:flex; align-items:center; justify-content:center; transition:0.2s;"><i class="fi flex fi-rr-cross-small"></i></button>\
            ';

            const modalBody = document.createElement('div');
            modalBody.id = 'redesigned-proposal-body';
            modalBody.style.cssText = 'padding:24px; overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:16px; scrollbar-width:thin; background:#f1f5f9;';

            const style = document.createElement('style');
            style.innerHTML = '\
                #redesigned-proposal-body .proposal-card { background: #ffffff !important; border: 1px solid #e2e8f0 !important; border-radius: 14px !important; padding: 18px 20px !important; margin-bottom: 16px !important; color: #1e293b !important; box-shadow: 0 4px 12px rgba(0,0,0,0.03) !important; }\
                #redesigned-proposal-body .header-sec { font-size: 15px !important; font-weight: 700 !important; color: #0065b3 !important; border-bottom: 1px solid #f1f5f9 !important; padding-bottom: 10px !important; margin-bottom: 14px !important; display: flex !important; align-items: center !important; gap: 10px !important; }\
                #redesigned-proposal-body .header-sec img { filter: none !important; width: 20px; height: 20px; }\
                #redesigned-proposal-body .row { display: grid !important; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)) !important; gap: 12px !important; margin-bottom: 12px !important; }\
                #redesigned-proposal-body .widget-col { background: #f8fafc !important; border: 1px solid #e2e8f0 !important; padding: 10px 14px !important; border-radius: 10px !important; display: flex !important; flex-direction: column !important; gap: 4px !important; }\
                #redesigned-proposal-body .widget-col.full-width { grid-column: 1 / -1 !important; }\
                #redesigned-proposal-body h3 { font-size: 10px !important; color: #64748b !important; margin: 0 !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; }\
                #redesigned-proposal-body span { font-size: 13px !important; color: #0f172a !important; font-weight: 600 !important; word-break: break-word !important; }\
                #redesigned-proposal-body h1, #redesigned-proposal-body h2 { grid-column: 1 / -1 !important; font-size: 13px !important; color: #0284c7 !important; margin: 8px 0 4px 0 !important; font-weight: 700 !important; }\
                #redesigned-proposal-body ul { grid-column: 1 / -1 !important; list-style: none !important; padding: 0 !important; margin: 0 !important; display: flex !important; flex-wrap: wrap !important; gap: 8px !important; }\
                #redesigned-proposal-body li { background: #e0f2fe !important; padding: 6px 12px !important; border-radius: 20px !important; font-size: 12px !important; color: #0369a1 !important; border: 1px solid #bae6fd !important; display: flex !important; align-items: center !important; }\
                #redesigned-proposal-body .payment-row { background: #f0fdf4 !important; border: 1px solid #bbf7d0 !important; font-size: 16px !important; font-weight: 700 !important; color: #166534 !important; display: flex !important; justify-content: space-between !important; align-items: center !important; }\
                #redesigned-proposal-body .payment-row h4 { margin: 0 !important; font-size: 16px !important; color: #0f172a !important; display: flex !important; width: 100% !important; justify-content: space-between !important; align-items: center !important; }\
                #redesigned-proposal-body .payment-row span { font-size: 18px !important; color: #15803d !important; font-weight: 800 !important; }\
            ';

            modalContainer.appendChild(topHeader);
            modalContainer.appendChild(modalBody);
            modalContainer.appendChild(style);
            modal.appendChild(modalContainer);
            document.body.appendChild(modal);

            document.getElementById('close-proposal-modal-btn').onclick = () => {
                modal.style.display = 'none';
            };
        }

        const body = document.getElementById('redesigned-proposal-body');
        if (body) {
            body.innerHTML = '';
            const propSec = document.querySelector('.proposal-sec');
            if (propSec) {
                const cloned = propSec.cloneNode(true);
                // 🛑 Skip .term-cond elements
                cloned.querySelectorAll('.term-cond').forEach(el => {
                    const parentCard = el.closest('.proposal-card');
                    if (parentCard) parentCard.remove();
                    else el.remove();
                });
                body.appendChild(cloned);
            } else {
                body.innerHTML = '<div style="text-align:center; padding:40px; color:rgba(255,255,255,0.5);">Proposal details section not found on page.</div>';
            }
        }

        modal.style.display = 'flex';
    };

    // ====== MAIN RUNNER ======
    const runPopup = () => {
      // 🚀 Initial Cleanup
      startGlobalCleaner(); // 🚀 Start watching for async banners

      // 1. Digital Discount & EMI Option Remover Popups
      if (window.location.href.toLowerCase().includes('portal/')) {
        
        // Create new aggressive popups
        if (!document.getElementById('digital-discount-remover-popup')) {
           createDigitalDiscountRemoverPopup();
        }
        if (!document.getElementById('emi-option-remover-popup')) {
           createEmiOptionRemoverPopup();
        }
      } else {
        // Destroy aggressive popups if navigating away
        const quotePopup = document.getElementById('digital-discount-remover-popup');
        if (quotePopup) { quotePopup.style.display = 'none'; quotePopup.remove(); }
        const emiPopup = document.getElementById('emi-option-remover-popup');
        if (emiPopup) { emiPopup.style.display = 'none'; emiPopup.remove(); }
      }

      // 2. Main Dashboard vs Proposal Summary Popup
      const currentUrl = window.location.href;
      const isProposalPage = currentUrl.includes('proposalGuid=') || currentUrl.includes('portability') || currentUrl.includes('portSummary');

      if (isProposalPage) {
          const oldDashPopup = document.getElementById('my-dashboard-popup');
          if (oldDashPopup) { oldDashPopup.style.display = 'none'; oldDashPopup.remove(); }
          
          createProposalSummaryPopup();
      } else {
          const oldPropPopup = document.getElementById('proposal-summary-popup');
          if (oldPropPopup) {
              if (oldPropPopup.dataset.intervalId) clearInterval(parseInt(oldPropPopup.dataset.intervalId));
              oldPropPopup.remove();
          }

          if (currentUrl.startsWith('https://faveo.careinsurance.com/NewFaveo') && !currentUrl.includes('#auth/login') && !currentUrl.includes('#/auth/resetpwd') && !currentUrl.includes('#/auth/verifyotp') && !currentUrl.includes('#/auth/changepwd')) {
            if (!document.getElementById('my-dashboard-popup')) {
              console.log("%c[UI] %cDashboard UI initialized for URL: %c" + window.location.href, "color:#4FC3F7; font-weight:bold;", "color:#EEEEEE;", "color:#BDBDBD; font-style:italic;");
              const { popup, nameSpan, spinner, buttonContainer } = createPopup();
              addSpinnerStyle();
              setMinimizedView(true); // 🚀 Explicitly force Minimized on startup
              
              setTimeout(() => tryClickProfile(nameSpan, spinner, buttonContainer), 500);
            }
          } else {
             const oldPopup = document.getElementById('my-dashboard-popup');
             if (oldPopup) { oldPopup.style.display = 'none'; oldPopup.remove(); }
          }
      }
    };
    
    // Run again when the URL hash changes (for hash-based SPA routing)
    window.addEventListener('hashchange', runPopup);
    
    // Optional: also listen to popstate in case routing isn't purely hash-based
    window.addEventListener('popstate', runPopup);
    
    // Fallback: periodically check the URL every second (useful in stubborn SPAs)
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        runPopup();
      }
    }, 1000);
    
  
    loadIconCDN();
    runPopup();
  
    // ====== AUTO RUN ON STARTUP (2-HOUR COOLDOWN) ======
    const AUTO_RUN_KEY = 'last_auto_sync_time';
    const COOLDOWN_MS = 2 * 60 * 60 * 1000; // 2 Hours in ms
    
    const lastRun = localStorage.getItem(AUTO_RUN_KEY);
    const currentTime = Date.now();

    chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
        const currentUrl = window.location.href;
        if (currentUrl.includes('proposalGuid=') || currentUrl.includes('portability') || currentUrl.includes('portSummary')) {
            console.log('🛑 [showPopup] Portability/Proposal URL detected! Bypassing Auto-Sync & Extraction.');
            return;
        }
        if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused) {
            console.log('🤖 Autopilot: Master Mode is active. Bypassing standard 2-hour Auto-Sync.');
            return;
        }

        if (!lastRun || (currentTime - parseInt(lastRun) > COOLDOWN_MS)) {
            setTimeout(() => {
                const popup = document.getElementById('my-dashboard-popup');
                if (popup) {
                   console.log("🚀 Automation: 2-hour cooldown passed. Starting 1-Month Sync...");
                   localStorage.setItem(AUTO_RUN_KEY, Date.now().toString()); // Update timestamp
                   handleAutoSyncClick(popup);
                }
            }, 8000); // 8 Sec delay to ensure agent name and DOM is ready
        } else {
            const minsLeft = Math.round((COOLDOWN_MS - (currentTime - parseInt(lastRun))) / 60000);
            console.log(`⏳ Auto-pilot on cooldown. Next run in ~${minsLeft} minutes.`);
        }
    });

    const closeMainMenuIfOpen = () => {
        const mainMenu = document.getElementById('MainMenu');
        if (mainMenu) {
            mainMenu.classList.remove('in', 'show');
            const toggler = document.querySelector('[href="#MainMenu"], [data-target="#MainMenu"], [data-bs-target="#MainMenu"], .menu_icon, .navbar-toggle');
            if (toggler && (toggler.getAttribute('aria-expanded') === 'true' || toggler.classList.contains('active'))) {
                console.log('🤖 Autopilot: Closing MainMenu overlay...');
                toggler.click();
            }
        }
        document.querySelectorAll('.collapse.in, .collapse.show').forEach(el => {
            el.classList.remove('in', 'show');
        });
    };

    // 💤 PREVENT SYSTEM SLEEP during Autopilot
    let wakeLockSentinel = null;
    let noSleepVideo = null;

    const acquireWakeLock = async () => {
        // Primary: Wake Lock API
        if ('wakeLock' in navigator) {
            try {
                wakeLockSentinel = await navigator.wakeLock.request('screen');
                console.log('💤 Wake Lock acquired - system will stay awake.');
                wakeLockSentinel.addEventListener('release', () => {
                    console.log('💤 Wake Lock released.');
                    wakeLockSentinel = null;
                });
            } catch (e) {
                console.warn('💤 Wake Lock failed:', e.message);
            }
        }
        // Fallback: Silent video loop (keeps system awake even when tab is hidden)
        if (!noSleepVideo) {
            noSleepVideo = document.createElement('video');
            noSleepVideo.setAttribute('playsinline', '');
            noSleepVideo.setAttribute('muted', '');
            noSleepVideo.muted = true;
            noSleepVideo.loop = true;
            Object.assign(noSleepVideo.style, { position: 'fixed', top: '-1px', left: '-1px', width: '1px', height: '1px', opacity: '0.01' });
            // Tiny base64 silent mp4 (1-frame, ~300 bytes)
            noSleepVideo.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA' +
                'OhtZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjY0MyA1YzY1NzA0IC0gSC4yNjQvT' +
                'VBFRy00IEFWQyBjb2RlYyAtIENvcHlsZWZ0IDIwMDMtMjAxNSAtIGh0dHA6Ly93d3cudmlkZW9sYW4ub3JnL3gyNjQuaH' +
                'RtbCAtIG9wdGlvbnM6IGNhYmFjPTEgcmVmPTMgZGVibG9jaz0xOjA6MCBhbmFseXNlPTB4MzoweDExMyBtZT1oZXggc3V' +
                'ibWU9NyBwc3k9MSBwc3lfcmQ9MS4wMDowLjAwIG1peGVkX3JlZj0xIG1lX3JhbmdlPTE2IGNocm9tYV9tZT0xIHRyZWxs' +
                'aXM9MSA4eDhkY3Q9MSBjcW09MCBkZWFkem9uZT0yMSwxMSBmYXN0X3Bza2lwPTEgY2hyb21hX3FwX29mZnNldD0tMiB0a' +
                'HJlYWRzPTEgbG9va2FoZWFkX3RocmVhZHM9MSBzbGljZWRfdGhyZWFkcz0wIG5yPTAgZGVjaW1hdGU9MSBpbnRlcmxhY2' +
                'VkPTAgYmx1cmF5X2NvbXBhdD0wIGNvbnN0cmFpbmVkX2ludHJhPTAgYmZyYW1lcz0zIGJfcHlyYW1pZD0yIGJfYWRhcHQ' +
                '9MSBiX2JpYXM9MCBkaXJlY3Q9MSB3ZWlnaHRiPTEgb3Blbl9nb3A9MCB3ZWlnaHRwPTIga2V5aW50PTI1MCBrZXlpbnRf' +
                'bWluPTEgc2NlbmVjdXQ9NDAgaW50cmFfcmVmcmVzaD0wIHJjX2xvb2thaGVhZD00MCByYz1jcmYgbWJ0cmVlPTEgY3JmP' +
                'TIzLjAgcWNvbXA9MC42MCBxcG1pbj0wIHFwbWF4PTY5IHFwc3RlcD00IGlwX3JhdGlvPTEuNDAgYXE9MToxLjAwAIAAAA' +
                'AFZYiEABD//veBfMFGEP0lCHHBZuBBKAAADAABhgr0xAVOAABHhAAAAzEGaJEwIb/+EAAAAAAN0ElpICgAiIAAAA3' +
                'RBmiRMCG/AAAAN0ElpICAABAAAAATRBnkRMCG/AAAAN0ElpICAABAAAAATRBnmhMCG/AAAAN0ElpICAABAAAAATRBnoRMCG' +
                '/AAAAN0ElpICAABAAAAAbEGeyEmoQWiZTAhvwAAAA7QSWkgEAAAA=';
            document.body.appendChild(noSleepVideo);
            noSleepVideo.play().catch(() => {});
            console.log('💤 NoSleep video fallback started.');
        }
    };

    const releaseWakeLock = () => {
        if (wakeLockSentinel) {
            wakeLockSentinel.release();
            wakeLockSentinel = null;
        }
        if (noSleepVideo) {
            noSleepVideo.pause();
            noSleepVideo.remove();
            noSleepVideo = null;
        }
        console.log('💤 Sleep prevention released.');
    };

    // Re-acquire wake lock when tab becomes visible again
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
                if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused && !wakeLockSentinel) {
                    acquireWakeLock();
                } else if (res.autopilot_paused) {
                    releaseWakeLock();
                }
            });
        }
    });

    // Acquire on startup if autopilot is already active & show Master Mode overlay
    chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
        const currentUrl = window.location.href;
        if (currentUrl.includes('proposalGuid=') || currentUrl.includes('portability') || currentUrl.includes('portSummary')) {
            console.log('🛑 [showPopup] Portability/Proposal URL detected! Skipping Autopilot & Extraction overlay.');
            return;
        }
        if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused) {
            acquireWakeLock();
            createExtractionOverlay();
        } else if (res.autopilot_paused) {
            releaseWakeLock();
        }
    });

    // 🔔 Real-time listener for Master Mode toggle changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.is_master_extension || changes.is_autopilot_active || changes.autopilot_paused) {
                chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], (res) => {
                    const currentUrl = window.location.href;
                    if (currentUrl.includes('proposalGuid=') || currentUrl.includes('portability') || currentUrl.includes('portSummary')) {
                        console.log('🛑 [showPopup] Portability/Proposal URL detected! Ignoring Master Mode changes.');
                        return;
                    }
                    const isMasterMode = !!(res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused);
                    if (isMasterMode) {
                        createExtractionOverlay();
                    } else {
                        removeExtractionOverlay(true); // Force remove when Master Mode turns OFF
                    }
                });
            }
        }
    });

    let autopilotState = 'INIT';
    let autopilot5sTimer = null;
    let autopilotFilterTriggered = false; // Guard: prevent multiple handleCustomMonthClick calls
    let autopilotFilterTriggerTime = null; // Timeout fallback for TRIGGER_2M_FILTER

    // 🤖 Autopilot Watchdog and Manager Loop
    setInterval(() => {
        chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused', 'autopilot_last_active_time'], (res) => {
            if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused) {
                createExtractionOverlay();
                const url = window.location.href;
                
                // Skip if we are on login/reset pages
                if (url.includes('#auth/login') || url.includes('#/auth/resetpwd')) return;
                
                // 1. If on dashboard, navigate to proposals page (10s delay)
                if (url.includes('/portal/dashboard')) {
                    if (!window._autopilotDashboardDelayStarted) {
                        window._autopilotDashboardDelayStarted = true;
                        console.log('🤖 Autopilot: Dashboard detected. Redirecting to Proposals in 10 seconds...');
                        setTimeout(() => {
                            autopilotState = 'INIT';
                            autopilotFilterTriggered = false;
                            window._autopilotDashboardDelayStarted = false;
                            window.location.hash = '#/portal/proposals/proposalDetails';
                        }, 10000);
                    }
                }
                
                // 2. If on proposals page, handle two-phase loading state machine
                if (url.includes('/portal/proposals/proposalDetails')) {
                    // Automatically close MainMenu overlay if left open
                    closeMainMenuIfOpen();

                    const popup = document.getElementById('my-dashboard-popup');
                    const customUI = document.getElementById('customMonthActions');
                    const liveModal = document.getElementById('liveExtractModal');
                    const completedModal = document.getElementById('completedExtractModal');

                    // Check main-loading spinner visibility
                    const mainLoader = document.querySelector('.main-loading');
                    const isMainLoaderVisible = mainLoader && (
                        window.getComputedStyle(mainLoader).display !== 'none'
                    );

                    // === STATE: INIT ===
                    if (autopilotState === 'INIT') {
                        if (isMainLoaderVisible) {
                            console.log('🤖 Autopilot State: [INIT] Initial load spinner active. Transition to WAIT_INITIAL_LOAD.');
                            autopilotState = 'WAIT_INITIAL_LOAD';
                        } else {
                            console.log('🤖 Autopilot State: [INIT] No spinner seen. Transition to WAIT_5S_DELAY.');
                            autopilotState = 'WAIT_5S_DELAY';
                            autopilot5sTimer = Date.now();
                        }
                    }
                    // === STATE: WAIT_INITIAL_LOAD ===
                    else if (autopilotState === 'WAIT_INITIAL_LOAD') {
                        if (!isMainLoaderVisible) {
                            console.log('🤖 Autopilot State: [WAIT_INITIAL_LOAD] Spinner gone. Starting 5s delay.');
                            autopilotState = 'WAIT_5S_DELAY';
                            autopilot5sTimer = Date.now();
                        } else {
                            console.log('🤖 Autopilot State: [WAIT_INITIAL_LOAD] Waiting for initial spinner to disappear...');
                        }
                    }
                    // === STATE: WAIT_10S_DELAY ===
                    else if (autopilotState === 'WAIT_5S_DELAY') {
                        const elapsed = Date.now() - autopilot5sTimer;
                        if (elapsed >= 10000) {
                            const attempts = res.autopilot_account_attempts || 0;
                            const monthsToFilter = attempts >= 1 ? 1 : 2; // Fallback to 1-Month on 2nd attempt (after 1 reload)
                            console.log(`🤖 Autopilot State: [WAIT_10S_DELAY] 10s delay passed. Triggering ${monthsToFilter}-Month filter (Attempt ${attempts + 1})...`);
                            autopilotState = 'TRIGGER_2M_FILTER';
                            autopilotFilterTriggerTime = Date.now();
                            // Guard: only trigger filter ONCE
                            if (!autopilotFilterTriggered && popup && !customUI && !liveModal && !completedModal && !isAutoSyncRunning) {
                                autopilotFilterTriggered = true;
                                handleCustomMonthClick(popup, monthsToFilter);
                                console.log(`🤖 Autopilot: handleCustomMonthClick(${monthsToFilter}) triggered (Attempt ${attempts + 1}).`);
                            }
                        } else {
                            console.log('🤖 Autopilot State: [WAIT_10S_DELAY] Delaying (' + Math.round((10000 - elapsed) / 1000) + 's left)...');
                        }
                    }
                    // === STATE: TRIGGER_2M_FILTER ===
                    else if (autopilotState === 'TRIGGER_2M_FILTER') {
                        const filterElapsed = Date.now() - autopilotFilterTriggerTime;
                        if (isMainLoaderVisible) {
                            console.log('🤖 Autopilot State: [TRIGGER_2M_FILTER] Loading started. Transition to WAIT_2M_LOAD.');
                            autopilotState = 'WAIT_2M_LOAD';
                        } else if (filterElapsed >= 10000) {
                            // Fallback: If spinner never appeared after 10 seconds (small dataset), go directly to extraction
                            console.log('🤖 Autopilot State: [TRIGGER_2M_FILTER] Spinner never appeared (10s timeout). Starting extraction in 10s...');
                            autopilotState = 'START_EXTRACTION';
                            chrome.storage.local.set({ autopilot_last_active_time: Date.now() });
                            setTimeout(() => { extractRenewalTableData(); }, 10000);
                        } else {
                            console.log('🤖 Autopilot State: [TRIGGER_2M_FILTER] Waiting for spinner to show... (' + Math.round(filterElapsed / 1000) + 's)');
                        }
                    }
                    // === STATE: WAIT_2M_LOAD ===
                    else if (autopilotState === 'WAIT_2M_LOAD') {
                        if (!isMainLoaderVisible) {
                            console.log('🤖 Autopilot State: [WAIT_2M_LOAD] Spinner gone. Starting extraction in 10s...');
                            autopilotState = 'START_EXTRACTION';
                            chrome.storage.local.set({ autopilot_last_active_time: Date.now() });
                            setTimeout(() => { extractRenewalTableData(); }, 10000);
                        } else {
                            // ⏳ Do NOT refresh last_active while spinner is active, so 3-min hard timeout measures exact load time from filter click!
                            console.log('🤖 Autopilot State: [WAIT_2M_LOAD] Spinner active. Waiting for load to finish (Max 3m)...');
                        }
                    }
                    // === STATE: START_EXTRACTION (terminal - extraction is running) ===
                    else if (autopilotState === 'START_EXTRACTION') {
                        // Do nothing - extraction is in progress, managed by extractRenewalTableData
                        chrome.storage.local.set({ autopilot_last_active_time: Date.now() });
                    }
                }

                // 3. Watchdog Check (Reload page or skip agent if loading/inactivity > 3 minutes)
                const lastActive = res.autopilot_last_active_time || Date.now();
                if (Date.now() - lastActive > 180000) { // 3 Minutes (180,000ms) Hard Timeout
                    const currentAttempts = res.autopilot_account_attempts || 0;
                    if (currentAttempts >= 1) {
                        // Attempt 2 (1-Month filter) also exceeded 3 minutes -> Logout & Skip to Next Agent!
                        console.error('❌ Autopilot: Attempt 2 (1-Month filter) also exceeded 3 minutes loading! Logging out & skipping to next agent...');
                        const nextIndex = (res.autopilot_index + 1) % (res.autopilot_agents ? res.autopilot_agents.length : 1);
                        const delayMs = (nextIndex === 0) ? (10 * 60 * 1000) : (2 * 60 * 1000);
                        chrome.storage.local.set({ 
                            autopilot_index: nextIndex,
                            autopilot_account_attempts: 0,
                            autopilot_last_active_time: Date.now(),
                            autopilot_next_login_time: Date.now() + delayMs
                        }, () => {
                            const logoutBtn = document.querySelector('li.logout a') || document.querySelector('.logout a') || [...document.querySelectorAll('a')].find(a => a.textContent.toLowerCase().includes('log out') || a.textContent.toLowerCase().includes('logout'));
                            if (logoutBtn) {
                                logoutBtn.click();
                            } else {
                                window.location.hash = '#/auth/login';
                                window.location.reload();
                            }
                        });
                    } else {
                        // Attempt 1 (2-Month filter) exceeded 3 minutes -> Reload & try Attempt 2 (1-Month filter)
                        console.warn('⚠️ Autopilot: Attempt 1 (2-Month filter) exceeded 3 minutes loading! Reloading to try Attempt 2 (1-Month filter)...');
                        chrome.storage.local.set({ 
                            autopilot_last_active_time: Date.now(),
                            autopilot_account_attempts: 1
                        }, () => {
                            window.location.reload();
                        });
                    }
                }
            }
        });
    }, 4000);

})();
  
