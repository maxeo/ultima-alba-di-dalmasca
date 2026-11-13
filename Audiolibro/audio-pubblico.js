const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const REPO = 'maxeo/ultima-alba-di-dalmasca';
const RELEASE = 'audio-corrente';

function audioPubblico(sito, indice, { aggiorna = false, riserva = sito } = {}) {
  return indice.capitoli.filter(c => c.durata > 0).map(c => {
    if (!Number.isInteger(c.n) || c.n < 1 || c.n > 999) throw new Error('Numero di capitolo non valido.');
    const nome = `${String(c.n).padStart(3, '0')}.mp3`;
    const locale = path.join(sito, 'audio', nome);
    const file = fs.existsSync(locale) ? locale : path.join(riserva, 'audio', nome);
    const dati = fs.readFileSync(file);
    const sha256 = createHash('sha256').update(dati).digest('hex');
    if (!dati.length || dati.length !== c.byte || (!aggiorna && sha256 !== c.audioSha256)) {
      throw new Error(`${nome}: l’MP3 non corrisponde all’indice pubblico.`);
    }
    if (aggiorna) c.audioSha256 = sha256;
    return { nome, file, sha256 };
  });
}

function pubblicaAudio(root, audio) {
  const gh = (...args) => execFileSync('gh', [...args, '-R', REPO], { cwd: root, encoding: 'utf8' });
  const release = JSON.parse(execFileSync('gh', ['api', `repos/${REPO}/releases/tags/${RELEASE}`], {
    cwd: root, encoding: 'utf8',
  }));
  if (release.draft || release.immutable) throw new Error('La release audio-corrente deve essere pubblica e modificabile.');
  const presenti = new Map(release.assets.map(a => [a.name, a.digest]));
  const cambiati = audio.filter(a => presenti.get(a.nome) !== `sha256:${a.sha256}`);
  if (cambiati.length) gh('release', 'upload', RELEASE, ...cambiati.map(a => a.file), '--clobber');
}

if (require.main === module) {
  const sito = path.resolve(process.argv[2] || 'docs');
  const indice = JSON.parse(fs.readFileSync(path.join(sito, 'capitoli.json'), 'utf8'));
  const aggiorna = process.argv.includes('--aggiorna-indice');
  audioPubblico(sito, indice, { aggiorna });
  if (aggiorna) fs.writeFileSync(path.join(sito, 'capitoli.json'), JSON.stringify(indice));
}

module.exports = { audioPubblico, pubblicaAudio };
