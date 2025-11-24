const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs'); // Segurança de Senha
const path = require('path');
const db = require('./database'); // Importa nosso banco SQLite

const app = express();
const PORT = 3000;
const SECRET_KEY = 'minha_chave_secreta_super_segura_pizzanet'; 

// --- MIDDLEWARES ---
app.use(express.json()); 
app.use(cookieParser()); 
app.use(express.static('public')); 

// =======================================================
// 1. ROTAS DE AUTENTICAÇÃO
// =======================================================

// LOGIN
app.post('/api/login', (req, res) => {
    let { username, password } = req.body;
    username = username.toLowerCase().trim();

    console.log(`> Login: Tentativa para "${username}"`);

    // Busca no banco SQL
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err) return res.status(500).json({ message: "Erro no servidor" });
        if (!user) return res.status(401).json({ message: 'Usuário não existe' });

        // Compara a senha digitada com o HASH do banco (Segurança Real)
        const passwordIsValid = bcrypt.compareSync(password, user.password);

        if (!passwordIsValid) {
            console.log('>> ERRO: Senha incorreta.');
            return res.status(401).json({ message: 'Senha incorreta' });
        }

        console.log('>> SUCESSO: Login aprovado!');

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role, name: user.username.toUpperCase() }, 
            SECRET_KEY, 
            { expiresIn: '8h' }
        );

        res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
        res.json({ 
            message: 'Logado com sucesso', 
            user: { name: user.username, role: user.role } 
        });
    });
});

// LOGOUT
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout realizado' });
});

// =======================================================
// 2. MIDDLEWARES DE SEGURANÇA
// =======================================================

const authenticateToken = (req, res, next) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Acesso negado' });

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
// 3. CRUD DE USUÁRIOS (COM SQLITE)
// =======================================================

// LISTAR
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    const sql = "SELECT username, role FROM users";
    db.all(sql, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// CRIAR
app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
    let { username, password, role } = req.body;
    username = username.toLowerCase().trim();

    // Criptografa a senha antes de salvar
    const hash = bcrypt.hashSync(password, 10);

    const sql = 'INSERT INTO users (username, password, role) VALUES (?,?,?)';
    
    db.run(sql, [username, hash, role], function(err) {
        if (err) {
            // Código 19 do SQLite significa violação de UNIQUE (usuário duplicado)
            if (err.errno === 19) return res.status(400).json({ message: 'Usuário já existe.' });
            return res.status(500).json({ message: 'Erro ao criar usuário.' });
        }
        console.log(`> Novo usuário criado: ${username}`);
        res.json({ message: 'Usuário criado com sucesso.', id: this.lastID });
    });
});

// EDITAR
app.put('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
    const targetUser = req.params.username.toLowerCase();
    const { password, role } = req.body;

    // Se tiver senha nova, criptografa. Se não, atualiza só role.
    let sql, params;

    if (password) {
        const hash = bcrypt.hashSync(password, 10);
        sql = `UPDATE users SET password = ?, role = ? WHERE username = ?`;
        params = [hash, role, targetUser];
    } else {
        sql = `UPDATE users SET role = ? WHERE username = ?`;
        params = [role, targetUser];
    }

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });
        
        console.log(`> Usuário atualizado: ${targetUser}`);
        res.json({ message: 'Usuário atualizado.' });
    });
});

// DELETAR
app.delete('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
    const targetUser = req.params.username.toLowerCase();

    // Impede deletar a si mesmo ou o admin principal
    if (targetUser === 'admin' || targetUser === req.user.username) {
        return res.status(400).json({ message: 'Não é possível deletar este usuário.' });
    }

    const sql = 'DELETE FROM users WHERE username = ?';
    db.run(sql, targetUser, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        if (this.changes === 0) return res.status(404).json({ message: 'Usuário não encontrado.' });

        console.log(`> Usuário removido: ${targetUser}`);
        res.json({ message: 'Usuário removido.' });
    });
});

// =======================================================
// 4. DADOS DO DASHBOARD
// =======================================================
app.get('/api/dashboard-data', authenticateToken, (req, res) => {
    res.json({
        clients: 12 + Math.floor(Math.random() * 5),
        devices: Math.floor(Math.random() * 30) + 10,
        serverStatus: 'Online (SQLite)'
    });
});

// =======================================================
// 5. SERVIR ARQUIVOS E START
// =======================================================

app.get('/settings.html', authenticateToken, requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/settings.html'));
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path));
});

app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`SERVER PIZZANET RODANDO COM SQLITE NA PORTA ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    console.log(`--------------------------------------------------`);
});