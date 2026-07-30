(function() {
    if (window.favLoginMonitorStarted) return;
    window.favLoginMonitorStarted = true;

    var getKey = function(obj, pattern) {
        if (!obj) return null;
        var lowerPattern = pattern.toLowerCase();
        var foundKey = Object.keys(obj).find(function(k) {
            return k.toLowerCase().replace(/_/g, ' ') === lowerPattern || k.toLowerCase() === lowerPattern || k.toLowerCase().replace(/\s+/g, '_') === lowerPattern;
        });
        return foundKey ? obj[foundKey] : null;
    };

    var getOtpApiUrl = function(agent) {
        if (!agent) return null;
        return getKey(agent, 'agent_otp_finder') || 
               getKey(agent, 'agent otp finder') || 
               getKey(agent, 'otp finder') || 
               getKey(agent, 'otp_finder') || 
               getKey(agent, 'otp_url') || 
               getKey(agent, 'otp url') ||
               getKey(agent, 'otp');
    };

    var updateUIToOTPState = function(agent, list) {
        var statusMsg = document.getElementById('favLoginStatus');
        if (statusMsg) statusMsg.innerText = 'Waiting for OTP...';
        
        var loader = document.getElementById('favDancingDots');
        if (loader) loader.style.display = 'flex';

        var otpGroup = document.querySelector('.otp-group');
        if (!otpGroup && list) {
            otpGroup = document.createElement('div');
            otpGroup.className = 'otp-group';
            for (var i = 0; i < 6; i++) {
                var box = document.createElement('div');
                box.className = 'otp-box'; box.id = 'otp-box-' + i;
                box.innerHTML = '<div class="otp-dot" id="otp-dot-'+i+'"></div>';
                otpGroup.appendChild(box);
            }
            list.appendChild(otpGroup);
        } else if (otpGroup) {
            for (var j = 0; j < 6; j++) {
                var b = document.getElementById('otp-box-' + j);
                if (b) { b.innerHTML = '<div class="otp-dot"></div>'; b.style.background = ''; }
            }
        }

        // 🚀 Trigger OTP Fetch for Agent
        setTimeout(function() {
            if (agent) {
                fetchAndFillOtp(agent, 0); 
            }
        }, 2000);
    };

    var fetchAndFillOtp = function(agent, retryCount) {
        retryCount = retryCount || 0;
        var apiUrl = getOtpApiUrl(agent);
        var statusMsg = document.getElementById('favLoginStatus');
        
        console.log('🔍 [favLogin] Fetching OTP for agent:', agent, 'API URL:', apiUrl);

        if (apiUrl) {
            if (statusMsg) statusMsg.innerText = 'Fetching OTP (Attempt ' + (retryCount + 1) + '/20)...';
            
            fetch(apiUrl)
                .then(function(res) { return res.json(); })
                .then(function(data) {
                    console.log('📥 [favLogin] OTP API Response:', data);
                    var otpDate = data.date ? new Date(data.date).getTime() : 0;
                    var now = Date.now();
                    var diffMinutes = otpDate > 0 ? ((now - otpDate) / (1000 * 60)) : 0;

                    if (otpDate === 0 || diffMinutes <= 3) {
                        displayOtpAndSubmit(data, agent);
                    } else {
                        if (retryCount < 20) {
                            setTimeout(function() {
                                fetchAndFillOtp(agent, retryCount + 1);
                            }, 3000);
                        } else {
                            if (statusMsg) statusMsg.innerText = 'OTP request timed out. Retrying...';
                            setTimeout(function() { fetchAndFillOtp(agent, 0); }, 3000);
                        }
                    }
                })
                .catch(function(err) {
                    console.error('❌ OTP Fetch error:', err);
                    if (retryCount < 20) {
                        setTimeout(function() {
                            fetchAndFillOtp(agent, retryCount + 1);
                        }, 3000);
                    }
                });
        } else {
            console.error('❌ No agent_otp_finder URL found for agent:', agent);
            if (statusMsg) statusMsg.innerText = 'No OTP Finder URL configured for this agent.';
        }
    };

    var displayOtpAndSubmit = function(otpData, agent) {
        console.log('🚀 [favLogin] OTP Received:', otpData);
        var statusMsg = document.getElementById('favLoginStatus');
        var timeStr = (new Date()).toTimeString().split(' ')[0];
        
        if (statusMsg) {
            statusMsg.innerHTML = 'OTP Received! <i class="fi flex fi-rr-refresh reload-btn" id="favOtpReload"></i> <span style="font-size:9px; opacity:0.6; display:block;">at ' + timeStr + '</span>';
            var reloadBtn = document.getElementById('favOtpReload');
            if (reloadBtn) {
                reloadBtn.onclick = function() { 
                    this.style.transform = 'rotate(360deg)';
                    updateUIToOTPState(agent, document.getElementById('agentListContainer')); 
                };
            }
        }
        
        var currentUrl = window.location.href.toLowerCase();
        if (!currentUrl.includes('resetpwd') && !currentUrl.includes('verifyotp')) {
            if (window.otpRedirectTimeout) clearTimeout(window.otpRedirectTimeout);
            window.otpRedirectTimeout = setTimeout(function() {
                var checkUrl = window.location.href.toLowerCase();
                if (!checkUrl.includes('lportal') && !checkUrl.includes('dashboard')) {
                    console.warn('⚠️ OTP Submitted, but no redirection after 10s!');
                }
            }, 10000);
        }

        var loader = document.getElementById('favDancingDots');
        if (loader) loader.style.display = 'none';

        var otpVal = null;
        if (typeof otpData === 'object' && otpData !== null) {
            otpVal = otpData.otp || otpData.code || otpData.data || otpData.otp_code || otpData.otpNumber || otpData.otp_number;
        }
        if (!otpVal) otpVal = otpData;

        var rawData = typeof otpVal === 'string' ? otpVal : (typeof otpVal === 'number' ? String(otpVal) : JSON.stringify(otpVal));
        var otpArr = rawData.match(/\d/g);

        if (otpArr && otpArr.length >= 6) {
            var fullOtp = otpArr.slice(0, 6).join('');
            console.log('✅ [favLogin] Extracted OTP Code:', fullOtp);

            for (var i = 0; i < 6; i++) {
                var box = document.getElementById('otp-box-' + i);
                if (box) { 
                    box.innerHTML = otpArr[i]; 
                    box.style.color = '#fff';
                    box.style.background = 'rgba(76, 175, 80, 0.2)'; 
                }
            }

            var otpInput = document.getElementById('passwordOtp') || document.querySelector('input[formcontrolname="otp"]');
            var submitBtn = document.getElementById('sign_in_btn') || document.getElementById('verfy_otp_btn') || document.querySelector('#verfy_otp_btn');

            if (otpInput) {
                otpInput.focus();
                otpInput.value = fullOtp;
                otpInput.dispatchEvent(new Event('input', { bubbles: true }));
                otpInput.dispatchEvent(new Event('change', { bubbles: true }));
                otpInput.dispatchEvent(new Event('keyup', { bubbles: true }));
                otpInput.dispatchEvent(new Event('blur', { bubbles: true }));
                
                setTimeout(function() { 
                    if (!submitBtn) {
                        submitBtn = document.getElementById('verfy_otp_btn') || document.querySelector('#verfy_otp_btn') || document.querySelector('.login-btn');
                    }
                    if (submitBtn && submitBtn.isConnected) { 
                        console.log('🏁 Submitting OTP to button:', submitBtn);
                        submitBtn.disabled = false;
                        submitBtn.removeAttribute('disabled');
                        submitBtn.click(); 
                    } 
                }, 800);
            }
        } else {
            console.error('❌ [favLogin] OTP not ready / invalid length:', otpArr);
            if (statusMsg) { statusMsg.innerText = 'OTP not ready. Re-fetching latest OTP (1/5)...'; }

            // 🔁 Retry fetch 5 times before resending
            var retryFetchOtp = function(attemptsLeft) {
                if (attemptsLeft <= 0) {
                    console.log('🔄 [favLogin] All re-fetch attempts done. Clicking Resend OTP...');
                    if (statusMsg) { statusMsg.innerText = 'No valid OTP found. Resending OTP...'; statusMsg.style.color = '#ff9800'; }
                    var resendLink = document.querySelector('.unlock a') ||
                                     document.querySelector('#resend_otp_btn') ||
                                     Array.from(document.querySelectorAll('a, button')).find(function(el) {
                                         return (el.innerText || '').toLowerCase().includes('resend');
                                     });
                    if (resendLink) {
                        console.log('🔄 [favLogin] Resend OTP clicked.');
                        resendLink.click();
                    }
                    setTimeout(function() {
                        if (statusMsg) { statusMsg.innerText = 'Fetching OTP after resend...'; statusMsg.style.color = '#4fc3f7'; }
                        if (agent) fetchAndFillOtp(agent, 0);
                    }, 3500);
                    return;
                }
                if (statusMsg) statusMsg.innerText = 'Re-fetching latest OTP (attempt ' + (6 - attemptsLeft) + '/5)...';
                var apiUrl = getOtpApiUrl(agent);
                if (!apiUrl || !agent) { retryFetchOtp(0); return; }
                fetch(apiUrl)
                    .then(function(res) { return res.json(); })
                    .then(function(data) {
                        var otpDate = data.date ? new Date(data.date).getTime() : 0;
                        var now = Date.now();
                        var diffMinutes = otpDate > 0 ? ((now - otpDate) / (1000 * 60)) : 999;
                        if (otpDate !== 0 && diffMinutes <= 3) {
                            console.log('✅ [favLogin] Fresh OTP fetched on retry! Submitting...');
                            displayOtpAndSubmit(data, agent);
                        } else {
                            console.log('⏳ OTP not fresh yet. Retrying in 2s... (' + attemptsLeft + ' left)');
                            setTimeout(function() { retryFetchOtp(attemptsLeft - 1); }, 2000);
                        }
                    })
                    .catch(function() {
                        setTimeout(function() { retryFetchOtp(attemptsLeft - 1); }, 2000);
                    });
            };

            retryFetchOtp(5);
        }
    };

    var showGlobalError = function(msg) {
        var listContainer = document.getElementById('agentListContainer');
        if (listContainer) {
            listContainer.innerHTML = '<div style="color:#ff5252; padding:20px 10px; font-size:13px; text-align:center; font-weight:600; animation: favSlideDown 0.3s ease;">' + (msg || 'Something went wrong, try again') + '</div>';
        }
    };

    var loadModernIcons = function() {
        var href = 'https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css';
        if (!document.querySelector('link[href="' + href + '"]')) {
            var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link);
        }
    };

    var createLoginPopup = function() {
        if (document.getElementById('favLoginPopup')) return;

        // 🔒 [SECURITY] Clear authorization on every page reload
        chrome.storage.local.set({ isAuthorized: false });
        
        // 🧹 Clear all inputs on the page immediately for security
        try {
            document.querySelectorAll('input').forEach(function(input) {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        } catch (e) {
            console.error('Failed to clear inputs:', e);
        }

        var container = document.createElement('div');
        container.id = 'favLoginPopup';
        Object.assign(container.style, {
            position: 'fixed', top: '20px', right: '20px',
            width: '320px', background: 'rgba(30, 58, 95, 0.98)', backdropFilter: 'blur(15px)',
            borderRadius: '16px', boxShadow: '0 12px 40px rgba(0,0,0,0.3)', zIndex: '2147483647',
            fontFamily: "'Segoe UI', Roboto, sans-serif", padding: '20px', display: 'flex',
            flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)',
            animation: 'favSlideDown 0.6s cubic-bezier(0.23, 1, 0.32, 1)', transition: 'all 0.4s ease'
        });

        var style = document.getElementById('favLoginStyles');
        if (!style) {
            style = document.createElement('style'); style.id = 'favLoginStyles';
            style.innerHTML = '\
                .flex { display: flex !important; align-items: center; justify-content: center; }\
                #agentListContainer { display: flex !important; flex-direction: column !important; overflow-y: auto !important; max-height: 220px !important; gap: 6px; scrollbar-width: none; -ms-overflow-style: none; }\
                #agentListContainer::-webkit-scrollbar { display: none !important; }\
                @keyframes favSlideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }\
                .agent-card { width: 100%; padding: 12px 15px; border: none; border-radius: 12px; background: rgba(255, 255, 255, 0.05); color: #fff; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s ease; border: 1px solid rgba(255,255,255,0.05); position: relative; }\
                .agent-card:hover { background: rgba(255, 255, 255, 0.1); border-color: #0065b3; box-shadow: 0 0 0 2px rgba(0, 101, 179, 0.5); }\
                .agent-icon-box { width: 32px; height: 32px; background: #0065b3; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }\
                .key-badge { margin-left: auto; font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.15); padding: 3px 8px; border-radius: 6px; color: rgba(255,255,255,0.9); border: 1px solid rgba(255,255,255,0.1); display: flex !important; align-items: center; justify-content: center; min-width: 26px; height: 24px; transition: all 0.2s; }\
                .key-badge i { display: none !important; font-size: 10px; }\
                .key-badge:hover { background: #0065b3; color: #fff; border-color: transparent; }\
                .key-badge:hover span { display: none !important; }\
                .key-badge:hover i { display: flex !important; }\
                .fav-login-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.1); cursor: move; user-select: none; }\
                .fav-login-title { font-size: 15px; font-weight: 600; color: #fff; margin: 0; }\
                .dancing-dots { display: flex; gap: 4px; margin-top: 15px; justify-content: center; }\
                .dot { width: 8px; height: 8px; background: #4caf50; border-radius: 50%; animation: dance 0.6s infinite alternate; }\
                @keyframes dance { from { transform: translateY(0); opacity: 0.3; } to { transform: translateY(-8px); opacity: 1; } }\
                .otp-group { display: flex; gap: 8px; margin-top: 15px; justify-content: center; }\
                .otp-box { width: 36px; height: 44px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 700; color: #4caf50; }\
                .otp-dot { width: 6px; height: 6px; background: #0065b3; border-radius: 50%; animation: otp-pulse 1.2s infinite; }\
                @keyframes otp-pulse { 0% { opacity: 0.2; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.3); background: #4caf50; } 100% { opacity: 0.2; transform: scale(0.8); } }\
                .close-btn { background: transparent; border: none; color: rgba(255,255,255,0.5); cursor: pointer; padding: 5px; font-size: 18px; transition: color 0.2s; }\
                .close-btn:hover { color: #f44336; }\
                .reload-btn { cursor: pointer; color: #0065b3; margin-left: 8px; transition: transform 0.3s; display: inline-flex !important; }\
            '; document.head.appendChild(style);
        }

        var closeBtn = document.createElement('button');
        closeBtn.className = 'close-btn flex';
        closeBtn.style.cssText = 'position:absolute; top:12px; right:12px; z-index:100;';
        closeBtn.innerHTML = '<i class="fi fi-rr-cross-small"></i>';
        closeBtn.onclick = function() { container.remove(); };
        container.appendChild(closeBtn);

        var header = document.createElement('div');
        header.className = 'fav-login-header';
        header.innerHTML = '<div style="display:flex; align-items:center; gap:10px;"><i class="fi flex fi-rr-shield-lock" style="color:#ffb300; font-size:18px;"></i><h3 class="fav-login-title">Secure Access</h3></div>';
        container.appendChild(header);

        var list = document.createElement('div');
        list.id = 'agentListContainer';
        list.innerHTML = '<div style="color:rgba(255,255,255,0.4); font-size:12px; padding:20px; text-align:center;">Verifying Authorization...</div>';
        container.appendChild(list);

        var handleAutopilotError = function() {
            chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused', 'autopilot_index', 'autopilot_agents'], function(res) {
                if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused && res.autopilot_agents && res.autopilot_agents.length > 0) {
                    var nextIndex = (res.autopilot_index + 1) % res.autopilot_agents.length;
                    var delayMs = (nextIndex === 0) ? (10 * 60 * 1000) : (2 * 60 * 1000);
                    chrome.storage.local.set({
                        autopilot_index: nextIndex,
                        autopilot_account_attempts: 0,
                        autopilot_next_login_time: Date.now() + delayMs
                    }, function() {
                        console.log('🤖 Autopilot Error handler: Reloading page to try next agent index ' + nextIndex + '...');
                        window.location.reload();
                    });
                }
            });
        };

        var runAutopilotUI = function(agents, nextLoginTime, currentIndex) {
            list.innerHTML = '';
            var autoCard = document.createElement('div');
            autoCard.style.cssText = 'padding:15px; text-align:center; background:rgba(255,255,255,0.05); border-radius:12px; border:1px solid rgba(255,255,255,0.1); margin:10px; display:flex; flex-direction:column; gap:10px;';
            
            var agent = agents[currentIndex];
            if (!agent) {
                chrome.storage.local.set({ autopilot_index: 0 }, function() {
                    onAuthorized();
                });
                return;
            }
            var aName = getKey(agent, 'agent name') || getKey(agent, 'agent_name') || 'Unknown';
            var aId = getKey(agent, 'agent id') || getKey(agent, 'agent_id') || '--';

            autoCard.innerHTML = '\
                <div style="font-size:11px; color:#ff9800; font-weight:700; text-transform:uppercase; letter-spacing:1.5px;">Autopilot Active</div>\
                <div style="font-size:14px; font-weight:600; color:#fff; margin-top:5px;">Next: ' + aName + '</div>\
                <div style="font-size:10px; color:rgba(255,255,255,0.4);">ID: ' + aId + '</div>\
                <div style="font-size:26px; font-weight:700; color:#4caf50; margin:10px 0;" id="autoCountdown">--s</div>\
            ';
            
            var pauseBtn = document.createElement('button');
            pauseBtn.className = 'agent-card';
            pauseBtn.style.cssText = 'background:#ff9800; color:#fff; border:none; justify-content:center; height:36px; margin:0;';
            pauseBtn.innerHTML = '<div style="font-weight:700; font-size:12px;">PAUSE AUTOPILOT</div>';
            autoCard.appendChild(pauseBtn);
            list.appendChild(autoCard);

            var updateTimer = function() {
                var timeLeft = Math.max(0, Math.ceil((nextLoginTime - Date.now()) / 1000));
                var cdEl = document.getElementById('autoCountdown');
                if (cdEl) {
                    var mins = Math.floor(timeLeft / 60);
                    var secs = timeLeft % 60;
                    var displayStr = mins > 0 ? (mins + 'm ' + (secs < 10 ? '0' : '') + secs + 's') : (secs + 's');
                    cdEl.innerText = displayStr;
                }
                
                if (timeLeft <= 0) {
                    clearInterval(timerInterval);
                    autoCard.innerHTML = '<div style="color:#4caf50; font-size:13px; font-weight:bold; padding:15px; text-align:center;"><i class="fi flex fi-rr-spinner-alt" style="animation:rotate 1s linear infinite; margin: 0 auto 10px auto; font-size:20px;"></i>Starting Login...</div>';
                    startLoginCycle(agent, aName, aId, list);
                }
            };

            var timerInterval = setInterval(updateTimer, 500);
            updateTimer();

            pauseBtn.onclick = function() {
                var pin = prompt('🔒 Enter Security PIN to Pause Autopilot:');
                if (pin === '1509') {
                    clearInterval(timerInterval);
                    chrome.storage.local.set({ is_autopilot_active: false, autopilot_paused: true }, function() {
                        console.log('⏸️ Autopilot Paused. Reverting extension to normal mode.');
                        onAuthorized();
                    });
                } else {
                    alert('❌ Incorrect PIN. Autopilot will continue.');
                }
            };
        };

        var runAutopilotPausedUI = function(agents, currentIndex) {
            list.innerHTML = '';
            var autoCard = document.createElement('div');
            autoCard.style.cssText = 'padding:15px; text-align:center; background:rgba(255,255,255,0.05); border-radius:12px; border:1px solid rgba(255,255,255,0.1); margin:10px; display:flex; flex-direction:column; gap:10px;';
            
            var agent = agents[currentIndex];
            var aName = agent ? (getKey(agent, 'agent name') || getKey(agent, 'agent_name')) : 'Unknown';

            autoCard.innerHTML = '\
                <div style="font-size:11px; color:#f44336; font-weight:700; text-transform:uppercase; letter-spacing:1.5px;">Autopilot Paused</div>\
                <div style="font-size:14px; font-weight:600; color:#fff; margin-top:5px;">Next: ' + aName + '</div>\
                <div style="font-size:20px; font-weight:700; color:#f44336; margin:10px 0;">PAUSED</div>\
            ';
            
            var resumeBtn = document.createElement('button');
            resumeBtn.className = 'agent-card';
            resumeBtn.style.cssText = 'background:#4caf50; color:#fff; border:none; justify-content:center; height:36px; margin:0;';
            resumeBtn.innerHTML = '<div style="font-weight:700; font-size:12px;">RESUME AUTOPILOT</div>';
            autoCard.appendChild(resumeBtn);
            list.appendChild(autoCard);

            resumeBtn.onclick = function() {
                var nextLogin = Date.now() + 5000;
                chrome.storage.local.set({ autopilot_paused: false, autopilot_next_login_time: nextLogin }, function() {
                    onAuthorized();
                });
            };
        };

        var onAuthorized = function() {
            // 🎯 AUTHORIZED ACTIONS
            header.innerHTML = '<div style="display:flex; align-items:center; gap:10px;"><i class="fi flex fi-rr-shield-check" style="color:#4caf50; font-size:18px;"></i><h3 class="fav-login-title">Select Agent Profile</h3></div>';
            
            chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused', 'autopilot_index', 'autopilot_next_login_time', 'autopilot_agents'], function(res) {
                if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused && res.autopilot_agents && res.autopilot_agents.length > 0) {
                    var nextLogin = res.autopilot_next_login_time || 0;
                    runAutopilotUI(res.autopilot_agents, nextLogin, res.autopilot_index);
                } else {
                    chrome.runtime.sendMessage({ type: 'FETCH_AGENTS' }, function(response) {
                        if (response && response.success) renderAgents(response.agents);
                        else {
                            list.innerHTML = '<div style="color:#ff5252; padding:20px; text-align:center;">Offline - Reopening Tab...</div>';
                            console.warn('⚠️ Offline status detected in login popup! Reopening fresh login tab...');
                            setTimeout(function() {
                                chrome.runtime.sendMessage({ type: 'REOPEN_LOGIN_TAB' });
                            }, 2000);
                        }
                    });
                }
            });
        };

        var setupCreateAccountAction = function(extId) {
            var btn = document.getElementById('btnCreateAccount');
            if (!btn) return;
            btn.onclick = function() {
                header.innerHTML = '<div style="display:flex; align-items:center; gap:10px;"><i class="fi flex fi-rr-user-add" style="color:#0065b3; font-size:18px;"></i><h3 class="fav-login-title">Create Account</h3></div>';
                list.innerHTML = '\
                    <div style="display:flex; flex-direction:column; gap:12px; padding:10px;">\
                        <div style="background:rgba(255,255,255,0.04); padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); text-align:center;">\
                            <div style="font-size:9px; opacity:0.5; margin-bottom:2px; color:#fff;">EXT ID</div>\
                            <div style="font-size:16px; font-weight:700; color:#4caf50; letter-spacing:1px;">' + extId + '</div>\
                        </div>\
                        <input type="text" id="regName" placeholder="Full Name" style="width:100%; padding:10px 15px; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:13px; outline:none; box-sizing:border-box;">\
                        <input type="email" id="regEmail" placeholder="Official Email" style="width:100%; padding:10px 15px; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:13px; outline:none; box-sizing:border-box;">\
                        <button id="btnRegSubmit" class="agent-card" style="background:#0065b3; justify-content:center; border:none; margin-top:5px; height:40px;">\
                            <div style="font-size:13px; font-weight:700;">SUBMIT</div>\
                        </button>\
                        <button id="btnRegBack" class="agent-card" style="background:transparent; justify-content:center; border:none; opacity:0.6; height:30px;">\
                            <div style="font-size:11px;">Back to Login</div>\
                        </button>\
                    </div>';

                document.getElementById('btnRegBack').onclick = function() { showLoginView(extId); };

                document.getElementById('btnRegSubmit').onclick = function() {
                    var name = document.getElementById('regName').value.trim();
                    var email = document.getElementById('regEmail').value.trim();
                    if (!name || !email) { alert('Fill all fields'); return; }
                    
                    var btn = this;
                    btn.innerHTML = '<i class="fi flex fi-rr-spinner-alt" style="animation:rotate 1s linear infinite;"></i> REGISTERING...';
                    btn.disabled = true;

                    chrome.runtime.sendMessage({ 
                        type: 'REGISTER_USER', 
                        payload: { extId: extId, name: name, email: email } 
                    }, function(response) {
                        if (response && response.success) {
                            list.innerHTML = '<div style="text-align:center; padding:20px 10px;">\
                                <i class="fi fi-rr-time-check" style="font-size:36px; color:#ffb300; margin-bottom:12px; display:block;"></i>\
                                <div style="color:#fff; font-size:14px; font-weight:600;">Request Sent!</div>\
                                <div style="color:rgba(255,255,255,0.5); font-size:11px; margin-top:8px;">Do you want to save your profile locally?</div>\
                                <div style="display:flex; gap:10px; margin-top:15px;">\
                                    <button id="btnSaveYes" class="agent-card" style="background:#4caf50; justify-content:center; flex:1; height:40px;">YES</button>\
                                    <button id="btnSaveNo" class="agent-card" style="background:rgba(255,255,255,0.1); justify-content:center; flex:1; height:40px;">NO</button>\
                                </div>\
                            </div>';
                            
                            document.getElementById('btnSaveYes').onclick = function() {
                                chrome.storage.local.set({ 
                                    favUserProfile: { extId: extId, name: name, email: email } 
                                }, function() { showLoginView(extId); });
                            };
                            document.getElementById('btnSaveNo').onclick = function() {
                                showLoginView(extId);
                            };
                        } else {
                            alert('Failed: ' + (response ? response.message : 'Unknown error'));
                            btn.innerHTML = 'SUBMIT'; btn.disabled = false;
                        }
                    });
                };
            };
        };

        var showLoginView = function(extId, errorMsg) {
            header.innerHTML = '<div style="display:flex; align-items:center; gap:10px;"><i class="fi flex fi-rr-lock" style="color:#ffb300; font-size:18px;"></i><h3 class="fav-login-title">Extension Login</h3></div>';
            
            var errHtml = errorMsg ? '<div style="background:rgba(244,67,54,0.15); border:1px solid #f44336; color:#f44336; border-radius:8px; padding:8px 12px; font-size:11px; text-align:center; margin-bottom:10px; display:flex; align-items:center; justify-content:center; gap:6px;"><i class="fi fi-rr-exclamation" style="font-size:14px;"></i><span>' + errorMsg + '</span></div>' : '';

            chrome.storage.local.get(['favUserProfile', 'is_admin', 'is_master_extension', 'is_autopilot_active'], function(res) {
                var profile = res.favUserProfile;
                
                if (profile && profile.email) {
                    // 🤖 Autopilot Auto-Login for User Card
                    if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused) {
                        console.log('🤖 Autopilot: Automatically triggering Extension User login...');
                        setTimeout(function() {
                            var uBtn = document.getElementById('btnUserLogin');
                            if (uBtn) uBtn.click();
                        }, 800);
                    }
                    // 👤 SHOW USER CARD
                    list.innerHTML = '\
                        <div style="display:flex; flex-direction:column; gap:10px; padding:10px;">\
                            ' + errHtml + '\
                            <div style="font-size:10px; color:rgba(255,255,255,0.4); margin-left:5px;">Welcome Back,</div>\
                            <button id="btnUserLogin" class="agent-card" style="border:1px solid #4caf50; background:rgba(76,175,80,0.05);">\
                                <div class="agent-icon-box" style="background:#4caf50;"><i class="fi flex fi-rr-user"></i></div>\
                                <div style="text-align:left;">\
                                    <div style="font-size:13px; font-weight:600;">' + profile.name + '</div>\
                                    <div style="font-size:10px; opacity:0.5;">' + profile.email + '</div>\
                                </div>\
                                <i class="fi fi-rr-angle-small-right" style="margin-left:auto; opacity:0.5;"></i>\
                            </button>\
                            <div style="text-align:center; margin-top:5px;">\
                                <span id="btnSwitchAccount" style="font-size:10px; color:#0065b3; cursor:pointer; text-decoration:underline;">Not you? Switch account</span>\
                            </div>\
                            <div style="display:flex; align-items:center; gap:10px; margin:5px 0;">\
                                <div style="flex:1; height:1px; background:rgba(255,255,255,0.1);"></div>\
                                <div style="font-size:10px; color:rgba(255,255,255,0.3);">NEW DEVICE?</div>\
                                <div style="flex:1; height:1px; background:rgba(255,255,255,0.1);"></div>\
                            </div>\
                            <button id="btnCreateAccount" class="agent-card" style="background:transparent; justify-content:center; border:1px solid rgba(255,255,255,0.2); height:40px;">\
                                <div style="font-size:13px; font-weight:700; color:rgba(255,255,255,0.5);">CREATE ACCOUNT</div>\
                            </button>\
                        </div>';

                    if (document.getElementById('btnAdminLogin')) {
                        document.getElementById('btnAdminLogin').onclick = function() {
                             if (typeof setupAdminSecurity === 'function') setupAdminSecurity();
                             else alert('Admin module loading...');
                        };
                    }

                    document.getElementById('btnUserLogin').onclick = function() {
                        var btn = this;
                        btn.style.opacity = '0.7';
                        btn.innerHTML = '<i class="fi flex fi-rr-spinner-alt" style="animation:rotate 1s linear infinite; margin-right:10px;"></i> Logging in...';
                        
                        chrome.runtime.sendMessage({ 
                            type: 'CHECK_AUTH', 
                            payload: { extId: extId, email: profile.email } 
                        }, function(response) {
                            console.log('🛡️ [LOGIN CARD] Auth Response:', response);
                            if (response && response.success) {
                                // 🔄 Sync fresh permissions and profile data
                                var p = response.userData || {};
                                p.name = p.user_name || p.name;
                                p.email = p.user_email || p.email;
                                
                                var storageData = { 
                                    favUserProfile: p,
                                    is_admin: response.is_admin,
                                    profile_visible: response.profile_visible,
                                    renewal_visible: response.renewal_visible,
                                    digital_discount: response.digital_discount,
                                    emi_option: response.emi_option,
                                    isAuthorized: (response.step === 'AUTHORIZED') // Set true if direct login
                                };

                                chrome.storage.local.set(storageData, function() {
                                    console.log('🔄 [AUTH SYNC] Data stored. Step:', response.step);
                                    console.log('📊 [EXTENSION DB SETTINGS]:', {
                                        isAdmin: response.is_admin,
                                        profileVisible: response.profile_visible,
                                        renewalVisible: response.renewal_visible,
                                        digitalDiscount: response.digital_discount,
                                        emiOption: response.emi_option
                                    });
                                    
                                    if (response.step === 'AUTHORIZED') {
                                        console.log('⚡ [DIRECT LOGIN] OTP skipped.');
                                        onAuthorized(); // Skip to agent list
                                    } else {
                                        showUserOTPInput(extId, profile.email, list, function() {
                                            chrome.storage.local.set({ isAuthorized: true });
                                            onAuthorized();
                                        });
                                    }
                                });
                            } else {
                                var msg = 'Login issue occurred. Please try again.';
                                if (response) {
                                    if (response.status === 'pending' || response.message === 'Waiting for Admin Approval') {
                                        msg = '⏳ Approval Still Pending. Waiting for Admin.';
                                    } else if (response.message) {
                                        msg = response.message;
                                    } else if (response.error) {
                                        msg = 'Network Error: ' + response.error;
                                    }
                                } else if (chrome.runtime?.lastError) {
                                    msg = 'Extension Error: ' + chrome.runtime.lastError.message;
                                }

                                showLoginView(extId, msg);
                                
                                chrome.storage.local.get(['is_master_extension'], function(mRes) {
                                    if (mRes.is_master_extension) {
                                        console.log('🤖 Master extension enabled & error detected. Reloading page in 3 seconds to retry login...');
                                        setTimeout(function() {
                                            window.location.reload();
                                        }, 3000);
                                    }
                                });
                            }
                        });
                    };

                    document.getElementById('btnSwitchAccount').onclick = function() {
                        chrome.storage.local.remove(['favUserProfile'], function() { showLoginView(extId); });
                    };
                    
                    setupCreateAccountAction(extId);

                } else {
                    // 📧 SHOW EMAIL INPUT (Original Login)
                    list.innerHTML = '\
                        <div style="display:flex; flex-direction:column; gap:12px; padding:10px;">\
                            ' + errHtml + '\
                            <div style="background:rgba(255,255,255,0.04); padding:10px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); text-align:center;">\
                                <div style="font-size:9px; opacity:0.5; margin-bottom:2px; color:#fff;">EXT ID</div>\
                                <div style="font-size:16px; font-weight:700; color:#4caf50; letter-spacing:1px;">' + extId + '</div>\
                            </div>\
                            <div style="display:flex; flex-direction:column; gap:6px;">\
                                <input type="email" id="loginEmail" placeholder="Enter Registered Email" style="width:100%; padding:12px 15px; border-radius:10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.1); color:#fff; font-size:13px; outline:none; box-sizing:border-box;">\
                            </div>\
                            <button id="btnLoginSubmit" class="agent-card" style="background:#4caf50; justify-content:center; border:none; height:40px;">\
                                <div style="font-size:13px; font-weight:700;">SUBMIT</div>\
                            </button>\
                            <div style="display:flex; align-items:center; gap:10px; margin:5px 0;">\
                                <div style="flex:1; height:1px; background:rgba(255,255,255,0.1);"></div>\
                                <div style="font-size:10px; color:rgba(255,255,255,0.3);">OR</div>\
                                <div style="flex:1; height:1px; background:rgba(255,255,255,0.1);"></div>\
                            </div>\
                            <button id="btnCreateAccount" class="agent-card" style="background:transparent; justify-content:center; border:1px solid #0065b3; height:40px;">\
                                <div style="font-size:13px; font-weight:700; color:#0065b3;">CREATE ACCOUNT</div>\
                            </button>\
                        </div>';

                    document.getElementById('btnLoginSubmit').onclick = function() {
                        var email = document.getElementById('loginEmail').value.trim();
                        if (!email) { showLoginView(extId, 'Please enter your email'); return; }
                        this.innerHTML = '<i class="fi flex fi-rr-spinner-alt" style="animation:rotate 1s linear infinite;"></i> VERIFYING...';
                        
                        chrome.runtime.sendMessage({ 
                            type: 'CHECK_AUTH', 
                            payload: { extId: extId, email: email } 
                        }, function(response) {
                            console.log('🛡️ [LOGIN MANUAL] Auth Response:', response);
                            if (response && response.success) {
                                // 🔄 Sync fresh permissions and profile data
                                var p = response.userData || {};
                                p.name = p.user_name || p.name;
                                p.email = p.user_email || p.email;
                                
                                var storageData = { 
                                    favUserProfile: p,
                                    is_admin: response.is_admin,
                                    profile_visible: response.profile_visible,
                                    renewal_visible: response.renewal_visible,
                                    digital_discount: response.digital_discount,
                                    emi_option: response.emi_option,
                                    isAuthorized: (response.step === 'AUTHORIZED')
                                };

                                chrome.storage.local.set(storageData, function() {
                                    console.log('📊 [EXTENSION DB SETTINGS]:', {
                                        isAdmin: response.is_admin,
                                        profileVisible: response.profile_visible,
                                        renewalVisible: response.renewal_visible,
                                        digitalDiscount: response.digital_discount,
                                        emiOption: response.emi_option
                                    });
                                    if (response.step === 'AUTHORIZED') {
                                        console.log('⚡ [DIRECT LOGIN] OTP skipped.');
                                        onAuthorized();
                                    } else {
                                        showUserOTPInput(extId, email, list, function() {
                                            chrome.storage.local.set({ isAuthorized: true });
                                            onAuthorized();
                                        });
                                    }
                                });
                            } else {
                                var msg = 'Not authorized or mismatch.';
                                if (response) {
                                    if (response.status === 'pending' || response.message === 'Waiting for Admin Approval') {
                                        msg = '⏳ Approval Still Pending. Waiting for Admin.';
                                    } else if (response.message) {
                                        msg = response.message;
                                    } else if (response.error) {
                                        msg = 'Network Error: ' + response.error;
                                    }
                                } else if (chrome.runtime?.lastError) {
                                    msg = 'Extension Error: ' + chrome.runtime.lastError.message;
                                }
                                showLoginView(extId, msg);
                                chrome.storage.local.get(['is_master_extension'], function(mRes) {
                                    if (mRes.is_master_extension) {
                                        console.log('🤖 Master extension enabled & error detected. Reloading page in 3 seconds to retry login...');
                                        setTimeout(function() {
                                            window.location.reload();
                                        }, 3000);
                                    }
                                });
                            }
                        });
                    };
                    
                    setupCreateAccountAction(extId);
                }
            });
        };

        var showUserOTPInput = function(extId, email, list, onSuccess) {
            list.innerHTML = '';
            var header = document.createElement('div');
            header.className = 'agent-card'; header.style.borderColor = '#4caf50'; header.style.cursor = 'default';
            header.innerHTML = '<div class="agent-icon-box" style="background:#4caf50;"><i class="fi flex fi-rr-envelope"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">Verification Required</div><div style="font-size:10px; opacity:0.5;">OTP sent to ' + email + '</div></div>';
            list.appendChild(header);

            var otpGroup = document.createElement('div');
            otpGroup.className = 'otp-group';
            var otpInputs = [];

            for (var i = 0; i < 6; i++) {
                var box = document.createElement('input');
                box.type = 'text'; box.maxLength = 1; box.className = 'otp-box';
                box.style.cssText = 'width:36px; height:44px; text-align:center; outline:none; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.08); color:#4caf50; font-size:18px; font-weight:700; border-radius:8px;';
                box.dataset.index = i;
                otpInputs.push(box);
                otpGroup.appendChild(box);

                box.oninput = function() {
                    if (this.value) {
                        var next = otpInputs[parseInt(this.dataset.index) + 1];
                        if (next) next.focus();
                    }
                    var fullOtp = otpInputs.map(i => i.value).join('');
                    if (fullOtp.length === 6) {
                        verifyBtn.click();
                    }
                };

                box.onkeydown = function(e) {
                    if (e.key === 'Backspace' && !this.value) {
                        var prev = otpInputs[parseInt(this.dataset.index) - 1];
                        if (prev) prev.focus();
                    }
                };
            }
            list.appendChild(otpGroup);

            var verifyBtn = document.createElement('button');
            verifyBtn.className = 'agent-card';
            verifyBtn.style.cssText = 'margin-top:15px; background:#4caf50; justify-content:center; border:none;';
            verifyBtn.innerHTML = '<div style="font-size:13px; font-weight:700;">VERIFY & UNLOCK</div>';
            list.appendChild(verifyBtn);

            verifyBtn.onclick = function() {
                var otp = otpInputs.map(i => i.value).join('');
                if (otp.length < 6) return;
                
                this.innerHTML = '<i class="fi flex fi-rr-spinner-alt" style="animation:rotate 1s linear infinite;"></i> VERIFYING...';
                this.disabled = true;

                chrome.runtime.sendMessage({ 
                    type: 'VERIFY_USER_OTP', 
                    payload: { extId: extId, otp: otp } 
                }, function(res) {
                    if (res && res.success) {
                        console.log('✅ [AUTH SUCCESS] Full User Data Received:', res.userData);
                        
                        // 🛠️ Key Mapping to prevent UI break
                        var finalProfile = res.userData;
                        finalProfile.name = res.userData.user_name;
                        finalProfile.email = res.userData.user_email;

                        chrome.storage.local.set({ 
                            isAuthorized: true,
                            profile_visible: res.profile_visible,
                            renewal_visible: res.renewal_visible,
                            digital_discount: res.digital_discount,
                            emi_option: res.emi_option,
                            is_admin: res.is_admin,
                            favUserProfile: finalProfile // Save with compatible keys
                        }, function() {
                            onSuccess();
                        });
                    } else {
                        alert('Invalid OTP. Please try again.');
                        otpInputs.forEach(i => i.value = '');
                        otpInputs[0].focus();
                        verifyBtn.innerHTML = 'VERIFY & UNLOCK';
                        verifyBtn.disabled = false;
                    }
                });
            };
            
            setTimeout(() => otpInputs[0].focus(), 100);
        };

        // 🛡️ INITIAL AUTH CHECK
        chrome.storage.local.get(['favExtId', 'isAuthorized'], function(res) {
            var extId = res.favExtId || '--';
            if (res.isAuthorized) {
                onAuthorized();
            } else {
                showLoginView(extId);
            }
        });

        var getKey = function(obj, pattern) {
            var lowerPattern = pattern.toLowerCase();
            return Object.keys(obj).find(function(k) {
                return k.toLowerCase().replace(/_/g, ' ') === lowerPattern || k.toLowerCase() === lowerPattern;
            }) ? obj[Object.keys(obj).find(function(k) { return k.toLowerCase().replace(/_/g, ' ') === lowerPattern || k.toLowerCase() === lowerPattern; })] : null;
        };

        var renderAgents = function(agents) {
            list.innerHTML = '';
            agents.forEach(function(agent, index) {
                var aName = getKey(agent, 'agent name') || getKey(agent, 'agent_name') || 'Unknown';
                var aId = getKey(agent, 'agent id') || getKey(agent, 'agent_id') || '--';
                var card = document.createElement('button'); card.className = 'agent-card';
                card.innerHTML = '<div class="agent-icon-box"><i class="fi flex fi-rr-user"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">' + aName + '</div><div style="font-size:10px; opacity:0.5;">ID: ' + aId + '</div></div>' + '<div class="key-badge"><span>' + (index+1) + '</span><i class="fi fi-rr-edit"></i></div>';
                
                card.onclick = function(e) { 
                    // 🚀 If badge was clicked, handle it separately
                    if (e.target.closest('.key-badge')) {
                        e.stopPropagation();
                        openEditWorkflow(agent, aName, aId, list, agents);
                        return;
                    }
                    startLoginCycle(agent, aName, aId, list); 
                };
                list.appendChild(card);
            });

            // 👑 [NEW] Add Admin Profile Card at the end (Only for Admins)
            chrome.storage.local.get(['is_admin'], function(res) {
                if (res.is_admin === true) {
                    var adminCard = document.createElement('button');
                    adminCard.className = 'agent-card';
                    adminCard.style.marginTop = '10px';
                    adminCard.style.border = '1px dashed rgba(255,255,255,0.2)';
                    adminCard.innerHTML = '<div class="agent-icon-box" style="background:#f44336;"><i class="fi flex fi-rr-shield-check"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:700; color:#f44336;">ADMIN CONTROL</div><div style="font-size:10px; opacity:0.6;">Requires Verification</div></div><div class="key-badge" style="background:#f44336;"><i class="fi fi-rr-lock" style="display:flex !important;"></i></div>';
                    
                    adminCard.onclick = function() { openAdminWorkflow(list, agents); };
                    list.appendChild(adminCard);
                }
            });
        };

        var openAdminWorkflow = function(list, originalAgents) {
            console.log('👑 [UI] Admin Workflow Started - Admin OTP Bypassed!');
            showAdminPanel(list, originalAgents);
        };

        var showAdminOTPInput = function(list, originalAgents) {
            list.innerHTML = '';
            var header = document.createElement('div');
            header.className = 'agent-card'; header.style.borderColor = '#4caf50'; header.style.cursor = 'default';
            header.innerHTML = '<div class="agent-icon-box" style="background:#4caf50;"><i class="fi flex fi-rr-envelope"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">OTP Sent!</div><div style="font-size:10px; opacity:0.5;">Check thefinancialcraft@gmail.com</div></div>';
            list.appendChild(header);

            var timerContainer = document.createElement('div');
            timerContainer.style.cssText = 'text-align:center; margin-top:15px; color:#ffb300; font-size:12px; font-weight:600;';
            timerContainer.innerHTML = 'OTP expires in: <span id="admin-otp-timer">02:00</span>';
            list.appendChild(timerContainer);

            var formContainer = document.createElement('div');
            formContainer.id = 'admin-otp-form';
            formContainer.style.cssText = 'display:flex; flex-direction:column; gap:12px; margin-top:10px;';

            // 📱 Redesigned OTP Group to match Agent Style
            var otpGroup = document.createElement('div');
            otpGroup.className = 'otp-group';
            var otpInputs = [];

            for (var i = 0; i < 6; i++) {
                var box = document.createElement('input');
                box.type = 'text'; box.maxLength = 1; box.className = 'otp-box';
                box.style.cssText = 'width:36px; height:44px; text-align:center; outline:none; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.08); color:#4caf50; font-size:18px; font-weight:700; border-radius:8px;';
                box.dataset.index = i;
                otpInputs.push(box);
                otpGroup.appendChild(box);

                // Auto-focus logic
                box.oninput = function() {
                    if (this.value.length === 1 && this.dataset.index < 5) {
                        otpInputs[parseInt(this.dataset.index) + 1].focus();
                    }
                };

                box.onkeydown = function(e) {
                    if (e.key === 'Backspace' && !this.value && this.dataset.index > 0) {
                        otpInputs[parseInt(this.dataset.index) - 1].focus();
                    }
                };
            }
            formContainer.appendChild(otpGroup);

            var verifyBtn = document.createElement('button');
            verifyBtn.className = 'agent-card'; verifyBtn.style.background = '#4caf50'; verifyBtn.style.justifyContent = 'center'; verifyBtn.style.borderColor = 'transparent';
            verifyBtn.innerHTML = '<div style="font-size:13px; font-weight:700;">VERIFY & OPEN PANEL</div>';
            
            var resendContainer = document.createElement('div');
            resendContainer.style.cssText = 'display:none; flex-direction:column; gap:8px;';
            
            var resendBtn = document.createElement('button');
            resendBtn.className = 'agent-card'; resendBtn.style.background = '#0065b3'; resendBtn.style.justifyContent = 'center';
            resendBtn.innerHTML = '<div style="font-size:12px; font-weight:600;"><i class="fi flex fi-rr-refresh" style="margin-right:8px;"></i> RESEND OTP</div>';
            resendBtn.onclick = function() { openAdminWorkflow(list, originalAgents); };
            resendContainer.appendChild(resendBtn);

            var timeLeft = 120; // 2 minutes
            var countdown = setInterval(function() {
                timeLeft--;
                var mins = Math.floor(timeLeft / 60);
                var secs = timeLeft % 60;
                var timerSpan = document.getElementById('admin-otp-timer');
                if (timerSpan) {
                    timerSpan.innerText = (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
                }

                if (timeLeft <= 0) {
                    clearInterval(countdown);
                    if (timerContainer) timerContainer.innerHTML = '<span style="color:#f44336;">OTP Expired</span>';
                    verifyBtn.style.display = 'none';
                    otpInputs.forEach(function(b) { b.disabled = true; b.style.opacity = '0.5'; });
                    resendContainer.style.display = 'flex';
                }
            }, 1000);

            verifyBtn.onclick = function() {
                var otp = otpInputs.map(function(b) { return b.value; }).join('').trim();
                if (otp.length !== 6) return;
                
                verifyBtn.innerHTML = '<i class="fi flex fi-rr-spinner-alt" style="margin-right:8px; animation:rotate 1s linear infinite;"></i> VERIFYING...';
                
                chrome.runtime.sendMessage({ 
                    type: 'VERIFY_ADMIN_OTP', 
                    payload: { otp: otp } 
                }, function(response) {
                    if (response && response.success) {
                        clearInterval(countdown);
                        verifyBtn.innerHTML = '<i class="fi flex fi-rr-check" style="margin-right:8px;"></i> ACCESS GRANTED';
                        verifyBtn.style.background = '#2e7d32';
                        verifyBtn.style.background = '#2e7d32';
                        setTimeout(function() {
                            showAdminPanel(list, originalAgents);
                        }, 1000);
                    } else {
                        verifyBtn.innerHTML = '<i class="fi flex fi-rr-cross" style="margin-right:8px;"></i> INVALID OTP';
                        verifyBtn.style.background = '#f44336';
                        setTimeout(function() { verifyBtn.innerHTML = 'RETRY VERIFY'; verifyBtn.style.background = '#4caf50'; }, 2000);
                    }
                });
            };

            var backBtn = document.createElement('button');
            backBtn.className = 'agent-card'; backBtn.style.marginTop = '5px'; backBtn.style.opacity = '0.5'; backBtn.style.background = 'transparent';
            backBtn.innerHTML = '<i class="fi flex fi-rr-arrow-small-left"></i> <div style="font-size:11px;">Cancel</div>';
            backBtn.onclick = function() { clearInterval(countdown); renderAgents(originalAgents); };

            formContainer.appendChild(verifyBtn);
            formContainer.appendChild(resendContainer);
            formContainer.appendChild(backBtn);
            list.appendChild(formContainer);
            
            // Focus first box
            if (otpInputs[0]) otpInputs[0].focus();
        };

        var showAdminPanel = function(list, originalAgents) {
            list.innerHTML = '';
            var panelHeader = document.createElement('div');
            panelHeader.style.cssText = 'padding:10px; display:flex; align-items:center; gap:10px; border-bottom:1px solid rgba(255,255,255,0.1); margin-bottom:10px;';
            panelHeader.innerHTML = '<i class="fi flex fi-rr-shield-check" style="color:#f44336; font-size:18px;"></i><div style="text-align:left;"><div style="font-size:14px; font-weight:700;">ADMIN CONTROL CENTER</div><div style="font-size:9px; opacity:0.6;">System & Security Management</div></div>';
            
            var backBtn = document.createElement('i');
            backBtn.className = 'fi flex fi-rr-arrow-small-left';
            backBtn.style.cssText = 'margin-left:auto; cursor:pointer; opacity:0.6; font-size:18px;';
            backBtn.onclick = function() { renderAgents(originalAgents); };
            panelHeader.appendChild(backBtn);
            list.appendChild(panelHeader);

            // 👑 Master Toggle Box
            var masterToggleContainer = document.createElement('div');
            masterToggleContainer.style.cssText = 'padding:10px; display:flex; align-items:center; justify-content:space-between; background:rgba(255,255,255,0.05); border-radius:8px; margin:5px 0 10px 0; border:1px solid rgba(255,255,255,0.1);';
            masterToggleContainer.innerHTML = '<div><div style="font-size:12px; font-weight:700; color:#ff9800;">Master Autopilot Mode</div><div style="font-size:9px; opacity:0.6; margin-top:2px;">Sequentially runs all agents</div></div>';
            
            var toggleSwitch = document.createElement('input');
            toggleSwitch.type = 'checkbox';
            toggleSwitch.style.cssText = 'width:36px; height:18px; cursor:pointer;';
            
            chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], function(res) {
                toggleSwitch.checked = (res.is_master_extension === true && res.is_autopilot_active === true && res.autopilot_paused !== true);
            });
            
            toggleSwitch.onchange = function() {
                var checked = this.checked;
                chrome.runtime.sendMessage({ type: 'SET_MASTER_MODE', payload: { isMaster: checked } }, function() {
                    console.log('🔄 Master mode set to:', checked);
                });
            };
            
            masterToggleContainer.appendChild(toggleSwitch);
            list.appendChild(masterToggleContainer);

            // 🔑 RESET PASSWORD CARD (For Admin)
            var resetPassCard = document.createElement('button');
            resetPassCard.className = 'agent-card';
            resetPassCard.style.cssText = 'background:rgba(244,67,54,0.15); border:1px solid rgba(244,67,54,0.4); margin-bottom:8px;';
            resetPassCard.innerHTML = '<div class="agent-icon-box" style="background:#f44336;"><i class="fi flex fi-rr-key"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:700; color:#fff;">RESET AGENT PASSWORD</div><div style="font-size:10px; opacity:0.7;">Select an Agent to Reset Password</div></div><i class="fi fi-rr-angle-small-right" style="margin-left:auto; opacity:0.6;"></i>';
            resetPassCard.onclick = function() {
                openAdminResetPasswordView(list, originalAgents);
            };
            list.appendChild(resetPassCard);
        };

        var openAdminResetPasswordView = function(list, originalAgents) {
            list.innerHTML = '';
            var header = document.createElement('div');
            header.className = 'agent-card'; header.style.borderColor = '#f44336'; header.style.cursor = 'default';
            header.innerHTML = '<div class="agent-icon-box" style="background:#f44336;"><i class="fi flex fi-rr-key"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">Reset Password</div><div style="font-size:10px; opacity:0.5;">Select Agent Profile</div></div>';
            list.appendChild(header);

            if (!originalAgents || originalAgents.length === 0) {
                var noAgentMsg = document.createElement('div');
                noAgentMsg.style.cssText = 'color:rgba(255,255,255,0.5); font-size:12px; text-align:center; padding:15px;';
                noAgentMsg.innerText = 'No agent profiles found.';
                list.appendChild(noAgentMsg);
            } else {
                originalAgents.forEach(function(agent, index) {
                    var aName = getKey(agent, 'agent name') || getKey(agent, 'agent_name') || 'Unknown';
                    var aId = getKey(agent, 'agent id') || getKey(agent, 'agent_id') || '--';
                    
                    var card = document.createElement('button');
                    card.className = 'agent-card';
                    card.style.cssText = 'margin-top:6px; border:1px solid rgba(244,67,54,0.2);';
                    card.innerHTML = '<div class="agent-icon-box" style="background:#f44336;"><i class="fi flex fi-rr-user"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">' + aName + '</div><div style="font-size:10px; opacity:0.5;">ID: ' + aId + '</div></div><div class="key-badge" style="background:#f44336; color:#fff;">RESET</div>';
                    
                    card.onclick = function() {
                        chrome.storage.local.set({ 
                            favPendingResetId: aId, 
                            favPendingResetAgent: agent,
                            favPendingResetName: aName 
                        }, function() {
                            list.innerHTML = '<div style="color:#4caf50; font-size:13px; font-weight:bold; padding:20px; text-align:center;"><i class="fi flex fi-rr-spinner-alt" style="animation:rotate 1s linear infinite; margin:0 auto 10px auto; font-size:20px;"></i>Opening Reset Page...</div>';
                            setTimeout(function() {
                                window.location.hash = '#/auth/resetpwd';
                            }, 500);
                        });
                    };
                    list.appendChild(card);
                });
            }

            var backBtn = document.createElement('button');
            backBtn.className = 'agent-card'; backBtn.style.marginTop = '10px'; backBtn.style.opacity = '0.6'; backBtn.style.background = 'transparent';
            backBtn.innerHTML = '<i class="fi flex fi-rr-arrow-small-left"></i> <div style="font-size:11px;">Back to Admin Panel</div>';
            backBtn.onclick = function() { showAdminPanel(list, originalAgents); };
            list.appendChild(backBtn);
        };

        var renderAdminUserCard = function(list, user, type) {
            var card = document.createElement('div');
            card.className = 'agent-card';
            card.style.cssText = 'cursor:default; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05);';
            
            var statusColor = type === 'pending' ? '#ffb300' : '#4caf50';
            var statusIcon = type === 'pending' ? 'fi-rr-time-past' : 'fi-rr-check-circle';

            card.innerHTML = '\
                <div class="agent-icon-box" style="background:' + statusColor + ';"><i class="fi flex ' + statusIcon + '"></i></div>\
                <div style="text-align:left; flex:1;">\
                    <div style="font-size:12px; font-weight:600;">' + user.user_name + '</div>\
                    <div style="font-size:9px; opacity:0.5;">' + user.user_email + '</div>\
                    <div style="font-size:8px; opacity:0.3; margin-top:2px;">ID: ' + user.extension_id + '</div>\
                </div>\
                <div style="display:flex; flex-direction:column; gap:4px; align-items:flex-end;">\
                    <button class="status-action-btn" style="padding:4px 8px; font-size:9px; border-radius:4px; border:none; background:rgba(255,255,255,0.1); color:#fff; cursor:pointer;">Settings</button>\
                </div>';
            
            list.appendChild(card);
        };

        var openEditWorkflow = function(agent, aName, aId, list, originalAgents) {
            list.innerHTML = '';
            var header = document.createElement('div');
            header.className = 'agent-card'; header.style.borderColor = '#0065b3'; header.style.cursor = 'default';
            header.innerHTML = '<div class="agent-icon-box" style="background:#0065b3;"><i class="fi flex fi-rr-settings"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">' + aName + '</div><div style="font-size:10px; opacity:0.5;">Password Management</div></div>';
            list.appendChild(header);

            var btnContainer = document.createElement('div');
            btnContainer.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-top:15px;';

            var createBtn = document.createElement('button');
            createBtn.className = 'agent-card'; createBtn.style.background = 'rgba(76, 175, 80, 0.1)';
            createBtn.innerHTML = '<div class="agent-icon-box" style="background:#4caf50; width:24px; height:24px; font-size:10px;"><i class="fi flex fi-rr-plus"></i></div><div style="font-size:12px; font-weight:600;">Create Password</div>';
            createBtn.onclick = function() { 
                console.log('🚀 Redirecting to Reset Password for:', aId);
                
                // 🎨 Show loader during redirect
                list.innerHTML = '';
                
                // 🚀 RE-ADD ACTIVE AGENT CARD (Matched Login State)
                var activeCard = document.createElement('div');
                activeCard.className = 'agent-card'; activeCard.style.borderColor = '#4caf50';
                activeCard.innerHTML = '<div class="agent-icon-box" style="background:#4caf50;"><i class="fi flex fi-rr-user"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">' + aName + '</div><div style="font-size:10px; opacity:0.5;">ID: ' + aId + '</div></div>';
                list.appendChild(activeCard);

                var statusMsg = document.createElement('div');
                statusMsg.style.cssText = 'color:rgba(255,255,255,0.6); font-size:12px; text-align:center; margin-top:20px;';
                statusMsg.innerText = 'Please wait...';
                list.appendChild(statusMsg);

                var loader = document.createElement('div'); loader.className = 'dancing-dots';
                loader.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
                list.appendChild(loader);

                chrome.storage.local.set({ 
                    favPendingResetId: aId, 
                    favPendingResetAgent: agent, // 🧪 Store full agent for OTP finder
                    favPendingResetName: aName 
                }, function() {
                    setTimeout(function() {
                        window.location.hash = '#/auth/resetpwd';
                    }, 800);
                });
            };

            var updateBtn = document.createElement('button');
            updateBtn.className = 'agent-card'; updateBtn.style.background = 'rgba(0, 101, 179, 0.1)';
            updateBtn.innerHTML = '<div class="agent-icon-box" style="background:#0065b3; width:24px; height:24px; font-size:10px;"><i class="fi flex fi-rr-refresh"></i></div><div style="font-size:12px; font-weight:600;">Update Password</div>';
            updateBtn.onclick = function() { openPasswordUpdate(agent, aName, aId, list, originalAgents); };

            var backBtn = document.createElement('button');
            backBtn.className = 'agent-card'; backBtn.style.marginTop = '10px'; backBtn.style.opacity = '0.6';
            backBtn.innerHTML = '<i class="fi flex fi-rr-arrow-small-left"></i> <div style="font-size:11px;">Back to profiles</div>';
            backBtn.onclick = function() { renderAgents(originalAgents); };

            btnContainer.appendChild(createBtn);
            btnContainer.appendChild(updateBtn);
            btnContainer.appendChild(backBtn);
            list.appendChild(btnContainer);
        };

        var openPasswordUpdate = function(agent, aName, aId, list, originalAgents) {
            list.innerHTML = '';
            var header = document.createElement('div');
            header.className = 'agent-card'; header.style.borderColor = '#0065b3'; header.style.cursor = 'default';
            header.innerHTML = '<div class="agent-icon-box" style="background:#0065b3;"><i class="fi flex fi-rr-refresh"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">' + aName + '</div><div style="font-size:10px; opacity:0.5;">Update Secret Password</div></div>';
            list.appendChild(header);

            var formContainer = document.createElement('div');
            formContainer.style.cssText = 'display:flex; flex-direction:column; gap:12px; margin-top:20px;';

            var passInput = document.createElement('input');
            passInput.type = 'text';
            passInput.placeholder = 'Type password...';
            passInput.value = getKey(agent, 'agent password') || getKey(agent, 'agent_password') || '';
            Object.assign(passInput.style, {
                width: '100%', padding: '12px 15px', borderRadius: '12px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', fontSize: '13px', outline: 'none', transition: 'border-color 0.3s'
            });
            passInput.onfocus = function() { this.style.borderColor = '#0065b3'; this.style.background = 'rgba(255,255,255,0.1)'; };
            passInput.onblur = function() { this.style.borderColor = 'rgba(255,255,255,0.1)'; this.style.background = 'rgba(255,255,255,0.06)'; };

            var saveBtn = document.createElement('button');
            saveBtn.className = 'agent-card'; saveBtn.style.background = '#0065b3'; saveBtn.style.justifyContent = 'center'; saveBtn.style.borderColor = 'transparent';
            saveBtn.innerHTML = '<div style="font-size:13px; font-weight:700; letter-spacing:1px;">SAVE PASSWORD</div>';
            saveBtn.onclick = function() {
                var newPass = passInput.value.trim();
                if (!newPass) return;
                
                saveBtn.innerHTML = '<i class="fi flex fi-rr-spinner-alt" style="margin-right:8px; animation:rotate 1s linear infinite;"></i> SAVING...';
                
                // 📡 Send update to background script
                chrome.runtime.sendMessage({ 
                    type: 'UPDATE_PASSWORD', 
                    payload: { userId: aId, newPassword: newPass } 
                }, function(response) {
                    if (response && response.success) {
                        saveBtn.innerHTML = '<i class="fi flex fi-rr-check" style="margin-right:8px;"></i> SAVED';
                        saveBtn.style.background = '#4caf50';
                        console.log('✅ Successfully synced with Sheet for:', aId);
                        
                        // 🚀 RE-FETCH ALL PROFILES AFTER SAVE
                        setTimeout(function() {
                            list.innerHTML = '<div style="color:rgba(255,255,255,0.4); font-size:12px; padding:20px; text-align:center;">Refreshing data...</div>';
                            chrome.runtime.sendMessage({ type: 'FETCH_AGENTS' }, function(refreshRes) {
                                if (refreshRes && refreshRes.success) {
                                    renderAgents(refreshRes.agents);
                                } else {
                                    renderAgents(originalAgents); // Fallback to local if fetch fails
                                }
                            });
                        }, 1200);
                    } else {
                        saveBtn.innerHTML = '<i class="fi flex fi-rr-cross" style="margin-right:8px;"></i> FAILED';
                        saveBtn.style.background = '#f44336';
                        setTimeout(function() { saveBtn.innerHTML = 'RETRY SAVE'; saveBtn.style.background = '#0065b3'; }, 2000);
                    }
                });
            };

            var backBtn = document.createElement('button');
            backBtn.className = 'agent-card'; backBtn.style.marginTop = '10px'; backBtn.style.opacity = '0.5'; backBtn.style.background = 'transparent';
            backBtn.innerHTML = '<i class="fi flex fi-rr-arrow-small-left"></i> <div style="font-size:11px;">Cancel</div>';
            backBtn.onclick = function() { openEditWorkflow(agent, aName, aId, list, originalAgents); };

            formContainer.appendChild(passInput);
            formContainer.appendChild(saveBtn);
            formContainer.appendChild(backBtn);
            list.appendChild(formContainer);
            passInput.focus();
        };

        var startLoginCycle = function(agent, aName, aId, list) {
            chrome.storage.local.set({ selectedAgentName: aName, selectedAgentId: aId });
            list.innerHTML = '';
            var activeCard = document.createElement('div');
            activeCard.className = 'agent-card'; activeCard.style.borderColor = '#4caf50';
            activeCard.innerHTML = '<div class="agent-icon-box" style="background:#4caf50;"><i class="fi flex fi-rr-user"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">' + aName + '</div><div style="font-size:10px; opacity:0.5;">ID: ' + aId + '</div></div>';
            list.appendChild(activeCard);

            var statusMsg = document.createElement('div');
            statusMsg.id = 'favLoginStatus';
            statusMsg.style.cssText = 'color:rgba(255,255,255,0.6); font-size:12px; text-align:center; margin-top:20px;';
            statusMsg.innerText = 'Please wait...';
            list.appendChild(statusMsg);

            var loader = document.createElement('div'); loader.id = 'favDancingDots'; loader.className = 'dancing-dots';
            loader.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
            list.appendChild(loader);

            var userInput = document.getElementById('userId');
            var passInput = document.getElementById('passwordOtp');
            var loginBtn = document.getElementById('sign_in_btn');
            if (userInput && passInput) {
                var passVal = getKey(agent, 'agent password') || getKey(agent, 'agent_password') || '';
                
                userInput.focus();
                userInput.value = aId;
                userInput.dispatchEvent(new Event('input', { bubbles: true }));
                userInput.dispatchEvent(new Event('change', { bubbles: true }));
                userInput.dispatchEvent(new Event('keyup', { bubbles: true }));
                userInput.dispatchEvent(new Event('blur', { bubbles: true }));

                passInput.focus();
                passInput.value = passVal;
                passInput.dispatchEvent(new Event('input', { bubbles: true }));
                passInput.dispatchEvent(new Event('change', { bubbles: true }));
                passInput.dispatchEvent(new Event('keyup', { bubbles: true }));
                passInput.dispatchEvent(new Event('blur', { bubbles: true }));

                setTimeout(function() { 
                    if (loginBtn && loginBtn.isConnected) { 
                        loginBtn.disabled = false; 
                        loginBtn.removeAttribute('disabled');
                        loginBtn.click(); 
                    } 
                }, 600);
            }
            startPageObserver(agent, list);
        };

        var startPageObserver = function(agent, list) {
            var observer = new MutationObserver(function() {
                var successMsg = document.querySelector('.success-message');
                var resendBtn = document.querySelector('.unlock a');
                
                var allErrors = document.querySelectorAll('.error-message.text-center, .error-message, div.alert-danger, div.text-danger');
                var foundError = false;

                allErrors.forEach(function(el) {
                    var txt = el.innerText;
                    var statusMsg = document.getElementById('favLoginStatus');
                    var loader = document.getElementById('favDancingDots');

                    if (txt.includes('Please Enter Valid User Details')) {
                        if (statusMsg) { statusMsg.innerText = 'FILL CORRECT DETAILS'; statusMsg.style.color = '#ff5252'; }
                        if (loader) loader.style.display = 'none';
                        foundError = true;
                    } else if (txt.includes('maximum OTP generation count limit') || txt.includes('reached maximum OTP') || txt.includes('maximum otp count') || txt.includes('UserId is blocked') || txt.includes('maximum login attempt limit')) {
                        if (statusMsg) { statusMsg.innerText = 'MAX OTP LIMIT REACHED'; statusMsg.style.color = '#ff5252'; }
                        if (loader) loader.style.display = 'none';
                        foundError = true;

                        showGlobalError('You have reached maximum OTP generation count limit');
                        setTimeout(function() {
                            window.location.hash = '#/auth/login';
                        }, 3000);
                    } else if (txt.includes('Valid otp Number') || txt.includes('Valid OTP') || txt.includes('invalid otp') || txt.includes('Invalid OTP')) {
                        if (statusMsg) { statusMsg.innerText = 'INVALID OTP - Re-fetching latest OTP first...'; statusMsg.style.color = '#ff5252'; }
                        if (loader) loader.style.display = 'none';
                        foundError = true;

                        console.log('⚠️ Invalid OTP error on page! Will retry fetch 4-5x before resending...');

                        chrome.storage.local.get(['favPendingResetAgent'], function(r) {
                            var agentForRetry = r.favPendingResetAgent;
                            if (!agentForRetry) return;

                            var retryFetchBeforeResend = function(attemptsLeft) {
                                if (attemptsLeft <= 0) {
                                    // All retries exhausted — now resend OTP
                                    console.log('🔄 [favLogin] All re-fetch attempts failed. Clicking Resend OTP now...');
                                    if (statusMsg) { statusMsg.innerText = 'No new OTP found. Resending OTP...'; statusMsg.style.color = '#ff9800'; }
                                    var resendBtnEl = document.querySelector('.unlock a') ||
                                                      document.querySelector('#resend_otp_btn') ||
                                                      Array.from(document.querySelectorAll('a, button')).find(function(el) {
                                                          return (el.innerText || '').toLowerCase().includes('resend');
                                                      });
                                    if (resendBtnEl) { resendBtnEl.click(); }
                                    setTimeout(function() {
                                        if (statusMsg) { statusMsg.innerText = 'Fetching OTP after resend...'; statusMsg.style.color = '#4fc3f7'; }
                                        fetchAndFillOtp(agentForRetry, 0);
                                    }, 3500);
                                    return;
                                }
                                // Try fetching latest OTP
                                if (statusMsg) statusMsg.innerText = 'Re-fetching OTP (attempt ' + (6 - attemptsLeft) + '/5)...';
                                var apiUrl = getOtpApiUrl(agentForRetry);
                                if (!apiUrl) { retryFetchBeforeResend(0); return; }
                                fetch(apiUrl)
                                    .then(function(res) { return res.json(); })
                                    .then(function(data) {
                                        var otpDate = data.date ? new Date(data.date).getTime() : 0;
                                        var now = Date.now();
                                        var diffMinutes = otpDate > 0 ? ((now - otpDate) / (1000 * 60)) : 999;
                                        if (otpDate !== 0 && diffMinutes <= 3) {
                                            console.log('✅ [favLogin] Fresh OTP found on retry! Submitting...');
                                            displayOtpAndSubmit(data, agentForRetry);
                                        } else {
                                            console.log('⏳ OTP not fresh yet. Retrying in 2s... (' + attemptsLeft + ' attempts left)');
                                            setTimeout(function() { retryFetchBeforeResend(attemptsLeft - 1); }, 2000);
                                        }
                                    })
                                    .catch(function() {
                                        setTimeout(function() { retryFetchBeforeResend(attemptsLeft - 1); }, 2000);
                                    });
                            };

                            retryFetchBeforeResend(5);
                        });
                    } else if (txt.includes('Something went wrong') || txt.includes('please try again')) {
                        if (statusMsg) { statusMsg.innerText = 'ERROR - Reloading...'; statusMsg.style.color = '#ff5252'; }
                        if (loader) loader.style.display = 'none';
                        foundError = true;
                        // 🔄 Force reload page on server error too
                        console.log('⚠️ Something went wrong detected! Force reloading page in 2 seconds...');
                        setTimeout(function() { window.location.reload(); }, 2000);
                    } else if (txt.includes('connection has been closed')) {
                        if (statusMsg) { statusMsg.innerText = 'CONNECTION CLOSED - Skipping...'; statusMsg.style.color = '#ff5252'; }
                        if (loader) loader.style.display = 'none';
                        foundError = true;
                        // 🔄 Force reload + skip agent on connection closed
                        console.log('⚠️ Connection closed detected! Reloading and skipping agent...');
                        chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused', 'autopilot_index', 'autopilot_agents'], function(r) {
                            if (r.is_master_extension && r.is_autopilot_active && !r.autopilot_paused && r.autopilot_agents) {
                                var nextIndex = (r.autopilot_index + 1) % r.autopilot_agents.length;
                                var delayMs = (nextIndex === 0) ? (10 * 60 * 1000) : (2 * 60 * 1000);
                                chrome.storage.local.set({
                                    autopilot_index: nextIndex,
                                    autopilot_next_login_time: Date.now() + delayMs
                                }, function() {
                                    console.log('⚠️ Autopilot: Skipped agent, next index ' + nextIndex + ' in ' + (delayMs / 60000) + 'm. Reloading...');
                                    window.location.reload();
                                });
                            } else {
                                window.location.reload();
                            }
                        });
                    }
                });

                if (foundError) {
                    observer.disconnect();
                    chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused'], function(res) {
                        if (res.is_master_extension && res.is_autopilot_active && !res.autopilot_paused) {
                            setTimeout(handleAutopilotError, 3000);
                        }
                    });
                    return;
                }

                if (successMsg || (resendBtn && resendBtn.innerText.includes('Resend OTP'))) {
                    updateUIToOTPState(agent, list); observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        };

        var showGlobalError = function(msg) {
            list.innerHTML = '<div style="color:#ff5252; padding:30px 10px; font-size:13px; text-align:center; font-weight:600; animation: favSlideDown 0.3s ease;">' + (msg || 'Something went wrong, try again') + '</div>';
            
            setTimeout(function() {
                list.innerHTML = '<div style="color:rgba(255,255,255,0.4); font-size:12px; padding:20px; text-align:center;">Reloading agents...</div>';
                chrome.runtime.sendMessage({ type: 'FETCH_AGENTS' }, function(response) {
                    if (response && response.success) renderAgents(response.agents);
                    else {
                        list.innerHTML = '<div style="color:#ff5252; padding:20px; text-align:center;">Offline - Reopening Tab...</div>';
                        console.warn('⚠️ Offline status detected in global error fallback! Reopening fresh login tab...');
                        setTimeout(function() {
                            chrome.runtime.sendMessage({ type: 'REOPEN_LOGIN_TAB' });
                        }, 2000);
                    }
                });
            }, 2000);
        };


        var footer = document.createElement('div');
        Object.assign(footer.style, { marginTop: '12px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center' });
        footer.innerHTML = '<i class="fi flex fi-rr-lock" style="font-size:10px; margin-right:5px;"></i> Encrypted Session';
        container.appendChild(footer);
        document.body.appendChild(container);

        var isDragging = false, offsetX, offsetY;
        header.onmousedown = function(e) { isDragging = true; offsetX = e.clientX - container.getBoundingClientRect().left; offsetY = e.clientY - container.getBoundingClientRect().top; container.style.transition = 'none'; };
        window.onmousemove = function(e) { if (!isDragging) return; container.style.transform = 'none'; container.style.left = (e.clientX - offsetX) + 'px'; container.style.top = (e.clientY - offsetY) + 'px'; };
        window.onmouseup = function() { isDragging = false; };
        window.addEventListener('keydown', function(e) { if (e.key === 'Escape') container.remove(); });
    };

    var lastObservedUrl = '';
    var urlMonitor = function() {
        var url = window.location.href;
        var isDashboard = url.indexOf('/portal/dashboard') !== -1;
        var isLoginPage = url.indexOf('auth/login') !== -1 || (url.indexOf('faveo') !== -1 && url.indexOf('/login') !== -1);
        var isVerifyOtpPage = url.indexOf('auth/verifyotp') !== -1;
        var isChangePwdPage = url.indexOf('auth/changepwd') !== -1;
        var isResetPage = url.indexOf('auth/resetpwd') !== -1 || isVerifyOtpPage || isChangePwdPage;
        var popup = document.getElementById('favLoginPopup');
 
        // 🚀 Detect Reset / Verify OTP state
        if (isResetPage) {
            var otpField = document.querySelector('input[formcontrolname="otp"]');
            var verifyBtn = document.getElementById('verfy_otp_btn');
            var isOtpPage = isVerifyOtpPage || otpField || verifyBtn;

            var isAlreadyFetching = popup && popup.dataset && popup.dataset.otpFetchStarted === 'true';

            if (isOtpPage && !isAlreadyFetching) {
                console.log('✅ [favLogin] Reset/Verify OTP State Detected! Starting OTP Fetch...');
                if (popup) popup.dataset.otpFetchStarted = 'true';
                
                chrome.storage.local.get(['favPendingResetAgent', 'favPendingResetId'], function(res) {
                    var agent = res.favPendingResetAgent;
                    var agentId = res.favPendingResetId;

                    var startFetchForAgent = function(targetAgent) {
                        if (!targetAgent) return;
                        var listContainer = document.getElementById('agentListContainer');
                        if (listContainer) {
                             listContainer.innerHTML = ''; 
                             var activeCard = document.createElement('div');
                             activeCard.className = 'agent-card'; activeCard.style.borderColor = '#4caf50';
                             var aName = getKey(targetAgent, 'agent name') || getKey(targetAgent, 'agent_name') || 'Agent';
                             var aId = getKey(targetAgent, 'agent id') || getKey(targetAgent, 'agent_id') || agentId || '--';
                             activeCard.innerHTML = '<div class="agent-icon-box" style="background:#4caf50;"><i class="fi flex fi-rr-user"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">' + aName + '</div><div style="font-size:10px; opacity:0.5;">ID: ' + aId + '</div></div>';
                             listContainer.appendChild(activeCard);

                             var statusMsg = document.createElement('div');
                             statusMsg.id = 'favLoginStatus';
                             statusMsg.style.cssText = 'color:rgba(255,255,255,0.6); font-size:12px; text-align:center; margin-top:15px;';
                             statusMsg.innerText = 'Resetting Password. Waiting for OTP...';
                             listContainer.appendChild(statusMsg);

                             var loader = document.createElement('div');
                             loader.id = 'favDancingDots';
                             loader.className = 'dancing-dots';
                             loader.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
                             listContainer.appendChild(loader);

                             updateUIToOTPState(targetAgent, listContainer);
                        }
                        fetchAndFillOtp(targetAgent, 0);
                    };

                    if (agent) {
                        startFetchForAgent(agent);
                    } else {
                        chrome.runtime.sendMessage({ type: 'FETCH_AGENTS' }, function(response) {
                            if (response && response.success && response.agents && response.agents.length > 0) {
                                var found = agentId ? response.agents.find(function(a) { return (getKey(a, 'agent id') || getKey(a, 'agent_id')) == agentId; }) : null;
                                var target = found || response.agents[0];
                                startFetchForAgent(target);
                            }
                        });
                    }
                });
            }
        }

        // 🚨 Active check for Max OTP Limit / "Invalid OTP" DOM error message on page
        if (isResetPage) {
            var allElements = document.querySelectorAll('div, span, p');
            var isMaxLimitMsg = false;
            for (var m = 0; m < allElements.length; m++) {
                var elText = (allElements[m].innerText || allElements[m].textContent || '').toLowerCase();
                if (elText.includes('reached maximum otp generation count limit') || elText.includes('maximum otp generation count limit') || elText.includes('maximum otp count')) {
                    isMaxLimitMsg = true;
                    break;
                }
            }

            if (isMaxLimitMsg) {
                var isAlreadyHandlingMaxLimit = popup && popup.dataset && popup.dataset.handlingMaxLimit === 'true';
                if (!isAlreadyHandlingMaxLimit) {
                    if (popup) popup.dataset.handlingMaxLimit = 'true';
                    console.warn('⚠️ [favLogin] Max OTP Generation Count Limit Reached! Redirecting to login page...');

                    showGlobalError('You have reached maximum OTP generation count limit');
                    setTimeout(function() {
                        window.location.hash = '#/auth/login';
                    }, 3000);
                }
            }

            var errEl = document.querySelector('.error-message.text-center, .error-message, div.alert-danger');
            if (errEl) {
                var errText = (errEl.innerText || errEl.textContent || '').toLowerCase();
                if (errText.includes('invalid otp') || errText.includes('valid otp')) {
                    var isAlreadyHandlingInvalidOtp = popup && popup.dataset && popup.dataset.handlingInvalidOtp === 'true';
                    if (!isAlreadyHandlingInvalidOtp) {
                        if (popup) popup.dataset.handlingInvalidOtp = 'true';
                        console.log('🚨 [favLogin] "Invalid OTP" error detected! Retrying fetch 4-5x before resending...');

                        var statusMsg2 = document.getElementById('favLoginStatus');
                        if (statusMsg2) { statusMsg2.innerText = 'Invalid OTP — Re-fetching latest OTP first...'; statusMsg2.style.color = '#ff5252'; }

                        chrome.storage.local.get(['favPendingResetAgent'], function(res2) {
                            var agentForRetry2 = res2.favPendingResetAgent;
                            if (!agentForRetry2) { if (popup) popup.dataset.handlingInvalidOtp = 'false'; return; }

                            var retryFetchBeforeResend2 = function(attemptsLeft2) {
                                if (attemptsLeft2 <= 0) {
                                    console.log('🔄 [favLogin] All re-fetch attempts done. Resending OTP now...');
                                    if (statusMsg2) { statusMsg2.innerText = 'No new OTP. Resending OTP...'; statusMsg2.style.color = '#ff9800'; }
                                    var resendBtnEl2 = document.querySelector('.unlock a') ||
                                                       document.querySelector('#resend_otp_btn') ||
                                                       Array.from(document.querySelectorAll('a, button')).find(function(el) {
                                                           return (el.innerText || '').toLowerCase().includes('resend');
                                                       });
                                    if (resendBtnEl2) { resendBtnEl2.click(); }
                                    setTimeout(function() {
                                        if (statusMsg2) { statusMsg2.innerText = 'Fetching OTP after resend...'; statusMsg2.style.color = '#4fc3f7'; }
                                        if (popup) popup.dataset.handlingInvalidOtp = 'false';
                                        fetchAndFillOtp(agentForRetry2, 0);
                                    }, 3500);
                                    return;
                                }
                                if (statusMsg2) statusMsg2.innerText = 'Re-fetching latest OTP (attempt ' + (6 - attemptsLeft2) + '/5)...';
                                var apiUrl2 = getOtpApiUrl(agentForRetry2);
                                if (!apiUrl2) { retryFetchBeforeResend2(0); return; }
                                fetch(apiUrl2)
                                    .then(function(r2) { return r2.json(); })
                                    .then(function(d2) {
                                        var otpDate2 = d2.date ? new Date(d2.date).getTime() : 0;
                                        var now2 = Date.now();
                                        var diff2 = otpDate2 > 0 ? ((now2 - otpDate2) / (1000 * 60)) : 999;
                                        if (otpDate2 !== 0 && diff2 <= 3) {
                                            console.log('✅ [favLogin] Fresh OTP found on watcher retry!');
                                            if (popup) popup.dataset.handlingInvalidOtp = 'false';
                                            displayOtpAndSubmit(d2, agentForRetry2);
                                        } else {
                                            setTimeout(function() { retryFetchBeforeResend2(attemptsLeft2 - 1); }, 2000);
                                        }
                                    })
                                    .catch(function() {
                                        setTimeout(function() { retryFetchBeforeResend2(attemptsLeft2 - 1); }, 2000);
                                    });
                            };

                            retryFetchBeforeResend2(5);
                        });
                    }
                }
            }

            // 🏆 Active check for "Password changed successfully" DOM message
            var successEl = document.querySelector('.success-message.text-center, .success-message, div.alert-success');
            var successText = successEl ? (successEl.innerText || successEl.textContent || '') : '';
            if (!successText) {
                var allPageEls = document.querySelectorAll('div, span, p');
                for (var s = 0; s < allPageEls.length; s++) {
                    var t = (allPageEls[s].innerText || allPageEls[s].textContent || '').toLowerCase();
                    if (t.includes('password changed successfully')) {
                        successText = 'Password changed successfully!!';
                        break;
                    }
                }
            }

            if (successText.toLowerCase().includes('password changed successfully')) {
                var isAlreadyHandlingPwdSuccess = popup && popup.dataset && popup.dataset.handlingPwdSuccess === 'true';
                if (!isAlreadyHandlingPwdSuccess) {
                    if (popup) popup.dataset.handlingPwdSuccess = 'true';
                    console.log('🎉 [favLogin] "Password changed successfully" detected! Resetting extension & redirecting to login...');

                    chrome.storage.local.get(['favPendingResetId', 'favPendingResetNewPassword'], function(res) {
                        if (res.favPendingResetId && res.favPendingResetNewPassword) {
                            chrome.runtime.sendMessage({ 
                                type: 'UPDATE_PASSWORD', 
                                payload: { userId: res.favPendingResetId, newPassword: res.favPendingResetNewPassword } 
                            }, function(resp) {
                                console.log('📡 [favLogin] Google Sheet password updated:', resp);
                                chrome.storage.local.set({ isAuthorized: false }, function() {
                                    chrome.storage.local.remove(['favPendingResetId', 'favPendingResetAgent', 'favPendingResetNewPassword', 'favPendingResetName'], function() {
                                        console.log('🔄 [favLogin] Extension reset & reloading page!');
                                        window.location.reload();
                                    });
                                });
                            });
                        }
                    });

                    var listContainer = document.getElementById('agentListContainer');
                    if (listContainer) {
                        listContainer.innerHTML = '<div style="color:#4caf50; padding:20px 10px; font-size:13px; text-align:center; font-weight:600; animation: favSlideDown 0.3s ease;">Password changed successfully!!</div>';
                    }

                    setTimeout(function() {
                        window.location.hash = '#/auth/login';
                    }, 2500);
                }
            }

            // 🔑 Detect Change Password Page state (input[formcontrolname="new_pwd"], input[formcontrolname="conf_pwd"], #cpwd_btn)
            var newPwdInput = document.querySelector('input[formcontrolname="new_pwd"]');
            var confPwdInput = document.querySelector('input[formcontrolname="conf_pwd"]');
            var isChangePwdState = isChangePwdPage || (newPwdInput && confPwdInput);
            var isChangePwdDone = popup && popup.dataset && popup.dataset.changePwdDone === 'true';

            if (isChangePwdState && !isChangePwdDone) {
                if (popup) popup.dataset.changePwdDone = 'true';
                console.log('⚡ [favLogin] Change Password Page Detected! Filling New Password...');

                chrome.storage.local.get(['favPendingResetAgent', 'favPendingResetId'], function(res) {
                    var agent = res.favPendingResetAgent;
                    var agentId = res.favPendingResetId;

                    var currentPass = agent ? (getKey(agent, 'agent password') || getKey(agent, 'agent_password') || '') : '';
                    currentPass = (currentPass || '').trim();

                    // Password toggling logic:
                    // If currentPass ends with '123456' or equals 'Ajay@123456' -> newPass = 'Ajay@12345'
                    // If currentPass ends with '12345' or equals 'Ajay@12345' -> newPass = 'Ajay@123456'
                    var newPass = 'Ajay@123456';
                    if (currentPass === 'Ajay@123456' || currentPass.endsWith('123456')) {
                        newPass = 'Ajay@12345';
                    } else if (currentPass === 'Ajay@12345' || currentPass.endsWith('12345')) {
                        newPass = 'Ajay@123456';
                    } else {
                        newPass = 'Ajay@123456';
                    }

                    console.log('🔑 [favLogin] Old Pass:', currentPass, '==> New Pass:', newPass, 'for Agent ID:', agentId);

                    var statusMsg = document.getElementById('favLoginStatus');
                    if (statusMsg) statusMsg.innerText = 'Setting New Password (' + newPass + ')...';

                    var fillInputs = function() {
                        var nInput = document.querySelector('input[formcontrolname="new_pwd"]');
                        var cInput = document.querySelector('input[formcontrolname="conf_pwd"]');
                        var cpwdBtn = document.getElementById('cpwd_btn') || document.querySelector('#cpwd_btn') || document.querySelector('.login-btn');

                        if (nInput && cInput) {
                            nInput.focus();
                            nInput.value = newPass;
                            nInput.dispatchEvent(new Event('input', { bubbles: true }));
                            nInput.dispatchEvent(new Event('change', { bubbles: true }));
                            nInput.dispatchEvent(new Event('keyup', { bubbles: true }));
                            nInput.dispatchEvent(new Event('blur', { bubbles: true }));

                            cInput.focus();
                            cInput.value = newPass;
                            cInput.dispatchEvent(new Event('input', { bubbles: true }));
                            cInput.dispatchEvent(new Event('change', { bubbles: true }));
                            cInput.dispatchEvent(new Event('keyup', { bubbles: true }));
                            cInput.dispatchEvent(new Event('blur', { bubbles: true }));

                            // Save pending reset password to storage and submit form
                            chrome.storage.local.set({ favPendingResetNewPassword: newPass }, function() {
                                setTimeout(function() {
                                    if (!cpwdBtn) {
                                        cpwdBtn = document.getElementById('cpwd_btn') || document.querySelector('#cpwd_btn') || document.querySelector('.login-btn');
                                    }
                                    if (cpwdBtn && cpwdBtn.isConnected) {
                                        console.log('🏁 Submitting CHANGE PASSWORD form with newPass:', newPass);
                                        cpwdBtn.disabled = false;
                                        cpwdBtn.removeAttribute('disabled');
                                        cpwdBtn.click();
                                    }
                                }, 800);
                            });
                        }
                    };

                    fillInputs();
                });
            }

            chrome.storage.local.get(['favPendingResetId'], function(res) {
                if (res.favPendingResetId) {
                    var resetId = res.favPendingResetId;
                    console.log('⚡ Autofilling Reset Password for:', resetId);
                    
                    var checkInterval = setInterval(function() {
                        var idInput = document.querySelector('input[formcontrolname="userId"]');
                        var genBtn = document.getElementById('gen_otp_btn');
                        
                        if (idInput && genBtn) {
                            clearInterval(checkInterval);
                            idInput.focus();
                            idInput.value = resetId;
                            idInput.dispatchEvent(new Event('input', { bubbles: true }));
                            idInput.dispatchEvent(new Event('change', { bubbles: true }));
                            idInput.dispatchEvent(new Event('blur', { bubbles: true }));
                            
                            setTimeout(function() {
                                if (genBtn && genBtn.isConnected) {
                                    genBtn.disabled = false;
                                    genBtn.removeAttribute('disabled');
                                    genBtn.click();
                                }
                            }, 600);
                        }
                    }, 500);
                    
                    // Stop after 10s if not found
                    setTimeout(function() { clearInterval(checkInterval); }, 10000);
                }
            });
        }

        // 🎯 If URL changed and we are now on Login page, check if password reset just completed!
        if (url !== lastObservedUrl) {
            if (isLoginPage) {
                chrome.storage.local.get(['favPendingResetId', 'favPendingResetNewPassword'], function(res) {
                    if (res.favPendingResetId && res.favPendingResetNewPassword) {
                        var rId = res.favPendingResetId;
                        var rPass = res.favPendingResetNewPassword;
                        console.log('🎉 [favLogin] Password reset complete! Syncing new password to Google Sheet for:', rId);

                        chrome.runtime.sendMessage({ 
                            type: 'UPDATE_PASSWORD', 
                            payload: { userId: rId, newPassword: rPass } 
                        }, function(response) {
                            console.log('📡 [favLogin] Google Sheet password updated:', response);
                            chrome.storage.local.set({ isAuthorized: false }, function() {
                                chrome.storage.local.remove(['favPendingResetId', 'favPendingResetAgent', 'favPendingResetNewPassword', 'favPendingResetName'], function() {
                                    console.log('🔄 [favLogin] Showing login popup and reloading page...');
                                    var popupEl = document.getElementById('favLoginPopup');
                                    if (popupEl) popupEl.remove();
                                    createLoginPopup();
                                    setTimeout(function() {
                                        window.location.reload();
                                    }, 1200);
                                });
                            });
                        });
                    }
                });
                var clearInputs = function() {
                    try {
                        document.querySelectorAll('input').forEach(function(input) {
                            if (input.value !== '') {
                                input.value = '';
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        });
                    } catch (e) {}
                };
                
                // Clear immediately and at intervals to catch delayed rendering/autofill
                [0, 200, 500, 1000, 1500, 2000].forEach(function(delay) {
                    setTimeout(clearInputs, delay);
                });
            }
            lastObservedUrl = url;
        }

        if (isDashboard && popup) {
            popup.remove();
        } else if ((isLoginPage || isResetPage) && !popup) {
            createLoginPopup();
        }
    };

    loadModernIcons();
    createLoginPopup(); 
    setInterval(urlMonitor, 1000);
    window.addEventListener('hashchange', urlMonitor);
    // 🔄 Standalone watcher: Force reload + skip agent on "connection has been closed" error on login page
    setInterval(function() {
        var url = window.location.href;
        if (!url.includes('#auth/login') && !url.includes('#/auth/login')) return;

        var errorEls = document.querySelectorAll('.error-message.text-center');
        errorEls.forEach(function(el) {
            var txt = el.innerText || el.textContent || '';
            if (txt.includes('connection has been closed')) {
                console.log('⚠️ "Connection closed" error detected on login page! Force reloading & skipping agent...');
                // Prevent repeated triggers
                el.remove();
                chrome.storage.local.get(['is_master_extension', 'is_autopilot_active', 'autopilot_paused', 'autopilot_index', 'autopilot_agents'], function(r) {
                    if (r.is_master_extension && r.is_autopilot_active && !r.autopilot_paused && r.autopilot_agents) {
                        var nextIndex = (r.autopilot_index + 1) % r.autopilot_agents.length;
                        var delayMs = (nextIndex === 0) ? (10 * 60 * 1000) : (2 * 60 * 1000);
                        chrome.storage.local.set({
                            autopilot_index: nextIndex,
                            autopilot_next_login_time: Date.now() + delayMs
                        }, function() {
                            console.log('⚠️ Autopilot: Skipped to agent index ' + nextIndex + ' in ' + (delayMs / 60000) + 'm. Reloading...');
                            window.location.reload();
                        });
                    } else {
                        window.location.reload();
                    }
                });
            }
        });
    }, 2000);

})();
