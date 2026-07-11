p = "src/routes/beautycrmEntreprise.js"
s = open(p).read()

old = "module.exports = router"
assert s.count(old) == 1, f"module.exports: {s.count(old)}"

new_routes = '''
// === Suspendre / supprimer un compte PERSONNEL (hors mode entreprise) ===
router.post('/admin/suspend-personal', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Acces refuse' })
    const { email, motif } = req.body
    if (!email) return res.status(400).json({ message: 'email requis' })
    await pool.query('UPDATE beautycrm_users SET suspendu=true, motif_suspension=$1, suspended_at=NOW() WHERE email=$2', [motif || '', email])
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

router.post('/admin/unsuspend-personal', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Acces refuse' })
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'email requis' })
    await pool.query('UPDATE beautycrm_users SET suspendu=false, motif_suspension=NULL, suspended_at=NULL WHERE email=$1', [email])
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Marque le compte comme supprime (soft) - la purge reelle (Drive + BDD) se fait
// quand l'utilisateur clique "Fermer" via /purge-personal-supprime
router.post('/admin/delete-personal', auth, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ message: 'Acces refuse' })
    const { email, motif } = req.body
    if (!email) return res.status(400).json({ message: 'email requis' })
    const result = await pool.query('UPDATE beautycrm_users SET supprime=true, motif_suppression=$1, deleted_at=NOW() WHERE email=$2 RETURNING id', [motif || '', email])
    if (result.rows.length === 0) return res.status(404).json({ message: 'Utilisateur introuvable' })
    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Statut consulte par l'app au demarrage pour le compte personnel
router.post('/status-personal', async (req, res) => {
  try {
    const { secret, email } = req.body
    if (secret !== BEAUTYCRM_SECRET) return res.status(401).json({ message: 'Non autorise' })
    if (!email) return res.status(400).json({ message: 'email requis' })

    const result = await pool.query('SELECT suspendu, motif_suspension, supprime, motif_suppression FROM beautycrm_users WHERE email=$1', [email])
    const u = result.rows[0]
    if (!u) return res.json({ blocked: false })

    if (u.supprime) {
      return res.json({
        blocked: true,
        reason: 'supprimee',
        motif: u.motif_suppression || null,
        contact: { type: 'support', email: SUPPORT_EMAIL, whatsapp: SUPPORT_WHATSAPP },
      })
    }

    if (u.suspendu) {
      return res.json({
        blocked: true,
        reason: 'suspendue',
        motif: u.motif_suspension || null,
        contact: { type: 'support', email: SUPPORT_EMAIL, whatsapp: SUPPORT_WHATSAPP },
      })
    }

    return res.json({ blocked: false })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

// Purge definitive du compte personnel : appelee quand l'utilisateur clique "Fermer"
// sur l'ecran "compte supprime". Revoque le token Drive personnel puis supprime la ligne BDD.
router.post('/purge-personal-supprime', async (req, res) => {
  try {
    const { secret, email } = req.body
    if (secret !== BEAUTYCRM_SECRET) return res.status(401).json({ message: 'Non autorise' })
    if (!email) return res.status(400).json({ message: 'email requis' })

    const row = await pool.query('SELECT supprime FROM beautycrm_users WHERE email=$1', [email])
    const u = row.rows[0]
    if (!u) return res.json({ success: true }) // deja purge
    if (!u.supprime) return res.status(400).json({ message: 'Ce compte n est pas marque comme supprime' })

    const driveRow = await pool.query('SELECT refresh_token_encrypted FROM beautycrm_users_drive WHERE email=$1', [email])
    if (driveRow.rows.length > 0) {
      try {
        const refreshToken = decrypt(driveRow.rows[0].refresh_token_encrypted)
        await revokeToken(refreshToken)
      } catch (e) {
        console.error('Erreur revocation Drive personnelle (on continue quand meme):', e.message)
      }
      await pool.query('DELETE FROM beautycrm_users_drive WHERE email=$1', [email])
    }

    await pool.query('DELETE FROM beautycrm_users WHERE email=$1', [email])

    res.json({ success: true })
  } catch (e) {
    console.error(e)
    res.status(500).json({ message: 'Erreur serveur' })
  }
})

module.exports = router'''

s = s.replace(old, new_routes)
open(p, "w").write(s)
print("beautycrmEntreprise.js OK")
