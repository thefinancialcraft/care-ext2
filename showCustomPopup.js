// Avoid duplicating the popup
if (!document.getElementById('faveo-popup')) {
    const popup = document.createElement('div');
    popup.id = 'faveo-popup';
    popup.style.cssText = `
      position: fixed;
      width: 350px;
      top: 20px;
      right: -300px; /* Start off-screen */
      background-color: #ff4d4d;
      color: white;
      text-align: center;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      font-family: sans-serif;
      z-index: 999999;
      transition: right .5s ease-in-out;
    `;
  
    popup.textContent = '⚠️ Please Open Faveo Dashboard.';
    document.body.appendChild(popup);
  
    // Trigger slide-in effect
    requestAnimationFrame(() => {
      popup.style.right = '20px';
    });
  
    // Slide out and remove after 3 seconds
    setTimeout(() => {
      popup.style.right = '-300px';
      setTimeout(() => popup.remove(), 500); // Wait for transition to finish
    }, 5000);
  }
  