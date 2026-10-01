/*!
 * Minimal theme switcher
 *
 * Pico.css - https://picocss.com
 * Copyright 2019-2024 - Licensed under MIT
 */

export const themeSwitcherScript = `
  (() => {
    const localStorageKey = "picoPreferredColorScheme";
    const preferredColorScheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const storedScheme = window.localStorage?.getItem(localStorageKey);
    let scheme = storedScheme === "dark" || storedScheme === "light" ? storedScheme : preferredColorScheme;

   const applyScheme = () => {
      document.querySelector("html")?.setAttribute("data-theme", scheme);
      const toggle = document.querySelector("[data-theme-toggle]");
      const nextScheme = scheme === "dark" ? "light" : "dark";
      toggle?.setAttribute("aria-label", "Switch to " + nextScheme + " theme");
      toggle?.setAttribute("title", "Switch to " + nextScheme + " theme");
    };

    document.querySelector("[data-theme-toggle]")?.addEventListener("click", (event) => {
      event.preventDefault();
      scheme = scheme === "dark" ? "light" : "dark";
      window.localStorage?.setItem(localStorageKey, scheme);
      applyScheme();
    });

    applyScheme();
  })();
`;
