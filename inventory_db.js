const sqlite3 = require('sqlite3').verbose();

const invDb = new sqlite3.Database('./inventory.db', (err) => {
    if (err) {
        console.error('❌ ERRO AO CRIAR BANCO DE ESTOQUE:', err.message);
    } else {
        console.log('✅ Banco de Estoque (Inventory) CONECTADO.');
        initInventoryDb();
    }
});

function initInventoryDb() {
    invDb.serialize(() => {
        // 1. Tabela de Produtos
        invDb.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            unit TEXT NOT NULL,
            category TEXT NOT NULL,
            current_qty REAL DEFAULT 0,
            min_threshold REAL DEFAULT 0,
            is_out_of_stock INTEGER DEFAULT 0
        )`);

        // 2. Tabela de Histórico (Logs para PDF)
        invDb.run(`CREATE TABLE IF NOT EXISTS stock_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT, 
            product_id INTEGER,
            product_name TEXT,
            product_unit TEXT,
            qty_counted REAL,
            is_critical INTEGER,
            counted_by TEXT,
            count_date TEXT,
            count_time TEXT,
            category_context TEXT
        )`);

        // 3. Tabela de Alertas (NOVA)
        invDb.run(`CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            body TEXT,
            priority TEXT, -- 'high', 'low'
            status INTEGER, -- 1 (ativo), 0 (inativo)
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
    });
}

module.exports = invDb;