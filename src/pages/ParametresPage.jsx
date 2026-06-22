import { useState, useEffect } from "react";
import { useGoogle } from "../hooks/useGoogle";
import { GoogleAccountButton } from "../components/GoogleAccountButton";
import { C, SECURITY_QUESTIONS } from '../theme';
import { getSetting, setSetting, sha256, exportAllData, importAllData, getVentes, getClients, today, resetDB } from '../db/index';
import { FieldInput, PickerSelect, PrimaryBtn, GhostBtn, fmtMoney } from '../components/UI';

const Section = ({ icon, label, color, children, open, onToggle }) => (
  <div style={{ marginBottom: 10 }}>
    <div onClick={onToggle} style={{
      backgroundColor: '#fff',
      borderRadius: open ? '14px 14px 0 0' : 14,
      border: `1px solid ${C.card_border}`,
      borderBottom: open ? `1px solid ${C.card_border}` : `1px solid ${C.card_border}`,
      padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: 12,
      cursor: 'pointer',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: (color || C.accent) + '20',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, flexShrink: 0,
      }}>{icon}</div>
      <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: C.text_primary }}>{label}</span>
      <span style={{ color: C.text_secondary, fontSize: 18 }}>{open ? '▲' : '▼'}</span>
    </div>
    {open && (
      <div style={{
        backgroundColor: '#fff',
        border: `1px solid ${C.card_border}`,
        borderTop: 'none',
        borderRadius: '0 0 14px 14px',
      }}>
        {children}
      </div>
    )}
  </div>
);


export const PolitiqueConfidentialite = () => (
  <div style={{ padding: '0 16px 16px' }}>
    <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7 }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12, color: '#1a1f36' }}>Politique de Confidentialité — BeautyCRM</div>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 16 }}>Dernière mise à jour : Juin 2026 · IZIsoft</div>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>1. Données collectées</div>
      <div style={{ marginBottom: 12 }}>BeautyCRM collecte uniquement les informations que <strong>vous saisissez vous-même</strong> : nom, prénom, numéro de téléphone, adresse email, ville, pays, nom d'entreprise et rôle professionnel. <strong>IZIsoft ne collecte aucune donnée automatiquement et n'a aucun accès à vos informations personnelles.</strong> Toutes vos données restent exclusivement sur votre appareil.</div>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>2. Utilisation des données</div>
      <div style={{ marginBottom: 12 }}>Vos données sont utilisées exclusivement par vous-même pour le fonctionnement de BeautyCRM : gestion de vos clients, contacts, rendez-vous, ventes et événements. <strong>IZIsoft n'a aucun accès à vos données, ne les consulte pas, ne les analyse pas et ne les partage jamais avec des tiers.</strong> Elles ne sont en aucun cas vendues, louées ou exploitées commercialement.</div>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>3. Stockage local</div>
      <div style={{ marginBottom: 12 }}>Toutes vos données sont stockées localement sur votre appareil via IndexedDB. BeautyCRM fonctionne 100% hors ligne. Aucune donnée n'est envoyée automatiquement vers un serveur distant.</div>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>4. Sauvegarde Google Drive</div>
      <div style={{ marginBottom: 12 }}>Si vous activez la synchronisation Google Drive, vos données sont sauvegardées dans votre propre espace Google Drive personnel. IZIsoft n'a pas accès à ces sauvegardes. Cette fonctionnalité est entièrement optionnelle.</div>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>5. Partage des données</div>
      <div style={{ marginBottom: 12 }}>BeautyCRM ne partage aucune donnée personnelle avec des tiers. Les seules transmissions possibles sont celles que vous initiez vous-même (export CSV, partage WhatsApp, etc.).</div>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>6. Sécurité</div>
      <div style={{ marginBottom: 12 }}>Votre mot de passe est hashé (SHA-256) avant d'être stocké. Il est impossible pour quiconque, y compris IZIsoft, de le lire. Votre question de sécurité est également hashée.</div>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>7. Vos droits</div>
      <div style={{ marginBottom: 12 }}>Vous pouvez à tout moment supprimer l'intégralité de vos données depuis Paramètres → Supprimer mon compte. Cette action est irréversible et efface toutes les données locales.</div>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>8. Mineurs</div>
      <div style={{ marginBottom: 12 }}>BeautyCRM est destiné aux professionnels adultes. L'application n'est pas destinée aux personnes de moins de 18 ans.</div>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>9. Modifications</div>
      <div style={{ marginBottom: 12 }}>IZIsoft se réserve le droit de modifier cette politique. Toute modification sera notifiée via une mise à jour de l'application.</div>

      <div style={{ fontWeight: 700, marginBottom: 4 }}>10. Contact</div>
      <div style={{ marginBottom: 4 }}>Pour toute question relative à vos données :</div>
      <div>📧 izisoft.app@gmail.com</div>
      <div>💬 WhatsApp : +243 997 245 614</div>
      <div style={{ marginTop: 16, fontSize: 11, color: '#aaa', textAlign: 'center' }}>© 2026 IZIsoft · Tous droits réservés</div>
    </div>
  </div>
);

export const ParametresPage = ({ user, onLogout }) => {
  const [open, setOpen] = useState(null);
  const [entreprise, setEntreprise] = useState("");
  const [role, setRole] = useState("");
  const [pays, setPays] = useState("");

  useEffect(() => {
    getSetting("entreprise").then(e => { if (e) setEntreprise(e); });
    getSetting("role").then(r => { if (r) setRole(r); });
    getSetting("pays").then(p => { if (p) setPays(p); });
  }, []);
  const { googleUser, syncing, authReady, error: gError, connect, disconnect, uploadBackup, downloadBackup, mergeSync } = useGoogle();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deletePw, setDeletePw] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [pw, setPw] = useState({ ancien: '', nouveau: '', confirm: '' });
  const [secQ, setSecQ] = useState({ question: SECURITY_QUESTIONS[0], reponse: '', mdpConfirm: '' });
  const [msg, setMsg] = useState({});
  const [loading, setLoading] = useState({});
  const [totalUsers, setTotalUsers] = useState(null);

  const toggle = (key) => setOpen(o => o === key ? null : key);

  const showMsg = (key, text) => {
    setMsg(m => ({ ...m, [key]: text }));
    setTimeout(() => setMsg(m => ({ ...m, [key]: '' })), 3500);
  };

  const Msg = ({ k }) => !msg[k] ? null : (
    <div style={{
      backgroundColor: msg[k].startsWith('✅') ? C.success + '15' : C.danger + '15',
      border: `1px solid ${msg[k].startsWith('✅') ? C.success : C.danger}`,
      borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 13,
      color: msg[k].startsWith('✅') ? C.success : C.danger,
    }}>{msg[k]}</div>
  );

  // Changer mot de passe
  const [hasPassword, setHasPassword] = useState(null);
  const [setupId, setSetupId] = useState({ username: '', nouveau: '', confirm: '' });

  useEffect(() => {
    getSetting('password').then(p => setHasPassword(!!p));
  }, []);

  const activerProtection = async () => {
    if (!setupId.username.trim()) { showMsg('pw', '❌ Choisissez un identifiant.'); return; }
    if (setupId.nouveau.length < 4) { showMsg('pw', '❌ Mot de passe trop court (min 4).'); return; }
    if (setupId.nouveau !== setupId.confirm) { showMsg('pw', '❌ Mots de passe differents.'); return; }
    setLoading(l => ({ ...l, pw: true }));
    try {
      await setSetting('username', setupId.username.trim());
      await setSetting('password', await sha256(setupId.nouveau));
      await setSetting('use_password', '1');
      setSetupId({ username: '', nouveau: '', confirm: '' });
      setHasPassword(true);
      showMsg('pw', '✅ Protection activee !');
    } catch(e) { showMsg('pw', '❌ ' + e.message); }
    finally { setLoading(l => ({ ...l, pw: false })); }
  };

  const changePassword = async () => {
    if (!pw.ancien || !pw.nouveau) { showMsg('pw', '❌ Remplissez tous les champs.'); return; }
    if (pw.nouveau.length < 4) { showMsg('pw', '❌ Mot de passe trop court (min 4).'); return; }
    if (pw.nouveau !== pw.confirm) { showMsg('pw', '❌ Mots de passe differents.'); return; }
    setLoading(l => ({ ...l, pw: true }));
    try {
      const stored = await getSetting('password');
      const hashOld = await sha256(pw.ancien);
      if (hashOld !== stored) { showMsg('pw', '❌ Mot de passe actuel incorrect.'); return; }
      await setSetting('password', await sha256(pw.nouveau));
      setPw({ ancien: '', nouveau: '', confirm: '' });
      showMsg('pw', '✅ Mot de passe modifie !');
    } catch(e) { showMsg('pw', '❌ ' + e.message); }
    finally { setLoading(l => ({ ...l, pw: false })); }
  };

  // Changer question securite



  const supprimerCompte = async () => {
    setDeleteError("");
    if (!deletePw) { setDeleteError("Entrez votre mot de passe."); return; }
    try {
      const stored = await getSetting("password");
      const hash = await sha256(deletePw);
      if (hash !== stored) { setDeleteError("Mot de passe incorrect."); return; }
      setShowDeleteModal(false);
      setShowConfirmModal(true);
    } catch(e) { setDeleteError("Erreur : " + e.message); }
  };

  const confirmerSuppression = async () => {
    try {
      resetDB();
      await new Promise(resolve => { const req = indexedDB.deleteDatabase("beautycrm"); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; });
      setTimeout(() => window.location.reload(), 500);
    } catch(e) { alert("Erreur : " + e.message); }
  };
  const changeSecQ = async () => {
    if (!secQ.mdpConfirm.trim()) { showMsg("sec", "❌ Confirmez votre mot de passe."); return; }
    const stored = await getSetting('password');
    const hashMdp = await sha256(secQ.mdpConfirm);
    if (hashMdp !== stored) { showMsg('sec', '❌ Mot de passe incorrect.'); return; }
    const hashRep = await sha256(secQ.reponse.toLowerCase().trim());
    await setSetting('security_question', secQ.question);
    await setSetting('security_answer', hashRep);
    setSecQ({ question: SECURITY_QUESTIONS[0], reponse: '', mdpConfirm: '' });
    showMsg('sec', '✅ Question de securite mise a jour !');
  };

  // Export JSON
  const exportData = async () => {
    setLoading(l => ({ ...l, export: true }));
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `beautycrm_backup_${today()}.json`; a.click();
      URL.revokeObjectURL(url);
      showMsg('export', '✅ Backup telecharge !');
    } catch(e) { showMsg('export', '❌ ' + e.message); }
    finally { setLoading(l => ({ ...l, export: false })); }
  };

  // Export CSV ventes
  const exportCSV = async () => {
    setLoading(l => ({ ...l, csv: true }));
    try {
      const [ventes, clients] = await Promise.all([getVentes(), getClients()]);
      const header = 'Date,Client,Telephone,Canal,Produit,Quantite,Prix achat,Prix vente,Marge,Paiement\n';
      const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
      const rows = ventes.map(v => {
        const c = clients.find(x => x._id === v.client_id);
        const marge = (v.prix_vente - v.prix_achat) * v.quantite;
        return [v.date_vente, c?.nom||'', c?.telephone||'', c?.canal||'', v.produit, v.quantite, v.prix_achat, v.prix_vente, marge, v.methode_paiement].map(escape).join(',');
      }).join('\n');
      const blob = new Blob([header + rows], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `beautycrm_ventes_${today()}.csv`; a.click();
      URL.revokeObjectURL(url);
      showMsg('export', '✅ CSV exporte !');
    } catch(e) { showMsg('export', '❌ ' + e.message); }
    finally { setLoading(l => ({ ...l, csv: false })); }
  };

  // Import JSON
  const importData = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      setLoading(l => ({ ...l, import: true }));
      try {
        const data = JSON.parse(await file.text());
        await importAllData(data);
        showMsg('import', '✅ Donnees importees avec succes !');
      } catch(e) { showMsg('import', '❌ Erreur : ' + e.message); }
      finally { setLoading(l => ({ ...l, import: false })); }
    };
    input.click();
  };

  return (
    <div style={{ padding: '14px', paddingBottom: 100, width: '100%', boxSizing: 'border-box' }}>
      {/* Profil */}
      <div style={{
        backgroundColor: C.sidebar_bg, borderRadius: 16, padding: 18,
        marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 54, height: 54, borderRadius: 27,
          backgroundColor: C.pink + '40',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.pink, fontWeight: 800, fontSize: 22,
        }}>{user?.charAt(0).toUpperCase()}</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{user}</div>
          <div style={{ color: "#A0A8D0", fontSize: 12 }}>{role || "Distributeur"} · {entreprise}</div>
          <div style={{ color: "#A0A8D0", fontSize: 11, marginTop: 2 }}>📍 {pays}</div>
        </div>
      </div>

      {/* Section Sync Google Drive */}
      <Section icon="☁" label="Sync Google Drive" color={C.accent}
            loading={syncing} open={open==="gdrive"} onToggle={() => toggle("gdrive")}>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: C.text_secondary, marginBottom: 14 }}>Sync uniquement quand connexion disponible.</div>
          <GoogleAccountButton
            googleUser={googleUser}
            authReady={authReady}
            error={gError}
            connect={connect}
            disconnect={disconnect}
            onSync={async () => { const data = await exportAllData(); return await mergeSync(data); }}
          />

        </div>
      </Section>

      {/* Section Export */}
      <Section icon="⬇" label="Exporter les donnees" color={C.success} open={open==='export'} onToggle={() => toggle('export')}>
        <div style={{ padding: 16 }}>
          <Msg k="export" />
          <div style={{ fontSize: 12, color: C.text_secondary, marginBottom: 14 }}>Sauvegardez vos donnees ou exportez-les.</div>
          <PrimaryBtn label={loading.export ? '...' : '💾 Sauvegarde JSON complete'} onClick={exportData} color={C.success} style={{ marginBottom: 10 }} />
          <PrimaryBtn label={loading.csv ? '...' : '📊 Exporter ventes CSV'} onClick={exportCSV} color={C.accent}
            loading={syncing} />
        </div>
      </Section>

      {/* Section Import */}
      <Section icon="⬆" label="Importer des donnees" color={C.pink} open={open==='import'} onToggle={() => toggle('import')}>
        <div style={{ padding: 16 }}>
          <Msg k="import" />
          <div style={{ backgroundColor: C.accent + '15', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.accent }}>ℹ️ Seules les entrees absentes seront ajoutees. Les donnees existantes ne sont pas ecrasees.</div>
          </div>
          <PrimaryBtn label={loading.import ? '...' : '📂 Choisir un fichier JSON'} onClick={importData} color={C.pink} />
        </div>
      </Section>

      {/* Section Securite */}
      <Section icon="🔐" label="Mot de passe et Securite" color={C.accent}
            loading={syncing} open={open==='securite'} onToggle={() => toggle('securite')}>
        <div style={{ padding: 16 }}>
          {hasPassword === false ? (
            <>
              <div style={{ backgroundColor: C.accent+'15', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight:700, fontSize:13, color:C.text_primary, marginBottom:4 }}>🔓 Acces libre actif</div>
                <div style={{ fontSize:12, color:C.text_secondary }}>L'app s'ouvre sans mot de passe. Creez un identifiant pour activer la protection.</div>
              </div>
              <Msg k="pw" />
              <FieldInput label="Identifiant (nom d'utilisateur)" value={setupId.username} onChange={v => setSetupId(s=>({...s,username:v}))} placeholder="Ex: Marie" />
              <FieldInput label="Mot de passe" value={setupId.nouveau} onChange={v => setSetupId(s=>({...s,nouveau:v}))} type="password" placeholder="Min 4 caracteres" />
              <FieldInput label="Confirmer" value={setupId.confirm} onChange={v => setSetupId(s=>({...s,confirm:v}))} type="password" />
              <PrimaryBtn label={loading.pw ? '...' : '🔒 Activer la protection'} onClick={activerProtection} style={{ marginBottom: 20 }} />
            </>
          ) : (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary, marginBottom: 12 }}>Modifier le mot de passe</div>
              <Msg k="pw" />
              <FieldInput label="Mot de passe actuel" value={pw.ancien} onChange={v => setPw(p=>({...p,ancien:v}))} type="password" />
              <FieldInput label="Nouveau mot de passe" value={pw.nouveau} onChange={v => setPw(p=>({...p,nouveau:v}))} type="password" />
              <FieldInput label="Confirmer" value={pw.confirm} onChange={v => setPw(p=>({...p,confirm:v}))} type="password" />
              <PrimaryBtn label={loading.pw ? '...' : 'Modifier le mot de passe'} onClick={changePassword} style={{ marginBottom: 20 }} />
              <div style={{ height: 1, backgroundColor: C.card_border, marginBottom: 20 }} />
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary, marginBottom: 4 }}>Question de securite</div>
              <div style={{ fontSize: 12, color: C.text_secondary, marginBottom: 12 }}>Permet de reinitialiser votre mot de passe si vous l'oubliez.</div>
              <Msg k="sec" />
              <PickerSelect label="Nouvelle question" value={secQ.question} onChange={v => setSecQ(q=>({...q,question:v}))} options={SECURITY_QUESTIONS} />
              <FieldInput label="Nouvelle reponse (secrete)" value={secQ.reponse} onChange={v => setSecQ(q=>({...q,reponse:v}))} />
              <FieldInput label="Mot de passe actuel (confirmation)" value={secQ.mdpConfirm} onChange={v => setSecQ(q=>({...q,mdpConfirm:v}))} type="password" />
              <PrimaryBtn label="🔒 Modifier la question" onClick={changeSecQ} color={C.accent2 || C.accent} />
            </>
          )}
          <div style={{ height: 1, backgroundColor: C.card_border, margin: "20px 0" }} />
          <div style={{ fontWeight: 700, fontSize: 13, color: C.danger, marginBottom: 8 }}>Zone de danger</div>
          <div style={{ fontSize: 12, color: C.text_secondary, marginBottom: 12 }}>Supprimer definitivement votre compte et toutes vos donnees.</div>
          <GhostBtn label="🗑 Supprimer mon compte" onClick={() => { setDeletePw(""); setDeleteError(""); setShowDeleteModal(true); }} style={{ borderColor: C.danger, color: C.danger }} />
        </div>
      </Section>

      {/* Section Application */}
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.text_primary, marginBottom: 10 }}>Application</div>
        <div style={{ backgroundColor: '#fff', borderRadius: 14, border: `1px solid ${C.card_border}`, overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px' }}>
            <span style={{ fontSize: 14, color: C.text_secondary }}>Version</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.text_primary }}>2.1</span>
          </div>
        </div>
      </div>

      {/* Section Contact */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.text_primary, marginBottom: 10 }}>Contact</div>
        <div style={{ backgroundColor: '#fff', borderRadius: 14, border: `1px solid ${C.card_border}`, padding: 16 }}>
          <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 16, lineHeight: 1.6 }}>
            Nous aimons ecouter vos suggestions.<br/>Contactez-nous pour toute assistance ou amelioration.
          </div>
          <div onClick={() => window.open('mailto:laudatemunye@gmail.com', '_blank')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.card_border}`, cursor: 'pointer' }}>
            <span style={{ fontSize: 22 }}>✉️</span>
            <span style={{ color: C.accent, fontWeight: 600, fontSize: 14 }}>laudatemunye@gmail.com</span>
          </div>
          <div onClick={() => window.open('https://wa.me/243997245614', '_blank')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${C.card_border}`, cursor: 'pointer' }}>
            <span style={{ fontSize: 22 }}>💬</span>
            <span style={{ color: C.accent, fontWeight: 600, fontSize: 14 }}>WhatsApp Support</span>
          </div>
          <div onClick={() => window.open('https://facebook.com/BeautyCRM', '_blank')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer' }}>
            <span style={{ fontSize: 22 }}>👤</span>
            <span style={{ color: C.accent, fontWeight: 600, fontSize: 14 }}>Facebook BeautyCRM</span>
          </div>
        </div>
      </div>

      {/* Section Politique */}
      <Section icon="📜" label="Politique de confidentialite" color="#8B5CF6" open={open==='politique'} onToggle={() => toggle('politique')}>
        <PolitiqueConfidentialite />
      </Section>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ color: C.text_secondary, fontSize: 12, marginBottom: 4 }}>© IZIsoft 2026 · BeautyCRM</div>
        <div style={{ color: C.text_light, fontSize: 11 }}>BeautyCRM v2.1 · 100% offline</div>
      </div>

      {/* Deconnexion */}

      {showDeleteModal && (
        <div style={{ position:"fixed",inset:0,backgroundColor:"rgba(26,31,54,0.6)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <div style={{ backgroundColor:"#fff",borderRadius:20,padding:24,width:"100%",maxWidth:380 }}>
            <div style={{ fontWeight:800,fontSize:18,color:C.danger,marginBottom:8 }}>Supprimer le compte</div>
            <div style={{ fontSize:13,color:C.text_secondary,marginBottom:20,lineHeight:1.6 }}>Entrez votre mot de passe pour confirmer la suppression.</div>
            {deleteError && <div style={{ backgroundColor:C.danger+"15",border:"1px solid "+C.danger,borderRadius:8,padding:10,marginBottom:12,fontSize:13,color:C.danger }}>{deleteError}</div>}
            <FieldInput label="Mot de passe" value={deletePw} onChange={setDeletePw} type="password" placeholder="Votre mot de passe" />
            <div style={{ display:"flex",flexDirection:"column",gap:10,marginTop:8 }}>
              <GhostBtn label="Annuler" onClick={() => setShowDeleteModal(false)} />
              <PrimaryBtn label="Confirmer" onClick={supprimerCompte} color={C.danger} />
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div style={{ position:"fixed",inset:0,backgroundColor:"rgba(26,31,54,0.85)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <div style={{ backgroundColor:"#fff",borderRadius:20,padding:24,width:"100%",maxWidth:380,textAlign:"center" }}>
            <div style={{ fontSize:40,marginBottom:12 }}>⚠️</div>
            <div style={{ fontWeight:800,fontSize:18,color:C.danger,marginBottom:12 }}>Confirmation finale</div>
            <div style={{ fontSize:14,color:C.text_secondary,marginBottom:24,lineHeight:1.6 }}>Vous allez perdre definitivement toutes vos donnees. Cette action est irreversible.</div>
            <PrimaryBtn label="Oui, supprimer tout" onClick={confirmerSuppression} color={C.danger} style={{ marginBottom:10 }} />
            <GhostBtn label="Non, annuler" onClick={() => setShowConfirmModal(false)} />
          </div>
        </div>
      )}

      <GhostBtn label="Se deconnecter" onClick={onLogout} style={{ borderColor:C.card_border,color:C.text_secondary }} />
    </div>
  );
};
