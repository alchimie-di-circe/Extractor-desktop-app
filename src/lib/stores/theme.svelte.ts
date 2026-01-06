// Theme store using Svelte 5 runes
// Provides reactive theme state with localStorage persistence and system preference detection

export type Theme = 'light' | 'dark' | 'system';

// The actual resolved theme (what's applied to the DOM)
let resolvedTheme = $state<'light' | 'dark'>('light');

// The user's preference (including 'system' option)
let themePreference = $state<Theme>('system');

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

/**
 * Determine the current system color scheme preference.
 *
 * @returns `"dark"` if the system prefers a dark color scheme, `"light"` otherwise (defaults to `"light"` in non-browser environments).
 */
function getSystemTheme(): 'light' | 'dark' {
	if (!isBrowser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Determine which theme ('light' or 'dark') should be applied for a given preference.
 *
 * @param preference - The user's theme preference; use `'system'` to follow the operating system's color scheme.
 * @returns The resolved theme: `'light'` or `'dark'`.
 */
function resolveTheme(preference: Theme): 'light' | 'dark' {
	if (preference === 'system') {
		return getSystemTheme();
	}
	return preference;
}

/**
 * Update the document root to reflect the given theme by adding or removing the `dark` class.
 *
 * This is a no-op when not running in a browser environment.
 *
 * @param theme - The theme to apply; `'dark'` adds the `dark` class, `'light'` removes it
 */
function applyTheme(theme: 'light' | 'dark') {
	if (!isBrowser) return;

	const root = document.documentElement;
	if (theme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
}

/**
 * Initializes themePreference and resolvedTheme from persistent or system settings and applies the result to the DOM.
 *
 * Reads the 'theme' key from localStorage; if it contains 'light', 'dark', or 'system' that value becomes the preference, otherwise the preference is set to 'system'. Resolves the actual theme ('light' or 'dark') and applies it (toggles the document's `dark` class). Does nothing when not running in a browser.
 */
function initializeTheme() {
	if (!isBrowser) return;

	const stored = localStorage.getItem('theme') as Theme | null;
	if (stored && ['light', 'dark', 'system'].includes(stored)) {
		themePreference = stored;
	} else {
		themePreference = 'system';
	}

	resolvedTheme = resolveTheme(themePreference);
	applyTheme(resolvedTheme);
}

/**
 * Registers a listener for system color-scheme changes and updates the applied theme when the user preference is `system`.
 *
 * When running in a browser, the listener updates the resolved theme and applies it to the document whenever the
 * `(prefers-color-scheme: dark)` media query changes and the current preference is `system`.
 *
 * @returns A cleanup function that removes the media-query change listener, or `undefined` when not running in a browser.
 */
function setupSystemThemeListener() {
	if (!isBrowser) return;

	const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

	const handleChange = () => {
		if (themePreference === 'system') {
			resolvedTheme = getSystemTheme();
			applyTheme(resolvedTheme);
		}
	};

	mediaQuery.addEventListener('change', handleChange);

	return () => mediaQuery.removeEventListener('change', handleChange);
}

// Initialize on module load (only in browser)
if (isBrowser) {
	initializeTheme();
	setupSystemThemeListener();
}

/**
 * Sets the user's theme preference, updates the resolved theme, applies it to the document, and persists the preference in localStorage when available.
 *
 * @param theme - The desired theme preference: 'light', 'dark', or 'system'
 */
export function setTheme(theme: Theme) {
	themePreference = theme;
	resolvedTheme = resolveTheme(theme);
	applyTheme(resolvedTheme);

	if (isBrowser) {
		localStorage.setItem('theme', theme);
	}
}

/**
 * Advance the user theme preference to the next value in the cycle: light → dark → system → light.
 *
 * Updates the stored preference, applies the resulting resolved theme to the document, and persists the new preference.
 */
export function toggleTheme() {
	// Cycle through: light -> dark -> system -> light
	if (themePreference === 'light') {
		setTheme('dark');
	} else if (themePreference === 'dark') {
		setTheme('system');
	} else {
		setTheme('light');
	}
}

/**
 * Get the current theme preference selected by the user.
 *
 * @returns The user's theme preference: `'light'`, `'dark'`, or `'system'`.
 */
export function getTheme(): Theme {
	return themePreference;
}

/**
 * Get the currently applied theme resolved from the user's preference and system settings.
 *
 * @returns `'light'` if the applied theme is light, `'dark'` if the applied theme is dark
 */
export function getResolvedTheme(): 'light' | 'dark' {
	return resolvedTheme;
}

// Reactive getters using $derived would require being in a .svelte context
// So we export a function that returns current state
export const theme = {
	get preference() {
		return themePreference;
	},
	get resolved() {
		return resolvedTheme;
	},
	set: setTheme,
	toggle: toggleTheme
};