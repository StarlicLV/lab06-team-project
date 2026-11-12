// static/js/api-demo-form.js
// Учасник 2: форма додавання товару (валідація, POST, показ помилок сервера).
// Підключати ПІСЛЯ api-demo.js: використовує API_URL, loadData,
// showMessage, showLoading та readError звідти.

(function () {
    'use strict';

    const form = document.getElementById('addForm');
    if (!form) {
        console.error('Форму #addForm не знайдено на сторінці');
        return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    let isSubmitting = false; // захист від подвійного надсилання

    // Поля форми, які перевіряємо на клієнті (id поля = ім'я поля в API)
    const FIELDS = ['name', 'price', 'category', 'description'];

    // ============================================
    // ПОМИЛКИ ПОЛІВ
    // ============================================

    function getInput(field) {
        return document.getElementById(field);
    }

    function getErrorElement(field) {
        return document.getElementById(field + '-error');
    }

    function setFieldError(field, message) {
        const input = getInput(field);
        const errorEl = getErrorElement(field);
        if (input) {
            input.classList.add('is-invalid');
            input.setAttribute('aria-invalid', 'true');
        }
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    function clearFieldError(field) {
        const input = getInput(field);
        const errorEl = getErrorElement(field);
        if (input) {
            input.classList.remove('is-invalid');
            input.removeAttribute('aria-invalid');
        }
        if (errorEl) {
            errorEl.textContent = '';
            errorEl.classList.add('hidden');
        }
    }

    function clearAllErrors() {
        [...FIELDS, 'is_available'].forEach(clearFieldError);
    }

    // Фокус на перше некоректне поле (у порядку розташування у формі)
    function focusFirstInvalid() {
        const first = form.querySelector('.is-invalid');
        if (first) {
            first.focus();
        }
    }

    // Помилка зникає, щойно користувач виправляє поле
    FIELDS.forEach((field) => {
        const input = getInput(field);
        if (input) {
            input.addEventListener('input', () => clearFieldError(field));
        }
    });

    // ============================================
    // ВАЛІДАЦІЯ
    // ============================================

    /**
     * Перевіряє форму. Повертає { errors: {поле: текст}, data: {...} }
     */
    function validate() {
        const errors = {};

        const name = (getInput('name')?.value ?? '').trim();
        const category = (getInput('category')?.value ?? '').trim();
        const description = (getInput('description')?.value ?? '').trim();
        const priceRaw = (getInput('price')?.value ?? '').trim().replace(',', '.');

        if (!name) {
            errors.name = 'Введіть назву товару';
        } else if (name.length > 100) {
            errors.name = 'Назва має містити не більше 100 символів';
        }

        if (!category) {
            errors.category = 'Введіть категорію';
        } else if (category.length > 100) {
            errors.category = 'Категорія має містити не більше 100 символів';
        }

        const price = Number(priceRaw);
        if (priceRaw === '') {
            errors.price = 'Введіть ціну';
        } else if (!Number.isFinite(price)) {
            errors.price = 'Ціна має бути числом';
        } else if (price < 0) {
            errors.price = 'Ціна не може бути менше 0';
        }

        if (description.length > 1000) {
            errors.description = 'Опис має містити не більше 1000 символів';
        }

        const availableInput = getInput('is_available');

        return {
            errors,
            data: {
                name: name,
                price: price, // саме число, не рядок: "70" сервер відхилить з 400
                category: category,
                description: description,
                is_available: availableInput ? availableInput.checked : true
            }
        };
    }

    // ============================================
    // ПОМИЛКИ СЕРВЕРА
    // ============================================

    async function getGeneralError(response) {
        if (typeof readError === 'function') {
            try {
                return await readError(response.clone());
            } catch {
                // нижче запасний варіант
            }
        }
        return `HTTP помилка! Статус: ${response.status}`;
    }

    async function getDetails(response) {
        try {
            const body = await response.clone().json();
            if (body && body.details && typeof body.details === 'object') {
                return body.details;
            }
        } catch {
            // відповідь не JSON
        }
        return {};
    }

    function detailToText(value) {
        return Array.isArray(value) ? value.join(', ') : String(value);
    }

    /**
     * Показує details біля полів. Повертає список повідомлень
     * для ключів, яких немає на сторінці (їх виводимо у загальне повідомлення).
     */
    function showServerDetails(details) {
        const leftovers = [];

        Object.entries(details).forEach(([key, value]) => {
            const text = detailToText(value);
            if (getErrorElement(key)) {
                setFieldError(key, text);
            } else {
                if (getInput(key)) {
                    getInput(key).classList.add('is-invalid');
                }
                leftovers.push(`${key}: ${text}`);
            }
        });

        return leftovers;
    }

    // ============================================
    // ВІДПРАВКА ФОРМИ
    // ============================================

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (isSubmitting) {
            return; // запит уже виконується
        }

        clearAllErrors();

        const { errors, data } = validate();
        const errorKeys = Object.keys(errors);

        if (errorKeys.length > 0) {
            errorKeys.forEach((field) => setFieldError(field, errors[field]));
            focusFirstInvalid();
            showMessage('❌ Перевірте правильність заповнення форми', 'error');
            return;
        }

        isSubmitting = true;
        if (submitButton) {
            submitButton.disabled = true;
        }
        showLoading(true);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                let message = await getGeneralError(response);

                if (response.status === 400) {
                    const details = await getDetails(response);
                    const leftovers = showServerDetails(details);
                    if (leftovers.length > 0) {
                        message += ' (' + leftovers.join('; ') + ')';
                    }
                    focusFirstInvalid();
                }

                showMessage('❌ ' + message, 'error');
                return;
            }

            // Успіх (201)
            showMessage('✅ Товар успішно додано!', 'success');
            form.reset(); // чекбокс знову повертається в початковий стан
            clearAllErrors();
            await loadData();

        } catch (error) {
            // Мережева помилка: сервер недоступний
            showMessage('❌ Помилка додавання: ' + error.message, 'error');
            console.error('Помилка:', error);
        } finally {
            showLoading(false);
            isSubmitting = false;
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });
})();
