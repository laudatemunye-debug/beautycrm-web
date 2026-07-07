# --- App.jsx ---
p1 = "src/App.jsx"
s1 = open(p1).read()

old1 = "import { getSetting, setSetting, importAllData } from './db/index';"
assert s1.count(old1) == 1, f"App.jsx import: {s1.count(old1)}"
new1 = "import { getSetting, setSetting, importAllData, resetDB } from './db/index';"
s1 = s1.replace(old1, new1)

old2 = """  const fermerRevocation = async () => {
    try {
      const { resetDB } = await import('./db/index');
      resetDB();"""
assert s1.count(old2) == 1, f"App.jsx fermerRevocation: {s1.count(old2)}"
new2 = """  const fermerRevocation = async () => {
    try {
      resetDB();"""
s1 = s1.replace(old2, new2)

open(p1, "w").write(s1)
print("App.jsx OK")

# --- useEntreprise.js ---
p2 = "src/hooks/useEntreprise.js"
s2 = open(p2).read()

old3 = "import { getSetting, setSetting } from '../db/index';"
assert s2.count(old3) == 1, f"useEntreprise import: {s2.count(old3)}"
new3 = "import { getSetting, setSetting, exportAllData, importAllData } from '../db/index';"
s2 = s2.replace(old3, new3)

old4 = """  const autoSync = async (adminEm) => {
    try {
      const { exportAllData, importAllData } = await import('../db/index');
      const localData = await exportAllData();"""
assert s2.count(old4) == 1, f"autoSync: {s2.count(old4)}"
new4 = """  const autoSync = async (adminEm) => {
    try {
      const localData = await exportAllData();"""
s2 = s2.replace(old4, new4)

old5 = """    if (!email) throw new Error('Aucune entreprise configuree');

    const { exportAllData, importAllData } = await import('../db/index');
    const localData = await exportAllData();"""
assert s2.count(old5) == 1, f"syncEntreprise: {s2.count(old5)}"
new5 = """    if (!email) throw new Error('Aucune entreprise configuree');

    const localData = await exportAllData();"""
s2 = s2.replace(old5, new5)

old6 = """      if (!lastSync) return true;
      const { exportAllData } = await import('../db/index');
      const localData = await exportAllData();"""
assert s2.count(old6) == 1, f"checkPendingSync: {s2.count(old6)}"
new6 = """      if (!lastSync) return true;
      const localData = await exportAllData();"""
s2 = s2.replace(old6, new6)

open(p2, "w").write(s2)
print("useEntreprise.js OK")

# --- useGoogle.js ---
p3 = "src/hooks/useGoogle.js"
s3 = open(p3).read()

old7 = "import { setSetting, getSetting } from '../db/index';"
assert s3.count(old7) == 1, f"useGoogle import: {s3.count(old7)}"
new7 = "import { setSetting, getSetting, importAllData } from '../db/index';"
s3 = s3.replace(old7, new7)

old8 = """      // 4. Sauvegarde merged en local
      const { importAllData } = await import('../db/index');
      await importAllData(merged);"""
assert s3.count(old8) == 1, f"useGoogle importAllData call: {s3.count(old8)}"
new8 = """      // 4. Sauvegarde merged en local
      await importAllData(merged);"""
s3 = s3.replace(old8, new8)

open(p3, "w").write(s3)
print("useGoogle.js OK")
