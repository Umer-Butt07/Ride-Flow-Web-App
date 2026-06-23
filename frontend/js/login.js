const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000'
  : 'https://your-backend-api.onrender.com';

/* ============================================
   RideFlow — Login Page JavaScript
   ============================================
   Features:
   • Password show/hide toggle
   • Form validation with micro-interactions
   • Button loading state
   • Ripple effect on button click
   • Carousel dot interaction
   • Smooth UI enhancements
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ── DOM References ──
  const form           = document.getElementById('loginForm');
  const usernameInput  = document.getElementById('username');
  const passwordInput  = document.getElementById('password');
  const toggleBtn      = document.getElementById('togglePassword');
  const loginBtn       = document.getElementById('loginBtn');
  const usernameError  = document.getElementById('usernameError');
  const passwordError  = document.getElementById('passwordError');
  const carouselDots   = document.querySelectorAll('.carousel-dot');

  // ── Password Visibility Toggle ──
  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';

    // Toggle icon visibility
    const eyeOpen   = toggleBtn.querySelector('.eye-open');
    const eyeClosed = toggleBtn.querySelector('.eye-closed');
    eyeOpen.style.display   = isPassword ? 'none' : 'block';
    eyeClosed.style.display = isPassword ? 'block' : 'none';

    // Update ARIA label
    toggleBtn.setAttribute(
      'aria-label',
      isPassword ? 'Hide password' : 'Show password'
    );

    // Keep focus on input for better UX
    passwordInput.focus();
  });

  // ── Validation Helpers ──
  function showError(input, errorEl, message) {
    input.classList.add('input-error');
    input.classList.remove('input-success');
    errorEl.textContent = message;
    errorEl.classList.add('visible');
  }

  function clearError(input, errorEl) {
    input.classList.remove('input-error');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }

  function showSuccess(input, errorEl) {
    input.classList.remove('input-error');
    input.classList.add('input-success');
    errorEl.textContent = '';
    errorEl.classList.remove('visible');
  }

  function validateUsername() {
    const val = usernameInput.value.trim();
    if (!val) {
      showError(usernameInput, usernameError, 'Please enter your username');
      return false;
    }
    if (val.length < 3) {
      showError(usernameInput, usernameError, 'Username must be at least 3 characters');
      return false;
    }
    showSuccess(usernameInput, usernameError);
    return true;
  }

  function validatePassword() {
    const val = passwordInput.value;
    if (!val) {
      showError(passwordInput, passwordError, 'Please enter your password');
      return false;
    }
    if (val.length < 6) {
      showError(passwordInput, passwordError, 'Password must be at least 6 characters');
      return false;
    }
    showSuccess(passwordInput, passwordError);
    return true;
  }

  // ── Live Validation on Input ──
  usernameInput.addEventListener('input', () => {
    if (usernameInput.classList.contains('input-error')) {
      validateUsername();
    }
  });

  passwordInput.addEventListener('input', () => {
    if (passwordInput.classList.contains('input-error')) {
      validatePassword();
    }
  });

  // Clear error styling on focus
  usernameInput.addEventListener('focus', () => {
    if (!usernameInput.classList.contains('input-error')) {
      clearError(usernameInput, usernameError);
    }
  });

  passwordInput.addEventListener('focus', () => {
    if (!passwordInput.classList.contains('input-error')) {
      clearError(passwordInput, passwordError);
    }
  });

  // ── Ripple Effect on Button ──
  loginBtn.addEventListener('click', (e) => {
    // Don't create ripple if button is in loading state
    if (loginBtn.classList.contains('loading')) return;

    const rect = loginBtn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'btn-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
    loginBtn.appendChild(ripple);

    ripple.addEventListener('animationend', () => ripple.remove());
  });

  // ── Form Submission ──
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isUsernameValid = validateUsername();
    const isPasswordValid = validatePassword();

    if (!isUsernameValid || !isPasswordValid) {
      // Shake animation on invalid fields
      const invalidInputs = form.querySelectorAll('.input-error');
      invalidInputs.forEach((input) => {
        input.style.animation = 'shake 0.4s ease';
        input.addEventListener('animationend', () => {
          input.style.animation = '';
        }, { once: true });
      });
      return;
    }

    // Simulate loading state
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    // Real API call
    try {
      const emailValue = usernameInput.value.trim();
      const passwordValue = passwordInput.value;

      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailValue, password: passwordValue })
      });
      const data = await res.json();
      
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;

      if (!res.ok) {
        alert(data.error || 'Login failed');
        return;
      }

      // Store token and user data
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Success feedback
      loginBtn.querySelector('.btn-text').textContent = '✓ SUCCESS';
      loginBtn.style.background = '#16a34a';

      // Fade-out the entire container before redirect
      const authContainer = document.getElementById('authContainer');
      authContainer.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      authContainer.style.opacity = '0';
      authContainer.style.transform = 'scale(0.98)';

      // Redirect to specific dashboard based on role
      setTimeout(() => {
        if (data.user.role === 'Rider') {
          window.location.href = 'pages/rider/rider-dashboard.html';
        } else if (data.user.role === 'Driver') {
          window.location.href = 'pages/driver/driver-dashboard.html';
        } else if (data.user.role === 'Admin') {
          window.location.href = 'pages/admin/admin-dashboard.html';
        } else {
          alert('Unknown role: ' + data.user.role);
        }
      }, 600);
    } catch (err) {
      console.error(err);
      alert('Network error or server down.');
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  });

  // ── Carousel Dots Interaction ──
  carouselDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      carouselDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  // Auto-cycle carousel dots
  let activeDot = 0;
  setInterval(() => {
    carouselDots.forEach(d => d.classList.remove('active'));
    activeDot = (activeDot + 1) % carouselDots.length;
    carouselDots[activeDot].classList.add('active');
  }, 4000);

  // ── Inject Shake Keyframe ──
  const shakeStyle = document.createElement('style');
  shakeStyle.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-6px); }
      40% { transform: translateX(6px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(shakeStyle);
});
