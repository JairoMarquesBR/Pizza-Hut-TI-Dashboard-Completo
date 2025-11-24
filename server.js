const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'minha_chave_secreta_super_segura_pizzanet'; 

// AUMENTADO LIMITE PARA 50MB (Crucial para fotos)
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser()); 
app.use(express.static('public')); 

// --- ROTAS ---

// LOGIN
app.post('/api/login', (req, res) => {
    let { username, password } = req.body;
    username = username.toLowerCase().trim();

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (err || !user) return res.status(401).json({ message: 'Usuário não encontrado' });

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

// LOGOUT
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout ok' });
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

// CRUD USUÁRIOS

app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    db.all("SELECT username, role, avatar FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
    let { username, password, role, avatar } = req.body;
    username = username.toLowerCase().trim();
    const hash = bcrypt.hashSync(password, 10);

    db.run('INSERT INTO users (username, password, role, avatar) VALUES (?,?,?,?)', 
        [username, hash, role, avatar], 
        function(err) {
            if (err) return res.status(400).json({ message: 'Erro/Duplicado' });
            res.json({ message: 'Criado com sucesso.' });
    });
});

app.put('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
    const targetUser = req.params.username.toLowerCase();
    const { password, role, avatar } = req.body;

    let sql = "UPDATE users SET role = ?";
    let params = [role];

    if (password) {
        sql += ", password = ?";
        params.push(bcrypt.hashSync(password, 10));
    }
    
    // Lógica Correta: Só atualiza avatar se ele foi enviado no JSON
    if (avatar !== undefined) { 
        sql += ", avatar = ?";
        params.push(avatar);
    }

    sql += " WHERE username = ?";
    params.push(targetUser);

    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Atualizado.' });
    });
});

app.delete('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
    const target = req.params.username.toLowerCase();
    if (target === 'admin' || target === req.user.username) return res.status(400).json({ message: 'Proibido' });
    
    db.run('DELETE FROM users WHERE username = ?', target, function(err) {
        if (err) return res.status(500).json({ message: err.message });
        res.json({ message: 'Removido.' });
    });
});

app.get('/api/dashboard-data', authenticateToken, (req, res) => {
    // Simulando dados do servidor
    res.json({ 
        clients: 15 + Math.floor(Math.random() * 5), 
        devices: 20 + Math.floor(Math.random() * 10), 
        serverStatus: 'Online' 
    });
});

app.get('/settings.html', authenticateToken, requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/settings.html'));
});
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path));
});

app.listen(PORT, () => { console.log(`Server rodando na porta ${PORT}`); });