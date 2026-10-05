import { useCallback, useEffect, useState, type DependencyList } from "react";

export interface AsyncState<T> {
  loading: boolean;
  data?: T;
  error?: unknown;
  reload: () => void;
  setData: (data: T) => void;
}

/** Ejecuta `fn` cuando cambian `deps` e ignora respuestas que llegan tarde. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [state, setState] = useState<{ loading: boolean; data?: T; error?: unknown }>({ loading: true });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ loading: true, data: s.data }));
    fn().then(
      (data) => {
        if (alive) setState({ loading: false, data });
      },
      (error: unknown) => {
        if (alive) setState({ loading: false, error });
      },
    );
    return () => {
      alive = false;
    };
    // `fn` cambia en cada render; las dependencias reales son `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback((data: T) => setState({ loading: false, data }), []);

  return { ...state, reload, setData };
}
