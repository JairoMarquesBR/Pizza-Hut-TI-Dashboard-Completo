// --- LÓGICA DE ACESSO REMOTO ---
(function() {
    console.log("Remote Module Loaded");

    // Função Scan disponível para o HTML desta página
    window.scanNetwork = function() {
        const tbody = document.getElementById('remote-list');
        tbody.innerHTML = '<tr><td colspan="5" class="center"><div class="progress red lighten-4"><div class="indeterminate red"></div></div><br>Escanenando rede local...</td></tr>';

        // Simula latência de rede
        setTimeout(() => {
            // Mock de dados (Em produção viria do backend)
            const hosts = [
                { name: 'PDV-CAIXA-01', ip: '192.168.0.101', os: 'Windows 10', status: 'online' },
                { name: 'PDV-CAIXA-02', ip: '192.168.0.102', os: 'Windows 10', status: 'online' },
                { name: 'KDS-COZINHA', ip: '192.168.0.200', os: 'Android TV', status: 'online' },
                { name: 'GERENCIA-PC', ip: '192.168.0.150', os: 'Windows 11', status: 'offline' }
            ];

            tbody.innerHTML = '';

            hosts.forEach(h => {
                const isOnline = h.status === 'online';
                const statusColor = isOnline ? 'green-text' : 'red-text';
                const statusIcon = isOnline ? 'check_circle' : 'error';
                
                // Botão de ação dinâmico
                const btn = isOnline 
                    ? `<button class="btn-small pizza-red waves-effect" onclick="connectToHost('${h.ip}')">Conectar</button>`
                    : `<button class="btn-small grey lighten-2 grey-text disabled">Offline</button>`;

                const row = `
                    <tr>
                        <td class="${statusColor}"><i class="material-icons left tiny">${statusIcon}</i>${h.status.toUpperCase()}</td>
                        <td style="font-weight:bold">${h.name}</td>
                        <td class="grey-text">${h.ip}</td>
                        <td>${h.os}</td>
                        <td>${btn}</td>
                    </tr>
                `;
                tbody.innerHTML += row;
            });
        }, 2000);
    };

    // Função de Conexão
    window.connectToHost = function(ip) {
        M.toast({html: `Iniciando protocolo RDP para ${ip}...`, classes: 'blue rounded'});
    };

})();