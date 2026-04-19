/* ---------------------------------------------------
   SNZ PLATFORM - CORE ENGINE (app.js)
   Developed for: The Architect
--------------------------------------------------- */

const isLocalFile = window.location.protocol === 'file:' || window.location.protocol === 'content:';
let userEmail = localStorage.getItem('currentUserEmail');
let userBalance = 0;
let loaderInterval;

// 1. نظام التشغيل المتسلسل (App Bootstrap)
window.addEventListener('load', () => {
    initApp();
});

async function initApp() {
    // حماية الصفحة
    if (!userEmail) {
        if (isLocalFile) { 
            userEmail = "architect@local.dev"; 
        } else { 
            window.location.href = 'index.html'; 
            return; 
        }
    }

    // بدء نصوص اللوادر
    startLoaderTexts();

    // انتظار جلب البيانات من قاعدة البيانات (لن يختفي اللوادر قبلها)
    const isDataLoaded = await loadUserData();

    if (isDataLoaded) {
        hideLoader();
        startProfitFeed();
        initBinanceSocket();
    } else {
        document.getElementById('loaderText').innerText = "CONNECTION FAILED. RETRYING...";
        document.getElementById('loaderText').classList.replace('text-cyan-400', 'text-red-500');
    }
}

// 2. إدارة اللوادر
function startLoaderTexts() {
    const texts = ["ESTABLISHING SECURE CONNECTION...", "VERIFYING CREDENTIALS...", "SYNCING DATABASE..."];
    const textEl = document.getElementById('loaderText');
    let i = 0;
    if (textEl) {
        loaderInterval = setInterval(() => {
            i = (i + 1) % texts.length;
            textEl.innerText = texts[i];
        }, 800);
    }
}

function hideLoader() {
    clearInterval(loaderInterval);
    const loader = document.getElementById('ultimateLoader');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }
}

// 3. جلب البيانات من Supabase
async function loadUserData() {
    if (userEmail === "architect@local.dev") {
        updateDashboardUI("The_Architect", "Dev_Mode", "SNZ-ADMIN", 999.50);
        return true;
    }
    
    try {
        const { data, error } = await _supabase.from('users').select('balance, plan, uid').eq('email', userEmail).single();
        
        if (error) throw error;

        if (data) {
            let currentUID = data.uid;
            
            // إنشاء وتخزين UID إذا لم يكن موجوداً
            if (!currentUID || currentUID === "") {
                currentUID = generateUID();
                await _supabase.from('users').update({ uid: currentUID }).eq('email', userEmail);
            }

            userBalance = parseFloat(data.balance);
            updateDashboardUI(userEmail.split('@')[0], data.plan, currentUID, userBalance);
            
            loadChatHistory();
            return true;
        }
        return false;
    } catch (e) {
        console.error("Sync Error:", e);
        return false;
    }
}

// 4. تحديث الواجهة باحترافية (UI Update & Animations)
function updateDashboardUI(username, plan, uid, balance) {
    if (document.getElementById('displayEmail')) document.getElementById('displayEmail').innerText = username.substring(0, 10);
    if (document.getElementById('displayPlan')) document.getElementById('displayPlan').innerText = `PLAN: ${plan}`;
    if (document.getElementById('displayUID')) document.getElementById('displayUID').innerText = uid;
    
    // تحديث منزلقة الاستثمار
    const investRange = document.getElementById('investRange');
    if (investRange) {
        investRange.max = balance > 0 ? balance : 1;
        investRange.value = Math.min(10, balance); // تعيين قيمة افتراضية منطقية
        updateInvestUI();
    }

    // تشغيل أنيميشن عداد الرصيد
    animateNumber('userBalance', balance);
}

function generateUID() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'SNZ-';
    for (let i = 0; i < 5; i++) { result += chars.charAt(Math.floor(Math.random() * chars.length)); }
    return result;
}

function animateNumber(elementId, finalValue) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    let start = 0;
    const duration = 1500; // مدة الأنيميشن (1.5 ثانية)
    const startTime = performance.now();

    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 4); // تأثير التباطؤ السلس
        
        const currentVal = start + (finalValue - start) * easeOut;
        element.innerText = currentVal.toFixed(2);
        
        if (progress < 1) requestAnimationFrame(update);
        else element.innerText = parseFloat(finalValue).toFixed(2);
    }
    
    if (finalValue > 0) requestAnimationFrame(update);
    else element.innerText = "0.00";
}

// 5. نظام الاستثمار (المنزلقة والإشارات)
function showInvestmentSlider() {
    const zone = document.getElementById('investmentZone');
    const codeInput = document.getElementById('signalCode');
    if (zone && codeInput) {
        if (codeInput.value.length >= 3) zone.classList.remove('hidden');
        else zone.classList.add('hidden');
    }
}

function updateInvestUI() {
    const val = document.getElementById('investRange').value;
    if (document.getElementById('investValue')) document.getElementById('investValue').innerText = val;
    if (document.getElementById('expectedProfit')) document.getElementById('expectedProfit').innerText = `+$${(val * 2).toFixed(2)}`;
}

async function executeSignal() {
    const codeInput = document.getElementById('signalCode');
    if (!codeInput) return;
    
    const code = codeInput.value.trim().toUpperCase();
    const invest = parseFloat(document.getElementById('investRange').value);
    
    if (!code || userEmail === "architect@local.dev") return alert("كود غير متاح في وضع المعاينة");
    if (invest > userBalance || userBalance <= 0) return alert("الرصيد غير كافٍ للاستثمار");

    document.getElementById('investmentZone').classList.add('hidden');
    document.getElementById('signalStep1').classList.add('hidden');
    document.getElementById('tradeUI').classList.remove('hidden');
    
    let time = 60; 
    const interval = setInterval(() => {
        time--;
        document.getElementById('tradeTimer').innerText = `00:${time < 10 ? '0'+time : time}`;
        document.getElementById('tradeProgress').style.width = `${((60-time)/60)*100}%`;
        if (time <= 0) { 
            clearInterval(interval); 
            finalizeTrade(code, invest); 
        }
    }, 1000);
}

async function finalizeTrade(code, invest) {
    try {
        const { error } = await _supabase.rpc('claim_signal_profit', { s_code: code, u_email: userEmail, u_invest: invest });
        if (!error) { 
            alert("تم تنفيذ الإشارة وإضافة الأرباح بنجاح!"); 
            location.reload(); 
        } else { 
            alert("الكود غير صالح أو منتهي الصلاحية"); 
            location.reload(); 
        }
    } catch (e) { 
        console.error("DB Error", e); 
        alert("حدث خطأ في الاتصال بالخادم.");
        location.reload();
    }
}

// 6. نظام الدردشة المباشر (الدعم الفني)
function toggleChat() {
    const chatWin = document.getElementById('chatWindow');
    const badge = document.getElementById('chatBadge');
    if (!chatWin) return;

    if (chatWin.classList.contains('hidden')) {
        chatWin.classList.remove('hidden');
        if (badge) badge.classList.add('hidden');
        setTimeout(() => {
            chatWin.classList.remove('opacity-0', 'translate-y-10');
            scrollToBottom();
        }, 10);
    } else {
        chatWin.classList.add('opacity-0', 'translate-y-10');
        setTimeout(() => chatWin.classList.add('hidden'), 400);
    }
}

function scrollToBottom() {
    const body = document.getElementById('chatBody');
    if (body) body.scrollTop = body.scrollHeight;
}

function renderMessage(text, sender) {
    const body = document.getElementById('chatBody');
    if (!body) return;
    
    const div = document.createElement('div');
    div.className = sender === 'user' 
        ? 'chat-bubble-user p-3 rounded-2xl max-w-[85%] self-end text-[10px] text-white shadow-md' 
        : 'chat-bubble-admin p-3 rounded-2xl max-w-[85%] self-start text-[10px] text-gray-200 shadow-md';
    div.innerText = text;
    body.appendChild(div);
    scrollToBottom();
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    
    const text = input.value.trim();
    if (!text || userEmail === "architect@local.dev") return;

    renderMessage(text, 'user');
    input.value = '';

    try {
        await _supabase.from('support_chats').insert([{ user_email: userEmail, message: text, sender: 'user' }]);
    } catch (e) { console.error("Chat sync error"); }
}

async function loadChatHistory() {
    if (userEmail === "architect@local.dev") return;
    try {
        const { data } = await _supabase.from('support_chats').select('*').eq('user_email', userEmail).order('created_at', { ascending: true });

        const body = document.getElementById('chatBody');
        if (body && data && data.length > 0) {
            body.innerHTML = `<div class="chat-bubble-admin p-3 rounded-2xl max-w-[85%] self-start text-[10px] text-gray-200 leading-relaxed">أهلاً بك في منصة SNZ للتداول الذكي. كيف يمكننا مساعدتك اليوم؟</div>`;
            data.forEach(msg => renderMessage(msg.message, msg.sender));
        }

        _supabase.channel('support_channel').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_chats', filter: `user_email=eq.${userEmail}` }, payload => {
            if (payload.new.sender === 'admin') {
                renderMessage(payload.new.message, 'admin');
                const chatWin = document.getElementById('chatWindow');
                const badge = document.getElementById('chatBadge');
                if (chatWin && chatWin.classList.contains('hidden') && badge) {
                    badge.classList.remove('hidden');
                }
            }
        }).subscribe();
    } catch (e) { console.log("Failed to load chats"); }
}

// 7. رادار الأرباح والسوق
function startProfitFeed() {
    const feedContainer = document.getElementById('profitFeedContainer');
    if (!feedContainer) return;
    
    setInterval(() => {
        const userId = Math.floor(Math.random() * 9000) + 1000;
        const profit = (Math.random() * 150 + 15).toFixed(2);
        const item = document.createElement('div');
        item.className = 'flex justify-between items-center bg-white/5 p-2 rounded-lg mb-2 transform transition-all duration-500 translate-y-[-100%] opacity-0';
        item.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                <span class="text-gray-300 text-[10px] font-mono">User_${userId}**</span>
            </div>
            <span class="text-green-400 font-bold text-[11px]">+$${profit}</span>
            <span class="text-[8px] text-purple-400 border border-purple-500/30 px-1.5 py-0.5 rounded uppercase tracking-tighter">GOLD</span>`;
        
        feedContainer.prepend(item);
        requestAnimationFrame(() => { 
            item.classList.remove('translate-y-[-100%]', 'opacity-0'); 
            item.classList.add('translate-y-0', 'opacity-100'); 
        });
        if (feedContainer.children.length > 4) feedContainer.lastElementChild.remove();
    }, 4500);
}

function initBinanceSocket() {
    const bSocket = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@ticker");
    bSocket.onmessage = (e) => {
        const d = JSON.parse(e.data);
        const priceEl = document.getElementById('marketPrice');
        const changeEl = document.getElementById('priceChange');
        if (priceEl && changeEl) {
            priceEl.innerText = parseFloat(d.c).toFixed(2);
            changeEl.innerText = parseFloat(d.P).toFixed(2) + '%';
            priceEl.className = `text-2xl font-black font-mono transition-colors ${parseFloat(d.P) >= 0 ? 'text-green-400' : 'text-red-400'}`;
            changeEl.style.color = parseFloat(d.P) >= 0 ? '#4ade80' : '#f87171';
        }
    };
}

// 8. التوجيهات الأساسية
function navigateToTeam() { setTimeout(() => { window.location.href = 'team.html'; }, 150); }
function logout() { localStorage.removeItem('currentUserEmail'); window.location.href = 'index.html'; }
