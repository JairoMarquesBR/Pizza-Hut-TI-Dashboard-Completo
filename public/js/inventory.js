(function() {
    console.log("Inventory Loaded");
    let allLogsCache = [];

    // Init
    setTimeout(() => {
        loadCountList(); 
        const user = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
        if(user && user.role === 'admin') {
            loadAdminProducts(); loadReports(); setupProductForm();
        } else {
            document.querySelectorAll('.admin-only').forEach(el => el.remove());
        }
    }, 200);

    // --- CAIXA ---
    window.loadCountList = async function() {
        const catEl = document.querySelector('input[name="catFilter"]:checked');
        if(!catEl) return;
        const cat = catEl.value;
        const tbody = document.getElementById('count-list-body');
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4"><div class="spinner-border text-danger"></div></td></tr>';

        try {
            const res = await fetch(`/api/inventory/products?category=${cat}`);
            const products = await res.json();
            tbody.innerHTML = '';
            if(!products.length) return tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Lista vazia.</td></tr>';

            products.forEach(p => {
                const isCrit = p.current_qty <= p.min_threshold;
                const style = isCrit ? 'text-danger fw-bold' : '';
                const checked = p.is_out_of_stock ? 'checked' : '';
                const tr = document.createElement('tr');
                tr.dataset.id = p.id; tr.dataset.name = p.name; tr.dataset.unit = p.unit; tr.dataset.min = p.min_threshold;
                tr.innerHTML = `<td><span class="fw-bold text-uppercase">${p.name}</span></td><td class="${style}">${p.current_qty} ${p.unit}</td><td><input type="number" class="form-control form-control-sm count-input" step="0.01"></td><td class="text-center"><input class="form-check-input out-stock-check" type="checkbox" ${checked}></td>`;
                tbody.appendChild(tr);
            });
        } catch(e) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">Erro.</td></tr>'; }
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
                items.push({ id: r.dataset.id, name: r.dataset.name, unit: r.dataset.unit, is_critical: qty <= min, qty: qty, is_out: chk, category: cat });
            }
        });
        if(!items.length) return alert("Preencha algo.");
        if(!confirm("Enviar?")) return;
        await fetch('/api/inventory/count', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({items}) });
        alert("Salvo!"); loadCountList();
    };

    // --- ADMIN ---
    window.loadAdminProducts = async function() {
        const tbody = document.getElementById('admin-prod-list');
        const res = await fetch(`/api/inventory/products?category=all`);
        const prods = await res.json();
        tbody.innerHTML = '';
        prods.forEach(p => {
            tbody.innerHTML += `<tr><td class="fw-bold">${p.name}</td><td><span class="badge bg-secondary">${p.category}</span></td><td>${p.current_qty} ${p.unit}</td><td>${p.min_threshold}</td><td class="text-end"><button class="btn btn-sm btn-link text-danger" onclick="deleteProd(${p.id})"><i class="material-icons">delete</i></button></td></tr>`;
        });
    };

    function setupProductForm() {
        document.getElementById('product-form').onsubmit = async (e) => {
            e.preventDefault();
            const body = {
                name: document.getElementById('prod-name').value,
                unit: document.getElementById('prod-unit').value,
                category: document.getElementById('prod-cat').value,
                min_threshold: document.getElementById('prod-min').value
            };
            await fetch('/api/inventory/products', { method: 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)});
            document.getElementById('product-form').reset();
            loadAdminProducts(); loadCountList();
        };
    }
    
    window.resetProdForm = () => document.getElementById('product-form').reset();
    window.deleteProd = async (id) => { if(confirm("Del?")) { await fetch(`/api/inventory/products/${id}`, {method:'DELETE'}); loadAdminProducts(); loadCountList(); } };

    // --- RELATÓRIOS ---
    window.loadReports = async function() {
        const tbody = document.getElementById('reports-list-body');
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
            // ADICIONADO BOTÃO DE DELETAR NA TABELA
            tbody.innerHTML += `<tr>
                <td>${s.date}</td>
                <td>${s.time}</td>
                <td>${s.user}</td>
                <td><span class="badge bg-light text-dark border text-uppercase">${s.cat}</span></td>
                <td>${s.count} itens</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-danger rounded-pill me-2" onclick="exportSessionPDF('${s.id}')" title="Baixar PDF"><i class="material-icons align-middle">picture_as_pdf</i></button>
                    <button class="btn btn-sm btn-outline-secondary rounded-circle" onclick="deleteSession('${s.id}')" title="Excluir Registro"><i class="material-icons align-middle">delete</i></button>
                </td>
            </tr>`;
        });
    };

    // NOVA FUNÇÃO: DELETAR SESSÃO
    window.deleteSession = async function(sid) {
        if(!confirm("Tem certeza que deseja apagar este histórico? Essa ação não pode ser desfeita.")) return;
        try {
            const res = await fetch(`/api/inventory/logs/${sid}`, { method: 'DELETE' });
            if (res.ok) {
                alert("Histórico removido.");
                loadReports();
            } else {
                alert("Erro ao remover.");
            }
        } catch(e) { console.error(e); }
    };

    window.exportSessionPDF = function(sid) {
        if (!window.jspdf) return alert("PDF Lib Error");
        let items = allLogsCache.filter(l => l.session_id === sid);
        if (!items.length) return alert("Vazio");
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