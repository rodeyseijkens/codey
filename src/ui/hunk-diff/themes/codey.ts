/**
 * codey’s original hand-tuned chrome palettes, restored as the color source
 * for the unified theme system. The vendored diff renderer resolves the same
 * theme id through the same AppTheme, so chrome and diff colors come from one
 * resolution path with codey’s exact values.
 */

export type IconColorKey =
  | "aqua"
  | "beige"
  | "blue"
  | "gray"
  | "green"
  | "orange"
  | "purple"
  | "red"
  | "yellow";

export interface IconColors {
  aqua: string;
  beige: string;
  blue: string;
  gray: string;
  green: string;
  orange: string;
  purple: string;
  red: string;
  yellow: string;
}

export interface UiColors {
  accent: string;
  bg: string;
  border: string;
  comment: string;
  commentFg: string;
  cursor: string;
  diffAddedBg: string;
  diffRemovedBg: string;
  dim: string;
  errorBg: string;
  faint: string;
  fg: string;
  green: string;
  greenBg: string;
  panel: string;
  purple: string;
  red: string;
  redBg: string;
  selection: string;
  successBg: string;
  warnBg: string;
  yellow: string;
}

export interface CodeyThemeColors {
  icons: IconColors;
  ui: UiColors;
}

const GITHUB_DARK: CodeyThemeColors = {
  icons: {
    aqua: "#39d2c0",
    beige: "#e3b341",
    blue: "#58a6ff",
    gray: "#6e7681",
    green: "#3fb950",
    orange: "#e78a4e",
    purple: "#bc8cff",
    red: "#f85149",
    yellow: "#f1e05a",
  },
  ui: {
    accent: "#58a6ff",
    bg: "#0d1117",
    border: "#30363d",
    comment: "#4d3800",
    commentFg: "#e3b341",
    cursor: "#21304a",
    diffAddedBg: "#1a4d2e",
    diffRemovedBg: "#4d1a24",
    dim: "#8b949e",
    errorBg: "#3d1418",
    faint: "#484f58",
    fg: "#e6edf3",
    green: "#3fb950",
    greenBg: "#12261e",
    panel: "#161b22",
    purple: "#bc8cff",
    red: "#f85149",
    redBg: "#2d1517",
    selection: "#1f3a5f",
    successBg: "#12261e",
    warnBg: "#3d2e00",
    yellow: "#d29922",
  },
};

const GRUVBOX_DARK: CodeyThemeColors = {
  icons: {
    aqua: "#89b482",
    beige: "#ddc7a1",
    blue: "#7daea3",
    gray: "#928374",
    green: "#a9b665",
    orange: "#e78a4e",
    purple: "#d3869b",
    red: "#ea6962",
    yellow: "#d8a657",
  },
  ui: {
    accent: "#83a598",
    bg: "#1d2021",
    border: "#3c3836",
    comment: "#3c3836",
    commentFg: "#fabd2f",
    cursor: "#282828",
    diffAddedBg: "#2d4a2d",
    diffRemovedBg: "#4a2d2d",
    dim: "#928374",
    errorBg: "#442424",
    faint: "#665c54",
    fg: "#ebdbb2",
    green: "#b8bb26",
    greenBg: "#233326",
    panel: "#282828",
    purple: "#d3869b",
    red: "#fb4934",
    redBg: "#442424",
    selection: "#504945",
    successBg: "#233326",
    warnBg: "#3f3d1f",
    yellow: "#fabd2f",
  },
};

const NORD: CodeyThemeColors = {
  icons: {
    aqua: "#8fbcbb",
    beige: "#e5e9f0",
    blue: "#88c0d0",
    gray: "#4c566a",
    green: "#a3be8c",
    orange: "#d08770",
    purple: "#b48ead",
    red: "#bf616a",
    yellow: "#ebcb8b",
  },
  ui: {
    accent: "#88c0d0",
    bg: "#2e3440",
    border: "#434c5e",
    comment: "#4c566a",
    commentFg: "#ebcb8b",
    cursor: "#3b4252",
    diffAddedBg: "#3d5a4a",
    diffRemovedBg: "#5a3d4a",
    dim: "#81a1c1",
    errorBg: "#4c3749",
    faint: "#616e88",
    fg: "#d8dee9",
    green: "#a3be8c",
    greenBg: "#3a4a3d",
    panel: "#3b4252",
    purple: "#b48ead",
    red: "#bf616a",
    redBg: "#4c3749",
    selection: "#434c5e",
    successBg: "#3a4a3d",
    warnBg: "#4a443a",
    yellow: "#ebcb8b",
  },
};

const DRACULA: CodeyThemeColors = {
  icons: {
    aqua: "#8be9fd",
    beige: "#f8f8f2",
    blue: "#bd93f9",
    gray: "#6272a4",
    green: "#50fa7b",
    orange: "#ffb86c",
    purple: "#ff79c6",
    red: "#ff5555",
    yellow: "#f1fa8c",
  },
  ui: {
    accent: "#bd93f9",
    bg: "#282a36",
    border: "#44475a",
    comment: "#44475a",
    commentFg: "#f1fa8c",
    cursor: "#44475a",
    diffAddedBg: "#2d5535",
    diffRemovedBg: "#552d35",
    dim: "#6272a4",
    errorBg: "#442424",
    faint: "#44475a",
    fg: "#f8f8f2",
    green: "#50fa7b",
    greenBg: "#234428",
    panel: "#21222c",
    purple: "#ff79c6",
    red: "#ff5555",
    redBg: "#442424",
    selection: "#44475a",
    successBg: "#234428",
    warnBg: "#44442a",
    yellow: "#f1fa8c",
  },
};

const TOKYO_NIGHT: CodeyThemeColors = {
  icons: {
    aqua: "#2ac3de",
    beige: "#c0caf5",
    blue: "#7aa2f7",
    gray: "#565f89",
    green: "#9ece6a",
    orange: "#ff9e64",
    purple: "#bb9af7",
    red: "#f7768e",
    yellow: "#e0af68",
  },
  ui: {
    accent: "#7aa2f7",
    bg: "#1a1b26",
    border: "#24283b",
    comment: "#565f89",
    commentFg: "#e0af68",
    cursor: "#24283b",
    diffAddedBg: "#1e3a55",
    diffRemovedBg: "#551e3a",
    dim: "#565f89",
    errorBg: "#3d2434",
    faint: "#414868",
    fg: "#c0caf5",
    green: "#9ece6a",
    greenBg: "#24323a",
    panel: "#16161e",
    purple: "#bb9af7",
    red: "#f7768e",
    redBg: "#3d2434",
    selection: "#283457",
    successBg: "#24323a",
    warnBg: "#3d3824",
    yellow: "#e0af68",
  },
};

const ONE_DARK: CodeyThemeColors = {
  icons: {
    aqua: "#56b6c2",
    beige: "#e5c07b",
    blue: "#61afef",
    gray: "#5c6370",
    green: "#98c379",
    orange: "#d19a66",
    purple: "#c678dd",
    red: "#e06c75",
    yellow: "#e5c07b",
  },
  ui: {
    accent: "#61afef",
    bg: "#282c34",
    border: "#3e4451",
    comment: "#5c6370",
    commentFg: "#e5c07b",
    cursor: "#2c313a",
    diffAddedBg: "#2d4a35",
    diffRemovedBg: "#4a2d35",
    dim: "#5c6370",
    errorBg: "#3d2c33",
    faint: "#4b5263",
    fg: "#abb2bf",
    green: "#98c379",
    greenBg: "#2a3a2d",
    panel: "#21252b",
    purple: "#c678dd",
    red: "#e06c75",
    redBg: "#3d2c33",
    selection: "#3e4451",
    successBg: "#2a3a2d",
    warnBg: "#3d3826",
    yellow: "#e5c07b",
  },
};

const CATPPUCCIN_MOCHA: CodeyThemeColors = {
  icons: {
    aqua: "#94e2d5",
    beige: "#f9e2af",
    blue: "#89b4fa",
    gray: "#45475a",
    green: "#a6e3a1",
    orange: "#fab387",
    purple: "#cba6f7",
    red: "#f38ba8",
    yellow: "#f9e2af",
  },
  ui: {
    accent: "#89b4fa",
    bg: "#1e1e2e",
    border: "#313244",
    comment: "#45475a",
    commentFg: "#f9e2af",
    cursor: "#313244",
    diffAddedBg: "#2a4a38",
    diffRemovedBg: "#4a2a38",
    dim: "#a6adc8",
    errorBg: "#3d2530",
    faint: "#45475a",
    fg: "#cdd6f4",
    green: "#a6e3a1",
    greenBg: "#23302a",
    panel: "#181825",
    purple: "#cba6f7",
    red: "#f38ba8",
    redBg: "#3d2530",
    selection: "#313244",
    successBg: "#23302a",
    warnBg: "#3d3826",
    yellow: "#f9e2af",
  },
};

const SOLARIZED_DARK: CodeyThemeColors = {
  icons: {
    aqua: "#2aa198",
    beige: "#b58900",
    blue: "#268bd2",
    gray: "#586e75",
    green: "#859900",
    orange: "#cb4b16",
    purple: "#d33682",
    red: "#dc322f",
    yellow: "#b58900",
  },
  ui: {
    accent: "#2aa198",
    bg: "#002b36",
    border: "#073642",
    comment: "#586e75",
    commentFg: "#b58900",
    cursor: "#073642",
    diffAddedBg: "#004035",
    diffRemovedBg: "#402020",
    dim: "#586e75",
    errorBg: "#5a2424",
    faint: "#073642",
    fg: "#839496",
    green: "#859900",
    greenBg: "#3a4a2a",
    panel: "#073642",
    purple: "#d33682",
    red: "#dc322f",
    redBg: "#5a2424",
    selection: "#073642",
    successBg: "#3a4a2a",
    warnBg: "#4a4a2a",
    yellow: "#b58900",
  },
};

const MONOKAI: CodeyThemeColors = {
  icons: {
    aqua: "#66d9ef",
    beige: "#e6db74",
    blue: "#66d9ef",
    gray: "#75715e",
    green: "#a6e22e",
    orange: "#fd971f",
    purple: "#ae81ff",
    red: "#f92672",
    yellow: "#e6db74",
  },
  ui: {
    accent: "#66d9ef",
    bg: "#272822",
    border: "#3e3d32",
    comment: "#75715e",
    commentFg: "#e6db74",
    cursor: "#3e3d32",
    diffAddedBg: "#3a5a2a",
    diffRemovedBg: "#5a2a2a",
    dim: "#75715e",
    errorBg: "#4a2424",
    faint: "#49483e",
    fg: "#f8f8f2",
    green: "#a6e22e",
    greenBg: "#3a4a24",
    panel: "#20211c",
    purple: "#ae81ff",
    red: "#f92672",
    redBg: "#4a2424",
    selection: "#3e3d32",
    successBg: "#3a4a24",
    warnBg: "#4a4424",
    yellow: "#e6db74",
  },
};

const NIGHT_OWL: CodeyThemeColors = {
  icons: {
    aqua: "#7fdbca",
    beige: "#ecc48d",
    blue: "#82aaff",
    gray: "#637777",
    green: "#addb67",
    orange: "#f78c6c",
    purple: "#c792ea",
    red: "#ef5350",
    yellow: "#ecc48d",
  },
  ui: {
    accent: "#82aaff",
    bg: "#011627",
    border: "#1d3b53",
    comment: "#637777",
    commentFg: "#ecc48d",
    cursor: "#1d3b53",
    diffAddedBg: "#1a403a",
    diffRemovedBg: "#401a2a",
    dim: "#637777",
    errorBg: "#3d2424",
    faint: "#1d3b53",
    fg: "#d6deeb",
    green: "#addb67",
    greenBg: "#2a3a2a",
    panel: "#01111f",
    purple: "#c792ea",
    red: "#ef5350",
    redBg: "#3d2424",
    selection: "#1d3b53",
    successBg: "#2a3a2a",
    warnBg: "#3d3824",
    yellow: "#ecc48d",
  },
};

const ROSE_PINE: CodeyThemeColors = {
  icons: {
    aqua: "#9ccfd8",
    beige: "#f6c177",
    blue: "#9ccfd8",
    gray: "#6e6a86",
    green: "#31748f",
    orange: "#ebbcba",
    purple: "#c4a7e7",
    red: "#eb6f92",
    yellow: "#f6c177",
  },
  ui: {
    accent: "#9ccfd8",
    bg: "#191724",
    border: "#26233a",
    comment: "#403d52",
    commentFg: "#f6c177",
    cursor: "#26233a",
    diffAddedBg: "#1e3248",
    diffRemovedBg: "#481e30",
    dim: "#908caa",
    errorBg: "#3d2530",
    faint: "#403d52",
    fg: "#e0def4",
    green: "#31748f",
    greenBg: "#22313d",
    panel: "#1f1d2e",
    purple: "#c4a7e7",
    red: "#eb6f92",
    redBg: "#3d2530",
    selection: "#26233a",
    successBg: "#22313d",
    warnBg: "#3d3826",
    yellow: "#f6c177",
  },
};

const MIN_DARK: CodeyThemeColors = {
  icons: {
    aqua: "#6cb6ff",
    beige: "#f1fa8c",
    blue: "#6cb6ff",
    gray: "#5d6570",
    green: "#5af78e",
    orange: "#ff9f43",
    purple: "#b084bb",
    red: "#ff5f56",
    yellow: "#f1fa8c",
  },
  ui: {
    accent: "#6cb6ff",
    bg: "#1f2428",
    border: "#2f373d",
    comment: "#5d6570",
    commentFg: "#f1fa8c",
    cursor: "#2f373d",
    diffAddedBg: "#2a4035",
    diffRemovedBg: "#402a2a",
    dim: "#5d6570",
    errorBg: "#3d2424",
    faint: "#2f373d",
    fg: "#b9c0cb",
    green: "#5af78e",
    greenBg: "#2a3a2a",
    panel: "#262e33",
    purple: "#b084bb",
    red: "#ff5f56",
    redBg: "#3d2424",
    selection: "#2f373d",
    successBg: "#2a3a2a",
    warnBg: "#3d3824",
    yellow: "#f1fa8c",
  },
};

const GITHUB_LIGHT: CodeyThemeColors = {
  icons: {
    aqua: "#0576c0",
    beige: "#9a6700",
    blue: "#0969da",
    gray: "#6e7781",
    green: "#1a7f37",
    orange: "#953800",
    purple: "#8250df",
    red: "#cf222e",
    yellow: "#9a6700",
  },
  ui: {
    accent: "#0969da",
    bg: "#ffffff",
    border: "#d0d7de",
    comment: "#d4d4d4",
    commentFg: "#9a6700",
    cursor: "#ddf4ff",
    diffAddedBg: "#dafbe1",
    diffRemovedBg: "#ffeef0",
    dim: "#59636e",
    errorBg: "#ffeef0",
    faint: "#afb8c1",
    fg: "#1f2328",
    green: "#1a7f37",
    greenBg: "#dafbe1",
    panel: "#f6f8fa",
    purple: "#8250df",
    red: "#cf222e",
    redBg: "#ffeef0",
    selection: "#ddf4ff",
    successBg: "#dafbe1",
    warnBg: "#fff8c5",
    yellow: "#9a6700",
  },
};

const GRUVBOX_LIGHT: CodeyThemeColors = {
  icons: {
    aqua: "#427b58",
    beige: "#b57614",
    blue: "#076678",
    gray: "#7c6f64",
    green: "#79740e",
    orange: "#af3a03",
    purple: "#8f3f71",
    red: "#9d0006",
    yellow: "#b57614",
  },
  ui: {
    accent: "#076678",
    bg: "#fbf1c7",
    border: "#d5c4a1",
    comment: "#928374",
    commentFg: "#b57614",
    cursor: "#d5c4a1",
    diffAddedBg: "#e2e8c2",
    diffRemovedBg: "#f9d8d4",
    dim: "#7c6f64",
    errorBg: "#f9d8d4",
    faint: "#bdae93",
    fg: "#3c3836",
    green: "#79740e",
    greenBg: "#e2e8c2",
    panel: "#ebdbb2",
    purple: "#8f3f71",
    red: "#9d0006",
    redBg: "#f9d8d4",
    selection: "#d5c4a1",
    successBg: "#e2e8c2",
    warnBg: "#f2e5bc",
    yellow: "#b57614",
  },
};

const CATPPUCCIN_LATTE: CodeyThemeColors = {
  icons: {
    aqua: "#179299",
    beige: "#df8e1d",
    blue: "#1e66f5",
    gray: "#6c6f85",
    green: "#40a02b",
    orange: "#fe640b",
    purple: "#8839ef",
    red: "#d20f39",
    yellow: "#df8e1d",
  },
  ui: {
    accent: "#1e66f5",
    bg: "#eff1f5",
    border: "#ccd0da",
    comment: "#9ca0b0",
    commentFg: "#df8e1d",
    cursor: "#ccd0da",
    diffAddedBg: "#e2e8c2",
    diffRemovedBg: "#f9d8d4",
    dim: "#6c6f85",
    errorBg: "#f9d8d4",
    faint: "#bcc0cc",
    fg: "#4c4f69",
    green: "#40a02b",
    greenBg: "#e2e8c2",
    panel: "#e6e9ef",
    purple: "#8839ef",
    red: "#d20f39",
    redBg: "#f9d8d4",
    selection: "#ccd0da",
    successBg: "#e2e8c2",
    warnBg: "#f2e5bc",
    yellow: "#df8e1d",
  },
};

const SOLARIZED_LIGHT: CodeyThemeColors = {
  icons: {
    aqua: "#2aa198",
    beige: "#b58900",
    blue: "#268bd2",
    gray: "#586e75",
    green: "#859900",
    orange: "#cb4b16",
    purple: "#d33682",
    red: "#dc322f",
    yellow: "#b58900",
  },
  ui: {
    accent: "#2aa198",
    bg: "#fdf6e3",
    border: "#eee8d5",
    comment: "#93a1a1",
    commentFg: "#b58900",
    cursor: "#eee8d5",
    diffAddedBg: "#e2e8c2",
    diffRemovedBg: "#f9d8d4",
    dim: "#93a1a1",
    errorBg: "#f9d8d4",
    faint: "#eee8d5",
    fg: "#657b83",
    green: "#859900",
    greenBg: "#e2e8c2",
    panel: "#eee8d5",
    purple: "#d33682",
    red: "#dc322f",
    redBg: "#f9d8d4",
    selection: "#eee8d5",
    successBg: "#e2e8c2",
    warnBg: "#f2e5bc",
    yellow: "#b58900",
  },
};

const ROSE_PINE_DAWN: CodeyThemeColors = {
  icons: {
    aqua: "#56949f",
    beige: "#ea9d34",
    blue: "#56949f",
    gray: "#9893a5",
    green: "#286983",
    orange: "#d7827e",
    purple: "#907aa9",
    red: "#b4637a",
    yellow: "#ea9d34",
  },
  ui: {
    accent: "#286983",
    bg: "#faf4ed",
    border: "#dfdad9",
    comment: "#9893a5",
    commentFg: "#ea9d34",
    cursor: "#dfdad9",
    diffAddedBg: "#dce8e2",
    diffRemovedBg: "#f9d8d4",
    dim: "#9893a5",
    errorBg: "#f9d8d4",
    faint: "#cecacd",
    fg: "#575279",
    green: "#286983",
    greenBg: "#dce8e2",
    panel: "#f2e9e1",
    purple: "#907aa9",
    red: "#b4637a",
    redBg: "#f9d8d4",
    selection: "#dfdad9",
    successBg: "#dce8e2",
    warnBg: "#f2e5bc",
    yellow: "#ea9d34",
  },
};

const MIN_LIGHT: CodeyThemeColors = {
  icons: {
    aqua: "#4078f2",
    beige: "#c18401",
    blue: "#4078f2",
    gray: "#6c7379",
    green: "#50a14f",
    orange: "#d75f00",
    purple: "#a626a4",
    red: "#e45649",
    yellow: "#c18401",
  },
  ui: {
    accent: "#4078f2",
    bg: "#ffffff",
    border: "#dfe1e3",
    comment: "#a0a1a7",
    commentFg: "#c18401",
    cursor: "#dfe1e3",
    diffAddedBg: "#e0f0e0",
    diffRemovedBg: "#f6e0e0",
    dim: "#6c7379",
    errorBg: "#f6e0e0",
    faint: "#b0b5bb",
    fg: "#3b4048",
    green: "#50a14f",
    greenBg: "#e0f0e0",
    panel: "#f0f1f3",
    purple: "#a626a4",
    red: "#e45649",
    redBg: "#f6e0e0",
    selection: "#dfe1e3",
    successBg: "#e0f0e0",
    warnBg: "#f6f0e0",
    yellow: "#c18401",
  },
};

const THEMES: Record<string, CodeyThemeColors> = {
  "catppuccin-latte": CATPPUCCIN_LATTE,
  "catppuccin-mocha": CATPPUCCIN_MOCHA,
  dracula: DRACULA,
  "github-dark": GITHUB_DARK,
  "github-light": GITHUB_LIGHT,
  "gruvbox-dark-hard": GRUVBOX_DARK,
  "gruvbox-light-medium": GRUVBOX_LIGHT,
  "min-dark": MIN_DARK,
  "min-light": MIN_LIGHT,
  monokai: MONOKAI,
  "night-owl": NIGHT_OWL,
  nord: NORD,
  "one-dark-pro": ONE_DARK,
  "rose-pine": ROSE_PINE,
  "rose-pine-dawn": ROSE_PINE_DAWN,
  "solarized-dark": SOLARIZED_DARK,
  "solarized-light": SOLARIZED_LIGHT,
  "tokyo-night": TOKYO_NIGHT,
};

export const CODEX_PALETTES = THEMES;

/** Backwards-compatible alias for codey chrome color shape. */
export type ThemeColors = CodeyThemeColors;
