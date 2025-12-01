document.addEventListener('DOMContentLoaded', () => {
    // Inicializa o tema correto
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    
    // Inicializa as abas
    loadUsersList();
    setupUserForm();
    loadStoreConfig();
    setupStoreForm();
});

// Variável global para foto
let avatarBase64 = null;

// --- NAVEGAÇÃO ENTRE ABAS ---
window.switchTab = function(tabName, btn) {
    // Remove classe ativa de todos os botões
    document.querySelectorAll('.list-group-item').forEach(el => {
        el.classList.remove('active', 'bg-pizza-red', 'border-0');
    });
    
    // Adiciona ao clicado
    btn.classList.add('active', 'bg-pizza-red', 'border-0');
    
    // Esconde todas as seções
    document.getElementById('section-users').classList.add('d-none');
    document.getElementById('section-store').classList.add('d-none');
    
    // Mostra a desejada
    document.getElementById(`section-${tabName}`).classList.remove('d-none');
};

// ======================================================
// 1. CONFIGURAÇÃO DA LOJA
// ======================================================
async function loadStoreConfig() {
    try {
        const res = await fetch('/api/store/config');
        const data = await res.json();
        
        if (data) {
            // Preenche os campos se existirem dados
            if(document.getElementById('st-franchise')) document.getElementById('st-franchise').value = data.franchise_name || '';
            if(document.getElementById('st-branch')) document.getElementById('st-branch').value = data.branch_name || '';
            if(document.getElementById('st-cnpj')) document.getElementById('st-cnpj').value = data.cnpj || '';
            if(document.getElementById('st-address')) document.getElementById('st-address').value = data.address || '';
            if(document.getElementById('st-phone')) document.getElementById('st-phone').value = data.phone || '';
            if(document.getElementById('st-manager')) document.getElementById('st-manager').value = data.manager_name || '';
            if(document.getElementById('st-wifi')) document.getElementById('st-wifi').value = data.wifi_ssid || '';
            if(document.getElementById('st-pass')) document.getElementById('st-pass').value = data.wifi_pass || '';
            if(document.getElementById('st-ip')) document.getElementById('st-ip').value = data.server_ip || '';
            
            // Campo Novo
            if(document.getElementById('st-email')) document.getElementById('st-email').value = data.support_email || '';
        }
    } catch(e) { console.error("Erro ao carregar loja", e); }
}

function setupStoreForm() {
    const form = document.getElementById('store-form');
    if(!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Efeito visual no botão
        const btn = form.querySelector('button[type="submit"]');
        const oldText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Salvando...';

        const body = {
            franchise_name: document.getElementById('st-franchise').value,
            branch_name: document.getElementById('st-branch').value,
            cnpj: document.getElementById('st-cnpj').value,
            address: document.getElementById('st-address').value,
            phone: document.getElementById('st-phone').value,
            manager_name: document.getElementById('st-manager').value,
            wifi_ssid: document.getElementById('st-wifi').value,
            wifi_pass: document.getElementById('st-pass').value,
            server_ip: document.getElementById('st-ip').value,
            support_email: document.getElementById('st-email').value
        };

        try {
            const res = await fetch('/api/store/config', {
                method: 'POST', 
                headers: {'Content-Type':'application/json'}, 
                body: JSON.stringify(body)
            });
            
            if(res.ok) {
                alert("Configurações salvas com sucesso!");
            } else {
                alert("Erro ao salvar configurações.");
            }
        } catch(e) { 
            alert("Erro de conexão."); 
        } finally {
            btn.disabled = false;
            btn.innerHTML = oldText;
        }
    });
}

// ======================================================
// 2. GESTÃO DE USUÁRIOS (CRUD COMPLETO)
// ======================================================

// Carregar Lista
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
                    <button class="btn btn-sm btn-link text-primary btn-edit" title="Editar">
                        <i class="material-icons">edit</i>
                    </button>
                    <button class="btn btn-sm btn-link text-danger btn-del" title="Excluir">
                        <i class="material-icons">delete</i>
                    </button>
                </td>
            `;
            
            // Adiciona eventos aos botões
            tr.querySelector('.btn-edit').addEventListener('click', () => editUser(u));
            tr.querySelector('.btn-del').addEventListener('click', () => deleteUser(u.username));
            
            tbody.appendChild(tr);
        });
    } catch(e){
        tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar.</td></tr>';
    }
}

// Configurar Formulário e Foto
function setupUserForm() {
    const fileInput = document.getElementById('form-file');
    
    // Preview de Imagem
    if(fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if(file) {
                if (file.size > 2097152) { // 2MB limit
                    alert("Imagem muito grande. Max 2MB");
                    this.value = '';
                    return;
                }
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
    
    // Submit (Criar ou Editar)
    const form = document.getElementById('user-form');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const u = document.getElementById('form-username').value;
            const p = document.getElementById('form-password').value;
            const r = document.getElementById('form-role').value;
            
            // Se o campo username estiver travado, é edição
            const isEdit = document.getElementById('form-username').disabled;
            const method = isEdit ? 'PUT' : 'POST';
            const url = isEdit ? `/api/users/${u}` : '/api/users';

            const body = { username: u, password: p, role: r };
            if(avatarBase64) body.avatar = avatarBase64;

            try {
                const res = await fetch(url, {
                    method: method, 
                    headers:{'Content-Type':'application/json'}, 
                    body:JSON.stringify(body)
                });

                if (res.ok) {
                    alert(isEdit ? "Usuário Atualizado!" : "Usuário Criado!");
                    
                    // Se atualizou o próprio usuário logado, atualiza sessão
                    const current = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
                    if(current.username === u) {
                        if(avatarBase64) current.avatar = avatarBase64;
                        current.role = r;
                        sessionStorage.setItem('pizzaUserUI', JSON.stringify(current));
                    }

                    resetUserForm();
                    loadUsersList();
                } else {
                    alert("Erro ao salvar.");
                }
            } catch (e) { alert("Erro de conexão."); }
        });
    }
}

// Função Editar (Preenche formulário)
window.editUser = function(u) {
    avatarBase64 = null;
    
    const inputUser = document.getElementById('form-username');
    inputUser.value = u.username;
    inputUser.disabled = true; // Trava edição do login (ID)
    
    document.getElementById('form-role').value = u.role;
    document.getElementById('form-password').value = '';
    document.getElementById('form-password').placeholder = '(Deixe vazio para manter)';
    
    // Preview
    const p = document.getElementById('form-avatar-preview');
    const i = document.getElementById('form-avatar-icon');
    if(u.avatar && p) { 
        p.src = u.avatar; p.style.display='inline-block'; i.style.display='none'; 
    } else if(p) { 
        p.style.display='none'; i.style.display='inline-block'; 
    }
    
    // Rola para o topo suavemente
    document.querySelector('main').scrollTo({ top: 0, behavior: 'smooth' });
}

// Função Excluir
window.deleteUser = async function(u) {
    if(!confirm(`Tem certeza que deseja excluir "${u}"?`)) return;
    try {
        const res = await fetch(`/api/users/${u}`, { method: 'DELETE' });
        if(res.ok) loadUsersList();
        else alert("Erro ao excluir.");
    } catch(e) { console.error(e); }
}

// Função Resetar Form
window.resetUserForm = function() {
    const form = document.getElementById('user-form');
    if(form) form.reset();
    
    avatarBase64 = null;
    document.getElementById('form-username').disabled = false;
    document.getElementById('form-password').placeholder = 'Senha';
    
    const p = document.getElementById('form-avatar-preview');
    const i = document.getElementById('form-avatar-icon');
    if(p) p.style.display='none';
    if(i) i.style.display='inline-block';
}

// Utils
window.toggleTheme = () => {
    const h = document.documentElement;
    const n = h.getAttribute('data-bs-theme')==='dark'?'light':'dark';
    h.setAttribute('data-bs-theme',n);
    localStorage.setItem('theme',n);
}