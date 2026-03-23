(function() {
    if (window.favLoginMonitorStarted) return;
    window.favLoginMonitorStarted = true;

    var loadModernIcons = function() {
        var href = 'https://cdn-uicons.flaticon.com/2.6.0/uicons-regular-rounded/css/uicons-regular-rounded.css';
        if (!document.querySelector('link[href="' + href + '"]')) {
            var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link);
        }
    };

    var createLoginPopup = function() {
        if (document.getElementById('favLoginPopup')) return;

        // Clear all inputs on the page when opening the popup
        try {
            document.querySelectorAll('input').forEach(function(input) {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
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
                .agent-card:hover { background: rgba(255, 255, 255, 0.1); transform: translateX(5px); border-color: #0065b3; }\
                .agent-icon-box { width: 32px; height: 32px; background: #0065b3; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }\
                .key-badge { margin-left: auto; font-size: 9px; background: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 4px; color: rgba(255,255,255,0.5); }\
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
        header.innerHTML = '<div style="display:flex; align-items:center; gap:10px;"><i class="fi flex fi-rr-shield-check" style="color:#4caf50; font-size:18px;"></i><h3 class="fav-login-title">Select Agent Profile</h3></div>';
        container.appendChild(header);

        var list = document.createElement('div');
        list.id = 'agentListContainer';
        list.innerHTML = '<div style="color:rgba(255,255,255,0.4); font-size:12px; padding:20px; text-align:center;">Fetching...</div>';
        container.appendChild(list);

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
                card.innerHTML = '<div class="agent-icon-box"><i class="fi flex fi-rr-user"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">' + aName + '</div><div style="font-size:10px; opacity:0.5;">ID: ' + aId + '</div></div>' + (index < 9 ? '<div class="key-badge">' + (index+1) + '</div>' : '');
                card.onclick = function() { startLoginCycle(agent, aName, aId, list); };
                list.appendChild(card);
            });
        };

        var startLoginCycle = function(agent, aName, aId, list) {
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
                userInput.value = aId; passInput.value = getKey(agent, 'agent password') || getKey(agent, 'agent_password') || '';
                userInput.dispatchEvent(new Event('input', { bubbles: true })); passInput.dispatchEvent(new Event('input', { bubbles: true }));
                setTimeout(function() { if (loginBtn) { loginBtn.disabled = false; loginBtn.click(); } }, 500);
            }
            startPageObserver(agent, list);
        };

        var startPageObserver = function(agent, list) {
            var observer = new MutationObserver(function() {
                var successMsg = document.querySelector('.success-message');
                var resendBtn = document.querySelector('.unlock a');
                
                // [NEW] Check for 'Invalid User Details' or 'Blocked' Errors on the page
                var allErrors = document.querySelectorAll('.error-message.text-center');
                var foundError = false;

                allErrors.forEach(function(el) {
                    var txt = el.innerText;
                    var statusMsg = document.getElementById('favLoginStatus');
                    var loader = document.getElementById('favDancingDots');

                    if (txt.includes('Please Enter Valid User Details')) {
                        if (statusMsg) { statusMsg.innerText = 'FILL CORRECT DETAILS'; statusMsg.style.color = '#ff5252'; }
                        if (loader) loader.style.display = 'none';
                        foundError = true;
                    } else if (txt.includes('UserId is blocked') || txt.includes('maximum login attempt limit')) {
                        if (statusMsg) { statusMsg.innerText = 'NEED TO RESET PASSWORD'; statusMsg.style.color = '#ffb300'; }
                        if (loader) loader.style.display = 'none';
                        foundError = true;
                    }
                });

                if (foundError) {
                    observer.disconnect();
                    return;
                }

                if (successMsg || (resendBtn && resendBtn.innerText.includes('Resend OTP'))) {
                    updateUIToOTPState(agent, list); observer.disconnect();
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        };

        var updateUIToOTPState = function(agent, list) {
            var statusMsg = document.getElementById('favLoginStatus');
            if (statusMsg) statusMsg.innerText = 'Sign-in confirmed. Waiting for OTP...';
            
            var loader = document.getElementById('favDancingDots');
            if (loader) loader.style.display = 'flex'; // Ensure dots dance while waiting

            // Ensure singleton OTP Group
            var otpGroup = document.querySelector('.otp-group');
            if (!otpGroup) {
                otpGroup = document.createElement('div');
                otpGroup.className = 'otp-group';
                for (var i = 0; i < 6; i++) {
                    var box = document.createElement('div');
                    box.className = 'otp-box'; box.id = 'otp-box-' + i;
                    box.innerHTML = '<div class="otp-dot" id="otp-dot-'+i+'"></div>';
                    otpGroup.appendChild(box);
                }
                list.appendChild(otpGroup);
            } else {
                // Reset to dots if exists
                for (var j = 0; j < 6; j++) {
                    var b = document.getElementById('otp-box-' + j);
                    if (b) b.innerHTML = '<div class="otp-dot"></div>'; b.style.background = '';
                }
            }

            // [UPDATE] 3-5s gap before first OTP request
            var delay = 3000 + Math.floor(Math.random() * 2000);
            setTimeout(function() {
                fetchAndFillOtp(agent, 0); 
            }, delay);
        };

        var fetchAndFillOtp = function(agent, retryCount) {
            retryCount = retryCount || 0;
            var apiUrl = getKey(agent, 'agent_otp_finder');
            var statusMsg = document.getElementById('favLoginStatus');
            
            if (apiUrl) {
                if (statusMsg) statusMsg.innerText = (retryCount < 90 ? 'Fetching OTP (' + (retryCount+1) + '/3)...' : 'Fetching latest OTP...');
                
                fetch(apiUrl)
                    .then(function(res) { return res.json(); })
                    .then(function(data) {
                        var otpDate = data.date ? new Date(data.date).getTime() : 0;
                        var now = Date.now();
                        var diffMinutes = (now - otpDate) / (1000 * 60);

                        // If OTP is fresh (within 2 mins)
                        if (otpDate > 0 && diffMinutes <= 2) {
                            displayOtpAndSubmit(data, agent);
                        } else {
                            // OTP is old or date missing
                            if (retryCount < 2) {
                                setTimeout(function() {
                                    fetchAndFillOtp(agent, retryCount + 1);
                                }, 4000); // 4s gap between retries
                            } else if (retryCount === 2) {
                                // 3 attempts failed (0,1,2), click Resend
                                var resendBtn = Array.from(document.querySelectorAll('.unlock a')).find(function(a) { 
                                    return a.innerText.toLowerCase().includes('resend otp'); 
                                });
                                
                                if (resendBtn) {
                                    if (statusMsg) statusMsg.innerText = 'OTP expired. Clicking Resend...';
                                    resendBtn.click();
                                    setTimeout(function() {
                                        fetchAndFillOtp(agent, 99); // Final attempt after resend
                                    }, 5000);
                                } else {
                                    showGlobalError('OTP Not generated. Try again');
                                }
                            } else {
                                // Final check after Resend also failed
                                showGlobalError('OTP Not generated after Resend');
                            }
                        }
                    })
                    .catch(function(e) { 
                        console.error('Fetch Error:', e);
                        if (statusMsg) {
                            statusMsg.innerText = 'Fetch Failed.';
                            setTimeout(function() {
                                showGlobalError('Network Error. Please try again.');
                            }, 1000);
                        }
                    });
            }
        };

        var showGlobalError = function(msg) {
            list.innerHTML = '<div style="color:#ff5252; padding:30px 10px; font-size:13px; text-align:center; font-weight:600; animation: favSlideDown 0.3s ease;">' + (msg || 'Something went wrong, try again') + '</div>';
            
            setTimeout(function() {
                list.innerHTML = '<div style="color:rgba(255,255,255,0.4); font-size:12px; padding:20px; text-align:center;">Reloading agents...</div>';
                chrome.runtime.sendMessage({ type: 'FETCH_AGENTS' }, function(response) {
                    if (response && response.success) renderAgents(response.agents);
                    else list.innerHTML = '<div style="color:#ff5252; padding:20px; text-align:center;">Offline</div>';
                });
            }, 2000);
        };

        var displayOtpAndSubmit = function(otpData, agent) {
            console.log('🚀 [favLogin] OTP Received:', otpData);
            var statusMsg = document.getElementById('favLoginStatus');
            var timeStr = (new Date()).toTimeString().split(' ')[0];
            
            if (statusMsg) {
                statusMsg.innerHTML = 'OTP Received! <i class="fi flex fi-rr-refresh reload-btn" id="favOtpReload"></i> <span style="font-size:9px; opacity:0.6; display:block;">at ' + timeStr + '</span>';
                document.getElementById('favOtpReload').onclick = function() { 
                    this.style.transform = 'rotate(360deg)';
                    updateUIToOTPState(agent, document.getElementById('agentListContainer')); 
                };
            }
            
            // Extract digits robustly
            var rawData = typeof otpData === 'string' ? otpData : JSON.stringify(otpData);
            var otpArr = rawData.match(/\d/g);

            if (otpArr && otpArr.length >= 6) {
                var fullOtp = otpArr.slice(0, 6).join('');
                console.log('✅ [favLogin] Processing OTP:', fullOtp);

                for (var i = 0; i < 6; i++) {
                    var box = document.getElementById('otp-box-' + i);
                    if (box) { 
                        box.innerHTML = otpArr[i]; 
                        box.style.color = '#fff';
                        box.style.background = 'rgba(76, 175, 80, 0.2)'; 
                    }
                }

                var otpInput = document.getElementById('passwordOtp');
                if (otpInput) {
                    otpInput.value = fullOtp;
                    otpInput.dispatchEvent(new Event('input', { bubbles: true }));
                    otpInput.dispatchEvent(new Event('change', { bubbles: true }));
                    otpInput.dispatchEvent(new Event('blur', { bubbles: true }));
                    
                    setTimeout(function() { 
                        var b = document.getElementById('sign_in_btn'); 
                        if (b) { 
                            console.log('🏁 Submitting OTP...');
                            b.disabled = false; b.click(); 
                        } 
                    }, 800);
                }
            } else {
                console.error('❌ [favLogin] Invalid OTP Length:', otpArr);
                if (statusMsg) statusMsg.innerText = 'Invalid OTP Received.';
            }
        };

        chrome.runtime.sendMessage({ type: 'FETCH_AGENTS' }, function(response) {
            if (response && response.success) renderAgents(response.agents);
            else list.innerHTML = '<div style="color:#ff5252; padding:20px; text-align:center;">Offline</div>';
        });

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
        var popup = document.getElementById('favLoginPopup');

        // If URL changed and we are now on a login page, clear inputs immediately and with retries
        if (url !== lastObservedUrl) {
            if (isLoginPage) {
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
        } else if (isLoginPage && !popup) {
            createLoginPopup();
        }
    };

    loadModernIcons();
    createLoginPopup(); 
    setInterval(urlMonitor, 1000);
    window.addEventListener('hashchange', urlMonitor);

})();
