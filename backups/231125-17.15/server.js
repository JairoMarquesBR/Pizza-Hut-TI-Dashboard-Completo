const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const path = require('path');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'minha_chave_secreta_super_segura_pizzanet'; 

// --- MIDDLEWARES ---
app.use(express.json()); 
app.use(cookieParser()); 
app.use(express.static('public')); 

// =======================================================
// 1. BANCO DE DADOS SIMULADO
// =======================================================
const users = [
    { 
        username: 'admin', 
        role: 'admin', 
        password: 'pizza2025' // <--- Senha do Admin
    },
    { 
        username: 'caixa', 
        role: 'user', 
        password: '123'       // <--- Senha do Caixa
    }
];

// =======================================================
// 2. ROTAS DE AUTENTICAÇÃO
// =======================================================

// LOGIN
app.post('/api/login', (req, res) => {
    let { username, password } = req.body;
    
    // Força minúsculo para evitar erros de digitação
    username = username.toLowerCase().trim();

    console.log(`> Login: Tentativa para usuário "${username}" com senha "${password}"`);

    const user = users.find(u => u.username === username);

    if (!user) {
        console.log('>> ERRO: Usuário não existe.');
        return res.status(401).json({ message: 'Usuário não existe' });
    }

    if (password !== user.password) {
        console.log('>> ERRO: Senha incorreta.');
        return res.status(401).json({ message: 'Senha incorreta' });
    }

    console.log('>> SUCESSO: Login aprovado!');

    const token = jwt.sign(
        { id: username, role: user.role, name: username.toUpperCase() }, 
        SECRET_KEY, 
        { expiresIn: '8h' }
    );

    res.cookie('token', token, { httpOnly: true, sameSite: 'strict' });
    
    res.json({ 
        message: 'Logado com sucesso', 
        user: { name: user.username, role: user.role } 
    });
});

// LOGOUT
app.post('/api/logout', (req, res) => {
    res.clearCookie('token');
    res.json({ message: 'Logout realizado' });
});

// =======================================================
// 3. MIDDLEWARES DE SEGURANÇA
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
// 4. CRUD DE USUÁRIOS (CORREÇÃO CASE SENSITIVE)
// =======================================================

// LISTAR
app.get('/api/users', authenticateToken, requireAdmin, (req, res) => {
    const safeUsers = users.map(u => ({ username: u.username, role: u.role }));
    res.json(safeUsers);
});

// CRIAR
app.post('/api/users', authenticateToken, requireAdmin, (req, res) => {
    let { username, password, role } = req.body;

    // CORREÇÃO CRÍTICA: Converte para minúsculo ao criar
    username = username.toLowerCase().trim();

    if (users.find(u => u.username === username)) {
        return res.status(400).json({ message: 'Usuário já existe.' });
    }

    users.push({ username, password, role });
    console.log(`> Novo usuário criado: ${username}`);
    res.json({ message: 'Usuário criado com sucesso.' });
});

// EDITAR
app.put('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
    const targetUser = req.params.username.toLowerCase(); // Converte busca para minúsculo
    const { password, role } = req.body;

    const userIndex = users.findIndex(u => u.username === targetUser);
    if (userIndex === -1) return res.status(404).json({ message: 'Usuário não encontrado.' });

    if (password) users[userIndex].password = password;
    if (role) users[userIndex].role = role;

    console.log(`> Usuário atualizado: ${targetUser}`);
    res.json({ message: 'Usuário atualizado.' });
});

// DELETAR
app.delete('/api/users/:username', authenticateToken, requireAdmin, (req, res) => {
    const targetUser = req.params.username.toLowerCase(); // Converte busca para minúsculo

    if (targetUser === 'admin' || targetUser === req.user.id) {
        return res.status(400).json({ message: 'Não é possível deletar este usuário.' });
    }

    const userIndex = users.findIndex(u => u.username === targetUser);
    if (userIndex === -1) return res.status(404).json({ message: 'Usuário não encontrado.' });

    users.splice(userIndex, 1);
    console.log(`> Usuário removido: ${targetUser}`);
    res.json({ message: 'Usuário removido.' });
});

// =======================================================
// 5. DADOS DO DASHBOARD
// =======================================================
app.get('/api/dashboard-data', authenticateToken, (req, res) => {
    res.json({
        clients: 12 + Math.floor(Math.random() * 5),
        devices: Math.floor(Math.random() * 30) + 10,
        serverStatus: 'Online (Seguro)'
    });
});

// =======================================================
// 6. SERVIR ARQUIVOS E START
// =======================================================

// Protege a rota settings.html
app.get('/settings.html', authenticateToken, requireAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'public/settings.html'));
});

// Rota padrão (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', req.path === '/' ? 'index.html' : req.path));
});

app.listen(PORT, () => {
    console.log(`--------------------------------------------------`);
    console.log(`SERVER PIZZANET RODANDO NA PORTA ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    console.log(`Credenciais Admin -> admin / pizza2025`);
    console.log(`--------------------------------------------------`);
});