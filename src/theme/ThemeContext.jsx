import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { setThemePreference } from "../lib/files";

export const THEMES = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "retro", label: "Retro '90s" },
];

const STORAGE_KEY = "ams.theme";
const isTheme = (t) => THEMES.some((x) => x.id === t);

function storedTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    return isTheme(t) ? t : "light";
  } catch {
    return "light";
  }
}

const ThemeContext = createContext({ theme: "light", setTheme: () => {} });

// The theme is saved on the student's account (so it follows them between
// computers) and in this browser (so the login page matches too).
export function ThemeProvider({ children }) {
  const { user, profile } = useAuth();
  const [theme, setThemeState] = useState(storedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Optional convenience only.
    }
  }, [theme]);

  useEffect(() => {
    if (isTheme(profile?.theme)) setThemeState(profile.theme);
  }, [profile?.theme]);

  const setTheme = useCallback(
    (next) => {
      if (!isTheme(next)) return;
      setThemeState(next);
      if (user) setThemePreference(user.uid, next).catch((err) => console.error(err));
    },
    [user],
  );

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
