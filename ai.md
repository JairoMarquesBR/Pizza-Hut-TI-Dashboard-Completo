#PROMPT INICIAL#
crie uma dashboard eficiente e elegante, estilo materialize. Ela servirá para conter ferramentas de controle de redes que futuramente será criadas e exibidas em tiles. tambem tem uma barra de menu com subcategorias bem caracteristicos dos programas da microsoft. e uma barra de status na parte inferior que contem iformações uteis atualizadas em tempo real.
separe o estilo em um arquivo css e adicione funções de java script
deve ser elegante para celulares pequenos e telas grandes como monitores ultra wides. deixe o footer fixo, e adicione mais funções. como a quantidade de dispositivos conectados na rede e etc. A temática é pizzaria e deve ter opções de tema claro e escuro.

# Prompt de Geração de Dashboard: PizzaNet Control

Copie e cole o texto abaixo em uma IA generativa de código para replicar o sistema de dashboard.

---

## Contexto e Role
Você é um Desenvolvedor Front-end Sênior especialista em UX/UI e no framework **Materialize CSS**. Sua tarefa é criar uma interface de dashboard web moderna, responsiva e funcional.

## Descrição do Projeto
Crie uma dashboard para controle de redes com a temática de uma **Pizzaria** (chamada "PizzaNet"). A interface deve misturar a estética web moderna (Material Design) com a funcionalidade de softwares desktop clássicos (menus estilo Microsoft).

## Requisitos Técnicos
1.  **Stack:** HTML5, CSS3 (com variáveis CSS), JavaScript Vanilla (ES6+).
2.  **Framework:** Utilize o **Materialize CSS 1.0.0** via CDN.
3.  **Estrutura de Arquivos:** Separe o código obrigatoriamente em `index.html`, `style.css` e `script.js`.

## Requisitos de Design e Layout
1.  **Barra de Navegação (Estilo Híbrido):**
    * Deve conter a marca e um botão para alternar tema (Claro/Escuro).
    * **Menu Desktop:** Em vez de apenas links simples, utilize menus dropdown em texto estilo "Microsoft" (ex: Arquivo, Ferramentas, Exibir) que abrem submenus ao clicar.
    * **Mobile:** Menu "hambúrguer" lateral (Sidenav).
2.  **Área Principal (Tiles):**
    * O conteúdo deve ser exibido em "Tiles" (Cards).
    * **Responsividade Extrema:** O layout deve ser fluido.
        * Celular: 1 coluna.
        * Tablet/Desktop: 2 ou 3 colunas.
        * **Ultra-Wide:** Deve expandir para 4 ou mais colunas aproveitando toda a largura da tela (use container-fluid).
3.  **Barra de Status (Footer):**
    * Deve ser **fixa** na parte inferior da tela (sticky footer).
    * Deve conter informações úteis atualizadas em tempo real (ex: Status do Servidor, Quantidade de Dispositivos, Relógio).
4.  **Temática (Pizzaria):**
    * **Cores:** Use tons de Vermelho (tomate/pepperoni) como primária e Amarelo/Laranja (queijo) para destaques.
    * **Dark Mode:** Implemente um botão que alterna entre tema Claro e Escuro. A preferência deve ser salva no `localStorage`.

## Requisitos Funcionais (JavaScript)
1.  **Dados em Tempo Real:** Crie funções que simulem dados vivos na barra de status e nos cards (ex: altere randomicamente o número de dispositivos conectados na rede a cada 3 segundos).
2.  **Relógio:** Um relógio digital na barra de status atualizado a cada segundo.
3.  **Interatividade:** Os dropdowns e a sidebar mobile devem funcionar perfeitamente.

## Detalhes dos Cards (Exemplos de Conteúdo)
Crie cards relacionados a rede, mas com metáforas de pizzaria se possível, ou dados técnicos reais:
* Monitoramento de Tráfego (Entregas/Pacotes).
* Firewall (O Forno - Temperatura/Status).
* Clientes Wi-Fi Conectados (Clientes no salão).
* Latência/Ping.

---
**Gere o código completo e separado por arquivos agora.**

Role: Atue como um Desenvolvedor Front-end Sênior especialista em UX e no framework Materialize CSS.

Objetivo: Criar do zero uma dashboard web responsiva chamada "PizzaNet Manager".

Requisitos Técnicos:

Stack: HTML5, CSS3, JavaScript Vanilla (ES6+) e Materialize CSS (v1.0.0).

Arquitetura: O código deve ser obrigatoriamente dividido em 4 arquivos: index.html, style.css, script.js e modal-template.html.

Método de Carregamento: O conteúdo das janelas modais deve ser carregado dinamicamente de um arquivo externo (modal-template.html) utilizando a Fetch API do JavaScript.

Requisitos de Design (UI/UX):

Temática: Estilo "Pizzaria" (Cores: Vermelho Tomate e Amarelo Queijo).

Dark Mode: Implementar um sistema robusto de tema Claro/Escuro que salva a preferência do usuário no localStorage.

Navegação Híbrida:

Desktop: Barra superior com menus dropdown em formato de texto (estilo "Microsoft/Windows": Perfil, Ferramentas, Ajuda).

Mobile: Menu lateral (Sidenav) clássico.

Layout: Deve ser extremamente responsivo, comportando-se bem desde celulares até monitores Ultra-Wide (usando container fluido).

Rodapé: Barra de status fixa na parte inferior (sticky footer) exibindo informações do sistema.

Funcionalidades e Conteúdo:

Cards (Tiles): Na área principal, crie 4 cards interativos simulando ferramentas de negócio:

Cadastro de Clientes (com contador).

Lista de Compras (insumos).

Documentações Salvas.

Diagnóstico de Sistema.

Interatividade: Ao clicar em qualquer item do menu ou nos cards, o sistema deve abrir a modal, carregar o conteúdo externo via fetch e exibir um formulário simulado.

Simulação em Tempo Real: O JavaScript deve simular "vida" na dashboard:

Um relógio digital atualizado a cada segundo no rodapé.

Números nos cards (como novos clientes ou dispositivos conectados) mudando aleatoriamente a cada poucos segundos.

Instrução Final: Gere o código completo e estruturado para os 4 arquivos solicitados, garantindo que os formulários do Materialize funcionem corretamente (reinicialização de inputs) após o carregamento dinâmico na modal.

