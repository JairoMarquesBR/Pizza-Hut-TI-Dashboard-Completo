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

    // Inicializa Modal Bootstrap
    const modalEl = document.getElementById('main-modal');
    if(modalEl) bsModal = new bootstrap.Modal(modalEl);

    setupModalTriggers();
    startClock();
    initNetworkMonitor();
    fetchPublicIPInfo();
    detectSystemInfo();
    updateNavbarAvatar();
    checkThemePreference();
    applyAccessControl();
    loadPage('dashboard');
});

// ======================================================
// 1. ROTEADOR
// ======================================================
window.loadPage = async function(pageName) {
    const container = document.getElementById('app-content');
    const cssLink = document.getElementById('page-style');
    
    if (window.currentInterval) clearInterval(window.currentInterval);
    
    container.innerHTML = `<div class="d-flex justify-content-center py-5"><div class="spinner-border text-danger"></div></div>`;

    try {
        cssLink.href = `css/${pageName}.css`;
        const res = await fetch(`pages/${pageName}.html`);
        if (!res.ok) throw new Error(`Página não encontrada: ${pageName}`);
        const html = await res.text();
        
        await new Promise(r => setTimeout(r, 100));
        container.innerHTML = html;
        loadPageScript(pageName);
        
        const offcanvasEl = document.getElementById('mobileMenu');
        const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if(bsOffcanvas) bsOffcanvas.hide();
    } catch (e) {
        container.innerHTML = `<div class="alert alert-danger m-4">Erro 404: ${pageName}</div>`;
    }
}

function loadPageScript(pageName) {
    const old = document.getElementById('page-script');
    if(old) old.remove();
    const s = document.createElement('script');
    // ADICIONADO TIMESTAMP PARA FORÇAR RECARREGAMENTO
    s.src = `js/${pageName}.js?v=${Date.now()}`; 
    s.id = 'page-script';
    document.body.appendChild(s);
}

// ======================================================
// 2. MODAL LÓGICA
// ======================================================
function setupModalTriggers() {
    document.body.addEventListener('click', function(e) {
        const trigger = e.target.closest('.action-trigger');
        if (trigger) {
            e.preventDefault();
            const title = trigger.getAttribute('data-title');
            const file = trigger.getAttribute('data-file');
            openDynamicModal(title, file);
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
        if (!res.ok) throw new Error(`Arquivo não encontrado`);
        const html = await res.text();
        body.innerHTML = html;
        
        if (fileUrl.includes('preferences')) {
            // Pequeno delay para garantir que o HTML renderizou antes de rodar o JS
            setTimeout(initPreferencesLogic, 50);
        }

    } catch (e) {
        body.innerHTML = `<div class="alert alert-danger m-3">Erro ao carregar: ${fileUrl}</div>`;
    }
}

// ======================================================
// 3. PREFERÊNCIAS & ADMIN (CRUD CORRIGIDO)
// ======================================================
function initPreferencesLogic() {
    const user = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
    if (!user) return;

    const elUser = document.getElementById('pref-username');
    const elRole = document.getElementById('pref-role');
    
    if (elUser) elUser.innerText = user.name;
    if (elRole) elRole.innerText = user.role.toUpperCase();

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

    if (user.role === 'admin') {
        const panel = document.getElementById('admin-user-manager');
        if (panel) {
            panel.classList.remove('d-none');
            loadUsersList();
            setupUserForm();
        }
    }

    const ts = document.getElementById('pref-theme');
    if (ts) {
        ts.checked = localStorage.getItem('theme') === 'dark';
        ts.addEventListener('change', toggleTheme);
    }
}

// LISTAR USUÁRIOS (Botão Editar Restaurado)
async function loadUsersList() {
    const tbody = document.getElementById('users-table-body');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';
    
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        tbody.innerHTML = '';
        
        users.forEach(u => {
            const avatar = u.avatar 
                ? `<img src="${u.avatar}" class="rounded-circle border" width="35" height="35" style="object-fit:cover;">` 
                : `<i class="material-icons text-secondary fs-4">account_circle</i>`;
            
            // Cria a linha da tabela programaticamente para facilitar o evento de click
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${avatar}</td>
                <td class="fw-bold">${u.username}</td>
                <td><span class="badge ${u.role === 'admin' ? 'bg-danger' : 'bg-secondary'}">${u.role}</span></td>
                <td class="text-end">
                    <button class="btn btn-sm btn-link text-primary btn-edit" title="Editar"><i class="material-icons">edit</i></button>
                    <button class="btn btn-sm btn-link text-danger btn-del" title="Excluir"><i class="material-icons">delete</i></button>
                </td>
            `;
            
            // Adiciona a lógica de clique no botão EDITAR
            tr.querySelector('.btn-edit').addEventListener('click', () => editUser(u));
            // Adiciona a lógica de clique no botão EXCLUIR
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

    if(fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if(file) {
                const r = new FileReader();
                r.onload = (e) => { 
                    avatarBase64 = e.target.result;
                    document.getElementById('form-avatar-preview').src = avatarBase64;
                    document.getElementById('form-avatar-preview').style.display='inline-block';
                    document.getElementById('form-avatar-icon').style.display='none';
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

        await fetch(url, { method: method, headers:{'Content-Type':'application/json'}, body: JSON.stringify(body)});
        
        // Atualiza a própria sessão se necessário
        const cur = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
        if(cur.username === u) {
            if(avatarBase64) cur.avatar = avatarBase64;
            cur.role = r;
            sessionStorage.setItem('pizzaUserUI', JSON.stringify(cur));
            updateNavbarAvatar();
            initPreferencesLogic();
        }
        
        resetUserForm();
        loadUsersList();
    };
}

// FUNÇÃO DE EDITAR (Preenche e rola a tela)
window.editUser = function(u) {
    avatarBase64 = null;
    
    // Preenche campos
    const inputUser = document.getElementById('form-username');
    inputUser.value = u.username;
    inputUser.disabled = true; // Trava edição do ID
    
    document.getElementById('form-role').value = u.role;
    document.getElementById('form-password').value = '';
    document.getElementById('form-password').placeholder = '(Opcional para manter)';
    
    // Preview da foto
    const preview = document.getElementById('form-avatar-preview');
    const icon = document.getElementById('form-avatar-icon');
    
    if(u.avatar) { 
        preview.src = u.avatar; 
        preview.style.display='inline-block'; 
        icon.style.display='none'; 
    } else { 
        preview.style.display='none'; 
        icon.style.display='inline-block'; 
    }
    
    // Rola suavemente até o formulário
    document.getElementById('user-form').scrollIntoView({behavior: "smooth", block: "center"});
}

window.resetUserForm = () => { 
    document.getElementById('user-form').reset(); 
    avatarBase64=null; 
    document.getElementById('form-username').disabled = false;
    document.getElementById('form-password').placeholder = 'Senha';
    document.getElementById('form-avatar-preview').style.display='none'; 
    document.getElementById('form-avatar-icon').style.display='inline-block'; 
};

window.deleteUser = async (u) => { 
    if(confirm(`Remover "${u}"?`)) { 
        await fetch(`/api/users/${u}`, {method:'DELETE'}); 
        loadUsersList(); 
    }
};

// ======================================================
// 4. UTILITÁRIOS GERAIS
// ======================================================
function updateNavbarAvatar() {
    const user = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
    if(!user) return;
    
    document.getElementById('nav-username-display').innerText = user.name;
    document.getElementById('nav-role-display').innerText = user.role.toUpperCase();

    const src = user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=d32f2f&color=fff`;
    
    const navImg = document.getElementById('nav-user-avatar');
    const navIcon = document.getElementById('nav-user-icon');
    
    if(navImg && navIcon) {
        if(user.avatar) { navImg.src=user.avatar; navImg.style.display='block'; navIcon.style.display='none'; }
        else { navImg.style.display='none'; navIcon.style.display='block'; }
    }
}

window.logout = async function() {
    try { await fetch('/api/logout', {method:'POST'}); } catch(e){}
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
    const user = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
    if(user && user.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.add('d-none'));
    }
}

// Rede
function detectSystemInfo() {
    const el = document.getElementById('net-os');
    if(!el) return;
    let os = "OS Desconhecido";
    if (navigator.appVersion.indexOf("Win")!=-1) os="Windows";
    if (navigator.appVersion.indexOf("Mac")!=-1) os="MacOS";
    if (navigator.appVersion.indexOf("Linux")!=-1) os="Linux";
    el.innerText = os;
}

function initNetworkMonitor() {
    const pingEl = document.getElementById('real-ping');
    setInterval(async () => {
        const start = Date.now();
        try { await fetch(window.location.href, { method: 'HEAD' }); pingEl.innerText = `${Date.now() - start}ms`; }
        catch (e) { pingEl.innerText = "--"; }
    }, 3000);
}

async function fetchPublicIPInfo() {
    try { const r = await fetch('https://api.ipify.org?format=json'); const d=await r.json(); document.getElementById('real-ip').innerText=d.ip; }
    catch(e) { document.getElementById('real-ip').innerText="Local"; }
}

function setupContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    document.addEventListener('contextmenu', e => {
        e.preventDefault();
        menu.style.top = `${e.clientY}px`;
        menu.style.left = `${e.clientX}px`;
        menu.style.display = 'block';
    });
    document.addEventListener('click', () => menu.style.display = 'none');
}

function startClock() { setInterval(() => document.getElementById('clock').innerText = new Date().toLocaleTimeString(), 1000); }