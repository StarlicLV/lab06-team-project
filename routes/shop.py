"""Частина Б: меню з БД, адмінка товарів, пошук і фільтрація."""
import math
import sqlite3

from werkzeug.routing import BuildError

from flask import Blueprint, render_template_string, request, current_app, redirect, url_for, flash

from models import query_db, execute_db

shop = Blueprint('shop', __name__)
bp = shop_bp = shop_blueprint = shop  # аліаси, щоб підійшло будь-яке ім'я в app.py


def _block_name():
    """Знаходить назву блоку контенту в base.html (щоб не залежати від вгадування)."""
    try:
        names = list(current_app.jinja_env.get_template('base.html').blocks)
    except Exception:
        return 'content'
    for n in ('content', 'main', 'body', 'page_content', 'main_content'):
        if n in names:
            return n
    return names[-1] if names else 'content'


def _cart_url(product_id):
    """Посилання на додавання в кошик (працює, навіть якщо кошик ще не підключено)."""
    try:
        from flask import url_for
        return url_for('cart.add_to_cart', product_id=product_id)
    except BuildError:
        return '/cart/add/%d' % product_id


@shop.before_app_request
def _use_new_menu_for_old_endpoint():
    """Якщо в app.py лишився старий маршрут меню (endpoint 'menu'), показуємо нове меню з БД."""
    if request.endpoint == 'menu':
        return menu()


# ---------- Публічне меню ----------

@shop.route('/menu')
def menu():
    """Меню з БД: пошук (?q=) і фільтр за категорією (?category=)."""
    q = request.args.get('q', '').strip()
    category = request.args.get('category', '').strip()

    sql = 'SELECT * FROM products WHERE is_available = 1'
    params = []
    if q:
        sql += ' AND name LIKE ?'
        params.append('%' + q + '%')          # параметр, а не f-рядок (захист від SQL-ін'єкцій)
    if category:
        sql += ' AND category = ?'
        params.append(category)
    sql += ' ORDER BY category, name'

    products = query_db(sql, tuple(params))
    categories = query_db(
        'SELECT DISTINCT category FROM products WHERE is_available = 1 ORDER BY category')

    # групування за категорією
    grouped = {}
    for p in products:
        grouped.setdefault(p['category'], []).append(p)

    return render_template_string(MENU_TEMPLATE.replace('__BLOCK__', _block_name()), cart_url=_cart_url, grouped=grouped, categories=categories,
                           q=q, selected_category=category, total=len(products))


# ---------- Адмінка товарів ----------

def _validate_product(form):
    """Повертає (дані, список помилок)."""
    name = form.get('name', '').strip()
    description = form.get('description', '').strip()
    category = form.get('category', '').strip()
    price_raw = form.get('price', '').strip().replace(',', '.')
    errors = []

    if not name:
        errors.append('Назва не може бути порожньою.')
    price = None
    try:
        price = float(price_raw)
        if math.isnan(price) or math.isinf(price) or price < 0:
            errors.append('Ціна має бути числом не менше нуля.')
    except ValueError:
        errors.append('Ціна має бути числом не менше нуля.')

    is_available = 1 if form.get('is_available') else 0
    return (name, description, price, category, is_available), errors


def _render_admin(edit_product=None, form_data=None):
    products = query_db('SELECT * FROM products ORDER BY category, name')
    edit_product = dict(edit_product) if edit_product is not None else None
    form_data = dict(form_data) if form_data is not None else None
    return render_template_string(ADMIN_TEMPLATE, products=products,
                                  edit_product=edit_product, form_data=form_data)


@shop.route('/admin/products')
def admin_products():
    return _render_admin()


@shop.route('/admin/products/add', methods=['POST'])
def add_product():
    data, errors = _validate_product(request.form)
    if errors:
        for e in errors:
            flash(e, 'error')
        return _render_admin(form_data=request.form)
    execute_db(
        'INSERT INTO products (name, description, price, category, is_available) '
        'VALUES (?, ?, ?, ?, ?)', data)
    flash('Товар додано.', 'success')
    return redirect(url_for('shop.admin_products'))


@shop.route('/admin/products/<int:product_id>/edit', methods=['GET', 'POST'])
def edit_product(product_id):
    product = query_db('SELECT * FROM products WHERE id = ?', (product_id,), one=True)
    if product is None:
        flash('Товар не знайдено.', 'error')
        return redirect(url_for('shop.admin_products'))

    if request.method == 'POST':
        data, errors = _validate_product(request.form)
        if errors:
            for e in errors:
                flash(e, 'error')
            return _render_admin(edit_product=product, form_data=request.form)
        execute_db(
            'UPDATE products SET name = ?, description = ?, price = ?, category = ?, '
            'is_available = ? WHERE id = ?', data + (product_id,))
        flash('Товар оновлено.', 'success')
        return redirect(url_for('shop.admin_products'))

    return _render_admin(edit_product=product)


@shop.route('/admin/products/<int:product_id>/toggle', methods=['POST'])
def toggle_product(product_id):
    execute_db(
        'UPDATE products SET is_available = CASE is_available WHEN 1 THEN 0 ELSE 1 END '
        'WHERE id = ?', (product_id,))
    flash('Доступність товару змінено.', 'success')
    return redirect(url_for('shop.admin_products'))


@shop.route('/admin/products/<int:product_id>/delete', methods=['POST'])
def delete_product(product_id):
    try:
        execute_db('DELETE FROM products WHERE id = ?', (product_id,))
        flash('Товар видалено.', 'success')
    except sqlite3.IntegrityError:
        # ON DELETE RESTRICT: товар є в замовленнях
        flash('Цей товар є в замовленнях, тому його не можна видалити. '
              'Вимкніть його (перемикач доступності) — він зникне з меню.', 'error')
    return redirect(url_for('shop.admin_products'))


# ---------- Шаблони (вбудовані, окремі файли не потрібні) ----------
# Кольори взято з home.html: amber-700/900 (акценти), білі картки в світлій темі,
# espresso/choc/latte у темній, shadow-md та rounded-lg.

MENU_TEMPLATE = r"""{% extends 'base.html' %}
{% block __BLOCK__ %}
<h1 class="text-4xl font-bold mb-6 text-amber-900 dark:text-amber-200">Меню</h1>

<form method="get" action="{{ url_for('shop.menu') }}" class="mb-8 flex flex-col gap-3 sm:flex-row">
  <input type="text" name="q" value="{{ q }}" placeholder="Пошук за назвою..."
         class="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-orange dark:border-latte/30 dark:bg-choc/60 dark:placeholder:text-latte/60">
  <select name="category"
          class="rounded-lg border border-stone-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange dark:border-latte/30 dark:bg-choc/60">
    <option value="">Усі категорії</option>
    {% for c in categories %}
    <option value="{{ c['category'] }}" {% if c['category'] == selected_category %}selected{% endif %}>{{ c['category'] }}</option>
    {% endfor %}
  </select>
  <button type="submit"
          class="cursor-pointer rounded-lg bg-amber-700 px-5 py-2 text-white transition-colors duration-300 hover:bg-amber-800">Знайти</button>
  {% if q or selected_category %}
  <a href="{{ url_for('shop.menu') }}"
     class="rounded-lg border border-amber-700 px-5 py-2 text-center text-amber-800 transition-colors duration-300 hover:bg-amber-100 dark:border-amber-300 dark:text-amber-200 dark:hover:bg-espresso/80">Скинути</a>
  {% endif %}
</form>

{% if total == 0 %}
<p class="py-12 text-center text-lg">Нічого не знайдено.</p>
{% endif %}

{% for category, items in grouped.items() %}
<h2 class="mt-10 mb-4 text-2xl font-bold text-amber-900 dark:text-amber-200">{{ category }}</h2>
<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
  {% for p in items %}
  <article class="flex flex-col rounded-lg bg-white p-5 shadow-md transition-transform duration-300 hover:-translate-y-1 dark:bg-espresso/80">
    <h3 class="mb-1 text-lg font-semibold">{{ p['name'] }}</h3>
    <p class="mb-4 grow">{{ p['description'] }}</p>
    <div class="flex items-center justify-between">
      <span class="text-xl font-bold text-amber-700 dark:text-amber-300">{{ '%.2f'|format(p['price']) }} ₴</span>
      <form method="post" action="{{ cart_url(p['id']) }}">
        <button type="submit"
                class="cursor-pointer rounded-lg bg-amber-700 px-4 py-2 text-sm text-white transition-colors duration-300 hover:bg-amber-800">Додати в кошик</button>
      </form>
    </div>
  </article>
  {% endfor %}
</div>
{% endfor %}
{% endblock %}
"""

ADMIN_TEMPLATE = r"""{% extends 'admin/base_admin.html' %}
{% block admin_content %}
{% set f = form_data or edit_product or {} %}
{% set field = 'rounded-lg border border-stone-300 bg-white px-3 py-2 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-orange dark:border-latte/30 dark:bg-choc/60 dark:placeholder:text-latte/60' %}
<h2 class="mb-4 text-2xl font-bold text-amber-900 dark:text-amber-200">Товари</h2>

<form method="post"
      action="{{ url_for('shop.edit_product', product_id=edit_product['id']) if edit_product else url_for('shop.add_product') }}"
      class="mb-8 grid gap-3 rounded-lg bg-white p-5 shadow-md dark:bg-espresso/80 md:grid-cols-2">
  <h3 class="text-lg font-semibold md:col-span-2">
    {{ 'Редагування товару' if edit_product else 'Додати товар' }}
  </h3>
  <input name="name" value="{{ f['name'] if f.get('name') is not none else '' }}" placeholder="Назва" required class="{{ field }}">
  <input name="category" value="{{ f['category'] if f.get('category') is not none else '' }}" placeholder="Категорія" class="{{ field }}">
  <input name="price" value="{{ f['price'] if f.get('price') is not none else '' }}" placeholder="Ціна" required class="{{ field }}">
  <label class="flex items-center gap-2">
    <input type="checkbox" name="is_available" value="1" class="h-4 w-4 accent-amber-700"
           {% if (not f) or f.get('is_available') in (1, '1') %}checked{% endif %}> Доступний
  </label>
  <textarea name="description" rows="2" placeholder="Опис" class="md:col-span-2 {{ field }}">{{ f['description'] if f.get('description') is not none else '' }}</textarea>
  <div class="flex gap-2 md:col-span-2">
    <button type="submit"
            class="cursor-pointer rounded-lg bg-amber-700 px-5 py-2 text-white transition-colors duration-300 hover:bg-amber-800">
      {{ 'Зберегти' if edit_product else 'Додати' }}
    </button>
    {% if edit_product %}
    <a href="{{ url_for('shop.admin_products') }}"
       class="rounded-lg border border-amber-700 px-5 py-2 text-amber-800 transition-colors duration-300 hover:bg-amber-100 dark:border-amber-300 dark:text-amber-200 dark:hover:bg-choc/60">Скасувати</a>
    {% endif %}
  </div>
</form>

<div class="overflow-x-auto rounded-lg bg-white shadow-md dark:bg-espresso/80">
<table class="w-full text-left">
  <thead class="bg-amber-700 text-white">
    <tr><th class="p-3">ID</th><th class="p-3">Назва</th><th class="p-3">Категорія</th>
        <th class="p-3">Ціна</th><th class="p-3">Статус</th><th class="p-3">Дії</th></tr>
  </thead>
  <tbody>
  {% for p in products %}
    <tr class="border-t border-stone-200 dark:border-latte/15">
      <td class="p-3">{{ p['id'] }}</td>
      <td class="p-3 font-semibold">{{ p['name'] }}</td>
      <td class="p-3">{{ p['category'] }}</td>
      <td class="p-3 whitespace-nowrap">{{ '%.2f'|format(p['price']) }} ₴</td>
      <td class="p-3">
        {% if p['is_available'] %}
        <span class="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800 dark:bg-green-900 dark:text-green-200">Доступний</span>
        {% else %}
        <span class="inline-block rounded-full bg-stone-200 px-3 py-1 text-sm font-semibold text-stone-700 dark:bg-stone-700 dark:text-stone-200">Вимкнено</span>
        {% endif %}
      </td>
      <td class="p-3">
        <div class="flex flex-wrap gap-2">
          <a href="{{ url_for('shop.edit_product', product_id=p['id']) }}"
             class="rounded-lg bg-amber-700 px-3 py-1 text-white transition-colors hover:bg-amber-800">Ред.</a>
          <form method="post" action="{{ url_for('shop.toggle_product', product_id=p['id']) }}">
            <button class="cursor-pointer rounded-lg border border-amber-700 px-3 py-1 text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-300 dark:text-amber-200 dark:hover:bg-choc/60">{{ 'Вимкнути' if p['is_available'] else 'Увімкнути' }}</button>
          </form>
          <form method="post" action="{{ url_for('shop.delete_product', product_id=p['id']) }}"
                onsubmit="return confirm('Видалити товар?');">
            <button class="cursor-pointer rounded-lg bg-red-600 px-3 py-1 text-white transition-colors hover:bg-red-700">Видалити</button>
          </form>
        </div>
      </td>
    </tr>
  {% else %}
    <tr><td colspan="6" class="p-4 text-center">Товарів немає.</td></tr>
  {% endfor %}
  </tbody>
</table>
</div>
{% endblock %}
"""