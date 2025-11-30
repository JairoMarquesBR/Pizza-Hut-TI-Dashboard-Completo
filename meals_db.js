const sqlite3 = require('sqlite3').verbose();

const mealsDb = new sqlite3.Database('./meals.db', (err) => {
    if (err) console.error('❌ Erro no DB Refeições:', err.message);
    else {
        console.log('✅ Banco de Refeições (Meals) CONECTADO.');
        initMealsDb();
    }
});

function initMealsDb() {
    mealsDb.serialize(() => {
        // Tabela de Colaboradores
        mealsDb.run(`CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            role_type TEXT NOT NULL -- 'funcionario', 'convidado', 'gerencia'
        )`);

        // Tabela de Refeições (Com foto criptografada)
        mealsDb.run(`CREATE TABLE IF NOT EXISTS meal_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_name TEXT,
            role_type TEXT,
            food TEXT,
            drink TEXT,
            photo_data TEXT, -- Dados criptografados
            iv TEXT,         -- Vetor de inicialização da criptografia
            registered_by TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            date_str TEXT
        )`);
    });
}

module.exports = mealsDb;