const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

// Cria o arquivo do banco de dados se não existir
const db = new sqlite3.Database('./pizzanet.db', (err) => {
    if (err) {
        console.error('Erro ao abrir banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        initDb();
    }
});

function initDb() {
    // Cria tabela de usuários se não existir
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT
    )`, (err) => {
        if (err) {
            console.error("Erro ao criar tabela:", err);
        } else {
            // Verifica se o admin já existe, se não, cria o padrão
            // Isso é o "Seed" inicial
            const insert = 'INSERT INTO users (username, password, role) VALUES (?,?,?)';
            db.get("SELECT * FROM users WHERE username = ?", ["admin"], (err, row) => {
                if (!row) {
                    // Senha padrão 'pizza2025' criptografada
                    const hash = bcrypt.hashSync("pizza2025", 10);
                    db.run(insert, ["admin", hash, "admin"]);
                    console.log(">> Usuário ADMIN padrão criado.");
                    
                    // Senha padrão '123' criptografada
                    const hashCaixa = bcrypt.hashSync("123", 10);
                    db.run(insert, ["caixa", hashCaixa, "user"]);
                    console.log(">> Usuário CAIXA padrão criado.");
                }
            });
        }
    });
}

module.exports = db;