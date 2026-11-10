// Лабораторна 6: форма додавання товару (#addForm).
// Відповідальний: учасник 2. Використовує функції з api-demo.js: API_URL, loadData, showMessage, showLoading.
//
// TODO:
//   клієнтська валідація: name і category не порожні (до 100 символів), price: число >= 0,
//   description до 1000 символів; помилки показувати в <p id="{поле}-error"> (знімати/додавати клас "hidden")
//   відправка POST на API_URL з тілом JSON:
//     { name, price: Number(...), category, description, is_available: checkbox.checked }
//     (price має бути ЧИСЛОМ, а не рядком: рядок API відхилить з кодом 400)
//   перевіряти response.ok; помилки сервера мають вигляд {"error": "...", "status": 400, "details": {"поле": "текст"}}:
//     показати details біля відповідних полів, а загальне повідомлення через showMessage(..., 'error')
//   після успіху (код 201): showMessage('✅ ...', 'success'), очистити форму, await loadData()
