import type { MandalaProject } from '../domain';

export interface ProjectHistory {
  past: MandalaProject[];
  present: MandalaProject;
  future: MandalaProject[];
  transactionBase: MandalaProject | null;
}

export function createHistory(project: MandalaProject): ProjectHistory {
  return {
    past: [],
    present: project,
    future: [],
    transactionBase: null,
  };
}

export function commitProject(
  history: ProjectHistory,
  project: MandalaProject,
): ProjectHistory {
  if (history.present === project) return history;

  if (history.transactionBase) {
    return { ...history, present: project, future: [] };
  }

  return {
    past: [...history.past, history.present].slice(-100),
    present: project,
    future: [],
    transactionBase: null,
  };
}

export function beginTransaction(history: ProjectHistory): ProjectHistory {
  if (history.transactionBase) return history;
  return { ...history, transactionBase: history.present };
}

export function endTransaction(history: ProjectHistory): ProjectHistory {
  const base = history.transactionBase;
  if (!base) return history;
  if (base === history.present) return { ...history, transactionBase: null };

  return {
    ...history,
    past: [...history.past, base].slice(-100),
    future: [],
    transactionBase: null,
  };
}

export function undoHistory(history: ProjectHistory): ProjectHistory {
  const past = history.past;
  const previous = past.at(-1);
  if (!previous) return history;

  return {
    past: past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
    transactionBase: null,
  };
}

export function redoHistory(history: ProjectHistory): ProjectHistory {
  const next = history.future[0];
  if (!next) return history;

  return {
    past: [...history.past, history.present].slice(-100),
    present: next,
    future: history.future.slice(1),
    transactionBase: null,
  };
}
