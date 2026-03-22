// public/js/dashboard.js

// ==========================================
// 1. GLOBAL AUTH, SOCKET & UTILITIES
// ==========================================
if (localStorage.getItem('yh_user_loggedIn') !== 'true') {
    window.location.href = '/';
}

const socket = io(); 
const myName = localStorage.getItem('yh_user_name') || "Hustler";
let currentRoom = "YH-community";

function logoutUser() {
    localStorage.removeItem('yh_user_loggedIn');
    localStorage.removeItem('yh_user_name');
    localStorage.removeItem('yh_user_avatar');
    
    // 🔥 FIX: Burahin din dapat ang Academy Access kapag nag-logout!
    localStorage.removeItem('yh_academy_access'); 
    
    window.location.href = '/'; 
}

function showToast(message, type = "success") {
    const toast = document.getElementById('toast-notification');
    const toastMsg = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    if(!toast) return;
    toastMsg.innerText = message;
    if (type === "error") {
        toast.classList.add('error-toast');
        toastIcon.innerText = "⚠️";
    } else {
        toast.classList.remove('error-toast');
        toastIcon.innerText = "🎉";
    }
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3500);
}

function updateUserProfile(newName, newAvatarData) {
    if(newName) {
        const initial = newName.charAt(0).toUpperCase();
        const elsName = [document.getElementById('top-nav-name'), document.getElementById('right-sidebar-name'), document.getElementById('stage-user-name')];
        elsName.forEach(el => { if(el) el.innerText = newName; });

        const elsInit = [document.getElementById('top-nav-initial'), document.getElementById('right-sidebar-initial'), document.getElementById('stage-user-initial')];
        elsInit.forEach(el => { if(el && !newAvatarData) { el.innerText = initial; el.style.backgroundImage = 'none'; } });
    }
    if(newAvatarData) {
        const elsAvatar = [document.getElementById('top-nav-initial'), document.getElementById('right-sidebar-initial'), document.getElementById('stage-user-initial')];
        elsAvatar.forEach(el => {
            if(el) { el.innerText = ''; el.style.backgroundImage = `url(${newAvatarData})`; el.style.backgroundSize = 'cover'; el.style.backgroundPosition = 'center'; }
        });
    }
}

function sendSystemNotification(title, text, avatarStr, color, target) {
    const notifList = document.getElementById('notif-list-container');
    const bellBadge = document.getElementById('notif-badge-count');
    if(!notifList) return;
    
    const li = document.createElement('li');
    li.className = "unread fade-in";
    if(target) li.setAttribute('data-target', target);
    
    li.innerHTML = `<div class="notif-img" style="background: ${color};">${avatarStr}</div><div class="notif-text"><strong>${title}</strong> ${text}<span class="notif-time">Just now</span></div>`;
    li.addEventListener('click', () => {
        li.classList.remove('unread');
        const remainingUnread = document.querySelectorAll('#notif-dropdown .unread').length;
        if(bellBadge) { if (remainingUnread === 0) bellBadge.style.display = 'none'; else bellBadge.innerText = remainingUnread; }
        document.getElementById('notif-dropdown').classList.remove('show');
        if (target === 'announcements') document.getElementById('nav-announcements').click();
        else if (target === 'main-chat') document.getElementById('nav-chat').click();
    });
    notifList.prepend(li);
    if(bellBadge) {
        bellBadge.style.display = 'flex'; bellBadge.innerText = document.querySelectorAll('#notif-dropdown .unread').length;
        bellBadge.parentElement.style.transform = 'scale(1.2)'; setTimeout(() => { bellBadge.parentElement.style.transform = 'scale(1)'; }, 200);
    }
}

// ==========================================
// MAIN DASHBOARD LOGIC (ON LOAD)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

    let currentVaultFolder = null; 
    let selectedVaultIndex = null;
    let pendingTaskToComplete = null;
    let currentProfileUser = null;
    let currentProfileIcon = null;
    let currentProfileBg = null;

    // --- UPDATED NAVIGATION & ROUTING LOGIC ---
    function switchServer(targetDivision) {
        document.querySelectorAll('.nav-tab').forEach(i => i.classList.remove('active'));
        
        const academyWrapper = document.getElementById('academy-wrapper');
        const viewPlazas = document.getElementById('view-plazas');
        const viewFederation = document.getElementById('view-federation');
        const universeHubView = document.getElementById('universe-hub-view');

        // Itago lahat muna
        if (academyWrapper) academyWrapper.style.display = 'none';
        if (universeHubView) universeHubView.style.display = 'none';
        if (viewPlazas) viewPlazas.classList.add('hidden-step');
        if (viewFederation) viewFederation.classList.add('hidden-step');

        if (targetDivision === 'plazas') {
            document.getElementById('server-plazas').classList.add('active');
            if(viewPlazas) {
                viewPlazas.classList.remove('hidden-step');
                viewPlazas.classList.remove('fade-in'); void viewPlazas.offsetWidth; viewPlazas.classList.add('fade-in');
            }
        } else if (targetDivision === 'federation') {
            document.getElementById('server-federation').classList.add('active');
            if(viewFederation) {
                viewFederation.classList.remove('hidden-step');
                viewFederation.classList.remove('fade-in'); void viewFederation.offsetWidth; viewFederation.classList.add('fade-in');
            }
        } else {
            // Academy Tab
            document.getElementById('server-academy').classList.add('active');
            checkUniverseAccess(); 
        }
    }

    const serverAcademy = document.getElementById('server-academy');
    const serverPlazas = document.getElementById('server-plazas');
    const serverFederation = document.getElementById('server-federation');
    if (serverAcademy) serverAcademy.addEventListener('click', () => switchServer('academy'));
    if (serverPlazas) serverPlazas.addEventListener('click', () => switchServer('plazas'));
    if (serverFederation) serverFederation.addEventListener('click', () => switchServer('federation'));

    function openRoom(type, element) {
        document.querySelectorAll('.channel-link').forEach(link => link.classList.remove('active'));
        if(element && !element.classList.contains('room-entry')) element.classList.add('active');
        else {
            const navVoice = document.getElementById('nav-voice');
            const navVideo = document.getElementById('nav-video');
            if (type === 'voice-lobby' || (element && element.closest('#lounge-grid') && navVoice)) navVoice.classList.add('active');
            else if (type === 'video' || (element && element.closest('#video-grid') && navVideo)) navVideo.classList.add('active');
        }

        const views = {
            'academy-chat': document.getElementById('academy-chat'),
            'center-stage-view': document.getElementById('center-stage-view'),
            'announcements-view': document.getElementById('announcements-view'),
            'voice-lobby-view': document.getElementById('voice-lobby-view'),
            'video-lobby-view': document.getElementById('video-lobby-view'),
            'vault-view': document.getElementById('vault-view')
        };

        Object.values(views).forEach(view => { if(view) view.classList.add('hidden-step'); });

        if (type === 'voice-lobby' && views['voice-lobby-view']) {
            views['voice-lobby-view'].classList.remove('hidden-step');
            views['voice-lobby-view'].classList.remove('fade-in'); void views['voice-lobby-view'].offsetWidth; views['voice-lobby-view'].classList.add('fade-in');
        }
        else if (type === 'video' && views['video-lobby-view']) {
            views['video-lobby-view'].classList.remove('hidden-step');
            views['video-lobby-view'].classList.remove('fade-in'); void views['video-lobby-view'].offsetWidth; views['video-lobby-view'].classList.add('fade-in');
        } 
        else if (type === 'announcements' && views['announcements-view']) {
            views['announcements-view'].classList.remove('hidden-step');
            views['announcements-view'].classList.remove('fade-in'); void views['announcements-view'].offsetWidth; views['announcements-view'].classList.add('fade-in');
        }
        else if (type === 'vault' && views['vault-view']) {
            views['vault-view'].classList.remove('hidden-step');
            views['vault-view'].classList.remove('fade-in'); void views['vault-view'].offsetWidth; views['vault-view'].classList.add('fade-in');
        }
        else {
            if(views['academy-chat']) views['academy-chat'].classList.remove('hidden-step');
            
            const chatHeaderIcon = document.getElementById('chat-header-icon');
            const chatHeaderTitle = document.getElementById('chat-header-title');
            const chatHeaderTopic = document.getElementById('chat-header-topic');
            const chatWelcomeBox = document.getElementById('chat-welcome-box');
            const chatPinnedMessage = document.getElementById('chat-pinned-message');
            const chatInputBox = document.getElementById('chat-input');
            const dynamicChatContainer = document.getElementById('dynamic-chat-history');

            if (type === 'main-chat') {
                if(chatHeaderIcon) chatHeaderIcon.innerHTML = `💬`;
                if(chatHeaderTitle) chatHeaderTitle.innerText = "YH-community";
                if(chatHeaderTopic) chatHeaderTopic.innerText = "Welcome to The Academy Universe";
                if(chatWelcomeBox) chatWelcomeBox.style.display = "block";
                if(chatPinnedMessage) chatPinnedMessage.style.display = "flex";
                if(chatInputBox) chatInputBox.placeholder = "Message 💬 YH-community...";
                if(dynamicChatContainer) dynamicChatContainer.innerHTML = '';
                
                currentRoom = "YH-community";
                socket.emit('joinRoom', currentRoom); 
            } 
            else if (type === 'dm' || type === 'group') {
                const name = element.getAttribute('data-name');
                const icon = element.getAttribute('data-icon');
                const color = element.getAttribute('data-color');
                let avatarStyle = icon.includes('url') ? `background-image: ${icon}; background-size: cover; background-color: transparent;` : `background: ${color};`;
                let avatarText = icon.includes('url') ? '' : icon;

                if(chatHeaderIcon) chatHeaderIcon.innerHTML = `<div class="member-avatar" style="${avatarStyle} width: 30px; height: 30px; font-size: 0.9rem;">${avatarText}</div>`;
                if(chatHeaderTitle) chatHeaderTitle.innerText = name;
                if(chatHeaderTopic) chatHeaderTopic.innerText = (type === 'group') ? "Private Brainstorming Group" : "Direct Message";
                if(chatWelcomeBox) chatWelcomeBox.style.display = "none";
                if(chatPinnedMessage) chatPinnedMessage.style.display = "none";
                if(chatInputBox) chatInputBox.placeholder = `Message ${name}...`;
                
                currentRoom = name;
                socket.emit('joinRoom', currentRoom); 
            }
            if(views['academy-chat']) { views['academy-chat'].classList.remove('fade-in'); void views['academy-chat'].offsetWidth; views['academy-chat'].classList.add('fade-in'); }
        }
    }

    document.getElementById('nav-chat')?.addEventListener('click', function() { openRoom('main-chat', this); });
    document.getElementById('nav-announcements')?.addEventListener('click', function() { openRoom('announcements', this); });
    document.getElementById('nav-voice')?.addEventListener('click', function() { openRoom('voice-lobby', this); });
    document.getElementById('nav-video')?.addEventListener('click', function() { openRoom('video', this); });
    document.getElementById('nav-vault')?.addEventListener('click', function() { openRoom('vault', this); });

    // ==========================================
    // ⚡ REAL-TIME CHAT LOGIC (SOCKET.IO)
    // ==========================================
    socket.on('chatHistory', (history) => {
        const container = document.getElementById('dynamic-chat-history');
        const chatScrollArea = document.getElementById('chat-messages');
        if(!container) return;
        container.innerHTML = '';

        if (currentRoom !== "YH-community") {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); margin-top: 2rem; margin-bottom: 2rem; font-size: 0.9rem;">This is the beginning of your private history with <strong>${currentRoom}</strong>.</div>`;
        }

        history.forEach(msg => appendMessageToUI(msg));
        setTimeout(() => { if(chatScrollArea) chatScrollArea.scrollTop = chatScrollArea.scrollHeight; }, 100);
    });

    socket.on('receiveMessage', (msg) => {
        if (msg.room === currentRoom) {
            appendMessageToUI(msg);
            const chatScrollArea = document.getElementById('chat-messages');
            setTimeout(() => { if(chatScrollArea) chatScrollArea.scrollTop = chatScrollArea.scrollHeight; }, 100);
        } else {
            if (msg.author !== myName && msg.room.includes(myName)) {
                sendSystemNotification("New Private Message", `${msg.author} sent you a message.`, msg.initial, "var(--neon-blue)", "dm");
            }
        }
    });

    socket.on('messageUpvoted', (msgId) => {
        const upvoteBtn = document.querySelector(`.chat-bubble[data-dbid="${msgId}"] .upvote-count`);
        if (upvoteBtn) upvoteBtn.innerText = parseInt(upvoteBtn.innerText) + 1;
    });

    socket.on('messageDeleted', (msgId) => {
        const bubble = document.querySelector(`.chat-bubble[data-dbid="${msgId}"]`);
        if(bubble) bubble.remove();
    });

    function appendMessageToUI(msg) {
        const container = document.getElementById('dynamic-chat-history');
        if(!container) return;

        const isMe = msg.author === myName;
        const bubbleClass = isMe ? "chat-bubble mine" : "chat-bubble";
        let avatarStyle = `background: var(--neon-blue);`;
        let avatarContent = msg.initial;
        let bubbleStyle = "", authorColor = "", roleBadge = "";

        if (msg.author === "Agent") {
            avatarStyle = `background: #8b5cf6;`; avatarContent = "🤖";
            bubbleStyle = `style="background: rgba(139, 92, 246, 0.15); border-left: 3px solid #8b5cf6;"`;
            authorColor = `style="color: #c4b5fd;"`; roleBadge = `<span class="role-badge bot" style="margin-left:5px;">AI</span>`;
        } else if(msg.avatar) {
            avatarStyle = `background-image: url(${msg.avatar}); background-size: cover; background-position: center;`; avatarContent = '';
        }

        const msgHTML = `
            <div class="${bubbleClass} fade-in" data-dbid="${msg.id}" ${bubbleStyle}>
                ${isMe ? `<button class="delete-msg-btn" title="Delete Message">🗑️</button>` : ''}
                <div class="bubble-header">
                    <div class="bubble-avatar interactive-avatar" data-user="${msg.author}" data-role="Hustler" style="${avatarStyle} cursor:pointer;">${avatarContent}</div>
                    <span class="bubble-author interactive-avatar" data-user="${msg.author}" data-role="Hustler" style="cursor:pointer;"><span ${authorColor}>${msg.author}</span> ${roleBadge}</span>
                    <span class="bubble-time">${msg.time}</span>
                </div>
                <div class="bubble-body">${msg.text}</div>
                ${currentRoom === "YH-community" ? `<div class="chat-actions"><button class="upvote-btn" data-id="${msg.id}" title="Agree with this">🔥 <span class="upvote-count">${msg.upvotes || 0}</span></button></div>` : ''}
            </div>
        `;
        container.insertAdjacentHTML('beforeend', msgHTML);
    }

    function sendMessage(customText = null) {
        const chatInputArea = document.getElementById('chat-input');
        if(!chatInputArea && customText === null) return;

        let rawText = customText !== null ? customText : chatInputArea.value;
        let text = rawText.trim();
        if (!text && !rawText.includes("chat-attachment")) return;

        let initial = myName.charAt(0).toUpperCase();
        let savedAvatar = localStorage.getItem('yh_user_avatar') || "";
        const timeString = 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        socket.emit('sendMessage', {
            room: currentRoom,
            author: myName,
            initial: initial,
            avatar: savedAvatar,
            text: rawText,
            time: timeString
        });

        if(chatInputArea) chatInputArea.value = ''; 

        if (currentRoom.includes("Agent")) {
            setTimeout(() => {
                let aiReply = ""; const userMsg = rawText.toLowerCase();
                if(userMsg.includes("hi") || userMsg.includes("hey")) aiReply = "Hello Hustler. How can I assist your execution today?"; 
                else if(userMsg.includes("chat-attachment")) aiReply = "I have received your file. It has been securely logged in my temporary memory buffer."; 
                else {
                    const aiResponses = ["That is a solid strategy. Stay disciplined.", "I have logged your query.", "Hustle recognized. Keep executing."];
                    aiReply = aiResponses[Math.floor(Math.random() * aiResponses.length)];
                }
                socket.emit('sendMessage', {
                    room: currentRoom,
                    author: "Agent",
                    initial: "🤖",
                    avatar: "",
                    text: aiReply,
                    time: 'Today at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }, 1500); 
        }
    }

    const chatInputArea = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn'); 
    if (chatInputArea) {
        chatInputArea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (chatInputArea.value.trim() !== "") sendMessage(); }
        });
    }
    if (chatSendBtn) {
        chatSendBtn.addEventListener('click', function(e) {
            e.preventDefault(); if (chatInputArea.value.trim() !== "") sendMessage();
        });
    }

    // --- LEAVE / END CALL LOGIC ---
    const btnLeaveStage = document.getElementById('btn-leave-stage');
    const endCallModal = document.getElementById('end-call-modal');
    const btnConfirmEndCall = document.getElementById('btn-confirm-end-call');
    const btnCancelEndCall = document.getElementById('btn-cancel-end-call');

    if(btnLeaveStage) {
        btnLeaveStage.addEventListener('click', () => {
            const hostName = document.getElementById('host-name')?.innerText;
            if (myName === hostName && endCallModal) {
                endCallModal.classList.remove('hidden-step'); 
            } else {
                document.getElementById('nav-voice')?.click(); 
                showToast("You left the stage.", "success");
            }
        });
    }

    if (btnConfirmEndCall && btnCancelEndCall) {
        btnCancelEndCall.addEventListener('click', () => endCallModal.classList.add('hidden-step'));
        btnConfirmEndCall.addEventListener('click', () => {
            endCallModal.classList.add('hidden-step');
            showToast("Session Ended. All users disconnected.", "error");
            document.getElementById('nav-voice')?.click();
        });
    }

    // --- EMOJI, GIF, GIFT LOGIC ---
    const btnGift = document.querySelector('span[title="Send Gift"]');
    const btnGif = document.querySelector('span[title="Open GIF picker"]');
    const btnEmoji = document.querySelector('span[title="Select emoji"]');

    if(btnGift) { btnGift.addEventListener('click', () => { document.getElementById('gift-modal').classList.remove('hidden-step'); }); }

    const closeGiftModal = document.getElementById('close-gift-modal');
    const giftModal = document.getElementById('gift-modal');
    if(closeGiftModal && giftModal) {
        closeGiftModal.addEventListener('click', () => giftModal.classList.add('hidden-step'));
        giftModal.addEventListener('click', (e) => { if(e.target === giftModal) giftModal.classList.add('hidden-step'); });
    }

    const giftItems = document.querySelectorAll('#gift-modal .modal-body > div > div'); 
    giftItems.forEach(giftBox => {
        giftBox.addEventListener('click', () => {
            showToast("Connecting to Payment Gateway...", "success");
            setTimeout(() => {
                showToast("Gift sent successfully! +XP added to target.", "success");
                giftModal.classList.add('hidden-step');
            }, 1500);
        });
    });

    if(btnGif) { btnGif.addEventListener('click', () => { showToast("GIF API (Tenor/Giphy) requires Backend connection.", "error"); }); }

    if (btnEmoji) {
        btnEmoji.addEventListener('click', () => {
            if (typeof picmoPopup !== 'undefined') {
                if(!window.emojiPicker) {
                    window.emojiPicker = picmoPopup.createPopup({ animate: true, theme: 'dark' }, { triggerElement: btnEmoji, referenceElement: btnEmoji, position: 'top-end' });
                    window.emojiPicker.addEventListener('emoji:select', (selection) => {
                        if(chatInputArea) { chatInputArea.value += selection.emoji; chatInputArea.focus(); }
                    });
                }
                window.emojiPicker.toggle();
            } else {
                showToast("Emoji Library is loading... please wait.", "error");
            }
        });
    }

    // --- STAGE CONTROLS, WEBRTC & INVITE ---
    let localStream = null;
    const btnToggleMic = document.getElementById('btn-toggle-mic');
    const btnToggleCam = document.getElementById('btn-toggle-cam');
    const btnToggleScreen = document.getElementById('btn-toggle-screen');

    async function toggleCamera() {
        try {
            const mySpeakerCard = document.querySelector('.speaker-card.active-speaker'); 
            const hostAvatarEl = document.getElementById('host-avatar');
            if (!localStream) {
                localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                if(btnToggleCam) btnToggleCam.classList.remove('toggled-off');
                if(mySpeakerCard) mySpeakerCard.classList.remove('is-offcam');
                showToast("Camera & Mic Active", "success");
            } else {
                localStream.getVideoTracks().forEach(track => {
                    track.enabled = !track.enabled;
                    if (!track.enabled) {
                        if(btnToggleCam) btnToggleCam.classList.add('toggled-off');
                        if(mySpeakerCard) mySpeakerCard.classList.add('is-offcam');
                        if(hostAvatarEl) { hostAvatarEl.innerText = "🚫"; hostAvatarEl.style.background = "#1a1f2e"; }
                        showToast("Camera disabled", "success");
                    } else {
                        if(btnToggleCam) btnToggleCam.classList.remove('toggled-off');
                        if(mySpeakerCard) mySpeakerCard.classList.remove('is-offcam');
                        if(hostAvatarEl) { hostAvatarEl.innerText = localStorage.getItem('yh_user_name')?.charAt(0).toUpperCase() || "Y"; hostAvatarEl.style.background = "var(--neon-blue)"; }
                        showToast("Camera active", "success");
                    }
                });
            }
        } catch (err) { showToast("Camera/Mic permission denied by browser.", "error"); }
    }

    if(btnToggleCam) btnToggleCam.addEventListener('click', toggleCamera);

    if(btnToggleMic) {
        btnToggleMic.addEventListener('click', () => {
            const mySpeakerCard = document.querySelector('.speaker-card.active-speaker'); 
            const hostMicIcon = document.getElementById('host-mic');
            btnToggleMic.classList.toggle('toggled-off');
            const isMuted = btnToggleMic.classList.contains('toggled-off');
            
            if(mySpeakerCard) {
                if(isMuted) mySpeakerCard.classList.add('is-muted');
                else mySpeakerCard.classList.remove('is-muted');
            }
            if(hostMicIcon) {
                hostMicIcon.innerText = isMuted ? "🔇" : "🎤";
                hostMicIcon.style.color = isMuted ? "#ef4444" : "";
            }

            if(localStream) { localStream.getAudioTracks().forEach(track => { track.enabled = !isMuted; }); }
            showToast(isMuted ? "Microphone muted." : "Microphone active.", isMuted ? "error" : "success");
        });
    }

    if(btnToggleScreen) {
        btnToggleScreen.addEventListener('click', async () => {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                btnToggleScreen.classList.add('toggled-on');
                showToast("Screen sharing started!", "success");
                screenStream.getVideoTracks()[0].onended = () => {
                    btnToggleScreen.classList.remove('toggled-on');
                    showToast("Screen share stopped.", "error");
                };
            } catch (err) { showToast("Screen sharing cancelled.", "error"); }
        });
    }

    const stageChatInput = document.getElementById('stage-chat-input');
    const stageChatHistory = document.getElementById('stage-chat-history');
    const stageChatSendBtn = document.getElementById('stage-chat-send-btn');

    function sendStageChat() {
        if(stageChatInput.value.trim() !== '') {
            const msg = stageChatInput.value.trim();
            const myName = localStorage.getItem('yh_user_name') || "Hustler";
            const msgHTML = `<div class="stage-chat-msg fade-in"><strong>${myName}:</strong> ${msg}</div>`;
            stageChatHistory.insertAdjacentHTML('beforeend', msgHTML);
            stageChatInput.value = '';
            stageChatHistory.scrollTop = stageChatHistory.scrollHeight;
        }
    }
    if(stageChatInput && stageChatHistory) { stageChatInput.addEventListener('keydown', (e) => { if(e.key === 'Enter') sendStageChat(); }); }
    if(stageChatSendBtn) { stageChatSendBtn.addEventListener('click', sendStageChat); }

    const btnInviteStage = document.getElementById('btn-invite-to-stage');
    if (btnInviteStage) {
        btnInviteStage.addEventListener('click', () => {
            const stageTitle = document.getElementById('stage-title')?.innerText || "Live Mastermind";
            const simpleLinkHTML = `Hey! I'm LIVE NOW hosting <strong>${stageTitle}</strong>. <a href="#" onclick="document.getElementById('nav-voice').click(); return false;" style="color: var(--neon-blue); font-weight: bold; text-decoration: underline;">Click here to join my room!</a>`;
            
            const shareModal = document.getElementById('share-select-modal');
            const destList = document.getElementById('share-destinations-list');
            if(shareModal && destList) {
                window.pendingShareHTML = simpleLinkHTML;
                destList.innerHTML = `<button class="btn-secondary share-dest-btn" data-target="main-chat" style="padding: 10px; text-align: left;">💬 YH-community (Public)</button>`;
                const rooms = JSON.parse(localStorage.getItem('yh_custom_rooms')) || [];
                rooms.forEach(room => { destList.insertAdjacentHTML('beforeend', `<button class="btn-secondary share-dest-btn" data-target="${room.name}" style="padding: 10px; text-align: left;">${room.icon} ${room.name}</button>`); });
                shareModal.classList.remove('hidden-step');
            }
        });
    }

    // --- THE VAULT & UPLOADS ---
    function saveVaultItemObj(itemObj) {
        const vaultItems = JSON.parse(localStorage.getItem('yh_vault_items')) || [];
        vaultItems.push(itemObj);
        localStorage.setItem('yh_vault_items', JSON.stringify(vaultItems));
        loadVault();
    }

    function saveFileToVault(file, origin) {
        const isImage = file.type.startsWith('image/');
        const fileSize = (file.size / 1024 / 1024).toFixed(2) + " MB";
        if (isImage) {
            const reader = new FileReader();
            reader.onload = (event) => { saveVaultItemObj({ type: 'file', name: file.name, size: fileSize, origin: origin, dataUrl: event.target.result, parentFolder: currentVaultFolder }); };
            reader.readAsDataURL(file);
        } else {
            saveVaultItemObj({ type: 'file', name: file.name, size: fileSize, origin: origin, dataUrl: null, parentFolder: currentVaultFolder });
        }
    }

    function loadVault() {
        const grid = document.getElementById('vault-dynamic-grid');
        if(!grid) return;
        grid.innerHTML = '';
        const vaultItems = JSON.parse(localStorage.getItem('yh_vault_items')) || [];
        const visibleItems = vaultItems.filter(item => (item.parentFolder || null) === currentVaultFolder);
        
        if (currentVaultFolder) {
            grid.innerHTML = `<div class="vault-folder-header" id="btn-vault-back"><span>⬅ Back to All Files</span><span style="color: #fff;">📂 ${currentVaultFolder}</span></div>`;
            document.getElementById('btn-vault-back').addEventListener('click', () => { currentVaultFolder = null; loadVault(); });
        }
        if (visibleItems.length === 0) { grid.insertAdjacentHTML('beforeend', `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">This location is empty. Upload a file or create a folder.</div>`); return; }
        
        visibleItems.sort((a, b) => (a.type === 'folder' ? -1 : 1) - (b.type === 'folder' ? -1 : 1));
        visibleItems.forEach((item) => {
            const realIndex = vaultItems.findIndex(v => v === item);
            const isFolder = item.type === 'folder';
            const isImage = item.type === 'file' && item.dataUrl && item.dataUrl.startsWith('data:image/');
            let visualContent = isFolder ? `<div class="vault-icon">📁</div>` : isImage ? `<div style="width: 100%; height: 90px; border-radius: 8px; background-image: url('${item.dataUrl}'); background-size: cover; background-position: center; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.1);"></div>` : `<div class="vault-icon">📄</div>`;
            const actionText = isFolder ? 'Open Folder' : 'Share to Chat';
            grid.insertAdjacentHTML('beforeend', `<div class="vault-card fade-in ${isFolder ? 'vault-folder' : ''}" data-real-index="${realIndex}" data-name="${item.name}" data-type="${item.type}">${visualContent}<div class="vault-filename" title="${item.name}">${item.name}</div><div class="vault-meta">${isFolder ? 'Folder' : (item.size || 'Unknown')}</div><div class="vault-origin">From: ${item.origin || 'Direct Upload'}</div><button class="btn-vault-action action-vault-btn">${actionText}</button></div>`);
        });

        document.querySelectorAll('.action-vault-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const card = e.target.closest('.vault-card'); const itemName = card.getAttribute('data-name'); const itemType = card.getAttribute('data-type');
                if(itemType === 'folder') { currentVaultFolder = itemName; showToast(`Opening folder: ${itemName}`, "success"); loadVault(); } 
                else {
                    const fullItem = vaultItems.find(i => i.name === itemName && i.type === 'file');
                    const isImage = fullItem && fullItem.dataUrl && fullItem.dataUrl.startsWith('data:image/');
                    let visualChatContent = isImage ? `<img src="${fullItem.dataUrl}" style="width: 100%; border-radius: 6px; margin-bottom: 8px;">` : `<div style="font-size: 2rem;">📄</div>`;
                    
                    const shareModal = document.getElementById('share-select-modal');
                    const destList = document.getElementById('share-destinations-list');
                    if(shareModal && destList) {
                        window.pendingShareHTML = `<div class="chat-attachment" style="background: rgba(0,0,0,0.3); padding: 12px; border-radius: 8px; margin-top: 5px;">${visualChatContent}<div><strong>${itemName}</strong><br><a href="${fullItem.dataUrl}" download="${itemName}" style="color: var(--neon-blue);">⬇ Download</a></div></div>`;
                        
                        destList.innerHTML = `<button class="btn-secondary share-dest-btn" data-target="main-chat" style="padding: 10px; text-align: left;">💬 YH-community (Public)</button>`;
                        const rooms = JSON.parse(localStorage.getItem('yh_custom_rooms')) || [];
                        rooms.forEach(room => { destList.insertAdjacentHTML('beforeend', `<button class="btn-secondary share-dest-btn" data-target="${room.name}" style="padding: 10px; text-align: left;">${room.icon} ${room.name}</button>`); });
                        
                        shareModal.classList.remove('hidden-step');
                    }
                }
            });
        });

        const contextMenu = document.getElementById('vault-context-menu');
        document.querySelectorAll('.vault-card').forEach(card => {
            const showContext = (pageX, pageY) => { selectedVaultIndex = card.getAttribute('data-real-index'); contextMenu.style.left = `${pageX}px`; contextMenu.style.top = `${pageY}px`; contextMenu.classList.remove('hidden-step'); };
            card.addEventListener('contextmenu', (e) => { e.preventDefault(); showContext(e.pageX, e.pageY); });
        });
    }

    const shareSelectModal = document.getElementById('share-select-modal');
    const closeShareSelect = document.getElementById('close-share-select');
    
    if (closeShareSelect && shareSelectModal) {
        closeShareSelect.addEventListener('click', () => shareSelectModal.classList.add('hidden-step'));
        shareSelectModal.addEventListener('click', (e) => { if(e.target === shareSelectModal) shareSelectModal.classList.add('hidden-step'); });
    }

    // --- GLOBAL CLICK HANDLER PARA SA UPVOTE AT DELETE ---
    document.body.addEventListener('click', (e) => { 
        const ctxMenu = document.getElementById('vault-context-menu'); 
        if (ctxMenu && !ctxMenu.classList.contains('hidden-step')) ctxMenu.classList.add('hidden-step'); 
        
        if(e.target.classList.contains('share-dest-btn')) {
            const targetRoomName = e.target.getAttribute('data-target');
            if (targetRoomName === 'main-chat') { document.getElementById('nav-chat')?.click(); } 
            else { document.querySelectorAll('.dm-room').forEach(node => { if (node.getAttribute('data-name') === targetRoomName) node.click(); }); }

            document.getElementById('share-select-modal')?.classList.add('hidden-step');
            const chatInput = document.getElementById('chat-input');
            
            if (chatInput && window.pendingShareHTML) {
                let isLinkOnly = window.pendingShareHTML.includes('Click here to join');
                chatInput.value = isLinkOnly ? window.pendingShareHTML : `Shared a file from Vault:<br>${window.pendingShareHTML}`;
                
                setTimeout(() => { sendMessage(); showToast(`Shared to ${targetRoomName}!`, "success"); window.pendingShareHTML = null; }, 100);
            }
        }

        // UPVOTE CHAT CLICK
        const upvoteBtn = e.target.closest('.upvote-btn');
        if (upvoteBtn) {
            const authorName = upvoteBtn.closest('.chat-bubble').querySelector('.bubble-avatar').getAttribute('data-user');
            if (authorName === myName) { showToast("You cannot agree with your own message!", "error"); return; }
            if (upvoteBtn.classList.contains('liked')) { showToast("You already agreed to this message.", "error"); return; }
            
            const msgId = upvoteBtn.getAttribute('data-id');
            socket.emit('upvoteMessage', msgId); 
            upvoteBtn.classList.add('liked');

            let allStats = JSON.parse(localStorage.getItem('yh_user_stats')) || {};
            if (allStats[authorName]) { allStats[authorName].rep += 5; localStorage.setItem('yh_user_stats', JSON.stringify(allStats)); }
            showToast(`You agreed with ${authorName}. They gained +5 REP!`, "success"); renderLeaderboard(); 
        }

        // DELETE CHAT CLICK
        const deleteMsgBtn = e.target.closest('.delete-msg-btn');
        if (deleteMsgBtn) {
            const bubble = deleteMsgBtn.closest('.chat-bubble');
            const msgId = bubble.getAttribute('data-dbid');
            if(msgId) socket.emit('deleteMessage', msgId); 
            else bubble.remove();
        }
        
        // PROFILE CLICK
        const interactiveEl = e.target.closest('.interactive-avatar');
        if(interactiveEl && !e.target.closest('.upvote-btn') && !e.target.closest('.delete-msg-btn')) {
            const userName = interactiveEl.getAttribute('data-user'); const userRole = interactiveEl.getAttribute('data-role');
            const avatarDiv = interactiveEl.querySelector('.member-avatar') || interactiveEl.querySelector('.bubble-avatar') || interactiveEl;
            let avatarContent = "Y"; let avatarBg = "var(--neon-blue)";
            if(avatarDiv) { avatarContent = (avatarDiv.style.backgroundImage !== 'none' && avatarDiv.style.backgroundImage !== '') ? avatarDiv.style.backgroundImage : avatarDiv.innerText.trim().charAt(0).toUpperCase(); avatarBg = avatarDiv.style.backgroundColor || avatarBg; }
            openMiniProfile(userName, userRole, avatarContent, avatarBg);
        }
    });

    const btnChatUploadArea = document.getElementById('btn-chat-upload');
    const chatFileInputArea = document.getElementById('chat-file-input');
    const attachModalArea = document.getElementById('attachment-preview-modal');
    const attachPreviewArea = document.getElementById('attach-modal-preview');
    const attachCaptionArea = document.getElementById('attach-caption-input');
    const attachTitleArea = document.getElementById('attach-modal-title');
    const btnSendAttachArea = document.getElementById('btn-send-attach'); 
    const btnCancelAttachArea = document.getElementById('btn-cancel-attach');
    let pendingAttachmentObj = null; 

    if(btnChatUploadArea && chatFileInputArea && attachModalArea) {
        btnChatUploadArea.onclick = () => chatFileInputArea.click();
        chatFileInputArea.onchange = (e) => {
            const file = e.target.files[0];
            if(!file) return;
            const isImage = file.type.startsWith('image/');
            const fileSize = (file.size / 1024 / 1024).toFixed(2) + " MB";
            
            attachTitleArea.innerText = isImage ? "Send an image" : "Send a file";
            attachCaptionArea.value = '';
            attachPreviewArea.innerHTML = '<span style="color: var(--text-muted);">Loading preview...</span>';
            attachModalArea.classList.remove('hidden-step');
            
            const reader = new FileReader();
            reader.onload = (event) => {
                pendingAttachmentObj = { file: file, dataUrl: event.target.result, isImage: isImage, fileSize: fileSize, name: file.name };
                attachPreviewArea.innerHTML = isImage ? `<img src="${event.target.result}" style="max-width: 100%; max-height: 200px; border-radius: 8px;">` : `<div style="font-size: 3rem;">📄</div><span style="color: #fff; font-weight: bold;">${file.name}</span>`;
            };
            reader.readAsDataURL(file);
            chatFileInputArea.value = ''; 
        };

        const closeAttachFunc = () => { attachModalArea.classList.add('hidden-step'); pendingAttachmentObj = null; };
        if(btnCancelAttachArea) btnCancelAttachArea.onclick = closeAttachFunc;
        document.getElementById('close-attach-modal').onclick = closeAttachFunc;

        if(btnSendAttachArea) {
            btnSendAttachArea.onclick = () => {
                if(!pendingAttachmentObj) return;
                const activeChat = document.getElementById('chat-header-title').innerText;
                saveFileToVault(pendingAttachmentObj.file, activeChat);
                
                let visualContent = pendingAttachmentObj.isImage ? `<img src="${pendingAttachmentObj.dataUrl}" style="width: 100%; border-radius: 6px; margin-bottom: 8px; border: 1px solid rgba(255,255,255,0.1);">` : `<div class="chat-attachment-icon" style="font-size: 2rem; margin-right: 15px;">📄</div>`;
                const attachmentHTML = `<div class="chat-attachment" style="display: flex; flex-direction: ${pendingAttachmentObj.isImage ? 'column' : 'row'}; align-items: ${pendingAttachmentObj.isImage ? 'stretch' : 'center'}; background: rgba(0,0,0,0.25); padding: 12px; border-radius: 8px; margin-top: 5px; border: 1px solid rgba(255,255,255,0.05); width: 100%; min-width: 250px;">${visualContent}<div style="display: flex; justify-content: space-between; align-items: center; width: 100%;"><div style="display: flex; flex-direction: column; text-align: left; overflow: hidden; padding-right: 10px;"><span style="font-size: 0.85rem; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${pendingAttachmentObj.name}</span><span style="font-size: 0.7rem; color: var(--text-muted);">${pendingAttachmentObj.fileSize}</span></div><a href="${pendingAttachmentObj.dataUrl}" download="${pendingAttachmentObj.name}" style="background: var(--neon-blue); color: #fff; padding: 6px 12px; border-radius: 4px; font-size: 0.75rem; text-decoration: none; font-weight: bold; white-space: nowrap; box-shadow: 0 0 10px rgba(14, 165, 233, 0.4);">⬇ Download</a></div></div>`;
                
                const captionTextArea = attachCaptionArea.value.trim();
                sendMessage(captionTextArea ? `${captionTextArea}<br>${attachmentHTML}` : attachmentHTML);
                showToast("File uploaded to chat!", "success");
                closeAttachFunc(); 
            };
        }
    }

    // --- LOUNGES (VOICE & VIDEO) ---
    function loadVoiceLounges() {
        const grid = document.getElementById('lounge-grid');
        if(!grid) return;
        grid.innerHTML = '';
        const lounges = JSON.parse(localStorage.getItem('yh_voice_lounges')) || [];
        if (lounges.length === 0) { grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">No active Voice Lounges yet. Be the first to start one!</div>`; return; }

        lounges.forEach((lounge) => {
            const card = document.createElement('div'); card.className = "lounge-card fade-in room-entry";
            let avatarStyle = lounge.hostAvatar ? `background-image: url(${lounge.hostAvatar}); background-size: cover; background-position: center;` : `background: var(--neon-blue);`;
            card.innerHTML = `<div class="lounge-card-header"><span class="live-badge"><div class="pulse-dot"></div> LIVE</span><span class="listener-count">👤 ${lounge.listenerCount} Listening</span></div><h4 class="lounge-topic">${lounge.topic}</h4><p class="lounge-host">Hosted by <strong>${lounge.host}</strong></p><div class="lounge-avatars"><div class="member-avatar interactive-avatar" style="${avatarStyle} border-radius: 50%; z-index: 3;">${lounge.hostAvatar ? '' : lounge.hostInitial}</div><div class="avatar-more" style="border-radius: 50%;">+${Math.max(0, lounge.listenerCount - 1)}</div></div>`;
            card.addEventListener('click', (e) => {
                if(e.target.closest('.interactive-avatar')) return; 
                const voiceLobbyView = document.getElementById('voice-lobby-view'); const centerStageView = document.getElementById('center-stage-view');
                if(voiceLobbyView) voiceLobbyView.classList.add('hidden-step');
                if(centerStageView) {
                    centerStageView.classList.remove('hidden-step');
                    document.getElementById('stage-title').innerText = lounge.topic; document.getElementById('stage-icon').innerText = "🎙️";
                    document.getElementById('host-name').innerText = lounge.host;
                    const hostAvatarEl = document.getElementById('host-avatar');
                    if(lounge.hostAvatar) { hostAvatarEl.innerText = ''; hostAvatarEl.style.backgroundImage = `url(${lounge.hostAvatar})`; } else { hostAvatarEl.innerText = lounge.hostInitial; hostAvatarEl.style.backgroundImage = 'none'; }
                    centerStageView.classList.remove('fade-in'); void centerStageView.offsetWidth; centerStageView.classList.add('fade-in');
                }
            });
            grid.appendChild(card);
        });
    }

    function loadVideoLounges() {
        const grid = document.getElementById('video-grid');
        if(!grid) return;
        grid.innerHTML = '';
        const lounges = JSON.parse(localStorage.getItem('yh_video_lounges')) || [];
        if (lounges.length === 0) { grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">No active Video Rooms yet. Start a video call!</div>`; return; }

        lounges.forEach((lounge) => {
            const card = document.createElement('div'); card.className = "lounge-card fade-in room-entry";
            let avatarStyle = lounge.hostAvatar ? `background-image: url(${lounge.hostAvatar}); background-size: cover; background-position: center;` : `background: var(--neon-blue);`;
            card.innerHTML = `<div class="lounge-card-header"><span class="live-badge"><div class="pulse-dot"></div> LIVE</span><span class="listener-count">👀 ${lounge.listenerCount} Watching</span></div><h4 class="lounge-topic">${lounge.topic}</h4><p class="lounge-host">Hosted by <strong>${lounge.host}</strong></p><div class="lounge-avatars"><div class="member-avatar interactive-avatar" style="${avatarStyle} border-radius: 50%; z-index: 3;">${lounge.hostAvatar ? '' : lounge.hostInitial}</div><div class="avatar-more" style="border-radius: 50%;">+${Math.max(0, lounge.listenerCount - 1)}</div></div>`;
            card.addEventListener('click', (e) => {
                if(e.target.closest('.interactive-avatar')) return; 
                const videoLobbyView = document.getElementById('video-lobby-view'); const centerStageView = document.getElementById('center-stage-view');
                if(videoLobbyView) videoLobbyView.classList.add('hidden-step');
                if(centerStageView) {
                    centerStageView.classList.remove('hidden-step');
                    document.getElementById('stage-title').innerText = lounge.topic; document.getElementById('stage-icon').innerText = "📹";
                    document.getElementById('host-name').innerText = lounge.host;
                    const hostAvatarEl = document.getElementById('host-avatar');
                    if(lounge.hostAvatar) { hostAvatarEl.innerText = ''; hostAvatarEl.style.backgroundImage = `url(${lounge.hostAvatar})`; } else { hostAvatarEl.innerText = lounge.hostInitial; hostAvatarEl.style.backgroundImage = 'none'; }
                    centerStageView.classList.remove('fade-in'); void centerStageView.offsetWidth; centerStageView.classList.add('fade-in');
                }
            });
            grid.appendChild(card);
        });
    }

    window.loungeCreationType = 'voice';
    document.getElementById('btn-start-lounge')?.addEventListener('click', () => {
        window.loungeCreationType = 'voice';
        const h3 = document.querySelector('#lounge-modal h3'); if(h3) h3.innerText = '🎙️ Start Voice Lounge';
    });
    document.getElementById('btn-start-video')?.addEventListener('click', () => {
        window.loungeCreationType = 'video';
        const h3 = document.querySelector('#lounge-modal h3'); if(h3) h3.innerText = '📹 Start Video Lounge';
        document.getElementById('lounge-modal').classList.remove('hidden-step');
    });

    const btnCreateLounge = document.getElementById('btn-create-lounge');
    const loungeTopicInput = document.getElementById('lounge-topic-input');
    if(btnCreateLounge && loungeTopicInput) {
        loungeTopicInput.addEventListener('input', () => {
            if(loungeTopicInput.value.trim().length > 0) { btnCreateLounge.innerText = "Start Room Now"; btnCreateLounge.disabled = false; btnCreateLounge.style.opacity = '1'; } 
            else { btnCreateLounge.innerText = "Enter Topic to Start"; btnCreateLounge.disabled = true; btnCreateLounge.style.opacity = '0.5'; }
        });
        btnCreateLounge.addEventListener('click', () => {
            const topic = loungeTopicInput.value.trim(); if(!topic) return;
            
            if (window.loungeCreationType === 'video') {
                const videos = JSON.parse(localStorage.getItem('yh_video_lounges')) || [];
                videos.unshift({ topic, host: myName, hostInitial: myName.charAt(0).toUpperCase(), hostAvatar: localStorage.getItem('yh_user_avatar') || "", listenerCount: 1 });
                localStorage.setItem('yh_video_lounges', JSON.stringify(videos));
                loadVideoLounges();
                document.getElementById('video-grid')?.firstElementChild?.click();
            } else {
                const lounges = JSON.parse(localStorage.getItem('yh_voice_lounges')) || [];
                lounges.unshift({ topic, host: myName, hostInitial: myName.charAt(0).toUpperCase(), hostAvatar: localStorage.getItem('yh_user_avatar') || "", listenerCount: 1 });
                localStorage.setItem('yh_voice_lounges', JSON.stringify(lounges));
                loadVoiceLounges(); 
                document.getElementById('lounge-grid')?.firstElementChild?.click();
            }
            
            showToast(`${window.loungeCreationType === 'video' ? 'Video' : 'Voice'} Lounge '${topic}' is now LIVE!`, "success");
            document.getElementById('lounge-modal').classList.add('hidden-step');
            loungeTopicInput.value = ""; btnCreateLounge.innerText = "Enter Topic to Start"; btnCreateLounge.disabled = true; btnCreateLounge.style.opacity = '0.5';
        });
    }

    // --- CUSTOM ROOMS ---
    function loadCustomRooms() {
        const dmList = document.getElementById('custom-dm-list');
        if(!dmList) return;
        dmList.innerHTML = '';
        const rooms = JSON.parse(localStorage.getItem('yh_custom_rooms')) || [];
        rooms.forEach((room, index) => {
            const newLi = document.createElement('li'); newLi.className = "channel-link dm-room"; newLi.setAttribute('data-type', room.type); newLi.setAttribute('data-name', room.name); newLi.setAttribute('data-icon', room.icon); newLi.setAttribute('data-color', room.color);
            let avatarStyle = room.icon.includes('url') ? `background-image: ${room.icon}; background-size: cover; background-color: transparent;` : `background: ${room.color};`;
            newLi.innerHTML = `<div class="sidebar-icon"><div class="member-avatar" style="${avatarStyle} width: 24px; height: 24px; font-size: 0.7rem; border-radius: 6px;">${room.icon.includes('url') ? '' : room.icon}</div></div><div class="sidebar-text flex-1">${room.name}</div><button class="delete-room-btn" data-index="${index}" title="Delete Chat">✖</button>`;
            newLi.addEventListener('click', (e) => { if(e.target.classList.contains('delete-room-btn')) return; openRoom(room.type, newLi); });
            newLi.querySelector('.delete-room-btn').addEventListener('click', (e) => {
                e.stopPropagation(); let currentRooms = JSON.parse(localStorage.getItem('yh_custom_rooms')) || []; currentRooms.splice(index, 1);
                localStorage.setItem('yh_custom_rooms', JSON.stringify(currentRooms)); showToast("Chat deleted.", "success"); loadCustomRooms(); document.getElementById('nav-chat').click(); 
            });
            dmList.appendChild(newLi);
        });
    }

    function createNewRoom(type, name, icon, color) {
        let rooms = JSON.parse(localStorage.getItem('yh_custom_rooms')) || [];
        const existingRoomIndex = rooms.findIndex(r => r.name === name && r.type === type);
        if (existingRoomIndex !== -1) { const customList = document.getElementById('custom-dm-list'); if(customList && customList.children[existingRoomIndex]) customList.children[existingRoomIndex].click(); return; }
        rooms.push({ type, name, icon, color }); localStorage.setItem('yh_custom_rooms', JSON.stringify(rooms)); loadCustomRooms();
        setTimeout(() => { const customList = document.getElementById('custom-dm-list'); if(customList && customList.lastElementChild) customList.lastElementChild.click(); }, 50);
    }

    // --- PROFILES & LEADERBOARD ---
    function renderLeaderboard() {
        const leaderboardList = document.getElementById('leaderboard-list');
        if(!leaderboardList) return;
        leaderboardList.innerHTML = '';
        let allStats = JSON.parse(localStorage.getItem('yh_user_stats')); if(!allStats) return;
        let rankableUsers = Object.keys(allStats).filter(name => name !== "YH Admin" && name !== "Agent").map(name => ({ name: name, ...allStats[name] }));
        rankableUsers.sort((a, b) => b.rep - a.rep);
        rankableUsers.slice(0, 5).forEach((user, index) => {
            const li = document.createElement('li'); li.className = "interactive-avatar"; li.setAttribute('data-user', user.name); li.setAttribute('data-role', user.role);
            let rankBadge = index === 0 ? `<span class="rank-badge rank-1">🏆 #1</span>` : `<span class="rank-badge">#${index + 1}</span>`;
            let avatarStyle = user.initial.includes('url') ? `background-image: ${user.initial}; background-size: cover; background-color: transparent;` : `background: ${user.color};`;
            li.innerHTML = `<div class="member-avatar" style="${avatarStyle}">${user.initial.includes('url') ? '' : user.initial}</div><div class="member-name" style="flex:1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.name}</div><div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; flex-shrink: 0; width: 110px;">${rankBadge}<span style="font-size: 0.7rem; color: var(--neon-blue); font-weight: bold; width: 45px; text-align: right;">${user.rep} XP</span></div>`;
            leaderboardList.appendChild(li);
        });
    }

    function openMiniProfile(name, role, avatarContent, avatarBg) {
        const modal = document.getElementById('mini-profile-modal'); if(!modal) return;
        currentProfileUser = name; currentProfileIcon = avatarContent; currentProfileBg = avatarBg;
        let allStats = JSON.parse(localStorage.getItem('yh_user_stats')) || {};
        const myAvatar = localStorage.getItem('yh_user_avatar');
        if (!allStats[myName]) allStats[myName] = { rep: 0, followers: 0, role: "Hustler", initial: myAvatar ? `url(${myAvatar})` : myName.charAt(0).toUpperCase(), color: "var(--neon-blue)" };
        if (!allStats[name]) allStats[name] = { rep: 0, followers: 0, role: role, initial: avatarContent.includes('url') ? avatarContent : avatarContent.trim().charAt(0).toUpperCase(), color: avatarBg };
        localStorage.setItem('yh_user_stats', JSON.stringify(allStats));

        document.getElementById('mp-name').innerText = name;
        document.getElementById('mp-role').innerHTML = role === 'HQ' ? `<span class="role-badge founder">HQ</span>` : role === 'AI' ? `<span class="role-badge bot">AI</span>` : role === 'Dev' ? `<span class="role-badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3);">DEV</span>` : `<span class="role-badge" style="background: rgba(255,255,255,0.1); color:#fff; border: 1px solid rgba(255,255,255,0.2);">Hustler</span>`;
        const avatarEl = document.getElementById('mp-avatar');
        if(avatarContent.includes('url')) { avatarEl.innerText = ''; avatarEl.style.backgroundImage = avatarContent; avatarEl.style.backgroundColor = 'transparent'; } else { avatarEl.innerText = avatarContent.trim().charAt(0).toUpperCase(); avatarEl.style.backgroundImage = 'none'; avatarEl.style.backgroundColor = avatarBg || 'var(--neon-blue)'; }
        document.getElementById('mp-followers').innerText = allStats[name].followers; document.getElementById('mp-rep').innerText = allStats[name].rep;
        
        const btnFollow = document.getElementById('btn-mp-follow'); const btnMessage = document.getElementById('btn-mp-message'); const profileStats = document.querySelector('.profile-stats');
        if (name === myName) { btnFollow.style.display = 'none'; btnMessage.style.display = 'none'; profileStats.style.display = 'flex'; document.getElementById('mp-role').innerHTML += `<br><div class="my-profile-tag">This is you</div>`; } 
        else if (name === "Agent") { btnFollow.style.display = 'none'; btnMessage.style.display = 'block'; profileStats.style.display = 'none'; } 
        else {
            btnFollow.style.display = 'block'; btnMessage.style.display = 'block'; profileStats.style.display = 'flex'; 
            let followed = JSON.parse(localStorage.getItem('yh_followed_users')) || [];
            if (followed.includes(name)) { btnFollow.innerText = "Following"; btnFollow.classList.add('btn-following'); } else { btnFollow.innerText = "Follow"; btnFollow.classList.remove('btn-following'); }
        }
        modal.classList.remove('hidden-step');
    }

    const btnFollow = document.getElementById('btn-mp-follow');
    if (btnFollow) {
        btnFollow.addEventListener('click', () => {
            let followed = JSON.parse(localStorage.getItem('yh_followed_users')) || []; let allStats = JSON.parse(localStorage.getItem('yh_user_stats')) || {};
            if (followed.includes(currentProfileUser)) {
                followed = followed.filter(u => u !== currentProfileUser); allStats[currentProfileUser].followers = Math.max(0, allStats[currentProfileUser].followers - 1); allStats[currentProfileUser].rep = Math.max(0, allStats[currentProfileUser].rep - 20);
                btnFollow.innerText = "Follow"; btnFollow.classList.remove('btn-following');
            } else {
                followed.push(currentProfileUser); allStats[currentProfileUser].followers += 1; allStats[currentProfileUser].rep += 20; 
                btnFollow.innerText = "Following"; btnFollow.classList.add('btn-following'); showToast(`You followed ${currentProfileUser}. They gained +20 REP!`, "success");
            }
            localStorage.setItem('yh_followed_users', JSON.stringify(followed)); localStorage.setItem('yh_user_stats', JSON.stringify(allStats));
            document.getElementById('mp-followers').innerText = allStats[currentProfileUser].followers; document.getElementById('mp-rep').innerText = allStats[currentProfileUser].rep; renderLeaderboard();
        });
    }

    const btnMessage = document.getElementById('btn-mp-message');
    if(btnMessage) {
        btnMessage.addEventListener('click', () => {
            let iconData = currentProfileIcon; if(!iconData || (iconData.length > 2 && !iconData.includes('url'))) iconData = currentProfileUser.charAt(0).toUpperCase();
            createNewRoom('dm', currentProfileUser, iconData, currentProfileBg || 'var(--neon-blue)'); showToast(`Private Chat opened with ${currentProfileUser}!`, "success"); document.getElementById('mini-profile-modal').classList.add('hidden-step');
        });
    }

    // --- MISSIONS & BLUEPRINT ---
    function checkDailyReset() {
        const today = new Date().toDateString();
        let dailyStats = JSON.parse(localStorage.getItem('yh_daily_stats')) || { date: today, completed: 0, total: 0 };
        if (dailyStats.date !== today) { dailyStats = { date: today, completed: 0, total: JSON.parse(localStorage.getItem('yh_custom_missions') || '[]').length }; localStorage.setItem('yh_daily_stats', JSON.stringify(dailyStats)); }
        return dailyStats;
    }

    function loadBlueprintProgress() {
        const container = document.getElementById('blueprint-list');
        if(!container) return;
        container.innerHTML = '';
        checkDailyReset(); 
        const customMissions = JSON.parse(localStorage.getItem('yh_custom_missions')) || [];
        if(customMissions.length === 0) container.innerHTML = `<div style="text-align: center; font-size: 0.75rem; color: var(--text-muted); padding: 10px;">No pending tasks. Add one above!</div>`;
        customMissions.forEach((m, idx) => {
            const div = document.createElement('div'); div.className = `step-item fade-in`; div.setAttribute('data-step', m.id); div.title = m.title;
            div.innerHTML = `<div class="sidebar-icon"><div class="step-circle">${idx + 1}</div></div><span class="sidebar-text" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${m.title}</span><button class="delete-task-btn" title="Delete Task">✖</button>`;
            div.addEventListener('click', (e) => { if(e.target.classList.contains('delete-task-btn')) return; pendingTaskToComplete = m.id; document.getElementById('task-confirm-modal').classList.remove('hidden-step'); });
            div.querySelector('.delete-task-btn').addEventListener('click', (e) => { e.stopPropagation(); let missions = JSON.parse(localStorage.getItem('yh_custom_missions')) || []; missions = missions.filter(task => task.id !== m.id); localStorage.setItem('yh_custom_missions', JSON.stringify(missions)); let stats = checkDailyReset(); stats.total = Math.max(0, stats.total - 1); localStorage.setItem('yh_daily_stats', JSON.stringify(stats)); loadBlueprintProgress(); });
            container.appendChild(div);
        });
        let stats = checkDailyReset(); const percentage = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;
        const fill = document.getElementById('progress-bar-fill'); const text = document.getElementById('progress-text');
        if(fill) fill.style.width = percentage + '%'; if(text) text.innerText = percentage + '% Daily Progress';
    }

    const btnConfirmTask = document.getElementById('btn-confirm-task'); const btnCancelTask = document.getElementById('btn-cancel-task');
    if(btnConfirmTask && btnCancelTask) {
        btnCancelTask.addEventListener('click', () => { document.getElementById('task-confirm-modal').classList.add('hidden-step'); pendingTaskToComplete = null; });
        btnConfirmTask.addEventListener('click', () => {
            if(pendingTaskToComplete) {
                let missions = JSON.parse(localStorage.getItem('yh_custom_missions')) || []; missions = missions.filter(m => m.id !== pendingTaskToComplete); localStorage.setItem('yh_custom_missions', JSON.stringify(missions));
                let stats = checkDailyReset(); stats.completed += 1; localStorage.setItem('yh_daily_stats', JSON.stringify(stats)); showToast("Task Completed! Great job.", "success"); loadBlueprintProgress();
            }
            document.getElementById('task-confirm-modal').classList.add('hidden-step');
        });
    }

    const btnSaveMission = document.getElementById('btn-save-mission');
    if(btnSaveMission) {
        btnSaveMission.addEventListener('click', () => {
            const titleInput = document.getElementById('mission-title-input'); const title = titleInput.value.trim(); if(!title) { showToast("Please enter your task.", "error"); return; }
            const customMissions = JSON.parse(localStorage.getItem('yh_custom_missions')) || []; customMissions.push({ id: "task_" + Date.now(), title: title, targetDate: '' }); localStorage.setItem('yh_custom_missions', JSON.stringify(customMissions));
            let stats = checkDailyReset(); stats.total += 1; localStorage.setItem('yh_daily_stats', JSON.stringify(stats));
            loadBlueprintProgress(); document.getElementById('mission-modal').classList.add('hidden-step'); titleInput.value = ''; showToast("Task added! The System will hold you accountable.", "success");
            setTimeout(() => { sendSystemNotification("Accountability Check", `Have you finished '${title}'? Get back to work.`, "🤖", "#8b5cf6", ""); }, 5000); 
        });
    }

    // --- MODALS & EXTRAS ---
    function setupModal(btnId, modalId, closeBtnId) {
        const btn = document.getElementById(btnId); const modal = document.getElementById(modalId); const closeBtn = document.getElementById(closeBtnId);
        if(btn && modal && closeBtn) { btn.addEventListener('click', () => modal.classList.remove('hidden-step')); closeBtn.addEventListener('click', () => modal.classList.add('hidden-step')); modal.addEventListener('click', (e) => { if(e.target === modal) modal.classList.add('hidden-step'); }); }
    }
    setupModal('btn-open-dm-modal', 'dm-modal', 'close-dm-modal'); setupModal('btn-open-group-modal', 'group-modal', 'close-group-modal'); setupModal('btn-support-ticket', 'ticket-modal', 'close-ticket-modal'); setupModal('btn-settings', 'settings-modal', 'close-settings-modal'); setupModal('btn-start-lounge', 'lounge-modal', 'close-lounge-modal'); setupModal('btn-open-mission-modal', 'mission-modal', 'close-mission-modal'); setupModal('btn-open-folder-modal', 'folder-modal', 'close-folder-modal');

    const btnCreateFolder = document.getElementById('btn-create-folder');
    if(btnCreateFolder) {
        btnCreateFolder.addEventListener('click', () => {
            const name = document.getElementById('folder-name-input').value.trim(); if(!name) return;
            const vaultItems = JSON.parse(localStorage.getItem('yh_vault_items')) || []; vaultItems.push({ type: 'folder', name: name, parentFolder: currentVaultFolder }); localStorage.setItem('yh_vault_items', JSON.stringify(vaultItems));
            loadVault(); document.getElementById('folder-modal').classList.add('hidden-step'); document.getElementById('folder-name-input').value = ''; showToast(`Folder '${name}' created!`, "success");
        });
    }

    const btnVaultUpload = document.getElementById('btn-vault-upload-trigger'); const vaultFileInput = document.getElementById('vault-file-input');
    if(btnVaultUpload && vaultFileInput) {
        btnVaultUpload.addEventListener('click', () => vaultFileInput.click());
        vaultFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0]; if(!file) return; saveFileToVault(file, "Direct Upload"); showToast(`${file.name} uploading to The Vault...`, "success");
        });
    }

    document.querySelectorAll('.modal-search').forEach(input => {
        input.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase(); const modalBody = e.target.closest('.modal-body');
            if (modalBody) { modalBody.querySelectorAll('.modal-user-item').forEach(item => { const name = item.querySelector('.member-name').innerText.toLowerCase(); item.style.display = name.includes(searchTerm) ? 'flex' : 'none'; }); }
        });
    });

    const btnStartDm = document.getElementById('btn-start-dm');
    if (btnStartDm) {
        document.querySelectorAll('.dm-radio').forEach(radio => { radio.addEventListener('change', () => { btnStartDm.innerText = "Start Private Chat"; btnStartDm.disabled = false; btnStartDm.style.opacity = '1'; }); });
        btnStartDm.addEventListener('click', () => {
            const checkedRadio = document.querySelector('.dm-radio:checked'); if(!checkedRadio) return;
            const userLabel = checkedRadio.closest('.modal-user-item'); const chatName = userLabel.querySelector('.dm-name-preview').innerText; const chatIcon = userLabel.querySelector('.dm-avatar-preview').innerText; const chatColor = userLabel.querySelector('.dm-avatar-preview').style.backgroundColor || "var(--neon-blue)";
            showToast("Private Chat opened successfully!", "success"); createNewRoom('dm', chatName, chatIcon, chatColor);
            document.getElementById('dm-modal').classList.add('hidden-step'); checkedRadio.checked = false; btnStartDm.innerText = "Select a user to chat"; btnStartDm.disabled = true; btnStartDm.style.opacity = '0.5';
        });
    }

    const btnCreateGroup = document.getElementById('btn-create-group'); const groupNameInput = document.getElementById('group-name-input');
    if (btnCreateGroup && groupNameInput) {
        groupNameInput.addEventListener('input', () => { if(groupNameInput.value.trim().length > 0) { btnCreateGroup.innerText = "Create Brainstorming Group"; btnCreateGroup.disabled = false; btnCreateGroup.style.opacity = '1'; } else { btnCreateGroup.innerText = "Enter Group Name to Create"; btnCreateGroup.disabled = true; btnCreateGroup.style.opacity = '0.5'; } });
        btnCreateGroup.addEventListener('click', () => {
            const chatName = groupNameInput.value.trim(); if(!chatName) return; showToast(`Brainstorming Group '${chatName}' created!`, "success"); createNewRoom('group', chatName, "👥", "#0ea5e9");
            document.getElementById('group-modal').classList.add('hidden-step'); groupNameInput.value = ""; btnCreateGroup.innerText = "Enter Group Name to Create"; btnCreateGroup.disabled = true; btnCreateGroup.style.opacity = '0.5';
        });
    }

    const btnSendTicket = document.getElementById('btn-send-ticket');
    if(btnSendTicket) {
        btnSendTicket.addEventListener('click', () => {
            const subject = document.getElementById('ticket-subject').value; const desc = document.getElementById('ticket-desc').value;
            if(!subject || !desc) { showToast("Please fill out both subject and description.", "error"); return; }
            btnSendTicket.innerText = "Submitting..."; setTimeout(() => { showToast("Ticket successfully sent to support@younghustlers.net", "success"); btnSendTicket.innerText = "Submit Ticket ➔"; document.getElementById('ticket-subject').value = ''; document.getElementById('ticket-desc').value = ''; document.getElementById('ticket-modal').classList.add('hidden-step'); }, 1000);
        });
    }

    const btnSaveSettings = document.getElementById('btn-save-settings'); const inputDisplayName = document.getElementById('setting-display-name'); const btnSettings = document.getElementById('btn-settings');
    const avatarInput = document.getElementById('setting-avatar-input'); const avatarWrapper = document.getElementById('settings-avatar-wrapper'); const avatarPreview = document.getElementById('settings-avatar-preview');
    let tempAvatarData = null;
    if(btnSaveSettings && inputDisplayName && btnSettings) {
        btnSettings.addEventListener('click', () => {
            const savedName = localStorage.getItem('yh_user_name') || ''; const savedAvatar = localStorage.getItem('yh_user_avatar'); inputDisplayName.value = savedName;
            if (savedAvatar) { avatarPreview.innerText = ''; avatarPreview.style.backgroundImage = `url(${savedAvatar})`; tempAvatarData = savedAvatar; } 
            else { avatarPreview.innerText = savedName ? savedName.charAt(0).toUpperCase() : 'Y'; avatarPreview.style.backgroundImage = 'none'; tempAvatarData = null; }
        });
        if(avatarWrapper && avatarInput) {
            avatarWrapper.addEventListener('click', () => { avatarInput.click(); });
            avatarInput.addEventListener('change', (e) => { const file = e.target.files[0]; if(file) { if(file.size > 2 * 1024 * 1024) { showToast("Image too large. Max 2MB allowed.", "error"); return; } const reader = new FileReader(); reader.onload = (event) => { tempAvatarData = event.target.result; avatarPreview.innerText = ''; avatarPreview.style.backgroundImage = `url(${tempAvatarData})`; }; reader.readAsDataURL(file); } });
        }
        btnSaveSettings.addEventListener('click', () => {
            const newName = inputDisplayName.value.trim(); if(!newName) { showToast("Display name cannot be empty.", "error"); return; }
            localStorage.setItem('yh_user_name', newName); if(tempAvatarData) { localStorage.setItem('yh_user_avatar', tempAvatarData); }
            updateUserProfile(newName, tempAvatarData); showToast("Profile settings saved!", "success"); document.getElementById('settings-modal').classList.add('hidden-step');
        });
    }

    const sidebarToggle = document.getElementById('sidebar-toggle'); const academySidebar = document.getElementById('academy-sidebar');
    if(sidebarToggle && academySidebar) { sidebarToggle.addEventListener('click', () => { academySidebar.classList.toggle('collapsed'); sidebarToggle.innerHTML = academySidebar.classList.contains('collapsed') ? '❯' : '❮'; }); }

    document.querySelectorAll('.btn-focus-mode').forEach(btn => {
        btn.addEventListener('click', () => {
            const dashboardCoreWrapper = document.getElementById('academy-wrapper'); if(!dashboardCoreWrapper) return;
            dashboardCoreWrapper.classList.toggle('in-focus-mode');
            if(dashboardCoreWrapper.classList.contains('in-focus-mode')) { btn.innerHTML = '🔴 Exit Focus Mode'; btn.style.background = 'rgba(239, 68, 68, 0.2)'; btn.style.color = '#ef4444'; btn.style.borderColor = '#ef4444'; showToast("Focus Mode Activated: Distractions Hidden", "success"); } 
            else { btn.innerHTML = '👁️ Focus Mode'; btn.style.background = 'rgba(255,255,255,0.05)'; btn.style.color = '#fff'; btn.style.borderColor = 'rgba(255,255,255,0.1)'; showToast("Focus Mode Deactivated", "success"); }
        });
    });

    const pollOptions = document.querySelectorAll('.poll-option');
    if(pollOptions.length > 0) {
        const savedVote = localStorage.getItem('yh_poll_vote');
        if(savedVote) { const selectedOpt = document.querySelector(`.poll-option[data-vote="${savedVote}"]`); if(selectedOpt) selectedOpt.classList.add('voted'); const votesLabel = document.getElementById('poll-total-votes'); if(votesLabel) votesLabel.innerText = "1,249 Votes"; }
        pollOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                if(localStorage.getItem('yh_poll_vote')) { showToast("You have already voted!", "error"); return; }
                opt.classList.add('voted'); localStorage.setItem('yh_poll_vote', opt.getAttribute('data-vote')); showToast("Vote cast successfully!", "success");
                const votesLabel = document.getElementById('poll-total-votes'); if(votesLabel) votesLabel.innerText = "1,249 Votes";
                const bg = opt.querySelector('.poll-option-bg'); const percent = opt.querySelector('.poll-percent');
                if(bg) bg.style.width = "55%"; if(percent) percent.innerText = "55%";
            });
        });
    }

    const notifBell = document.getElementById('notif-bell'); const notifDropdown = document.getElementById('notif-dropdown'); const markAllRead = document.getElementById('mark-all-read');
    if(notifBell && notifDropdown) {
        notifBell.addEventListener('click', (e) => { if(e.target === markAllRead) return; notifDropdown.classList.toggle('show'); });
        document.addEventListener('click', (e) => { if (!notifBell.contains(e.target)) notifDropdown.classList.remove('show'); });
        if(markAllRead) { markAllRead.addEventListener('click', () => { notifDropdown.querySelectorAll('.unread').forEach(item => item.classList.remove('unread')); const badge = notifBell.querySelector('.notif-badge'); if(badge) badge.style.display = 'none'; showToast("All notifications marked as read.", "success"); }); }
        document.querySelectorAll('.notif-list li').forEach(item => {
            item.addEventListener('click', () => {
                item.classList.remove('unread'); const badge = notifBell.querySelector('.notif-badge');
                if(badge) { const remainingUnread = notifDropdown.querySelectorAll('.unread').length; if (remainingUnread === 0) badge.style.display = 'none'; else badge.innerText = remainingUnread; }
                notifDropdown.classList.remove('show'); const target = item.getAttribute('data-target');
                if (target === 'announcements') document.getElementById('nav-announcements')?.click(); else if (target === 'main-chat') document.getElementById('nav-chat')?.click(); else if (target === 'dm') document.getElementById('btn-open-dm-modal')?.click(); else if (target === 'profile') document.querySelector('.profile-mini')?.click();
            });
        });
    }

    const closeMiniProfileBtn = document.getElementById('close-mini-profile'); const miniProfileModal = document.getElementById('mini-profile-modal');
    if(closeMiniProfileBtn && miniProfileModal) { closeMiniProfileBtn.addEventListener('click', () => miniProfileModal.classList.add('hidden-step')); miniProfileModal.addEventListener('click', (e) => { if(e.target === miniProfileModal) miniProfileModal.classList.add('hidden-step'); }); }

    // ==========================================
    // INITIALIZATION RUNNER
    // ==========================================
    if (localStorage.getItem('yh_user_loggedIn') === 'true') {
        const savedName = localStorage.getItem('yh_user_name');
        const savedAvatar = localStorage.getItem('yh_user_avatar');
        updateUserProfile(savedName, savedAvatar);
        socket.emit('joinRoom', currentRoom);

        loadCustomRooms(); 
        loadBlueprintProgress();
        loadVoiceLounges(); 
        loadVideoLounges();
        renderLeaderboard();
        loadVault(); 
    }

    // ==========================================
    // 🌌 YH UNIVERSE ACCESS & AI SCREENING LOGIC
    // ==========================================
    const universeHubView = document.getElementById('universe-hub-view');
    const academyWrapper = document.getElementById('academy-wrapper');
    const leftSidebar = document.getElementById('academy-sidebar');
    const rightSidebar = document.querySelector('.yh-right-sidebar');

    function checkUniverseAccess() {
        // I-check kung may access na sa Academy (Dapat 'false' o 'null' ito para sa bagong user)
        const hasAcademyAccess = localStorage.getItem('yh_academy_access') === 'true';
        
        if (!hasAcademyAccess) {
            // ✅ Citizen: Ipakita ang Hub portals
            if(universeHubView) universeHubView.style.display = 'flex';
            if(leftSidebar) leftSidebar.style.display = 'none';
            if(rightSidebar) rightSidebar.style.display = 'none';
            if(academyWrapper) academyWrapper.style.display = 'none';
        } else {
            // ✅ Hustler: Itago ang Hub, ipakita ang Dashboard
            if(universeHubView) universeHubView.style.display = 'none';
            if(leftSidebar) leftSidebar.style.display = 'flex';
            if(rightSidebar) rightSidebar.style.display = 'flex';
            if(academyWrapper) academyWrapper.style.display = 'flex';
            
            // I-retrigger ang socket connection para makuha ang chat history
            const currentRoomName = "YH-community"; 
            socket.emit('joinRoom', currentRoomName); 
            document.getElementById('nav-chat')?.click(); 
        }
    }
    
    // Call it immediately
    checkUniverseAccess();

    const btnOpenApply = document.getElementById('btn-open-academy-apply');
    const applyModal = document.getElementById('academy-apply-modal');
    const closeApplyBtn = document.getElementById('close-academy-apply');

    if (btnOpenApply && applyModal) {
        btnOpenApply.addEventListener('click', () => {
            applyModal.classList.remove('hidden-step');
            document.getElementById('ai-form-phase').classList.remove('hidden-step');
            document.getElementById('ai-spinner-phase').classList.add('hidden-step');
            document.getElementById('ai-verdict-phase').classList.add('hidden-step');
        });
        closeApplyBtn.addEventListener('click', () => { applyModal.classList.add('hidden-step'); });
    }

    const formApply = document.getElementById('form-academy-apply');
    if (formApply) {
        formApply.addEventListener('submit', async (e) => {
            e.preventDefault();
            document.getElementById('ai-form-phase').classList.add('hidden-step');
            document.getElementById('ai-spinner-phase').classList.remove('hidden-step');

            const fullName = localStorage.getItem('yh_user_name') || "Hustler";
            const rawData = {
                fullName: fullName,
                email: "hustler@yh.com", 
                age: document.getElementById('app-age').value,
                country: document.getElementById('app-country').value,
                currentJob: document.getElementById('app-job').value,
                reasonJoin: document.getElementById('app-reason').value,
                goals6mo: document.getElementById('app-goals').value,
                seriousness: document.getElementById('app-seriousness').value, // Ito ay dropdown na ngayon!
                hoursCommit: document.getElementById('app-hours').value,
                hearAbout: "Inside Dashboard Hub"
            };

            // Intentional delay para makita ang spinner
            setTimeout(async () => {
                try {
                    const response = await fetch('/api/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rawData) });
                    const result = await response.json();
                    
                    document.getElementById('ai-spinner-phase').classList.add('hidden-step');
                    const verdictPhase = document.getElementById('ai-verdict-phase');
                    verdictPhase.classList.remove('hidden-step');

                    const vIcon = document.getElementById('ai-verdict-icon');
                    const vTitle = document.getElementById('ai-verdict-title');
                    const vDesc = document.getElementById('ai-verdict-desc');
                    const btnEnter = document.getElementById('btn-enter-academy-chat');

                    if (result.success && result.status === "Approved") {
                        vIcon.innerText = "✅"; vTitle.innerText = "Application Approved!"; vTitle.style.color = "var(--success)";
                        vDesc.innerText = `AI Score: ${result.score}/100. ${result.message}`;
                        btnEnter.style.display = 'block'; btnEnter.innerText = "Unlock The Academy ➔";
                        btnEnter.onclick = () => {
                            localStorage.setItem('yh_academy_access', 'true');
                            applyModal.classList.add('hidden-step'); showToast("Academy Unlocked!", "success"); checkUniverseAccess(); 
                        };
                    } else if (result.success && result.status === "Rejected") {
                        vIcon.innerText = "❌"; vTitle.innerText = "Application Rejected"; vTitle.style.color = "#ef4444";
                        vDesc.innerText = `AI Score: ${result.score}/100. ${result.message}`;
                        btnEnter.style.display = 'block'; btnEnter.innerText = "Close Modal";
                        btnEnter.onclick = () => { applyModal.classList.add('hidden-step'); };
                    } else {
                        vIcon.innerText = "⏸️"; vTitle.innerText = "Manual Review Required"; vTitle.style.color = "#f59e0b";
                        vDesc.innerText = `AI Score: ${result.score || 'N/A'}/100. Forwarded to HQ.`;
                        btnEnter.style.display = 'block'; btnEnter.innerText = "Close Modal";
                        btnEnter.onclick = () => { applyModal.classList.add('hidden-step'); };
                    }
                } catch (error) {
                    document.getElementById('ai-spinner-phase').classList.add('hidden-step');
                    showToast("AI Agent offline.", "error");
                    document.getElementById('ai-form-phase').classList.remove('hidden-step');
                }
            }, 3000); // 3 second delay
        });
    }

});