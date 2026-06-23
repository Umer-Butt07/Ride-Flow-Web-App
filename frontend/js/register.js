const API_BASE_URL = CONFIG.API_BASE_URL;

/* ============================================
   RideFlow — Registration Page JavaScript
   ============================================
   Features:
   • Rider/Driver toggle with sliding animation
   • Password show/hide toggles
   • Real-time password match indicator
   • Full form validation with error states
   • Button loading state & ripple effect
   • Carousel dot auto-cycling
   • Shake animation on invalid fields
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  'use strict';

  // ── DOM References ──
  const form                = document.getElementById('registerForm');
  const firstNameInput      = document.getElementById('firstName');
  const lastNameInput       = document.getElementById('lastName');
  const emailInput          = document.getElementById('email');
  const phoneInput          = document.getElementById('phone');
  const passwordInput       = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const togglePassword      = document.getElementById('togglePassword');
  const toggleConfirmPwd    = document.getElementById('toggleConfirmPassword');
  const registerBtn         = document.getElementById('registerBtn');
  const roleToggle          = document.getElementById('roleToggle');
  const riderBtn            = document.getElementById('riderBtn');
  const driverBtn           = document.getElementById('driverBtn');
  const matchIndicator      = document.getElementById('matchIndicator');
  const matchIcon           = document.getElementById('matchIcon');
  const matchText           = document.getElementById('matchText');
  const carouselDots        = document.querySelectorAll('.carousel-dot');
  const driverFields        = document.getElementById('driverFields');
  const cnicInput           = document.getElementById('cnic');
  const licenseInput        = document.getElementById('licenseNumber');
  const profilePictureInput = document.getElementById('profilePicture');
  const vehicleMakeInput    = document.getElementById('vehicleMake');
  const vehicleModelInput   = document.getElementById('vehicleModel');
  const vehicleTypeInput    = document.getElementById('vehicleType');
  const licensePlateInput   = document.getElementById('licensePlate');
  const vehicleYearInput    = document.getElementById('vehicleYear');
  const vehicleColorInput   = document.getElementById('vehicleColor');
  const driverCityInput     = document.getElementById('driverCity');

  // Error elements
  const firstNameError      = document.getElementById('firstNameError');
  const lastNameError       = document.getElementById('lastNameError');
  const emailError          = document.getElementById('emailError');
  const phoneError          = document.getElementById('phoneError');
  const passwordError       = document.getElementById('passwordError');
  const confirmPasswordError = document.getElementById('confirmPasswordError');
  const cnicError           = document.getElementById('cnicError');
  const licenseError        = document.getElementById('licenseError');
  const profilePictureError = document.getElementById('profilePictureError');
  const vehicleMakeError    = document.getElementById('vehicleMakeError');
  const vehicleModelError   = document.getElementById('vehicleModelError');
  const vehicleTypeError    = document.getElementById('vehicleTypeError');
  const licensePlateError   = document.getElementById('licensePlateError');
  const vehicleYearError    = document.getElementById('vehicleYearError');
  const vehicleColorError   = document.getElementById('vehicleColorError');
  const driverCityError     = document.getElementById('driverCityError');

  // Current role state
  let selectedRole = 'rider';

  // ── Role Toggle Logic ──
  riderBtn.addEventListener('click', () => switchRole('rider'));
  driverBtn.addEventListener('click', () => switchRole('driver'));

  function switchRole(role) {
    selectedRole = role;

    if (role === 'rider') {
      roleToggle.classList.remove('driver-active');
      riderBtn.classList.add('active');
      riderBtn.setAttribute('aria-checked', 'true');
      driverBtn.classList.remove('active');
      driverBtn.setAttribute('aria-checked', 'false');
      // Hide driver-specific fields
      driverFields.classList.remove('visible');
    } else {
      roleToggle.classList.add('driver-active');
      driverBtn.classList.add('active');
      driverBtn.setAttribute('aria-checked', 'true');
      riderBtn.classList.remove('active');
      riderBtn.setAttribute('aria-checked', 'false');
      // Show driver-specific fields
      driverFields.classList.add('visible');
    }

    // Clear driver field errors when toggling
    clearError(cnicInput, cnicError);
    clearError(licenseInput, licenseError);
    if (profilePictureInput) clearError(profilePictureInput, profilePictureError);
    if (vehicleMakeInput) clearError(vehicleMakeInput, vehicleMakeError);
    if (vehicleModelInput) clearError(vehicleModelInput, vehicleModelError);
    if (licensePlateInput) clearError(licensePlateInput, licensePlateError);
    if (vehicleYearInput) clearError(vehicleYearInput, vehicleYearError);
    if (vehicleColorInput) clearError(vehicleColorInput, vehicleColorError);
    if (driverCityInput) clearError(driverCityInput, driverCityError);
    cnicInput.value = '';
    licenseInput.value = '';
    if (profilePictureInput) profilePictureInput.value = '';
    if (vehicleMakeInput) vehicleMakeInput.value = '';
    if (vehicleModelInput) vehicleModelInput.value = '';
    if (licensePlateInput) licensePlateInput.value = '';
    if (vehicleYearInput) vehicleYearInput.value = '';
    if (vehicleColorInput) vehicleColorInput.value = '';
    if (driverCityInput) driverCityInput.value = '';
  }

  // Keyboard navigation for toggle
  roleToggle.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      switchRole(selectedRole === 'rider' ? 'driver' : 'rider');
      const activeBtn = selectedRole === 'rider' ? riderBtn : driverBtn;
      activeBtn.focus();
    }
  });

  // ── Password Visibility Toggles ──
  function setupPasswordToggle(toggleBtn, inputField) {
    toggleBtn.addEventListener('click', () => {
      const isPassword = inputField.type === 'password';
      inputField.type = isPassword ? 'text' : 'password';

      const eyeOpen   = toggleBtn.querySelector('.eye-open');
      const eyeClosed = toggleBtn.querySelector('.eye-closed');
      eyeOpen.style.display   = isPassword ? 'none' : 'block';
      eyeClosed.style.display = isPassword ? 'block' : 'none';

      toggleBtn.setAttribute(
        'aria-label',
        isPassword ? 'Hide password' : 'Show password'
      );

      inputField.focus();
    });
  }

  setupPasswordToggle(togglePassword, passwordInput);
  setupPasswordToggle(toggleConfirmPwd, confirmPasswordInput);

  // ── Password Match Indicator ──
  function checkPasswordMatch() {
    const pwd     = passwordInput.value;
    const confirm = confirmPasswordInput.value;

    if (!confirm) {
      matchIndicator.classList.remove('visible', 'match', 'mismatch');
      return;
    }

    matchIndicator.classList.add('visible');

    if (pwd === confirm) {
      matchIndicator.classList.add('match');
      matchIndicator.classList.remove('mismatch');
      matchIcon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      matchText.textContent = 'Passwords match';
    } else {
      matchIndicator.classList.add('mismatch');
      matchIndicator.classList.remove('match');
      matchIcon.innerHTML = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
      matchText.textContent = 'Passwords do not match';
    }
  }

  confirmPasswordInput.addEventListener('input', checkPasswordMatch);
  passwordInput.addEventListener('input', () => {
    if (confirmPasswordInput.value) {
      checkPasswordMatch();
    }
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

  // Email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validation functions
  function validateFirstName() {
    const val = firstNameInput.value.trim();
    if (!val) {
      showError(firstNameInput, firstNameError, 'First name is required');
      return false;
    }
    if (val.length < 2) {
      showError(firstNameInput, firstNameError, 'At least 2 characters');
      return false;
    }
    showSuccess(firstNameInput, firstNameError);
    return true;
  }

  function validateLastName() {
    const val = lastNameInput.value.trim();
    if (!val) {
      showError(lastNameInput, lastNameError, 'Last name is required');
      return false;
    }
    if (val.length < 2) {
      showError(lastNameInput, lastNameError, 'At least 2 characters');
      return false;
    }
    showSuccess(lastNameInput, lastNameError);
    return true;
  }

  function validateEmail() {
    const val = emailInput.value.trim();
    if (!val) {
      showError(emailInput, emailError, 'Email is required');
      return false;
    }
    if (!emailRegex.test(val)) {
      showError(emailInput, emailError, 'Enter a valid email address');
      return false;
    }
    showSuccess(emailInput, emailError);
    return true;
  }

  function validatePhone() {
    const val = phoneInput.value.trim();
    if (!val) {
      showError(phoneInput, phoneError, 'Phone number is required');
      return false;
    }
    // Simple phone validation: at least 7 digits
    const digits = val.replace(/\D/g, '');
    if (digits.length < 7) {
      showError(phoneInput, phoneError, 'Enter a valid phone number');
      return false;
    }
    showSuccess(phoneInput, phoneError);
    return true;
  }

  function validatePassword() {
    const val = passwordInput.value;
    if (!val) {
      showError(passwordInput, passwordError, 'Password is required');
      return false;
    }
    if (val.length < 6) {
      showError(passwordInput, passwordError, 'At least 6 characters required');
      return false;
    }
    showSuccess(passwordInput, passwordError);
    return true;
  }

  function validateConfirmPassword() {
    const val = confirmPasswordInput.value;
    if (!val) {
      showError(confirmPasswordInput, confirmPasswordError, 'Please confirm your password');
      return false;
    }
    if (val !== passwordInput.value) {
      showError(confirmPasswordInput, confirmPasswordError, 'Passwords do not match');
      return false;
    }
    showSuccess(confirmPasswordInput, confirmPasswordError);
    return true;
  }

  // ── Driver-Specific Validation ──
  function validateCnic() {
    const val = cnicInput.value.trim();
    if (!val) {
      showError(cnicInput, cnicError, 'CNIC is required for drivers');
      return false;
    }
    // Pakistani CNIC format: 00000-0000000-0 (13 digits)
    const digits = val.replace(/\D/g, '');
    if (digits.length < 13) {
      showError(cnicInput, cnicError, 'Enter a valid 13-digit CNIC');
      return false;
    }
    showSuccess(cnicInput, cnicError);
    return true;
  }

  function validateLicense() {
    const val = licenseInput.value.trim();
    if (!val) {
      showError(licenseInput, licenseError, 'License number is required for drivers');
      return false;
    }
    if (val.length < 3) {
      showError(licenseInput, licenseError, 'Enter a valid license number');
      return false;
    }
    showSuccess(licenseInput, licenseError);
    return true;
  }

  function validateProfilePicture() {
    if (!profilePictureInput.files || profilePictureInput.files.length === 0) {
      showError(profilePictureInput, profilePictureError, 'Profile picture is required for drivers');
      return false;
    }
    showSuccess(profilePictureInput, profilePictureError);
    return true;
  }

  function validateVehicleMake() {
    if (!vehicleMakeInput.value.trim()) {
      showError(vehicleMakeInput, vehicleMakeError, 'Vehicle Make is required');
      return false;
    }
    showSuccess(vehicleMakeInput, vehicleMakeError);
    return true;
  }

  function validateVehicleModel() {
    if (!vehicleModelInput.value.trim()) {
      showError(vehicleModelInput, vehicleModelError, 'Vehicle Model is required');
      return false;
    }
    showSuccess(vehicleModelInput, vehicleModelError);
    return true;
  }

  function validateLicensePlate() {
    if (!licensePlateInput.value.trim()) {
      showError(licensePlateInput, licensePlateError, 'License Plate is required');
      return false;
    }
    showSuccess(licensePlateInput, licensePlateError);
    return true;
  }

  function validateVehicleYear() {
    const val = vehicleYearInput.value.trim();
    if (!val) {
      showError(vehicleYearInput, vehicleYearError, 'Vehicle Year is required');
      return false;
    }
    const year = parseInt(val);
    if (isNaN(year) || year < 1990 || year > 2025) {
      showError(vehicleYearInput, vehicleYearError, 'Enter a valid year');
      return false;
    }
    showSuccess(vehicleYearInput, vehicleYearError);
    return true;
  }

  function validateVehicleColor() {
    if (!vehicleColorInput.value.trim()) {
      showError(vehicleColorInput, vehicleColorError, 'Vehicle Color is required');
      return false;
    }
    showSuccess(vehicleColorInput, vehicleColorError);
    return true;
  }

  function validateDriverCity() {
    if (!driverCityInput.value) {
      showError(driverCityInput, driverCityError, 'Please select your operating city');
      return false;
    }
    showSuccess(driverCityInput, driverCityError);
    return true;
  }

  // ── Live Validation on Input (only after first error) ──
  const fieldValidators = [
    { input: firstNameInput,       error: firstNameError,       validate: validateFirstName },
    { input: lastNameInput,        error: lastNameError,        validate: validateLastName },
    { input: emailInput,           error: emailError,           validate: validateEmail },
    { input: phoneInput,           error: phoneError,           validate: validatePhone },
    { input: passwordInput,        error: passwordError,        validate: validatePassword },
    { input: confirmPasswordInput, error: confirmPasswordError, validate: validateConfirmPassword },
    { input: cnicInput,            error: cnicError,            validate: validateCnic },
    { input: licenseInput,         error: licenseError,         validate: validateLicense },
    { input: profilePictureInput,  error: profilePictureError,  validate: validateProfilePicture },
    { input: vehicleMakeInput,     error: vehicleMakeError,     validate: validateVehicleMake },
    { input: vehicleModelInput,    error: vehicleModelError,    validate: validateVehicleModel },
    { input: licensePlateInput,    error: licensePlateError,    validate: validateLicensePlate },
    { input: vehicleYearInput,     error: vehicleYearError,     validate: validateVehicleYear },
    { input: vehicleColorInput,    error: vehicleColorError,    validate: validateVehicleColor },
    { input: driverCityInput,      error: driverCityError,      validate: validateDriverCity },
  ];

  fieldValidators.forEach(({ input, error, validate }) => {
    input.addEventListener('input', () => {
      if (input.classList.contains('input-error')) {
        validate();
      }
    });

    input.addEventListener('focus', () => {
      if (!input.classList.contains('input-error')) {
        clearError(input, error);
      }
    });
  });

  // ── Ripple Effect on Button ──
  registerBtn.addEventListener('click', (e) => {
    if (registerBtn.classList.contains('loading')) return;

    const rect = registerBtn.getBoundingClientRect();
    const ripple = document.createElement('span');
    const size = Math.max(rect.width, rect.height);
    ripple.className = 'btn-ripple';
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
    ripple.style.top  = (e.clientY - rect.top  - size / 2) + 'px';
    registerBtn.appendChild(ripple);

    ripple.addEventListener('animationend', () => ripple.remove());
  });

  // ── Form Submission ──
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Run all validations
    const results = [
      validateFirstName(),
      validateLastName(),
      validateEmail(),
      validatePhone(),
      validatePassword(),
      validateConfirmPassword(),
    ];

    // Validate driver-specific fields only when Driver is selected
    if (selectedRole === 'driver') {
      results.push(validateCnic());
      results.push(validateLicense());
      results.push(validateProfilePicture());
      results.push(validateVehicleMake());
      results.push(validateVehicleModel());
      results.push(validateLicensePlate());
      results.push(validateVehicleYear());
      results.push(validateVehicleColor());
      results.push(validateDriverCity());
    }

    const allValid = results.every(Boolean);

    if (!allValid) {
      // Shake invalid inputs
      const invalidInputs = form.querySelectorAll('.input-error');
      invalidInputs.forEach((input) => {
        input.style.animation = 'shake 0.4s ease';
        input.addEventListener('animationend', () => {
          input.style.animation = '';
        }, { once: true });
      });

      // Scroll first error into view
      const firstInvalid = form.querySelector('.input-error');
      if (firstInvalid) {
        firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInvalid.focus();
      }
      return;
    }

    // Loading state
    registerBtn.classList.add('loading');
    registerBtn.disabled = true;

    // Real API call
    try {
      const role = selectedRole === 'driver' ? 'Driver' : 'Rider';
      const formData = new FormData();
      formData.append('firstName', firstNameInput.value.trim());
      formData.append('lastName', lastNameInput.value.trim());
      formData.append('email', emailInput.value.trim());
      formData.append('phone', phoneInput.value.trim());
      formData.append('password', passwordInput.value);
      formData.append('role', role);

      if (role === 'Driver') {
        formData.append('cnic', cnicInput.value.trim());
        formData.append('licenseNo', licenseInput.value.trim());
        formData.append('vehicleMake', vehicleMakeInput.value.trim());
        formData.append('vehicleModel', vehicleModelInput.value.trim());
        formData.append('vehicleType', vehicleTypeInput.value);
        formData.append('licensePlate', licensePlateInput.value.trim());
        formData.append('vehicleYear', vehicleYearInput.value.trim());
        formData.append('vehicleColor', vehicleColorInput.value.trim());
        formData.append('city', driverCityInput.value);
        if (profilePictureInput.files[0]) {
          formData.append('profilePicture', profilePictureInput.files[0]);
        }
      }

      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      registerBtn.classList.remove('loading');
      registerBtn.disabled = false;

      if (!res.ok) {
        alert(data.error || 'Registration failed');
        return;
      }

      // Store token and user data
      sessionStorage.setItem('token', data.token);
      sessionStorage.setItem('user', JSON.stringify(data.user));
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      // Success feedback
      const btnText = registerBtn.querySelector('.btn-text');
      btnText.textContent = '✓ Account Created!';
      registerBtn.style.background = '#16a34a';

      // Fade-out the entire container before redirect
      const authContainer = document.getElementById('authContainer');
      authContainer.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
      authContainer.style.opacity = '0';
      authContainer.style.transform = 'scale(0.98)';

      // Redirect to specific dashboard based on role
      setTimeout(() => {
        if (data.user.role === 'Rider') {
          window.location.href = '../rider/rider-dashboard.html';
        } else if (data.user.role === 'Driver') {
          window.location.href = '../driver/driver-dashboard.html';
        } else if (data.user.role === 'Admin') {
          window.location.href = '../admin/admin-dashboard.html';
        }
      }, 600);
    } catch (err) {
      console.error(err);
      alert('Network error or server down.');
      registerBtn.classList.remove('loading');
      registerBtn.disabled = false;
    }
  });

  // ── Carousel Dots ──
  carouselDots.forEach((dot) => {
    dot.addEventListener('click', () => {
      carouselDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
    });
  });

  // Auto-cycle carousel
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
