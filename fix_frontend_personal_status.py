p = "src/hooks/useEntreprise.js"
s = open(p).read()

old = "  // Purge definitive (Drive + revocation) suite a une suppression par le support izi360."
assert s.count(old) == 1, f"anchor: {s.count(old)}"

new = '''  // Verifie si le compte PERSONNEL (hors entreprise) a ete suspendu/supprime par le support izi360
  const checkStatutPersonnel = async () => {
    const email = await getSetting('email');
    if (!email) return { blocked: false };
    try {
      const res = await fetch(`${IZI360_URL}/status-personal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, email }),
      });
      if (!res.ok) return { blocked: false };
      return await res.json();
    } catch(_) {
      return { blocked: false };
    }
  };

  // Purge definitive du compte personnel (Drive + BDD) suite a une suppression par le support izi360.
  // A appeler uniquement quand l'utilisateur confirme (clic "Fermer" sur l'ecran "compte supprime").
  const purgerCompteSupprime = async () => {
    const email = await getSetting('email');
    if (!email) return;
    try {
      await fetch(`${IZI360_URL}/purge-personal-supprime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: IZI360_SECRET, email }),
      });
    } catch(_) {
      // Meme si l'appel reseau echoue, on purge quand meme le local (voir App.jsx)
    }
  };

  // Purge definitive (Drive + revocation) suite a une suppression par le support izi360.'''

s = s.replace(old, new)

old2 = """    isCodeValid, activerModeAdmin, desactiverMode, connecterDriveEntreprise,"""
assert s.count(old2) == 1, f"exports: {s.count(old2)}"
new2 = """    isCodeValid, activerModeAdmin, desactiverMode, connecterDriveEntreprise,
    checkStatutPersonnel, purgerCompteSupprime,"""
s = s.replace(old2, new2)

open(p, "w").write(s)
print("useEntreprise.js OK")
