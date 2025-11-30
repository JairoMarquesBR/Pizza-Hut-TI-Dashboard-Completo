const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

// BANCOS DE DADOS
const db = require('./database');      // Usuários
const invDb = require('./inventory_db'); // Estoque (CRÍTICO)

const app = express();
const PORT = 3000;
const SECRET_KEY = 'minha_chave_secreta_super_segura_pizzanet'; 

// Aumenta o limite para permitir fotos grandes no cadastro de usuários
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser()); 
app.use(express.static('public')); 

// =======================================================
// 1. AUTENTICAÇÃO (LOGIN / LOGOUT)
// =======================================================
app.post('/api/login', (req, res) => {
    let { username, password } = req.body;
    
    // Força minúsculo para evitar erro "Admin" vs "admin"
    username = username.toLowerCase().trim();

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) {
            console.error("Erro no banco de usuários:", err);
            return res.status(500).json({ message: "Erro interno" });
        }
        if (!user) return res.status(401).json({ message: 'Usuário não encontrado' });

        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Senha incorreta' });
        }

        // Gera Token
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role }, 
            SECRET_KEY, 
            { expiresIn: '8h' }
        );

        res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
        
        // Retorna dados visuais
        res.json({ 
            message: 'Sucesso', 
            user: { name: user.username, role: user.role, avatar: user.avatar } 
        });
    });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Ok' });
});

// MIDDLEWARES DE SEGURANÇA
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Sessão expirada' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso restrito a Administradores' });
    }
    next();
};

// =======================================================
// 2. CONTROLE DE ESTOQUE (CORRIGIDO)
// =======================================================

// Listar Produtos
app.get('/api/inventory/products', authenticateToken, (req, res) => {
    const cat = req.query.category;
    let sql = "SELECT * FROM products";
    let params = [];
    
    if (cat && cat !== 'all') {
        sql += " WHERE category = ?";
        params.push(cat);
    }
    
    sql += " ORDER BY name ASC";

    invDb.all(sql, params, (err, rows) => {
        if (err) {
            console.error("Erro ao listar produtos:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// CRIAR PRODUTO (LÓGICA DE CASCATA ROBUSTA)
app.post('/api/inventory/products', authenticateToken, requireAdmin, (req, res) => {
    console.log(">>> POST PRODUTO RECEBIDO:", req.body);

    const { name, unit, category, min_threshold } = req.body;
    
    // Validação básica para evitar crash
    if (!name || !unit || !category) {
        return res.status(400).json({ message: "Dados incompletos" });
    }

    // Define em quais listas o produto deve ser criado
    let categoriesToCreate = [];
    if (category === 'diaria') {
        categoriesToCreate = ['diaria', 'semanal', 'mensal'];
    } else if (category === 'semanal') {
        categoriesToCreate = ['semanal', 'mensal'];
    } else {
        categoriesToCreate = ['mensal'];
    }

    console.log(`>>> Replicando para: ${categoriesToCreate.join(', ')}`);

    const sql = `INSERT INTO products (name, unit, category, min_threshold) VALUES (?,?,?,?)`;
    
    // Executa inserções em série
    invDb.serialize(() => {
        const stmt = invDb.prepare(sql);
        
        categoriesToCreate.forEach(cat => {
            stmt.run(name, unit, cat, min_threshold, (err) => {
                if (err) console.error(`ERRO ao salvar em ${cat}:`, err.message);
                else console.log(`   + Salvo em: ${cat}`);
            });
        });
        
        stmt.finalize();
        // Responde sucesso imediatamente (assíncrono)
        res.json({ message: `Produto cadastrado em ${categoriesToCreate.length} listas.` });
    });
});

// Editar Produto
app.put('/api/inventory/products/:id', authenticateToken, requireAdmin, (req, res) => {
    const { name, unit, category, min_threshold } = req.body;
    
    invDb.run(`UPDATE products SET name=?, unit=?, category=?, min_threshold=? WHERE id=?`, 
        [name, unit, category, min_threshold, req.params.id], 
        function(err) {
            if(err) return res.status(500).json({error: err.message});
            res.json({ message: 'Produto atualizado' });
        }
    );
});

// Excluir Produto
app.delete('/api/inventory/products/:id', authenticateToken, requireAdmin, (req, res) => {
    invDb.run("DELETE FROM products WHERE id = ?", req.params.id, function(err) {
        if(err) return res.status(500).json({error: err.message});
        res.json({ message: 'Produto deletado' });
    });
});

// ENVIAR CONTAGEM (COM SESSION_ID E DADOS EXTRAS PARA PDF)
app.post('/api/inventory/count', authenticateToken, (req, res) => {
    const items = req.body.items;
    const user = req.user.username;
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR');
    
    // Gera ID de Sessão Único
    const sessionId = `CNT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    console.log(`>>> Recebendo contagem de ${items.length} itens. Session: ${sessionId}`);

    invDb.serialize(() => {
        const upd = invDb.prepare("UPDATE products SET current_qty = ?, is_out_of_stock = ? WHERE id = ?");
        
        // Grava todos os dados necessários para o PDF (Unidade, Crítico)
        const log = invDb.prepare(`INSERT INTO stock_logs 
            (session_id, product_id, product_name, product_unit, qty_counted, is_critical, counted_by, count_date, count_time, category_context) 
            VALUES (?,?,?,?,?,?,?,?,?,?)`);
        
        items.forEach(i => {
            // 1. Atualiza Produto
            upd.run(i.qty, i.is_out ? 1 : 0, i.id);
            
            // 2. Grava Log
            const isCrit = i.is_critical ? 1 : 0;
            log.run(sessionId, i.id, i.name, i.unit, i.qty, isCrit, user, dateStr, timeStr, i.category);
        });
        
        upd.finalize();
        log.finalize();
        
        res.json({ message: 'Contagem registrada', sessionId: sessionId });
    });
});

// Obter Logs
app.get('/api/inventory/logs', authenticateToken, requireAdmin, (req, res) => {
    invDb.all("SELECT * FROM stock_logs ORDER BY id DESC LIMIT 1000", [], (err, rows) => {
        if(err) return res.status(500).json({error: err.message});
        res.json(rows);
    });
});

// =======================================================
// 3. GESTÃO DE USUÁRIOS
// =======================================================

app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    db.all("SELECT username, role, avatar FROM users", [], (err, rows) => res.json(rows));
});

app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
    let { username, password, role, avatar } = req.body;
    username = username.toLowerCase().trim();
    const hash = bcrypt.hashSync(password, 10);
    
    db.run('INSERT INTO users (username, password, role, avatar) VALUES (?,?,?,?)', 
        [username, hash, role, avatar], 
        function(err) {
            if (err) {
                console.error("Erro criar user:", err);
                return res.status(400).json({ message: 'Erro/Duplicado' });
            }
            res.json({ message: 'Ok' });
        }
    );
});

app.put('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
    const target = req.params.username.toLowerCase();
    const { password, role, avatar } = req.body;
    let sql = "UPDATE users SET role = ?";
    let params = [role];

    if (password) { 
        sql += ", password = ?"; 
        params.push(bcrypt.hashSync(password, 10)); 
    }
    if (avatar !== undefined) { 
        sql += ", avatar = ?"; 
        params.push(avatar); 
    }
    
    sql += " WHERE username = ?";
    params.push(target);

    db.run(sql, params, (err) => {
        if(err) return res.status(500).json({ message: "Erro SQL" });
        res.json({ message: 'Ok' });
    });
});

app.delete('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
    const target = req.params.username.toLowerCase();
    if (target === 'admin' || target === req.user.username) {
        return res.status(400).json({ message: 'Proibido' });
    }
    db.run('DELETE FROM users WHERE username = ?', target, () => res.json({ message: 'Ok' }));
});

// =======================================================
// 4. DADOS GERAIS E ARQUIVOS
// =======================================================
app.get('/api/dashboard-data', authenticateToken, (req, res) => {
    res.json({ clients: 15, devices: 20, serverStatus: 'Online' });
});

app.get('/settings.html', authenticateToken, requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/settings.html'));
});

// Rota Curinga (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path));
});

// START
app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`SERVER PIZZANET RODANDO NA PORTA ${PORT}`);
    console.log(`--------------------------------------------------`);
});