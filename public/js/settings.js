document.addEventListener('DOMContentLoaded', () => {
    // Carrega tema correto
    checkThemePreference();

    const form = document.getElementById('settings-form');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Simula salvamento
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            
            btn.disabled = true;
            btn.innerText = "Salvando...";

            setTimeout(() => {
                btn.disabled = false;
                btn.innerText = originalText;
                
                // Mostra Toast do Bootstrap
                const toastEl = document.getElementById('saveToast');
                const toast = new bootstrap.Toast(toastEl);
                toast.show();
                
            }, 800);
        });
    }
});