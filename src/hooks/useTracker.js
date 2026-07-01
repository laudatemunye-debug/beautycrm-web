const TRACKER_URL = 'https://script.google.com/macros/s/AKfycbwpS9OyXZ9tl3eSsDUec-t9bM7Jk6kdHjcUM-huILQD395nMIKowDSswzySESMkGOKmQw/exec';
const IZI360_URL = 'https://izi360-backend.vercel.app/api/beautycrm/register';
const IZI360_SECRET = 'beautycrm_izi360_2026';

export const trackUser = async (data) => {
  if (!navigator.onLine) return;

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
    const d = await r.json()
    // Sauvegarder le code de parrainage de l'utilisateur
    if (d.user && d.user.referral_code) {
      localStorage.setItem('beautycrm_referral_code', d.user.referral_code)
    }
  } catch(_) {}
};
