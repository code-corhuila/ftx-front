// El almacenamiento del navegador puede no existir (modo privado, cookies bloqueadas).
// Todo acceso pasa por aquí y nunca lanza excepciones.

type Area = "local" | "session";

function area(which: Area): Storage | null {
  try {
    return which === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(which: Area, key: string): T | null {
  try {
    const raw = area(which)?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(which: Area, key: string, value: unknown): void {
  try {
    area(which)?.setItem(key, JSON.stringify(value));
  } catch {
    // Sin almacenamiento disponible: la app sigue funcionando sin persistir.
  }
}

export function removeKey(which: Area, key: string): void {
  try {
    area(which)?.removeItem(key);
  } catch {
    // Igual que arriba.
  }
}
