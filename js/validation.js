/**
 * Balance Trust — client-side form validation. This is for user
 * convenience only; the backend validates every request again.
 */
const Validation = (() => {
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  const rules = {
    required: (v) => (String(v || '').trim() ? '' : 'This field is required.'),
    email: (v) => (!v || EMAIL_RE.test(String(v).trim()) ? '' : 'Enter a valid email address.'),
    password: (v) => (!v || (v.length >= 10 && /[A-Za-z]/.test(v) && /\d/.test(v)) ? '' : 'Use at least 10 characters with letters and numbers.'),
    code: (v) => (!v || /^\d{6}$/.test(String(v).trim()) ? '' : 'Enter the 6-digit code.')
  };

  /**
   * Validates inputs that declare data-rules="required email ..." and
   * data-match="otherFieldName". Marks invalid fields accessibly. Returns true
   * when the form is valid.
   */
  function validateForm(form) {
    let firstInvalid = null;
    form.querySelectorAll('[data-rules], [data-match]').forEach((input) => {
      let message = '';
      (input.dataset.rules || '').split(/\s+/).filter(Boolean).some((r) => {
        message = rules[r] ? rules[r](input.value) : '';
        return !!message;
      });
      if (!message && input.dataset.match) {
        const other = form.elements[input.dataset.match];
        if (other && other.value !== input.value) message = 'The passwords do not match.';
      }
      setFieldError(input, message);
      if (message && !firstInvalid) firstInvalid = input;
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function setFieldError(input, message) {
    const id = input.id + '-error';
    let fb = document.getElementById(id);
    if (!fb) {
      fb = document.createElement('div');
      fb.id = id;
      fb.className = 'invalid-feedback';
      input.insertAdjacentElement('afterend', fb);
    }
    fb.textContent = message || '';
    input.classList.toggle('is-invalid', !!message);
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', id);
    } else {
      input.removeAttribute('aria-invalid');
    }
  }

  /** Applies field errors returned by the API ({ fields: { name: message } }). */
  function applyServerErrors(form, fields) {
    if (!fields) return false;
    let first = null;
    Object.keys(fields).forEach((name) => {
      const input = form.elements[name];
      if (input) {
        setFieldError(input, fields[name]);
        if (!first) first = input;
      }
    });
    if (first) first.focus();
    return !!first;
  }

  function clearErrors(form) {
    form.querySelectorAll('.is-invalid').forEach((el) => setFieldError(el, ''));
  }

  return { validateForm, applyServerErrors, clearErrors, setFieldError };
})();
