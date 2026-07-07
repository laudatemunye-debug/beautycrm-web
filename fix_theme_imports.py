# --- useEntreprise.js ---
p1 = "src/hooks/useEntreprise.js"
s1 = open(p1).read()

old1 = """import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '../db/index';"""
assert s1.count(old1) == 1, f"import useEntreprise: trouve {s1.count(old1)} fois"
new1 = """import { useState, useEffect } from 'react';
import { getSetting, setSetting } from '../db/index';
import { DEVISES } from '../theme';"""
s1 = s1.replace(old1, new1)

old2 = """    await setSetting('devise', deviseValue);
    const { DEVISES } = await import('../theme');
    const found = DEVISES.find(d => d.label === deviseValue || d.code === deviseValue);
    window.__DEVISE_SYMBOL__ = found?.symbol || 'FC';
    window.dispatchEvent(new Event('devise-changed'));
    const email = await getSetting('email');"""
assert s1.count(old2) == 1, f"changerDevise: trouve {s1.count(old2)} fois"
new2 = """    await setSetting('devise', deviseValue);
    const found = DEVISES.find(d => d.label === deviseValue || d.code === deviseValue);
    window.__DEVISE_SYMBOL__ = found?.symbol || 'FC';
    window.dispatchEvent(new Event('devise-changed'));
    const email = await getSetting('email');"""
s1 = s1.replace(old2, new2)

old3 = """    await setSetting('devise', deviseValue);
    const { DEVISES } = await import('../theme');
    const found = DEVISES.find(d => d.label === deviseValue || d.code === deviseValue);
    window.__DEVISE_SYMBOL__ = found?.symbol || 'FC';
    window.dispatchEvent(new Event('devise-changed'));
  };"""
assert s1.count(old3) == 1, f"forcerDeviseEmploye: trouve {s1.count(old3)} fois"
new3 = """    await setSetting('devise', deviseValue);
    const found = DEVISES.find(d => d.label === deviseValue || d.code === deviseValue);
    window.__DEVISE_SYMBOL__ = found?.symbol || 'FC';
    window.dispatchEvent(new Event('devise-changed'));
  };"""
s1 = s1.replace(old3, new3)

open(p1, "w").write(s1)
print("useEntreprise.js OK")

# --- LoginPage.jsx ---
p2 = "src/pages/LoginPage.jsx"
s2 = open(p2).read()

old4 = """      await setSetting('izi360_synced', synced ? '1' : '0');
      const { DEVISES } = await import("../theme");
      const found = DEVISES.find(d => d.label === devise);"""
assert s2.count(old4) == 1, f"LoginPage: trouve {s2.count(old4)} fois"
new4 = """      await setSetting('izi360_synced', synced ? '1' : '0');
      const found = DEVISES.find(d => d.label === devise);"""
s2 = s2.replace(old4, new4)

open(p2, "w").write(s2)
print("LoginPage.jsx OK")
