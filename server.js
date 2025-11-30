const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');

// BANCOS
const db = require('./database');      
const invDb = require('./inventory_db'); 

const app = express();
const PORT = 3000;
const SECRET_KEY = 'minha_chave_secreta_super_segura_pizzanet'; 

app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser()); 
app.use(express.static('public')); 

// --- AUTH ---
app.post('/api/login', (req, res) => {
    let { username, password } = req.body;
    username = username.toLowerCase().trim();
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user) return res.status(401).json({ message: 'Usuário não encontrado' });
        if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ message: 'Senha incorreta' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '8h' });
        res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
        res.json({ message: 'Sucesso', user: { name: user.username, role: user.role, avatar: user.avatar } });
    });
});

app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Ok' });
});

// MIDDLEWARES
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Negado' });
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });
        req.user = user;
        next();
    });
};
const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Restrito' });
    next();
};

// =======================================================
// 2. ESTOQUE (LÓGICA SINCRONIZADA)
// =======================================================

app.get('/api/inventory/products', authenticateToken, (req, res) => {
    const cat = req.query.category;
    let sql = "SELECT * FROM products";
    let params = [];
    if (cat && cat !== 'all') { sql += " WHERE category = ?"; params.push(cat); }
    sql += " ORDER BY name ASC";
    invDb.all(sql, params, (err, rows) => res.json(rows));
});

// CADASTRAR (CASCATA)
app.post('/api/inventory/products', authenticateToken, requireAdmin, (req, res) => {
    const { name, unit, category, min_threshold } = req.body;
    let list = [];
    if (category === 'diaria') list = ['diaria', 'semanal', 'mensal'];
    else if (category === 'semanal') list = ['semanal', 'mensal'];
    else list = ['mensal'];

    const sql = `INSERT INTO products (name, unit, category, min_threshold) VALUES (?,?,?,?)`;
    invDb.serialize(() => {
        const stmt = invDb.prepare(sql);
        list.forEach(cat => stmt.run(name, unit, cat, min_threshold));
        stmt.finalize();
    });
    res.json({ message: 'Ok' });
});

app.put('/api/inventory/products/:id', authenticateToken, requireAdmin, (req, res) => {
    const { name, unit, category, min_threshold } = req.body;
    // Atualiza este item específico
    invDb.run(`UPDATE products SET name=?, unit=?, category=?, min_threshold=? WHERE id=?`, 
        [name, unit, category, min_threshold, req.params.id], 
        () => res.json({ message: 'Ok' })
    );
});

app.delete('/api/inventory/products/:id', authenticateToken, requireAdmin, (req, res) => {
    invDb.run("DELETE FROM products WHERE id = ?", req.params.id, () => res.json({ message: 'Ok' }));
});

// CONTAGEM (SINCRONIZAÇÃO GLOBAL)
app.post('/api/inventory/count', authenticateToken, (req, res) => {
    const items = req.body.items;
    const user = req.user.username;
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR');
    const sessionId = `CNT-${Date.now()}`;

    invDb.serialize(() => {
        // ATENÇÃO AQUI: Atualiza TODOS os produtos com esse NOME, em qualquer categoria
        const upd = invDb.prepare("UPDATE products SET current_qty = ?, is_out_of_stock = ? WHERE name = ?");
        
        const log = invDb.prepare(`INSERT INTO stock_logs 
            (session_id, product_id, product_name, product_unit, qty_counted, is_critical, counted_by, count_date, count_time, category_context) 
            VALUES (?,?,?,?,?,?,?,?,?,?)`);
        
        items.forEach(i => {
            // Atualiza saldo globalmente pelo nome
            upd.run(i.qty, i.is_out ? 1 : 0, i.name);
            
            const isCrit = i.is_critical ? 1 : 0;
            log.run(sessionId, i.id, i.name, i.unit, i.qty, isCrit, user, dateStr, timeStr, i.category);
        });
        
        upd.finalize();
        log.finalize();
        res.json({ message: 'Ok', sessionId });
    });
});

app.get('/api/inventory/logs', authenticateToken, requireAdmin, (req, res) => {
    invDb.all("SELECT * FROM stock_logs ORDER BY id DESC LIMIT 1000", [], (err, rows) => res.json(rows));
});

// ALERTAS (CONTAGEM ÚNICA)
app.get('/api/alerts/check', authenticateToken, (req, res) => {
    // Conta produtos únicos que estão abaixo do mínimo
    invDb.get("SELECT COUNT(DISTINCT name) as count FROM products WHERE current_qty <= min_threshold", (err, row) => {
        if (err) return res.json([]);
        const alerts = [];
        if (row && row.count > 0) {
            alerts.push({
                title: "Estoque Crítico",
                body: `Existem ${row.count} itens com o estoque em estado critico`,
                priority: "high",
                status: 1
            });
        }
        res.json(alerts);
    });
});

// --- GERAL ---
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    db.all("SELECT username, role, avatar FROM users", [], (err, rows) => res.json(rows));
});
app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
    let { username, password, role, avatar } = req.body;
    username = username.toLowerCase().trim();
    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (username, password, role, avatar) VALUES (?,?,?,?)', [username, hash, role, avatar], () => res.json({ message: 'Ok' }));
});
app.put('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
    const target = req.params.username.toLowerCase();
    const { password, role, avatar } = req.body;
    let sql = "UPDATE users SET role = ?";
    let params = [role];
    if (password) { sql += ", password = ?"; params.push(bcrypt.hashSync(password, 10)); }
    if (avatar !== undefined) { sql += ", avatar = ?"; params.push(avatar); }
    sql += " WHERE username = ?"; params.push(target);
    db.run(sql, params, () => res.json({ message: 'Ok' }));
});
app.delete('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
    db.run('DELETE FROM users WHERE username = ?', req.params.username.toLowerCase(), () => res.json({ message: 'Ok' }));
});
app.get('/api/dashboard-data', authenticateToken, (req, res) => res.json({ clients: 15, devices: 20 }));
app.get('/settings.html', authenticateToken, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public/settings.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path)));

app.listen(PORT, () => console.log(`SERVER ON ${PORT}`));