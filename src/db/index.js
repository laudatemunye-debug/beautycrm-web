import { openDB } from 'idb';

const DB_NAME = 'beautycrm';
const DB_VERSION = 7;
const STORES = ['clients','produits','ventes','prospects','rdvs','seminaires','participants','settings','approvisionnements','credits','factures','factures_credit'];

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
  if (!data._id) data._id = generateId();
  await putDoc('produits', data);
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
  await saveProduit({ ...p, stock: nouveauStock });
};

export const addStock = async (nom, qte) => {
  const p = await getProduitByNom(nom);
  if (!p) return;
  const nouveauStock = (p.stock || 0) + qte;
  await saveProduit({ ...p, stock: nouveauStock });
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
};

// VENTES
export const getVentes = async () => {
  const all = await getAll('ventes');
  return all.sort((a,b) => (b.date_vente||'').localeCompare(a.date_vente||''));
};
export const saveVente = async (data) => {
  if (!data._id) data._id = generateId();
  await putDoc('ventes', data);
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
  const tables = ['clients','produits','ventes','prospects','rdvs','seminaires','participants','approvisionnements','credits','factures','factures_credit'];
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

export const getDeviseSymbolSync = () => {
  try {
    const db = indexedDB.open('beautycrm');
    return 'FC';
  } catch { return 'FC'; }
};
