const STORAGE_KEY = 'feira-lista-v1';
const productOptions = [...document.querySelectorAll('#product-suggestions option')];

const form = document.querySelector('#item-form');
const productInput = document.querySelector('#product-select');
const quantityInput = document.querySelector('#product-quantity');
const listElement = document.querySelector('#product-list');
const emptyState = document.querySelector('#empty-state');
const toast = document.querySelector('#toast');
const printArea = document.querySelector('#print-area');

let items = loadItems();
let activeFilter = 'all';
let toastTimeout;

function loadItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch {
    showToast('Não foi possível salvar a lista neste dispositivo.');
    return false;
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

function normalizeProductName(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b([a-z]+)s\b/g, '$1');
}

function getProductEmoji(name) {
  const normalizedName = normalizeProductName(name);
  const exactMatch = productOptions.find((option) => normalizeProductName(option.value) === normalizedName);
  if (exactMatch) return exactMatch.dataset.emoji || '';

  const prefixMatch = productOptions
    .filter((option) => normalizedName.startsWith(`${normalizeProductName(option.value)} `))
    .sort((first, second) => second.value.length - first.value.length)[0];
  return prefixMatch ? prefixMatch.dataset.emoji || '' : null;
}

function getItemEmoji(item) {
  const catalogEmoji = getProductEmoji(item.name);
  if (catalogEmoji !== null) return catalogEmoji;
  return item.emoji && item.emoji !== '🛒' ? item.emoji : '';
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove('is-visible'), 2800);
}

function render() {
  const completed = items.filter((item) => item.done).length;
  const visibleItems = items.filter((item) => activeFilter === 'all' || (activeFilter === 'done' ? item.done : !item.done));

  document.querySelector('#total-count').textContent = items.length;
  document.querySelector('#done-count').textContent = completed;
  document.querySelector('#all-filter-count').textContent = items.length;
  document.querySelector('#list-hint').textContent = `${items.length} ${items.length === 1 ? 'produto' : 'produtos'}`;
  document.querySelector('#progress-bar').style.width = items.length ? `${(completed / items.length) * 100}%` : '0%';
  document.querySelector('#clear-done').hidden = completed === 0;

  listElement.innerHTML = visibleItems.map((item) => {
    const escapedName = escapeHtml(item.name);
    const emoji = getItemEmoji(item);
    const emojiMarkup = emoji
      ? `<span class="product-emoji" aria-hidden="true">${emoji}</span>`
      : '<span class="product-emoji is-empty" aria-hidden="true"></span>';

    return `<li class="product-row${item.done ? ' is-done' : ''}">
      <button class="check-button" type="button" data-action="toggle" data-id="${item.id}" aria-label="${item.done ? 'Marcar como pendente' : 'Marcar como concluído'}: ${escapedName}" aria-pressed="${item.done}">${item.done ? '✓' : ''}</button>
      ${emojiMarkup}
      <span class="product-copy"><span class="product-name">${escapedName}</span><span class="product-meta">${item.quantity} ${Number(item.quantity) === 1 ? 'unidade' : 'unidades'}</span></span>
      <button class="delete-button" type="button" data-action="delete" data-id="${item.id}" aria-label="Remover ${escapedName}" title="Remover produto">×</button>
    </li>`;
  }).join('');

  emptyState.hidden = visibleItems.length > 0;
  if (items.length === 0) {
    emptyState.querySelector('.empty-title').textContent = 'Sua lista começa aqui.';
    emptyState.querySelector('.empty-copy').textContent = 'Adicione o primeiro produto e deixe as compras mais leves.';
  } else if (visibleItems.length === 0) {
    emptyState.querySelector('.empty-title').textContent = 'Nada por aqui ainda.';
    emptyState.querySelector('.empty-copy').textContent = activeFilter === 'done' ? 'Os produtos concluídos vão aparecer aqui.' : 'Você já marcou tudo como comprado.';
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = productInput.value.trim();
  const quantity = Number(quantityInput.value);
  if (!name || !Number.isInteger(quantity) || quantity < 1) {
    showToast('Confira o produto e a quantidade.');
    return;
  }

  items.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    name,
    emoji: getProductEmoji(name) || '',
    quantity,
    done: false,
  });
  saveItems();
  activeFilter = 'all';
  document.querySelectorAll('.filter-button').forEach((button) => {
    const selected = button.dataset.filter === activeFilter;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-pressed', selected);
  });
  form.reset();
  quantityInput.value = '1';
  render();
  productInput.focus();
});

listElement.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const itemId = button.dataset.id;
  if (button.dataset.action === 'toggle') {
    items = items.map((item) => item.id === itemId ? { ...item, done: !item.done } : item);
  } else {
    items = items.filter((item) => item.id !== itemId);
  }
  saveItems();
  render();
});

document.querySelectorAll('.filter-button').forEach((button) => {
  button.addEventListener('click', () => {
    activeFilter = button.dataset.filter;
    document.querySelectorAll('.filter-button').forEach((filterButton) => {
      const selected = filterButton === button;
      filterButton.classList.toggle('is-active', selected);
      filterButton.setAttribute('aria-pressed', selected);
    });
    render();
  });
});

document.querySelector('#clear-done').addEventListener('click', () => {
  items = items.filter((item) => !item.done);
  saveItems();
  render();
  showToast('Produtos concluídos removidos.');
});

document.querySelector('#save-pending-pdf').addEventListener('click', () => {
  const pendingItems = items.filter((item) => !item.done);
  if (pendingItems.length === 0) {
    showToast('Não há produtos pendentes para salvar.');
    return;
  }

  const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());
  printArea.innerHTML = `<header class="print-header">
    <p class="print-kicker">FEIRA DA SEMANA</p>
    <h1>Lista de mercado</h1>
    <p>${date} · ${pendingItems.length} ${pendingItems.length === 1 ? 'produto pendente' : 'produtos pendentes'}</p>
  </header>
  <ul class="print-items">${pendingItems.map((item) => {
    const emoji = getItemEmoji(item);
    return `<li class="print-row"><span class="print-check" aria-hidden="true"></span><span class="print-product">${emoji ? `${emoji} ` : ''}${escapeHtml(item.name)}</span><span class="print-quantity">Qtd.: ${item.quantity}</span></li>`;
  }).join('')}</ul>`;

  const originalTitle = document.title;
  document.title = 'Lista de mercado - pendentes';
  window.addEventListener('afterprint', () => {
    document.title = originalTitle;
  }, { once: true });
  window.print();
});

const dateLabel = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
document.querySelector('#today-label').textContent = `LISTA DA SEMANA · ${dateLabel.toLocaleUpperCase('pt-BR')}`;
render();