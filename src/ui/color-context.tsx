import { createContext, type ReactNode, useContext } from "react";

import { DEFAULT_THEME_ID, getThemeColors, type ThemeColors } from "./colors";

const ColorContext = createContext<ThemeColors>(
  getThemeColors(DEFAULT_THEME_ID),
);

export function ColorProvider(props: {
  children: ReactNode;
  colors: ThemeColors;
}) {
  return (
    <ColorContext.Provider value={props.colors}>
      {props.children}
    </ColorContext.Provider>
  );
}

export function useColors(): ThemeColors {
  return useContext(ColorContext);
}
