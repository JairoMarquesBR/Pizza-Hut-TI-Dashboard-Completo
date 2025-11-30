// ======================================================
// 0. SEGURANÇA E VARIÁVEIS GLOBAIS
// ======================================================
(function securityCheck() {
    const isLoginPage = window.location.pathname.includes('login.html');
    if (!isLoginPage && !sessionStorage.getItem('pizzaUserUI')) {
        window.location.href = 'login.html';
    }
})();

// Variáveis de controle do sistema
window.currentInterval = null; // Para limpar loops de outras páginas
let bsModal = null;            // Instância da Modal Bootstrap
let avatarBase64 = null;       // Cache para upload de foto

document.addEventListener('DOMContentLoaded', function() {
    if(window.location.pathname.includes('login.html')) return;

    // --- INICIALIZAÇÃO DE COMPONENTES ---
    
    // 1. Modal Global
    const modalEl = document.getElementById('main-modal');
    if (modalEl) {
        bsModal = new bootstrap.Modal(modalEl);
    }

    // 2. Listeners e UI
    setupModalTriggers();
    setupContextMenu();
    startClock();
    
    // 3. Monitoramento
    initNetworkMonitor();
    fetchPublicIPInfo();
    detectSystemInfo();
    
    // 4. Usuário e Tema
    updateNavbarAvatar();
    checkThemePreference();
    applyAccessControl();

    // 5. Alertas (Som e Toasts)
    // Destrava áudio no primeiro clique
    document.body.addEventListener('click', unlockAudio, { once: true });
    // Inicia verificação cíclica
    setTimeout(() => {
        checkSystemAlerts();
        setInterval(checkSystemAlerts, 30000); // Checa a cada 30s
    }, 2000);

    // 6. ROTEAMENTO INTELIGENTE
    
    // Se estiver na página de CONFIGURAÇÕES (Admin)
    if (window.location.pathname.includes('settings.html')) {
        console.log("Modo Admin: Settings");
        initSettingsPage();
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';
    } 
    // Se estiver na página INICIAL (SPA)
    else if (document.getElementById('app-content')) {
        loadPage('dashboard');
        // Anti-FOUC (Revela o site suavemente)
        setTimeout(() => {
            document.body.style.visibility = 'visible';
            document.body.style.opacity = '1';
        }, 100);
    }
});

// ======================================================
// 1. SISTEMA DE NOTIFICAÇÃO (TOAST GLOBAL)
// ======================================================
// ======================================================
// 1. SISTEMA DE NOTIFICAÇÃO (TOAST PREMIUM)
// ======================================================
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const id = 'toast-' + Date.now();
    
    // Define estilos baseados no tipo
    let typeClass = 'toast-success';
    let iconName = 'check_circle';
    
    if (type === 'error') { typeClass = 'toast-error'; iconName = 'error_outline'; }
    if (type === 'warning') { typeClass = 'toast-warning'; iconName = 'warning_amber'; }

    // Novo HTML Minimalista e Elegante
    const html = `
        <div id="${id}" class="toast toast-custom ${typeClass} show" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="toast-body">
                <i class="material-icons">${iconName}</i>
                <span>${message}</span>
                <button type="button" class="btn-close ms-auto" onclick="document.getElementById('${id}').remove()" style="filter: grayscale(1);"></button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', html);

    // Auto-remove em 5 segundos com efeito visual
    setTimeout(() => {
        const el = document.getElementById(id);
        if(el) {
            el.style.opacity = '0';
            el.style.transform = 'translateX(20px)';
            setTimeout(() => el.remove(), 300);
        }
    }, 5000);
};

// ======================================================
// 2. SISTEMA DE ALERTAS (SOM + VISUAL)
// ======================================================
function unlockAudio() {
    const audio = document.getElementById('alert-sound');
    if(audio) {
        audio.volume = 0;
        audio.play().then(() => {
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1.0;
        }).catch(() => {});
    }
    // Pede permissão de notificação
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

async function checkSystemAlerts() {
    try {
        const res = await fetch('/api/alerts/check');
        const alerts = await res.json();
        if (alerts && alerts.length > 0) {
            alerts.forEach(alert => triggerAlert(alert));
        }
    } catch (e) { console.error("Erro check alerts", e); }
}

function triggerAlert(alertData) {
    // 1. Som
    const audio = document.getElementById('alert-sound');
    if(audio) audio.play().catch(() => console.log("Som bloqueado"));

    // 2. Toast
    showToast(alertData.body, 'error');
    
    // 3. Push Notification
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState === "hidden") {
        new Notification(alertData.title, { body: alertData.body });
    }
}

// ======================================================
// 3. ROTEADOR SPA
// ======================================================
window.loadPage = async function(pageName) {
    const container = document.getElementById('app-content');
    const cssLink = document.getElementById('page-style');
    
    if (window.currentInterval) {
        clearInterval(window.currentInterval);
        window.currentInterval = null;
    }
    
    container.innerHTML = `<div class="d-flex justify-content-center align-items-center" style="height: 50vh;"><div class="spinner-border text-danger" style="width: 3rem; height: 3rem;"></div></div>`;

    try {
        if(cssLink) cssLink.href = `css/${pageName}.css`; // Carrega CSS específico

        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) throw new Error(`Erro ${response.status}`);
        const html = await response.text();
        
        await new Promise(r => setTimeout(r, 150)); // Delay estético
        container.innerHTML = html;

        loadPageScript(pageName);

        // Fecha Menu Mobile
        const offcanvasEl = document.getElementById('mobileMenu');
        if(offcanvasEl) {
            const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
            if (bsOffcanvas) bsOffcanvas.hide();
        }

        setTimeout(applyAccessControl, 100);

    } catch (error) {
        container.innerHTML = `<div class="alert alert-danger m-5 text-center">Erro ao carregar módulo: ${pageName}</div>`;
    }
}

function loadPageScript(pageName) {
    const oldScript = document.getElementById('page-script');
    if (oldScript) oldScript.remove();

    const script = document.createElement('script');
    script.src = `js/${pageName}.js?v=${Date.now()}`; // Cache busting
    script.id = 'page-script';
    document.body.appendChild(script);
}

// ======================================================
// 4. MODAIS DINÂMICAS
// ======================================================
function setupModalTriggers() {
    document.body.addEventListener('click', function(e) {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.preventDefault();
            const title = trigger.getAttribute('data-title');
            let file = trigger.getAttribute('data-file');
            
            // Corrige caminho se necessário (padrão: pasta pages/)
            if (file && !file.includes('/')) file = 'pages/' + file;
            
            openDynamicModal(title, file || 'pages/modal-default.html');
        }
    });
}

async function openDynamicModal(title, fileUrl) {
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body-placeholder');
    
    if(titleEl) titleEl.innerText = title;
    bodyEl.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-danger"></div></div>';
    
    if(bsModal) bsModal.show();

    try {
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error();
        const html = await res.text();
        bodyEl.innerHTML = html;

        if (fileUrl.includes('preferences')) setTimeout(initPreferencesLogic, 50);

    } catch (e) {
        bodyEl.innerHTML = `<div class="alert alert-danger m-3">Erro ao carregar conteúdo.</div>`;
    }
}

// ======================================================
// 5. PREFERÊNCIAS (PERFIL)
// ======================================================
function initPreferencesLogic() {
    const user = getCurrentUser();
    if (!user) return;

    // Hero Info
    const elUser = document.getElementById('pref-username');
    const elRole = document.getElementById('pref-role');
    if (elUser) elUser.innerText = user.name;
    if (elRole) elRole.innerText = user.role === 'admin' ? 'ADMINISTRADOR' : 'OPERADOR';

    // Hero Avatar
    const heroImg = document.getElementById('hero-avatar-img');
    const heroIcon = document.getElementById('hero-avatar-icon');
    if (heroImg && heroIcon) {
        if (user.avatar) {
            heroImg.src = user.avatar;
            heroImg.style.display = 'block';
            heroIcon.style.display = 'none';
        } else {
            heroImg.style.display = 'none';
            heroIcon.style.display = 'block';
        }
    }

    // Painel Admin (Apenas Link)
    if (user.role === 'admin') {
        const panel = document.getElementById('admin-user-manager');
        if (panel) panel.classList.remove('d-none');
    }
    
    // Tema Switch
    const ts = document.getElementById('pref-theme');
    if(ts) {
        ts.checked = localStorage.getItem('theme') === 'dark';
        ts.addEventListener('change', toggleTheme);
    }
}

// ======================================================
// 6. ADMINISTRAÇÃO (CRUD USUÁRIOS - Settings.html)
// ======================================================
function initSettingsPage() {
    loadUsersList();
    setupUserForm();
}

async function loadUsersList() {
    const tbody = document.getElementById('users-table-body');
    if(!tbody) return;
    
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        tbody.innerHTML = '';
        
        users.forEach(u => {
            const avatar = u.avatar 
                ? `<img src="${u.avatar}" class="rounded-circle border" width="35" height="35" style="object-fit:cover;">` 
                : `<i class="material-icons text-secondary fs-4">account_circle</i>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="ps-4">${avatar}</td>
                <td class="fw-bold">${u.username}</td>
                <td><span class="badge ${u.role === 'admin' ? 'bg-danger' : 'bg-secondary'}">${u.role}</span></td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-link text-primary btn-edit" title="Editar"><i class="material-icons">edit</i></button>
                    <button class="btn btn-sm btn-link text-danger btn-del" title="Excluir"><i class="material-icons">delete</i></button>
                </td>
            `;
            
            tr.querySelector('.btn-edit').addEventListener('click', () => editUser(u));
            tr.querySelector('.btn-del').addEventListener('click', () => deleteUser(u.username));
            
            tbody.appendChild(tr);
        });
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-danger text-center">Erro ao carregar lista.</td></tr>';
    }
}

function setupUserForm() {
    const form = document.getElementById('user-form');
    const fileInput = document.getElementById('form-file');
    if(!form) return;

    // Preview de Foto
    if(fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if(file) {
                if (file.size > 2097152) { 
                    showToast("Imagem muito grande (Max 2MB)", "error");
                    this.value = '';
                    return;
                }
                const r = new FileReader();
                r.onload = (e) => { 
                    avatarBase64 = e.target.result;
                    const preview = document.getElementById('form-avatar-preview');
                    const icon = document.getElementById('form-avatar-icon');
                    if(preview) { preview.src = avatarBase64; preview.style.display='inline-block'; }
                    if(icon) icon.style.display='none';
                };
                r.readAsDataURL(file);
            }
        });
    }

    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const u = document.getElementById('form-username').value;
        const p = document.getElementById('form-password').value;
        const r = document.getElementById('form-role').value;
        const isEdit = document.getElementById('form-username').disabled;
        const method = isEdit ? 'PUT' : 'POST';
        const url = isEdit ? `/api/users/${u}` : '/api/users';
        
        const body = { username: u, password: p, role: r };
        if(avatarBase64) body.avatar = avatarBase64;

        try {
            const res = await fetch(url, { method: method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
            
            if (res.ok) {
                const cur = getCurrentUser();
                // Atualiza sessão se editou o próprio usuário
                if(cur && cur.username === u) {
                    if(avatarBase64) cur.avatar = avatarBase64;
                    cur.role = r;
                    sessionStorage.setItem('pizzaUserUI', JSON.stringify(cur));
                    updateNavbarAvatar();
                }
                showToast(isEdit ? "Usuário atualizado!" : "Usuário criado!", "success");
                resetUserForm();
                loadUsersList();
            } else {
                const err = await res.json();
                showToast("Erro: " + err.message, "error");
            }
        } catch (e) { showToast("Erro de conexão.", "error"); }
    };
}

window.editUser = function(u) {
    avatarBase64 = null;
    const iUser = document.getElementById('form-username');
    iUser.value = u.username; iUser.disabled = true;
    document.getElementById('form-role').value = u.role;
    document.getElementById('form-password').placeholder = '(Opcional)';
    
    const p = document.getElementById('form-avatar-preview');
    const i = document.getElementById('form-avatar-icon');
    if(u.avatar && p) { p.src = u.avatar; p.style.display='inline-block'; i.style.display='none'; }
    else { p.style.display='none'; i.style.display='inline-block'; }
    
    window.scrollTo(0,0);
}

window.resetUserForm = function() {
    document.getElementById('user-form').reset();
    avatarBase64 = null;
    const userInp = document.getElementById('form-username');
    if(userInp) userInp.disabled = false;
    const preview = document.getElementById('form-avatar-preview');
    const icon = document.getElementById('form-avatar-icon');
    if(preview) preview.style.display = 'none';
    if(icon) icon.style.display = 'inline-block';
};

window.deleteUser = async function(u) {
    if(!confirm(`Excluir "${u}"?`)) return;
    try {
        const res = await fetch(`/api/users/${u}`, { method: 'DELETE' });
        if(res.ok) {
            showToast("Usuário removido.", "success");
            loadUsersList();
        } else {
            showToast("Erro ao remover.", "error");
        }
    } catch(e) { console.error(e); }
};


// ======================================================
// 7. UTILITÁRIOS GERAIS
// ======================================================
function updateNavbarAvatar() {
    const user = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
    if(!user) return;
    
    const elName = document.getElementById('nav-username-display');
    const elRole = document.getElementById('nav-role-display');
    if(elName) elName.innerText = user.name;
    if(elRole) elRole.innerText = user.role.toUpperCase();

    const src = user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=d32f2f&color=fff`;
    
    const navImg = document.getElementById('nav-user-avatar');
    const navIcon = document.getElementById('nav-user-icon');
    const mobImg = document.getElementById('mobile-user-avatar');
    const mobName = document.getElementById('mobile-username');

    if(navImg && navIcon) {
        if (user.avatar) {
            navImg.src = user.avatar;
            navImg.style.display = 'block';
            navIcon.style.display = 'none';
        } else {
            navImg.style.display = 'none';
            navIcon.style.display = 'block';
        }
    }
    if(mobImg) mobImg.src = src;
    if(mobName) mobName.innerText = user.name;
}

function getCurrentUser() { return JSON.parse(sessionStorage.getItem('pizzaUserUI')); }

window.logout = async function() {
    try { await fetch('/api/logout', { method: 'POST' }); } catch(e){}
    sessionStorage.clear();
    window.location.href = 'login.html';
}

function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-bs-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-bs-theme', next);
    localStorage.setItem('theme', next);
    const icon = document.getElementById('theme-icon');
    if(icon) icon.innerText = next === 'dark' ? 'light_mode' : 'dark_mode';
}

function checkThemePreference() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', saved);
    const icon = document.getElementById('theme-icon');
    if(icon) icon.innerText = saved === 'dark' ? 'light_mode' : 'dark_mode';
}

function applyAccessControl() {
    const user = getCurrentUser();
    if(user && user.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('d-none'));
    }
}

function startClock() { setInterval(() => document.getElementById('clock').innerText = new Date().toLocaleTimeString(), 1000); }

function initNetworkMonitor() {
    const pingEl = document.getElementById('real-ping');
    const connStatus = document.getElementById('conn-status');
    
    function updateStatus() {
        if(navigator.onLine) {
            if(connStatus) {
                connStatus.innerHTML = '<i class="material-icons fs-6 align-middle me-1">wifi</i>Online';
                connStatus.className = "fw-bold text-success";
            }
        } else {
            if(connStatus) {
                connStatus.innerHTML = '<i class="material-icons fs-6 align-middle me-1">wifi_off</i>Offline';
                connStatus.className = "fw-bold text-danger";
            }
            if(pingEl) pingEl.innerText = "--";
        }
    }
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();

    setInterval(async () => {
        if(!navigator.onLine) return;
        const start = Date.now();
        try { 
            await fetch(location.href, {method:'HEAD', cache:"no-store"}); 
            if(pingEl) pingEl.innerText = `${Date.now() - start}ms`;
        } catch(e) { if(pingEl) pingEl.innerText = "--"; }
    }, 3000);
}

async function fetchPublicIPInfo() {
    const ipEl = document.getElementById('real-ip');
    if(!ipEl) return;
    try { const r = await fetch('https://api.ipify.org?format=json'); const d = await r.json(); ipEl.innerText = d.ip; } catch(e) { ipEl.innerText = "Local"; }
}

function detectSystemInfo() {
    const el = document.getElementById('net-os');
    if(!el) return;
    let os = "Desktop";
    if (navigator.userAgent.indexOf("Win")!=-1) os="Windows";
    else if (navigator.userAgent.indexOf("Mac")!=-1) os="MacOS";
    else if (navigator.userAgent.indexOf("Linux")!=-1) os="Linux";
    if (navigator.userAgent.indexOf("Android")!=-1) os="Android";
    else if (navigator.userAgent.indexOf("iPhone")!=-1) os="iOS";
    el.innerText = os;
}

function setupContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    if(!menu) return;
    document.addEventListener('contextmenu', e => {
        e.preventDefault();
        let x = e.clientX;
        let y = e.clientY;
        if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
        if (y + 150 > window.innerHeight) y = window.innerHeight - 160;
        menu.style.top = `${y}px`;
        menu.style.left = `${x}px`;
        menu.style.display = 'block';
    });
    document.addEventListener('click', () => menu.style.display='none');
}

function fetchDashboardData() {
    const updateUI = async () => {
        try {
            const response = await fetch('/api/dashboard-data');
            if (response.status === 401) return window.logout();
            const data = await response.json();
            const el = document.getElementById('client-count');
            if(el) el.innerText = data.clients;
        } catch (error) {}
    };
    updateUI();
    setInterval(updateUI, 5000);
}