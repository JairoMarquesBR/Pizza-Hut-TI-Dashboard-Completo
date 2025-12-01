const sqlite3 = require('sqlite3').verbose();

const storeDb = new sqlite3.Database('./store.db', (err) => {
    if (err) console.error('❌ Erro no DB Loja:', err.message);
    else {
        console.log('✅ Banco de Loja (Store) CONECTADO.');
        initStoreDb();
    }
});

function initStoreDb() {
    storeDb.serialize(() => {
        // Recria a tabela com a coluna support_email
        storeDb.run(`CREATE TABLE IF NOT EXISTS store_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            franchise_name TEXT,
            branch_name TEXT,
            cnpj TEXT,
            address TEXT,
            phone TEXT,
            manager_name TEXT,
            wifi_ssid TEXT,
            wifi_pass TEXT,
            server_ip TEXT,
            support_email TEXT, -- AQUI ESTÁ A COLUNA NOVA
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        
        // Cria a linha padrão se não existir
        storeDb.run(`INSERT OR IGNORE INTO store_config (id, franchise_name, branch_name) VALUES (1, 'Pizza Hut', 'Nova Filial')`);
    });
}

module.exports = storeDb;