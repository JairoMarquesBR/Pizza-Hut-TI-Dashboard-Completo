const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const db = new sqlite3.Database('./pizzanet.db', (err) => {
    if (err) console.error('Erro BD:', err.message);
    else {
        console.log('Conectado ao SQLite.');
        initDb();
    }
});

function initDb() {
    // Adicionada coluna 'avatar' do tipo TEXT (para string Base64)
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT,
        avatar TEXT
    )`, (err) => {
        if (!err) {
            const insert = 'INSERT INTO users (username, password, role, avatar) VALUES (?,?,?,?)';
            db.get("SELECT * FROM users WHERE username = ?", ["admin"], (err, row) => {
                if (!row) {
                    const hash = bcrypt.hashSync("pizza2025", 10);
                    // Avatar padrão vazio (null)
                    db.run(insert, ["admin", hash, "admin", null]); 
                    
                    const hashCaixa = bcrypt.hashSync("123", 10);
                    db.run(insert, ["caixa", hashCaixa, "user", null]);
                    console.log(">> Usuários padrão criados.");
                }
            });
        }
    });
}

module.exports = db;