#!/usr/bin/env bun
// Headless herdr action runner for the codey plugin. Invoked by the plugin
// manifest's [[actions]] and [[events]] as `codey-herdr <action>`.
import { autoOpenPane, closePanes, openPane, togglePane } from "./bridge";

const [, , action] = process.argv;

try {
  switch (action) {
    case "toggle":
      await togglePane();
      break;
    case "open":
      await openPane();
      break;
    case "close":
      await closePanes();
      break;
    case "auto-open":
      await autoOpenPane();
      break;
    default: {
      console.error("usage: codey-herdr <toggle|open|close|auto-open>");
      process.exit(2);
    }
  }
} catch (err) {
  console.error(String(err));
  process.exit(1);
}
