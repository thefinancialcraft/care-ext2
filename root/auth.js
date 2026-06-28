document.getElementById('submit').addEventListener('click', () => {
    const passwordInput = document.getElementById('password').value;
    const errorDiv = document.getElementById('error');
    
    // Generate the required password: TFC + current date (DDMMYY) + 1509
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    
    const requiredPassword = `TFC${day}${month}${year}1509`;
    const submitBtn = document.getElementById('submit');
    const btnText = document.getElementById('btn-text');
    const spinner = document.getElementById('spinner');
    
    // UI Update: Show spinner
    btnText.innerText = 'Unlocking...';
    spinner.style.display = 'inline-block';
    submitBtn.disabled = true;
    errorDiv.style.display = 'none';

    // Artificial delay for spinner visibility
    setTimeout(() => {
        if (passwordInput === requiredPassword) {
            chrome.tabs.getCurrent((tab) => {
                chrome.runtime.sendMessage({ type: 'UNLOCK_EXTENSIONS' });
            });
        } else {
            errorDiv.style.display = 'block';
            
            // Restore UI
            btnText.innerText = 'Unlock';
            spinner.style.display = 'none';
            submitBtn.disabled = false;
        }
    }, 800);
});
