// ======================================================
// 0. SEGURANÇA E GLOBAIS
// ======================================================
(function securityCheck() {
    const isLoginPage = window.location.pathname.includes('login.html');
    if (!isLoginPage && !sessionStorage.getItem('pizzaUserUI')) {
        window.location.href = 'login.html';
    }
})();

let avatarBase64 = null;

document.addEventListener('DOMContentLoaded', function() {
    if(window.location.pathname.includes('login.html')) return;

    M.Sidenav.init(document.querySelectorAll('.sidenav'));
    M.Dropdown.init(document.querySelectorAll('.dropdown-trigger'), {
        coverTrigger: false, constrainWidth: false, alignment: 'left'
    });
    M.Tooltip.init(document.querySelectorAll('.tooltipped'));
    
    var modalElem = document.querySelector('#main-modal');
    var modalInstance = M.Modal.init(modalElem, {
        startingTop: '4%', endingTop: '5%', dismissible: true
    });

    setupModalTriggers(modalInstance);
    setupContextMenu();
    startClock();
    initRealtimeNetworkMonitor();
    fetchPublicIPInfo();
    detectSystemInfo();
    fetchDashboardData();
    updateNavbarAvatar();
    checkThemePreference();
    applyAccessControl();
});

// ======================================================
// 1. LÓGICA DE REDE E SISTEMA
// ======================================================
function detectSystemInfo() {
    const osEl = document.getElementById('net-os');
    if(!osEl) return;
    let os = "Desconhecido";
    if (navigator.appVersion.indexOf("Win") != -1) os = "Windows";
    if (navigator.appVersion.indexOf("Mac") != -1) os = "MacOS";
    if (navigator.appVersion.indexOf("Linux") != -1) os = "Linux";
    if (navigator.appVersion.indexOf("Android") != -1) os = "Android";
    osEl.innerText = os;
}

async function fetchPublicIPInfo() {
    const ipEl = document.getElementById('net-ip');
    const ispEl = document.getElementById('net-isp');
    try {
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        if(ipEl) ipEl.innerText = data.ip;
        if(ispEl) ispEl.innerText = `${data.org} (${data.city})`;
    } catch (error) {
        if(ipEl) ipEl.innerText = "Indisponível";
        if(ispEl) ispEl.innerText = "Rede Local";
    }
}

function initRealtimeNetworkMonitor() {
    const statusEl = document.getElementById('net-status');
    const iconEl = document.getElementById('net-icon');
    const pingEl = document.getElementById('net-ping');

    function updateStatus() {
        if (navigator.onLine) {
            statusEl.innerText = "ONLINE";
            statusEl.className = "green-text text-lighten-3";
            iconEl.className = "material-icons tiny green-text text-lighten-3";
        } else {
            statusEl.innerText = "OFFLINE";
            statusEl.className = "red-text";
            iconEl.className = "material-icons tiny red-text";
            if(pingEl) pingEl.innerText = "--";
        }
    }
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();

    setInterval(async () => {
        if (!navigator.onLine) return;
        const start = performance.now();
        try {
            await fetch(window.location.href, { method: 'HEAD' });
            const latency = Math.round(performance.now() - start);
            if(pingEl) pingEl.innerText = `${latency} ms`;
        } catch (e) { if(pingEl) pingEl.innerText = "Timeout"; }
    }, 2000);
}

// ======================================================
// 2. SISTEMA: AUTH, MODAL E CRUD
// ======================================================
function setupContextMenu() {
    const menu = document.getElementById('custom-context-menu');
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        let x = e.clientX, y = e.clientY;
        if (x + 200 > window.innerWidth) x = window.innerWidth - 210;
        if (y + 200 > window.innerHeight) y = window.innerHeight - 210;
        menu.style.top = `${y}px`;
        menu.style.left = `${x}px`;
        menu.style.display = 'block';
    });
    document.addEventListener('click', () => menu.style.display = 'none');
}

function getCurrentUser() {
    const session = sessionStorage.getItem('pizzaUserUI');
    return session ? JSON.parse(session) : null;
}

function applyAccessControl() {
    const user = getCurrentUser();
    if (user && user.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
    }
}

window.logout = async function() {
    try { await fetch('/api/logout', { method: 'POST' }); } catch (e) {} 
    finally { sessionStorage.clear(); window.location.href = 'login.html'; }
}

function updateNavbarAvatar() {
    const user = getCurrentUser();
    if (!user) return;
    const navImg = document.getElementById('nav-user-avatar');
    const navIcon = document.getElementById('nav-user-icon');
    const mobImg = document.getElementById('mobile-user-avatar');
    const mobName = document.getElementById('mobile-username');
    const src = user.avatar ? user.avatar : `https://ui-avatars.com/api/?name=${user.name}&background=d32f2f&color=fff`;

    if(navImg && navIcon) {
        navImg.src = user.avatar || src;
        navImg.style.display = user.avatar ? 'inline-block' : 'none';
        navIcon.style.display = user.avatar ? 'none' : 'inline-block';
    }
    if(mobImg) mobImg.src = src;
    if(mobName) mobName.innerText = user.name;
}

function fetchDashboardData() {
    const updateUI = async () => {
        try {
            const response = await fetch('/api/dashboard-data');
            if (response.status === 401) return window.logout();
            const data = await response.json();
            const el = document.getElementById('client-count');
            if(el && el.textContent != data.clients) {
                el.textContent = data.clients;
                el.closest('.status-indicator')?.classList.add('pulse-effect');
                setTimeout(() => el.closest('.status-indicator')?.classList.remove('pulse-effect'), 500);
            }
        } catch (error) {}
    };
    updateUI();
    setInterval(updateUI, 5000);
}

// --- MODAL LOGIC ---
function setupModalTriggers(modalInstance) {
    document.querySelectorAll('.action-trigger').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const title = this.getAttribute('data-title');
            const file = this.getAttribute('data-file') || 'modal-default.html';
            openDynamicModal(modalInstance, title, file);
        });
    });
}

async function openDynamicModal(instance, title, fileUrl) {
    document.getElementById('modal-title').innerText = title;
    instance.open();
    const content = document.getElementById('modal-body-placeholder');
    try {
        const res = await fetch(fileUrl);
        if(!res.ok) throw new Error();
        const html = await res.text();
        content.innerHTML = html;
        
        M.updateTextFields();
        const textareas = document.querySelectorAll('.materialize-textarea');
        if (textareas.length > 0) textareas.forEach(t => M.textareaAutoResize(t));
        M.Datepicker.init(document.querySelectorAll('.datepicker'), { autoClose: true, container: document.body });
        M.FormSelect.init(document.querySelectorAll('select'));
        
        if(fileUrl.includes('preferences')) initPreferencesLogic();
    } catch (e) { content.innerHTML = '<p class="red-text">Erro ao carregar.</p>'; }
}

// --- PREFERÊNCIAS E CRUD ---
function initPreferencesLogic() {
    const user = getCurrentUser();
    if (!user) return;
    document.getElementById('pref-username').innerText = user.name;
    document.getElementById('pref-role').innerText = user.role.toUpperCase();
    
    const heroImg = document.getElementById('hero-avatar-img');
    const heroIcon = document.getElementById('hero-avatar-icon');
    if(user.avatar && heroImg) {
        heroImg.src = user.avatar; heroImg.style.display = 'block'; heroIcon.style.display = 'none';
    }

    if (user.role === 'admin') {
        const panel = document.getElementById('admin-user-manager');
        if(panel) { panel.style.display = 'block'; loadUsersList(); setupUserForm(); }
    }
    
    const themeSwitch = document.getElementById('pref-theme');
    if(themeSwitch) {
        themeSwitch.checked = localStorage.getItem('theme') === 'dark';
        themeSwitch.addEventListener('change', toggleTheme);
    }
}

async function loadUsersList() {
    const tbody = document.getElementById('users-table-body');
    if(!tbody) return;
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        tbody.innerHTML = '';
        users.forEach(u => {
            const avatar = u.avatar ? `<img src="${u.avatar}" class="circle" style="width:30px;height:30px;object-fit:cover;">` : '<i class="material-icons">person</i>';
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${avatar}</td><td>${u.username}</td><td>${u.role}</td><td class="right-align"><button class="action-btn blue-text btn-edit"><i class="material-icons">edit</i></button><button class="action-btn red-text" onclick="deleteUser('${u.username}')"><i class="material-icons">delete</i></button></td>`;
            tr.querySelector('.btn-edit').addEventListener('click', () => editUser(u));
            tbody.appendChild(tr);
        });
    } catch(e) {}
}

function setupUserForm() {
    const form = document.getElementById('user-form');
    const fileInput = document.getElementById('form-file');
    if(!form) return;
    M.FormSelect.init(document.querySelectorAll('select'));

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

        await fetch(url, { method: method, headers: {'Content-Type':'application/json'}, body: JSON.stringify(body) });
        
        const current = getCurrentUser();
        if(current.username === u) {
            if(avatarBase64) current.avatar = avatarBase64;
            current.role = r;
            sessionStorage.setItem('pizzaUserUI', JSON.stringify(current));
            updateNavbarAvatar();
            initPreferencesLogic();
        }
        
        resetUserForm();
        loadUsersList();
        M.toast({html: 'Salvo!', classes: 'green'});
    };
}

// --- FUNÇÃO EDIT CORRIGIDA ---
window.editUser = function(u) {
    avatarBase64 = null;
    const userInput = document.getElementById('form-username');
    const passInput = document.getElementById('form-password');
    
    // Preenche valores
    userInput.value = u.username;
    userInput.disabled = true;
    document.getElementById('form-role').value = u.role;
    passInput.value = '';
    passInput.placeholder = '(Opcional)';
    
    // Força o label a subir (O segredo do bug)
    M.updateTextFields();
    
    // Se o label ainda não subiu, força manual
    if (passInput.nextElementSibling) {
        passInput.nextElementSibling.classList.add('active');
    }

    document.getElementById('form-title').innerText = `Edit: ${u.username}`;
    
    const preview = document.getElementById('form-avatar-preview');
    const icon = document.getElementById('form-avatar-icon');
    if(u.avatar) { preview.src = u.avatar; preview.style.display = 'inline-block'; icon.style.display = 'none'; }
    else { preview.style.display = 'none'; icon.style.display = 'inline-block'; }
    
    M.FormSelect.init(document.querySelectorAll('select'));
    userInput.scrollIntoView({behavior: "smooth"});
}

window.resetUserForm = function() {
    const form = document.getElementById('user-form');
    if(form) form.reset();
    avatarBase64 = null;
    document.getElementById('form-username').disabled = false;
    document.getElementById('form-password').placeholder = 'Senha';
    document.getElementById('form-title').innerText = 'Novo Usuário';
    document.getElementById('form-avatar-preview').style.display = 'none';
    document.getElementById('form-avatar-icon').style.display = 'inline-block';
    M.updateTextFields();
    M.FormSelect.init(document.querySelectorAll('select'));
};

function startClock() { setInterval(() => { document.getElementById('clock').textContent = new Date().toLocaleTimeString('pt-BR'); }, 1000); }
function toggleTheme() { document.body.classList.toggle('dark-theme'); localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light'); }
function checkThemePreference() { if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-theme'); }