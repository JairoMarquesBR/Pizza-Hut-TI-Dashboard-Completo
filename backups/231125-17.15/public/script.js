// ======================================================
// 0. VERIFICAÇÃO DE SEGURANÇA (UI)
// ======================================================
(function securityCheck() {
    const isLoginPage = window.location.pathname.includes('login.html');
    if (!isLoginPage && !sessionStorage.getItem('pizzaUserUI')) {
        window.location.href = 'login.html';
    }
})();

document.addEventListener('DOMContentLoaded', function() {
    if(window.location.pathname.includes('login.html')) return;

    // Inicializações Materialize
    M.Sidenav.init(document.querySelectorAll('.sidenav'));
    M.Dropdown.init(document.querySelectorAll('.dropdown-trigger'), {
        coverTrigger: false, constrainWidth: false, alignment: 'left'
    });
    
    var modalElem = document.querySelector('#main-modal');
    var modalInstance = M.Modal.init(modalElem, {
        startingTop: '4%', endingTop: '5%'
    });

    setupModalTriggers(modalInstance);
    startClock();
    fetchRealData(); 
    checkThemePreference();
    applyAccessControl();
});

// ======================================================
// 1. CONTROLE DE ACESSO E LOGOUT
// ======================================================

function getCurrentUser() {
    const session = sessionStorage.getItem('pizzaUserUI');
    return session ? JSON.parse(session) : null;
}

function applyAccessControl() {
    const user = getCurrentUser();
    if (!user) return;
    if (user.role !== 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none'; 
        });
    }
}

window.logout = async function() {
    try {
        await fetch('/api/logout', { method: 'POST' });
    } catch (e) {
        console.error("Erro logout", e);
    } finally {
        sessionStorage.clear();
        window.location.href = 'login.html';
    }
}

// ======================================================
// 2. BUSCA DE DADOS
// ======================================================

function fetchRealData() {
    const updateUI = async () => {
        try {
            const response = await fetch('/api/dashboard-data');
            if (response.status === 401 || response.status === 403) {
                window.logout();
                return;
            }
            const data = await response.json();
            const deviceEl = document.getElementById('device-count');
            if(deviceEl) deviceEl.textContent = data.devices;
            const clientEl = document.getElementById('client-count');
            if(clientEl) {
                if (clientEl.textContent != data.clients) {
                    clientEl.textContent = data.clients;
                    clientEl.closest('.status-indicator')?.classList.add('pulse-effect');
                    setTimeout(() => clientEl.closest('.status-indicator')?.classList.remove('pulse-effect'), 500);
                }
            }
        } catch (error) { console.error(error); }
    };
    updateUI();
    setInterval(updateUI, 5000);
}

// ======================================================
// 3. MODAIS
// ======================================================

function setupModalTriggers(modalInstance) {
    const triggers = document.querySelectorAll('.action-trigger');
    triggers.forEach(trigger => {
        trigger.addEventListener('click', function(e) {
            e.preventDefault(); 
            const title = this.getAttribute('data-title') || 'Detalhes';
            const fileName = this.getAttribute('data-file') || 'modal-default.html';
            openDynamicModal(modalInstance, title, fileName);
        });
    });
}

async function openDynamicModal(instance, title, fileUrl) {
    document.getElementById('modal-title').innerText = title;
    instance.open();
    const contentContainer = document.getElementById('modal-body-placeholder');
    
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) throw new Error(`Arquivo não encontrado`);
        
        await new Promise(r => setTimeout(r, 200)); 
        const htmlContent = await response.text();
        contentContainer.innerHTML = htmlContent;

        // Reinicializações Seguras
        M.updateTextFields();
        
        // Verifica textareas antes de resize
        const textareas = document.querySelectorAll('.materialize-textarea');
        if (textareas.length > 0) textareas.forEach(t => M.textareaAutoResize(t));
        
        M.Datepicker.init(document.querySelectorAll('.datepicker'), { autoClose: true, format: 'dd/mm/yyyy', container: document.body });
        M.FormSelect.init(document.querySelectorAll('select'));
        M.Tooltip.init(document.querySelectorAll('.tooltipped'));

        if (fileUrl.includes('preferences')) initPreferencesLogic();

    } catch (error) {
        contentContainer.innerHTML = `<div class="center-align red-text" style="padding:40px;"><p>Erro ao carregar módulo.</p></div>`;
    }
}

// ======================================================
// 4. LÓGICA DE PREFERÊNCIAS
// ======================================================

function initPreferencesLogic() {
    const user = getCurrentUser();
    if (!user) return;

    document.getElementById('pref-username').innerText = user.name;
    document.getElementById('pref-role').innerText = user.role.toUpperCase();

    // Se for ADMIN, carrega gestão
    if (user.role === 'admin') {
        const adminPanel = document.getElementById('admin-user-manager');
        if (adminPanel) {
            adminPanel.style.display = 'block'; 
            loadUsersList(); 
            setupUserForm(); 
        }
    }

    // Theme Switch
    const isDark = localStorage.getItem('theme') === 'dark';
    const themeSwitch = document.getElementById('pref-theme');
    if(themeSwitch) {
        themeSwitch.checked = isDark;
        themeSwitch.addEventListener('change', toggleTheme);
    }
}

// Funções de Admin (Listar, Criar, Deletar)
async function loadUsersList() {
    const tbody = document.getElementById('users-table-body');
    tbody.innerHTML = '<tr><td colspan="3" class="center">Carregando...</td></tr>';
    try {
        const response = await fetch('/api/users');
        const users = await response.json();
        tbody.innerHTML = ''; 
        users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:bold;">${u.username}</td>
                <td><span class="new badge ${u.role === 'admin' ? 'red' : 'grey'}" data-badge-caption="">${u.role}</span></td>
                <td class="right-align">
                    <button class="btn-small btn-flat red-text" onclick="deleteUser('${u.username}')"><i class="material-icons">delete</i></button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) { tbody.innerHTML = '<tr><td colspan="3" class="red-text center">Erro ao carregar.</td></tr>'; }
}

function setupUserForm() {
    const form = document.getElementById('user-form');
    M.FormSelect.init(document.querySelectorAll('select'));
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('form-username').value;
        const password = document.getElementById('form-password').value;
        const role = document.getElementById('form-role').value;
        try {
            const response = await fetch('/api/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, role })
            });
            if (response.ok) {
                M.toast({html: 'Salvo!', classes: 'green'});
                resetUserForm();
                loadUsersList();
            } else {
                const res = await response.json();
                M.toast({html: res.message, classes: 'red'});
            }
        } catch (error) { M.toast({html: 'Erro.', classes: 'red'}); }
    });
}

window.deleteUser = async function(username) {
    if(!confirm(`Remover "${username}"?`)) return;
    try {
        const response = await fetch(`/api/users/${username}`, { method: 'DELETE' });
        if (response.ok) { M.toast({html: 'Removido.', classes: 'green'}); loadUsersList(); }
    } catch (error) { console.error(error); }
};

window.resetUserForm = function() {
    document.getElementById('user-form').reset();
    M.updateTextFields();
};

// ======================================================
// 5. UTILITÁRIOS
// ======================================================

function startClock() {
    setInterval(() => {
        const el = document.getElementById('clock');
        if(el) el.textContent = new Date().toLocaleTimeString('pt-BR');
    }, 1000);
}

function toggleTheme() {
    const body = document.body;
    const icon = document.getElementById('theme-icon');
    body.classList.toggle('dark-theme');
    const isDark = body.classList.contains('dark-theme');
    if (icon) icon.textContent = isDark ? 'brightness_7' : 'brightness_4';
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function checkThemePreference() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        const icon = document.getElementById('theme-icon');
        if(icon) icon.textContent = 'brightness_7';
    }
}