import { createContext, useContext } from "react";
import { type ResolvedKeymap, resolveKeymap } from "../keymap/index";

const defaultKeymap = resolveKeymap({});
const FALLBACK: ResolvedKeymap = defaultKeymap.ok
  ? defaultKeymap.keymap
  : { byChord: new Map(), byCommand: new Map(), chords: new Map() };

export const KeymapContext = createContext<ResolvedKeymap>(FALLBACK);

export function useKeymap(): ResolvedKeymap {
  return useContext(KeymapContext);
}
