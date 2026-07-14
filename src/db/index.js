import { openDB } from 'idb';

const DB_NAME = 'beautycrm';
const DB_VERSION = 8;
const STORES = ['clients','produits','ventes','prospects','rdvs','seminaires','participants','settings','approvisionnements','credits','factures','factures_credit','plan_comptable','ecritures','charges','employes','bulletins_paie','periodes_comptables','audit_log'];

let _db = null;
const getDB = async () => {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: '_id' });
        }
      }
    },
    blocked() { window.location.reload(); },
    blocking() { _db?.close(); },
  });
  return _db;
};

export const nowISO = () => new Date().toISOString();
export const today = () => new Date().toISOString().split('T')[0];
export const generateId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

export const sha256 = async (str) => {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
  }
  let h0=1779033703,h1=3144134277,h2=1013904242,h3=2773480762,h4=1359893119,h5=2600822924,h6=528734635,h7=1541325730;
  const msg = new TextEncoder().encode(str);
  const l = msg.length;
  const buf2 = new ArrayBuffer((((l+9)>>6)+1)<<6);
  const view = new DataView(buf2);
  for(let i=0;i<l;i++) view.setUint8(i,msg[i]);
  view.setUint8(l,0x80);
  view.setUint32(buf2.byteLength-4,(l*8)&0xffffffff,false);
  const W=new Uint32Array(64);
  const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const rotr=(x,n)=>(x>>>n)|(x<<(32-n));
  for(let i=0;i<buf2.byteLength;i+=64){
    for(let j=0;j<16;j++) W[j]=view.getUint32(i+j*4,false);
    for(let j=16;j<64;j++){const s0=rotr(W[j-15],7)^rotr(W[j-15],18)^(W[j-15]>>>3);const s1=rotr(W[j-2],17)^rotr(W[j-2],19)^(W[j-2]>>>10);W[j]=(W[j-16]+s0+W[j-7]+s1)>>>0;}
    let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,hh=h7;
    for(let j=0;j<64;j++){const S1=rotr(e,6)^rotr(e,11)^rotr(e,25);const ch=(e&f)^(~e&g);const t1=(hh+S1+ch+K[j]+W[j])>>>0;const S0=rotr(a,2)^rotr(a,13)^rotr(a,22);const maj=(a&b)^(a&c)^(b&c);const t2=(S0+maj)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
    h0=(h0+a)>>>0;h1=(h1+b)>>>0;h2=(h2+c)>>>0;h3=(h3+d)>>>0;h4=(h4+e)>>>0;h5=(h5+f)>>>0;h6=(h6+g)>>>0;h7=(h7+hh)>>>0;
  }
  return [h0,h1,h2,h3,h4,h5,h6,h7].map(x=>x.toString(16).padStart(8,"0")).join("");
};

// SETTINGS
export const getSetting = async (key) => {
  const db = await getDB();
  const doc = await db.get('settings', key);
  return doc?.value ?? null;
};
export const setSetting = async (key, value) => {
  const db = await getDB();
  await db.put('settings', { _id: key, value });
};

// GENERIQUE
const getAll = async (store) => {
  const db = await getDB();
  const all = await db.getAll(store);
  return all.filter(d => !d.deleted_at);
};
const putDoc = async (store, data) => {
  const db = await getDB();
  await db.put(store, { ...data, updated_at: nowISO() });
};
const softDelete = async (store, id) => {
  const db = await getDB();
  const doc = await db.get(store, id);
  if (doc) await db.put(store, { ...doc, deleted_at: nowISO(), updated_at: nowISO() });
};

// CLIENTS
export const getClients = async () => {
  const all = await getAll('clients');
  return all.sort((a,b) => a.nom.localeCompare(b.nom));
};
export const saveClient = async (data) => {
  if (!data._id) data._id = generateId();
  await putDoc('clients', data);
};
export const deleteClient = (id) => softDelete('clients', id);

// PRODUITS
export const getProduits = async () => {
  const all = await getAll('produits');
  return all.sort((a,b) => a.nom.localeCompare(b.nom));
};
export const saveProduit = async (data) => {
  const isNew = !data._id;
  if (!data._id) data._id = generateId();
  const db = await getDB();
  // Récupérer l'ancien stock si mise à jour
  const ancien = isNew ? null : await db.get('produits', data._id);
  await putDoc('produits', data);
  // Si stock initial à la création ou augmentation de stock → appro auto
  // _skipAppro évite la boucle infinie quand saveProduit est appelé depuis saveApprovisionnement
  if (!data._skipAppro) {
    try {
      const mode = await getSetting('entreprise_mode');
      if (mode === 'admin' || mode === 'employe') {
        const ancienStock = ancien?.stock || 0;
        const nouveauStock = data.stock || 0;
        const diff = nouveauStock - ancienStock;
        if (diff > 0 && data.prix_achat) {
          await saveApprovisionnement({
            produit: data.nom,
            quantite: diff,
            prix_achat: data.prix_achat,
            date: today(),
            notes: isNew ? 'Stock initial' : 'Mise à jour stock',
          });
        }
      }
    } catch(_) {}
  }
};
export const deleteProduit = (id) => softDelete('produits', id);

// FACTURES
export const saveFacture = async (data) => {
  if (!data._id) data._id = generateId();
  const db = await getDB();
  await db.put('factures', { ...data, created_at: nowISO() });
};
export const getFactures = async () => {
  const db = await getDB();
  const all = await db.getAll('factures');
  return all.sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
};
export const deleteFacture = async (id) => {
  const db = await getDB();
  await db.delete('factures', id);
};

// FACTURES CREDIT (historique fige, non modifiable)
export const saveFactureCredit = async (data) => {
  if (!data._id) data._id = generateId();
  const db = await getDB();
  await db.put('factures_credit', { ...data, created_at: nowISO() });
};
export const getFacturesCredit = async () => {
  const db = await getDB();
  const all = await db.getAll('factures_credit');
  return all.sort((a,b) => (b.created_at||'').localeCompare(a.created_at||''));
};
export const deleteFactureCredit = async (id) => {
  const db = await getDB();
  await db.delete('factures_credit', id);
};

export const getProduitByNom = async (nom) => {
  const all = await getProduits();
  return all.find(p => p.nom === nom) || null;
};

export const adjustStock = async (nom, delta) => {
  const p = await getProduitByNom(nom);
  if (!p || p.stock == null) return;
  const nouveauStock = Math.max(0, (p.stock || 0) + delta);
  await saveProduit({ ...p, stock: nouveauStock, _skipAppro: true });
};

export const addStock = async (nom, qte) => {
  const p = await getProduitByNom(nom);
  if (!p) return;
  const nouveauStock = (p.stock || 0) + qte;
  await saveProduit({ ...p, stock: nouveauStock, _skipAppro: true });
};

export const getTendances = async (jours = 30) => {
  const ventes = await getVentes();
  const limite = new Date(Date.now() - jours*24*60*60*1000).toISOString().split('T')[0];
  const counts = {};
  for (const v of ventes) {
    if (v.date_vente && v.date_vente >= limite) {
      counts[v.produit] = (counts[v.produit]||0) + (v.quantite||1);
    }
  }
  return counts;
};

// APPROVISIONNEMENTS (historique)
export const getApprovisionnements = async () => {
  const all = await getAll('approvisionnements');
  return all.sort((a,b) => (b.date||'').localeCompare(a.date||'') || (b.created_at||'').localeCompare(a.created_at||''));
};
export const saveApprovisionnement = async (data) => {
  if (!data._id) data._id = generateId();
  await putDoc('approvisionnements', { ...data, created_at: nowISO() });
  // Écriture comptable auto : débit 601 Achats / crédit 571 Caisse
  try {
    const mode = await getSetting('entreprise_mode');
    if ((mode === 'admin' || mode === 'employe') && data.prix_achat && data.quantite) {
      await initPlanComptableDefaut();
      const db = await getDB();
      const plan = await db.getAll('plan_comptable');
      const compteAchats = plan.find(c => c.code === '601');
      const compteCaisse = plan.find(c => c.code === '571');
      if (compteAchats && compteCaisse) {
        const montant = parseFloat(data.prix_achat) * (parseInt(data.quantite) || 1);
        const existing = await db.getAll('ecritures');
        const dejaCree = existing.find(e => e.source_type === 'appro' && e.source_id === data._id);
        if (!dejaCree && montant > 0) {
          await db.put('ecritures', {
            _id: generateId(),
            date: data.date || today(),
            compte_debit: compteAchats._id,
            compte_credit: compteCaisse._id,
            montant,
            libelle: `Appro ${data.produit || ''} x${data.quantite}`,
            source_type: 'appro',
            source_id: data._id,
            created_at: nowISO(),
          });
        }
      }
    }
  } catch(_) {}
};

// VENTES
export const getVentes = async () => {
  const all = await getAll('ventes');
  return all.sort((a,b) => (b.date_vente||'').localeCompare(a.date_vente||''));
};
export const saveVente = async (data) => {
  if (!data._id) data._id = generateId();
  await putDoc('ventes', data);
  // Phase 3 : génération auto écriture comptable si mode entreprise
  try {
    const mode = await getSetting('entreprise_mode');
    if (mode === 'admin' || mode === 'employe') {
      await initPlanComptableDefaut();
      const plan = await (await getDB()).getAll('plan_comptable');
      const compteCaisse = plan.find(c => c.code === '571');
      const compteVentes = plan.find(c => c.code === '701');
      if (compteCaisse && compteVentes && data.prix_vente && !data._ecriture_faite) {
        const db = await getDB();
        const existing = await db.getAll('ecritures');
        const dejaCree = existing.find(e => e.source_type === 'vente' && e.source_id === data._id);
        if (!dejaCree) {
          const qte = parseInt(data.quantite) || 1;
          const pv = parseFloat(data.prix_vente) * qte;
          await db.put('ecritures', {
            _id: generateId(),
            date: data.date_vente || today(),
            compte_debit: compteCaisse._id,
            compte_credit: compteVentes._id,
            montant: pv,
            libelle: `Vente ${data.produit || ''} - ${data.client_id || ''}`,
            source_type: 'vente',
            source_id: data._id,
            created_at: nowISO(),
          });
          // Coût achat enregistré à l'appro uniquement
        }
      }
    }
  } catch(_) {}
};

// PROSPECTS
export const getProspects = async () => {
  const all = await getAll('prospects');
  return all.sort((a,b) => a.nom.localeCompare(b.nom));
};
export const saveProspect = async (data) => {
  if (!data._id) data._id = generateId();
  await putDoc('prospects', data);
};
export const deleteProspect = (id) => softDelete('prospects', id);

// RDVs
export const getRdvs = async () => {
  const all = await getAll('rdvs');
  return all.sort((a,b) => (b.date_rdv||'').localeCompare(a.date_rdv||''));
};
export const saveRdv = async (data) => {
  if (!data._id) data._id = generateId();
  await putDoc('rdvs', data);
};
export const deleteRdv = (id) => softDelete('rdvs', id);

// SEMINAIRES
export const getSeminaires = async () => {
  const all = await getAll('seminaires');
  return all.sort((a,b) => (b.date_event||'').localeCompare(a.date_event||''));
};
export const saveSeminaire = async (data) => {
  if (!data._id) data._id = generateId();
  await putDoc('seminaires', data);
};
export const deleteSeminaire = (id) => softDelete('seminaires', id);

// PARTICIPANTS
export const getParticipants = async (seminaireId) => {
  const all = await getAll('participants');
  return all.filter(d => d.seminaire_id === seminaireId);
};
export const saveParticipant = async (data) => {
  if (!data._id) data._id = generateId();
  await putDoc('participants', data);
};
export const deleteParticipant = (id) => softDelete('participants', id);
export const deleteVente = async (id) => {
  const db = await getDB();
  const vente = await db.get('ventes', id);
  await softDelete('ventes', id);
  if (vente && vente.produit) {
    await adjustStock(vente.produit, vente.quantite || 0);
  }
};

// CREDITS
export const getCredits = async () => {
  const all = await getAll('credits');
  return all.sort((a,b) => (b.date_vente||'').localeCompare(a.date_vente||''));
};
export const saveCredit = async (data) => {
  if (!data._id) data._id = generateId();
  await putDoc('credits', data);
};
export const deleteCredit = (id) => softDelete('credits', id);

export const ajouterVersement = async (creditId, montant) => {
  const db = await getDB();
  const credit = await db.get('credits', creditId);
  if (!credit) return;
  const versements = credit.versements || [];
  versements.push({ date: nowISO(), montant });
  const totalVerse = versements.reduce((s, v) => s + v.montant, 0);
  const montant_restant = Math.max(0, credit.montant_total - totalVerse);
  const statut = montant_restant === 0 ? 'paye' : totalVerse > 0 ? 'partiel' : 'non_paye';
  await db.put('credits', { ...credit, versements, montant_restant, statut, updated_at: nowISO() });
  
  // Ajouter le versement au CA des ventes
  await db.add('ventes', {
    _id: 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    client_id: credit.client_id,
    produit: credit.produit,
    quantite: 1,
    prix_achat: 0,
    prix_vente: montant,
    date_vente: nowISO().slice(0,10),
    methode_paiement: 'Credit',
    notes: 'Versement credit #' + (credit.facture_numero || creditId),
    statut_paiement: 'paye',
    created_at: nowISO()
  });
  
  return { montant_restant, statut };
};

// EXPORT / IMPORT
// Convertit tous les montants existants (produits, ventes, credits, approvisionnements)
// vers une nouvelle devise selon un taux (1 ancienne devise = taux x nouvelle devise)
export const convertirDevise = async (taux) => {
  const t = parseFloat(taux);
  if (!t || t <= 0) throw new Error('Taux de conversion invalide');
  const conv = (n) => Math.round((Number(n) || 0) * t * 100) / 100;

  const produits = await getProduits();
  for (const p of produits) {
    await saveProduit({ ...p, prix_achat: conv(p.prix_achat), prix_vente: conv(p.prix_vente) });
  }

  const ventes = await getVentes();
  for (const v of ventes) {
    await saveVente({ ...v, prix_achat: conv(v.prix_achat), prix_vente: conv(v.prix_vente) });
  }

  const approvisionnements = await getApprovisionnements();
  for (const a of approvisionnements) {
    await saveApprovisionnement({ ...a, prix_achat: conv(a.prix_achat) });
  }

  const credits = await getCredits();
  for (const c of credits) {
    const versements = (c.versements || []).map(v => ({ ...v, montant: conv(v.montant) }));
    await saveCredit({
      ...c,
      prix_achat: conv(c.prix_achat),
      prix_vente: conv(c.prix_vente),
      montant_total: conv(c.montant_total),
      avance: conv(c.avance),
      montant_restant: conv(c.montant_restant),
      versements,
    });
  }
};

export const exportAllData = async () => {
  const db = await getDB();
  const dataTables = STORES.filter(s => s !== 'settings');
  const results = await Promise.all(dataTables.map(s => db.getAll(s)));
  const out = {};
  dataTables.forEach((name, i) => { out[name] = results[i]; });
  out.settings = await db.getAll('settings');
  out.exported_at = nowISO();
  return out;
};

export const importAllData = async (data) => {
  const db = await getDB();
  const tables = ['clients','produits','ventes','prospects','rdvs','seminaires','participants','approvisionnements','credits','factures','factures_credit','plan_comptable','ecritures','charges','employes','bulletins_paie','periodes_comptables','audit_log'];
  for (const key of tables) {
    if (!data[key] || !db.objectStoreNames.contains(key)) continue;
    const tx = db.transaction(key, 'readwrite');
    for (const item of data[key]) {
      if (!item._id) continue;
      const existing = await tx.store.get(item._id);
      if (!existing || (item.updated_at && item.updated_at > (existing.updated_at||''))) {
        await tx.store.put(item);
      }
    }
    await tx.done;
  }
  if (data.settings && Array.isArray(data.settings) && db.objectStoreNames.contains('settings')) {
    const tx = db.transaction('settings', 'readwrite');
    for (const item of data.settings) {
      if (!item._id) continue;
      await tx.store.put(item);
    }
    await tx.done;
  }
};

export const migrerVentesVersEcritures = async () => {
  const deja = await getSetting('migration_ecritures_v2');
  if (deja === 'done') return;
  try {
    await initPlanComptableDefaut();
    const db = await getDB();
    const plan = await db.getAll('plan_comptable');
    const compteCaisse = plan.find(c => c.code === '571');
    const compteVentes = plan.find(c => c.code === '701');
    if (!compteCaisse || !compteVentes) return;
    const ventes = await db.getAll('ventes');
    const ecrituresExist = await db.getAll('ecritures');
    for (const v of ventes) {
      if (!v.prix_vente || v.deleted_at) continue;
      const dejaCree = ecrituresExist.find(e => e.source_type === 'vente' && e.source_id === v._id);
      if (dejaCree) continue;
      const qteM = parseInt(v.quantite) || 1;
      const pvM = parseFloat(v.prix_vente) * qteM;
      const paM = parseFloat(v.prix_achat || 0) * qteM;
      const compteAchatsM = plan.find(c => c.code === '601');
      await db.put('ecritures', {
        _id: generateId(),
        date: v.date_vente || today(),
        compte_debit: compteCaisse._id,
        compte_credit: compteVentes._id,
        montant: pvM,
        libelle: `Vente ${v.produit || ''} - migration`,
        source_type: 'vente',
        source_id: v._id,
        created_at: nowISO(),
      });
      // Coût achat enregistré à l'appro uniquement
    }
    // Dédupliquer les écritures de vente
    const ecrituresFin = await db.getAll('ecritures');
    const vuesIds = new Set();
    for (const e of ecrituresFin) {
      if (e.source_type === 'vente' && e.source_id) {
        if (vuesIds.has(e.source_id)) {
          await db.delete('ecritures', e._id);
        } else {
          vuesIds.add(e.source_id);
        }
      }
    }
    // Migrer aussi les approvisionnements existants
    const appros = await db.getAll('approvisionnements');
    const plan2 = await db.getAll('plan_comptable');
    const compteAchatsM2 = plan2.find(c => c.code === '601');
    const compteCaisseM2 = plan2.find(c => c.code === '571');
    if (compteAchatsM2 && compteCaisseM2) {
      for (const a of appros) {
        if (!a.prix_achat || !a.quantite || a.deleted_at) continue;
        const dejaA = ecrituresFin.find(e => e.source_type === 'appro' && e.source_id === a._id);
        if (dejaA) continue;
        const montantA = parseFloat(a.prix_achat) * (parseInt(a.quantite) || 1);
        if (montantA <= 0) continue;
        await db.put('ecritures', {
          _id: generateId(),
          date: a.date || today(),
          compte_debit: compteAchatsM2._id,
          compte_credit: compteCaisseM2._id,
          montant: montantA,
          libelle: `Appro ${a.produit || ''} x${a.quantite} - migration`,
          source_type: 'appro',
          source_id: a._id,
          created_at: nowISO(),
        });
      }
    }
    // Migrer les produits existants → appros si pas encore fait
    const produits = await db.getAll('produits');
    const approsExist = await db.getAll('approvisionnements');
    for (const p of produits) {
      if (!p.stock || !p.prix_achat || p.deleted_at) continue;
      const dejaAppro = approsExist.find(a => a.source_produit_id === p._id && a.notes === 'Stock initial - migration');
      if (dejaAppro) continue;
      const appro = {
        _id: generateId(),
        produit: p.nom,
        quantite: p.stock,
        prix_achat: p.prix_achat,
        date: p.created_at?.split('T')[0] || today(),
        notes: 'Stock initial - migration',
        source_produit_id: p._id,
        updated_at: nowISO(),
      };
      await db.put('approvisionnements', appro);
      // Écriture comptable
      const planF = await db.getAll('plan_comptable');
      const compteAchatsF = planF.find(c => c.code === '601');
      const compteCaisseF = planF.find(c => c.code === '571');
      if (compteAchatsF && compteCaisseF) {
        const montantF = parseFloat(p.prix_achat) * parseInt(p.stock);
        if (montantF > 0) {
          const ecritExist = ecrituresFin.find(e => e.source_type === 'appro' && e.source_id === appro._id);
          if (!ecritExist) {
            await db.put('ecritures', {
              _id: generateId(),
              date: appro.date,
              compte_debit: compteAchatsF._id,
              compte_credit: compteCaisseF._id,
              montant: montantF,
              libelle: `Stock initial ${p.nom} x${p.stock} - migration`,
              source_type: 'appro',
              source_id: appro._id,
              created_at: nowISO(),
            });
          }
        }
      }
    }
    await setSetting('migration_ecritures_v2', 'done');
  } catch(_) {}
};

export const resetDB = () => { try { _db?.close(); } catch(_) {} _db = null; };

export const clearAllData = async () => {
  const database = await getDB();
  const tables = ['clients','produits','ventes','prospects','rdvs','seminaires','participants','approvisionnements','credits'];
  for (const table of tables) {
    if (!database.objectStoreNames.contains(table)) continue;
    const tx = database.transaction(table, 'readwrite');
    await tx.store.clear();
    await tx.done;
  }
  if (database.objectStoreNames.contains('settings')) {
    const settingsTx = database.transaction('settings', 'readwrite');
    await settingsTx.store.clear();
    await settingsTx.done;
  }
};


// ============================================================
// MODE ENTREPRISE : COMPTABILITE + PAIE (IndexedDB local)
// ============================================================

export const getPlanComptable = async () => {
  const db = await getDB();
  const all = await db.getAll('plan_comptable');
  return all.filter(d => !d.deleted_at).sort((a,b) => a.code.localeCompare(b.code));
};
export const savePlanComptable = async (data) => {
  if (!data._id) data._id = generateId();
  const db = await getDB();
  await db.put('plan_comptable', { ...data, updated_at: nowISO() });
};
export const initPlanComptableDefaut = async () => {
  const existing = await getPlanComptable();
  if (existing.length > 0) return;
  const comptes = [
    { code: '101', libelle: 'Capital', type: 'capitaux' },
    { code: '401', libelle: 'Fournisseurs', type: 'passif' },
    { code: '411', libelle: 'Clients', type: 'actif' },
    { code: '512', libelle: 'Banque', type: 'actif' },
    { code: '571', libelle: 'Caisse', type: 'actif' },
    { code: '601', libelle: 'Achats de marchandises', type: 'charge' },
    { code: '613', libelle: 'Loyer', type: 'charge' },
    { code: '624', libelle: 'Transport', type: 'charge' },
    { code: '641', libelle: 'Salaires', type: 'charge' },
    { code: '645', libelle: 'Charges sociales', type: 'charge' },
    { code: '701', libelle: 'Ventes de marchandises', type: 'produit' },
  ];
  for (const c of comptes) await savePlanComptable(c);
};

export const getEcritures = async (debut = null, fin = null) => {
  const db = await getDB();
  const all = await db.getAll('ecritures');
  return all
    .filter(e => (!debut || e.date >= debut) && (!fin || e.date <= fin))
    .sort((a, b) => b.date.localeCompare(a.date));
};
export const saveEcriture = async (data) => {
  if (!data._id) data._id = generateId();
  const db = await getDB();
  // Vérifier si la date tombe dans une période clôturée
  if (data.date && data.source_type === 'manuelle') {
    const periodes = await db.getAll('periodes_comptables');
    const bloquee = periodes.find(p =>
      p.cloturee && data.date >= p.date_debut && data.date <= p.date_fin
    );
    if (bloquee) throw new Error(`Période clôturée du ${bloquee.date_debut} au ${bloquee.date_fin} — écriture impossible`);
  }
  await db.put('ecritures', { ...data, created_at: data.created_at || nowISO() });
  if (data.source_type === 'manuelle') await addAudit('create', 'ecriture', data._id);
};
export const annulerEcriture = async (id) => {
  const db = await getDB();
  const orig = await db.get('ecritures', id);
  if (!orig) return;
  const annulation = {
    _id: generateId(),
    date: today(),
    compte_debit: orig.compte_credit,
    compte_credit: orig.compte_debit,
    montant: orig.montant,
    libelle: `Annulation: ${orig.libelle}`,
    source_type: 'annulation',
    source_id: orig._id,
    created_at: nowISO(),
  };
  await db.put('ecritures', annulation);
  await db.put('ecritures', { ...orig, annule_par: annulation._id });
  return annulation;
};
export const ecritureDepuisVente = async (vente, compteVenteId, compteCaisseId) => {
  await saveEcriture({
    date: vente.date_vente || today(),
    compte_debit: compteCaisseId,
    compte_credit: compteVenteId,
    montant: vente.prix_vente,
    libelle: `Vente ${vente.produit} - ${vente.client_id || ''}`,
    source_type: 'vente',
    source_id: vente._id,
  });
};

export const getCharges = async (debut = null, fin = null) => {
  const db = await getDB();
  const all = await db.getAll('charges');
  return all
    .filter(c => !c.deleted_at && (!debut || c.date >= debut) && (!fin || c.date <= fin))
    .sort((a, b) => b.date.localeCompare(a.date));
};
export const saveCharge = async (data) => {
  if (!data._id) data._id = generateId();
  const db = await getDB();
  await db.put('charges', { ...data, created_at: data.created_at || nowISO() });
  await addAudit('create', 'charge', data._id);
  if (data.compte_charge_id && data.compte_paiement_id) {
    await saveEcriture({
      date: data.date,
      compte_debit: data.compte_charge_id,
      compte_credit: data.compte_paiement_id,
      montant: data.montant,
      libelle: data.libelle,
      source_type: 'charge',
      source_id: data._id,
    });
  }
};

export const getEmployes = async () => {
  const db = await getDB();
  const all = await db.getAll('employes');
  return all.filter(e => !e.deleted_at && e.actif !== false).sort((a, b) => a.nom.localeCompare(b.nom));
};
export const saveEmploye = async (data) => {
  if (!data._id) data._id = generateId();
  const db = await getDB();
  await db.put('employes', { ...data, updated_at: nowISO() });
};
export const deleteEmploye = async (id) => {
  const db = await getDB();
  const doc = await db.get('employes', id);
  if (doc) await db.put('employes', { ...doc, actif: false, updated_at: nowISO() });
};

export const getBulletins = async (employeId = null) => {
  const db = await getDB();
  const all = await db.getAll('bulletins_paie');
  return all
    .filter(b => !employeId || b.employe_id === employeId)
    .sort((a, b) => b.periode_debut.localeCompare(a.periode_debut));
};
export const saveBulletin = async (data) => {
  if (!data._id) data._id = generateId();
  const db = await getDB();
  const employe = await db.get('employes', data.employe_id);
  if (!employe) throw new Error('Employé introuvable');
  const brut = (parseFloat(employe.salaire_base) || 0) + (parseFloat(data.primes) || 0);
  const net = brut - (parseFloat(data.retenues) || 0);

  // Vérifier double paiement période
  const tousLesBulletins = await db.getAll('bulletins_paie');
  const bulletinsPeriode = tousLesBulletins.filter(b =>
    b.employe_id === data.employe_id &&
    b.periode_debut === data.periode_debut &&
    b.periode_fin === data.periode_fin &&
    b._id !== data._id
  );
  const dejaPaye = bulletinsPeriode.reduce((s, b) => s + (parseFloat(b.salaire_net) || 0), 0);
  const salaireDu = parseFloat(employe.salaire_base) || 0;
  if (dejaPaye >= salaireDu) {
    throw new Error(`${employe.nom} a déjà été payé(e) intégralement pour cette période (${dejaPaye} déjà versé sur ${salaireDu} dû)`);
  }

  // Vérifier solde suffisant
  if (data.compte_paiement_id) {
    const ecritures = await db.getAll('ecritures');
    const soldeCompte = ecritures.reduce((s, e) => {
      if (e.compte_debit === data.compte_paiement_id) return s - (e.montant || 0);
      if (e.compte_credit === data.compte_paiement_id) return s + (e.montant || 0);
      return s;
    }, 0);
    if (soldeCompte <= 0) throw new Error(`Solde insuffisant — compte de paiement vide (solde: ${Math.round(soldeCompte)})`);
    if (soldeCompte < net) throw new Error(`Solde insuffisant — solde disponible: ${Math.round(soldeCompte)}, salaire net: ${Math.round(net)}`);
  }

  const bulletin = { ...data, salaire_brut: brut, salaire_net: net, valide: true, valide_at: nowISO(), created_at: data.created_at || nowISO() };
  await db.put('bulletins_paie', bulletin);

  if (data.compte_salaire_id && data.compte_paiement_id) {
    await saveEcriture({
      date: today(),
      compte_debit: data.compte_salaire_id,
      compte_credit: data.compte_paiement_id,
      montant: net,
      libelle: `Salaire ${employe.nom} - ${data.periode_debut} au ${data.periode_fin}`,
      source_type: 'paie',
      source_id: bulletin._id,
    });
  }
  return bulletin;
};

export const getPeriodes = async () => {
  const db = await getDB();
  const all = await db.getAll('periodes_comptables');
  return all.sort((a, b) => b.date_debut.localeCompare(a.date_debut));
};
export const savePeriode = async (data) => {
  if (!data._id) data._id = generateId();
  const db = await getDB();
  await db.put('periodes_comptables', { ...data, updated_at: nowISO() });
};
export const cloturerPeriode = async (id) => {
  const db = await getDB();
  const p = await db.get('periodes_comptables', id);
  if (!p) return;
  await db.put('periodes_comptables', { ...p, cloturee: true, cloturee_at: nowISO() });
};

export const getBalance = async (debut = null, fin = null) => {
  const plan = await getPlanComptable();
  const ecritures = await getEcritures(debut, fin);
  return plan.map(compte => {
    const debit = ecritures.filter(e => e.compte_debit === compte._id).reduce((s,e) => s+(e.montant||0), 0);
    const credit = ecritures.filter(e => e.compte_credit === compte._id).reduce((s,e) => s+(e.montant||0), 0);
    return { ...compte, total_debit: debit, total_credit: credit, solde: debit - credit };
  });
};
export const getCompteResultat = async (debut = null, fin = null) => {
  const balance = await getBalance(debut, fin);
  const charges = balance.filter(c => c.type === 'charge');
  const produits = balance.filter(c => c.type === 'produit');
  const total_charges = charges.reduce((s,c) => s+c.total_debit, 0);
  const total_produits = produits.reduce((s,c) => s+c.total_credit, 0);
  return { charges, produits, total_charges, total_produits, resultat: total_produits - total_charges };
};
export const getAuditLog = async () => {
  const db = await getDB();
  const all = await db.getAll('audit_log');
  return all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
};

export const addAudit = async (action, entite, entiteId = null) => {
  const db = await getDB();
  await db.put('audit_log', {
    _id: generateId(),
    action,
    entite,
    entite_id: entiteId,
    user_id: await getSetting('username') || 'admin',
    created_at: nowISO(),
  });
};

export const getMasseSalariale = async (debut = null, fin = null) => {
  const bulletins = await getBulletins();
  const filtered = bulletins.filter(b => (!debut || b.periode_debut >= debut) && (!fin || b.periode_fin <= fin));
  return {
    nb_bulletins: filtered.length,
    total_brut: filtered.reduce((s,b) => s+(b.salaire_brut||0), 0),
    total_primes: filtered.reduce((s,b) => s+(b.primes||0), 0),
    total_retenues: filtered.reduce((s,b) => s+(b.retenues||0), 0),
    total_net: filtered.reduce((s,b) => s+(b.salaire_net||0), 0),
  };
};

export const getDeviseSymbolSync = () => {
  try {
    const db = indexedDB.open('beautycrm');
    return 'FC';
  } catch { return 'FC'; }
};
