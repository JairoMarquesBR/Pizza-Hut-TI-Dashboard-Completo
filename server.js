const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const crypto = require('crypto'); 

// --- IMPORTAÇÃO DOS BANCOS DE DADOS ---
const db = require('./database');        // Usuários
const invDb = require('./inventory_db'); // Estoque
const mealsDb = require('./meals_db');   // Refeições

const app = express();
const PORT = 3000;
const SECRET_KEY = 'minha_chave_secreta_super_segura_pizzanet'; 

// Chaves para Criptografia de Fotos (Refeições)
const ENC_KEY = crypto.scryptSync('senha_secreta_fotos_pizza', 'salt', 32); 
const IV_LENGTH = 16; 

// Aumenta limites para aceitar fotos grandes
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser()); 
app.use(express.static('public')); 

// =======================================================
// 0. FUNÇÕES AUXILIARES (CRIPTOGRAFIA)
// =======================================================
function encrypt(text) {
    if (!text) return { content: null, iv: null };
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', ENC_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return { content: encrypted.toString('hex'), iv: iv.toString('hex') };
}

function decrypt(text, iv) {
    if (!text || !iv) return null;
    let ivBuffer = Buffer.from(iv, 'hex');
    let encryptedText = Buffer.from(text, 'hex');
    let decipher = crypto.createDecipheriv('aes-256-cbc', ENC_KEY, ivBuffer);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}

// =======================================================
// 1. AUTENTICAÇÃO (LOGIN / LOGOUT)
// =======================================================
app.post('/api/login', (req, res) => {
    let { username, password } = req.body;
    username = username.toLowerCase().trim();

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.status(500).json({ message: "Erro interno" });
        if (!user) return res.status(401).json({ message: 'Usuário não encontrado' });

        if (!bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ message: 'Senha incorreta' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role }, 
            SECRET_KEY, 
            { expiresIn: '8h' }
        );

        res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
        
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

// --- MIDDLEWARES ---
const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Acesso negado' });

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ message: 'Sessão expirada' });
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
// 2. CONTROLE DE ESTOQUE (INVENTORY)
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
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// CRIAR PRODUTO (CASCATA)
app.post('/api/inventory/products', authenticateToken, requireAdmin, (req, res) => {
    const { name, unit, category, min_threshold } = req.body;
    
    // Define em quais listas criar
    let categoriesToCreate = [];
    if (category === 'diaria') {
        categoriesToCreate = ['diaria', 'semanal', 'mensal'];
    } else if (category === 'semanal') {
        categoriesToCreate = ['semanal', 'mensal'];
    } else {
        categoriesToCreate = ['mensal'];
    }

    const sql = `INSERT INTO products (name, unit, category, min_threshold) VALUES (?,?,?,?)`;
    
    invDb.serialize(() => {
        const stmt = invDb.prepare(sql);
        categoriesToCreate.forEach(cat => {
            stmt.run(name, unit, cat, min_threshold);
        });
        stmt.finalize();
    });

    res.json({ message: `Produto criado em ${categoriesToCreate.length} listas.` });
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

// ENVIAR CONTAGEM (COM SESSION ID)
app.post('/api/inventory/count', authenticateToken, (req, res) => {
    const items = req.body.items;
    const user = req.user.username;
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR');
    
    // ID Único para agrupar no PDF
    const sessionId = `CNT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    invDb.serialize(() => {
        // Sincroniza estoque pelo NOME (afeta todas as listas)
        const upd = invDb.prepare("UPDATE products SET current_qty = ?, is_out_of_stock = ? WHERE name = ?");
        
        // Grava Log Completo
        const log = invDb.prepare(`INSERT INTO stock_logs 
            (session_id, product_id, product_name, product_unit, qty_counted, is_critical, counted_by, count_date, count_time, category_context) 
            VALUES (?,?,?,?,?,?,?,?,?,?)`);
        
        items.forEach(i => {
            upd.run(i.qty, i.is_out ? 1 : 0, i.name);
            
            const isCrit = i.is_critical ? 1 : 0;
            log.run(sessionId, i.id, i.name, i.unit, i.qty, isCrit, user, dateStr, timeStr, i.category);
        });
        
        upd.finalize();
        log.finalize();
        
        res.json({ message: 'Ok', sessionId: sessionId });
    });
});

// Obter Histórico
app.get('/api/inventory/logs', authenticateToken, requireAdmin, (req, res) => {
    invDb.all("SELECT * FROM stock_logs ORDER BY id DESC LIMIT 1000", [], (err, rows) => res.json(rows));
});

// Deletar Histórico
app.delete('/api/inventory/logs/:session_id', authenticateToken, requireAdmin, (req, res) => {
    invDb.run("DELETE FROM stock_logs WHERE session_id = ?", req.params.session_id, (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({message: 'Ok'});
    });
});

// Alertas (Estoque Baixo) - Usa DISTINCT para não repetir contagem
app.get('/api/alerts/check', authenticateToken, (req, res) => {
    invDb.get("SELECT COUNT(DISTINCT name) as count FROM products WHERE current_qty <= min_threshold", (err, row) => {
        if (err) return res.json([]);
        const alerts = [];
        if (row && row.count > 0) {
            alerts.push({
                title: "Estoque Crítico",
                body: `Existem ${row.count} itens abaixo do mínimo.`,
                priority: "high"
            });
        }
        res.json(alerts);
    });
});

// =======================================================
// 3. MÓDULO REFEIÇÕES (MEALS)
// =======================================================

// Colaboradores
app.get('/api/meals/employees', authenticateToken, (req, res) => {
    mealsDb.all("SELECT * FROM employees ORDER BY name ASC", [], (err, rows) => res.json(rows));
});

app.post('/api/meals/employees', authenticateToken, requireAdmin, (req, res) => {
    const { name, type } = req.body;
    mealsDb.run("INSERT INTO employees (name, role_type) VALUES (?,?)", [name, type], (err) => {
        if(err) return res.status(500).json({message: "Erro"});
        res.json({ message: "Ok" });
    });
});

app.delete('/api/meals/employees/:id', authenticateToken, requireAdmin, (req, res) => {
    mealsDb.run("DELETE FROM employees WHERE id = ?", req.params.id, () => res.json({ message: "Ok" }));
});

// Registrar Refeição (Criptografado)
app.post('/api/meals/register', authenticateToken, (req, res) => {
    const { employee_name, role_type, food, drink, photo } = req.body;
    const user = req.user.username;
    const dateStr = new Date().toLocaleDateString('pt-BR');

    const encrypted = encrypt(photo);

    mealsDb.run(`INSERT INTO meal_logs (employee_name, role_type, food, drink, photo_data, iv, registered_by, date_str) VALUES (?,?,?,?,?,?,?,?)`,
        [employee_name, role_type, food, drink, encrypted.content, encrypted.iv, user, dateStr],
        function(err) {
            if (err) return res.status(500).json({ message: err.message });
            res.json({ message: "Registrado!" });
        }
    );
});

// Histórico Refeições (Descriptografa)
app.get('/api/meals/history', authenticateToken, requireAdmin, (req, res) => {
    mealsDb.all("SELECT * FROM meal_logs ORDER BY id DESC LIMIT 50", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const decryptedRows = rows.map(row => {
            return { ...row, photo: decrypt(row.photo_data, row.iv) };
        });
        res.json(decryptedRows);
    });
});

// =======================================================
// 4. GESTÃO DE USUÁRIOS
// =======================================================
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

// =======================================================
// 5. GERAL
// =======================================================
app.get('/api/dashboard-data', authenticateToken, (req, res) => res.json({ clients: 15, devices: 20 }));
app.get('/settings.html', authenticateToken, requireAdmin, (req, res) => res.sendFile(path.join(__dirname, 'public/settings.html')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path)));

app.listen(PORT, () => console.log(`SERVER ON ${PORT}`));