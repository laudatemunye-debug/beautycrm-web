import { useState, useEffect } from "react";
import { useGoogle } from "../hooks/useGoogle";
import { useEntreprise } from "../hooks/useEntreprise";
import { GoogleAccountButton } from "../components/GoogleAccountButton";
import { C, SECURITY_QUESTIONS, DEVISES } from '../theme';
import { getSetting, setSetting, sha256, exportAllData, importAllData, getVentes, getClients, getCredits, getApprovisionnements, today, resetDB, convertirDevise } from '../db/index';
import { FieldInput, PickerSelect, PrimaryBtn, GhostBtn, fmtMoney, Modal, FormFooter } from '../components/UI';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
  const bizMode = useEntreprise();
  const [newEmployeNom, setNewEmployeNom] = useState('');
  const [newEmployePoste, setNewEmployePoste] = useState('vendeur');
  const [showAddEmploye, setShowAddEmploye] = useState(false);
  const [codeTimer, setCodeTimer] = useState('');

  useEffect(() => {
    if (!bizMode.codeExpiry) return;
    const interval = setInterval(() => {
      const remaining = bizMode.codeExpiry - Date.now();
      if (remaining <= 0) { setCodeTimer('Expire'); clearInterval(interval); return; }
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setCodeTimer(h + 'h ' + String(m).padStart(2,'0') + 'm ' + String(s).padStart(2,'0') + 's');
    }, 1000);
    return () => clearInterval(interval);
  }, [bizMode.codeExpiry]);
  const [entreprise, setEntreprise] = useState("");
  const [role, setRole] = useState("");
  const [pays, setPays] = useState("");

  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivatePw, setDeactivatePw] = useState('');
  const [deactivateError, setDeactivateError] = useState('');
  const [profileForm, setProfileForm] = useState({ nom: '', role: '', entreprise: '', pays: '', ville: '', telephone: '', email: '' });
  const [factEntreprise, setFactEntreprise] = useState({ nom: '', adresse: '', telephone: '', email: '', logo: '' });
  const [factSaved, setFactSaved] = useState(false);
  const [devise, setDevise] = useState('');
  const [nouvelleDevise, setNouvelleDevise] = useState('');
  const [tauxConversion, setTauxConversion] = useState('');
  const [convertingDevise, setConvertingDevise] = useState(false);
  const [deviseError, setDeviseError] = useState('');
  const [deviseSaved, setDeviseSaved] = useState(false);
  const [showDeviseConfirm, setShowDeviseConfirm] = useState(false);

  useEffect(() => {
    const loadEntreprise = () => { getSetting("entreprise").then(e => { if (e) setEntreprise(e); }); };
    const loadFactEntreprise = () => {
      Promise.all([
        getSetting("facture_entreprise_nom"),
        getSetting("facture_entreprise_adresse"),
        getSetting("facture_entreprise_telephone"),
        getSetting("facture_entreprise_email"),
        getSetting("facture_entreprise_logo"),
      ]).then(([nom, adresse, telephone, email, logo]) => {
        setFactEntreprise({ nom: nom || '', adresse: adresse || '', telephone: telephone || '', email: email || '', logo: logo || '' });
      });
    };
    loadEntreprise();
    loadFactEntreprise();
    getSetting("role").then(r => { if (r) setRole(r); });
    getSetting("pays").then(p => { if (p) setPays(p); });
    const onChange = () => { loadEntreprise(); loadFactEntreprise(); };
    window.addEventListener("entreprise-changed", onChange);
    return () => window.removeEventListener("entreprise-changed", onChange);
  }, []);

  useEffect(() => {
    getSetting('devise').then(d => { if (d) { setDevise(d); setNouvelleDevise(d); } });
  }, []);

  const handleChangerDevise = () => {
    setDeviseError('');
    if (!nouvelleDevise || nouvelleDevise === devise) { setDeviseError('Choisissez une devise differente de la devise actuelle.'); return; }
    const taux = parseFloat(tauxConversion);
    if (!taux || taux <= 0) { setDeviseError('Entrez un taux de conversion valide (ex: 1 ' + (devise || 'ancienne devise') + ' = X nouvelle devise).'); return; }
    setShowDeviseConfirm(true);
  };

  const executerChangementDevise = async () => {
    const taux = parseFloat(tauxConversion);
    setShowDeviseConfirm(false);
    setConvertingDevise(true);
    try {
      await convertirDevise(taux);
      await setSetting('devise', nouvelleDevise);
      if (bizMode.isAdmin) await bizMode.changerDevise(nouvelleDevise);
      const found = DEVISES.find(d => d.label === nouvelleDevise);
      if (found) window.__DEVISE_SYMBOL__ = found.symbol;
      window.dispatchEvent(new Event('devise-changed'));
      setDevise(nouvelleDevise);
      setTauxConversion('');
      setDeviseSaved(true);
      setTimeout(() => setDeviseSaved(false), 2500);
    } catch (e) {
      setDeviseError(e.message || 'Erreur lors de la conversion.');
    } finally {
      setConvertingDevise(false);
    }
  };

  const saveFactureEntreprise = async () => {
    await setSetting('facture_entreprise_nom', factEntreprise.nom);
    await setSetting('facture_entreprise_adresse', factEntreprise.adresse);
    await setSetting('facture_entreprise_telephone', factEntreprise.telephone);
    await setSetting('facture_entreprise_email', factEntreprise.email);
    await setSetting('facture_entreprise_logo', factEntreprise.logo);
    if (bizMode.isAdmin) {
      await bizMode.pushFactureEntreprise(factEntreprise);
    }
    setFactSaved(true);
    setTimeout(() => setFactSaved(false), 2000);
  };

  const onLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFactEntreprise(f => ({ ...f, logo: reader.result }));
    reader.readAsDataURL(file);
  };
  const { googleUser, syncing, authReady, error: gError, connect, disconnect, uploadBackup, downloadBackup, mergeSync } = useGoogle();
  const [codeCombine, setCodeCombine] = useState(null);
  const [needsDriveConnect, setNeedsDriveConnect] = useState(false);
  const [syncingEntreprise, setSyncingEntreprise] = useState(false);
  const [entrepriseStats, setEntrepriseStats] = useState({ parEmploye: [], parMois: [] });
  const [lastSync, setLastSync] = useState(null);
  const [showEmployesModal, setShowEmployesModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [empListTab, setEmpListTab] = useState('actifs');
  const [syncMsg, setSyncMsg] = useState('');
  const [empDetail, setEmpDetail] = useState(null);
  const [empData, setEmpData] = useState({ ventes: [], credits: [], appros: [] });
  const [empSearch, setEmpSearch] = useState('');
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [motifSaisi, setMotifSaisi] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [showAnciens, setShowAnciens] = useState(false);
  const [showModeEntreprise, setShowModeEntreprise] = useState(false);
  const [creationError, setCreationError] = useState('');
  const [creating, setCreating] = useState(false);

  const creerEntreprise = async () => {
    setCreationError('');
    if (!factEntreprise.nom.trim()) { setCreationError('Le nom de l\'entreprise est requis.'); return; }
    if (!factEntreprise.telephone.trim()) { setCreationError('Le telephone est requis (utilise pour WhatsApp).'); return; }
    const emailValide = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(factEntreprise.email.trim());
    if (!emailValide) { setCreationError('L\'email de l\'entreprise est invalide ou manquant.'); return; }
    setCreating(true);
    try {
      await setSetting('email', factEntreprise.email.trim());
      await bizMode.activerModeAdmin();
      await saveFactureEntreprise();
    } catch(e) {
      setCreationError('Erreur : ' + e.message);
    } finally {
      setCreating(false);
    }
  };
  const [voleTarget, setVoleTarget] = useState(null);
  const [voleResult, setVoleResult] = useState(null);
  const [voleMarking, setVoleMarking] = useState(false);
  const [voleMarkError, setVoleMarkError] = useState('');

  const ouvrirMarquageVole = (emp) => {
    setVoleTarget(emp);
    setVoleMarkError('');
    if (emp.vole && emp.vole_code_expiry && emp.vole_code_expiry > Date.now()) {
      setVoleResult({ code: emp.vole_code, expiry: emp.vole_code_expiry });
    } else {
      setVoleResult(null);
    }
  };

  const confirmerMarquageVole = async () => {
    setVoleMarking(true);
    setVoleMarkError('');
    try {
      const r = await bizMode.marquerEmployeVole(voleTarget.id);
      setVoleResult(r);
      bizMode.refreshEmployes();
    } catch (e) {
      setVoleMarkError(e.message || 'Erreur lors du marquage.');
    } finally {
      setVoleMarking(false);
    }
  };

  const [showFermerModal, setShowFermerModal] = useState(false);
  const [motifFermeture, setMotifFermeture] = useState('');
  const [fermeturing, setFermeturing] = useState(false);

  const [showFermerPwModal, setShowFermerPwModal] = useState(false);
  const [fermerPw, setFermerPw] = useState('');
  const [fermerPwError, setFermerPwError] = useState('');
  const [fermerHasPassword, setFermerHasPassword] = useState(false);

  const confirmerFermeture = async () => {
    const stored = await getSetting('password');
    setFermerHasPassword(!!stored);
    setShowFermerModal(false);
    setShowFermerPwModal(true);
  };

  const executerFermeture = async () => {
    setFermeturing(true);
    try {
      await bizMode.fermerEntreprise(motifFermeture.trim());
      // Fermeture = suppression definitive et immediate : on purge aussi les donnees locales de cet appareil
      resetDB();
      await new Promise(resolve => { const req = indexedDB.deleteDatabase("beautycrm"); req.onsuccess = resolve; req.onerror = resolve; req.onblocked = resolve; });
      setTimeout(() => window.location.reload(), 500);
    } catch(e) {
      alert('Erreur : ' + e.message);
      setFermeturing(false);
    }
  };

  const validerPwEtFermer = async () => {
    setFermerPwError('');
    try {
      const stored = await getSetting('password');
      if (stored) {
        if (!fermerPw) { setFermerPwError('Entrez votre mot de passe.'); return; }
        const hash = await sha256(fermerPw);
        if (hash !== stored) { setFermerPwError('Mot de passe incorrect.'); return; }
      }
      await executerFermeture();
    } catch(e) { setFermerPwError('Erreur : ' + e.message); }
  };

  const ouvrirRevocation = (emp) => {
    setRevokeTarget(emp);
    setMotifSaisi('');
  };

  const confirmerRevocation = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      await bizMode.revoquerEmploye(revokeTarget.id, motifSaisi.trim());
      setRevokeTarget(null);
      setMotifSaisi('');
    } catch(e) {
      alert('Erreur : ' + e.message);
    } finally {
      setRevoking(false);
    }
  };

  const ouvrirAnciensEmployes = () => {
    setShowAnciens(true);
    bizMode.refreshEmployesRevoques();
  };

  const buildEmpPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`${empDetail.nom} (${empDetail.poste})`, 14, 16);
    doc.setFontSize(10);
    doc.text('Genere le ' + new Date().toLocaleDateString('fr-FR'), 14, 22);
    const q = empSearch.toLowerCase();
    let columns, rows;
    if (empTab === 'ventes') {
      columns = ['Produit', 'Client', 'Facture', 'Quantite', 'Montant'];
      rows = empData.ventes.filter(v => v.produit.toLowerCase().includes(q))
        .map(v => [v.produit, v.clientNom || '-', v.facture_numero || '-', String(v.quantite), fmtMoney(v.prix_vente * v.quantite)]);
    } else if (empTab === 'credits') {
      columns = ['Produit', 'Montant'];
      rows = empData.credits.filter(cr => (cr.produit || 'Credit').toLowerCase().includes(q))
        .map(cr => [cr.produit || 'Credit', fmtMoney(cr.montant || 0)]);
    } else {
      columns = ['Produit', 'Quantite', 'Date'];
      rows = empData.appros.filter(a => a.produit.toLowerCase().includes(q))
        .map(a => [a.produit, String(a.quantite), a.date]);
    }
    autoTable(doc, {
      startY: 28,
      head: [columns],
      body: rows,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [61, 90, 254] },
    });
    return doc;
  };

  const empPdfFilename = () => `${empDetail?.nom || 'employe'}_${empTab}`.toLowerCase().replace(/ /g, '_') + '.pdf';

  const handleEmpSavePdf = () => {
    const doc = buildEmpPDF();
    doc.save(empPdfFilename());
  };

  const handleEmpEnvoyerPdf = async () => {
    const doc = buildEmpPDF();
    const blob = doc.output('blob');
    const file = new File([blob], empPdfFilename(), { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: empPdfFilename() }); return; } catch(_) {}
    }
    doc.save(empPdfFilename());
  };

  const handleEmpImprimer = () => {
    const doc = buildEmpPDF();
    doc.autoPrint();
    doc.output('dataurlnewwindow');
  };
  const [empTab, setEmpTab] = useState('ventes');
  const [empLoading, setEmpLoading] = useState(false);

  const ouvrirDetailEmploye = async (emp) => {
    setEmpDetail(emp);
    setEmpTab('ventes');
    setEmpLoading(true);
    try {
      const [allVentes, allCredits, allAppros, allClients] = await Promise.all([getVentes(), getCredits(), getApprovisionnements(), getClients()]);
      const clientNomDe = (client_id) => allClients.find(cl => cl._id === client_id)?.nom || '';
      setEmpData({
        ventes: allVentes.filter(v => v.vendeur_nom === emp.nom).map(v => ({ ...v, clientNom: clientNomDe(v.client_id) })),
        credits: allCredits.filter(c => c.vendeur_nom === emp.nom).map(c => ({ ...c, clientNom: clientNomDe(c.client_id) })),
        appros: allAppros.filter(a => a.vendeur_nom === emp.nom),
      });
    } catch(_) {
      setEmpData({ ventes: [], credits: [], appros: [] });
    } finally {
      setEmpLoading(false);
    }
  };

  const loadEntrepriseStats = async () => {
    try {
      const allVentes = await getVentes();
      const noms = bizMode.employes.map(e => e.nom);
      const ventesEmp = allVentes.filter(v => noms.includes(v.vendeur_nom));

      const parEmployeMap = {};
      ventesEmp.forEach(v => {
        const m = (v.prix_vente||0) * (v.quantite||0);
        parEmployeMap[v.vendeur_nom] = (parEmployeMap[v.vendeur_nom]||0) + m;
      });
      const palette = [C.accent, C.pink, C.success, C.warning, C.danger, '#8B5CF6'];
      const totalEmp = Object.values(parEmployeMap).reduce((s,v)=>s+v,0);
      const parEmploye = Object.entries(parEmployeMap)
        .sort((a,b) => b[1]-a[1])
        .map(([nom, montant], i) => ({
          nom, montant,
          pct: totalEmp ? Math.round(montant/totalEmp*100) : 0,
          color: palette[i % palette.length],
        }));

      const now = new Date();
      const moisListe = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        moisListe.push({ key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`, label: d.toLocaleDateString('fr-FR', { month: 'short' }) });
      }
      const parMoisMap = {};
      ventesEmp.forEach(v => {
        if (!v.date_vente) return;
        const key = v.date_vente.slice(0,7);
        const m = (v.prix_vente||0) * (v.quantite||0);
        parMoisMap[key] = (parMoisMap[key]||0) + m;
      });
      const parMois = moisListe.map(m => ({ label: m.label, montant: parMoisMap[m.key] || 0 }));

      setEntrepriseStats({ parEmploye, parMois });
    } catch(e) {
      console.error(e);
    }
  };

  const handleSyncEntreprise = async () => {
    setSyncingEntreprise(true);
    setSyncMsg('');
    try {
      await bizMode.syncEntreprise();
      setSyncMsg('Synchronisation reussie !');
      await loadEntrepriseStats();
      getSetting('entreprise_last_sync').then(setLastSync);
    } catch(e) {
      setSyncMsg('Erreur : ' + e.message);
    } finally {
      setSyncingEntreprise(false);
    }
  };
  const [codeError, setCodeError] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!codeCombine) return;
    navigator.clipboard.writeText(codeCombine).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const [voleCopied, setVoleCopied] = useState(false);
  const handleCopyVoleCode = () => {
    if (!voleResult?.code) return;
    navigator.clipboard.writeText(voleResult.code).then(() => {
      setVoleCopied(true);
      setTimeout(() => setVoleCopied(false), 2000);
    });
  };

  const handleGenererCode = async () => {
    setCodeError('');
    setNeedsDriveConnect(false);
    try {
      const nouveauCode = await bizMode.genererCode();
      setCodeCombine(nouveauCode);
    } catch(e) {
      if (e.message.includes('Connectez d\'abord')) {
        setNeedsDriveConnect(true);
      }
      setCodeError(e.message);
    }
  };

  const handleConnecterDrive = async () => {
    try {
      await bizMode.connecterDriveEntreprise();
      setNeedsDriveConnect(false);
      const nouveauCode = await bizMode.genererCode();
      setCodeCombine(nouveauCode);
    } catch(e) {
      setCodeError(e.message);
    }
  };
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



  const openProfileEdit = async () => {
    const [nom, r, ent, p, v, tel, email] = await Promise.all([
      getSetting('username'), getSetting('role'), getSetting('entreprise'),
      getSetting('pays'), getSetting('ville'), getSetting('telephone'), getSetting('email'),
    ]);
    setProfileForm({ nom: nom||'', role: r||'', entreprise: ent||'', pays: p||'', ville: v||'', telephone: tel||'', email: email||'' });
    setShowProfileEdit(true);
  };

  const saveProfile = async () => {
    await setSetting('username', profileForm.nom);
    await setSetting('role', profileForm.role);
    await setSetting('entreprise', profileForm.entreprise);
    await setSetting('pays', profileForm.pays);
    await setSetting('ville', profileForm.ville);
    await setSetting('telephone', profileForm.telephone);
    await setSetting('email', profileForm.email);
    setRole(profileForm.role);
    setEntreprise(profileForm.entreprise);
    setPays(profileForm.pays);
    setShowProfileEdit(false);
  };

  const desactiverSecurite = async () => {
    setDeactivateError('');
    if (!deactivatePw) { setDeactivateError('Entrez votre mot de passe.'); return; }
    const stored = await getSetting('password');
    const hash = await sha256(deactivatePw);
    if (hash !== stored) { setDeactivateError('Mot de passe incorrect.'); return; }
    await setSetting('password', '');
    await setSetting('use_password', '0');
    setHasPassword(false);
    setShowDeactivateModal(false);
    setDeactivatePw('');
    showMsg("pw", "Protection desactivee.");
  };

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
        cursor: 'pointer',
      }} onClick={openProfileEdit}>
        <div style={{
          width: 54, height: 54, borderRadius: 27,
          backgroundColor: C.pink + '40',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.pink, fontWeight: 800, fontSize: 22,
        }}>{user?.charAt(0).toUpperCase()}</div>
        <div>
          <div style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>{user}</div>
          <div style={{ color: "#A0A8D0", fontSize: 12 }}>{role || "Distributeur"} · {entreprise}</div>
          <div style={{ color: "#A0A8D0", fontSize: 11, marginTop: 2 }}>{pays}</div>
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

      {/* Section Entreprise (facture) */}
      <Section icon="🏢" label="Nom de l'entreprise (facture)" color={C.accent} open={open==='facture_entreprise'} onToggle={() => toggle('facture_entreprise')}>
        <div style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: C.text_secondary, marginBottom: 14 }}>
            {bizMode.isEmploye
              ? "Ces informations sont definies par l'administrateur et mises a jour automatiquement."
              : "Ces informations apparaitront dans l'en-tete de vos factures. Si elles sont vides, les informations saisies lors de l'inscription seront utilisees a la place."}
          </div>
          <FieldInput label="Nom de l'entreprise" value={factEntreprise.nom} onChange={v => setFactEntreprise(f=>({...f,nom:v}))} placeholder={entreprise || "Ex: Beauty Plus SARL"} disabled={bizMode.isEmploye} />
          <FieldInput label="Adresse complete" value={factEntreprise.adresse} onChange={v => setFactEntreprise(f=>({...f,adresse:v}))} placeholder="Ex: 12 Avenue du Commerce, Kinshasa" multiline disabled={bizMode.isEmploye} />
          <FieldInput label="Telephone" value={factEntreprise.telephone} onChange={v => setFactEntreprise(f=>({...f,telephone:v}))} type="tel" disabled={bizMode.isEmploye} />
          <FieldInput label="Email" value={factEntreprise.email} onChange={v => setFactEntreprise(f=>({...f,email:v}))} type="email" disabled={bizMode.isEmploye} />
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.text_secondary, fontWeight: 600, marginBottom: 6 }}>Logo de l'entreprise</div>
            {factEntreprise.logo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <img src={factEntreprise.logo} alt="logo" style={{ width: 50, height: 50, objectFit: 'contain', borderRadius: 8, border: `1px solid ${C.card_border}` }} />
                {!bizMode.isEmploye && (
                  <button onClick={() => setFactEntreprise(f => ({ ...f, logo: '' }))} style={{ background:'transparent', border:'none', color:C.danger, fontWeight:600, fontSize:12, cursor:'pointer' }}>Retirer le logo</button>
                )}
              </div>
            )}
            {!bizMode.isEmploye && (
              <input type="file" accept="image/*" onChange={onLogoChange} style={{ fontSize: 12 }} />
            )}
          </div>
          {!bizMode.isEmploye && (
            <PrimaryBtn label={factSaved ? 'Enregistre !' : 'Enregistrer'} onClick={saveFactureEntreprise} color={C.accent} />
          )}
        </div>
      </Section>

      {/* Section Devise */}
      <Section icon="💱" label="Devise" color={C.success} open={open==='devise'} onToggle={() => toggle('devise')}>
        <div style={{ padding: 16 }}>
          {bizMode.isEmploye ? (
            <div style={{ fontSize: 12, color: C.text_secondary }}>
              La devise est definie par l'administrateur de l'entreprise et s'applique automatiquement a votre compte.
              <div style={{ marginTop: 10, fontSize: 14, fontWeight: 700, color: C.text_primary }}>Devise actuelle : {devise || '—'}</div>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, color: C.text_secondary, marginBottom: 14 }}>
                Changer la devise convertira automatiquement tous les montants existants (produits, ventes, credits, approvisionnements) selon le taux indique. Cette devise s'appliquera aussi a tous les employes de l'entreprise.
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.text_secondary, fontWeight: 600, marginBottom: 6 }}>Devise actuelle</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text_primary }}>{devise || '—'}</div>
              </div>
              <PickerSelect label="Nouvelle devise" value={nouvelleDevise} onChange={setNouvelleDevise} options={DEVISES.map(d => d.label)} />
              <FieldInput label={'Taux de conversion (1 ' + (devise || 'ancienne devise') + ' = X nouvelle devise)'} value={tauxConversion} onChange={v => setTauxConversion(v.replace(',', '.'))} type="text" inputMode="decimal" placeholder="Ex: 0.00043" />
              {tauxConversion && parseFloat(tauxConversion) > 0 && (
                <div style={{ fontSize: 12, color: C.success, fontWeight: 600, marginTop: -8, marginBottom: 14 }}>
                  Exemple : 1 {(DEVISES.find(d => d.label === devise) || {}).symbol || devise || ''} = {(parseFloat(tauxConversion)).toLocaleString('fr-FR', { maximumFractionDigits: 6 })} {(DEVISES.find(d => d.label === nouvelleDevise) || {}).symbol || nouvelleDevise || ''}
                </div>
              )}
              {deviseError && <div style={{ color: C.danger, fontSize: 12, marginBottom: 10 }}>{deviseError}</div>}
              <PrimaryBtn label={convertingDevise ? 'Conversion en cours...' : (deviseSaved ? 'Devise mise a jour !' : 'Confirmer le changement')} onClick={handleChangerDevise} color={C.success} loading={convertingDevise} />
            </>
          )}
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
          {hasPassword && (
            <>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary, marginBottom: 4 }}>Desactiver la protection</div>
              <div style={{ fontSize: 12, color: C.text_secondary, marginBottom: 12 }}>L'app s'ouvrira sans demander de mot de passe.</div>
              <GhostBtn label="Desactiver le mot de passe" onClick={() => { setDeactivatePw(''); setDeactivateError(''); setShowDeactivateModal(true); }} style={{ marginBottom: 16 }} />
              <div style={{ height: 1, backgroundColor: C.card_border, marginBottom: 20 }} />
            </>
          )}
          <div style={{ fontWeight: 700, fontSize: 13, color: C.danger, marginBottom: 8 }}>Zone de danger</div>
          <div style={{ fontSize: 12, color: C.text_secondary, marginBottom: 12 }}>Supprimer definitivement votre compte et toutes vos donnees.</div>
          <GhostBtn label="🗑 Supprimer mon compte" onClick={() => { setDeletePw(""); setDeleteError(""); setShowDeleteModal(true); }} style={{ borderColor: C.danger, color: C.danger }} />
        </div>
      </Section>

      {/* Section Mode Entreprise */}
      <div onClick={() => { setShowModeEntreprise(true); loadEntrepriseStats(); getSetting('entreprise_last_sync').then(setLastSync); }} style={{
        backgroundColor: '#fff', borderRadius: 14, border: `1px solid ${C.card_border}`,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
        cursor: 'pointer', marginBottom: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          backgroundColor: C.accent + '20',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>🏢</div>
        <span style={{ flex: 1, fontWeight: 700, fontSize: 14, color: C.text_primary }}>Mode Entreprise</span>
        <span style={{ color: C.text_secondary, fontSize: 18 }}>›</span>
      </div>

      {showModeEntreprise && (
        <Modal visible fullscreen onClose={() => setShowModeEntreprise(false)} title="Mode Entreprise"
          footer={
            !bizMode.mode ? (
              <div style={{ padding: 16 }}>
                <PrimaryBtn label={creating ? 'Creation...' : 'Creer mon entreprise'} onClick={creerEntreprise} color={C.accent} loading={creating} />
              </div>
            ) : bizMode.isAdmin && (
              <div style={{ padding: 16 }}>
                <GhostBtn label="Desactiver le mode entreprise" onClick={() => setShowFermerModal(true)} style={{ borderColor: C.danger, color: C.danger }} />
              </div>
            )
          }
        >
        <div style={{ padding: 16 }}>
          {!bizMode.mode ? (
            <>
              <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 16, lineHeight: 1.6 }}>
                Renseignez les informations de votre entreprise pour activer le mode entreprise et partager l'app avec votre equipe. Vous devenez administrateur et pouvez ajouter des employes avec des acces limites.
              </div>
              {creationError && (
                <div style={{ backgroundColor: C.danger+'15', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, color: C.danger }}>
                  {creationError}
                </div>
              )}
              <FieldInput label="Nom de l'entreprise" value={factEntreprise.nom} onChange={v => setFactEntreprise(f=>({...f,nom:v}))} placeholder={entreprise || "Ex: Beauty Plus SARL"} />
              <FieldInput label="Adresse complete" value={factEntreprise.adresse} onChange={v => setFactEntreprise(f=>({...f,adresse:v}))} placeholder="Ex: 12 Avenue du Commerce, Kinshasa" multiline />
              <FieldInput label="Telephone" value={factEntreprise.telephone} onChange={v => setFactEntreprise(f=>({...f,telephone:v}))} type="tel" />
              <FieldInput label="Email" value={factEntreprise.email} onChange={v => setFactEntreprise(f=>({...f,email:v}))} type="email" />
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: C.text_secondary, fontWeight: 600, marginBottom: 6 }}>Logo de l'entreprise</div>
                {factEntreprise.logo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <img src={factEntreprise.logo} alt="logo" style={{ width: 50, height: 50, objectFit: 'contain', borderRadius: 8, border: `1px solid ${C.card_border}` }} />
                    <button onClick={() => setFactEntreprise(f => ({ ...f, logo: '' }))} style={{ background:'transparent', border:'none', color:C.danger, fontWeight:600, fontSize:12, cursor:'pointer' }}>Retirer le logo</button>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={onLogoChange} style={{ fontSize: 12 }} />
              </div>
            </>
          ) : bizMode.isAdmin ? (
            <>
              <div style={{ backgroundColor: C.accent+'15', borderRadius: 10, padding: 12, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.accent }}>Mode entreprise actif</div>
                <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 4 }}>Vous etes administrateur. {bizMode.employes.length} employe(s) connecte(s).</div>
              </div>

              {/* 3 boutons principaux */}
              <div style={{ display:'flex', gap:10, marginBottom:16 }}>
                <button onClick={() => setShowCodeModal(true)} style={{ flex:1, padding:'12px 8px', borderRadius:12, border:'1px solid '+C.accent, backgroundColor:'#fff', color:C.accent, fontWeight:700, fontSize:12, cursor:'pointer', textAlign:'center' }}>
                  Code
                </button>
                <button onClick={() => setShowEmployesModal(true)} style={{ flex:1, padding:'12px 8px', borderRadius:12, border:'1px solid '+C.pink, backgroundColor:'#fff', color:C.pink, fontWeight:700, fontSize:12, cursor:'pointer', textAlign:'center', position:'relative' }}>
                  Employes
                  {bizMode.employes.length > 0 && <span style={{ position:'absolute', top:6, right:6, width:16, height:16, borderRadius:'50%', backgroundColor:C.pink, color:'#fff', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>{bizMode.employes.length}</span>}
                </button>
                <button onClick={handleSyncEntreprise} disabled={syncingEntreprise} style={{ flex:1, padding:'12px 8px', borderRadius:12, border:'1px solid '+C.success, backgroundColor: syncingEntreprise ? C.success : '#fff', color: syncingEntreprise ? '#fff' : C.success, fontWeight:700, fontSize:12, cursor:'pointer', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <style>{`@keyframes syncBtn-spin { to { transform: rotate(360deg); } }`}</style>
                  {syncingEntreprise && (
                    <span style={{
                      width: 13, height: 13,
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'syncBtn-spin 0.7s linear infinite',
                    }} />
                  )}
                  {syncingEntreprise ? 'Sync...' : 'Sync'}
                </button>
              </div>
              {syncMsg && <div style={{ fontSize: 12, color: syncMsg.startsWith('Erreur') ? C.danger : C.accent, marginBottom: 4 }}>{syncMsg}</div>}
              {lastSync && (
                <div style={{ fontSize: 11, color: C.text_secondary, marginBottom: 12 }}>
                  Derniere sauvegarde : {new Date(lastSync).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}
                </div>
              )}

              {entrepriseStats.parEmploye.length > 0 && (
                <div style={{ marginTop: 20, marginBottom: 24 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:C.text_primary, marginBottom:14 }}>Repartition des ventes par employe</div>
                  <div style={{ display:'flex', alignItems:'center', gap:20 }}>
                    <div style={{
                      width:110, height:110, borderRadius:'50%', flexShrink:0,
                      background: `conic-gradient(${entrepriseStats.parEmploye.reduce((acc, e, i) => {
                        const start = entrepriseStats.parEmploye.slice(0,i).reduce((s,x)=>s+x.pct,0);
                        acc.push(`${e.color} ${start}% ${start+e.pct}%`);
                        return acc;
                      }, []).join(', ')})`,
                    }}>
                      <div style={{ width:'62%', height:'62%', margin:'19%', borderRadius:'50%', backgroundColor:'#fff' }} />
                    </div>
                    <div style={{ flex:1 }}>
                      {entrepriseStats.parEmploye.map((e,i) => (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                          <div style={{ width:10, height:10, borderRadius:'50%', backgroundColor:e.color, flexShrink:0 }} />
                          <div style={{ flex:1, fontSize:12, color:C.text_primary, fontWeight:600 }}>{e.nom}</div>
                          <div style={{ fontSize:11, color:C.text_secondary }}>{e.pct}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {entrepriseStats.parMois.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:C.text_primary, marginBottom:14 }}>Evolution des ventes (6 derniers mois)</div>
                  <div style={{ display:'flex', alignItems:'flex-end', gap:6 }}>
                    {entrepriseStats.parMois.map((m,i) => {
                      const maxV = Math.max(...entrepriseStats.parMois.map(x=>x.montant), 1);
                      const h = Math.max(4, Math.round((m.montant/maxV)*80));
                      return (
                        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center' }}>
                          <div style={{ width:'100%', height:80, display:'flex', alignItems:'flex-end' }}>
                            <div style={{ width:'100%', height:h, backgroundColor:C.accent, borderRadius:4 }} />
                          </div>
                          <div style={{ fontSize:10, color:C.text_secondary, marginTop:4 }}>{m.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </>
          ) : (
            <div style={{ backgroundColor: C.accent+'15', borderRadius: 10, padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: C.accent }}>Employe connecte</div>
              <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 4 }}>Role : {bizMode.role}</div>
              <PrimaryBtn label={syncingEntreprise ? 'Synchronisation...' : 'Synchroniser les donnees'} onClick={handleSyncEntreprise} loading={syncingEntreprise} color={C.accent} style={{ marginTop: 12 }} />
              {syncMsg && <div style={{ fontSize: 12, color: syncMsg.startsWith('Erreur') ? C.danger : C.accent, marginTop: 8 }}>{syncMsg}</div>}
            </div>
          )}
        </div>
        </Modal>
      )}

      {showModeEntreprise === false && null}
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

      {showDeactivateModal && (
        <Modal visible onClose={() => setShowDeactivateModal(false)} title="Confirmer la desactivation">
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 16 }}>Entrez votre mot de passe pour confirmer la desactivation de la protection.</div>
            {deactivateError && <div style={{ color: C.danger, fontSize: 13, marginBottom: 10 }}>{deactivateError}</div>}
            <FieldInput label="Mot de passe" value={deactivatePw} onChange={setDeactivatePw} type="password" />
          </div>
          <FormFooter onSave={desactiverSecurite} onClose={() => setShowDeactivateModal(false)} saveLabel="Confirmer" saveColor={C.danger} />
        </Modal>
      )}

      {showDeviseConfirm && (
        <Modal visible onClose={() => setShowDeviseConfirm(false)} title="Confirmer le changement de devise">
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 16 }}>
              Vous changez la monnaie :
            </div>
            <div style={{
              backgroundColor: C.success + '15',
              border: `1px solid ${C.success}`,
              borderRadius: 12,
              padding: '16px',
              textAlign: 'center',
              marginBottom: 16,
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.success }}>
                1 {(DEVISES.find(d => d.label === devise) || {}).symbol || devise} = {parseFloat(tauxConversion || 0).toLocaleString('fr-FR', { maximumFractionDigits: 6 })} {(DEVISES.find(d => d.label === nouvelleDevise) || {}).symbol || nouvelleDevise}
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.text_primary, fontWeight: 600 }}>
              Tous les montants existants (produits, ventes, credits, approvisionnements) seront convertis automatiquement.
            </div>
          </div>
          <FormFooter onSave={executerChangementDevise} onClose={() => setShowDeviseConfirm(false)} saveLabel="Confirmer le changement" saveColor={C.success} />
        </Modal>
      )}

      {showProfileEdit && (
        <Modal visible onClose={() => setShowProfileEdit(false)} title="Modifier le profil">
          <div style={{ padding: 16 }}>
            <FieldInput label="Nom" value={profileForm.nom} onChange={v => setProfileForm(f=>({...f,nom:v}))} />
            <FieldInput label="Role" value={profileForm.role} onChange={v => setProfileForm(f=>({...f,role:v}))} />
            <FieldInput label="Entreprise" value={profileForm.entreprise} onChange={v => setProfileForm(f=>({...f,entreprise:v}))} disabled={bizMode.isEmploye} />
            <FieldInput label="Pays" value={profileForm.pays} onChange={v => setProfileForm(f=>({...f,pays:v}))} />
            <FieldInput label="Ville" value={profileForm.ville} onChange={v => setProfileForm(f=>({...f,ville:v}))} />
            <FieldInput label="Telephone" value={profileForm.telephone} onChange={v => setProfileForm(f=>({...f,telephone:v}))} type="tel" />
            <FieldInput label="Email" value={profileForm.email} onChange={v => setProfileForm(f=>({...f,email:v}))} type="email" />
          </div>
          <FormFooter onSave={saveProfile} onClose={() => setShowProfileEdit(false)} saveLabel="Enregistrer" />
        </Modal>
      )}

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

      {showFermerModal && (
        <Modal visible onClose={() => setShowFermerModal(false)} title="Fermer l'entreprise">
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 14, lineHeight: 1.5 }}>
              Tous vos employes perdront l'acces a l'application. Un message avec le motif ci-dessous leur sera affiche.
            </div>
            <FieldInput label="Motif de la fermeture" value={motifFermeture} onChange={setMotifFermeture} placeholder="Ex: Fin d'activite, changement d'outil..." multiline />
          </div>
          <FormFooter onSave={confirmerFermeture} onClose={() => setShowFermerModal(false)} saveLabel={fermeturing ? 'Fermeture...' : 'Confirmer la fermeture'} saveColor={C.danger} loading={fermeturing} />
        </Modal>
      )}

      {showFermerPwModal && (
        <div style={{ position:"fixed",inset:0,backgroundColor:"rgba(26,31,54,0.85)",zIndex:1001,display:"flex",alignItems:"center",justifyContent:"center",padding:20 }}>
          <div style={{ backgroundColor:"#fff",borderRadius:20,padding:24,width:"100%",maxWidth:380 }}>
            <div style={{ fontSize:40,marginBottom:12,textAlign:'center' }}>⚠️</div>
            <div style={{ fontWeight:800,fontSize:18,color:C.danger,marginBottom:8,textAlign:'center' }}>Voulez-vous vraiment fermer ?</div>
            <div style={{ fontSize:13,color:C.text_secondary,marginBottom:20,lineHeight:1.6,textAlign:'center' }}>Confirmez avec votre mot de passe pour fermer l'entreprise.</div>
            {fermerPwError && <div style={{ backgroundColor:C.danger+"15",border:"1px solid "+C.danger,borderRadius:8,padding:10,marginBottom:12,fontSize:13,color:C.danger }}>{fermerPwError}</div>}
            {fermerHasPassword && (
              <FieldInput label="Mot de passe" value={fermerPw} onChange={setFermerPw} type="password" placeholder="Votre mot de passe" />
            )}
            <div style={{ display:"flex",flexDirection:"column",gap:10,marginTop:8 }}>
              <PrimaryBtn label={fermeturing ? 'Fermeture...' : 'Oui, fermer'} onClick={validerPwEtFermer} color={C.danger} loading={fermeturing} />
              <GhostBtn label="Annuler" onClick={() => { setShowFermerPwModal(false); setFermerPw(''); setFermerPwError(''); }} />
            </div>
          </div>
        </div>
      )}

      {showCodeModal && (
        <Modal visible onClose={() => setShowCodeModal(false)} title="Code d'invitation">
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 16, lineHeight: 1.6 }}>
              Partagez ce code avec vos employes. Il expire dans 15 minutes.
            </div>
            {bizMode.isCodeValid() && codeCombine ? (
              <div style={{ backgroundColor: C.card_bg, border: '2px dashed '+C.accent, borderRadius: 12, padding: 20, marginBottom: 16, textAlign: 'center' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 6, color: C.accent }}>{codeCombine}</div>
                  <button onClick={handleCopyCode} style={{ background: copied ? C.accent : 'transparent', border: '1px solid '+C.accent, borderRadius: 8, width: 34, height: 34, cursor: 'pointer', fontSize: 15, display:'flex', alignItems:'center', justifyContent:'center', color: copied ? '#fff' : C.accent }}>
                    {copied ? '✓' : '📋'}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 8 }}>Expire dans : {codeTimer}</div>
              </div>
            ) : (
              <div style={{ backgroundColor: '#fff3cd', borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, color: '#856404' }}>
                Aucun code actif ou code expire.
              </div>
            )}
            {codeError && <div style={{ backgroundColor: '#f8d7da', borderRadius: 10, padding: 12, marginBottom: 12, fontSize: 13, color: '#721c24' }}>{codeError}</div>}
            {needsDriveConnect && <PrimaryBtn label="Connecter Google Drive (entreprise)" onClick={handleConnecterDrive} color={C.accent} style={{ marginBottom: 12 }} />}
            <PrimaryBtn label="Generer un nouveau code" onClick={async () => { await handleGenererCode(); }} color={C.accent} />
          </div>
        </Modal>
      )}

      {showEmployesModal && (
        <Modal visible fullscreen onClose={() => setShowEmployesModal(false)} title="Employes">
          <div style={{ padding: 16 }}>
            {/* Onglets */}
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              <button onClick={() => setEmpListTab('actifs')} style={{ flex:1, padding:'10px 8px', borderRadius:10, border:'none', backgroundColor: empListTab==='actifs' ? C.accent : C.card_bg, color: empListTab==='actifs' ? '#fff' : C.text_primary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Employes actifs ({bizMode.employes.length})
              </button>
              <button onClick={() => { setEmpListTab('voles'); bizMode.refreshEmployesVoles(); }} style={{ flex:1, padding:'10px 8px', borderRadius:10, border:'none', backgroundColor: empListTab==='voles' ? '#E8A33D' : C.card_bg, color: empListTab==='voles' ? '#fff' : C.text_primary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Vole/Perdu ({bizMode.employesVoles.length})
              </button>
              <button onClick={() => { setEmpListTab('anciens'); bizMode.refreshEmployesRevoques(); }} style={{ flex:1, padding:'10px 8px', borderRadius:10, border:'none', backgroundColor: empListTab==='anciens' ? C.accent : C.card_bg, color: empListTab==='anciens' ? '#fff' : C.text_primary, fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Anciens employes
              </button>
            </div>

            {empListTab === 'actifs' && (
              bizMode.employes.length === 0 ? (
                <div style={{ fontSize: 13, color: C.text_secondary, textAlign:'center', padding: 40 }}>Aucun employe connecte.</div>
              ) : (
                bizMode.employes.map(emp => (
                  <div key={emp.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid '+C.card_border }}>
                    <div onClick={() => { setShowEmployesModal(false); ouvrirDetailEmploye(emp); }} style={{ cursor:'pointer', flex:1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.nom}</div>
                      <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 2 }}>{emp.poste}</div>
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => { setShowEmployesModal(false); ouvrirMarquageVole(emp); }} style={{ background:'transparent', border:'1px solid #E8A33D', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#E8A33D', cursor:'pointer' }}>Vole/Perdu</button>
                      <button onClick={() => { setShowEmployesModal(false); ouvrirRevocation(emp); }} style={{ background:'transparent', border:'1px solid '+C.danger, borderRadius:8, padding:'6px 12px', fontSize:12, color:C.danger, cursor:'pointer' }}>Revoquer</button>
                    </div>
                  </div>
                ))
              )
            )}

            {empListTab === 'voles' && (
              bizMode.employesVoles.length === 0 ? (
                <div style={{ fontSize: 13, color: C.text_secondary, textAlign:'center', padding: 40 }}>Aucun employe marque vole/perdu.</div>
              ) : (
                bizMode.employesVoles.map(emp => {
                  const expired = !emp.vole_code_expiry || emp.vole_code_expiry < Date.now();
                  return (
                    <div key={emp.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 0', borderBottom:'1px solid '+C.card_border }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.nom}</div>
                        <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 2 }}>{emp.poste}</div>
                        <div style={{ fontSize: 11, color: expired ? C.danger : '#E8A33D', marginTop: 2, fontWeight:600 }}>
                          {expired ? 'Code expire' : 'Code actif'}
                        </div>
                      </div>
                      <button onClick={() => { setShowEmployesModal(false); ouvrirMarquageVole(emp); }} style={{ background:'transparent', border:'1px solid #E8A33D', borderRadius:8, padding:'6px 12px', fontSize:12, color:'#E8A33D', cursor:'pointer' }}>
                        {expired ? 'Nouveau code' : 'Voir le code'}
                      </button>
                    </div>
                  );
                })
              )
            )}

            {empListTab === 'anciens' && (
              bizMode.employesRevoques.length === 0 ? (
                <div style={{ fontSize: 13, color: C.text_secondary, textAlign:'center', padding: 40 }}>Aucun ancien employe.</div>
              ) : (
                bizMode.employesRevoques.map(emp => (
                  <div key={emp.id} onClick={() => { setShowEmployesModal(false); ouvrirDetailEmploye(emp); }} style={{ padding:'14px 0', borderBottom:'1px solid '+C.card_border, cursor:'pointer' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{emp.nom}</div>
                      <div style={{ fontSize: 12, color: C.text_secondary }}>{emp.poste}</div>
                    </div>
                    <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 4 }}>
                      Revoque le {emp.revoked_at ? new Date(emp.revoked_at).toLocaleDateString('fr-FR') : '—'}
                    </div>
                    {emp.motif_revocation && (
                      <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 2 }}>Motif : {emp.motif_revocation}</div>
                    )}
                  </div>
                ))
              )
            )}
          </div>
        </Modal>
      )}

      {voleTarget && (
        <Modal visible onClose={() => setVoleTarget(null)} title={`Marquer ${voleTarget.nom} comme vole/perdu`}>
          <div style={{ padding: 16 }}>
            {!voleResult ? (
              <>
                <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 14, lineHeight: 1.5 }}>
                  {voleTarget?.vole
                    ? "Le code precedent a expire. Un nouveau code de deverrouillage a 6 chiffres sera genere : transmettez-le uniquement a la personne de confiance qui recuperera l'appareil."
                    : "L'appareil de cet employe sera verrouille des la prochaine verification (au demarrage de l'app). Un code de deverrouillage a 6 chiffres sera genere : transmettez-le uniquement a la personne de confiance qui recuperera l'appareil."}
                </div>
                {voleMarkError && (
                  <div style={{ backgroundColor: C.danger+'15', borderRadius: 10, padding: 12, marginBottom: 14, fontSize: 13, color: C.danger }}>{voleMarkError}</div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 10 }}>Code de deverrouillage (valable 48h) :</div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10, marginBottom: 10 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 4, color: C.accent }}>{voleResult.code}</div>
                  <button onClick={handleCopyVoleCode} title="Copier" style={{ background:'transparent', border:'1px solid '+C.card_border, borderRadius:8, padding:8, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {voleCopied ? '✅' : '📋'}
                  </button>
                </div>
                <div style={{ fontSize: 12, color: C.text_secondary, textAlign: 'center' }}>Transmettez ce code manuellement (appel, SMS...) a la personne concernee.</div>
              </>
            )}
          </div>
          <FormFooter
            onSave={voleResult ? () => setVoleTarget(null) : confirmerMarquageVole}
            onClose={() => setVoleTarget(null)}
            saveLabel={voleResult ? 'Termine' : (voleMarking ? 'Marquage...' : (voleTarget?.vole ? 'Regenerer un nouveau code' : 'Confirmer le marquage'))}
            saveColor="#E8A33D"
            loading={voleMarking}
          />
        </Modal>
      )}

      {revokeTarget && (
        <Modal visible onClose={() => setRevokeTarget(null)} title={`Revoquer ${revokeTarget.nom}`}>
          <div style={{ padding: 16 }}>
            <div style={{ fontSize: 13, color: C.text_secondary, marginBottom: 14, lineHeight: 1.5 }}>
              Cet employe perdra l'acces a l'application. Un message avec le motif ci-dessous lui sera affiche.
            </div>
            <FieldInput label="Motif de la revocation" value={motifSaisi} onChange={setMotifSaisi} placeholder="Ex: Fin de contrat, faute grave..." multiline />
          </div>
          <FormFooter onSave={confirmerRevocation} onClose={() => setRevokeTarget(null)} saveLabel={revoking ? 'Revocation...' : 'Confirmer la revocation'} saveColor={C.danger} loading={revoking} />
        </Modal>
      )}

      {showAnciens && (
        <Modal visible fullscreen onClose={() => setShowAnciens(false)} title="Anciens employes">
          <div style={{ padding: 4 }}>
            {bizMode.employesRevoques.length === 0 ? (
              <div style={{ fontSize: 13, color: C.text_secondary, textAlign: 'center', padding: 20 }}>Aucun ancien employe.</div>
            ) : (
              bizMode.employesRevoques.map((emp, i) => (
                <div key={emp.id} style={{ padding:'12px 14px', backgroundColor: i % 2 === 0 ? C.card_bg : C.page_bg }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{emp.nom}</span>
                    <span style={{ fontSize: 11, color: C.text_secondary }}>{emp.poste}</span>
                  </div>
                  {emp.motif_revocation && (
                    <div style={{ fontSize: 12, color: C.text_secondary, marginTop: 4 }}>Motif : {emp.motif_revocation}</div>
                  )}
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      <GhostBtn label="Se deconnecter" onClick={onLogout} style={{ borderColor:C.card_border,color:C.text_secondary }} />

      {empDetail && (
        <Modal visible fullscreen onClose={() => setEmpDetail(null)} title={`${empDetail.nom} (${empDetail.poste})`}
          footer={!empLoading && (
            <div style={{ display:'flex', gap:8, padding:'16px' }}>
              <button onClick={handleEmpSavePdf} style={{ flex:1, padding:'12px 0', borderRadius:10, border:'none', backgroundColor:C.accent, color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer' }}>
                📄 Enregistrer
              </button>
              <button onClick={handleEmpEnvoyerPdf} style={{ flex:1, padding:'12px 0', borderRadius:10, border:'none', backgroundColor:'#16a34a', color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer' }}>
                📤 Envoyer
              </button>
              <button onClick={handleEmpImprimer} style={{ flex:1, padding:'12px 0', borderRadius:10, border:'none', backgroundColor:'#404040', color:'#fff', fontWeight:800, fontSize:12, cursor:'pointer' }}>
                🖨 Imprimer
              </button>
            </div>
          )}
        >
          {empLoading ? (
            <div style={{ padding: 20, textAlign: 'center', color: C.text_secondary }}>Chargement...</div>
          ) : (
            <div style={{ padding: 4 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <button onClick={() => setEmpTab('ventes')} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: empTab==='ventes' ? 'none' : '1px solid '+C.card_border, backgroundColor: empTab==='ventes' ? C.accent : '#fff', color: empTab==='ventes' ? '#fff' : C.text_primary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Ventes ({empData.ventes.length})
                </button>
                <button onClick={() => setEmpTab('credits')} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: empTab==='credits' ? 'none' : '1px solid '+C.card_border, backgroundColor: empTab==='credits' ? C.accent : '#fff', color: empTab==='credits' ? '#fff' : C.text_primary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Credits ({empData.credits.length})
                </button>
                <button onClick={() => setEmpTab('appros')} style={{ flex: 1, padding: '10px 8px', borderRadius: 10, border: empTab==='appros' ? 'none' : '1px solid '+C.card_border, backgroundColor: empTab==='appros' ? C.accent : '#fff', color: empTab==='appros' ? '#fff' : C.text_primary, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                  Approv. ({empData.appros.length})
                </button>
              </div>

              <div style={{ padding: '10px 16px' }}>
                <input
                  type="text"
                  placeholder="Rechercher un produit..."
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid ' + C.card_border, fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>

              {empTab === 'ventes' && (() => {
                const filtered = empData.ventes.filter(v => v.produit.toLowerCase().includes(empSearch.toLowerCase()));
                const totalVentes = filtered.reduce((s, v) => s + (v.prix_vente * v.quantite), 0);
                return filtered.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.text_secondary, textAlign: 'center', padding: 20 }}>Aucune vente.</div>
                ) : (
                  <div>
                    {filtered.map((v, i) => (
                      <div key={i} style={{ display:'flex', flexDirection:'column', gap:2, padding:'10px 14px', backgroundColor: i % 2 === 0 ? C.card_bg : C.page_bg, fontSize: 13 }}>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <span>{v.produit} x{v.quantite}</span>
                          <span style={{ fontWeight: 700, color: C.accent }}>{fmtMoney(v.prix_vente * v.quantite)}</span>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize: 11, color: C.text_secondary }}>
                          <span>{v.clientNom || 'Client non renseigne'}</span>
                          <span>{v.facture_numero || '—'}</span>
                        </div>
                      </div>
                    ))}
                    <div style={{ display:'flex', justifyContent:'space-between', padding:'12px 14px', borderTop:'2px solid '+C.card_border, marginTop: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 13 }}>Total</span>
                      <span style={{ fontWeight: 800, fontSize: 14, color: C.accent }}>{fmtMoney(totalVentes)}</span>
                    </div>
                  </div>
                );
              })()}

              {empTab === 'credits' && (() => {
                const filtered = empData.credits.filter(cr => (cr.produit || 'Credit').toLowerCase().includes(empSearch.toLowerCase()));
                return filtered.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.text_secondary, textAlign: 'center', padding: 20 }}>Aucun credit.</div>
                ) : (
                  <div>
                    {filtered.map((cr, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', backgroundColor: i % 2 === 0 ? C.card_bg : C.page_bg, fontSize: 13 }}>
                        <span>{cr.produit || 'Credit'}</span>
                        <span style={{ fontWeight: 700, color: C.accent }}>{fmtMoney(cr.montant || 0)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {empTab === 'appros' && (() => {
                const filtered = empData.appros.filter(a => a.produit.toLowerCase().includes(empSearch.toLowerCase()));
                return filtered.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.text_secondary, textAlign: 'center', padding: 20 }}>Aucun approvisionnement.</div>
                ) : (
                  <div>
                    {filtered.map((a, i) => (
                      <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'10px 14px', backgroundColor: i % 2 === 0 ? C.card_bg : C.page_bg, fontSize: 13 }}>
                        <span>{a.produit} x{a.quantite}</span>
                        <span style={{ color: C.text_secondary }}>{a.date}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

            </div>
          )}
        </Modal>
      )}
    </div>
  );
};
