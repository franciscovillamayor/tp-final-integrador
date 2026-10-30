// validaciones estrictas de formularios en frontend

export const rules = {
  name: v => (!v || String(v).trim().length < 2 ? 'Ingresá tu nombre (mínimo 2 caracteres).' : ''),
  email: v => (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? 'Ingresá un email válido.' : ''),
  password: v => (!v || String(v).length < 6 ? 'Mínimo 6 caracteres.' : ''),
  required: v => (!v || !String(v).trim() ? 'Este campo es obligatorio.' : ''),
};

// enlaza validacion en tiempo real con mensajes en rojo apagado
export function bindValidation(form) {
  if (!form) return;
  const inputs = form.querySelectorAll('[data-valid]');
  inputs.forEach(input => {
    let errorEl = form.querySelector(`[data-error="${input.name}"]`);
    if (!errorEl) {
      errorEl = document.createElement('small');
      errorEl.className = 'field-error';
      errorEl.dataset.error = input.name;
      input.parentNode.insertBefore(errorEl, input.nextSibling);
    }

    const validate = () => {
      const ruleType = input.dataset.valid;
      const validator = rules[ruleType] || rules.required;
      const msg = validator(input.value);
      errorEl.textContent = msg;
      input.classList.toggle('invalid', !!msg);
      return !msg;
    };

    input.addEventListener('input', validate);
    input.addEventListener('blur', validate);
  });
}

// comprueba todos los campos de un formulario y devuelve si es valido
export function validateForm(form) {
  if (!form) return true;
  let isValid = true;
  const inputs = form.querySelectorAll('[data-valid]');
  inputs.forEach(input => {
    const group = input.closest('.form-group');
    if (group && window.getComputedStyle(group).display === 'none') return;
    let errorEl = form.querySelector(`[data-error="${input.name}"]`);
    if (!errorEl) {
      errorEl = document.createElement('small');
      errorEl.className = 'field-error';
      errorEl.dataset.error = input.name;
      input.parentNode.insertBefore(errorEl, input.nextSibling);
    }
    const ruleType = input.dataset.valid;
    const validator = rules[ruleType] || rules.required;
    const msg = validator(input.value);
    errorEl.textContent = msg;
    input.classList.toggle('invalid', !!msg);
    if (msg) isValid = false;
  });
  return isValid;
}
