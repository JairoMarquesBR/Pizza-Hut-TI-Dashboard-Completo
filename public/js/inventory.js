(function() {
    console.log("Inventory Module Loaded");
    let allLogsCache = [];

    // Cache de Digitação
    window.inventoryCache = window.inventoryCache || {};

    // Init
    setTimeout(() => {
        loadCountList(); 
        const user = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
        if(user && user.role === 'admin') {
            loadAdminProducts();
            loadReports(); 
            initProductForm();
        } else {
            document.querySelectorAll('.admin-only').forEach(el => el.remove());
        }
    }, 200);

    // Cache Helper
    window.updateCache = function(id, field, value) {
        if (!window.inventoryCache[id]) window.inventoryCache[id] = { qty: '', is_out: false };
        if (field === 'qty') window.inventoryCache[id].qty = value;
        if (field === 'is_out') window.inventoryCache[id].is_out = value;
    };

    // --- CAIXA ---
    window.loadCountList = async function() {
        const catEl = document.querySelector('input[name="catFilter"]:checked');
        const cat = catEl ? catEl.value : 'diaria';
        const tbody = document.getElementById('count-list-body');
        
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4"><div class="spinner-border text-danger"></div></td></tr>';

        try {
            const res = await fetch(`/api/inventory/products?category=${cat}`);
            const products = await res.json();
            tbody.innerHTML = '';

            if(!products.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">Lista vazia.</td></tr>';
                return;
            }

            products.forEach(p => {
                // Cache Priority
                let val = window.inventoryCache[p.id]?.qty || '';
                let chk = window.inventoryCache[p.id]?.is_out ? 'checked' : (p.is_out_of_stock ? 'checked' : '');
                
                const isCrit = p.current_qty <= p.min_threshold;
                const style = isCrit ? 'text-danger fw-bold' : '';

                const tr = document.createElement('tr');
                tr.dataset.id = p.id; tr.dataset.name = p.name; tr.dataset.unit = p.unit; tr.dataset.min = p.min_threshold;
                tr.dataset.cat = cat;

                tr.innerHTML = `
                    <td><span class="fw-bold text-uppercase">${p.name}</span></td>
                    <td class="${style}">${p.current_qty} <small class="text-muted">${p.unit}</small></td>
                    <td><input type="number" class="form-control form-control-sm count-input" step="0.01" placeholder="Qtd" value="${val}" oninput="updateCache(${p.id}, 'qty', this.value)"></td>
                    <td class="text-center"><input class="form-check-input out-stock-check" type="checkbox" ${chk} onchange="updateCache(${p.id}, 'is_out', this.checked)"></td>
                `;
                tbody.appendChild(tr);
            });
        } catch(e) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro ao carregar.</td></tr>'; }
    };

    window.submitCount = async function() {
        const rows = document.querySelectorAll('#count-list-body tr');
        const items = [];
        const cat = document.querySelector('input[name="catFilter"]:checked').value;

        rows.forEach(r => {
            const inp = r.querySelector('.count-input').value;
            const chk = r.querySelector('.out-stock-check').checked;
            if(inp !== '' || chk) {
                const qty = chk ? 0 : (parseFloat(inp)||0);
                const min = parseFloat(r.dataset.min) || 0;
                items.push({ 
                    id: r.dataset.id, name: r.dataset.name, unit: r.dataset.unit, 
                    is_critical: qty <= min, qty: qty, is_out: chk, category: cat 
                });
            }
        });

        if(!items.length) return showToast("Preencha ao menos um item.", "warning");
        if(!confirm("Enviar?")) return;

        try {
            const res = await fetch('/api/inventory/count', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({items}) });
            if(res.ok) {
                showToast("Estoque Atualizado!", "success");
                items.forEach(i => delete window.inventoryCache[i.id]); // Limpa cache enviado
                loadCountList();
            } else { showToast("Erro ao salvar.", "error"); }
        } catch(e) { showToast("Erro de conexão.", "error"); }
    };

    // --- ADMIN ---
    window.initProductForm = function() {
        const form = document.getElementById('product-form');
        if(!form) return;
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);

        newForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const body = {
                name: document.getElementById('prod-name').value,
                unit: document.getElementById('prod-unit').value,
                category: document.getElementById('prod-cat').value,
                min_threshold: document.getElementById('prod-min').value
            };
            const id = document.getElementById('prod-id').value;
            const url = id ? `/api/inventory/products/${id}` : '/api/inventory/products';
            const method = id ? 'PUT' : 'POST';
            
            try {
                await fetch(url, { method: method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
                showToast(id ? "Produto Atualizado!" : "Produto Criado!", "success");
                document.getElementById('product-form').reset();
                document.getElementById('prod-id').value = '';
                loadAdminProducts(); loadCountList();
            } catch(e) { showToast("Erro ao salvar.", "error"); }
        });
    };

    window.loadAdminProducts = async function() {
        const tbody = document.getElementById('admin-prod-list');
        if(!tbody) return;
        const res = await fetch(`/api/inventory/products?category=all`);
        const prods = await res.json();
        tbody.innerHTML = '';
        prods.forEach(p => {
            tbody.innerHTML += `<tr>
                <td class="fw-bold">${p.name}</td><td><span class="badge bg-secondary text-uppercase">${p.category}</span></td>
                <td>${p.current_qty} ${p.unit}</td><td>${p.min_threshold}</td>
                <td class="text-end"><button class="btn btn-sm btn-link text-primary p-0 me-2" onclick="editProd(${p.id}, '${p.name}', '${p.unit}', '${p.category}', ${p.min_threshold})"><i class="material-icons">edit</i></button><button class="btn btn-sm btn-link text-danger p-0" onclick="deleteProd(${p.id})"><i class="material-icons">delete</i></button></td>
            </tr>`;
        });
    };

    window.editProd = function(id, name, unit, cat, min) {
        document.getElementById('prod-id').value = id;
        document.getElementById('prod-name').value = name;
        document.getElementById('prod-unit').value = unit;
        document.getElementById('prod-cat').value = cat;
        document.getElementById('prod-min').value = min;
        const tab = new bootstrap.Tab(document.querySelector('#manage-tab'));
        tab.show();
        document.getElementById('prod-name').focus();
    };
    
    window.resetProdForm = () => { document.getElementById('product-form').reset(); document.getElementById('prod-id').value = ''; };
    window.deleteProd = async (id) => { if(confirm("Excluir?")) { await fetch(`/api/inventory/products/${id}`, {method:'DELETE'}); loadAdminProducts(); loadCountList(); } };

    // --- RELATÓRIOS ---
    window.loadReports = async function() {
        const tbody = document.getElementById('reports-list-body');
        if(!tbody) return;
        const res = await fetch('/api/inventory/logs');
        allLogsCache = await res.json();
        const sessions = {};
        allLogsCache.forEach(l => {
            const id = l.session_id || `legacy`;
            if(!sessions[id]) sessions[id] = { id, date: l.count_date, time: l.count_time, user: l.counted_by, cat: l.category_context, count: 0 };
            sessions[id].count++;
        });
        tbody.innerHTML = '';
        Object.values(sessions).reverse().forEach(s => {
            tbody.innerHTML += `<tr><td>${s.date}</td><td>${s.time}</td><td>${s.user}</td><td><span class="badge bg-light text-dark border text-uppercase">${s.cat}</span></td><td>${s.count} itens</td><td class="text-end"><button class="btn btn-sm btn-danger rounded-pill" onclick="exportSessionPDF('${s.id}')">PDF</button></td></tr>`;
        });
    };

    window.exportSessionPDF = function(sid) {
        if (!window.jspdf) return showToast("Erro biblioteca PDF", "error");
        let items = allLogsCache.filter(l => l.session_id === sid);
        const m = items[0];
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.setFillColor(211, 47, 47); doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255); doc.setFontSize(16); doc.text("RELATÓRIO DE CONTAGEM", 14, 16);
        doc.setFontSize(10); doc.text(`Pizza Hut TI | ${m.category_context.toUpperCase()}`, 14, 22);
        doc.setTextColor(0); doc.text(`Data: ${m.count_date} ${m.count_time} | Resp: ${m.counted_by}`, 14, 35);
        const body = items.map(l => [l.product_name, l.qty_counted, l.product_unit, l.is_critical ? 'CRÍTICO' : 'OK']);
        doc.autoTable({ startY: 40, head: [['Produto', 'Qtd', 'Un', 'Status']], body, theme: 'striped', headStyles:{fillColor:[211,47,47]} });
        doc.save(`Estoque_${sid}.pdf`);
    };
})();