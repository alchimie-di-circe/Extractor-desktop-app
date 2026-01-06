// Theme store using Svelte 5 runes
// Provides reactive theme state with localStorage persistence and system preference detection

export type Theme = 'light' | 'dark' | 'system';

// The actual resolved theme (what's applied to the DOM)
let resolvedTheme = $state<'light' | 'dark'>('light');

// The user's preference (including 'system' option)
let themePreference = $state<Theme>('system');

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Get system preference
function getSystemTheme(): 'light' | 'dark' {
	if (!isBrowser) return 'light';
	return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Resolve the actual theme based on preference
function resolveTheme(preference: Theme): 'light' | 'dark' {
	if (preference === 'system') {
		return getSystemTheme();
	}
	return preference;
}

// Apply theme to the DOM
function applyTheme(theme: 'light' | 'dark') {
	if (!isBrowser) return;

	const root = document.documentElement;
	if (theme === 'dark') {
		root.classList.add('dark');
	} else {
		root.classList.remove('dark');
	}
}

// Initialize theme from localStorage or system preference
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

// Set up system theme change listener
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

// Public API
export function setTheme(theme: Theme) {
	themePreference = theme;
	resolvedTheme = resolveTheme(theme);
	applyTheme(resolvedTheme);

	if (isBrowser) {
		localStorage.setItem('theme', theme);
	}
}

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

export function getTheme(): Theme {
	return themePreference;
}

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
