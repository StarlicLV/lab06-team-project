// Завантаження та безпечне відображення товарів із REST API.
'use strict';

const API_URL = '/api/v1/products';
let messageTimeout;

function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) loading.classList.toggle('show', Boolean(show));
}

function showMessage(text, type) {
    const message = document.getElementById('message');
    if (!message) return;

    window.clearTimeout(messageTimeout);
    message.textContent = text;
    message.className = `mb-4 rounded-lg px-4 py-3 ${type === 'success' ? 'success' : 'error'} show`;
    messageTimeout = window.setTimeout(() => message.classList.remove('show'), 5000);
}

async function readError(response) {
    try {
        const body = await response.json();
        if (body && typeof body.error === 'string' && body.error.trim()) return body.error;
    } catch {
        // A non-JSON response still gets a useful HTTP status below.
    }
    return `HTTP помилка! Статус: ${response.status}`;
}

async function loadData() {
    showLoading(true);
    try {
        const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error(await readError(response));

        const result = await response.json();
        if (!result || !Array.isArray(result.products)) {
            throw new Error('Сервер повернув дані у невідомому форматі');
        }
        displayData(result.products);
    } catch (error) {
        showMessage(`❌ Не вдалося завантажити товари: ${error.message}`, 'error');
        console.error('Помилка завантаження товарів:', error);
    } finally {
        showLoading(false);
    }
}

function displayData(products) {
    const container = document.getElementById('dataList');
    if (!container) return;

    container.replaceChildren();
    if (!products.length) {
        const empty = document.createElement('p');
        empty.className = 'empty-state';
        empty.textContent = 'Товарів поки немає. Додайте перший товар за допомогою форми.';
        container.appendChild(empty);
        return;
    }

    const fragment = document.createDocumentFragment();
    products.forEach((product) => {
        const card = document.createElement('article');
        card.className = 'product-card';

        const name = document.createElement('h3');
        name.className = 'product-name';
        name.textContent = product.name || 'Без назви';

        const price = document.createElement('p');
        price.className = 'product-price';
        const numericPrice = Number(product.price);
        price.textContent = Number.isFinite(numericPrice)
            ? `${numericPrice.toLocaleString('uk-UA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} грн`
            : 'Ціну не вказано';

        const category = document.createElement('p');
        category.className = 'product-category';
        category.textContent = product.category || 'Без категорії';

        const description = document.createElement('p');
        description.className = 'product-description';
        description.textContent = product.description || 'Опис поки відсутній.';

        const availability = document.createElement('span');
        const isAvailable = Boolean(product.is_available);
        availability.className = `badge ${isAvailable ? 'badge-available' : 'badge-unavailable'}`;
        availability.textContent = isAvailable ? 'Доступний для замовлення' : 'Тимчасово недоступний';

        card.append(name, price, category, description, availability);
        fragment.appendChild(card);
    });
    container.appendChild(fragment);
}

loadData();
