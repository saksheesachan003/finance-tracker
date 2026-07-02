// ============================================================
// FinTrack Pro — script.js
// Wired specifically to the passbook HTML structure
// ============================================================

const STORAGE_USER   = 'fintrack_session';
const STORAGE_TXNS   = 'fintrack_transactions';
const STORAGE_PREFS  = 'fintrack_prefs';

// ---------- SEED DATA (used only the first time, so the dashboard isn't empty) ----------
const SEED_TXNS = [
  { id: 1, date: '2026-06-28', desc: 'Freelance payout', cat: 'Salary',           type: 'in',  amount: 15000 },
  { id: 2, date: '2026-06-27', desc: 'Grocery run',      cat: 'Food & Dining',    type: 'out', amount: 2150  },
  { id: 3, date: '2026-06-26', desc: 'Mobile recharge',  cat: 'Recharge & Bills', type: 'out', amount: 399   },
  { id: 4, date: '2026-06-25', desc: 'Petrol',           cat: 'Petrol & Auto',    type: 'out', amount: 1200  },
  { id: 5, date: '2026-06-24', desc: 'Movie night',      cat: 'Entertainment',    type: 'out', amount: 680   }
];

const CURRENCY_SYMBOLS = { INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

// ============================================================
// LOGIN / SESSION
// ============================================================

const LoginManager = {
  login(name) {
    const session = { name: name || 'Guest', loggedInAt: Date.now() };
    localStorage.setItem(STORAGE_USER, JSON.stringify(session));
    return session;
  },
  logout() {
    localStorage.removeItem(STORAGE_USER);
  },
  getUser() {
    const raw = localStorage.getItem(STORAGE_USER);
    return raw ? JSON.parse(raw) : null;
  },
  isLoggedIn() {
    return !!this.getUser();
  }
};

// ============================================================
// PREFERENCES (currency + theme)
// ============================================================

const Prefs = {
  defaults: { currency: 'INR', darkMode: false },

  load() {
    const raw = localStorage.getItem(STORAGE_PREFS);
    return raw ? { ...this.defaults, ...JSON.parse(raw) } : { ...this.defaults };
  },

  save(prefs) {
    localStorage.setItem(STORAGE_PREFS, JSON.stringify(prefs));
  },

  apply(prefs) {
    document.body.classList.toggle('dark-mode', !!prefs.darkMode);
  }
};

// ============================================================
// TRANSACTIONS
// ============================================================

const Txns = {
  load() {
    const raw = localStorage.getItem(STORAGE_TXNS);
    if (raw) return JSON.parse(raw);
    this.save(SEED_TXNS);
    return SEED_TXNS;
  },

  save(list) {
    localStorage.setItem(STORAGE_TXNS, JSON.stringify(list));
  },

  add(txn) {
    const list = this.load();
    txn.id = Date.now();
    list.unshift(txn);
    this.save(list);
    return list;
  },

  remove(id) {
    const list = this.load().filter(t => t.id !== id);
    this.save(list);
    return list;
  }
};

// ============================================================
// PAGE / TAB SWITCHING
// ============================================================

function showPage(name, btnEl) {
  document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
  document.getElementById(`section-${name}`)?.classList.add('active');

  document.querySelectorAll('.ledger-tabs button').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');
}

// ============================================================
// FORMATTING HELPERS
// ============================================================

function fmtMoney(n, currency) {
  const symbol = CURRENCY_SYMBOLS[currency] || '₹';
  const sign = n < 0 ? '−' : '';
  return `${symbol}${Math.abs(n).toLocaleString('en-IN')}`;
}

function fmtDate(isoDate) {
  const d = new Date(isoDate);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

// ============================================================
// RENDERING
// ============================================================

let currentFilter = 'all';

function renderAll() {
  const prefs = Prefs.load();
  const txns = Txns.load();
  renderStats(txns, prefs.currency);
  renderRecent(txns, prefs.currency);
  renderTable(txns, prefs.currency);
  renderCashFlowChart(txns, prefs.currency);
}

function renderStats(txns, currency) {
  const income = txns.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
  const balance = income - expense;

  const statCards = document.querySelectorAll('.stat-card .stat-value');
  if (statCards[0]) statCards[0].textContent = fmtMoney(balance, currency);
  if (statCards[1]) statCards[1].textContent = fmtMoney(income, currency);
  if (statCards[2]) statCards[2].textContent = fmtMoney(expense, currency);
  if (statCards[3]) statCards[3].textContent = txns.length;

  const subs = document.querySelectorAll('.stat-card .stat-sub');
  if (subs[1]) subs[1].textContent = `${txns.filter(t => t.type === 'in').length} entries`;
  if (subs[2]) subs[2].textContent = `${txns.filter(t => t.type === 'out').length} entries`;
}

function renderRecent(txns, currency) {
  const list = document.querySelector('.recent-list');
  if (!list) return;
  const recent = txns.slice(0, 4);

  list.innerHTML = recent.map(t => `
    <div class="recent-row">
      <div><div class="desc">${escapeHtml(t.desc)}</div><div class="cat">${escapeHtml(t.cat)}</div></div>
      <div class="amt ${t.type}">${t.type === 'in' ? '+' : '−'} ${fmtMoney(t.amount, currency)}</div>
    </div>
  `).join('') || `<p style="color:#8a8f86;font-size:13px;">No transactions yet.</p>`;
}

function renderTable(txns, currency) {
  const tbody = document.querySelector('.table-panel table tbody');
  if (!tbody) return;

  const filtered = currentFilter === 'all'
    ? txns
    : txns.filter(t => t.type === currentFilter);

  tbody.innerHTML = filtered.map(t => `
    <tr>
      <td class="mono">${fmtDate(t.date)}</td>
      <td>${escapeHtml(t.desc)}</td>
      <td><span class="cat-pill">${escapeHtml(t.cat)}</span></td>
      <td class="amt ${t.type}">${t.type === 'in' ? '+' : '−'} ${fmtMoney(t.amount, currency)}</td>
      <td>
        <button class="icon-btn" data-id="${t.id}" aria-label="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5" style="text-align:center;color:#8a8f86;padding:24px;">No transactions in this view.</td></tr>`;

  tbody.querySelectorAll('.icon-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.id);
      Txns.remove(id);
      renderAll();
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// MODAL — ADD TRANSACTION
// ============================================================

let modalType = 'in'; // tracks income/expense toggle state

function openModal() {
  document.getElementById('modal-overlay').classList.add('show');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
  document.getElementById('m-desc').value = '';
  document.getElementById('m-amt').value = '';
  document.getElementById('m-date').value = '';
  document.getElementById('m-cat').selectedIndex = 0;
  setModalType('in');
}

function setModalType(type) {
  modalType = type;
  document.querySelector('.type-toggle .t-in').classList.toggle('active', type === 'in');
  document.querySelector('.type-toggle .t-out').classList.toggle('active', type === 'out');
}

function saveModalEntry() {
  const desc = document.getElementById('m-desc').value.trim();
  const amtRaw = document.getElementById('m-amt').value.trim();
  const dateRaw = document.getElementById('m-date').value.trim();
  const cat = document.getElementById('m-cat').value;

  const amount = parseFloat(amtRaw.replace(/[^\d.]/g, ''));

  if (!desc) { alert('Please enter a description.'); return; }
  if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }

  let isoDate = new Date().toISOString().slice(0, 10);
  // accept DD/MM/YYYY input, fall back to today if not parseable
  const parts = dateRaw.split(/[\/\-]/).map(s => s.trim());
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (dd && mm && yyyy && !isNaN(Date.parse(`${yyyy}-${mm}-${dd}`))) {
      isoDate = `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
    }
  }

  Txns.add({ date: isoDate, desc, cat, type: modalType, amount });
  renderAll();
  closeModal();
}


// ============================================================
// CASH FLOW CHART (Chart.js)
// ============================================================

let cashFlowChart = null;

function buildCashFlowSeries(txns) {
  // group by date, sum income/expense per day
  const byDate = {};
  txns.forEach(t => {
    if (!byDate[t.date]) byDate[t.date] = { in: 0, out: 0 };
    byDate[t.date][t.type] += t.amount;
  });

  // sort dates ascending, take last 6
  const sortedDates = Object.keys(byDate).sort();
  const lastSix = sortedDates.slice(-6);

  return {
    labels: lastSix.map(d => fmtDate(d)),
    income: lastSix.map(d => byDate[d].in),
    expense: lastSix.map(d => byDate[d].out)
  };
}

function renderCashFlowChart(txns, currency) {
  const canvas = document.getElementById('cashFlowChart');
  if (!canvas) return;
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded yet — retrying in 200ms');
    setTimeout(() => renderCashFlowChart(txns, currency), 200);
    return;
  }

  const { labels, income, expense } = buildCashFlowSeries(txns);

  if (cashFlowChart) {
    cashFlowChart.destroy();
  }

  const isDark = document.body.classList.contains('dark-mode');
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  const textColor = isDark ? '#c9cdc4' : '#5c6058';

  cashFlowChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: labels.length ? labels : ['No data'],
      datasets: [
        {
          label: 'Income',
          data: income.length ? income : [0],
          backgroundColor: '#6f8f4e',   // matches your olive/ledger palette
          borderRadius: 4,
          maxBarThickness: 22
        },
        {
          label: 'Expense',
          data: expense.length ? expense : [0],
          backgroundColor: '#b5562f',   // rust/terracotta, complements the passbook look
          borderRadius: 4,
          maxBarThickness: 22
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }, // you already have a custom legend below the chart
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${fmtMoney(ctx.raw, currency)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: textColor, font: { family: 'IBM Plex Mono', size: 11 } }
        },
        y: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'IBM Plex Mono', size: 11 },
            callback: (val) => fmtMoney(val, currency)
          }
        }
      }
    }
  });
}

// ============================================================
// SETTINGS — CURRENCY / THEME / LOGOUT / WIPE
// ============================================================

function initSettings() {
  const prefs = Prefs.load();

  // Currency picker
  document.querySelectorAll('.currency-opt').forEach(opt => {
    const code = opt.textContent.trim().split(' ')[1]; // "₹ INR" -> "INR"
    opt.classList.toggle('active', code === prefs.currency);
    opt.addEventListener('click', () => {
      document.querySelectorAll('.currency-opt').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
    });
  });

  // Theme tiles
  document.querySelectorAll('.theme-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      document.querySelectorAll('.theme-tile').forEach(t => t.classList.remove('active'));
      tile.classList.add('active');
      const isDark = tile.classList.contains('dark');
      document.querySelector('.switch')?.classList.toggle('on', isDark);
    });
  });

  // Dark mode switch
  const switchEl = document.querySelector('.switch');
  if (switchEl) {
    switchEl.classList.toggle('on', prefs.darkMode);
    switchEl.addEventListener('click', () => {
      const isOn = switchEl.classList.toggle('on');
      document.querySelectorAll('.theme-tile').forEach(t => t.classList.remove('active'));
      document.querySelector(isOn ? '.theme-tile.dark' : '.theme-tile.light')?.classList.add('active');
      Prefs.apply({ darkMode: isOn });
    });
  }

  // Save Changes (profile + currency + theme)
  const saveBtn = document.querySelector('#section-settings .settings-card .btn-primary');
  saveBtn?.addEventListener('click', () => {
    const name = document.getElementById('set-name').value.trim();
    const activeCurrency = document.querySelector('.currency-opt.active');
    const currency = activeCurrency ? activeCurrency.textContent.trim().split(' ')[1] : 'INR';
    const darkMode = document.querySelector('.switch')?.classList.contains('on') || false;

    const newPrefs = { currency, darkMode };
    Prefs.save(newPrefs);
    Prefs.apply(newPrefs);

    if (name) {
      const session = LoginManager.getUser() || {};
      session.name = name;
      localStorage.setItem(STORAGE_USER, JSON.stringify(session));
      updateUserDisplay(name);
    }

    renderAll(); // refresh amounts with new currency symbol
    flashButton(saveBtn, 'Saved!');
  });

  // Settings-tab Logout
  const settingsLogoutBtn = document.querySelector('#session-card .btn-outline');
  settingsLogoutBtn?.addEventListener('click', doLogout);

  // Wipe everything
  const wipeBtn = document.querySelector('.danger-zone .btn-danger');
  wipeBtn?.addEventListener('click', () => {
    const confirmed = confirm('This will permanently delete all transactions and preferences on this device. Continue?');
    if (!confirmed) return;
    localStorage.removeItem(STORAGE_TXNS);
    localStorage.removeItem(STORAGE_PREFS);
    renderAll();
    Prefs.apply(Prefs.load());
    flashButton(wipeBtn, 'Wiped!');
  });
}

function flashButton(btn, text) {
  if (!btn) return;
  const original = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = original; }, 1500);
}


function updateUserDisplay(name) {
  const heading = document.querySelector('#section-dashboard h2');
  if (heading) heading.innerHTML = `${escapeHtml(name)}&rsquo;s Ledger`;

  // scoped to #session-card now, no longer collides with the Dark Mode toggle-row
  const sessionLabel = document.querySelector('#session-card .t-label');
  if (sessionLabel) sessionLabel.textContent = `Signed in as ${name}`;

  const setNameInput = document.getElementById('set-name');
  if (setNameInput) setNameInput.value = name;
}

// ============================================================
// LOGIN / LOGOUT FLOW
// ============================================================

function doLogin() {
  const name = document.getElementById('login-name').value.trim() || 'Guest';
  // Passcode field exists in the UI but there's no backend to verify against yet —
  // any non-empty name logs you in. Hook up real auth here when you have a server.
  LoginManager.login(name);
  document.body.classList.add('show-app');
  updateUserDisplay(name);
  if (LoginManager.isLoggedIn()) {
    const user = LoginManager.getUser();
    document.body.classList.add('show-app');
    updateUserDisplay(user.name);
  }
  renderAll();
  requestAnimationFrame(() => cashFlowChart?.resize());
}

function doLogout() {
  LoginManager.logout();
  document.body.classList.remove('show-app');
  document.getElementById('login-name').value = '';
  document.getElementById('login-pass').value = '';
}

// ============================================================
// INIT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme immediately to avoid a flash of wrong theme
  Prefs.apply(Prefs.load());

  // --- Login button ---
  const loginBtn = document.querySelector('#page-login .btn-primary');
  loginBtn?.addEventListener('click', doLogin);

  // Allow Enter key to submit login
  document.getElementById('login-pass')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doLogin();
  });

  // --- Topbar logout ---
  document.querySelector('.topbar-actions .btn-ghost')?.addEventListener('click', doLogout);

  // --- Modal open/close ---
  document.querySelector('.fab')?.addEventListener('click', openModal);
  document.querySelector('.modal-close')?.addEventListener('click', closeModal);
  document.querySelector('.modal-actions .btn-outline')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });

  // --- Modal type toggle ---
  document.querySelector('.type-toggle .t-in')?.addEventListener('click', () => setModalType('in'));
  document.querySelector('.type-toggle .t-out')?.addEventListener('click', () => setModalType('out'));

  // --- Modal save ---
  document.querySelector('.modal-actions .btn-save')?.addEventListener('click', saveModalEntry);

  // --- Table filters ---
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const label = btn.textContent.trim().toLowerCase();
      currentFilter = label === 'income' ? 'in' : label === 'expense' ? 'out' : 'all';
      renderAll();
    });
  });

  // --- Settings page wiring ---
  initSettings();

  // --- Resume session if already logged in ---
  if (LoginManager.isLoggedIn()) {
    const user = LoginManager.getUser();
    document.body.classList.add('show-app');
    updateUserDisplay(user.name);
  }

  renderAll();
});



// Wipe everything
const wipeBtn = document.querySelector('.danger-zone .btn-danger');
wipeBtn?.addEventListener('click', () => {
  const confirmed = confirm('This will permanently delete all transactions and preferences on this device. Continue?');
  if (!confirmed) return;

  // 1. Clear all localStorage keys used by the app
  localStorage.removeItem(STORAGE_TXNS);
  localStorage.removeItem(STORAGE_PREFS);
  localStorage.removeItem(STORAGE_USER);

  // 2. Reset in-memory state back to defaults
  currentFilter = 'all';
  Prefs.apply(Prefs.defaults);

  // 3. Kick back to login screen (session is gone, so re-auth is required)
  document.body.classList.remove('show-app');
  document.getElementById('login-name').value = '';
  document.getElementById('login-pass').value = '';

  // 4. Destroy the chart instance so it doesn't hold stale data
  if (cashFlowChart) {
    cashFlowChart.destroy();
    cashFlowChart = null;
  }

  flashButton(wipeBtn, 'Wiped!');
});




