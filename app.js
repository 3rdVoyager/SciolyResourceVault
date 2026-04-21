
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
	// Paths to the local JSON files. Keep them at the project root for simplicity.
	const COLLECTIONS_URL = './external_test_collections.json';
	const ARCHIVES_URL = './external_test_archives.json';
	// ID of the root element in index.html where the app will render
	const ROOT_ID = 'app';

	// ----- State -----
	// `collections` and `archives` hold the two dataset arrays; `resources` is
	// the currently-displayed array (depends on `searchScope`).
	let collections = [];
	let archives = [];
	let resources = [];
	// `query` stores the current search text (trimmed)
	let query = '';
	// `viewMode` controls layout: 'grid' or 'list'
	let viewMode = 'grid';
	// `compact` hides secondary metadata when true
	let compact = false;

	// searchScope controls which fields are searched:
	// 'collections' = tournament collections, 'archives' = web archives
	let searchScope = 'collections';

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

	// After render: compute the widest `.meta-bubble` and set CSS variable
	// so all bubbles have a uniform minimum width matching the widest bubble.
	let _bubbleResizeTimer = null;

	function adjustBubbleMinWidth() {
		// debounce
		if (_bubbleResizeTimer) clearTimeout(_bubbleResizeTimer);
		_bubbleResizeTimer = setTimeout(() => {
			const bubbles = resultsContainer.querySelectorAll('.meta-bubble');
			// compute max width per data-type
			const maxByType = {};
			bubbles.forEach(b => {
				const type = b.getAttribute('data-type') || 'default';
				const w = b.scrollWidth;
				if (!maxByType[type] || w > maxByType[type]) maxByType[type] = w;
			});
			// remove any previously set meta vars we don't know about by clearing known keys first
			const known = ['year','division','level','default'];
			known.forEach(k => resultsContainer.style.removeProperty('--meta-bubble-min-' + k));
			for (const type in maxByType) {
				const px = Math.ceil(maxByType[type] + 0);
				resultsContainer.style.setProperty('--meta-bubble-min-' + type, px + 'px');
			}
			// debug: log computed widths for inspection
			try { console.debug('meta-bubble widths', maxByType); } catch (e) {}
		}, 60);
	}

	// Recompute bubble widths after render and on resize
	window.addEventListener('resize', adjustBubbleMinWidth);

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

		// Build list of searchable fields depending on the active scope.
		let fieldsToSearch = [];
		if (searchScope === 'collections') {
			fieldsToSearch = [
				getField(item, 'Tournament Full Name', 'tournament', 'event_name'),
				getField(item, 'event_name', 'Event'),
				getField(item, 'Year', 'year', 'Year(s)'),
				getField(item, 'Division', 'division')
			];
		} else if (searchScope === 'archives') {
			// archives: search titles and basic metadata (no notes/source)
			fieldsToSearch = [
				getField(item, 'Tournament Full Name', 'tournament', 'event_name'),
				getField(item, 'Year', 'year', 'Year(s)'),
				getField(item, 'Division', 'division')
			];
		} else {
			// both: combine collections + archives fields (exclude notes/source)
			fieldsToSearch = [
				getField(item, 'Tournament Full Name', 'tournament', 'event_name'),
				getField(item, 'event_name', 'Event'),
				getField(item, 'Year', 'year', 'Year(s)'),
				getField(item, 'Division', 'division')
			];
		}

		// Join fields and check if the query substring appears.
		const haystack = fieldsToSearch.map(normalize).join(' ');
		return haystack.includes(qLower);
	}

	// ----- Data loading -----
	// Fetch the two JSON files from the same folder. Uses the Fetch API.
	async function loadData() {
		// Fetch both JSON files in parallel. If one fails, fall back to an
		// empty array for that dataset and continue.
		try {
			const [cols, archs] = await Promise.all([
				fetch(COLLECTIONS_URL).then(r => r.ok ? r.json() : []).catch(() => []),
				fetch(ARCHIVES_URL).then(r => r.ok ? r.json() : []).catch(() => [])
			]);

			collections = Array.isArray(cols) ? cols : [];
			archives = Array.isArray(archs) ? archs : [];

			// Tag each item with its origin so render can style/label them.
			collections.forEach(it => { try { it.__source = 'collection'; } catch (e) {} });
			archives.forEach(it => { try { it.__source = 'archive'; } catch (e) {} });

			// Populate filters using the combined data set so dropdowns contain
			// values from both sources.
			populateFilters(collections.concat(archives));

			// Initialize displayed resources according to the current scope
			updateResourcesForScope();
			render();
		} catch (err) {
			const root = document.getElementById(ROOT_ID);
			if (root) root.innerHTML = '<pre class="error">Error loading data: ' + err.message + '</pre>';
			console.error('Failed to load JSON data', err);
		}

		// Populate filter dropdowns with unique, sorted options from the data.
		function populateFilters(data) {
			function uniqueValues(key) {
				const set = new Set();
				data.forEach(item => {
					// Use `getField` to support multiple possible column names
					const v = getField(item, key, key.toLowerCase(), key + '(s)');
					if (v != null && String(v).trim() !== '') set.add(String(v));
				});
				return Array.from(set).sort();
			}

			function fillSelect(selectEl, values) {
				selectEl.innerHTML = '';
				selectEl.appendChild(create('option', {value: ''}, 'All'));
				values.forEach(v => selectEl.appendChild(create('option', {value: v}, v)));
			}

			fillSelect(yearSelect, uniqueValues('Year'));
			fillSelect(divisionSelect, uniqueValues('Division'));
		}
	}

	// Update the `resources` variable according to the currently selected scope.
	function updateResourcesForScope() {
		if (searchScope === 'collections') resources = collections.slice();
		else if (searchScope === 'archives') resources = archives.slice();
		else resources = collections.concat(archives);
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

	// Metadata selection: users can choose which metadata bubbles to show
	const metadataBtn = create('button', {type: 'button', class: 'control-btn metadata-btn', 'aria-expanded': 'false'}, 'Metadata');

	// Results container - we toggle class 'grid' / 'list' on this element
	const resultsContainer = create('div', {class: 'results grid'});

	// Append controls and results to the root element
	// Append controls: search box first
	controls.appendChild(input);

	// Search scope select (collections / archives / both)
	const scopeSelect = create('select', {id: 'scope-select', class: 'filter scope-select', 'aria-label': 'Search scope'});
	// Label for the scope select
	const scopeLabel = create('label', {for: 'scope-select', class: 'scope-label'}, 'Type:');
	scopeSelect.appendChild(create('option', {value: 'collections', selected: true}, 'Tournament Collections'));
	scopeSelect.appendChild(create('option', {value: 'archives'}, 'Web Archives'));
	scopeSelect.appendChild(create('option', {value: 'both'}, 'Both'));
	scopeSelect.addEventListener('change', () => {
		searchScope = scopeSelect.value;
		updateResourcesForScope();
		render();
	});
	controls.appendChild(scopeLabel);
	controls.appendChild(scopeSelect);

	// Then the dropdown filters (will contain an "All" option + data-driven options)
	controls.appendChild(yearLabel);
	controls.appendChild(yearSelect);
	controls.appendChild(divisionLabel);
	controls.appendChild(divisionSelect);

	// View toggle and metadata button (metadata panel will be shown when the button is toggled)
	controls.appendChild(toggleBtn);
	controls.appendChild(metadataBtn);
	controls.appendChild(create('span', {class: 'spacer'}));
	root.appendChild(controls);
	// Metadata panel (popover) - appended to page header or controls below
	const metadataPanel = create('div', {class: 'settings-panel metadata-panel', 'aria-hidden': 'true', id: 'metadata-panel'});
	// checkbox helper
	function createCheckbox(id, labelText, checked) {
		const idAttr = 'meta-' + id;
		const wrapper = create('label', {class: 'meta-option', for: idAttr, 'data-type': id});
		const chk = create('input', {type: 'checkbox', id: idAttr});
		if (checked) chk.checked = true;
		wrapper.appendChild(chk);
		wrapper.appendChild(document.createTextNode(' ' + labelText));
		return {wrapper, chk};
	}

	// default enabled metadata (Notes removed). Load persisted selection from localStorage when available.
	let enabledMetadata;
	try {
		const saved = localStorage.getItem('scioly_enabled_metadata');
		if (saved) {
			const arr = JSON.parse(saved);
			enabledMetadata = new Set(Array.isArray(arr) ? arr : ['year','division','level']);
		} else {
			enabledMetadata = new Set(['year','division','level']);
		}
	} catch (e) {
		enabledMetadata = new Set(['year','division','level']);
	}

	// build panel content - year/division/level + source option
	const cbYear = createCheckbox('year', 'Year', enabledMetadata.has('year'));
	const cbDivision = createCheckbox('division', 'Division', enabledMetadata.has('division'));
	const cbLevel = createCheckbox('level', 'Level', enabledMetadata.has('level'));
	const cbSource = createCheckbox('source', 'Source', enabledMetadata.has('source'));

	// quick buttons
	const metaAll = create('button', {type: 'button', class: 'control-btn'}, 'All');
	const metaNone = create('button', {type: 'button', class: 'control-btn'}, 'None');

	metadataPanel.appendChild(cbYear.wrapper);
	metadataPanel.appendChild(cbDivision.wrapper);
	metadataPanel.appendChild(cbLevel.wrapper);
	metadataPanel.appendChild(cbSource.wrapper);
	metadataPanel.appendChild(create('div', {style: 'margin-top:8px; display:flex; gap:8px;'}, metaAll, metaNone));

	// reflect initial checked state visually on wrappers
	cbYear.wrapper.classList.toggle('meta-checked', cbYear.chk.checked);
	cbDivision.wrapper.classList.toggle('meta-checked', cbDivision.chk.checked);
	cbLevel.wrapper.classList.toggle('meta-checked', cbLevel.chk.checked);
	cbSource.wrapper.classList.toggle('meta-checked', cbSource.chk.checked);

	// place panel on the document body and position it next to the button when opened
	document.body.appendChild(metadataPanel);

	// wire interactions for the three options
	function updateEnabledFromCheckboxes() {
		enabledMetadata.clear();
		if (cbYear.chk.checked) enabledMetadata.add('year');
		if (cbDivision.chk.checked) enabledMetadata.add('division');
		if (cbLevel.chk.checked) enabledMetadata.add('level');
		if (cbSource.chk.checked) enabledMetadata.add('source');

		// update visual state
		cbYear.wrapper.classList.toggle('meta-checked', cbYear.chk.checked);
		cbDivision.wrapper.classList.toggle('meta-checked', cbDivision.chk.checked);
		cbLevel.wrapper.classList.toggle('meta-checked', cbLevel.chk.checked);
		cbSource.wrapper.classList.toggle('meta-checked', cbSource.chk.checked);

		// persist selection to localStorage
		try { localStorage.setItem('scioly_enabled_metadata', JSON.stringify(Array.from(enabledMetadata))); } catch (e) {}

		render();
	}
	[cbYear.chk, cbDivision.chk, cbLevel.chk, cbSource.chk].forEach(input => input.addEventListener('change', updateEnabledFromCheckboxes));
	metaAll.addEventListener('click', () => { cbYear.chk.checked = cbDivision.chk.checked = cbLevel.chk.checked = true; updateEnabledFromCheckboxes(); });
	metaNone.addEventListener('click', () => { cbYear.chk.checked = cbDivision.chk.checked = cbLevel.chk.checked = false; updateEnabledFromCheckboxes(); });

	metadataBtn.addEventListener('click', (e) => {
		const expanded = metadataBtn.getAttribute('aria-expanded') === 'true';
		if (expanded) {
			metadataBtn.setAttribute('aria-expanded', 'false');
			metadataPanel.setAttribute('aria-hidden', 'true');
		} else {
			// position the panel under the button using viewport coordinates
			const rect = metadataBtn.getBoundingClientRect();
			metadataPanel.style.position = 'absolute';
			// make visible first so we can measure its width, then choose alignment
			metadataBtn.setAttribute('aria-expanded', 'true');
			metadataPanel.setAttribute('aria-hidden', 'false');
			requestAnimationFrame(() => {
				// ensure any CSS 'right' from .settings-panel doesn't constrain us
				metadataPanel.style.right = 'auto';
				const panelWidth = metadataPanel.offsetWidth || metadataPanel.getBoundingClientRect().width;
				const margin = 12;
				const scrollX = window.scrollX || window.pageXOffset || 0;
				const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
				// default: left-align panel to the button's left
				let left = rect.left + scrollX;
				// if this would overflow the viewport to the right, align the panel's right edge
				// with the button's right edge so it opens leftwards (like the settings menu)
				if (left + panelWidth > scrollX + viewportWidth - margin) {
					left = rect.right + scrollX - panelWidth;
				}
				// clamp to viewport left edge
				if (left < scrollX + margin) left = scrollX + margin;
				metadataPanel.style.left = left + 'px';
				metadataPanel.style.top = (rect.bottom + window.scrollY + 8) + 'px';
			});
		}
	});
	root.appendChild(resultsContainer);

	// Tab handling: show/hide sections based on selected tab
	const tabTest = document.getElementById('tab-test');
	const tabResources = document.getElementById('tab-resources');
	const resourcesSection = document.getElementById('resources');

	function showTab(tabName) {
		if (tabName === 'test') {
			// show app, hide resources
			root.classList.remove('hidden');
			if (resourcesSection) resourcesSection.classList.add('hidden');
			if (tabTest) tabTest.setAttribute('aria-selected', 'true');
			if (tabResources) tabResources.setAttribute('aria-selected', 'false');
		} else if (tabName === 'resources') {
			// hide app, show resources section
			root.classList.add('hidden');
			if (resourcesSection) resourcesSection.classList.remove('hidden');
			if (tabTest) tabTest.setAttribute('aria-selected', 'false');
			if (tabResources) tabResources.setAttribute('aria-selected', 'true');
		}
	}

	if (tabTest) tabTest.addEventListener('click', () => showTab('test'));
	if (tabResources) tabResources.addEventListener('click', () => showTab('resources'));

	// default to Test Index
	showTab('test');

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

	// Toggle between grid and list views (preserve other classes like 'compact')
	toggleBtn.addEventListener('click', () => {
		viewMode = viewMode === 'grid' ? 'list' : 'grid';
		resultsContainer.classList.toggle('list', viewMode === 'list');
		resultsContainer.classList.toggle('grid', viewMode === 'grid');
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

	// Sidebar toggle wiring: open/close left slide-out and overlay
	const sidebarToggle = document.getElementById('sidebar-toggle');
	const sidebar = document.getElementById('sidebar');
	const sidebarOverlay = document.getElementById('sidebar-overlay');
	function setSidebar(open) {
		if (!sidebar) return;
		const shouldOpen = typeof open === 'boolean' ? open : !sidebar.classList.contains('open');
		if (shouldOpen) {
			sidebar.classList.add('open');
			sidebar.setAttribute('aria-hidden', 'false');
			if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
			if (sidebarOverlay) { sidebarOverlay.classList.remove('hidden'); sidebarOverlay.classList.add('visible'); }
		} else {
			sidebar.classList.remove('open');
			sidebar.setAttribute('aria-hidden', 'true');
			if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
			if (sidebarOverlay) { sidebarOverlay.classList.remove('visible'); sidebarOverlay.classList.add('hidden'); }
		}
	}
	if (sidebarToggle) sidebarToggle.addEventListener('click', () => setSidebar());
	if (sidebarOverlay) sidebarOverlay.addEventListener('click', () => setSidebar(false));
	// close sidebar on Escape (also handled elsewhere); keep here for robustness
	document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setSidebar(false); });

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

	// Close the settings or metadata panel when clicking outside, and close on Escape.
	document.addEventListener('click', (e) => {
		const target = e.target;
		if (!settingsPanel.contains(target) && !settingsBtn.contains(target)) {
			settingsBtn.setAttribute('aria-expanded', 'false');
			settingsPanel.setAttribute('aria-hidden', 'true');
		}
		if (typeof metadataPanel !== 'undefined' && !metadataPanel.contains(target) && !metadataBtn.contains(target)) {
			metadataBtn.setAttribute('aria-expanded', 'false');
			metadataPanel.setAttribute('aria-hidden', 'true');
		}
	});
	document.addEventListener('keydown', (e) => {
		if (e.key === 'Escape') {
			settingsBtn.setAttribute('aria-expanded', 'false');
			settingsPanel.setAttribute('aria-hidden', 'true');
			if (typeof metadataPanel !== 'undefined') {
				metadataBtn.setAttribute('aria-expanded', 'false');
				metadataPanel.setAttribute('aria-hidden', 'true');
			}
		}
	});

	// Metadata panel handles which meta bubbles are displayed; default selection already set.

	// ----- Render function -----
	// Uses Array.prototype.filter() (case-insensitive) to narrow resources,
	// then maps each resource to a DOM card / row.
	function render() {
		const qLower = normalize(query);

		// Read selected dropdown values (empty string means 'All')
		const yearFilter = yearSelect.value || '';
		const divisionFilter = divisionSelect.value || '';

		// Filter step (case-insensitive) + apply dropdown filters
		const matched = resources.filter(item => {
			// First check dropdown filters: if a filter has a selected value,
			// require the item's corresponding field to equal that value.
				const itemYear = String(getField(item, 'Year', 'year', 'Year(s)') || '');
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
			// Add a class and badge based on source (collection vs archive)
			const src = item.__source === 'archive' ? 'archive' : 'collection';
			card.classList.add(src === 'archive' ? 'card--archive' : 'card--collection');

			// Main title: prefer Organization for archive entries, otherwise
			// prefer 'Tournament Full Name' / event name / abbreviation.
			const titleText = (
				getField(item, 'Organization', 'organization') ||
				getField(item, 'Tournament Full Name', 'tournament', 'event_name', 'Abbr.', 'abbreviation')
			) || '(no title)';
			// Link field in the CSV is 'Link'
			const linkHref = getField(item, 'Link', 'link_url') || '#';
			const title = create('a', {class: 'title', href: linkHref, target: '_blank', rel: 'noopener noreferrer'}, titleText);
			card.appendChild(title);

			// Meta: show selected metadata bubbles (year/division/level)
			const meta = create('div', {class: 'meta'});

			const yr = getField(item, 'Year', 'year', 'Year(s)');
			const lvl = getField(item, 'Level', 'level');
			const div = getField(item, 'Division', 'division');


			// show source first (if enabled) and render as a unified source meta-bubble
			if ((typeof enabledMetadata === 'undefined' || enabledMetadata.has('source')) && src) {
				const srcLabel = src === 'archive' ? 'Archive' : 'Collection';
				// render a unified source bubble without per-source CSS classes
				meta.appendChild(create('span', {class: 'meta-bubble source-bubble', 'data-type': 'source'}, srcLabel));
			}

			if ((typeof enabledMetadata === 'undefined' || enabledMetadata.has('year')) && yr != null && String(yr).trim() !== '') meta.appendChild(create('span', {class: 'meta-bubble', 'data-type': 'year'}, String(yr)));
			if ((typeof enabledMetadata === 'undefined' || enabledMetadata.has('division')) && div != null && String(div).trim() !== '') meta.appendChild(create('span', {class: 'meta-bubble', 'data-type': 'division'}, String(div)));
			if ((typeof enabledMetadata === 'undefined' || enabledMetadata.has('level')) && lvl != null && String(lvl).trim() !== '') meta.appendChild(create('span', {class: 'meta-bubble', 'data-type': 'level'}, String(lvl)));

			// Only append the metadata container if it contains visible bubbles.
			if (meta.children && meta.children.length > 0) {
				card.appendChild(meta);
			}

			resultsContainer.appendChild(card);
		});

		// after DOM updated, adjust bubble minimum width
		adjustBubbleMinWidth();

	}

	// Load data and render initial state
	loadData();

	// Expose small API on window for debugging/quick edits in the console
	window.SciolyResourceVault = {
		reload: loadData,
		getData: () => resources,
		getCollections: () => collections,
		getArchives: () => archives,
		setView: (v) => { viewMode = v; resultsContainer.classList.toggle('grid', viewMode === 'grid'); resultsContainer.classList.toggle('list', viewMode === 'list'); }
	};

})();
