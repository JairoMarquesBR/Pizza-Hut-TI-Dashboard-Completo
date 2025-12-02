(function() {
    console.log(">>> MÓDULO ESTOQUE (FINAL) INICIADO <<<");

    // Variáveis de Estado
    let allLogsCache = [];
    
    // Cache Global Persistente (localStorage)
    const STORAGE_KEY = 'pizzanet_inventory_draft';
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        window.inventoryCache = saved ? JSON.parse(saved) : {};
    } catch(e) { window.inventoryCache = {}; }

    // ======================================================
    // 1. INICIALIZAÇÃO
    // ======================================================
    setTimeout(() => {
        // Carrega a lista inicial (Diária)
        loadCountList(); 
        
        // Verifica Permissões
        const user = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
        if(user && user.role === 'admin') {
            loadAdminProducts();
            loadReports(); 
        } else {
            // Remove elementos de admin se for caixa
            document.querySelectorAll('.admin-only').forEach(el => el.remove());
        }
    }, 200);

    // ======================================================
    // 2. CACHE DE INPUTS (Memória + Disco)
    // ======================================================
    window.updateCache = function(id, field, value) {
        if (!window.inventoryCache[id]) {
            window.inventoryCache[id] = { qty: '', is_out: false };
        }
        
        if (field === 'qty') window.inventoryCache[id].qty = value;
        if (field === 'is_out') window.inventoryCache[id].is_out = value;
        
        // Salva no navegador
        localStorage.setItem(STORAGE_KEY, JSON.stringify(window.inventoryCache));
        
        // Sincroniza visualmente se houver duplicatas no DOM
        const inputs = document.querySelectorAll(`[data-sync-id="${id}"]`);
        inputs.forEach(input => {
            if (field === 'qty' && input.type === 'number' && input.value !== value) input.value = value;
            if (field === 'is_out' && input.type === 'checkbox') input.checked = value;
        });
    };

    // ======================================================
    // 3. CONTAGEM (CAIXA)
    // ======================================================
    window.loadCountList = async function() {
        const catEl = document.querySelector('input[name="catFilter"]:checked');
        const cat = catEl ? catEl.value : 'diaria';
        
        const tbody = document.getElementById('count-list-body');
        if(!tbody) return;

        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4"><div class="spinner-border text-danger"></div></td></tr>';

        try {
            const res = await fetch(`/api/inventory/products?category=${cat}`);
            const products = await res.json();
            tbody.innerHTML = '';

            if(products.length === 0) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Lista vazia. Cadastre produtos na aba Admin.</td></tr>';
                return;
            }

            products.forEach(p => {
                // Recupera do Cache (Prioridade) ou do Banco
                let val = window.inventoryCache[p.id]?.qty || '';
                let chk = window.inventoryCache[p.id]?.is_out ? 'checked' : (p.is_out_of_stock ? 'checked' : '');
                
                const isCrit = p.current_qty <= p.min_threshold;
                const style = isCrit ? 'text-danger fw-bold' : '';
                const icon = isCrit ? '<i class="material-icons align-middle fs-6 text-danger">warning</i>' : '';

                const tr = document.createElement('tr');
                // Metadados para envio
                tr.dataset.id = p.id; 
                tr.dataset.name = p.name; 
                tr.dataset.unit = p.unit; 
                tr.dataset.min = p.min_threshold;
                tr.dataset.cat = cat;

                tr.innerHTML = `
                    <td class="ps-4">
                        <span class="fw-bold text-uppercase">${p.name}</span>
                    </td>
                    <td class="${style}">
                        ${icon} ${p.current_qty} <small class="text-muted">${p.unit}</small>
                    </td>
                    <td>
                        <input type="number" class="form-control form-control-sm count-input" 
                               step="0.01" placeholder="Qtd" value="${val}" 
                               data-sync-id="${p.id}"
                               oninput="updateCache(${p.id}, 'qty', this.value)">
                    </td>
                    <td class="text-center pe-4">
                        <div class="form-check d-flex justify-content-center">
                            <input class="form-check-input out-stock-check" type="checkbox" ${chk} 
                                   data-sync-id="${p.id}"
                                   onchange="updateCache(${p.id}, 'is_out', this.checked)">
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) { 
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro de conexão.</td></tr>'; 
        }
    };

    window.submitCount = async function() {
        const items = [];
        const cat = document.querySelector('input[name="catFilter"]:checked').value;

        // Pega da tabela visível
        const rows = document.querySelectorAll('#count-list-body tr');
        
        rows.forEach(r => {
            const id = r.dataset.id;
            const inputVal = r.querySelector('.count-input').value;
            const isChecked = r.querySelector('.out-stock-check').checked;

            if(inputVal !== '' || isChecked) {
                const qty = isChecked ? 0 : (parseFloat(inputVal) || 0);
                const min = parseFloat(r.dataset.min) || 0;

                items.push({
                    id: id,
                    name: r.dataset.name,
                    unit: r.dataset.unit,
                    is_critical: qty <= min,
                    qty: qty,
                    is_out: isChecked,
                    category: cat
                });
            }
        });

        if(items.length === 0) return alert("Preencha a quantidade de pelo menos um item.");
        if(!confirm(`Enviar contagem de ${items.length} itens?`)) return;

        try {
            const res = await fetch('/api/inventory/count', { 
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body: JSON.stringify({items}) 
            });
            
            if(res.ok) {
                if(window.showToast) window.showToast("Estoque atualizado!", "success");
                else alert("✅ Salvo!");

                // Limpa do cache os itens enviados
                items.forEach(i => delete window.inventoryCache[i.id]);
                localStorage.setItem(STORAGE_KEY, JSON.stringify(window.inventoryCache));
                
                loadCountList(); 
            } else {
                alert("Erro ao salvar.");
            }
        } catch(e) { alert("Erro de conexão."); }
    };

    // ======================================================
    // 4. ADMIN: PRODUTOS (CADASTRAR/EDITAR)
    // ======================================================
    
    // Função chamada pelo onsubmit do HTML
    window.handleProductSubmit = async function(event) {
        event.preventDefault();
        
        const id = document.getElementById('prod-id').value;
        const name = document.getElementById('prod-name').value;
        const unit = document.getElementById('prod-unit').value;
        const cat = document.getElementById('prod-cat').value;
        const min = document.getElementById('prod-min').value;

        if(!name) return alert("Nome é obrigatório");

        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/inventory/products/${id}` : '/api/inventory/products';
        
        const body = { name, unit, category: cat, min_threshold: min };

        try {
            const res = await fetch(url, {
                method: method,
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(body)
            });

            const data = await res.json();

            if(res.ok) {
                if(window.showToast) window.showToast(id ? "Produto Atualizado!" : "Produtos Cadastrados!", "success");
                else alert(id ? "Atualizado!" : "Cadastrado!");
                
                resetProdForm();
                loadAdminProducts();
                loadCountList(); // Atualiza lista do caixa
            } else {
                alert("Erro: " + data.message);
            }
        } catch(e) { console.error(e); alert("Erro de conexão."); }
    };

    window.loadAdminProducts = async function() {
        const tbody = document.getElementById('admin-prod-list');
        if(!tbody) return;
        
        try {
            const res = await fetch(`/api/inventory/products?category=all`);
            const prods = await res.json();
            tbody.innerHTML = '';
            
            if(prods.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center p-3">Nenhum produto cadastrado.</td></tr>';
                return;
            }

            prods.forEach(p => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="fw-bold ps-4">${p.name}</td>
                    <td><span class="badge bg-secondary text-uppercase">${p.category}</span></td>
                    <td>${p.current_qty} ${p.unit}</td>
                    <td>${p.min_threshold}</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-link text-primary p-0 me-2" onclick="editProd(${p.id}, '${p.name}', '${p.unit}', '${p.category}', ${p.min_threshold})"><i class="material-icons">edit</i></button>
                        <button class="btn btn-sm btn-link text-danger p-0" onclick="deleteProd(${p.id})"><i class="material-icons">delete</i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) {}
    };

    window.editProd = function(id, name, unit, cat, min) {
        document.getElementById('prod-id').value = id;
        document.getElementById('prod-name').value = name;
        document.getElementById('prod-unit').value = unit;
        document.getElementById('prod-cat').value = cat;
        document.getElementById('prod-min').value = min;
        
        // Muda visualmente para a aba de produtos
        const tabTrigger = document.querySelector('#manage-tab');
        if(tabTrigger) {
            const tab = new bootstrap.Tab(tabTrigger);
            tab.show();
        }
        document.getElementById('prod-name').focus();
    };

    window.resetProdForm = function() {
        document.getElementById('product-form').reset();
        document.getElementById('prod-id').value = '';
    };

    window.deleteProd = async function(id) {
        if(confirm("Excluir produto permanentemente?")) {
            await fetch(`/api/inventory/products/${id}`, { method: 'DELETE' });
            loadAdminProducts();
            loadCountList();
        }
    };

    // ======================================================
    // 5. ADMIN: RELATÓRIOS E PDF
    // ======================================================
    window.loadReports = async function() {
        const tbody = document.getElementById('reports-list-body');
        if(!tbody) return;
        
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando...</td></tr>';

        try {
            const res = await fetch('/api/inventory/logs');
            allLogsCache = await res.json();
            
            const sessions = {};
            allLogsCache.forEach(l => {
                const id = l.session_id || `legacy_${l.count_date}_${l.count_time}`;
                if(!sessions[id]) {
                    sessions[id] = {
                        id: id,
                        date: l.count_date,
                        time: l.count_time,
                        user: l.counted_by,
                        cat: l.category_context,
                        count: 0
                    };
                }
                sessions[id].count++;
            });

            tbody.innerHTML = '';
            
            if(Object.keys(sessions).length === 0) {
                tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Nenhum histórico disponível.</td></tr>';
                return;
            }

            Object.values(sessions).reverse().forEach(s => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="ps-4">${s.date}</td>
                    <td>${s.time}</td>
                    <td>${s.user}</td>
                    <td><span class="badge bg-light text-dark border text-uppercase">${s.cat}</span></td>
                    <td>${s.count} itens</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-danger rounded-pill me-1" onclick="exportSessionPDF('${s.id}')"><i class="material-icons align-middle fs-6 me-1">picture_as_pdf</i></button>
                        <button class="btn btn-sm btn-outline-secondary rounded-circle" onclick="deleteSession('${s.id}')"><i class="material-icons fs-6">delete</i></button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } catch(e) { console.error(e); }
    };

    window.deleteSession = async function(sid) {
        if(!confirm("Tem certeza que deseja apagar este relatório?")) return;
        try {
            const res = await fetch(`/api/inventory/logs/${sid}`, { method: 'DELETE' });
            if (res.ok) {
                if(window.showToast) window.showToast("Histórico removido.", "success");
                loadReports();
            } else {
                alert("Erro ao remover.");
            }
        } catch(e) { console.error(e); }
    };

    window.exportSessionPDF = function(sid) {
        if (!window.jspdf) return alert("Erro: Biblioteca PDF não carregada.");
        
        let items = allLogsCache.filter(l => l.session_id === sid);
        
        // Fallback para legado
        if(items.length === 0) {
             const parts = sid.split('_'); 
             if(parts.length > 1) {
                items = allLogsCache.filter(l => l.count_date === parts[1] && l.count_time === parts[2]);
             }
        }

        if (items.length === 0) return alert("Sessão vazia.");

        const m = items[0];
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        doc.setFillColor(211, 47, 47); doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.text("RELATÓRIO DE CONTAGEM", 14, 16);
        doc.setFontSize(10); doc.text(`Pizza Hut TI | ${m.category_context ? m.category_context.toUpperCase() : 'GERAL'}`, 14, 22);
        
        doc.setTextColor(0, 0, 0); 
        doc.text(`Data: ${m.count_date} às ${m.count_time}`, 14, 35);
        doc.text(`Responsável: ${m.counted_by}`, 14, 40);
        doc.text(`ID Sessão: ${sid}`, 14, 45);

        const body = items.map(l => [
            l.product_name, 
            l.qty_counted, 
            l.product_unit, 
            l.is_critical ? 'CRÍTICO' : 'OK'
        ]);
        
        doc.autoTable({ 
            startY: 50, 
            head: [['Produto', 'Qtd', 'Un', 'Status']], 
            body: body, 
            theme: 'striped', 
            headStyles:{fillColor:[211,47,47]},
            didParseCell: function(data) {
                if (data.section === 'body' && data.column.index === 3) {
                    if (data.cell.raw === 'CRÍTICO') data.cell.styles.textColor = [220, 53, 69];
                    else data.cell.styles.textColor = [25, 135, 84];
                }
            }
        });

        doc.save(`Estoque_${sid}.pdf`);
    };
})();