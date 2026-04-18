
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

	// ----- Search logic (case-insensitive) -----
	// This function decides whether a single resource item matches the
	// current search query. It is intentionally simple: it concatenates the
	// fields we want to search, lower-cases them, and tests `includes()`.
	// To change searchable fields, edit the array below.
	function matches(item, qLower) {
		if (!qLower) return true; // empty query matches everything

		// List of fields to search. Edit these to add/remove searchable fields.
		const fieldsToSearch = [
			item.event_name,
			item.tournament,
			item.year,
			item.source_type
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
			// Render results after loading
			render();
		} catch (err) {
			// Show a minimal error message in the app root and log to console.
			const root = document.getElementById(ROOT_ID);
			if (root) root.innerHTML = '<pre class="error">Error loading data: ' + err.message + '</pre>';
			console.error('Failed to load resources.json', err);
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

	// Controls container (search box, view toggle, compact checkbox)
	const controls = create('div', {class: 'controls'});

	// Search input: user types here to filter resources
	const input = create('input', {
		type: 'search',
		placeholder: 'Search (event, tournament, year, source)...',
		'aria-label': 'Search resources'
	});

	// Toggle button to switch between grid and list
	const toggleBtn = create('button', {type: 'button', class: 'view-toggle'}, 'Switch to list');

	// Compact view checkbox - when checked we show less metadata
	const compactCheckbox = create('input', {type: 'checkbox', id: 'compactCheckbox'});
	const compactLabel = create('label', {for: 'compactCheckbox'}, 'Compact');

	// Results container - we toggle class 'grid' / 'list' on this element
	const resultsContainer = create('div', {class: 'results grid'});

	// Append controls and results to the root element
	controls.appendChild(input);
	controls.appendChild(toggleBtn);
	controls.appendChild(create('span', {class: 'spacer'}));
	controls.appendChild(compactCheckbox);
	controls.appendChild(compactLabel);
	root.appendChild(controls);
	root.appendChild(resultsContainer);

	// ----- Event listeners -----
	// Input: re-render on each keystroke. For large datasets you might
	// want to debounce this input (not done here for simplicity).
	input.addEventListener('input', () => {
		query = input.value.trim();
		render();
	});

	// Toggle between grid and list views
	toggleBtn.addEventListener('click', () => {
		viewMode = viewMode === 'grid' ? 'list' : 'grid';
		resultsContainer.className = 'results ' + viewMode;
		toggleBtn.textContent = viewMode === 'grid' ? 'Switch to list' : 'Switch to grid';
	});

	// Compact checkbox toggles a class on resultsContainer to hide/show metadata
	compactCheckbox.addEventListener('change', () => {
		compact = compactCheckbox.checked;
		resultsContainer.classList.toggle('compact', compact);
	});

	// ----- Render function -----
	// Uses Array.prototype.filter() (case-insensitive) to narrow resources,
	// then maps each resource to a DOM card / row.
	function render() {
		const qLower = normalize(query);
		// Filter step (case-insensitive)
		const matched = resources.filter(item => matches(item, qLower));

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
			const titleText = item.tournament || item.event_name || '(no title)';
			// Make the title itself an anchor so clicking it opens the resource in a new tab.
			const linkHref = item.link_url || '#';
			const title = create('a', {class: 'title', href: linkHref, target: '_blank', rel: 'noopener noreferrer'}, titleText);
			card.appendChild(title);

			// Meta: year, event_name (if any), source_type
			if (!compact) {
				const metaParts = [];
				if (item.year) metaParts.push(item.year);
				if (item.event_name) metaParts.push(item.event_name);
				if (item.source_type) metaParts.push(item.source_type);
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
