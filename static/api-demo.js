// ============================================
// api-demo.js — Учасник 1: список товарів і допоміжні функції
// ============================================
// Інші учасники додають свій код (форма додавання, валідація) у місце,
// позначене нижче, ПЕРЕД викликом loadData().

// Сторінку віддає той самий Flask-сервер, тому достатньо відносної адреси
const API_URL = '/api/v1/products';

// ============================================
// ДОПОМІЖНІ ФУНКЦІЇ
// ============================================

let messageTimer = null;   // таймер, який ховає повідомлення

/**
 * Показує або ховає індикатор завантаження (#loading)
 */
function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.classList.toggle('show', show);
}

/**
 * Показує повідомлення в блоці #message.
 * type: 'success' або 'error'.
 * Використовуємо classList, а не className, щоб не зникли Tailwind-класи блоку.
 */
function showMessage(text, type) {
    const messageBox = document.getElementById('message');
    messageBox.textContent = text;
    messageBox.classList.remove('success', 'error');
    messageBox.classList.add(type, 'show');

    // Скидаємо попередній таймер, щоб нове повідомлення не сховалось раніше
    clearTimeout(messageTimer);
    messageTimer = setTimeout(() => messageBox.classList.remove('show'), 5000);
}

/**
 * Читає помилку з відповіді сервера. API повертає
 * {"error": "...", "status": 400, "details": {"поле": "повідомлення"}}.
 * Повертає {message, details}. Її використовує й форма додавання (Учасник 2).
 */
async function readError(response) {
    const fallback = `HTTP помилка! Статус: ${response.status}`;
    try {
        const body = await response.json();
        return {
            message: body.error || fallback,
            details: body.details || null,
        };
    } catch {
        // відповідь не є JSON
        return { message: fallback, details: null };
    }
}

/**
 * Повертає лише текст помилки
 */
async function getErrorText(response) {
    const { message } = await readError(response);
    return message;
}

// ============================================
// РОБОТА З API
// ============================================

/**
 * Завантажує список товарів (GET /api/v1/products)
 */
async function loadData() {
    try {
        showLoading(true);

        const response = await fetch(API_URL);

        // fetch не вважає 400/404/500 помилкою, тому перевіряємо response.ok
        if (!response.ok) {
            throw new Error(await getErrorText(response));
        }

        const data = await response.json();
        displayData(data.products);

    } catch (error) {
        if (error instanceof TypeError) {
            // fetch не дістався сервера (Failed to fetch)
            showMessage('❌ Сервер недоступний, перевірте, чи запущено API', 'error');
        } else {
            showMessage('❌ Помилка завантаження: ' + error.message, 'error');
        }
        console.error('Помилка:', error);
    } finally {
        showLoading(false);
    }
}

// ============================================
// ВІДОБРАЖЕННЯ ДАНИХ
// ============================================

/**
 * Форматує ціну: 95 -> «95 грн», 95.5 -> «95.50 грн»
 */
function formatPrice(price) {
    const value = Number(price);
    return (Number.isInteger(value) ? String(value) : value.toFixed(2)) + ' грн';
}

/**
 * Створює елемент із класом і текстом.
 * Дані з API вставляємо через textContent, а не innerHTML,
 * щоб HTML-код у назві товару не виконався на сторінці.
 */
function createElement(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    element.textContent = text;
    return element;
}

/**
 * Показує картки товарів у блоці #dataList
 */
function displayData(products) {
    const container = document.getElementById('dataList');
    container.innerHTML = '';

    if (!products || products.length === 0) {
        container.appendChild(createElement('div', 'empty-state', '📭 Товарів поки немає'));
        return;
    }

    products.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';

        const badge = product.is_available
            ? createElement('span', 'badge badge-available', 'Доступний')
            : createElement('span', 'badge badge-unavailable', 'Немає в наявності');

        card.append(
            createElement('h3', 'product-name', product.name || 'Без назви'),
            createElement('p', 'product-price', formatPrice(product.price)),
            createElement('p', 'product-category', product.category || ''),
            createElement('p', 'product-description', product.description || 'Без опису'),
            badge
        );
        container.appendChild(card);
    });
}

// ============================================
// ТУТ ІНШІ УЧАСНИКИ ДОДАЮТЬ СВІЙ КОД (форма, валідація)
// ============================================

// ============================================
// ІНІЦІАЛІЗАЦІЯ
// ============================================

loadData();
