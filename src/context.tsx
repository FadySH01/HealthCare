import { createContext, useContext } from "react";
import type { Config, Facility, Product, User } from "./types";
export type AppContext = {
  config: Config;
  user: User | null;
  facilities: Facility[];
  products: Product[];
  location: string;
  setLocation: (v: string) => void;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
  toast: (s: string) => void;
  requireLogin: () => void;
};
export const Context = createContext<AppContext>(null!);
export const useApp = () => useContext(Context);
