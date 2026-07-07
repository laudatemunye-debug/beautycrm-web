p = "src/App.jsx"
s = open(p).read()

# 1. Ajouter lazy, Suspense à l'import react existant
old1 = "import { useState, useEffect, useRef } from 'react';"
assert s.count(old1) == 1, f"react import: {s.count(old1)}"
new1 = "import { useState, useEffect, useRef, lazy, Suspense } from 'react';"
s = s.replace(old1, new1)

# 2. Remplacer les imports statiques des pages (sauf LoginPage) par lazy()
old2 = """import { DashboardPage } from './pages/DashboardPage';
import { ClientsPage } from './pages/ClientsPage';
import { ContactsPage } from './pages/ContactsPage';
import { VentesPage } from './pages/VentesPage';
import { ProduitsPage } from './pages/ProduitsPage';
import { CreditsPage } from './pages/CreditsPage';
import { SeminairesPage } from './pages/SeminairesPage';
import { RdvsPage } from './pages/RdvsPage';
import { RelancesPage } from './pages/RelancesPage';
import { RapportsPage } from './pages/RapportsPage';
import { ParametresPage } from './pages/ParametresPage';"""
assert s.count(old2) == 1, f"page imports block: {s.count(old2)}"
new2 = """const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ClientsPage = lazy(() => import('./pages/ClientsPage').then(m => ({ default: m.ClientsPage })));
const ContactsPage = lazy(() => import('./pages/ContactsPage').then(m => ({ default: m.ContactsPage })));
const VentesPage = lazy(() => import('./pages/VentesPage').then(m => ({ default: m.VentesPage })));
const ProduitsPage = lazy(() => import('./pages/ProduitsPage').then(m => ({ default: m.ProduitsPage })));
const CreditsPage = lazy(() => import('./pages/CreditsPage').then(m => ({ default: m.CreditsPage })));
const SeminairesPage = lazy(() => import('./pages/SeminairesPage').then(m => ({ default: m.SeminairesPage })));
const RdvsPage = lazy(() => import('./pages/RdvsPage').then(m => ({ default: m.RdvsPage })));
const RelancesPage = lazy(() => import('./pages/RelancesPage').then(m => ({ default: m.RelancesPage })));
const RapportsPage = lazy(() => import('./pages/RapportsPage').then(m => ({ default: m.RapportsPage })));
const ParametresPage = lazy(() => import('./pages/ParametresPage').then(m => ({ default: m.ParametresPage })));"""
s = s.replace(old2, new2)

# 3. Envelopper renderPage() dans un Suspense
old3 = "        {renderPage()}"
assert s.count(old3) == 1, f"renderPage() call: {s.count(old3)}"
new3 = """        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center', color: '#999' }}>Chargement...</div>}>
          {renderPage()}
        </Suspense>"""
s = s.replace(old3, new3)

open(p, "w").write(s)
print("App.jsx OK")
