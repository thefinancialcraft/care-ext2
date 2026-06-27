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

        var onAuthorized = function() {
            // 🎯 AUTHORIZED ACTIONS
            header.innerHTML = '<div style="display:flex; align-items:center; gap:10px;"><i class="fi flex fi-rr-shield-check" style="color:#4caf50; font-size:18px;"></i><h3 class="fav-login-title">Select Agent Profile</h3></div>';
            
            chrome.runtime.sendMessage({ type: 'FETCH_AGENTS' }, function(response) {
                if (response && response.success) renderAgents(response.agents);
                else list.innerHTML = '<div style="color:#ff5252; padding:20px; text-align:center;">Offline</div>';
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

        var showLoginView = function(extId) {
            header.innerHTML = '<div style="display:flex; align-items:center; gap:10px;"><i class="fi flex fi-rr-lock" style="color:#ffb300; font-size:18px;"></i><h3 class="fav-login-title">Extension Login</h3></div>';
            
            chrome.storage.local.get(['favUserProfile', 'is_admin'], function(res) {
                var profile = res.favUserProfile;
                
                if (profile && profile.email) {
                    // 👤 SHOW USER CARD
                    list.innerHTML = '\
                        <div style="display:flex; flex-direction:column; gap:10px; padding:10px;">\
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
                             // This part was handled by setupAdminSecurity previously, I'll re-implement if needed or call it
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
                                    isAuthorized: (response.step === 'AUTHORIZED') // Set true if direct login
                                };

                                chrome.storage.local.set(storageData, function() {
                                    console.log('🔄 [AUTH SYNC] Data stored. Step:', response.step);
                                    console.log('📊 [EXTENSION DB SETTINGS]:', {
                                        isAdmin: response.is_admin,
                                        profileVisible: response.profile_visible,
                                        renewalVisible: response.renewal_visible,
                                        digitalDiscount: response.digital_discount
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
                                alert(response.message || 'Still Pending Approval or Error.');
                                showLoginView(extId);
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
                        if (!email) { alert('Please enter your email'); return; }
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
                                    isAuthorized: (response.step === 'AUTHORIZED')
                                };

                                chrome.storage.local.set(storageData, function() {
                                    console.log('📊 [EXTENSION DB SETTINGS]:', {
                                        isAdmin: response.is_admin,
                                        profileVisible: response.profile_visible,
                                        renewalVisible: response.renewal_visible,
                                        digitalDiscount: response.digital_discount
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
                                alert(response.message || 'Not authorized or mismatch.');
                                showLoginView(extId);
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
                card.innerHTML = '<div class="agent-icon-box"><i class="fi flex fi-rr-user"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">' + aName + '</div><div style="font-size:10px; opacity:0.5;">ID: ' + aId + '</div></div>' + (index < 9 ? '<div class="key-badge"><span>' + (index+1) + '</span><i class="fi fi-rr-edit"></i></div>' : '');
                
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
            console.log('👑 [UI] Admin Workflow Started');
            list.innerHTML = '';
            var header = document.createElement('div');
            header.className = 'agent-card'; header.style.borderColor = '#f44336'; header.style.cursor = 'default';
            header.innerHTML = '<div class="agent-icon-box" style="background:#f44336;"><i class="fi flex fi-rr-shield-check"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">Admin Authentication</div><div style="font-size:10px; opacity:0.5;">Sending OTP to Master Email...</div></div>';
            list.appendChild(header);

            var loader = document.createElement('div'); loader.className = 'dancing-dots';
            loader.innerHTML = '<div class="dot" style="background:#f44336;"></div><div class="dot" style="background:#f44336;"></div><div class="dot" style="background:#f44336;"></div>';
            list.appendChild(loader);

            // 📡 Request OTP from background
            console.log('📡 [UI] Requesting OTP...');
            chrome.runtime.sendMessage({ type: 'SEND_ADMIN_OTP' }, function(response) {
                console.log('📥 [UI] OTP Response Received:', response);
                if (response && response.success) {
                    showAdminOTPInput(list, originalAgents);
                } else {
                    var errorMsg = (response && response.message) ? response.message : 'Check your internet or Apps Script deployment.';
                    console.error('❌ [UI] OTP Send Failed:', errorMsg);
                    showGlobalError('Failed: ' + errorMsg);
                }
            });
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
            panelHeader.innerHTML = '<i class="fi flex fi-rr-shield-check" style="color:#f44336; font-size:18px;"></i><div style="font-size:14px; font-weight:700;">ADMIN CONTROL CENTER</div>';
            
            var backBtn = document.createElement('i');
            backBtn.className = 'fi flex fi-rr-arrow-small-left';
            backBtn.style.cssText = 'margin-left:auto; cursor:pointer; opacity:0.6;';
            backBtn.onclick = function() { renderAgents(originalAgents); };
            panelHeader.appendChild(backBtn);
            list.appendChild(panelHeader);

            var loading = document.createElement('div');
            loading.className = 'loading-dots';
            loading.style.padding = '20px';
            loading.innerHTML = '<div class="dot" style="background:#f44336;"></div><div class="dot" style="background:#f44336;"></div><div class="dot" style="background:#f44336;"></div>';
            list.appendChild(loading);

            chrome.runtime.sendMessage({ type: 'GET_ALL_USERS' }, function(response) {
                loading.remove();
                if (response && response.success) {
                    var users = response.users || [];
                    var pendingUsers = users.filter(function(u) { return u.status.toLowerCase() === 'pending'; });
                    var approvedUsers = users.filter(function(u) { return u.status.toLowerCase() === 'approved'; });

                    // 1. PENDING SECTION
                    if (pendingUsers.length > 0) {
                        var pendingTitle = document.createElement('div');
                        pendingTitle.style.cssText = 'font-size:10px; color:#ffb300; font-weight:700; margin:10px 0 5px 10px; letter-spacing:1px;';
                        pendingTitle.innerText = 'PENDING APPROVAL (' + pendingUsers.length + ')';
                        list.appendChild(pendingTitle);

                        pendingUsers.forEach(function(user) {
                            renderAdminUserCard(list, user, 'pending');
                        });
                    }

                    // 2. APPROVED SECTION
                    var approvedTitle = document.createElement('div');
                    approvedTitle.style.cssText = 'font-size:10px; color:#4caf50; font-weight:700; margin:15px 0 5px 10px; letter-spacing:1px;';
                    approvedTitle.innerText = 'APPROVED USERS (' + approvedUsers.length + ')';
                    list.appendChild(approvedTitle);

                    approvedUsers.forEach(function(user) {
                        renderAdminUserCard(list, user, 'approved');
                    });

                } else {
                    showGlobalError('Failed to fetch user list.');
                }
            });
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

                // 🎯 [Universal Selector] Try both Login and Reset Password fields
                var otpInput = document.getElementById('passwordOtp') || document.querySelector('input[formcontrolname="otp"]');
                var submitBtn = document.getElementById('sign_in_btn') || document.getElementById('verfy_otp_btn');

                if (otpInput) {
                    otpInput.value = fullOtp;
                    otpInput.dispatchEvent(new Event('input', { bubbles: true }));
                    otpInput.dispatchEvent(new Event('change', { bubbles: true }));
                    otpInput.dispatchEvent(new Event('blur', { bubbles: true }));
                    
                    setTimeout(function() { 
                        if (submitBtn) { 
                            console.log('🏁 Submitting OTP to:', submitBtn.id);
                            submitBtn.disabled = false; submitBtn.click(); 
                        } 
                    }, 800);
                }
            } else {
                console.error('❌ [favLogin] Invalid OTP Length:', otpArr);
                if (statusMsg) statusMsg.innerText = 'Invalid OTP Received.';
            }
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
        var isResetPage = url.indexOf('auth/resetpwd') !== -1;
        var popup = document.getElementById('favLoginPopup');
 
        // 🚀 NEW: Detect 'OTP sent successfully' on Reset Page
        if (isResetPage) {
            // Check for success message in DOM more robustly
            var allDivs = document.querySelectorAll('div');
            var msgDiv = null;
            for (var i = 0; i < allDivs.length; i++) {
                var d = allDivs[i];
                if (d.innerText && d.innerText.includes('OTP sent successfully') && (d.style.color === 'green' || d.getAttribute('style')?.includes('color: green'))) {
                    msgDiv = d;
                    break;
                }
            }

            if (msgDiv && (!popup.dataset.waitingForResetOtp || popup.dataset.waitingForResetOtp === 'false')) {
                console.log('✅ [favLogin] Reset OTP Sent Detected! Switching UI...');
                popup.dataset.waitingForResetOtp = 'true'; // Prevent duplicate triggers
                
                chrome.storage.local.get(['favPendingResetAgent'], function(res) {
                    if (res.favPendingResetAgent) {
                        var listContainer = document.getElementById('agentListContainer');
                        if (listContainer) {
                             // Clear "Please wait..." state before switching to OTP
                             listContainer.innerHTML = ''; 
                             // Re-add header card
                             var activeCard = document.createElement('div');
                             activeCard.className = 'agent-card'; activeCard.style.borderColor = '#4caf50';
                             activeCard.innerHTML = '<div class="agent-icon-box" style="background:#4caf50;"><i class="fi flex fi-rr-user"></i></div><div style="text-align:left;"><div style="font-size:13px; font-weight:600;">' + (res.favPendingResetAgent.agent_name || 'Agent') + '</div><div style="font-size:10px; opacity:0.5;">ID: ' + (res.favPendingResetAgent.agent_id || '--') + '</div></div>';
                             listContainer.appendChild(activeCard);
                             
                             updateUIToOTPState(res.favPendingResetAgent, listContainer);
                        }
                    }
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
                            idInput.value = resetId;
                            idInput.dispatchEvent(new Event('input', { bubbles: true }));
                            idInput.dispatchEvent(new Event('change', { bubbles: true }));
                            idInput.dispatchEvent(new Event('blur', { bubbles: true }));
                            
                            setTimeout(function() {
                                genBtn.disabled = false;
                                genBtn.click();
                                chrome.storage.local.remove(['favPendingResetId']); // 🧹 Cleanup
                            }, 500);
                        }
                    }, 500);
                    
                    // Stop after 10s if not found
                    setTimeout(function() { clearInterval(checkInterval); }, 10000);
                }
            });
        }

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
