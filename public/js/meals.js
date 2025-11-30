(function() {
    console.log("Meals Module Loaded");
    
    let photoBase64 = null;
    let allMealsCache = []; // Cache para gerar PDF

    // Inicialização
    loadEmployees(); 
    setTimeout(() => {
        const user = JSON.parse(sessionStorage.getItem('pizzaUserUI'));
        if(user && user.role === 'admin') {
            loadEmployeeListAdmin();
            loadHistory();
        } else {
            document.querySelectorAll('.admin-only').forEach(el => el.remove());
        }
    }, 200);

    // --- GERAL ---
    async function loadEmployees() {
        const select = document.getElementById('meal-employee');
        if(!select) return;
        try {
            const res = await fetch('/api/meals/employees');
            const list = await res.json();
            select.innerHTML = '<option value="" selected disabled>Selecione...</option>';
            list.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.name;
                opt.dataset.role = emp.role_type;
                opt.innerText = emp.name;
                select.appendChild(opt);
            });
            select.addEventListener('change', function() {
                const selected = this.options[this.selectedIndex];
                document.getElementById('meal-role').value = selected.dataset.role.toUpperCase();
            });
        } catch(e) {}
    }

    // --- REGISTRO ---
    const fileInput = document.getElementById('meal-file');
    if(fileInput) {
        fileInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const r = new FileReader();
                r.onload = (e) => { 
                    photoBase64 = e.target.result;
                    const p = document.getElementById('meal-preview');
                    p.src = photoBase64; p.style.display = 'block';
                };
                r.readAsDataURL(file);
            }
        });
    }

    const form = document.getElementById('meal-form');
    if(form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if(!photoBase64) return alert("Foto obrigatória.");
            
            const body = {
                employee_name: document.getElementById('meal-employee').value,
                role_type: document.getElementById('meal-role').value,
                food: document.getElementById('meal-food').value,
                drink: document.getElementById('meal-drink').value,
                photo: photoBase64
            };

            try {
                const res = await fetch('/api/meals/register', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
                if(res.ok) {
                    alert("Registrado!");
                    form.reset();
                    document.getElementById('meal-preview').style.display = 'none';
                    photoBase64 = null;
                    if(document.getElementById('meal-history-list')) loadHistory();
                } else alert("Erro.");
            } catch(e) { alert("Erro conexão."); }
        });
    }

    // --- ADMIN: COLABORADORES ---
    const empForm = document.getElementById('emp-form');
    if(empForm) {
        empForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('emp-name').value;
            const type = document.getElementById('emp-type').value;
            await fetch('/api/meals/employees', { method: 'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({name, type})});
            empForm.reset(); loadEmployeeListAdmin(); loadEmployees();
        });
    }

    window.loadEmployeeListAdmin = async function() {
        const tbody = document.getElementById('emp-list');
        const res = await fetch('/api/meals/employees');
        const list = await res.json();
        tbody.innerHTML = '';
        list.forEach(e => {
            tbody.innerHTML += `<tr><td class="fw-bold">${e.name}</td><td><span class="badge bg-secondary text-uppercase">${e.role_type}</span></td><td class="text-end"><button class="btn btn-sm text-danger" onclick="deleteEmp(${e.id})"><i class="material-icons">delete</i></button></td></tr>`;
        });
    };

    window.deleteEmp = async (id) => { if(confirm("Del?")) { await fetch(`/api/meals/employees/${id}`, {method:'DELETE'}); loadEmployeeListAdmin(); loadEmployees(); }};

    // --- ADMIN: HISTÓRICO AGRUPADO ---
    window.loadHistory = async function() {
        const tbody = document.getElementById('meal-history-list');
        if(!tbody) return;
        tbody.innerHTML = '<tr><td colspan="4" class="text-center">Carregando...</td></tr>';

        try {
            const res = await fetch('/api/meals/history');
            allMealsCache = await res.json(); // Guarda tudo (com fotos)

            // Agrupar por Data + Responsável
            const sessions = {};
            allMealsCache.forEach(log => {
                const key = `${log.date_str}|${log.registered_by}`;
                if(!sessions[key]) {
                    sessions[key] = {
                        date: log.date_str,
                        user: log.registered_by,
                        count: 0
                    };
                }
                sessions[key].count++;
            });

            tbody.innerHTML = '';
            Object.keys(sessions).reverse().forEach(key => {
                const s = sessions[key];
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><b>${s.date}</b></td>
                    <td>${s.user}</td>
                    <td><span class="badge bg-primary rounded-pill">${s.count} refeições</span></td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-danger rounded-pill" onclick="exportMealPDF('${key}')">
                            <i class="material-icons align-middle fs-6 me-1">picture_as_pdf</i> PDF
                        </button>
                    </td>
                `;
                tbody.appendChild(tr);
            });

        } catch(e) { console.error(e); }
    };

    // GERAR PDF COM IMAGEM
    window.exportMealPDF = function(key) {
        if (!window.jspdf) return alert("Biblioteca PDF não carregada.");
        
        const [date, user] = key.split('|');
        // Filtra os itens desta sessão
        const items = allMealsCache.filter(l => l.date_str === date && l.registered_by === user);
        
        if (!items.length) return alert("Erro: Dados vazios.");

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Cabeçalho
        doc.setFillColor(211, 47, 47); doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255); doc.setFontSize(16); doc.text("RELATÓRIO DE REFEIÇÕES", 14, 16);
        doc.setFontSize(10); doc.text("PIZZA HUT TI | CONTROLE INTERNO", 14, 22);
        
        doc.setTextColor(0); 
        doc.text(`Data do Registro: ${date}`, 14, 35);
        doc.text(`Responsável: ${user}`, 14, 40);

        // Preparar Tabela
        const tableBody = items.map(item => [
            item.employee_name,
            item.role_type.toUpperCase(),
            `${item.food}\n+ ${item.drink}`, // Quebra de linha
            '' // Coluna da foto (será desenhada manualmente)
        ]);

        doc.autoTable({
            startY: 45,
            head: [['Colaborador', 'Função', 'Detalhes', 'Evidência']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [211, 47, 47] },
            styles: { fontSize: 10, minCellHeight: 25 }, // Altura mínima para caber a foto
            columnStyles: {
                3: { cellWidth: 25 } // Largura fixa para coluna da foto
            },
            didDrawCell: function(data) {
                // Se for a coluna da foto (index 3) e estiver no corpo da tabela
                if (data.column.index === 3 && data.section === 'body') {
                    const itemIndex = data.row.index;
                    const imgData = items[itemIndex].photo; // Base64 da imagem
                    
                    if (imgData) {
                        // Adiciona imagem dentro da célula (x, y, w, h)
                        // Ajusta padding para centralizar
                        doc.addImage(imgData, 'JPEG', data.cell.x + 2, data.cell.y + 2, 20, 20);
                    }
                }
            }
        });

        doc.save(`Refeicoes_${date.replace(/\//g,'-')}_${user}.pdf`);
    };

})();