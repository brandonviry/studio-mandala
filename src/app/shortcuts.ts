export interface EditorShortcutCommands {
  newProject(): void;
  open(): void;
  save(): void;
  undo(): void;
  redo(): void;
  duplicate(): void;
  rename(): void;
  moveUp(): void;
  moveDown(): void;
  remove(): void;
  fit(): void;
  actualSize(): void;
  toggleGuides(): void;
  escape(): void;
}

function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.matches('input, textarea, select, [role="textbox"]')
  );
}

export function handleEditorShortcut(
  event: KeyboardEvent,
  commands: EditorShortcutCommands,
): void {
  const modifier = event.ctrlKey || event.metaKey;
  const key = event.key.toLowerCase();
  const editing = isTextEntry(event.target);

  if (modifier && key === 'n') {
    event.preventDefault();
    commands.newProject();
  } else if (modifier && key === 'o') {
    event.preventDefault();
    commands.open();
  } else if (modifier && key === 's') {
    event.preventDefault();
    commands.save();
  } else if (modifier && key === 'z' && event.shiftKey) {
    event.preventDefault();
    commands.redo();
  } else if ((modifier && key === 'y') || (modifier && key === 'z')) {
    event.preventDefault();
    (key === 'y' ? commands.redo : commands.undo)();
  } else if (modifier && key === 'd' && !editing) {
    event.preventDefault();
    commands.duplicate();
  } else if (event.key === 'F2' && !editing) {
    event.preventDefault();
    commands.rename();
  } else if (event.altKey && event.key === 'ArrowUp' && !editing) {
    event.preventDefault();
    commands.moveUp();
  } else if (event.altKey && event.key === 'ArrowDown' && !editing) {
    event.preventDefault();
    commands.moveDown();
  } else if (
    (event.key === 'Delete' || event.key === 'Backspace') &&
    !editing
  ) {
    event.preventDefault();
    commands.remove();
  } else if (event.key === '0' && !editing) {
    event.preventDefault();
    commands.fit();
  } else if (event.key === '1' && !editing) {
    event.preventDefault();
    commands.actualSize();
  } else if (key === 'g' && !editing) {
    event.preventDefault();
    commands.toggleGuides();
  } else if (event.key === 'Escape') {
    commands.escape();
  }
}
