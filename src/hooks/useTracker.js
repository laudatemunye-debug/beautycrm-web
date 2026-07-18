const TRACKER_URL = 'https://script.google.com/macros/s/AKfycbwpS9OyXZ9tl3eSsDUec-t9bM7Jk6kdHjcUM-huILQD395nMIKowDSswzySESMkGOKmQw/exec';
const IZI360_URL = 'https://izi360-backend.vercel.app/api/beautycrm/register';
const IZI360_SECRET = 'beautycrm_izi360_2026';

export const trackUser = async (data) => {
  if (!navigator.onLine) return false;

  // Récupérer l'IP
  let ip_address = '';
  try {
    const r = await fetch('https://api.ipify.org?format=json');
    const d = await r.json();
    ip_address = d.ip || '';
  } catch(_) {}

  // Envoi vers Google Sheets
  try {
    const form = new FormData();
    Object.entries({ ...data, version: '2.1' }).forEach(([k, v]) => form.append(k, v || ''));
    await fetch(TRACKER_URL, { method: 'POST', mode: 'no-cors', body: form });
  } catch(_) {}

  // Récupérer le code de parrainage depuis l'URL
  const urlParams = new URLSearchParams(window.location.search)
  const referred_by = urlParams.get('ref') || ''

  // Envoi vers IZI360
  let success = false;
  try {
    const r = await fetch(IZI360_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: IZI360_SECRET,
        nom: data.nom || '',
        email: data.email || '',
        telephone: data.telephone || data.phone || '',
        pays: data.pays || data.country || '',
        ville: data.ville || data.city || '',
        entreprise: data.entreprise || data.company || '',
        role: data.role || '',
        devise: data.devise || data.currency || '',
        version: '2.1',
        plateforme: 'web',
        ip_address,
        referred_by
      })
    })
    success = r.ok;
    const d = await r.json()
    // Sauvegarder le code de parrainage de l'utilisateur
    if (d.user && d.user.referral_code) {
      const activeId = localStorage.getItem('beautycrm_active_account') || 'default';
      localStorage.setItem('beautycrm_referral_code_' + activeId, d.user.referral_code);
      localStorage.setItem('beautycrm_referral_code', d.user.referral_code)
    }
  } catch(_) {
    success = false;
  }
  return success;
};

export const syncIfNeeded = async (getSetting, setSetting) => {
  if (!navigator.onLine) return;
  try {
    const already = await getSetting('izi360_synced');
    if (already === '1') return;

    const nom = await getSetting('username');
    const email = await getSetting('email');
    if (!email) return; // rien à synchroniser

    const telephone = await getSetting('telephone');
    const pays = await getSetting('pays');
    const ville = await getSetting('ville');
    const entreprise = await getSetting('entreprise');
    const role = await getSetting('role');
    const devise = await getSetting('devise');

    const synced = await trackUser({ nom, email, telephone, pays, ville, entreprise, role, devise });
    if (synced) {
      await setSetting('izi360_synced', '1');
    }
  } catch(_) {}
};
