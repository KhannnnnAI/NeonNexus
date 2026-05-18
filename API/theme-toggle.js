// --- THEME TOGGLE FUNCTIONALITY FOR ALL PAGES ---
// Theme state
let currentTheme = localStorage.getItem('theme') || 'dark';

// Initialize theme on load
document.documentElement.setAttribute('data-theme', currentTheme);

// --- THEME MANAGEMENT ---
function toggleTheme(e) {
  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('theme', currentTheme);
  
  // Update icon immediately
  const themeIcon = document.getElementById('theme-icon');
  if (themeIcon) {
    // Replace the entire element with a new one to ensure icon changes
    const newIcon = document.createElement('i');
    newIcon.setAttribute('data-lucide', currentTheme === 'dark' ? 'moon' : 'sun');
    newIcon.className = 'theme-icon';
    newIcon.id = 'theme-icon';
    
    // Replace the old icon
    themeIcon.parentNode.replaceChild(newIcon, themeIcon);
    
    // Recreate icons
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }
}

// Initialize theme toggle when DOM is ready
function initThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  
  // Set initial icon immediately
  if (themeIcon) {
    themeIcon.setAttribute('data-lucide', currentTheme === 'dark' ? 'moon' : 'sun');
    // Ensure icons are created after DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (window.lucide) window.lucide.createIcons();
      });
    } else {
      if (window.lucide) window.lucide.createIcons();
    }
  }
  
  if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
  }
}

// Auto-initialize when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeToggle);
} else {
  initThemeToggle();
}
