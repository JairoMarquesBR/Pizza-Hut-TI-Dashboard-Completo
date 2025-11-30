// ======================================================
// 0. SEGURANÇA E INICIALIZAÇÃO
// ======================================================
(function securityCheck() {
    const isLoginPage = window.location.pathname.includes('login.html');
    if (!isLoginPage && !sessionStorage.getItem('pizzaUserUI')) {
        window.location.href = 'login.html';
    }
})();

window.currentInterval = null;
let bsModal = null;
let avatarBase64 = null;

document.addEventListener('DOMContentLoaded', function() {
    if(window.location.pathname.includes('login.html')) return;

    // 1. SE FOR PÁGINA DE SETTINGS, INICIA ADMIN
    if (window.location.pathname.includes('settings.html')) {
        console.log(">>> Página de Configurações Detectada");
        checkThemePreference();
        initSettingsPage();
        
        // Revela a página
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';
        return; 
    }

    // 2. SE FOR PÁGINA PRINCIPAL (DASHBOARD)
    const modalEl = document.getElementById('main-modal');
    if (modalEl) bsModal = new bootstrap.Modal(modalEl);

    setupModalTriggers();
    setupContextMenu();
    startClock();
    initNetworkMonitor();
    fetchPublicIPInfo();
    detectSystemInfo();
    updateNavbarAvatar();
    checkThemePreference();
    applyAccessControl();
    
    setTimeout(() => checkSystemAlerts(), 2000);

    loadPage('dashboard');
    
    setTimeout(() => {
        document.body.style.visibility = 'visible';
        document.body.style.opacity = '1';
        document.body.addEventListener('click', unlockAudio, { once: true });
    }, 100);
});

// ======================================================
// ADMINISTRAÇÃO (SETTINGS.HTML)
// ======================================================
function initSettingsPage() {
    console.log("Inicializando Painel Admin...");
    loadUsersList();
    setupUserForm();
}

async function loadUsersList() {
    const tbody = document.getElementById('users-table-body');
    if(!tbody) {
        console.error("Erro: Tabela de usuários não encontrada no HTML");
        return;
    }
    
    tbody.innerHTML = '<tr><td colspan="4" class="text-center py-3"><div class="spinner-border text-danger spinner-border-sm"></div> Buscando...</td></tr>';
    
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        
        console.log(`Usuários carregados: ${users.length}`);
        tbody.innerHTML = '';
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center">Nenhum usuário.</td></tr>';
            return;
        }

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
        console.error("Erro fetch users:", e);
        tbody.innerHTML = '<tr><td colspan="4" class="text-danger text-center">Erro de conexão com o servidor.</td></tr>';
    }
}

function setupUserForm() {
    const form = document.getElementById('user-form');
    const fileInput = document.getElementById('form-file');
    if(!form) return;

    if(fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if(file) {
                const r = new FileReader();
                r.onload = (e) => { 
                    avatarBase64 = e.target.result;
                    const p = document.getElementById('form-avatar-preview');
                    const i = document.getElementById('form-avatar-icon');
                    if(p) { p.src = avatarBase64; p.style.display='inline-block'; }
                    if(i) i.style.display='none';
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
            if(res.ok) {
                const cur = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
                if(cur && cur.username === u) {
                    if(avatarBase64) cur.avatar = avatarBase64;
                    cur.role = r;
                    sessionStorage.setItem('pizzaUserUI', JSON.stringify(cur));
                }
                alert(isEdit ? "Atualizado!" : "Criado!");
                resetUserForm();
                loadUsersList();
            } else {
                alert("Erro ao salvar.");
            }
        } catch (e) { alert("Erro de conexão."); }
    };
}

window.editUser = function(u) {
    avatarBase64 = null;
    const iUser = document.getElementById('form-username');
    iUser.value = u.username;
    iUser.disabled = true;
    document.getElementById('form-role').value = u.role;
    document.getElementById('form-password').placeholder = '(Opcional)';
    
    const p = document.getElementById('form-avatar-preview');
    const i = document.getElementById('form-avatar-icon');
    if(u.avatar && p) { 
        p.src = u.avatar; p.style.display='inline-block'; i.style.display='none'; 
    } else if(p) { 
        p.style.display='none'; i.style.display='inline-block'; 
    }
    window.scrollTo(0,0);
}

window.resetUserForm = function() {
    document.getElementById('user-form').reset();
    avatarBase64 = null;
    document.getElementById('form-username').disabled = false;
    document.getElementById('form-password').placeholder = 'Senha';
    document.getElementById('form-avatar-preview').style.display = 'none';
    document.getElementById('form-avatar-icon').style.display = 'inline-block';
};

window.deleteUser = async function(u) {
    if(!confirm(`Excluir "${u}"?`)) return;
    try {
        await fetch(`/api/users/${u}`, { method: 'DELETE' });
        loadUsersList();
    } catch(e) { console.error(e); }
};

// ======================================================
// FUNÇÕES GERAIS (Mantidas)
// ======================================================
// (Cole aqui o resto das funções utilitárias: loadPage, openDynamicModal, updateNavbarAvatar, etc.)
// Para facilitar, vou incluir as essenciais para o index.html funcionar também:

window.loadPage = async function(pageName) {
    const container = document.getElementById('app-content');
    const cssLink = document.getElementById('page-style');
    if (window.currentInterval) clearInterval(window.currentInterval);
    container.innerHTML = `<div class="d-flex justify-content-center py-5"><div class="spinner-border text-danger"></div></div>`;
    try {
        if(cssLink) cssLink.href = `css/${pageName}.css`;
        const res = await fetch(`pages/${pageName}.html`);
        if (!res.ok) throw new Error();
        const html = await res.text();
        await new Promise(r => setTimeout(r, 150));
        container.innerHTML = html;
        loadPageScript(pageName);
        const offcanvas = bootstrap.Offcanvas.getInstance(document.getElementById('mobileMenu'));
        if(offcanvas) offcanvas.hide();
        setTimeout(applyAccessControl, 100);
    } catch (e) { container.innerHTML = `<div class="alert alert-danger m-4">Erro 404</div>`; }
}

function loadPageScript(pageName) {
    const old = document.getElementById('page-script');
    if(old) old.remove();
    const s = document.createElement('script');
    s.src = `js/${pageName}.js?v=${Date.now()}`;
    s.id = 'page-script';
    document.body.appendChild(s);
}

function setupModalTriggers() {
    document.body.addEventListener('click', function(e) {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.preventDefault();
            const title = trigger.getAttribute('data-title');
            let file = trigger.getAttribute('data-file');
            if (file && !file.includes('/')) file = 'pages/' + file;
            openDynamicModal(title, file || 'pages/modal-default.html');
        }
    });
}

async function openDynamicModal(title, fileUrl) {
    document.getElementById('modal-title').innerText = title;
    const body = document.getElementById('modal-body-placeholder');
    body.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-danger"></div></div>';
    bsModal.show();
    try {
        const res = await fetch(fileUrl);
        const html = await res.text();
        body.innerHTML = html;
        if (fileUrl.includes('preferences')) setTimeout(initPreferencesLogic, 100);
    } catch (e) { body.innerHTML = '<div class="alert alert-danger m-3">Erro.</div>'; }
}

function initPreferencesLogic() {
    const user = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
    if(!user) return;
    document.getElementById('pref-username').innerText = user.name;
    document.getElementById('pref-role').innerText = user.role.toUpperCase();
    const heroImg = document.getElementById('hero-avatar-img');
    const heroIcon = document.getElementById('hero-avatar-icon');
    if(heroImg) {
        if (user.avatar) { heroImg.src = user.avatar; heroImg.style.display='block'; heroIcon.style.display='none'; }
        else { heroImg.style.display='none'; heroIcon.style.display='block'; }
    }
    const ts = document.getElementById('pref-theme');
    if(ts) { ts.checked = localStorage.getItem('theme') === 'dark'; ts.addEventListener('change', toggleTheme); }
}

function updateNavbarAvatar() {
    const user = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
    if(!user) return;
    const dName = document.getElementById('nav-username-display');
    if(dName) dName.innerText = user.name;
    const navImg = document.getElementById('nav-user-avatar');
    const navIcon = document.getElementById('nav-user-icon');
    if(navImg) {
        if (user.avatar) { navImg.src=user.avatar; navImg.style.display='block'; navIcon.style.display='none'; }
        else { navImg.style.display='none'; navIcon.style.display='block'; }
    }
    const mobImg = document.getElementById('mobile-user-avatar');
    if(mobImg) mobImg.src = user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=d32f2f&color=fff`;
}

function toggleTheme() {
    const h=document.documentElement; const n=h.getAttribute('data-bs-theme')==='dark'?'light':'dark';
    h.setAttribute('data-bs-theme',n); localStorage.setItem('theme',n);
}
function checkThemePreference() { document.documentElement.setAttribute('data-bs-theme', localStorage.getItem('theme')||'light'); }
function applyAccessControl() { const u=JSON.parse(sessionStorage.getItem('pizzaUserUI')); if(u&&u.role!=='admin') document.querySelectorAll('.admin-only').forEach(el=>el.classList.add('d-none')); }
function startClock() { setInterval(() => document.getElementById('clock').innerText = new Date().toLocaleTimeString(), 1000); }
function initNetworkMonitor() { /* ... (mesmo código de rede anterior) ... */ }
function fetchPublicIPInfo() { /* ... (mesmo código de IP anterior) ... */ }
function detectSystemInfo() { /* ... (mesmo código de OS anterior) ... */ }
function setupContextMenu() { /* ... (mesmo código de menu anterior) ... */ }
function unlockAudio() { /* ... */ }
function checkSystemAlerts() { /* ... */ }
function triggerAlert(d) { /* ... */ }
function fetchDashboardData() { /* ... */ }