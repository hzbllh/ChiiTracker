// ======================
// Money Tracker App
// ======================

const STORAGE_KEY = 'moneyTracker_transactions';
const THEME_KEY = 'moneyTracker_theme';

// Categories
const CATEGORIES = {
  expense: [
    { id: 'makan', name: 'Makanan', color: '#f97316' },
    { id: 'transport', name: 'Pengangkutan', color: '#3b82f6' },
    { id: 'belanja', name: 'Belanja', color: '#ec4899' },
    { id: 'bil', name: 'Bil & Utiliti', color: '#8b5cf6' },
    { id: 'hiburan', name: 'Hiburan', color: '#14b8a6' },
    { id: 'kesihatan', name: 'Kesihatan', color: '#ef4444' },
    { id: 'lain', name: 'Lain-lain', color: '#6b7280' }
  ],
  income: [
    { id: 'gaji', name: 'Gaji', color: '#22c55e' },
    { id: 'freelance', name: 'Freelance', color: '#84cc16' },
    { id: 'hadiah', name: 'Hadiah / Bonus', color: '#eab308' },
    { id: 'lain-income', name: 'Lain-lain', color: '#10b981' }
  ]
};

let transactions = [];
let pieChart = null;
let barChart = null;

// ---------- Init ----------
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadTransactions();
  setupForm();
  setupThemeToggle();
  setupMonthFilter();
  setupClearAll();
  setDefaultDate();
  updateCategoryOptions();
  render();
});

// ---------- Theme ----------
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(saved);
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.classList.add('dark');
    document.getElementById('themeIcon').textContent = '☀️';
  } else {
    html.classList.remove('dark');
    document.getElementById('themeIcon').textContent = '🌙';
  }
  localStorage.setItem(THEME_KEY, theme);
  // Re-render charts for correct colors
  if (pieChart || barChart) updateCharts();
}

function setupThemeToggle() {
  document.getElementById('themeToggle').addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
  });
}

// ---------- Data ----------
function loadTransactions() {
  const raw = localStorage.getItem(STORAGE_KEY);
  transactions = raw ? JSON.parse(raw) : [];
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ---------- Form ----------
function setDefaultDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date').value = today;
}

function updateCategoryOptions() {
  const type = document.getElementById('type').value;
  const select = document.getElementById('category');
  select.innerHTML = '';
  CATEGORIES[type].forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}

function setupForm() {
  document.getElementById('type').addEventListener('change', updateCategoryOptions);

  document.getElementById('txForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const type = document.getElementById('type').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const category = document.getElementById('category').value;
    const date = document.getElementById('date').value;
    const note = document.getElementById('note').value.trim();

    if (!amount || amount <= 0) return;

    const tx = {
      id: generateId(),
      type,
      amount,
      category,
      date,
      note,
      createdAt: new Date().toISOString()
    };

    transactions.unshift(tx); // newest first
    saveTransactions();
    document.getElementById('txForm').reset();
    setDefaultDate();
    updateCategoryOptions();
    render();
  });
}

// ---------- Month Filter ----------
function setupMonthFilter() {
  const select = document.getElementById('monthFilter');
  const months = getAvailableMonths();

  select.innerHTML = '<option value="all">Semua Bulan</option>';
  months.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m.value;
    opt.textContent = m.label;
    select.appendChild(opt);
  });

  // Default to current month if exists
  const now = new Date();
  const current = `\( {now.getFullYear()}- \){String(now.getMonth() + 1).padStart(2, '0')}`;
  if (months.some(m => m.value === current)) {
    select.value = current;
  }

  select.addEventListener('change', render);
}

function getAvailableMonths() {
  const set = new Set();
  transactions.forEach(tx => {
    if (tx.date) set.add(tx.date.slice(0, 7)); // YYYY-MM
  });
  // Always include current month
  const now = new Date();
  set.add(`\( {now.getFullYear()}- \){String(now.getMonth() + 1).padStart(2, '0')}`);

  return Array.from(set)
    .sort((a, b) => b.localeCompare(a))
    .map(v => {
      const [y, m] = v.split('-');
      const date = new Date(y, m - 1);
      const label = date.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });
      return { value: v, label };
    });
}

function getFilteredTransactions() {
  const month = document.getElementById('monthFilter').value;
  if (month === 'all') return transactions;
  return transactions.filter(tx => tx.date && tx.date.startsWith(month));
}

// ---------- Render ----------
function render() {
  const filtered = getFilteredTransactions();
  updateSummary(filtered);
  renderList(filtered);
  updateCharts();
  // Refresh month options (in case new month added)
  const currentVal = document.getElementById('monthFilter').value;
  setupMonthFilter();
  document.getElementById('monthFilter').value = currentVal;
}

function updateSummary(list) {
  let income = 0, expense = 0;
  list.forEach(tx => {
    if (tx.type === 'income') income += tx.amount;
    else expense += tx.amount;
  });
  const balance = income - expense;

  document.getElementById('balance').textContent = formatRM(balance);
  document.getElementById('totalIncome').textContent = formatRM(income);
  document.getElementById('totalExpense').textContent = formatRM(expense);

  // Color balance
  const balEl = document.getElementById('balance');
  balEl.classList.toggle('text-red-500', balance < 0);
  balEl.classList.toggle('dark:text-red-400', balance < 0);
  balEl.classList.toggle('text-primary-600', balance >= 0);
  balEl.classList.toggle('dark:text-primary-500', balance >= 0);
}

function renderList(list) {
  const container = document.getElementById('txList');
  const empty = document.getElementById('emptyState');

  if (list.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  container.innerHTML = list.map(tx => {
    const cat = findCategory(tx.type, tx.category);
    const isIncome = tx.type === 'income';
    return `
      <div class="tx-item flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium" style="background:${cat.color}">
            ${cat.name.charAt(0)}
          </div>
          <div class="min-w-0">
            <p class="font-medium truncate">\( {cat.name} \){tx.note ? ' • ' + tx.note : ''}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">${formatDate(tx.date)}</p>
          </div>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-semibold ${isIncome ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}">
            ${isIncome ? '+' : '-'} ${formatRM(tx.amount)}
          </span>
          <button onclick="deleteTx('${tx.id}')" class="text-gray-400 hover:text-red-500 transition p-1" title="Padam">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function findCategory(type, id) {
  const list = CATEGORIES[type] || [];
  return list.find(c => c.id === id) || { name: id, color: '#6b7280' };
}

function deleteTx(id) {
  if (!confirm('Padam transaksi ini?')) return;
  transactions = transactions.filter(tx => tx.id !== id);
  saveTransactions();
  render();
}

function setupClearAll() {
  document.getElementById('clearAll').addEventListener('click', () => {
    if (!confirm('Padam SEMUA transaksi? Tindakan ini tidak boleh diundur.')) return;
    transactions = [];
    saveTransactions();
    render();
  });
}

// ---------- Charts ----------
function updateCharts() {
  const filtered = getFilteredTransactions();
  updatePieChart(filtered);
  updateBarChart();
}

function updatePieChart(list) {
  const expenses = list.filter(tx => tx.type === 'expense');
  const dataMap = {};
  expenses.forEach(tx => {
    const cat = findCategory('expense', tx.category);
    dataMap[cat.name] = (dataMap[cat.name] || 0) + tx.amount;
  });

  const labels = Object.keys(dataMap);
  const data = Object.values(dataMap);
  const colors = labels.map(name => {
    const cat = CATEGORIES.expense.find(c => c.name === name);
    return cat ? cat.color : '#6b7280';
  });

  const ctx = document.getElementById('pieChart').getContext('2d');
  const isDark = document.documentElement.classList.contains('dark');

  if (pieChart) pieChart.destroy();

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels.length ? labels : ['Tiada data'],
      datasets: [{
        data: data.length ? data : [1],
        backgroundColor: data.length ? colors : ['#e5e7eb'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: isDark ? '#e5e7eb' : '#374151',
            padding: 12,
            font: { size: 12 }
          }
        }
      }
    }
  });
}

function updateBarChart() {
  // Last 6 months income vs expense
  const months = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `\( {d.getFullYear()}- \){String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('ms-MY', { month: 'short' });
    months.push({ key, label });
  }

  const incomeData = [];
  const expenseData = [];

  months.forEach(m => {
    let inc = 0, exp = 0;
    transactions.forEach(tx => {
      if (tx.date && tx.date.startsWith(m.key)) {
        if (tx.type === 'income') inc += tx.amount;
        else exp += tx.amount;
      }
    });
    incomeData.push(inc);
    expenseData.push(exp);
  });

  const ctx = document.getElementById('barChart').getContext('2d');
  const isDark = document.documentElement.classList.contains('dark');

  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Pendapatan',
          data: incomeData,
          backgroundColor: '#22c55e',
          borderRadius: 6
        },
        {
          label: 'Perbelanjaan',
          data: expenseData,
          backgroundColor: '#ef4444',
          borderRadius: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: { color: isDark ? '#9ca3af' : '#6b7280' },
          grid: { display: false }
        },
        y: {
          ticks: { color: isDark ? '#9ca3af' : '#6b7280' },
          grid: { color: isDark ? '#374151' : '#e5e7eb' }
        }
      },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: isDark ? '#e5e7eb' : '#374151',
            padding: 12
          }
        }
      }
    }
  });
}

// ---------- Helpers ----------
function formatRM(num) {
  return 'RM ' + num.toLocaleString('ms-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Make deleteTx global for onclick
window.deleteTx = deleteTx;
