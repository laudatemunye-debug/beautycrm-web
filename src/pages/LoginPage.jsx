import { useState, useEffect } from "react";
import { useEntreprise } from '../hooks/useEntreprise';

import { C, SECURITY_QUESTIONS, DEVISES } from '../theme';
import { getSetting, setSetting, sha256, clearAllData } from '../db/index';
import { trackUser } from '../hooks/useTracker';
import { FieldInput, PrimaryBtn, GhostBtn, PickerSelect } from '../components/UI';

const PAYS_LIST = ["RDC","Cameroun","Cote dIvoire","Senegal","Mali","Burkina Faso","Niger","Togo","Benin","Guinee","Congo Brazzaville","Gabon","Rwanda","Burundi","Autre"];
const ROLES = ["Distributeur","Revendeur","Agent","Grossiste","Autre"];
const INDICATIFS = [
  {pays:"RDC",code:"+243"},{pays:"Cameroun",code:"+237"},
  {pays:"Cote dIvoire",code:"+225"},{pays:"Senegal",code:"+221"},
  {pays:"Mali",code:"+223"},{pays:"Burkina Faso",code:"+226"},
  {pays:"Niger",code:"+227"},{pays:"Togo",code:"+228"},
  {pays:"Benin",code:"+229"},{pays:"Guinee",code:"+224"},
  {pays:"Congo Brazzaville",code:"+242"},{pays:"Gabon",code:"+241"},
  {pays:"Rwanda",code:"+250"},{pays:"Burundi",code:"+257"},
  {pays:"Autre",code:"+00"},
];


const PolitiqueContent = () => (
  <div style={{ padding: '12px 16px 24px', fontSize: 13, color: '#333', lineHeight: 1.7 }}>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>1. Données collectées</div>
    <div style={{ marginBottom: 10 }}>Seules les informations que <strong>vous saisissez vous-même</strong> sont utilisées (nom, téléphone, email, ville, pays, entreprise). <strong>IZIsoft ne collecte aucune donnée automatiquement et n'a aucun accès à vos informations.</strong></div>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>2. Utilisation</div>
    <div style={{ marginBottom: 10 }}>Vos données servent uniquement à faire fonctionner BeautyCRM sur votre appareil. <strong>IZIsoft n'y a aucun accès, ne les consulte pas et ne les partage jamais.</strong></div>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>3. Stockage 100% local</div>
    <div style={{ marginBottom: 10 }}>Toutes vos données restent sur votre appareil (IndexedDB). Aucun envoi automatique vers un serveur.</div>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>4. Google Drive</div>
    <div style={{ marginBottom: 10 }}>La sauvegarde Google Drive est optionnelle. IZIsoft n'a pas accès à vos sauvegardes.</div>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>5. Sécurité</div>
    <div style={{ marginBottom: 10 }}>Votre mot de passe est hashé (SHA-256). Personne, y compris IZIsoft, ne peut le lire.</div>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>6. Vos droits</div>
    <div style={{ marginBottom: 10 }}>Supprimez toutes vos données à tout moment via Paramètres → Supprimer mon compte.</div>
    <div style={{ fontWeight: 700, marginBottom: 4 }}>7. Contact</div>
    <div>📧 izisoft.app@gmail.com · 💬 +243 997 245 614</div>
    <div style={{ marginTop: 14, fontSize: 11, color: '#aaa', textAlign: 'center' }}>© 2026 IZIsoft · BeautyCRM</div>
  </div>
);

const StepIndicator = ({ current, total }) => (
  <div style={{ display:'flex', gap:8, justifyContent:'center', marginBottom:24 }}>
    {Array.from({length:total}).map((_,i) => (
      <div key={i} style={{ width:i===current?24:8, height:8, borderRadius:4, backgroundColor:i<=current?C.accent:C.card_border, transition:'all 0.3s' }} />
    ))}
  </div>
);

export const LoginPage = ({ onSuccess, googleConnect, downloadBackup, googleUser, googleDisconnect, importAllData }) => {
  const [canInstall, setCanInstall] = useState(!!window.__deferredInstallPrompt);
  useEffect(() => {
    const handler = () => setCanInstall(true);
    window.addEventListener('installpromptready', handler);
    return () => window.removeEventListener('installpromptready', handler);
  }, []);
  const handleInstall = async () => {
    const promptEvent = window.__deferredInstallPrompt;
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice;
    window.__deferredInstallPrompt = null;
    setCanInstall(false);
  };
  const [mode, setMode] = useState("welcome");
  const bizMode = useEntreprise();
  const [codeEntreprise, setCodeEntreprise] = useState('');
  const [nomEmploye, setNomEmploye] = useState('');
  const [posteEmploye, setPosteEmploye] = useState('vendeur');
  const [joinError, setJoinError] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pw, setPw] = useState('');
  const [nom, setNom] = useState('');
  const [setupNom, setSetupNom] = useState('');
  const [telephone, setTelephone] = useState('');
  const [indicatif, setIndicatif] = useState('+243');
  const [email, setEmail] = useState('');
  const [pays, setPays] = useState('RDC');
  const [ville, setVille] = useState('');
  const [devise, setDevise] = useState(DEVISES[0].label);
  const [entreprise, setEntreprise] = useState('');
  const [role, setRole] = useState('Distributeur');
  const [usePassword, setUsePassword] = useState(true);
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [secQ, setSecQ] = useState(SECURITY_QUESTIONS[0]);
  const [secA, setSecA] = useState('');
  const [secAInput, setSecAInput] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [showPolitique, setShowPolitique] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [emailFoundInfo, setEmailFoundInfo] = useState(null);
  const [joinAutoLoading, setJoinAutoLoading] = useState(false);
  const [joinAutoError, setJoinAutoError] = useState('');

  useEffect(() => {
    getSetting("password").then(p => { if (p) setMode("login"); else setMode("welcome"); }).catch(() => setMode("welcome"));
  }, []);

  const onPaysChange = (p) => {
    setPays(p);
    const found = INDICATIFS.find(i => i.pays === p);
    if (found) setIndicatif(found.code);
  };

  const handleLogin = async () => {
    setError(''); setLoading(true);
    try {
      const stored = await getSetting("password");
      if (!stored) { setStep(0); setMode("setup"); return; }
      const storedNom = await getSetting("username");
      if (storedNom && nom.trim().toLowerCase() !== storedNom.toLowerCase()) { setError("Nom incorrect."); return; }
      const hash = await sha256(pw);
      if (hash !== stored) { setError('Mot de passe incorrect.'); return; }
      onSuccess(await getSetting('username') || 'Utilisateur');
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const nextStep = async () => {
    setError('');
    if (step === 0) {
      if (!setupNom.trim()) { setError('Le nom complet est obligatoire.'); return; }
      if (!telephone.trim()) { setError('Le telephone WhatsApp est obligatoire.'); return; }
      if (!email.trim()) { setError("L'email est obligatoire."); return; }
      setCheckingEmail(true);
      try {
        const info = await bizMode.checkEmail(email.trim());
        if (info && info.found) {
          setEmailFoundInfo(info);
          setCheckingEmail(false);
          return;
        }
      } catch (_) {}
      setCheckingEmail(false);
    }
    if (step === 1) {
      if (!pays.trim()) { setError('Le pays est obligatoire.'); return; }
      if (!ville.trim()) { setError('La ville est obligatoire.'); return; }
      if (!devise.trim()) { setError('La devise est obligatoire.'); return; }
    }
    if (step === 2) {
      if (!entreprise.trim()) { setError("Le nom de l'entreprise est obligatoire."); return; }
      if (!role.trim()) { setError('Le role est obligatoire.'); return; }
    }
    if (step === 3) { handleSetup(); return; }
    setStep(s => s + 1);
  };

  const confirmerRejoindreExistant = async () => {
    if (!emailFoundInfo) return;
    setJoinAutoError('');
    setJoinAutoLoading(true);
    try {
      await clearAllData();
      await setSetting('username', setupNom.trim());
      await setSetting('telephone', indicatif + telephone);
      await setSetting('email', email.trim());
      if (emailFoundInfo.role === 'admin') {
        await setSetting('entreprise_mode', 'admin');
        await setSetting('entreprise_role', 'admin');
        await setSetting('entreprise_admin_email', email.trim());
      } else {
        await setSetting('entreprise_mode', 'employe');
        await setSetting('entreprise_role', emailFoundInfo.poste || 'vendeur');
        await setSetting('entreprise_admin_email', emailFoundInfo.admin_email);
        await setSetting('entreprise_employe_id', String(emailFoundInfo.employe_id || ''));
      }
      // Recuperer devise + infos facture depuis le serveur avant de recharger
      try {
        if (emailFoundInfo.role === 'admin') {
          await bizMode.checkSuspension();
        } else {
          await bizMode.checkEmployeStatus();
        }
      } catch (_) {}
      // Telecharger les donnees partagees de l'entreprise (clients, credits, produits, ventes...)
      try {
        await bizMode.syncEntreprise();
      } catch (_) {}
      window.location.reload();
    } catch (e) {
      setJoinAutoError(e.message || 'Erreur');
      setJoinAutoLoading(false);
    }
  };

  const ignorerEtContinuer = () => {
    setEmailFoundInfo(null);
    setStep(s => s + 1);
  };

  const handleSetup = async () => {
    setError('');
    await clearAllData();
    if (usePassword) {
      if (newPw.length < 4) { setError('Mot de passe trop court (min 4).'); return; }
      if (newPw !== confirmPw) { setError('Mots de passe differents.'); return; }
      if (!secA.trim()) { setError('Repondez a la question de securite.'); return; }
    }
    setLoading(true);
    try {
      await setSetting('password', usePassword ? await sha256(newPw) : '');
      await setSetting('use_password', usePassword ? '1' : '0');
      await setSetting('username', setupNom.trim());
      if (usePassword) {
        await setSetting('security_question', secQ);
        await setSetting('security_answer', await sha256(secA.toLowerCase().trim()));
      }
      await setSetting('devise', devise);
      await setSetting('entreprise', entreprise);
      await setSetting('role', role);
      await setSetting('pays', pays);
      await setSetting('ville', ville);
      await setSetting('telephone', indicatif + telephone);
      await setSetting('email', email);
      const synced = await trackUser({ nom: setupNom.trim(), email, telephone: indicatif+telephone, pays, ville, entreprise, role, devise });
      await setSetting('izi360_synced', synced ? '1' : '0');
      const found = DEVISES.find(d => d.label === devise);
      if (found) window.__DEVISE_SYMBOL__ = found.symbol;
      if (usePassword) {
        setMode("login");
      } else {
        window.location.reload();
      }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleReset = async () => {
    setError('');
    const storedA = await getSetting('security_answer');
    const hashA = await sha256(secAInput.toLowerCase().trim());
    if (hashA !== storedA) { setError('Reponse incorrecte.'); return; }
    if (resetPw.length < 4) { setError('Mot de passe trop court.'); return; }
    if (resetPw !== resetConfirm) { setError('Mots de passe differents.'); return; }
    await setSetting('password', await sha256(resetPw));
    setMode("login");
  };

  const STEP_TITLES = ['Identite','Localisation','Entreprise','Securite'];
  const STEP_SUBS = ['Vos informations personnelles','Votre pays et devise','Votre activite','Votre mot de passe'];

  return (
    <div style={{ minHeight:'100vh', backgroundColor:C.sidebar_bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ backgroundColor:'#fff', borderRadius:24, padding:28, width:'100%', maxWidth:400, boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ width:72, height:72, borderRadius:20, backgroundColor:C.accent, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, margin:'0 auto 12px' }}>💄</div>
          <div style={{ fontWeight:800, fontSize:20, color:C.text_primary }}>BeautyCRM</div>
          <div style={{ fontSize:11, color:C.text_secondary, marginTop:2 }}>Ton Agenda Numerique</div>
          {mode==='setup' && <div style={{ marginTop:8 }}><div style={{ fontWeight:700, fontSize:15, color:C.accent }}>{STEP_TITLES[step]}</div><div style={{ fontSize:12, color:C.text_secondary }}>{STEP_SUBS[step]}</div></div>}
          {mode==='login' && <div style={{ color:C.text_secondary, fontSize:13, marginTop:4 }}>Connexion</div>}
          {mode==='reset' && <div style={{ color:C.text_secondary, fontSize:13, marginTop:4 }}>Reinitialiser</div>}
        </div>

        {error && <div style={{ backgroundColor:C.danger+'15', border:`1px solid ${C.danger}`, borderRadius:10, padding:12, marginBottom:14, fontSize:13, color:C.danger }}>{error}</div>}

        {mode==="welcome" && (
          <div style={{ textAlign:"center" }}>
            {canInstall && (
              <PrimaryBtn label="⬇️ Telecharger l'application" onClick={handleInstall} style={{ marginBottom:12, backgroundColor:'#25D366' }} />
            )}
            <PrimaryBtn label="Creer un nouveau compte" onClick={() => { setError(""); setStep(0); setMode("setup"); }} style={{ marginBottom:12 }} />
            <GhostBtn label="Restaurer depuis Google Drive" onClick={() => setMode("restore")} style={{ marginBottom:12 }} />
            <GhostBtn label="Rejoindre une entreprise" onClick={() => setMode("join")} />
          </div>
        )}

        {mode==="login" && (<>
          <FieldInput label="Nom d'utilisateur" value={nom} onChange={setNom} placeholder="Votre nom" />
          <FieldInput label="Mot de passe" value={pw} onChange={setPw} type="password" placeholder="Votre mot de passe" />
          <PrimaryBtn label="Se connecter" onClick={handleLogin} loading={loading} />
          <div style={{ textAlign:'center', marginTop:14, display:'flex', flexDirection:'column', gap:8 }}>
            <span onClick={() => setMode('reset')} style={{ color:C.accent, fontSize:13, cursor:'pointer', fontWeight:600 }}>Mot de passe oublie ?</span>
            <span onClick={() => { setError(''); setStep(0); setMode('setup'); }} style={{ color:C.text_secondary, fontSize:13, cursor:'pointer' }}>Creer un nouveau compte</span>
          </div>
        </>)}

        {mode==='join' && (<>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:13, color:C.text_secondary, marginBottom:16, lineHeight:1.6 }}>Entrez le code d'invitation fourni par votre administrateur.</div>
            {joinError && <div style={{ color:C.danger, fontSize:13, marginBottom:10 }}>{joinError}</div>}
            <FieldInput label="Code d'invitation (6 chiffres)" value={codeEntreprise} onChange={v => setCodeEntreprise(v.replace(/\D/g,'').slice(0,6))} placeholder="Ex: 336754" />
            <FieldInput label="Votre nom" value={nomEmploye} onChange={setNomEmploye} placeholder="Ex: Marie" />
            <FieldInput label="Votre email" value={email} onChange={setEmail} type="email" placeholder="votre@email.com" />
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:C.text_secondary, fontWeight:600, marginBottom:6 }}>Votre poste</div>
              <select value={posteEmploye} onChange={e => setPosteEmploye(e.target.value)} style={{ width:'100%', padding:13, borderRadius:10, border:'1px solid '+C.input_border, backgroundColor:C.input_bg, fontSize:14, color:C.text_primary, fontFamily:'inherit', boxSizing:'border-box' }}>
                <option value="vendeur">Vendeur</option>
                <option value="gestionnaire">Gestionnaire</option>
              </select>
            </div>
            <PrimaryBtn label={joinLoading ? "Connexion..." : "Rejoindre l'entreprise"} loading={joinLoading} onClick={async () => {
              setJoinError('');
              if (codeEntreprise.length !== 6) { setJoinError('Le code doit contenir 6 chiffres.'); return; }
              if (!nomEmploye.trim()) { setJoinError('Entrez votre nom.'); return; }
              setJoinLoading(true);
              try {
                await bizMode.rejoindreEntreprise(codeEntreprise, nomEmploye.trim(), posteEmploye, email.trim());
                await setSetting('username', nomEmploye.trim());
                onSuccess(nomEmploye.trim());
              } catch(e) { setJoinError(e.message); }
              finally { setJoinLoading(false); }
            }} />
          </div>
          <GhostBtn label="Retour" onClick={() => setMode('welcome')} />
        </>)}

        {mode==='setup' && (<>
          <StepIndicator current={step} total={4} />
          {step===0 && (<>
            <FieldInput label="Nom complet *" value={setupNom} onChange={setSetupNom} placeholder="Ex: Marie Dupont" />
            <div onClick={() => setUsePassword(p => !p)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', backgroundColor:C.bg_secondary||'#f5f5f7', borderRadius:10, padding:'12px 14px', marginBottom:14, cursor:'pointer' }}>
              <div>
                <div style={{ fontWeight:700, fontSize:13, color:C.text_primary }}>Proteger par mot de passe</div>
                <div style={{ fontSize:11, color:C.text_secondary, marginTop:2 }}>{usePassword ? "L'app demandera un mot de passe a l'ouverture" : "Acces libre, sans mot de passe"}</div>
              </div>
              <div style={{ width:44, height:26, borderRadius:13, backgroundColor: usePassword ? C.accent : '#ccc', position:'relative', flexShrink:0, transition:'background-color .2s' }}>
                <div style={{ width:20, height:20, borderRadius:'50%', backgroundColor:'#fff', position:'absolute', top:3, left: usePassword ? 21 : 3, transition:'left .2s', boxShadow:'0 1px 3px rgba(0,0,0,.3)' }} />
              </div>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:C.text_secondary, fontWeight:600, marginBottom:6 }}>Telephone WhatsApp</div>
              <div style={{ display:'flex', gap:8 }}>
                <select value={indicatif} onChange={e => setIndicatif(e.target.value)} style={{ width:95, backgroundColor:C.input_bg, border:`1px solid ${C.input_border}`, borderRadius:10, padding:13, fontSize:12, color:C.text_primary, fontFamily:'inherit' }}>
                  {INDICATIFS.map(i => <option key={i.code} value={i.code}>{i.code} {i.pays.slice(0,5)}</option>)}
                </select>
                <input value={telephone} onChange={e => setTelephone(e.target.value)} type="tel" placeholder="XXX XXX XXX" style={{ flex:1, backgroundColor:C.input_bg, border:`1px solid ${C.input_border}`, borderRadius:10, padding:13, fontSize:14, color:C.text_primary, fontFamily:'inherit', boxSizing:'border-box', outline:'none' }} />
              </div>
            </div>
            <FieldInput label="Email" value={email} onChange={setEmail} type="email" placeholder="votre@email.com" />
          </>)}
          {step===1 && (<>
            <PickerSelect label="Pays" value={pays} onChange={onPaysChange} options={PAYS_LIST} />
            <FieldInput label="Ville" value={ville} onChange={setVille} placeholder="Ex: Kinshasa" />
            <PickerSelect label="Devise de travail" value={devise} onChange={setDevise} options={DEVISES.map(d => d.label)} />
          </>)}
          {step===2 && (<>
            <FieldInput label="Nom de votre entreprise" value={entreprise} onChange={setEntreprise} placeholder="Ex: Beauty Plus SARL" />
            <PickerSelect label="Votre role" value={role} onChange={setRole} options={ROLES} />
          </>)}
          {step===3 && (<>
            {usePassword ? (<>
              <FieldInput label="Mot de passe *" value={newPw} onChange={setNewPw} type="password" placeholder="Min 4 caracteres" />
              <FieldInput label="Confirmer le mot de passe" value={confirmPw} onChange={setConfirmPw} type="password" />
              <PickerSelect label="Question de securite" value={secQ} onChange={setSecQ} options={SECURITY_QUESTIONS} />
              <FieldInput label="Reponse secrete" value={secA} onChange={setSecA} placeholder="Votre reponse" />
            </>) : (
              <div style={{ textAlign:'center', padding:'30px 10px' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>🔓</div>
                <div style={{ fontWeight:700, fontSize:15, color:C.text_primary, marginBottom:6 }}>Acces libre active</div>
                <div style={{ fontSize:13, color:C.text_secondary }}>L'app s'ouvrira directement sans mot de passe.</div>
              </div>
            )}
          </>)}
          {step===3 && (
            <div style={{ textAlign:'center', fontSize:11, color:'#888', marginTop:8, marginBottom:4 }}>
              En créant votre compte, vous acceptez notre{' '}
              <span onClick={() => setShowPolitique(true)} style={{ color:'#3D5AFE', cursor:'pointer', fontWeight:600 }}>
                politique de confidentialité
              </span>
            </div>
          )}
          <div style={{ display:'flex', gap:10, marginTop:8 }}>
            {step>0 && <GhostBtn label="Retour" onClick={() => { setError(''); setStep(s=>s-1); }} style={{ flex:1 }} />}
            <PrimaryBtn label={checkingEmail ? 'Verification...' : (step===3?'Creer mon compte':'Suivant')} onClick={nextStep} loading={loading || checkingEmail} style={{ flex:2 }} />
          </div>
          {showPolitique && (
            <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
              <div style={{ backgroundColor:'#fff', borderRadius:'20px 20px 0 0', width:'100%', maxWidth:480, maxHeight:'85vh', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #eee' }}>
                  <span style={{ fontWeight:800, fontSize:15 }}>Politique de confidentialité</span>
                  <span onClick={() => setShowPolitique(false)} style={{ fontSize:24, cursor:'pointer', color:'#888' }}>×</span>
                </div>
                <div style={{ overflowY:'auto', flex:1, padding:'0 4px' }}>
                  <PolitiqueContent />
                </div>
              </div>
            </div>
          )}
        </>)}

        {mode==="restore" && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>☁</div>
            <div style={{ fontWeight:700, fontSize:16, color:C.text_primary, marginBottom:8 }}>Restaurer depuis Google Drive</div>
            <div style={{ fontSize:13, color:C.text_secondary, marginBottom:20, lineHeight:1.6 }}>Connectez votre compte Google pour restaurer vos donnees sur cet appareil.</div>
            {googleUser ? (
              <div style={{ backgroundColor: "#e8f5e9", borderRadius: 10, padding: 12, marginBottom: 8, fontSize: 13, color: "#2e7d32", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                  {googleUser.picture ? (
                    <img src={googleUser.picture} alt="" style={{ width:20, height:20, borderRadius:'50%', objectFit:'cover' }} />
                  ) : '🟢'}
                  {googleUser.name || googleUser.email}
                </span>
                <span
                  onClick={async () => { await googleDisconnect(); googleConnect && googleConnect(); }}
                  style={{ color: C.accent, fontWeight:600, cursor:"pointer", fontSize:12, textDecoration:"underline" }}
                >
                  Changer
                </span>
              </div>
            ) : null}
            <PrimaryBtn label={googleUser ? "Restaurer mes donnees" : "Connecter Google Drive"} onClick={async () => {
              if (!googleUser) { googleConnect && googleConnect(); return; }
              try {
                const data = await downloadBackup();
                if (data) {
                  await importAllData(data);
                  window.location.reload();
                  return;
                }
                // Pas de sauvegarde perso : verifier si cet email est deja lie a une entreprise
                const info = await bizMode.checkEmail(googleUser.email);
                if (info && info.found) {
                  setEmail(googleUser.email);
                  setSetupNom(googleUser.name || googleUser.email);
                  setEmailFoundInfo(info);
                } else {
                  setMode("nobackup");
                }
              } catch(e) { alert("Erreur : " + e.message); }
            }} style={{ marginBottom:12 }} />
            <GhostBtn label="Retour" onClick={() => setMode("welcome")} />
          </div>
        )}

        {mode==="nobackup" && (
          <div style={{ textAlign:"center" }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🔍</div>
            <div style={{ fontWeight:700, fontSize:16, color:C.text_primary, marginBottom:8 }}>Aucun compte trouve</div>
            <div style={{ fontSize:13, color:C.text_secondary, marginBottom:20, lineHeight:1.6 }}>Aucune sauvegarde n'est associee a ce compte Google. Voulez-vous creer un nouveau compte ?</div>
            <PrimaryBtn label="Creer un compte" onClick={() => { setStep(0); setMode('setup'); }} style={{ marginBottom:12 }} />
            <GhostBtn label="Annuler" onClick={() => setMode("restore")} />
          </div>
        )}

        {mode==="reset" && (<>
          <FieldInput label="Reponse a la question de securite" value={secAInput} onChange={setSecAInput} />
          <FieldInput label="Nouveau mot de passe" value={resetPw} onChange={setResetPw} type="password" />
          <FieldInput label="Confirmer" value={resetConfirm} onChange={setResetConfirm} type="password" />
          <PrimaryBtn label="Reinitialiser" onClick={handleReset} loading={loading} />
          <GhostBtn label="Retour" onClick={() => setMode('login')} style={{ marginTop:10 }} />
        </>)}
      </div>
      <div style={{ marginTop:24, textAlign:'center', color:'rgba(255,255,255,0.6)', fontSize:12, lineHeight:1.8 }}>
        La gestion de ton business devient facile,<br/>tout au meme endroit dans ton smartphone
      </div>
          {emailFoundInfo && (
            <div style={{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
              <div style={{ backgroundColor:'#fff', borderRadius:20, width:'100%', maxWidth:380, padding:24, textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>🏢</div>
                <div style={{ fontWeight:800, fontSize:16, color:C.text_primary, marginBottom:10 }}>Compte entreprise detecte</div>
                <div style={{ fontSize:13, color:C.text_secondary, marginBottom:20, lineHeight:1.6 }}>
                  Cet email est deja associe a une entreprise en tant qu'{emailFoundInfo.role === 'admin' ? 'administrateur' : 'employe'}.
                  Vous devez utiliser ce meme compte : vos donnees seront synchronisees automatiquement.
                </div>
                {joinAutoError && <div style={{ color:C.danger, fontSize:13, marginBottom:14 }}>{joinAutoError}</div>}
                <PrimaryBtn label={joinAutoLoading ? 'Connexion...' : 'Continuer avec ce compte'} onClick={confirmerRejoindreExistant} loading={joinAutoLoading} style={{ marginBottom:10 }} />
                <GhostBtn label="Annuler" onClick={() => setEmailFoundInfo(null)} />
              </div>
            </div>
          )}
    </div>
  );
};
