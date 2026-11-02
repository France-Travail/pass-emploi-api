// En JS (et non en TS) pour être requis aussi par database.js, lu tel quel par le CLI Sequelize.
const SSLMODES_AVEC_TLS = ['require', 'prefer', 'verify-ca', 'verify-full']
const HOTES_LOCAUX = ['localhost', '127.0.0.1']

function exigeTls(databaseUrl) {
  if (!databaseUrl) return false
  const url = new URL(databaseUrl)
  if (HOTES_LOCAUX.includes(url.hostname)) return false
  return SSLMODES_AVEC_TLS.includes(url.searchParams.get('sslmode'))
}

module.exports = { exigeTls }
