// dashboard.js
// SPA navigation logic and dashboard functionality

const sections = [
	"dashboard-section",
	"transactions-section",
	"reports-section",
	"budgets-section",
	"settings-section"
];

function showSection(sectionId) {
	sections.forEach(id => {
		const el = document.getElementById(id);
		if (el) el.style.display = "none";
	});
	const section = document.getElementById(sectionId);
	if (section) section.style.display = "block";
}

window.addEventListener('DOMContentLoaded', () => {
	const sidebarLinks = document.querySelectorAll(".sidebar-link");
	sidebarLinks.forEach(link => {
		link.addEventListener("click", () => {
			sidebarLinks.forEach(l => l.classList.remove("bg-primary/10", "dark:bg-[#232f48]", "text-primary", "dark:text-white"));
			sidebarLinks.forEach(l => l.classList.add("text-gray-600", "dark:text-muted-dark"));
			link.classList.add("bg-primary/10", "dark:bg-[#232f48]", "text-primary", "dark:text-white");
			link.classList.remove("text-gray-600", "dark:text-muted-dark");
				showSection(link.dataset.section + "-section");
				// If user opened reports, ensure charts render now (container is visible)
				if (link.dataset.section === 'reports' && typeof renderReports === 'function') {
					renderReports();
				}
		});
	});
	showSection("dashboard-section");

	// Currency formatter (will be initialized from settings)
	let currencyFormatter;

	function updateFormatter(currencyCode) {
		try {
			currencyFormatter = new Intl.NumberFormat(currencyCode === 'COP' ? 'es-CO' : (currencyCode === 'EUR' ? 'es-ES' : 'en-US'), { style: 'currency', currency: currencyCode, maximumFractionDigits: 2 });
		} catch (e) {
			currencyFormatter = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 });
		}
	}

	function saveSettings(s) {
		try { localStorage.setItem('fintrack_settings', JSON.stringify(s)); } catch (e) { console.warn(e); }
	}

	function loadSettings() {
		try {
			const raw = localStorage.getItem('fintrack_settings');
			if (!raw) return { name: 'John Doe', email: 'john.doe@email.com', currency: 'COP', emailNotifications: true, pushNotifications: false };
			const parsed = JSON.parse(raw);
			return Object.assign({ name: 'John Doe', email: '', currency: 'COP', emailNotifications: true, pushNotifications: false }, parsed);
		} catch (e) {
			console.warn('Could not load settings', e);
			return { name: 'John Doe', email: '', currency: 'COP', emailNotifications: true, pushNotifications: false };
		}
	}

	function saveTransactions() {
		try {
			localStorage.setItem('fintrack_transactions', JSON.stringify(window.transactions));
		} catch (e) {
			console.warn('Could not save transactions to localStorage', e);
		}
	}

	// Toast notifications
	function showToast(message, type = 'success', ttl = 3000) {
		const container = document.getElementById('toast-container');
		if (!container) return;
		const colors = {
			success: 'bg-green-500',
			error: 'bg-red-500',
			info: 'bg-blue-500'
		};
		const toast = document.createElement('div');
		toast.className = `text-white px-4 py-2 rounded shadow ${colors[type] || colors.info}`;
		toast.style.minWidth = '200px';
		toast.style.transition = 'opacity 0.4s ease';
		toast.textContent = message;
		container.appendChild(toast);
		setTimeout(() => {
			toast.style.opacity = '0';
			setTimeout(() => { try { container.removeChild(toast); } catch (e) {} }, 400);
		}, ttl);
	}

	function loadTransactions() {
		try {
			const raw = localStorage.getItem('fintrack_transactions');
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			if (Array.isArray(parsed)) return parsed;
		} catch (e) {
			console.warn('Could not load transactions from localStorage', e);
		}
		return [];
	}

	// Start with persisted transactions (or empty)
	window.transactions = loadTransactions();
	// Budgets
	function saveBudgets() {
		try { localStorage.setItem('fintrack_budgets', JSON.stringify(window.budgets || [])); } catch (e) { console.warn(e); }
	}
	function loadBudgets() {
		try {
			const raw = localStorage.getItem('fintrack_budgets');
			if (!raw) return [];
			const parsed = JSON.parse(raw);
			return Array.isArray(parsed) ? parsed : [];
		} catch (e) {
			console.warn('Could not load budgets', e);
			return [];
		}
	}
	window.budgets = loadBudgets();

	// Categories persistence (income and expense separate)
	function loadCategories() {
		try {
			const raw = localStorage.getItem('fintrack_categories');
			if (!raw) return { income: ['Ingreso'], expense: ['Comida','Transporte','Facturas','Otros'] };
			const parsed = JSON.parse(raw);
			return Object.assign({ income: ['Ingreso'], expense: ['Comida','Transporte','Facturas','Otros'] }, parsed || {});
		} catch (e) {
			console.warn('Could not load categories', e);
			return { income: ['Ingreso'], expense: ['Comida','Transporte','Facturas','Otros'] };
		}
	}

	function saveCategories() {
		try { localStorage.setItem('fintrack_categories', JSON.stringify(window.categories || { income: [], expense: [] })); } catch (e) { console.warn(e); }
	}

	window.categories = loadCategories();
	// Load settings and initialize formatter
	const settings = loadSettings();
	updateFormatter(settings.currency || 'COP');

	// Populate settings UI if present
	const settingNameEl = document.getElementById('setting-name');
	const settingEmailEl = document.getElementById('setting-email');
	const settingEmailNotif = document.getElementById('setting-email-notifications');
	const settingPushNotif = document.getElementById('setting-push-notifications');
	const settingCurrencyEl = document.getElementById('setting-currency');
	if (settingNameEl) settingNameEl.value = settings.name || '';
	if (settingEmailEl) settingEmailEl.value = settings.email || '';
	if (settingEmailNotif) settingEmailNotif.checked = !!settings.emailNotifications;
	if (settingPushNotif) settingPushNotif.checked = !!settings.pushNotifications;
	if (settingCurrencyEl) settingCurrencyEl.value = settings.currency || 'COP';

	// Reports filter default state
	let reportsPeriodMonths = 6; // default to 6 months
	let reportsSelectedCategories = null; // null = all

	function getLastNMonthKeys(n) {
		const keys = [];
		const now = new Date();
		for (let i = n - 1; i >= 0; i--) {
			const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
			keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
		}
		return keys;
	}

	// Wire reports filter modal
	const openReportsFiltersBtn = document.getElementById('open-reports-filters');
	const reportsFilterModal = document.getElementById('reports-filter-modal');
	const reportsPeriodEl = document.getElementById('reports-period');
	const applyReportsFiltersBtn = document.getElementById('apply-reports-filters');
	const closeReportsFiltersBtn = document.getElementById('close-reports-filters');

	if (openReportsFiltersBtn && reportsFilterModal) {
		openReportsFiltersBtn.addEventListener('click', () => { reportsFilterModal.style.display = 'flex'; });
	}
	if (closeReportsFiltersBtn && reportsFilterModal) {
		closeReportsFiltersBtn.addEventListener('click', () => { reportsFilterModal.style.display = 'none'; });
	}
	if (applyReportsFiltersBtn) {
		applyReportsFiltersBtn.addEventListener('click', () => {
			reportsPeriodMonths = parseInt(reportsPeriodEl.value, 10) || 6;
			const checked = Array.from(document.querySelectorAll('.reports-category-checkbox:checked')).map(i => i.value);
			reportsSelectedCategories = checked.length === 0 ? null : checked;
			reportsFilterModal.style.display = 'none';
			renderReports();
		});
	}

	// Populate categories dynamically
	function populateReportCategories() {
		const container = document.getElementById('reports-categories-list');
		if (!container) return;
		// Use categories from window.categories (income + expense)
		const cats = [];
		(window.categories.income || []).forEach(c => cats.push({ name: c, type: 'Ingreso' }));
		(window.categories.expense || []).forEach(c => cats.push({ name: c, type: 'Gasto' }));
		if (cats.length === 0) {
			cats.push({ name: 'Ingreso', type: 'Ingreso' });
			['Comida','Transporte','Facturas','Otros'].forEach(c => cats.push({ name: c, type: 'Gasto' }));
		}
		// sort by name
		cats.sort((a,b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
		container.innerHTML = cats.map(cat => {
			const checked = (reportsSelectedCategories === null) || (reportsSelectedCategories && reportsSelectedCategories.includes(cat.name));
			return `<label class="inline-flex items-center"><input type="checkbox" data-type="${cat.type}" class="reports-category-checkbox" value="${cat.name}" ${checked ? 'checked' : ''} /> <span class="ml-2">${cat.name} <small class="text-muted-light">(${cat.type})</small></span></label>`;
		}).join('');
		// wire select all/none buttons (no-op if missing)
		const selAll = document.getElementById('select-all-cats');
		const selNone = document.getElementById('select-none-cats');
		if (selAll) selAll.onclick = () => { container.querySelectorAll('input.reports-category-checkbox').forEach(i => i.checked = true); };
		if (selNone) selNone.onclick = () => { container.querySelectorAll('input.reports-category-checkbox').forEach(i => i.checked = false); };
		// Also refresh budget category selects whenever report categories are populated
		if (typeof populateBudgetCategorySelects === 'function') populateBudgetCategorySelects();
	}

	// Populate categories initially
	populateReportCategories();
	// populate budget category selects (create + edit)
	function populateBudgetCategorySelects() {
		const createSel = document.getElementById('budget-category-select');
		const editSel = document.getElementById('edit-budget-category');
		const options = (window.categories.expense || []).slice().sort((a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
		if (createSel) {
			createSel.innerHTML = '';
			const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Selecciona categoría'; createSel.appendChild(placeholder);
			options.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; createSel.appendChild(o); });
		}
		if (editSel) {
			editSel.innerHTML = '';
			options.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; editSel.appendChild(o); });
		}
	}
	populateBudgetCategorySelects();

		// Populate transaction category select according to current type
		function refreshTransactionCategorySelect() {
			const sel = document.getElementById('transaction-category');
			const type = document.getElementById('transaction-type') ? document.getElementById('transaction-type').value : 'Gasto';
			if (!sel) return;
			sel.innerHTML = '';
			const list = type === 'Ingreso' ? (window.categories.income || []) : (window.categories.expense || []);
			list.forEach(c => {
				const opt = document.createElement('option');
				opt.value = c; opt.textContent = c;
				sel.appendChild(opt);
			});
			// keep a fallback
			if (sel.options.length === 0) {
				const opt = document.createElement('option'); opt.value = type === 'Ingreso' ? 'Ingreso' : 'Otros'; opt.textContent = opt.value; sel.appendChild(opt);
			}
		}

		// Transactions list filters state and helpers
		let transactionsFilterType = 'all'; // 'all' | 'Ingreso' | 'Gasto'
		let transactionsFilterCategory = 'all';
		let transactionsFilterStart = null; // 'YYYY-MM-DD' or null
		let transactionsFilterEnd = null;

		function populateTransactionFilterCategories() {
			const catSel = document.getElementById('transactions-category-filter');
			if (!catSel) return;
			// Determine categories to show depending on type filter
			let options = [];
			if (transactionsFilterType === 'all') {
				options = [].concat(window.categories.income || [], window.categories.expense || []);
			} else if (transactionsFilterType === 'Ingreso') {
				options = (window.categories.income || []).slice();
			} else {
				options = (window.categories.expense || []).slice();
			}
			// dedupe and sort
			options = Array.from(new Set(options)).sort((a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
			catSel.innerHTML = '';
			const allOpt = document.createElement('option'); allOpt.value = 'all'; allOpt.textContent = 'Todas'; catSel.appendChild(allOpt);
			options.forEach(c => {
				const o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
			});
			// restore previously selected category if still present
			if (transactionsFilterCategory && Array.from(catSel.options).some(o => o.value === transactionsFilterCategory)) {
				catSel.value = transactionsFilterCategory;
			} else {
				transactionsFilterCategory = 'all';
				catSel.value = 'all';
			}
		}

		// Wire transaction filters controls
		const txTypeFilterEl = document.getElementById('transactions-type-filter');
		const txCatFilterEl = document.getElementById('transactions-category-filter');
		const txClearFiltersBtn = document.getElementById('transactions-clear-filters');
		if (txTypeFilterEl) {
			txTypeFilterEl.addEventListener('change', () => {
				transactionsFilterType = txTypeFilterEl.value || 'all';
				populateTransactionFilterCategories();
				renderTransactions();
			});
		}
		if (txCatFilterEl) {
			txCatFilterEl.addEventListener('change', () => {
				transactionsFilterCategory = txCatFilterEl.value || 'all';
				renderTransactions();
			});
		}
		// date inputs
		const txStartDateEl = document.getElementById('transactions-start-date');
		const txEndDateEl = document.getElementById('transactions-end-date');
		if (txStartDateEl) {
			txStartDateEl.addEventListener('change', () => {
				transactionsFilterStart = txStartDateEl.value || null;
				renderTransactions();
			});
		}
		if (txEndDateEl) {
			txEndDateEl.addEventListener('change', () => {
				transactionsFilterEnd = txEndDateEl.value || null;
				renderTransactions();
			});
		}
		if (txClearFiltersBtn) {
			txClearFiltersBtn.addEventListener('click', () => {
				transactionsFilterType = 'all'; transactionsFilterCategory = 'all';
				if (txTypeFilterEl) txTypeFilterEl.value = 'all';
				populateTransactionFilterCategories();
				// clear date inputs too
				transactionsFilterStart = null; transactionsFilterEnd = null;
				if (txStartDateEl) txStartDateEl.value = '';
				if (txEndDateEl) txEndDateEl.value = '';
				renderTransactions();
			});
		}

		// Wire transaction-type change
		const transTypeEl = document.getElementById('transaction-type');
		if (transTypeEl) {
			transTypeEl.addEventListener('change', () => refreshTransactionCategorySelect());
		}
		// Wire add category button
		const addCatBtn = document.getElementById('add-category-btn');
		if (addCatBtn) {
			addCatBtn.addEventListener('click', () => {
				const input = document.getElementById('new-category-name');
				if (!input) return;
				const name = input.value.trim();
				if (!name) return;
				const type = document.getElementById('transaction-type') ? document.getElementById('transaction-type').value : 'Gasto';
				if (type === 'Ingreso') {
					if (!window.categories.income.includes(name)) window.categories.income.push(name);
				} else {
					if (!window.categories.expense.includes(name)) window.categories.expense.push(name);
				}
				saveCategories();
				populateReportCategories();
				if (typeof populateBudgetCategorySelects === 'function') populateBudgetCategorySelects();
				refreshTransactionCategorySelect();
				input.value = '';
				showToast('Categoría agregada', 'success');
			});
		}

		// Initialize the transaction category select
		refreshTransactionCategorySelect();

		// Populate transaction filter categories initially
		populateTransactionFilterCategories();

	// Wire Save Settings button to persist and re-render using new currency
	const saveSettingsBtn = document.getElementById('save-settings');
	if (saveSettingsBtn) {
		saveSettingsBtn.addEventListener('click', () => {
			settings.name = settingNameEl ? settingNameEl.value : settings.name;
			settings.email = settingEmailEl ? settingEmailEl.value : settings.email;
			settings.emailNotifications = settingEmailNotif ? !!settingEmailNotif.checked : !!settings.emailNotifications;
			settings.pushNotifications = settingPushNotif ? !!settingPushNotif.checked : !!settings.pushNotifications;
			settings.currency = settingCurrencyEl ? settingCurrencyEl.value : settings.currency || 'COP';
			saveSettings(settings);
			updateFormatter(settings.currency || 'COP');
			renderTransactions();
			renderBudgets();
			renderReports();
			updateSummary();
			// small confirmation
				try { showToast('Configuración guardada', 'success'); } catch (e) { /* ignore */ }
		});
	}

	function categoryBadge(category) {
		let color = "bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300";
		if (category === "Ingreso") color = "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300";
		if (["Comida", "Transporte", "Facturas"].includes(category)) color = "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300";
		return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}">${category}</span>`;
	}

	function renderTransactions() {
		const tbody = document.getElementById("transactions-tbody");
		// Apply filters to transactions
		const filtered = window.transactions.filter(tr => {
			if (!tr) return false;
			// filter by type
			if (transactionsFilterType === 'Ingreso' && !(tr.amount > 0)) return false;
			if (transactionsFilterType === 'Gasto' && !(tr.amount < 0)) return false;
			// filter by category
			if (transactionsFilterCategory && transactionsFilterCategory !== 'all' && tr.category !== transactionsFilterCategory) return false;
			// filter by date range if set (inclusive)
			if (transactionsFilterStart) {
				const tDate = new Date(tr.date);
				const start = new Date(transactionsFilterStart + 'T00:00:00');
				if (tDate < start) return false;
			}
			if (transactionsFilterEnd) {
				const tDate = new Date(tr.date);
				const end = new Date(transactionsFilterEnd + 'T23:59:59');
				if (tDate > end) return false;
			}
			return true;
		});
		if (tbody) {
			tbody.innerHTML = filtered.slice(0, 5).map(tr => {
				const date = new Date(tr.date).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' });
				const sign = tr.amount > 0 ? '+' : '-';
				const formatted = currencyFormatter.format(Math.abs(tr.amount));
				const linkedBudget = window.budgets.find(b => b.category && b.category.toLowerCase() === (tr.category || '').toLowerCase());
				const budgetBadge = linkedBudget ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-white">${linkedBudget.name}</span>` : '';
				return `
				<tr class="border-b border-gray-200 dark:border-[#324467] hover:bg-gray-50 dark:hover:bg-white/5">
					<td class="p-4 text-sm text-gray-600 dark:text-gray-300">${date}</td>
					<td class="p-4 text-sm font-medium text-gray-900 dark:text-white">${tr.desc}</td>
					<td class="p-4 text-sm text-gray-600 dark:text-gray-300">${categoryBadge(tr.category)}${budgetBadge}</td>
					<td class="p-4 text-sm font-medium ${tr.amount > 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'} text-right">${sign}${formatted}</td>
				</tr>
			`}).join("");
		}
		const allTbody = document.getElementById("all-transactions-tbody");
		if (allTbody) {
			allTbody.innerHTML = filtered.map(tr => {
				const date = new Date(tr.date).toLocaleDateString(settings.currency === 'COP' ? 'es-CO' : (settings.currency === 'EUR' ? 'es-ES' : 'en-US'), { month: 'short', day: 'numeric', year: 'numeric' });
				const sign = tr.amount > 0 ? '+' : '-';
				const formatted = currencyFormatter.format(Math.abs(tr.amount));
				const linkedBudget = window.budgets.find(b => b.category && b.category.toLowerCase() === (tr.category || '').toLowerCase());
				const budgetBadge = linkedBudget ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary text-white">${linkedBudget.name}</span>` : '';
				return `
				<tr class="border-b border-gray-200 dark:border-[#324467] hover:bg-gray-50 dark:hover:bg-white/5">
					<td class="p-4 text-sm text-gray-600 dark:text-gray-300">${date}</td>
					<td class="p-4 text-sm font-medium text-gray-900 dark:text-white">${tr.desc}</td>
					<td class="p-4 text-sm text-gray-600 dark:text-gray-300">${categoryBadge(tr.category)}${budgetBadge}</td>
					<td class="p-4 text-sm font-medium ${tr.amount > 0 ? 'text-green-500 dark:text-green-400' : 'text-red-500 dark:text-red-400'} text-right">${sign}${formatted}</td>
				</tr>
			`}).join("");
		}

		// Update reports when transactions change
		if (typeof Chart !== 'undefined') renderReports();
		// Update dynamic categories list whenever transactions change
		populateReportCategories();
		// Update budgets display/spent when transactions change
		renderBudgets();
	}

	// Budgets: render cards
	function recomputeBudgetsSpent() {
		// reset spent
		window.budgets.forEach(b => b.spent = 0);
		window.transactions.forEach(t => {
			if (t.amount < 0) {
				// Prefer matching by budget.category; fall back to name for older budgets
				let match = window.budgets.find(b => b.category && b.category.toLowerCase() === (t.category || '').toLowerCase());
				if (!match) match = window.budgets.find(b => b.name && b.name.toLowerCase() === (t.category || '').toLowerCase());
				if (match) match.spent += Math.abs(t.amount);
			}
		});
		saveBudgets();
	}

	function renderBudgets() {
		recomputeBudgetsSpent();
		const grid = document.getElementById('budgets-grid');
		if (!grid) return;
		grid.innerHTML = window.budgets.map(b => {
			const percent = b.allocated > 0 ? Math.min(100, Math.round((b.spent / b.allocated) * 100)) : 0;
			const remaining = Math.max(0, b.allocated - (b.spent || 0));
			return `
			<div class="bg-card-light dark:bg-card-dark p-6 rounded-xl border border-gray-200 dark:border-[#324467] shadow-sm">
				<div class="flex items-start justify-between gap-2 mb-2">
					<div>
						<h3 class="font-medium text-gray-900 dark:text-white">${b.name}</h3>
						<p class="text-sm text-muted-light dark:text-muted-dark">Categoría: ${b.category ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-900/50">${b.category}</span>` : '—'}</p>
						<p class="text-sm text-muted-light dark:text-muted-dark">Asignado: ${currencyFormatter.format(b.allocated)}</p>
					</div>
					<div class="flex items-center gap-2">
						<button data-action="edit" data-id="${b.id}" class="text-sm text-primary">Editar</button>
						<button data-action="delete" data-id="${b.id}" class="text-sm text-red-600">Eliminar</button>
					</div>
				</div>
				<p class="text-sm font-medium ${percent > 70 ? 'text-red-600' : (percent > 40 ? 'text-yellow-600' : 'text-green-600')}">${currencyFormatter.format(b.spent || 0)} Gastado</p>
				<div class="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2 mt-2 mb-2 overflow-hidden">
					<div style="width: ${percent}%" class="h-2 bg-primary"></div>
				</div>
				<p class="text-sm font-medium text-green-600">${currencyFormatter.format(remaining)} Restante</p>
			</div>
		`; }).join('');
	}

	// Charts: expenses over time (line) and expenses by category (pie)
	let reportsLineChart = null;
	let reportsPieChart = null;

	function _monthLabelFromKey(key) {
		// key format YYYY-MM
		const [y, m] = key.split('-').map(Number);
		const d = new Date(y, m - 1, 1);
		return d.toLocaleDateString(settings.currency === 'COP' ? 'es-CO' : (settings.currency === 'EUR' ? 'es-ES' : 'en-US'), { month: 'short', year: 'numeric' });
	}

	function renderReports() {
		// If report canvases are hidden (reports tab not visible), skip rendering now.
		const lineEl = document.getElementById('chart-expenses-over-time');
		const pieEl = document.getElementById('chart-expenses-by-category');
		// If both don't exist, nothing to do
		if (!lineEl && !pieEl) return;
		// If both exist but are not visible (height or width === 0), skip to avoid layout/resizing loops
		if ( (lineEl && (lineEl.clientWidth === 0 || lineEl.clientHeight === 0)) && (pieEl && (pieEl.clientWidth === 0 || pieEl.clientHeight === 0)) ) {
			return;
		}

		// Aggregate incomes and expenses (by month and category), applying filters
		const monthlyIncome = new Map();
		const monthlyExpense = new Map();
		const byCategoryExpense = new Map();
		window.transactions.forEach(t => {
			if (!t || typeof t.amount !== 'number') return;
			// apply category filter if present (if filtering, skip categories not selected)
			if (reportsSelectedCategories && reportsSelectedCategories.length > 0 && !reportsSelectedCategories.includes(t.category)) return;
			const dt = new Date(t.date);
			const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
			if (t.amount > 0) {
				monthlyIncome.set(key, (monthlyIncome.get(key) || 0) + t.amount);
			} else if (t.amount < 0) {
				monthlyExpense.set(key, (monthlyExpense.get(key) || 0) + Math.abs(t.amount));
				const cat = t.category || 'Otros';
				byCategoryExpense.set(cat, (byCategoryExpense.get(cat) || 0) + Math.abs(t.amount));
			}
		});

		// Use last N months defined by reportsPeriodMonths
		const monthKeys = getLastNMonthKeys(reportsPeriodMonths);
		const monthLabels = monthKeys.map(_monthLabelFromKey);
		const monthDataExpense = monthKeys.map(k => monthlyExpense.get(k) || 0);
		const monthDataIncome = monthKeys.map(k => monthlyIncome.get(k) || 0);

		// Totals for period (for debugging/UI)
		const totalExpensePeriod = monthDataExpense.reduce((a,b) => a + b, 0);
		const totalIncomePeriod = monthDataIncome.reduce((a,b) => a + b, 0);
		const totalIncomeEl = document.getElementById('report-total-income');
		const totalExpenseEl = document.getElementById('report-total-expense');
		if (totalIncomeEl) totalIncomeEl.textContent = currencyFormatter.format(totalIncomePeriod);
		if (totalExpenseEl) totalExpenseEl.textContent = currencyFormatter.format(totalExpensePeriod);

		// Debug logs to inspect values when user reports missing incomes
		console.debug('renderReports: transactions count', window.transactions.length);
		console.debug('monthlyIncome map', Array.from(monthlyIncome.entries()));
		console.debug('monthlyExpense map', Array.from(monthlyExpense.entries()));
		console.debug('monthKeys', monthKeys);
		console.debug('monthDataIncome', monthDataIncome);
		console.debug('monthDataExpense', monthDataExpense);

		// Category data (expenses only)
			const categoryKeys = (window.categories.expense || []).filter(c => (byCategoryExpense.get(c) || 0) > 0);
			const categoryData = categoryKeys.map(k => byCategoryExpense.get(k) || 0);

			// Income by category (for the new income pie)
			const byCategoryIncome = new Map();
			window.transactions.forEach(t => {
				if (!t || typeof t.amount !== 'number') return;
				if (t.amount > 0) {
					// respect reportsSelectedCategories filter if set
					if (reportsSelectedCategories && reportsSelectedCategories.length > 0 && !reportsSelectedCategories.includes(t.category)) return;
					const cat = t.category || 'Ingreso';
					byCategoryIncome.set(cat, (byCategoryIncome.get(cat) || 0) + t.amount);
				}
			});
			const incomeCategoryKeys = (window.categories.income || []).filter(c => (byCategoryIncome.get(c) || 0) > 0);
			const incomeCategoryData = incomeCategoryKeys.map(k => byCategoryIncome.get(k) || 0);

		// Line chart (expenses and incomes over time)
		if (lineEl) {
			const ctx = lineEl.getContext('2d');
			if (reportsLineChart) {
				reportsLineChart.data.labels = monthLabels;
				reportsLineChart.data.datasets[0].data = monthDataExpense;
				reportsLineChart.data.datasets[1].data = monthDataIncome;
				reportsLineChart.update();
			} else {
				reportsLineChart = new Chart(ctx, {
					type: 'line',
					data: {
						labels: monthLabels,
						datasets: [
							{
								label: 'Gastos',
								data: monthDataExpense,
								fill: true,
								backgroundColor: 'rgba(239,68,68,0.08)',
								borderColor: 'rgba(239,68,68,0.9)',
								pointBackgroundColor: 'rgba(239,68,68,1)'
							},
							{
								label: 'Ingresos',
								data: monthDataIncome,
								fill: true,
								backgroundColor: 'rgba(16,185,129,0.08)',
								borderColor: 'rgba(16,185,129,0.9)',
								pointBackgroundColor: 'rgba(16,185,129,1)'
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						scales: {
							y: {
								ticks: {
									callback: function(value) { try { return currencyFormatter.format(value); } catch (e) { return value; } }
								}
							}
						}
					}
				});
			}
		}

		// Pie chart (by category)
		if (pieEl) {
			const ctx2 = pieEl.getContext('2d');
			// ensure we have colors matching categories length
			const bgColorsBase = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4', '#f97316', '#a78bfa', '#fb7185', '#34d399'];
			const colors = categoryKeys.map((_, i) => bgColorsBase[i % bgColorsBase.length]);
			if (reportsPieChart) {
				reportsPieChart.data.labels = categoryKeys;
				reportsPieChart.data.datasets[0].data = categoryData;
				reportsPieChart.data.datasets[0].backgroundColor = colors;
				reportsPieChart.update();
			} else {
				reportsPieChart = new Chart(ctx2, {
					type: 'pie',
					data: {
						labels: categoryKeys,
						datasets: [{
							data: categoryData,
							backgroundColor: colors
						}]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: { position: 'bottom' }
						}
					}
				});
			}
		}

		// Income pie chart (new)
		const incomePieEl = document.getElementById('chart-income-by-category');
		if (incomePieEl) {
			const ctx3 = incomePieEl.getContext('2d');
			const bgColorsBaseInc = ['#16a34a', '#60a5fa', '#f59e0b', '#7c3aed', '#06b6d4', '#f97316', '#ef4444', '#a78bfa', '#34d399', '#fb7185'];
			const incColors = incomeCategoryKeys.map((_, i) => bgColorsBaseInc[i % bgColorsBaseInc.length]);
			if (window.reportsIncomeChart) {
				window.reportsIncomeChart.data.labels = incomeCategoryKeys;
				window.reportsIncomeChart.data.datasets[0].data = incomeCategoryData;
				window.reportsIncomeChart.data.datasets[0].backgroundColor = incColors;
				window.reportsIncomeChart.update();
			} else {
				window.reportsIncomeChart = new Chart(ctx3, {
					type: 'pie',
					data: {
						labels: incomeCategoryKeys,
						datasets: [{ data: incomeCategoryData, backgroundColor: incColors }]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: { legend: { position: 'bottom' } }
					}
				});
			}
		}
	}

	// Budget UI handlers
	const openCreateBtn = document.getElementById('open-create-budget');
	const createFormWrap = document.getElementById('create-budget-form');
	const cancelCreateBtn = document.getElementById('cancel-create-budget');
	const budgetForm = document.getElementById('budget-form');
	if (openCreateBtn && createFormWrap) {
		openCreateBtn.addEventListener('click', () => { createFormWrap.style.display = 'block'; });
	}
	if (cancelCreateBtn && createFormWrap) {
		cancelCreateBtn.addEventListener('click', () => { createFormWrap.style.display = 'none'; budgetForm.reset(); const err = document.getElementById('budget-create-error'); if (err) { err.style.display = 'none'; err.textContent = ''; } });
	}
	if (budgetForm) {
		budgetForm.addEventListener('submit', (e) => {
			e.preventDefault();
			const nameEl = document.getElementById('budget-name');
			const catEl = document.getElementById('budget-category-select');
			const amtEl = document.getElementById('budget-amount');
			const errEl = document.getElementById('budget-create-error');
			const name = nameEl ? nameEl.value.trim() : '';
			const category = catEl ? catEl.value : '';
			const amt = parseFloat(amtEl ? amtEl.value : NaN);
			if (!name) { if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'El nombre es requerido.'; } showToast('Nombre requerido', 'error'); return; }
			if (!category) { if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Selecciona una categoría.'; } showToast('Selecciona una categoría', 'error'); return; }
			if (isNaN(amt)) { if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Monto inválido.'; } showToast('Monto inválido', 'error'); return; }
			// duplicate name check (case-insensitive)
			const exists = window.budgets.find(b => b.name && b.name.toLowerCase() === name.toLowerCase());
			if (exists) { if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Ya existe un presupuesto con ese nombre.'; } showToast('Nombre duplicado', 'error'); return; }
			// duplicate category check: one budget per category
			const catExists = window.budgets.find(b => b.category && b.category.toLowerCase() === category.toLowerCase());
			if (catExists) { if (errEl) { errEl.style.display = 'block'; errEl.textContent = 'Ya existe un presupuesto asignado a esta categoría.'; } showToast('Categoría ya asignada', 'error'); return; }
			const id = Date.now().toString();
			window.budgets.push({ id, name, category, allocated: amt, spent: 0 });
			saveBudgets();
			renderBudgets();
			budgetForm.reset();
			if (createFormWrap) createFormWrap.style.display = 'none';
			if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
			showToast('Presupuesto creado', 'success');
		});
	}

	// Delegate edit/delete on budgets grid
	const budgetsGridEl = document.getElementById('budgets-grid');
	// Edit modal elements
	const editBudgetModal = document.getElementById('edit-budget-modal');
	const editBudgetForm = document.getElementById('edit-budget-form');
	const editNameEl = document.getElementById('edit-budget-name');
	const editCategoryEl = document.getElementById('edit-budget-category');
	const editAmountEl = document.getElementById('edit-budget-amount');
	const editErrorEl = document.getElementById('budget-edit-error');
	let currentEditBudgetId = null;

	function openEditBudget(id) {
		const b = window.budgets.find(x => x.id === id);
		if (!b) return;
		currentEditBudgetId = id;
		if (editNameEl) editNameEl.value = b.name || '';
		if (editAmountEl) editAmountEl.value = (b.allocated || 0);
		if (editCategoryEl) editCategoryEl.value = b.category || (window.categories.expense && window.categories.expense[0]) || '';
		if (editErrorEl) { editErrorEl.style.display = 'none'; editErrorEl.textContent = ''; }
		if (editBudgetModal) editBudgetModal.style.display = 'flex';
	}

	function closeEditBudget() {
		currentEditBudgetId = null;
		if (editBudgetModal) editBudgetModal.style.display = 'none';
	}
	if (budgetsGridEl) {
		budgetsGridEl.addEventListener('click', (e) => {
			const btn = e.target.closest('button[data-action]');
			if (!btn) return;
			const action = btn.dataset.action;
			const id = btn.dataset.id;
			const idx = window.budgets.findIndex(b => b.id === id);
			if (action === 'delete' && idx > -1) {
				if (confirm('Eliminar presupuesto?')) {
					window.budgets.splice(idx, 1);
					saveBudgets(); renderBudgets();
					showToast('Presupuesto eliminado', 'error');
				}
			} else if (action === 'edit' && idx > -1) {
				openEditBudget(id);
			}
		});
	}

	// Edit modal handlers
	const closeEditBtn = document.getElementById('close-edit-budget');
	if (closeEditBtn) closeEditBtn.addEventListener('click', () => closeEditBudget());
	if (editBudgetForm) {
		editBudgetForm.addEventListener('submit', (e) => {
			e.preventDefault();
			if (!currentEditBudgetId) return;
			const name = editNameEl ? editNameEl.value.trim() : '';
			const category = editCategoryEl ? editCategoryEl.value : '';
			const amt = parseFloat(editAmountEl ? editAmountEl.value : NaN);
			if (!name) { if (editErrorEl) { editErrorEl.style.display = 'block'; editErrorEl.textContent = 'El nombre es requerido.'; } showToast('Nombre requerido', 'error'); return; }
			if (!category) { if (editErrorEl) { editErrorEl.style.display = 'block'; editErrorEl.textContent = 'Selecciona una categoría.'; } showToast('Selecciona una categoría', 'error'); return; }
			if (isNaN(amt)) { if (editErrorEl) { editErrorEl.style.display = 'block'; editErrorEl.textContent = 'Monto inválido.'; } showToast('Monto inválido', 'error'); return; }
			// check duplicates excluding current
			const otherName = window.budgets.find(b => b.id !== currentEditBudgetId && b.name && b.name.toLowerCase() === name.toLowerCase());
			if (otherName) { if (editErrorEl) { editErrorEl.style.display = 'block'; editErrorEl.textContent = 'Ya existe un presupuesto con ese nombre.'; } showToast('Nombre duplicado', 'error'); return; }
			const otherCat = window.budgets.find(b => b.id !== currentEditBudgetId && b.category && b.category.toLowerCase() === category.toLowerCase());
			if (otherCat) { if (editErrorEl) { editErrorEl.style.display = 'block'; editErrorEl.textContent = 'Otra presupuesto ya usa esa categoría.'; } showToast('Categoría duplicada', 'error'); return; }
			const b = window.budgets.find(x => x.id === currentEditBudgetId);
			if (!b) return;
			b.name = name; b.category = category; b.allocated = amt;
			saveBudgets(); renderBudgets(); closeEditBudget(); showToast('Presupuesto editado', 'info');
		});
	}

	function updateSummary() {
		const income = window.transactions.filter(t => t.amount > 0).reduce((a, b) => a + b.amount, 0);
		const expense = window.transactions.filter(t => t.amount < 0).reduce((a, b) => a + b.amount, 0);
		const balance = income + expense;
		const incomeEl = document.getElementById("total-income");
		const expenseEl = document.getElementById("total-expense");
		const balanceEl = document.getElementById("total-balance");
		if (incomeEl) incomeEl.textContent = currencyFormatter.format(income);
		if (expenseEl) expenseEl.textContent = currencyFormatter.format(Math.abs(expense));
		if (balanceEl) balanceEl.textContent = currencyFormatter.format(balance);
	}

	const addBtn = document.getElementById("add-transaction-btn");
	if (addBtn) {
		addBtn.addEventListener("click", () => {
			sidebarLinks.forEach(l => l.classList.remove("bg-primary/10", "dark:bg-[#232f48]", "text-primary", "dark:text-white"));
			sidebarLinks.forEach(l => l.classList.add("text-gray-600", "dark:text-muted-dark"));
			const transBtn = Array.from(sidebarLinks).find(l => l.dataset.section === "transactions");
			if (transBtn) {
				transBtn.classList.add("bg-primary/10", "dark:bg-[#232f48]", "text-primary", "dark:text-white");
				transBtn.classList.remove("text-gray-600", "dark:text-muted-dark");
			}
			showSection("transactions-section");
			const dateInput = document.getElementById("transaction-date");
			if (dateInput) dateInput.focus();
		});
	}

	const form = document.getElementById("transaction-form");
	if (form) {
		form.addEventListener("submit", function(e) {
			e.preventDefault();
			const date = document.getElementById("transaction-date").value;
			const desc = document.getElementById("transaction-desc").value;
			const type = document.getElementById("transaction-type") ? document.getElementById("transaction-type").value : 'Gasto';
			const category = document.getElementById("transaction-category").value;
			const amount = parseFloat(document.getElementById("transaction-amount").value);
			if (!date || !desc || !category || isNaN(amount)) return;
			const signed = type === "Ingreso" ? Math.abs(amount) : -Math.abs(amount);
			window.transactions.unshift({ date, desc, category, amount: signed });
			saveTransactions();
			renderTransactions();
			updateSummary();
			// Update budgets after adding a transaction so spent amounts refresh
			renderBudgets();
			this.reset();
			try { showToast('Transacción guardada', 'success'); } catch (e) {}
		});
	}

	const viewAllBtn = document.getElementById("view-all-transactions");
	if (viewAllBtn) {
		viewAllBtn.addEventListener("click", function(e) {
			e.preventDefault();
			sidebarLinks.forEach(l => l.classList.remove("bg-primary/10", "dark:bg-[#232f48]", "text-primary", "dark:text-white"));
			sidebarLinks.forEach(l => l.classList.add("text-gray-600", "dark:text-muted-dark"));
			const transBtn = Array.from(sidebarLinks).find(l => l.dataset.section === "transactions");
			if (transBtn) {
				transBtn.classList.add("bg-primary/10", "dark:bg-[#232f48]", "text-primary", "dark:text-white");
				transBtn.classList.remove("text-gray-600", "dark:text-muted-dark");
			}
			showSection("transactions-section");
		});
	}

	renderTransactions();
	updateSummary();
	// Ensure budgets render on initial load
	renderBudgets();

	// set default date for transaction date input to today
	const dateInput = document.getElementById('transaction-date');
	if (dateInput && !dateInput.value) {
		dateInput.value = new Date().toISOString().slice(0,10);
	}

	// --- Reset system (clear persisted app data) ---
	const resetBtn = document.getElementById('reset-system-btn');
	const resetModalEl = document.getElementById('reset-modal');
	const cancelResetBtn = document.getElementById('cancel-reset-btn');
	const confirmResetBtn = document.getElementById('confirm-reset-btn');

	function resetEscHandler(e) {
		if (e.key === 'Escape') {
			closeResetModal();
		}
	}

	function openResetModal() {
		if (!resetModalEl) return;
		resetModalEl.style.display = 'flex';
		// focus the cancel button for safe default
		setTimeout(() => {
			if (cancelResetBtn) cancelResetBtn.focus();
		}, 10);
		document.addEventListener('keydown', resetEscHandler);
	}

	function closeResetModal() {
		if (!resetModalEl) return;
		resetModalEl.style.display = 'none';
		document.removeEventListener('keydown', resetEscHandler);
	}

	if (resetBtn) resetBtn.addEventListener('click', openResetModal);
	if (cancelResetBtn) cancelResetBtn.addEventListener('click', closeResetModal);
	// close when clicking outside the dialog content
	if (resetModalEl) {
		resetModalEl.addEventListener('click', (ev) => {
			if (ev.target === resetModalEl) closeResetModal();
		});
	}

	if (confirmResetBtn) {
		confirmResetBtn.addEventListener('click', () => {
			performReset();
			closeResetModal();
		});
	}

	function performReset() {
		try {
			// collect keys to remove to avoid mutating localStorage during iteration
			const keysToRemove = new Set();
			for (let i = 0; i < localStorage.length; i++) {
				const k = localStorage.key(i);
				if (!k) continue;
				if (k.startsWith('fintrack_') || k.startsWith('monely_')) keysToRemove.add(k);
			}
			// include known keys explicitly (compat)
			['fintrack_transactions','fintrack_budgets','fintrack_settings','fintrack_categories','monely_transactions','monely_budgets','monely_settings','monely_categories'].forEach(k => keysToRemove.add(k));
			keysToRemove.forEach(k => localStorage.removeItem(k));

			// Reset in-memory state
			window.transactions = [];
			window.budgets = [];
			window.categories = { income: ['Ingreso'], expense: ['Comida','Transporte','Facturas','Otros'] };
			// Reset settings to defaults and persist
			const defaultSettings = { name: 'John Doe', email: '', currency: 'COP', emailNotifications: true, pushNotifications: false };
			saveSettings(defaultSettings);
			// persist cleared state
			saveBudgets();
			saveTransactions();
			saveCategories();

			// re-render UI
			renderTransactions();
			renderBudgets();
			renderReports();
			updateSummary();
			populateReportCategories();
			populateBudgetCategorySelects();

			showToast('Sistema restaurado. Todos los datos locales han sido borrados.', 'error', 5000);
		} catch (err) {
			console.error('Error performing reset', err);
			showToast('Error al restaurar sistema', 'error');
		}
	}
});
