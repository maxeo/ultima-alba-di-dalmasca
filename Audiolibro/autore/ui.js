// La modalità autore si accende solo quando il lettore è aperto in scrittura; il resto arriva a moduli.
if (new URLSearchParams(location.search).get('write') === 'true') {
  import('/__autore/ui/avvio.mjs').catch(e => console.error('Modalità autore non caricata.', e));
}
