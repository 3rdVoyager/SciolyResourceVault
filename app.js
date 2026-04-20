
/*
	Scioly Resource Vault - Minimal Plain JavaScript App

	- Loads a local JSON file `resources.json` (array of objects)
	- Provides a case-insensitive search using Array.prototype.filter()
	- Displays results in a toggleable grid or list view
	- Links open in a new tab using target="_blank" and rel="noopener noreferrer"

	Edit points:
	- `DATA_URL` if you move the JSON file
	- which fields are searched: change `matches()` to include/exclude fields
	- CSS in `style.css` to change the appearance

	This file is intentionally commented heavily so you can understand and edit it.
*/

(function () {
	// ----- Configuration -----
	// Path to the local JSON file. Keep it at the project root for simplicity.
	const DATA_URL = './resources.json';
	// ID of the root element in index.html where the app will render
	const ROOT_ID = 'app';

	// ----- State -----
	// `resources` will hold the array loaded from resources.json
	let resources = [];
	// `query` stores the current search text (trimmed)
	let query = '';
	// `viewMode` controls layout: 'grid' or 'list'
	let viewMode = 'grid';
	// `compact` hides secondary metadata when true
	let compact = false;

	// ----- Small helper utilities -----
	// Shorthand to create DOM elements with attributes and children.
	// create(tagName, attrsObject, ...children)
	function create(tag, attrs = {}, ...children) {
		const el = document.createElement(tag);
		// set attributes (class handled as 'class')
		for (const key in attrs) {
			if (key === 'class') el.className = attrs[key];
			else if (key === 'dataset') Object.assign(el.dataset, attrs[key]);
			else el.setAttribute(key, attrs[key]);
		}
		// append children (strings become text nodes)
		children.forEach(child => {
			if (child == null) return; // skip null/undefined
			if (typeof child === 'string') el.appendChild(document.createTextNode(child));
			else el.appendChild(child);
		});
		return el;
	}

	// Normalize a value to lowercase string for case-insensitive comparisons.
	function normalize(value) {
		return String(value || '').toLowerCase();
	}

	// Helper to read multiple possible field names from an item and return the first defined.
	// Use this to handle different JSON column names (e.g., 'Year' vs 'year').
	function getField(item, ...names) {
		for (const n of names) {
			if (item[n] != null) return item[n];
		}
		return '';
	}

	// ----- Search logic (case-insensitive) -----
	// This function decides whether a single resource item matches the
	// current search query. It is intentionally simple: it concatenates the
	// fields we want to search, lower-cases them, and tests `includes()`.
	// To change searchable fields, edit the array below.
	function matches(item, qLower) {
		if (!qLower) return true; // empty query matches everything

		// List of fields to search. Edit these to add/remove searchable fields.
		// Gather field values from the item, supporting multiple possible JSON keys.
		const fieldsToSearch = [
			getField(item, 'event_name', 'Tournament Full Name', 'tournament'),
			getField(item, 'Abbr.', 'abbreviation'),
			getField(item, 'Year', 'year'),
			getField(item, 'Division', 'division'),
			getField(item, 'Level', 'level'),
			getField(item, 'Notes', 'notes')
		];

		// Join fields and check if the query substring appears.
		const haystack = fieldsToSearch.map(normalize).join(' ');
		return haystack.includes(qLower);
	}

	// ----- Data loading -----
	// Fetch the JSON file from the same folder. Uses the Fetch API.
	async function loadData() {
		try {
			const res = await fetch(DATA_URL);
			if (!res.ok) throw new Error('Network response was not ok: ' + res.status);
			resources = await res.json();
			// After loading data, populate dropdowns with unique values
			populateFilters(resources);
			// Render results after loading
			render();
		} catch (err) {
			// Show a minimal error message in the app root and log to console.
			const root = document.getElementById(ROOT_ID);
			if (root) root.innerHTML = '<pre class="error">Error loading data: ' + err.message + '</pre>';
			console.error('Failed to load resources.json', err);
		}

		// Populate filter dropdowns with unique, sorted options from the data.
		function populateFilters(data) {
			// Helper: build a sorted unique array of values for a given key
			function uniqueValues(key) {
				const set = new Set();
				data.forEach(item => {
					const v = item[key];
					if (v != null && String(v).trim() !== '') set.add(String(v));
				});
				return Array.from(set).sort();
			}

			// Fill a select element with an 'All' option + values
			function fillSelect(selectEl, values) {
				selectEl.innerHTML = ''; // clear
				// 'All' option (empty value)
				selectEl.appendChild(create('option', {value: ''}, 'All'));
				values.forEach(v => selectEl.appendChild(create('option', {value: v}, v)));
			}

			// Year options (sorted) - use the exact JSON keys from your CSV
			fillSelect(yearSelect, uniqueValues('Year'));
			// Division options (use 'Division' as in the CSV)
			fillSelect(divisionSelect, uniqueValues('Division'));
		}
	}

	// ----- Build UI -----
	// Root element must exist in index.html
	const root = document.getElementById(ROOT_ID);
	if (!root) {
		// If you see this message, ensure index.html includes <div id="app"></div>
		console.error('Root element with id "' + ROOT_ID + '" not found.');
		return;
	}

	// Controls container (search box, dropdown filters, view toggle, compact checkbox)
	const controls = create('div', {class: 'controls'});

	// Search input: user types here to filter resources (general text search)
	const input = create('input', {
		type: 'search',
		placeholder: 'Search (any field)...',
		'aria-label': 'Search resources'
	});

	// Dropdown filters: we'll create selects for year and division.
	// These are populated after the data is loaded.
	const yearSelect = create('select', {class: 'filter', 'data-filter': 'year'});
	const divisionSelect = create('select', {class: 'filter', 'data-filter': 'division'});

	// Put a small label before selects for clarity (screen-reader friendly)
	const yearLabel = create('label', {}, 'Year:');
	// (source dropdown removed because most links are drives)
	const divisionLabel = create('label', {}, 'Division:');

	// Toggle button to switch between grid and list
	const toggleBtn = create('button', {type: 'button', class: 'view-toggle'}, 'Switch to list');

	// Compact view toggle button - toggles showing less metadata
	const compactBtn = create('button', {type: 'button', class: 'compact-toggle'}, 'Compact');

	// Results container - we toggle class 'grid' / 'list' on this element
	const resultsContainer = create('div', {class: 'results grid'});

	// Append controls and results to the root element
	// Append controls: search box first
	controls.appendChild(input);

	// Then the dropdown filters (will contain an "All" option + data-driven options)
	controls.appendChild(yearLabel);
	controls.appendChild(yearSelect);
	controls.appendChild(divisionLabel);
	controls.appendChild(divisionSelect);

	// View toggle and compact button (compact button placed before spacer)
	controls.appendChild(toggleBtn);
	controls.appendChild(compactBtn);
	controls.appendChild(create('span', {class: 'spacer'}));
	root.appendChild(controls);
	root.appendChild(resultsContainer);

	// ----- Event listeners -----
	// Input: re-render on each keystroke. For large datasets you might
	// want to debounce this input (not done here for simplicity).
	input.addEventListener('input', () => {
		query = input.value.trim();
		render();
	});

	// Dropdowns: change events narrow results by the selected value.
	// We use 'All' (empty value) to indicate no filter for that field.
	[yearSelect, divisionSelect].forEach(select => {
		select.addEventListener('change', () => render());
	});

	// Toggle between grid and list views
	toggleBtn.addEventListener('click', () => {
		viewMode = viewMode === 'grid' ? 'list' : 'grid';
		resultsContainer.className = 'results ' + viewMode;
		toggleBtn.textContent = viewMode === 'grid' ? 'Switch to list' : 'Switch to grid';
	});

	// Theme toggle: create a button and wire localStorage + prefers-color-scheme
	const themeBtn = create('button', {type: 'button', class: 'theme-toggle control-btn'}, 'Toggle theme');

	// Settings button + panel: place at the very top of the page (in the header)
	const settingsBtn = create('button', {type: 'button', class: 'control-btn settings-btn', 'aria-expanded': 'false', 'aria-controls': 'settings-panel'}, 'Settings');
	const settingsPanel = create('div', {id: 'settings-panel', class: 'settings-panel', 'aria-hidden': 'true'}, themeBtn);
	// Append settings button and panel into the page header (top-right)
	const pageHeader = document.querySelector('.site-header');
	if (pageHeader) {
		// put the settings button to the far right
		settingsBtn.style.marginLeft = 'auto';
		pageHeader.appendChild(settingsBtn);
		pageHeader.appendChild(settingsPanel);
	} else {
		// fallback: append to controls if header not found
		controls.appendChild(settingsBtn);
		controls.appendChild(settingsPanel);
	}

	// Initialize theme from localStorage or system preference
	function applyTheme(theme) {
		if (theme === 'dark') document.body.classList.add('dark');
		else document.body.classList.remove('dark');
		// update button text
		themeBtn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
		try { localStorage.setItem('scioly_theme', theme); } catch (e) { /* ignore */ }
	}

	(function initTheme() {
		let stored = null;
		try { stored = localStorage.getItem('scioly_theme'); } catch (e) { /* ignore */ }
		if (stored) applyTheme(stored);
		else {
			const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
			applyTheme(prefersDark ? 'dark' : 'light');
		}
	})();

	themeBtn.addEventListener('click', () => {
		const isDark = document.body.classList.contains('dark');
		applyTheme(isDark ? 'light' : 'dark');
		// keep the settings panel open so users can toggle multiple options
	});

	// Settings button behavior: toggle panel visibility
	settingsBtn.addEventListener('click', (e) => {
		const expanded = settingsBtn.getAttribute('aria-expanded') === 'true';
		settingsBtn.setAttribute('aria-expanded', String(!expanded));
		settingsPanel.setAttribute('aria-hidden', String(expanded));
	});

	// Close the settings panel when clicking outside or pressing Escape
	document.addEventListener('click', (e) => {
		const target = e.target;
		if (!settingsPanel.contains(target) && !settingsBtn.contains(target)) {
			settingsBtn.setAttribute('aria-expanded', 'false');
			settingsPanel.setAttribute('aria-hidden', 'true');
		}
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			settingsBtn.setAttribute('aria-expanded', 'false');
			settingsPanel.setAttribute('aria-hidden', 'true');
		}
	});

	// Compact checkbox toggles a class on resultsContainer to hide/show metadata
	compactBtn.addEventListener('click', () => {
		compact = !compact;
		resultsContainer.classList.toggle('compact', compact);
		// Update button text: when currently compact, show 'Detailed' to switch to detailed view;
		// when currently detailed, show 'Compact' to switch to compact view.
		compactBtn.textContent = compact ? 'Detailed' : 'Compact';
	});

	// ----- Render function -----
	// Uses Array.prototype.filter() (case-insensitive) to narrow resources,
	// then maps each resource to a DOM card / row.
	function render() {
		const qLower = normalize(query);

		// Read selected dropdown values (empty string means 'All')
		const yearFilter = yearSelect.value || '';
		const typeFilter = '';
		const divisionFilter = divisionSelect.value || '';

		// Filter step (case-insensitive) + apply dropdown filters
		const matched = resources.filter(item => {
			// First check dropdown filters: if a filter has a selected value,
			// require the item's corresponding field to equal that value.
			const itemYear = String(getField(item, 'Year', 'year') || '');
			const itemDivision = String(getField(item, 'Division', 'division') || '');
			if (yearFilter && itemYear !== yearFilter) return false;
			if (divisionFilter && itemDivision !== divisionFilter) return false;

			// Then apply the general text search
			return matches(item, qLower);
		});

		// Clear previous results
		resultsContainer.innerHTML = '';

		if (matched.length === 0) {
			// Show a small empty state message
			resultsContainer.appendChild(create('div', {class: 'empty'}, 'No results'));
			return;
		}

		// Create DOM nodes for each matched item
		matched.forEach(item => {
			// Card container
			const card = create('div', {class: 'card'});

			// Main title: tournament name (fall back to event_name)
			// Title prefers 'Tournament Full Name', then 'Abbr.', then previous keys
			const titleText = getField(item, 'Tournament Full Name', 'tournament', 'event_name', 'Abbr.', 'abbreviation') || '(no title)';
			// Link field in the CSV is 'Link'
			const linkHref = getField(item, 'Link', 'link_url') || '#';
			const title = create('a', {class: 'title', href: linkHref, target: '_blank', rel: 'noopener noreferrer'}, titleText);
			card.appendChild(title);

			// Meta: year, event_name (if any), source_type
			if (!compact) {
				const metaParts = [];
				const yr = getField(item, 'Year', 'year');
				const lvl = getField(item, 'Level', 'level');
				const div = getField(item, 'Division', 'division');
				const notes = getField(item, 'Notes', 'notes');
				if (yr) metaParts.push(yr);
				if (div) metaParts.push(div);
				if (lvl) metaParts.push(lvl);
				if (notes) metaParts.push(notes);
				const meta = create('div', {class: 'meta'}, metaParts.join(' • '));
				card.appendChild(meta);
			}

			resultsContainer.appendChild(card);
		});
	}

	// Load data and render initial state
	loadData();

	// Expose small API on window for debugging/quick edits in the console
	window.SciolyResourceVault = {
		reload: loadData,
		getData: () => resources,
		setView: (v) => { viewMode = v; resultsContainer.className = 'results ' + viewMode; }
	};

})();
