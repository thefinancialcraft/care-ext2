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

      // 🧹 Cleanup Observer: Remove unwanted sidebar Renewal elements
      const observer = new MutationObserver(() => {
          const unwantedUl = document.querySelector('ul.list-group.panel:has(.side_renewal_navigation)');
          if (unwantedUl) {
              unwantedUl.remove();
              console.log('🧹 Cleaned up unwanted Renewal sidebar element.');
          }
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

      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '<i class="fi flex fi-br-cross"></i>';
      Object.assign(closeBtn.style, {
        background: 'transparent', color: '#bcbcbc', border: 'none', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
      });
      closeBtn.onclick = () => stopAllExtensionProcesses();
  
      topBtnGroup.appendChild(minimizeBtn);
      topBtnGroup.appendChild(closeBtn);
  
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

        const closeBtn = document.createElement('button');
        closeBtn.id = 'miniCloseBtn';
        closeBtn.innerHTML = '<i class="fi flex fi-br-cross"></i>';
        Object.assign(closeBtn.style, {
            display: 'none', // 🚀 Hidden by default
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)',
            fontSize: '10px', cursor: 'pointer', padding: '4px', borderRadius: '50%',
            width: '24px', height: '24px', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s'
        });
        closeBtn.title = 'Close Extension';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            stopAllExtensionProcesses();
        };
        closeBtn.onmouseover = () => { 
            closeBtn.style.background = 'rgba(244,67,54,0.3)'; 
            closeBtn.style.color = '#fff'; 
        };
        closeBtn.onmouseout = () => { 
            closeBtn.style.background = 'transparent'; 
            closeBtn.style.color = 'rgba(255,255,255,0.5)'; 
        };



        bar.append(toggleBtn, nameHandle, statsArea, autoPilotBtn, resumeBtn, expandBtn, closeBtn, miniProgress);
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
  
      const buttonNames = ['Current Month', 'Custom Month', '⚡ Auto Sync'];
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
        } else if (name === 'Custom Month') {
          btn.onclick = () => handleCustomMonthClick(popup);
        } else if (name === '⚡ Auto Sync') {
          btn.onclick = () => handleAutoSyncClick(popup);
        }
  
        container.appendChild(btn);
      });
  
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
    
const createCustomMonthActionUI = () => {
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

    const firstOfMonth = new Date();
    firstOfMonth.setDate(1);
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
                // 🚀 3. Max attempts reached
                console.error('❌ Failed to fetch agent name after 5 attempts.');
                nameSpan.innerText = 'System User'; // Generic but not just 'Agent'
                spinner.style.display = 'none';
                buttonContainer.style.display = 'flex';
                updateMinimizedStatus();
                removeInitialOverlay();
                
                // Try to return to dashboard as a courtesy
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



      // Main Handler Function
const handleCustomMonthClick = () => {

    const popup = document.getElementById('my-dashboard-popup');

    popup.style.maxHeight = '500px';
  
    const buttonContainer = document.getElementById('mainActBtn');
    if (buttonContainer) buttonContainer.remove();

  
    const spinner = createSpinner();
    spinner.style.display = 'flex'; // 🌪️ Show explicitly for extraction
    popup.appendChild(spinner);
  
    setTimeout(() => {
      spinner.remove();
  
      const customUI = createCustomMonthActionUI();
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

        // 4. Start Extraction
        setTimeout(() => {
            spinner.remove();
            extractRenewalTableData();
        }, 1500);

    }, 6000); // 🚀 Wait 6 seconds for initial table/page load before filling dates
  };
  
      

      
    // ====== TABLE DATA EXTRACTOR ======
    let currentPageNum = 1; // 🚀 Global storage for pages scanned


    const extractRenewalTableData = () => {
      extensionGlobalActive = true; // 🛡️ Force globally active before starting

      // PREVENT MULTIPLE CONCURRENT EXTRACTIONS
      if (document.getElementById('liveExtractModal')) {
         console.warn('-- Extraction is already running --');
         return;
      }

      // Cleanup old completed modals if user starts a totally fresh run
      const oldCompleted = document.querySelectorAll('#completedExtractModal');
      oldCompleted.forEach(m => m.remove());

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

      let retryCount = 0;
      const maxRetries = 40; // 🚀 Wait up to 20 seconds

      const startExtractionWithWait = () => {
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
                const spinner = document.querySelector('.spinner'); 
                if (spinner) spinner.remove();
            }, 1000);

            if (isAutoSyncRunning) {
                console.log('⚡ AutoSync: Extraction complete. Starting automatic API upload...');
                setTimeout(() => { sendDataToAppScript(); }, 2500);
            }
        };

        const pauseExtractionWithError = (msg, page) => {
            console.error(`❌ Error: ${msg} (Page ${page})`);
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
                
                if ((nowContent !== beforeContent && nowRows > 0) || attempts > 30) {
                    clearInterval(checkLoad);
                    if (attempts > 30) {
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


    // ====== SEND DATA TO APPSCRIPT ======
    function sendDataToAppScript() {

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
          console.log(`📡 Sending ${accumulatedData.length} records to background for API upload...`);
          // Send data to background
          chrome.runtime.sendMessage({
            type: 'TABLE_DATA',
            payload: accumulatedData
          });
      } catch (e) {
          console.error('Failed to send message:', e);
      }
    }
    
    

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
          p.chunkSize
        );
        console.log(`📊 [UI] Progress bar and stats updated.`);
        console.log(`---------------------------------------------------------`);
        console.groupEnd();

      } else if (message.type === 'UPLOAD_ERROR') {
        console.error(`%c❌ [UPLOAD ERROR] %cBackground Failed: %c${message.payload.error}`, "color:red; font-weight:bold;", "color:#e67e22; font-weight:bold;", "color:red;");
        isAutoSyncRunning = false; // 🚀 Reset UI state on error
        handleUploadErrorUI(message.payload);
        updateMinimizedStatus(); // 🔄 Reset UI
      } else if (message.type === 'UPLOAD_COMPLETE') {
        const p = message.payload;
        console.log(`%c🏆 [COMPLETE] %cBackground confirmed final transmission.`, "color:#f1c40f; font-weight:bold; font-size:12px;", "color:#e67e22; font-weight:bold;");
        isAutoSyncRunning = false; // 🚀 Finished! Reset for next run
        updateProgress(100, p.total, p.total, 0, null, null, null, null, 10, p.preChecked);
        updateMinimizedStatus(); // 🔄 Reset Super-Compact UI
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

    function updateProgress(percent, uploadedCount = 0, totalCount = 0, estSecondsLeft = null, currentLead = null, avgChunkTime = null, lastBatchTime = null, chunkHistory = [], chunkSize = 10, preChecked = false) {
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
         const speedText = lastBatchTime ? ` | Batch: ${(lastBatchTime/1000).toFixed(1)}s` : '';
         if (estTimeText) estTimeText.innerText = `Estimated Time: ${formatTime(globalRemainingSeconds)}${speedText}`;
         
         const resumeBtn = document.getElementById('resumeUploadBtn');
         const isPaused = resumeBtn && resumeBtn.style.display !== 'none';

         if (countdownInterval) clearInterval(countdownInterval);
         
         if (!isPaused && isAutoSyncRunning) {
             countdownInterval = setInterval(() => {
                if (globalRemainingSeconds > 0 && isAutoSyncRunning) {
                   globalRemainingSeconds--;
                   if (estTimeText) { 
                       const speedText = lastBatchTime ? ` | Batch: ${(lastBatchTime/1000).toFixed(1)}s` : '';
                       estTimeText.innerText = `Estimated Time: ${formatTime(globalRemainingSeconds)}${speedText}`;
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


  
    // 🎮 Tic-Tac-Toe Overlay Variables
    let isExtractionPhaseDone = false;
    let extractionOverlayEl = null;
    let tttBoard = Array(9).fill(null);
    let tttCurrentTurn = 'X'; // Symbol that moves next
    let tttHumanSymbol = 'X'; 
    let tttComputerSymbol = 'O';
    let tttGameCount = 0; // 📉 Track games to prevent 1st match human win
    let tttIsBotDumbThisMatch = false; // 🤖 Match-level difficulty flag

    const removeExtractionOverlay = () => {
        if (extractionOverlayEl) {
            extractionOverlayEl.style.opacity = '0';
            setTimeout(() => {
                extractionOverlayEl?.remove();
                extractionOverlayEl = null;
            }, 500);
        }
    };

    const createExtractionOverlay = () => {
        if (extractionOverlayEl) return;
        isExtractionPhaseDone = false;
        isGamePlaying = false;
        tttBoard = Array(9).fill(null);

        const overlay = document.createElement('div');
        overlay.id = 'extraction-game-overlay';
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
                <button id="start-ttt-btn" style="
                    padding:12px 30px; border:none; border-radius:30px; 
                    background: linear-gradient(135deg, #00c853, #64dd17); 
                    color:#fff; font-weight:bold; font-size:16px; cursor:pointer; 
                    box-shadow: 0 4px 15px rgba(0,200,83,0.3); transition: transform 0.2s;">
                    Play Tic-Tac-Toe
                </button>
            </div>
            
            <div id="ttt-game-container" style="display:none; text-align:center; animation:zoomIn 0.5s ease;">
                <h3 id="ttt-status" style="margin-bottom:20px; color:#e3f2fd;">Your Turn (X)</h3>
                <div id="ttt-grid-wrapper" style="position:relative; display:inline-block;">
                    <div id="ttt-grid" style="
                        display:grid; grid-template-columns: repeat(3, 100px); 
                        grid-template-rows: repeat(3, 100px); gap:10px; 
                        background:rgba(255,255,255,0.1); padding:10px; border-radius:15px;
                        border: 2px solid rgba(255,255,255,0.2);">
                        ${Array(9).fill(0).map((_, i) => `<div class="ttt-cell" data-index="${i}" style="
                            width:100px; height:100px; background:rgba(255,255,255,0.05);
                            border-radius:10px; display:flex; align-items:center; justify-content:center;
                            font-size:40px; font-weight:bold; cursor:pointer; transition:0.2s;"></div>`).join('')}
                    </div>
                    <!-- ✍️ Winning Line -->
                    <div id="ttt-win-line" style="
                        position:absolute; background:#fff; height:6px; border-radius:3px;
                        display:none; pointer-events:none; transition: width 0.5s ease, opacity 0.3s;
                        box-shadow: 0 0 15px #fff, 0 0 30px #4fc3f7; z-index:10; transform-origin: left center;">
                    </div>
                </div>
                <div id="ttt-msg" style="margin-top:20px; font-weight:bold; min-height:60px;"></div>
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
            </style>
        `;

        document.body.appendChild(overlay);
        extractionOverlayEl = overlay;

        const playGameSound = (type) => {
            try {
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (audioCtx.state === 'suspended') {
                    audioCtx.resume();
                }

                const playTone = (freq, duration, type='sine') => {
                    const osc = audioCtx.createOscillator();
                    const gain = audioCtx.createGain();
                    osc.connect(gain);
                    gain.connect(audioCtx.destination);
                    osc.type = type;
                    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                    
                    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
                    
                    osc.start();
                    osc.stop(audioCtx.currentTime + duration);
                };

                if (type === 'X') playTone(600, 0.1, 'sine'); // High beep
                else if (type === 'O') playTone(400, 0.1, 'sine'); // Low beep
                else if (type === 'win') {
                   [600, 800, 1000].forEach((f, i) => setTimeout(() => playTone(f, 0.3), i * 150));
                } else if (type === 'draw') {
                   [400, 300, 200].forEach((f, i) => setTimeout(() => playTone(f, 0.3), i * 150));
                }
            } catch (e) {
                console.warn('Web Audio API blocked or failed:', e);
            }
        };

        // Event Listeners
        const determineFirstTurn = () => {
             // 🎲 Randomly assign symbols to Human/Computer
             if (Math.random() < 0.5) {
                 tttHumanSymbol = 'X';
                 tttComputerSymbol = 'O';
             } else {
                 tttHumanSymbol = 'O';
                 tttComputerSymbol = 'X';
             }

             const statusText = document.getElementById('ttt-status');
             tttGameCount++;
             tttCurrentTurn = 'X';
             tttIsBotDumbThisMatch = (tttGameCount > 1 && Math.random() < 0.1);
             
             if (tttHumanSymbol === 'X') {
                 if (statusText) statusText.innerText = `You are 'X' - Your Turn!`;
             } else {
                 if (statusText) statusText.innerText = `You are 'O' - Computer's Turn ('X')...`;
                 setTimeout(makeComputerMove, 1000);
             }
        };

        const startBtn = overlay.querySelector('#start-ttt-btn');
        startBtn.addEventListener('click', () => {
            isGamePlaying = true;
            overlay.querySelector('#ttt-intro-box').style.display = 'none';
            overlay.querySelector('#ttt-game-container').style.display = 'block';
            
            // 🚀 Warm-up AudioContext and Decide first turn
            playGameSound('X'); 
            determineFirstTurn();
        });

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
            if (result === 'O') return 10 - depth;
            if (result === 'X') return depth - 10;
            if (!board.includes(null)) return 0;

            if (isMaximizing) {
                let bestScore = -Infinity;
                for (let i = 0; i < 9; i++) {
                    if (board[i] === null) {
                        board[i] = 'O';
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
                        board[i] = 'X';
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
            // 🎲 10% Match-level chance for Bot to make exactly ONE mistake
            // (Note: This never triggers if tttIsBotDumbThisMatch is false, e.g., in 1st match)
            if (tttIsBotDumbThisMatch) {
                tttIsBotDumbThisMatch = false; // 🚀 Use up the 'mercy' mistake
                const availableMoves = tttBoard.map((val, idx) => (val === null ? idx : null)).filter(val => val !== null);
                if (availableMoves.length > 0) {
                    move = availableMoves[Math.floor(Math.random() * availableMoves.length)];
                }
            }

            // 🤖 Use Minimax for perfect play
            if (move === undefined) {
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
    };

    // ====== MAIN RUNNER ======
    const runPopup = () => {
      // 🚀 Initial Cleanup
      startGlobalCleaner(); // 🚀 Start watching for async banners

      if (window.location.href.includes('/portal/dashboard')) {
        if (!document.getElementById('my-dashboard-popup')) {
          console.log("%c[UI] %cDashboard UI initialized for URL: %c" + window.location.href, "color:#4FC3F7; font-weight:bold;", "color:#EEEEEE;", "color:#BDBDBD; font-style:italic;");
          const { popup, nameSpan, spinner, buttonContainer } = createPopup();
          addSpinnerStyle();
          setMinimizedView(true); // 🚀 Explicitly force Minimized on startup
          
          setTimeout(() => tryClickProfile(nameSpan, spinner, buttonContainer), 500);
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

})();
  