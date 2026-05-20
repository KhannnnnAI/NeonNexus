var collection = function(dbRef, ...segments) { var ref = dbRef; for (var i = 0; i < segments.length; i++) { ref = (i % 2 === 0) ? ref.collection(segments[i]) : ref.doc(segments[i]); } return ref; }; var addDoc = function(ref, data) { return ref.add(data); }; var serverTimestamp = function() { return firebase.firestore.FieldValue.serverTimestamp(); };
var onAuthStateChanged = function(authInst, cb) { return authInst.onAuthStateChanged(cb); };

document.addEventListener("DOMContentLoaded", () => {
  const syncCyberSelectDisplay = (select) => {
    if (!select) return;
    const wrapper = select.closest('.cyber-select-wrapper');
    if (!wrapper) return;

    const displayBox = wrapper.querySelector('.cyber-select-display');
    const displayText = displayBox ? displayBox.querySelector('span') : null;
    const selectedOption = select.options[select.selectedIndex];

    if (displayText && selectedOption) {
      displayText.textContent = selectedOption.text;
    }

    if (displayBox) {
      displayBox.classList.toggle('disabled', !!select.disabled);
    }
  };

  // --- CUSTOM CYBERPUNK DROPDOWN LOGIC ---
  const selects = document.querySelectorAll('select.support-form-control');
  selects.forEach(select => {
    // Hide original select
    select.style.display = 'none';
    const legacyIcon = select.parentElement.querySelector('i[data-lucide="chevron-down"]');
    if (legacyIcon) {
      legacyIcon.style.display = 'none';
    }
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'cyber-select-wrapper';
    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    
    // Create visible display box
    const displayBox = document.createElement('div');
    displayBox.className = 'cyber-select-display support-form-control';
    displayBox.innerHTML = `<span>${select.options[select.selectedIndex].text}</span> <i data-lucide="chevron-down" class="cyber-select-icon"></i>`;
    wrapper.appendChild(displayBox);
    
    // Create options container
    const optionsContainer = document.createElement('div');
    optionsContainer.className = 'cyber-select-options';
    
    // Populate options
    Array.from(select.options).forEach((option, index) => {
        if (option.disabled && option.value === "") return; // Skip placeholder
        
        const optDiv = document.createElement('div');
        optDiv.className = 'cyber-select-option';
        optDiv.textContent = option.text;
        optDiv.dataset.value = option.value;
        
        optDiv.addEventListener('click', (e) => {
            if (select.disabled) return;
            e.stopPropagation();
            select.value = option.value;
            displayBox.querySelector('span').textContent = option.text;
            optionsContainer.classList.remove('open');
            displayBox.classList.remove('active');
            
            // Dispatch change event to trigger the COMM LINK logic
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
        });
        
        optionsContainer.appendChild(optDiv);
    });
    
    wrapper.appendChild(optionsContainer);
    
    // Toggle dropdown
    displayBox.addEventListener('click', (e) => {
        if (select.disabled) return;
        e.stopPropagation();
        const isOpen = optionsContainer.classList.contains('open');
        
        // Close all other dropdowns
        document.querySelectorAll('.cyber-select-options').forEach(c => c.classList.remove('open'));
        document.querySelectorAll('.cyber-select-display').forEach(d => d.classList.remove('active'));
        
        if (!isOpen) {
            optionsContainer.classList.add('open');
            displayBox.classList.add('active');
        }
    });

    syncCyberSelectDisplay(select);
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', () => {
      document.querySelectorAll('.cyber-select-options').forEach(c => c.classList.remove('open'));
      document.querySelectorAll('.cyber-select-display').forEach(d => d.classList.remove('active'));
  });
  // --- END CUSTOM DROPDOWN LOGIC ---

  const accountTypeSelect = document.getElementById('ticket-account-type');
  const comLinkInput = document.getElementById('ticket-email');
  const comLinkLabel = document.getElementById('ticket-email-label');
  let boundAuthContext = null;

  const getSteamId = (user) => {
    if (!user) return '';
    if (user.steamId) return String(user.steamId);
    if (typeof user.uid === 'string' && /^\d{17}$/.test(user.uid)) return user.uid;
    if (typeof user.email === 'string') {
      const match = user.email.match(/^(\d{17})@steam\.com$/i);
      if (match) return match[1];
    }
    return '';
  };

  const detectAccountType = (user) => {
    if (!user) return 'google';
    if (user.provider === 'steam') return 'steam';
    const providerId = user.providerData && user.providerData.length > 0
      ? user.providerData[0].providerId
      : '';
    if (providerId === 'google.com') return 'google';
    if (providerId === 'steam') return 'steam';
    if (getSteamId(user)) return 'steam';
    return 'google';
  };

  const buildBoundAuthContext = (user) => {
    const accountType = detectAccountType(user);
    const steamId = getSteamId(user);
    const accountIdentifier = accountType === 'steam'
      ? steamId
      : (user.email || '');

    return {
      accountType,
      accountIdentifier,
      displayName: user.displayName || 'Gamer',
      email: user.email || '',
      steamId,
      provider: user.provider || accountType,
      uid: user.uid || ''
    };
  };

  const applyBoundAuthToForm = (context) => {
    if (!accountTypeSelect || !comLinkInput || !comLinkLabel) return;

    boundAuthContext = context;

    const isSteam = context.accountType === 'steam';

    accountTypeSelect.value = isSteam ? 'steam' : 'google';
    accountTypeSelect.disabled = true;
    syncCyberSelectDisplay(accountTypeSelect);

    comLinkLabel.textContent = isSteam ? 'STEAM ID' : 'GOOGLE EMAIL';
    comLinkInput.disabled = false;
    comLinkInput.readOnly = true;
    comLinkInput.type = isSteam ? 'text' : 'email';
    comLinkInput.placeholder = isSteam ? 'Your Steam ID' : 'Your Google Email';
    comLinkInput.value = context.accountIdentifier || '';
    comLinkInput.style.opacity = '1';
    comLinkInput.style.cursor = 'not-allowed';
  };

  const checkGuestLock = (user) => {
    const wrapper = document.querySelector('.support-form-wrapper');
    if (!wrapper) return;

    // Remove any existing overlay first
    const existingOverlay = wrapper.querySelector('.support-lock-overlay');
    if (existingOverlay) {
      existingOverlay.remove();
    }

    if (user && (user.isGuest || user.provider === 'guest')) {
      // Create cyberpunk lock overlay
      const overlay = document.createElement('div');
      overlay.className = 'support-lock-overlay';
      overlay.innerHTML = `
        <div class="lock-glow"></div>
        <i data-lucide="shield-alert" class="lock-warning-icon"></i>
        <h3 class="lock-title">ACCESS_RESTRICTED</h3>
        <p class="lock-desc">GUEST ACCOUNTS ARE NOT PERMITTED TO INITIATE SUPPORT TICKETS. PLEASE LOG IN WITH A FULL ACCOUNT TO RESOLVE SYSTEM ERRORS.</p>
        <button type="button" class="lock-login-btn support-submit-btn" style="width: auto; padding: 0.75rem 2rem;">
          LOG IN / SIGN UP
        </button>
      `;

      // Prevent interaction with form elements
      const formElements = wrapper.querySelectorAll('input, select, textarea, button');
      formElements.forEach(el => {
        if (!el.classList.contains('lock-login-btn')) {
          el.disabled = true;
        }
      });

      // Bind button action to open login modal
      const lockLoginBtn = overlay.querySelector('.lock-login-btn');
      if (lockLoginBtn) {
        lockLoginBtn.addEventListener('click', (e) => {
          e.preventDefault();
          document.getElementById('login-btn')?.click();
        });
      }

      wrapper.appendChild(overlay);
      
      // Re-init lucide icons inside the overlay
      if (window.lucide) {
        window.lucide.createIcons();
      }
    } else {
      // Re-enable form elements (except the ones that should be disabled naturally like bound email/account type)
      const formElements = wrapper.querySelectorAll('input, select, textarea, button');
      formElements.forEach(el => {
        if (el.id !== 'ticket-email' && el.id !== 'ticket-account-type') {
          el.disabled = false;
        }
      });
    }
  };

  const resetBoundAuthForm = () => {
    checkGuestLock(null);
    boundAuthContext = null;

    if (!accountTypeSelect || !comLinkInput || !comLinkLabel) return;

    accountTypeSelect.value = '';
    accountTypeSelect.disabled = true;
    syncCyberSelectDisplay(accountTypeSelect);

    comLinkLabel.textContent = 'COMM LINK';
    comLinkInput.value = '';
    comLinkInput.type = 'text';
    comLinkInput.placeholder = 'LOGIN REQUIRED';
    comLinkInput.readOnly = true;
    comLinkInput.disabled = true;
    comLinkInput.style.opacity = '0.75';
    comLinkInput.style.cursor = 'not-allowed';
  };

  const bindLoggedInAccount = (user) => {
    checkGuestLock(user);

    if (!user) {
      resetBoundAuthForm();
      return;
    }

    const context = buildBoundAuthContext(user);
    if (!context.accountIdentifier) {
      resetBoundAuthForm();
      return;
    }

    applyBoundAuthToForm(context);
  };

  // Re-init icons for dynamic elements
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // FAQ Accordion Logic (Smooth Animations)
  const faqToggles = document.querySelectorAll('.faq-toggle');
  faqToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const item = toggle.closest('.support-faq-item');
      if (!item) return;
      const isActive = item.classList.contains('active');
      
      // Close all others
      document.querySelectorAll('.support-faq-item').forEach(i => {
          i.classList.remove('active');
      });
      
      if (!isActive) {
        item.classList.add('active');
      }
    });
  });

  // Bind support ticket to currently logged-in account
  resetBoundAuthForm();

  let initialUser = null;
  try {
    const rawSession = localStorage.getItem("dashboard_auth_session_v1");
    if (rawSession) {
      initialUser = JSON.parse(rawSession);
    }
  } catch (e) {
    console.warn('Failed to parse dashboard session on load', e);
  }

  if (!initialUser) {
    const savedSteamUser = localStorage.getItem('steam_user');
    if (savedSteamUser) {
      try {
        initialUser = JSON.parse(savedSteamUser);
      } catch (e) {
        console.warn('Failed to parse steam_user from localStorage', e);
      }
    }
  }

  if (initialUser) {
    bindLoggedInAccount(initialUser);
  }

  if (window.__firebaseAuth) {
    const existingUser = window.__firebaseAuth.currentUser;
    if (existingUser && existingUser.providerData && existingUser.providerData.length > 0) {
      bindLoggedInAccount(existingUser);
    }

    onAuthStateChanged(window.__firebaseAuth, (user) => {
      const steamCache = localStorage.getItem('steam_user');
      if (steamCache) {
        try {
          bindLoggedInAccount(JSON.parse(steamCache));
          return;
        } catch (e) {
 console.warn('Invalid steam_user cache', e);
        }
      }

      if (user && user.providerData && user.providerData.length > 0) {
        bindLoggedInAccount(user);
      } else if (!user) {
        resetBoundAuthForm();
      }
    });
  }

  window.addEventListener('user-login', (event) => {
    const user = event && event.detail ? event.detail.user : null;
    if (user) {
      bindLoggedInAccount(user);
    }
  });

  window.addEventListener('user-logout', () => {
    resetBoundAuthForm();
  });

  // Smart Ticket logic
  const ticketMessage = document.getElementById('ticket-message');
  const suggestionBox = document.getElementById('smart-suggestion-box');
  const suggestionText = document.getElementById('smart-suggestion-text');
  const btnSolved = document.getElementById('btn-solved');
  const btnContinue = document.getElementById('btn-continue');
  const closeSuggestion = document.getElementById('close-suggestion');
  const form = document.getElementById('support-ticket-form');
  const submitBtn = document.getElementById('submit-ticket-btn');

  let suggestionDismissed = false;

  const smartAnswers = [
    {
      keywords: ['refund', 'money back', 'return'],
      answer: "We noticed you're asking about a refund. Refunds are only available if the key has NOT been revealed. If you haven't viewed the key, please select 'Account & Billing' as the subject."
    },
    {
      keywords: ['did not receive', 'missing key', 'where is my key'],
      answer: "Can't find your key? Please check the 'My Keys' section in your account profile. It usually appears there instantly after payment."
    },
    {
      keywords: ['activate', 'how to use', 'redeem', 'enter code', 'enter key'],
      answer: "To activate your Steam key: Open Steam -> Click 'Games' at the top -> 'Activate a Product on Steam' -> Follow the prompts and paste your key."
    },
    {
      keywords: ['error', 'bug', 'cannot login'],
      answer: "If you're experiencing a website error, clearing your browser cache or trying an incognito window often resolves it. If it persists, please submit this ticket."
    }
  ];

  if(ticketMessage) {
    ticketMessage.addEventListener('input', () => {
      if (suggestionDismissed) return;
      
      const text = ticketMessage.value.toLowerCase();
      
      if (text.length > 10) {
        let matched = null;
        for (const item of smartAnswers) {
          if (item.keywords.some(kw => text.includes(kw))) {
            matched = item;
            break;
          }
        }

        if (matched) {
          suggestionText.textContent = matched.answer;
          suggestionBox.style.display = 'block';
          setTimeout(() => {
            suggestionBox.style.opacity = '1';
            suggestionBox.style.pointerEvents = 'auto';
            suggestionBox.style.transform = 'translateY(0)';
          }, 10);
        } else {
          hideSuggestion();
        }
      } else {
        hideSuggestion();
      }
    });
  }

  function hideSuggestion() {
    if(suggestionBox) {
        suggestionBox.style.opacity = '0';
        suggestionBox.style.pointerEvents = 'none';
        suggestionBox.style.transform = 'translateY(8px)';
        setTimeout(() => {
        suggestionBox.style.display = 'none';
        }, 300);
    }
  }

  if(btnSolved) {
      btnSolved.addEventListener('click', () => {
        hideSuggestion();
        ticketMessage.value = '';
        showNotification('Glad we could help!', 'success');
      });
  }

  if(btnContinue) {
      btnContinue.addEventListener('click', () => {
        suggestionDismissed = true;
        hideSuggestion();
      });
  }

  if(closeSuggestion) {
      closeSuggestion.addEventListener('click', () => {
        suggestionDismissed = true;
        hideSuggestion();
      });
  }

  // Handle Submit
  if(form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const db = window.__firestoreDB;
        if (!db) {
          showNotification('Database connection established locally for demo.', 'warning');
 console.warn("Firestore instance not found. Ticket not saved.");
          return;
        }
        const authUser = window.__firebaseAuth && window.__firebaseAuth.currentUser;
        if (!authUser) {
          showNotification('Please login before submitting a support ticket.', 'warning');
          return;
        }
        if (!boundAuthContext || !boundAuthContext.accountIdentifier) {
          showNotification('Ticket must be linked to your logged-in account. Please login again.', 'warning');
          return;
        }

        const email = boundAuthContext.email || boundAuthContext.accountIdentifier;
        const subject = document.getElementById('ticket-subject').value;
        const accountType = boundAuthContext.accountType || 'other';
        const accountIdentifier = boundAuthContext.accountIdentifier;
        const message = ticketMessage.value;

        const originalBtnHTML = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i data-lucide="loader" class="w-5 h-5 animate-spin"></i> Submitting...';
        submitBtn.disabled = true;
        if (window.lucide) window.lucide.createIcons();

        try {
          const docRef = await addDoc(collection(db, "support_tickets"), {
            email,
            accountIdentifier,
            accountType,
            provider: boundAuthContext.provider || accountType,
            displayName: boundAuthContext.displayName || '',
            steamId: boundAuthContext.steamId || null,
            subject,
            message,
            status: "open",
            createdAt: serverTimestamp(),
            userId: authUser.uid
          });
          
 console.log("Ticket written with ID: ", docRef.id);
          showNotification('Success! Your ticket has been submitted.', 'success');
          form.reset();
          applyBoundAuthToForm(boundAuthContext);
          suggestionDismissed = false; // reset for next ticket
        } catch (error) {
 console.error("Error adding document: ", error);
          if (error.code === 'permission-denied') {
             showNotification('Permission denied: You cannot submit a ticket. Security rules need adjustment.', 'error');
          } else {
             showNotification('Error submitting ticket. Please try again.', 'error');
          }
        } finally {
          submitBtn.innerHTML = originalBtnHTML;
          submitBtn.disabled = false;
          if (window.lucide) window.lucide.createIcons();
        }
      });
  }

  function showNotification(message, type = "info") {
    // Try to use the global notification from auth.js If exists
    if (typeof window.showNotification === 'function') {
      window.showNotification(message, type);
      return;
    }
    
    // Fallback UI
    const existing = document.querySelector('.custom-notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `custom-notification ${type}`;
    
    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-circle';
    if (type === 'warning') iconName = 'alert-triangle';
    
    notification.innerHTML = `
      <i data-lucide="${iconName}" class="notification-icon"></i>
      <div class="notification-content">
        <div class="notification-title">${type === 'info' ? 'Info' : (type === 'error' ? 'Error' : (type === 'warning' ? 'Warning' : 'Success'))}</div>
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close" onclick="this.parentElement.remove()">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    `;
    
    document.body.appendChild(notification);
    if (window.lucide) window.lucide.createIcons();
    
    requestAnimationFrame(() => notification.classList.add('active'));
    setTimeout(() => {
      if (notification.parentElement) {
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
      }
    }, 3000);
  }

  // File Upload Display Logic
  const fileInput = document.getElementById('ticket-attachment');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const display = e.target.nextElementSibling;
      const nameSpan = display ? display.querySelector('.cyber-file-name') : null;
      if (!nameSpan) return;

      if (e.target.files && e.target.files.length > 0) {
        nameSpan.textContent = "PAYLOAD_READY: " + e.target.files[0].name;
        display.classList.add('has-file');
      } else {
        nameSpan.textContent = "SELECT FILE TO UPLOAD...";
        display.classList.remove('has-file');
      }
    });
  }
});

