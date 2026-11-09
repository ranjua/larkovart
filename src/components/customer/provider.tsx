"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
export type CatalogItem = {
  id: string;
  title: string;
  image: string;
  medium: string;
  width: number;
  height: number;
  price: number;
  status: string;
  category: string;
};
export type CustomerUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  providers: string[];
};
type Saved = { favorites: string[]; cart: string[] };
type State = {
  catalog: CatalogItem[];
  saved: Saved | null;
  user: CustomerUser | null;
  config: { email: boolean; google: boolean; origin: string | null };
};
const empty: Saved = { favorites: [], cart: [] },
  key = "larkova_guest_collection_v1";
const Context = createContext<null | {
  state: State;
  favorites: string[];
  cart: string[];
  reload: () => Promise<void>;
  toggle: (
    kind: "favorite" | "cart",
    id: string,
    present: boolean,
  ) => Promise<void>;
}>(null);
function guest(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "{}");
    return Object.fromEntries(
      ["favorites", "cart"].map((k) => [
        k,
        Array.isArray(v[k])
          ? [
              ...new Set<string>(
                v[k].filter(
                  (x: unknown) =>
                    typeof x === "string" && /^[a-z0-9-]{1,80}$/.test(x),
                ),
              ),
            ].slice(0, 40)
          : [],
      ]),
    ) as Saved;
  } catch {
    return empty;
  }
}
export function CustomerProvider({ children }: { children: ReactNode }) {
  const sequence = useRef(0);
  const [state, setState] = useState<State>({
      catalog: [],
      saved: null,
      user: null,
      config: { email: false, google: false, origin: null },
    }),
    [local, setLocal] = useState<Saved>(empty);
  const reload = useCallback(async () => {
    const requestId = ++sequence.current;
    const r = await fetch("/api/customer/state", { cache: "no-store" });
    if (!r.ok) throw new Error("unavailable");
    const next: State = await r.json();
    const g = guest();
    if (next.user?.emailVerified && (g.cart.length || g.favorites.length)) {
      const merged = await fetch("/api/customer/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(g),
      });
      if (merged.ok) {
        next.saved = (await merged.json()).saved;
        localStorage.removeItem(key);
        setLocal(empty);
      }
    }
    if (requestId === sequence.current) setState(next);
  }, []);
  useEffect(() => {
    setLocal(guest());
    reload().catch(() => {});
    const sync = () => setLocal(guest());
    const focus = () => reload().catch(() => {});
    window.addEventListener("storage", sync);
    window.addEventListener("focus", focus);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", focus);
    };
  }, []);
  async function toggle(
    kind: "favorite" | "cart",
    id: string,
    present: boolean,
  ) {
    if (state.user?.emailVerified) {
      const r = await fetch("/api/customer/saved", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, artworkId: id, present }),
      });
      if (!r.ok) {
        await reload();
        throw new Error("unavailable");
      }
      const data = await r.json();
      setState((s) =>
        s.user?.id === state.user?.id ? { ...s, saved: data.saved } : s,
      );
    } else {
      const current = guest(),
        field = kind === "favorite" ? "favorites" : "cart";
      current[field] = present
        ? [...new Set([...current[field], id])].slice(0, 40)
        : current[field].filter((x) => x !== id);
      localStorage.setItem(key, JSON.stringify(current));
      setLocal(current);
    }
  }
  return (
    <Context.Provider
      value={{
        state,
        favorites: state.saved?.favorites || local.favorites,
        cart: state.saved?.cart || local.cart,
        reload,
        toggle,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useCustomer() {
  const c = useContext(Context);
  if (!c) throw new Error("Customer provider missing");
  return c;
}
