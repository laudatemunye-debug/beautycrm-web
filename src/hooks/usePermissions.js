import { useState, useEffect } from 'react';
import { getSetting } from '../db/index';

export const usePermissions = () => {
  const [role, setRole] = useState(null);
  const [mode, setMode] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      getSetting('entreprise_role'),
      getSetting('entreprise_mode'),
    ]).then(([r, m]) => {
      setRole(r || null);
      setMode(m || null);
      setLoaded(true);
    });
  }, []);

  const isAdmin       = role === 'admin';
  const isVendeur     = role === 'vendeur';
  const isGestionnaire = role === 'gestionnaire';
  const isEntreprise  = !!mode;

  // Si pas de mode entreprise, tout est permis (compte solo)
  const can = (action) => {
    if (!isEntreprise) return true;
    const rules = {
      // Clients
      addClient:    ['admin', 'vendeur', 'gestionnaire'].includes(role),
      editClient:   ['admin', 'vendeur', 'gestionnaire'].includes(role),
      deleteClient: ['admin'].includes(role),
      viewClients:  ['admin', 'vendeur', 'gestionnaire'].includes(role),
      // Ventes
      addVente:     ['admin', 'vendeur', 'gestionnaire'].includes(role),
      editVente:    ['admin', 'gestionnaire'].includes(role),
      deleteVente:  ['admin'].includes(role),
      viewAllVentes:['admin', 'gestionnaire'].includes(role),
      viewOwnVentes:['admin', 'vendeur', 'gestionnaire'].includes(role),
      // Produits
      addProduit:   ['admin', 'gestionnaire'].includes(role),
      editProduit:  ['admin', 'gestionnaire'].includes(role),
      deleteProduit:['admin'].includes(role),
      // Rapports
      viewRapports: ['admin', 'gestionnaire'].includes(role),
      // Parametres
      accessParams: ['admin'].includes(role),
      // Contacts/Prospects
      addContact:   ['admin', 'vendeur', 'gestionnaire'].includes(role),
      deleteContact:['admin'].includes(role),
    };
    return rules[action] !== undefined ? rules[action] : true;
  };

  return { role, mode, loaded, isAdmin, isVendeur, isGestionnaire, isEntreprise, can };
};
