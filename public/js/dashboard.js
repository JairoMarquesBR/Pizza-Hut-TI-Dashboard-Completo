(function() {
    console.log("Dashboard: Módulo Carregado");

    // Elementos da DOM específicos desta página
    const elClients = document.getElementById('dash-clients');
    
    // Função de atualização local
    const updateDashboardTiles = async () => {
        try {
            const response = await fetch('/api/dashboard-data');
            
            // Se der erro de auth, o main.js já cuida, então só paramos
            if (response.status === 401) return;

            const data = await response.json();

            // Atualiza o Tile de Clientes
            if (elClients) {
                // Efeito visual apenas se o número mudou
                if (elClients.innerText !== data.clients.toString()) {
                    elClients.innerText = data.clients;
                    elClients.classList.add('pulse-green');
                    setTimeout(() => elClients.classList.remove('pulse-green'), 1000);
                }
            }

            // Aqui você poderia atualizar outros tiles se o backend enviasse mais dados
            // Ex: Pedidos pendentes, estoque, etc.

        } catch (error) {
            console.error("Erro ao atualizar tiles:", error);
        }
    };

    // 1. Executa imediatamente
    updateDashboardTiles();

    // 2. Define o intervalo na variável global 'window.currentInterval'
    // Isso permite que o roteador (main.js) limpe esse intervalo ao sair desta tela
    window.currentInterval = setInterval(updateDashboardTiles, 5000);

})();