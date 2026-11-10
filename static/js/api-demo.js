// Лабораторна 6: список товарів з API + спільні допоміжні функції.
// Відповідальний: учасник 1. Форма додавання лежить в api-demo-form.js (цей файл підключено першим).
//
// TODO:
//   const API_URL = '/api/v1/products';        // сторінку віддає той самий Flask, тому CORS не потрібен
//   showLoading(show)       перемикає клас "show" в #loading
//   showMessage(text, type) показує #message (type: 'success' або 'error'), ховає через кілька секунд
//   getErrorText(response)  дістає текст із відповіді {"error": "...", "details": {...}} (див. README)
//   loadData()              GET API_URL, перевірка response.ok, береться data.products (НЕ масив!)
//   displayData(products)   малює картки в #dataList; тексти ТІЛЬКИ через textContent, не innerHTML;
//                           порожній список -> повідомлення «Товарів поки немає»
//   наприкінці файлу: loadData();
