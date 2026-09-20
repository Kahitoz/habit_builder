import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { UserOut } from "./types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserOut | null;
  /** Set after a successful login/register. */
  setSession: (accessToken: string, refreshToken: string, user: UserOut) => void;
  /** Replace only the tokens (refresh rotation). */
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Replace the cached profile (after PATCH /users/me). */
  setUser: (user: UserOut) => void;
  /** Clear everything (logout or auth failure). */
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user }),
      setTokens: (accessToken, refreshToken) => {
        set({ accessToken, refreshToken });
      },
      setUser: (user) => set({ user }),
      clearAuth: () => {
        set({ accessToken: null, refreshToken: null, user: null });
      },
    }),
    {
      name: "lifeforge-auth",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          // Corrupted or unreadable persisted state: drop it and rehydrate
          // from a clean slate so hasHydrated() can still become true
          // (otherwise the UI would wait on hydration forever). The
          // rehydrate is deferred to a microtask because this callback can
          // run synchronously inside create(), before the store binding is
          // initialized.
          try {
            localStorage.removeItem("lifeforge-auth");
            void Promise.resolve().then(() => {
              useAuthStore.persist.rehydrate();
            });
          } catch {
            // Storage unavailable — nothing to do.
          }
        }
      },
    },
  ),
);
