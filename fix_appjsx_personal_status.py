p = "src/App.jsx"
s = open(p).read()

old1 = """  const [suspensionMotif, setSuspensionMotif] = useState('');
  const [suspensionContact, setSuspensionContact] = useState(null);"""
assert s.count(old1) == 1, f"etats: {s.count(old1)}"
new1 = old1 + """
  const [supprimePersonnel, setSupprimePersonnel] = useState(false);
  const [suppressionMotifPersonnel, setSuppressionMotifPersonnel] = useState('');
  const [suppressionContactPersonnel, setSuppressionContactPersonnel] = useState(null);
  const [suspenduPersonnel, setSuspenduPersonnel] = useState(false);
  const [suspensionMotifPersonnel, setSuspensionMotifPersonnel] = useState('');
  const [suspensionContactPersonnel, setSuspensionContactPersonnel] = useState(null);"""
s = s.replace(old1, new1)

old2 = """      bizMode.checkEmployeStatus().then(({ revoked: r, entreprise_fermee, admin_whatsapp, motif, vole: v }) => {
        if (v) {
          setVole(true);
          if (admin_whatsapp) setAdminWhatsapp(admin_whatsapp);
          else return getSetting('entreprise_admin_whatsapp').then(w => setAdminWhatsapp(w || ''));
          return;
        }
        if (r) {
          setRevoked(true);
          setEntrepriseFermee(!!entreprise_fermee);
          setMotifRevocation(motif || '');
          if (admin_whatsapp) setAdminWhatsapp(admin_whatsapp);
          else return getSetting('entreprise_admin_whatsapp').then(w => setAdminWhatsapp(w || ''));
        }
      })
    ]).finally(() => setCheckingBlock(false));"""
assert s.count(old2) == 1, f"useEffect: {s.count(old2)}"
new2 = """      bizMode.checkEmployeStatus().then(({ revoked: r, entreprise_fermee, admin_whatsapp, motif, vole: v }) => {
        if (v) {
          setVole(true);
          if (admin_whatsapp) setAdminWhatsapp(admin_whatsapp);
          else return getSetting('entreprise_admin_whatsapp').then(w => setAdminWhatsapp(w || ''));
          return;
        }
        if (r) {
          setRevoked(true);
          setEntrepriseFermee(!!entreprise_fermee);
          setMotifRevocation(motif || '');
          if (admin_whatsapp) setAdminWhatsapp(admin_whatsapp);
          else return getSetting('entreprise_admin_whatsapp').then(w => setAdminWhatsapp(w || ''));
        }
      }),
      bizMode.checkStatutPersonnel().then((data) => {
        if (data.blocked && data.reason === 'supprimee') {
          setSupprimePersonnel(true);
          setSuppressionMotifPersonnel(data.motif || '');
          setSuppressionContactPersonnel(data.contact || null);
          return;
        }
        if (data.blocked && data.reason === 'suspendue') {
          setSuspenduPersonnel(true);
          setSuspensionMotifPersonnel(data.motif || '');
          setSuspensionContactPersonnel(data.contact || null);
        }
      })
    ]).finally(() => setCheckingBlock(false));"""
s = s.replace(old2, new2)

old3 = """  // Suppression = definitive et irreversible : purge Drive (backend) puis purge locale complete.
  const fermerSuppression = async () => {
    try {
      await bizMode.purgerEntrepriseSupprimee();
    } catch(_) {}
    try {
      resetDB();
      await new Promise(resolve => { const req = indexedDB.deleteDatabase("beautycrm"); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; });
      setTimeout(() => window.location.reload(), 300);
    } catch(_) {
      window.location.reload();
    }
  };"""
assert s.count(old3) == 1, f"handlers: {s.count(old3)}"
new3 = old3 + """

  // Suspension du compte personnel = reversible, on ne touche a AUCUNE donnee locale.
  const fermerSuspensionPersonnelle = () => {
    setSuspenduPersonnel(false);
    setSuspensionMotifPersonnel('');
    setSuspensionContactPersonnel(null);
  };

  // Suppression du compte personnel = definitive et irreversible : purge Drive (backend) puis purge locale complete.
  const fermerSuppressionPersonnelle = async () => {
    try {
      await bizMode.purgerCompteSupprime();
    } catch(_) {}
    try {
      resetDB();
      await new Promise(resolve => { const req = indexedDB.deleteDatabase("beautycrm"); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; });
      setTimeout(() => window.location.reload(), 300);
    } catch(_) {
      window.location.reload();
    }
  };"""
s = s.replace(old3, new3)

old4 = "  if (supprimee) {"
assert s.count(old4) == 1, f"ancre ecran: {s.count(old4)}"
new4 = """  if (supprimePersonnel) {
    const whatsappUrlP = suppressionContactPersonnel?.whatsapp ? `https://wa.me/${suppressionContactPersonnel.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Bonjour, mon compte a ete supprime. Pouvez-vous me donner plus d informations ?')}` : null;
    const mailUrlP = suppressionContactPersonnel?.email ? `mailto:${suppressionContactPersonnel.email}` : null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: '#1A1F36', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🗑️</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 10 }}>Compte supprime</div>
        <div style={{ color: '#A0A8D0', fontSize: 14, marginBottom: suppressionMotifPersonnel ? 14 : 28, lineHeight: 1.6, maxWidth: 320 }}>
          Votre compte a ete supprime. Contactez l'equipe IZISOFT.
        </div>
        {suppressionMotifPersonnel && (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid #3A4166', borderRadius: 10, padding: '10px 14px', marginBottom: 28, maxWidth: 320 }}>
            <div style={{ color: '#7A83B0', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MOTIF</div>
            <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{suppressionMotifPersonnel}</div>
          </div>
        )}
        {whatsappUrlP && (
          <button onClick={() => window.open(whatsappUrlP, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            💬 Contacter le support (WhatsApp)
          </button>
        )}
        {mailUrlP && (
          <button onClick={() => window.open(mailUrlP, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#fff', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            ✉️ Contacter le support (Email)
          </button>
        )}
        <button onClick={fermerSuppressionPersonnelle} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#A0A8D0', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
          Fermer
        </button>
      </div>
    );
  }

  if (suspenduPersonnel) {
    const whatsappUrlSP = suspensionContactPersonnel?.whatsapp ? `https://wa.me/${suspensionContactPersonnel.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Bonjour, mon compte a ete suspendu. Pouvez-vous me donner plus d informations ?')}` : null;
    const mailUrlSP = suspensionContactPersonnel?.email ? `mailto:${suspensionContactPersonnel.email}` : null;
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, backgroundColor: '#1A1F36', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⛔</div>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 20, marginBottom: 10 }}>Compte desactive</div>
        <div style={{ color: '#A0A8D0', fontSize: 14, marginBottom: suspensionMotifPersonnel ? 14 : 28, lineHeight: 1.6, maxWidth: 320 }}>
          Votre compte a ete desactive. Contactez-nous pour le reactiver.
        </div>
        {suspensionMotifPersonnel && (
          <div style={{ backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid #3A4166', borderRadius: 10, padding: '10px 14px', marginBottom: 28, maxWidth: 320 }}>
            <div style={{ color: '#7A83B0', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>MOTIF</div>
            <div style={{ color: '#fff', fontSize: 13, lineHeight: 1.5 }}>{suspensionMotifPersonnel}</div>
          </div>
        )}
        {whatsappUrlSP && (
          <button onClick={() => window.open(whatsappUrlSP, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: '#25D366', color: '#fff', border: 'none', borderRadius: 12, padding: 14, fontWeight: 700, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            💬 Contacter le support (WhatsApp)
          </button>
        )}
        {mailUrlSP && (
          <button onClick={() => window.open(mailUrlSP, '_blank')} style={{ width: '100%', maxWidth: 320, backgroundColor: 'transparent', color: '#fff', border: '1px solid #3A4166', borderRadius: 12, padding: 14, fontWeight: 600, fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
            ✉️ Contacter le support (Email)
          </button>
        )}
      </div>
    );
  }

  if (supprimee) {"""
s = s.replace(old4, new4)

open(p, "w").write(s)
print("App.jsx OK")
