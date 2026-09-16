let quitHandler: (() => void) | null = null;
let restartHandler: (() => void) | null = null;
let suspendHandler: (() => void) | null = null;
let resumeHandler: (() => void) | null = null;

export function setQuitHandler(fn: () => void): void {
  quitHandler = fn;
}

export function setRestartHandler(fn: () => void): void {
  restartHandler = fn;
}

export function setEditorHandlers(handlers: {
  resume: () => void;
  suspend: () => void;
}): void {
  suspendHandler = handlers.suspend;
  resumeHandler = handlers.resume;
}

export function suspendForEditor(): void {
  suspendHandler?.();
}

export function resumeFromEditor(): void {
  resumeHandler?.();
}

export function restart(): void {
  restartHandler?.();
}

export function quit(): void {
  if (quitHandler) {
    quitHandler();
  } else {
    process.exit(0);
  }
}
