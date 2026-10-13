import * as React from 'react';
import { explain } from '../setup/errors';

export interface ILoad<T> {
  /** Undefined until it has loaded. */
  data: T | undefined;
  /** Why the last try didn't load, in plain words. Cleared as the next try starts. */
  error: string | undefined;
  setData: React.Dispatch<React.SetStateAction<T | undefined>>;
  /** Loads it again. */
  reload: () => Promise<void>;
}

/*
 * Loads something as the screen opens, and again whenever load changes, so
 * load should come from useCallback. onLoaded hears about each fresh load
 * while the screen is still open. Nothing is changed once it has closed.
 */
export function useLoad<T>(load: () => Promise<T>, onLoaded?: (data: T) => void): ILoad<T> {
  const [data, setData] = React.useState<T | undefined>();
  const [error, setError] = React.useState<string | undefined>();
  const alive = React.useRef(true);

  React.useEffect(() => () => { alive.current = false; }, []);

  const reload = React.useCallback(async (): Promise<void> => {
    setError(undefined);
    try {
      const next = await load();
      if (!alive.current) return;
      setData(next);
      if (onLoaded) onLoaded(next);
    } catch (e) {
      if (alive.current) setError(explain(e));
    }
  }, [load, onLoaded]);

  React.useEffect(() => { reload().catch(() => undefined); }, [reload]);

  return { data, error, setData, reload };
}
