import { THEMES, useTheme } from "../theme/ThemeContext";

export default function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="theme-picker" role="radiogroup" aria-label="Theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={theme === t.id}
          className={theme === t.id ? "is-selected" : ""}
          onClick={() => setTheme(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
