// ─── Canvas color palettes mirroring CSS variables ────────────────────────
export const PALETTE = {
  light: {
    background:   'hsl(60, 8%, 95%)',
    foreground:   'hsl(70, 8%, 15%)',
    primary:      'hsl(75, 60%, 44%)',
    primaryAlpha: 'hsla(75, 60%, 44%, 0.18)',
    primaryGlow:  'hsla(75, 60%, 44%, 0.35)',
    card:         'hsl(60, 6%, 97%)',
    muted:        'hsl(65, 8%, 91%)',
    mutedFg:      'hsl(70, 4%, 45%)',
    border:       'hsl(65, 6%, 86%)',
    borderHover:  'hsl(65, 6%, 70%)',
    dot:          'hsl(65, 6%, 82%)',
    shadow:       'rgba(0,0,0,0.07)',
    edgeBase:     'hsl(65, 6%, 78%)',
  },
  dark: {
    background:   'hsl(70, 4%, 9%)',
    foreground:   'hsl(60, 8%, 85%)',
    primary:      'hsl(75, 55%, 52%)',
    primaryAlpha: 'hsla(75, 55%, 52%, 0.18)',
    primaryGlow:  'hsla(75, 55%, 52%, 0.35)',
    card:         'hsl(70, 4%, 11%)',
    muted:        'hsl(70, 4%, 15%)',
    mutedFg:      'hsl(65, 4%, 50%)',
    border:       'hsl(70, 4%, 18%)',
    borderHover:  'hsl(70, 4%, 30%)',
    dot:          'hsl(70, 4%, 20%)',
    shadow:       'rgba(0,0,0,0.35)',
    edgeBase:     'hsl(70, 4%, 28%)',
  },
};

let _current = 'light';

export function initTheme() {
  const saved = localStorage.getItem('pizzadraw-theme');
  const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark' : 'light';
  applyTheme(saved || preferred);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (!localStorage.getItem('pizzadraw-theme')) applyTheme(e.matches ? 'dark' : 'light');
  });
}

function applyTheme(name) {
  _current = name;
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('pizzadraw-theme', name);
  updateThemeIcon();
}

export function toggleTheme() {
  applyTheme(_current === 'light' ? 'dark' : 'light');
}

export function getColors() {
  return PALETTE[_current];
}

export function getThemeName() {
  return _current;
}

function updateThemeIcon() {
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = _current === 'dark' ? 'light_mode' : 'dark_mode';
}
