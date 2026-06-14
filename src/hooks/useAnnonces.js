import { useState, useEffect } from 'react';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRK5sW87U8ojy3lakysCXx599CBHTzTK9gu4T1ehbafWAT5yHx86Af7nmmMEaPSUs5mL2AMq3MzJ6dv/pub?output=csv';

const parseCSV = (text) => {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,''));
  return lines.slice(1).map(line => {
    const values = line.match(/(".*?"|[^,]+|(?<=,)(?=,)|^(?=,)|(?<=,)$)/g) || [];
    const obj = {};
    headers.forEach((h, i) => obj[h] = (values[i] || '').replace(/"/g,'').trim());
    return obj;
  }).filter(r => r.titre);
};

export const useAnnonces = () => {
  const [annonce, setAnnonce] = useState(null);

  useEffect(() => {
    if (!navigator.onLine) return;
    const lastDismissed = sessionStorage.getItem('annonce_dismissed');
    fetch(CSV_URL)
      .then(r => r.text())
      .then(text => {
        const rows = parseCSV(text);
        const today = new Date().toISOString().split('T')[0];
        const active = rows.find(r => {
          if (!r.titre) return false;
          if (r.date && r.date < today) return false;
          if (lastDismissed === r.titre) return false;
          return true;
        });
        if (active) setAnnonce(active);
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    if (annonce) sessionStorage.setItem('annonce_dismissed', annonce.titre);
    setAnnonce(null);
  };

  return { annonce, dismiss };
};
