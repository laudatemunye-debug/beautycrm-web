import { useState, useEffect, useCallback } from 'react';
import { C, CANAUX } from '../theme';
import { getClients, saveClient, deleteClient, getVentes, saveVente, getProduits, adjustStock, today, nowISO, generateId } from '../db/index';
import { Card, SearchBar, SectionTitle, PrimaryBtn, GhostBtn, FieldInput, PickerSelect, Modal, FormFooter, Avatar, Badge, Divider, fmtMoney, fmtDate } from '../components/UI';
import { useDevise } from '../hooks/useDevise';

const ClientForm = ({ client, onClose, onSaved }) => {
  const [form, setForm] = useState({
    nom: client?.nom || '',
    telephone: client?.telephone || '',
    email: client?.email || '',
    canal: client?.canal || CANAUX[0],
    ville: client?.ville || '',
    notes: client?.notes || '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setError('');
    if (!form.nom.trim()) { setError('Le nom est obligatoire.'); return; }
    setLoading(true);
    try {
      const all = await getClients();
      if (!client) {
        const dupNom = all.find(c => c.nom.toLowerCase() === form.nom.toLowerCase().trim());
        if (dupNom) { setError('Un client avec ce nom existe deja.'); setLoading(false); return; }
        if (form.telephone) {
          const dupTel = all.find(c => c.telephone === form.telephone.trim());
          if (dupTel) { setError('Un client avec ce numero existe deja.'); setLoading(false); return; }
        }
      }
      await saveClient({ ...form, _id: client?._id });
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Modal visible onClose={onClose} title={client ? 'Modifier client' : 'Nouveau client'}>
      <div style={{ padding: 16 }}>
        {error && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setError('')}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 24, maxWidth: 320, width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⛔</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text_primary, marginBottom: 16 }}>{error}</div>
              <button onClick={() => setError('')} style={{ backgroundColor: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", marginBottom: 14 }}>
        <div style={{ flex: 1, marginBottom: 0 }}><FieldInput label="Nom *" value={form.nom} onChange={v => setForm(f=>({...f,nom:v}))} placeholder="Nom du contact" autoComplete="name" /></div>
        <button onClick={async () => {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
          if (isIOS) {
            // iOS: utiliser input file vcf
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.vcf,text/vcard';
            input.onchange = async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const text = await file.text();
              const nom = (text.match(/FN:(.+)/)?.[1] || text.match(/N:([^;]+)/)?.[1] || '').trim();
              const tel = (text.match(/TEL[^:]*:(.+)/)?.[1] || '').replace(/s/g,'').trim();
              const email = (text.match(/EMAIL[^:]*:(.+)/)?.[1] || '').trim();
              if (nom || tel) setForm(f => ({ ...f, nom: nom || f.nom, telephone: tel || f.telephone, email: email || f.email }));
            };
            input.click();
            return;
          }
          if (!navigator.contacts) {
            alert("Utilisez Chrome sur Android pour importer vos contacts.");
            return;
          }
          try {
            const contacts = await navigator.contacts.select(["name","tel","email"], { multiple: false });
            if (contacts.length > 0) {
              const c = contacts[0];
              setForm(f => ({ ...f, nom: c.name?.[0] || f.nom, telephone: c.tel?.[0] || f.telephone, email: c.email?.[0] || f.email }));
            }
          } catch(e) { alert("Impossible d'importer : " + e.message); }
        }} style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#3D5AFE", border: "none", cursor: "pointer", fontSize: 20, color: "#fff", flexShrink: 0, marginBottom: 14 }}>👤</button>
      </div>
        <FieldInput label="Telephone (WhatsApp)" value={form.telephone} onChange={v => setForm(f=>({...f,telephone:v}))} type="tel" />
        <FieldInput label="Email" value={form.email} onChange={v => setForm(f=>({...f,email:v}))} type="email" />
        <PickerSelect label="Canal d'acquisition" value={form.canal} onChange={v => setForm(f=>({...f,canal:v}))} options={CANAUX} />
        <FieldInput label="Ville / Quartier" value={form.ville} onChange={v => setForm(f=>({...f,ville:v}))} />
        <FieldInput label="Notes" value={form.notes} onChange={v => setForm(f=>({...f,notes:v}))} multiline />
      </div>
      <FormFooter onSave={save} onClose={onClose} loading={loading} />
    </Modal>
  );
};

const VenteForm = ({ clientId, clientNom, onClose, onSaved }) => {
  const [produits, setProduits] = useState([]);
  const [form, setForm] = useState({ produit: '', prix_achat: '', prix_vente: '', quantite: '1', methode: 'Cash', notes: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { getProduits().then(setProduits); }, []);

  const onProduitChange = (nom) => {
    const p = produits.find(x => x.nom === nom);
    setForm(f => ({
      ...f, produit: nom,
      prix_achat: p?.prix_achat ? String(p.prix_achat) : f.prix_achat,
      prix_vente: p?.prix_vente ? String(p.prix_vente) : f.prix_vente,
    }));
  };

  const save = async () => {
    setError('');
    if (!form.produit.trim()) { setError('Choisissez un produit.'); return; }
    const pv = parseFloat(form.prix_vente);
    if (!pv || pv <= 0) { setError('Prix de vente invalide.'); return; }
    const qteDemandee = parseInt(form.quantite) || 1;
    const produitSel = produits.find(p => p.nom === form.produit);
    if (produitSel && produitSel.stock != null && qteDemandee > produitSel.stock) {
      setError(`Stock insuffisant. Disponible : ${produitSel.stock}.`);
      return;
    }
    setLoading(true);
    try {
      const qte = parseInt(form.quantite) || 1;
      await saveVente({
        client_id: clientId,
        produit: form.produit,
        quantite: qte,
        prix_achat: parseFloat(form.prix_achat) || 0,
        prix_vente: pv,
        date_vente: today(),
        methode_paiement: form.methode,
        notes: form.notes,
      });
      await adjustStock(form.produit, -qte);
      onSaved();
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const produitOptions = produits.map(p => p.nom);

  return (
    <Modal visible onClose={onClose} title={`Vente — ${clientNom}`}>
      <div style={{ padding: 16 }}>
        {error && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }} onClick={() => setError('')}>
            <div onClick={e => e.stopPropagation()} style={{ backgroundColor: '#fff', borderRadius: 14, padding: 24, maxWidth: 320, width: '90%', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⛔</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: C.text_primary, marginBottom: 16 }}>{error}</div>
              <button onClick={() => setError('')} style={{ backgroundColor: C.accent, color: '#fff', border: 'none', borderRadius: 10, padding: '10px 28px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>OK</button>
            </div>
          </div>
        )}
        <PickerSelect label="Produit *" value={form.produit} onChange={onProduitChange} options={['', ...produitOptions]} />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Prix achat" value={form.prix_achat} onChange={v => setForm(f=>({...f,prix_achat:v}))} type="number" /></div>
          <div style={{ flex: 1 }}><FieldInput label="Prix vente *" value={form.prix_vente} onChange={v => setForm(f=>({...f,prix_vente:v}))} type="number" /></div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><FieldInput label="Quantite" value={form.quantite} onChange={v => setForm(f=>({...f,quantite:v}))} type="number" /></div>
          <div style={{ flex: 1 }}>
            <PickerSelect label="Paiement" value={form.methode} onChange={v => setForm(f=>({...f,methode:v}))} options={['Cash','Mobile Money','Virement','Credit','Autre']} />
          </div>
        </div>
        {form.prix_vente && (
          <div style={{ backgroundColor: C.success+'15', borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: C.text_secondary }}>Total</div>
            <div style={{ fontWeight: 800, fontSize: 18, color: C.success }}>
              {fmtMoney((parseFloat(form.prix_vente)||0) * (parseInt(form.quantite)||1))}
            </div>
          </div>
        )}
      </div>
      <FormFooter onSave={save} onClose={onClose} loading={loading} saveColor={C.success} saveLabel="Enregistrer la vente" />
    </Modal>
  );
};

const ClientDetail = ({ client, onBack, onEdit }) => {
  const [ventes, setVentes] = useState([]);
  const [showVente, setShowVente] = useState(false);

  const load = useCallback(async () => {
    const all = await getVentes();
    setVentes(all.filter(v => v.client_id === client._id));
  }, [client._id]);

  useEffect(() => { load(); }, [load]);

  const ca = ventes.reduce((s,v) => s + v.prix_vente * v.quantite, 0);
  const marge = ventes.reduce((s,v) => s + (v.prix_vente - v.prix_achat) * v.quantite, 0);

  const sendWhatsApp = () => {
    if (!client.telephone) return;
    const tel = client.telephone.replace(/[\s+\-]/g, '');
    window.open(`https://wa.me/${tel}`, '_blank');
  };

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span onClick={onBack} style={{ fontSize: 24, cursor: 'pointer', color: C.text_primary }}>‹</span>
        <span style={{ fontWeight: 800, fontSize: 18, color: C.text_primary, flex: 1 }}>{client.nom}</span>
        <button onClick={onEdit} style={{ backgroundColor: C.accent, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 700, cursor: 'pointer' }}>✏ Modifier</button>
      </div>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 4 }}>
          <Avatar nom={client.nom} size={52} color={C.accent} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: C.text_primary }}>{client.nom}</div>
            {client.telephone && <div style={{ fontSize: 13, color: C.text_secondary, marginTop: 2 }}>📱 {client.telephone}</div>}
            {client.email && <div style={{ fontSize: 13, color: C.text_secondary, marginTop: 2 }}>✉️ {client.email}</div>}
            {client.ville && <div style={{ fontSize: 13, color: C.text_secondary, marginTop: 2 }}>📍 {client.ville}</div>}
            <div style={{ marginTop: 6 }}><Badge label={client.canal} color={C.accent} /></div>
          </div>
        </div>
        {client.telephone && (
          <button onClick={sendWhatsApp} style={{
            marginTop: 12, width: '100%', backgroundColor: C.tag_whatsapp,
            color: '#fff', border: 'none', borderRadius: 10, padding: '10px 0',
            fontWeight: 700, cursor: 'pointer', fontSize: 13,
          }}>
            💬 Contacter sur WhatsApp
          </button>
        )}
      </Card>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <Card style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: C.text_secondary }}>CA total</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.accent }}>{fmtMoney(ca)}</div>
        </Card>
        <Card style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: C.text_secondary }}>Marge</div>
          <div style={{ fontWeight: 800, fontSize: 16, color: C.success }}>{fmtMoney(marge)}</div>
        </Card>
      </div>

      <PrimaryBtn label="+ Enregistrer une vente" onClick={() => setShowVente(true)} color={C.success} style={{ marginBottom: 14 }} />

      <SectionTitle title={`${ventes.length} achat(s)`} />
      <Card>
        {ventes.length === 0
          ? <div style={{ textAlign: 'center', padding: 30, color: C.text_secondary, fontSize: 13 }}>Aucun achat enregistre.</div>
          : ventes.map((v, i) => (
            <div key={v._id}>
              <div style={{ display: 'flex', alignItems: 'center', padding: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: C.text_primary }}>{v.produit} ×{v.quantite}</div>
                  <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>{fmtDate(v.date_vente)} · {v.methode_paiement}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 14, color: C.success }}>{fmtMoney(v.prix_vente * v.quantite)}</div>
              </div>
              {i < ventes.length - 1 && <Divider />}
            </div>
          ))
        }
      </Card>

      {showVente && (
        <VenteForm clientId={client._id} clientNom={client.nom} onClose={() => setShowVente(false)} onSaved={() => { setShowVente(false); load(); }} />
      )}
    </div>
  );
};

export const ClientsPage = () => {
  const [clients, setClients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getClients();
    setClients(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const del = (client) => {
    if (!window.confirm(`Supprimer ${client.nom} ?`)) return;
    deleteClient(client._id).then(load);
  };

  const filtered = clients.filter(c =>
    c.nom.toLowerCase().includes(search.toLowerCase()) ||
    (c.telephone || '').includes(search) ||
    (c.ville || '').toLowerCase().includes(search.toLowerCase())
  );

  if (selectedClient) return (
    <ClientDetail
      client={selectedClient}
      onBack={() => { setSelectedClient(null); load(); }}
      onEdit={() => { setEditClient(selectedClient); setShowForm(true); }}
    />
  );

  return (
    <div style={{ padding: '14px', paddingBottom: 80, width: '100%', boxSizing: 'border-box' }}>
      <SearchBar value={search} onChange={setSearch} placeholder="Chercher un client..." />
      <PrimaryBtn label="+ Nouveau client" onClick={() => { setEditClient(null); setShowForm(true); }} style={{ marginBottom: 14 }} />
      <SectionTitle title={`${filtered.length} client(s)`} />
      {loading
        ? <div style={{ textAlign: 'center', padding: 40, color: C.text_secondary }}>Chargement...</div>
        : filtered.length === 0
          ? <div style={{ textAlign:'center', padding:40 }}>
              <div style={{ fontSize:40, marginBottom:10 }}>👥</div>
              <div style={{ fontSize:14, color:C.text_secondary, marginBottom:16 }}>Aucun client pour l'instant.</div>
              <button onClick={() => setShowForm(true)} style={{ backgroundColor:C.accent, color:'#fff', border:'none', borderRadius:12, padding:'12px 24px', fontWeight:700, fontSize:14, cursor:'pointer' }}>+ Ajouter un client</button>
            </div>
          : filtered.map((c, i) => (
            <div key={c._id} style={{ marginBottom: 10 }}>
              <Card onClick={() => setSelectedClient(c)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Avatar nom={c.nom} size={44} color={C.accent} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.text_primary }}>{c.nom}</div>
                    <div style={{ fontSize: 11, color: C.text_secondary, marginTop: 2 }}>
                      {c.telephone || 'Pas de numero'} {c.ville ? `· ${c.ville}` : ''}
                    </div>
                    <div style={{ marginTop: 4 }}><Badge label={c.canal} color={C.accent} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); setEditClient(c); setShowForm(true); }} style={{ backgroundColor: C.accent, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>✏</button>
                    <button onClick={e => { e.stopPropagation(); del(c); }} style={{ backgroundColor: C.danger, border: 'none', borderRadius: 7, width: 28, height: 28, cursor: 'pointer', color: '#fff' }}>🗑</button>
                  </div>
                </div>
              </Card>
            </div>
          ))
      }
      {showForm && (
        <ClientForm
          client={editClient}
          onClose={() => { setShowForm(false); setEditClient(null); }}
          onSaved={() => { setShowForm(false); setEditClient(null); load(); if (editClient && selectedClient?._id === editClient._id) setSelectedClient(editClient); }}
        />
      )}
    </div>
  );
};
