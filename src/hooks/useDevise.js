import { useState, useEffect } from "react";
import { getSetting } from "../db/index";
import { DEVISES } from "../theme";

export const useDevise = () => {
  const [symbol, setSymbol] = useState(window.__DEVISE_SYMBOL__ || "FC");

  useEffect(() => {
    const load = () => {
      getSetting("devise").then(saved => {
        if (!saved) return;
        const found = DEVISES.find(d => d.label === saved || d.code === saved);
        const sym = found?.symbol || "FC";
        window.__DEVISE_SYMBOL__ = sym;
        setSymbol(sym);
      });
    };
    load();
    window.addEventListener("devise-changed", load);
    return () => window.removeEventListener("devise-changed", load);
  }, []);

  return symbol;
};
