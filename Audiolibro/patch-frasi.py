# Modifica ebook2audiobook: con --session, se in un blocco mancano alcune frasi rifà solo quelle
# (l'originale cancella tutte le frasi del blocco e lo rifà da capo).
p = '/app/lib/core.py'
s = open(p, encoding='utf-8').read()
old = """                        show_alert(session_id, {'type': 'warning', 'msg': f'Block {x} has {len(missing_sentences)} missing audio files, reconverting…'})
                        _reset_chapter_file(block_id)
                        start_sentence = 0"""
new = """                        show_alert(session_id, {'type': 'warning', 'msg': f'Block {x} has {len(missing_sentences)} missing audio files, reconverting only those: {sorted(missing_sentences)}'})
                        os.unlink(chapter_audio_file)
                        start_sentence = len(sentences)"""
assert s.count(old) == 1, 'blocco non trovato'
open(p, 'w', encoding='utf-8').write(s.replace(old, new))
print('core.py modificato')

# Divisione del testo: l'unità è il paragrafo. Un paragrafo si spezza solo se supera 200 caratteri,
# e allora ai punti (frasi intere riunite finché ci stanno); alle virgole solo una frase che da sola è troppo lunga.
s = open(p, encoding='utf-8').read()
old = "        max_chars = int(language_mapping[lang]['max_chars'] / 2)\n\n        # escape all SML tags"
assert s.count(old) == 1, 'max_chars non trovato'
s = s.replace(old, "        max_chars = 200\n\n        # escape all SML tags")
a = s.index("        # PASS 4 — merge very short rows")
b = s.index("        if lang in ['zho', 'jpn', 'kor', 'tha', 'lao', 'mya', 'khm']:\n            result = []", a)
s = s[:a] + """        # PASS 4 — riunisce le frasi intere dello stesso paragrafo finché stanno in max_chars.
        # Un [pause] (a capo doppio) apre un paragrafo nuovo; un [break] (a capo singolo, battute di dialogo) no.
        # Una frase troppo lunga si spezza alle virgole il meno possibile (pezzi riuniti fino a max_chars),
        # e il suo primo pezzo non si attacca alla frase precedente.
        final_list = []
        def finisce(t):
            t = strip_escaped_sml(t).rstrip()
            return bool(t) and t[-1] in punctuation_split_hard_set
        def apre_paragrafo(t):
            k = ord(t[0]) - sml_escape_tag
            return 0 <= k < len(sml_blocks) and 'pause' in sml_blocks[k]
        for cur in last_list:
            cur = cur.strip()
            if not cur:
                continue
            if (final_list and not apre_paragrafo(cur) and (finisce(cur) or not finisce(final_list[-1]))
                    and clean_len(final_list[-1]) + 1 + clean_len(cur) <= max_chars):
                final_list[-1] = final_list[-1].rstrip() + ' ' + cur
            else:
                final_list.append(cur)

""" + s[b:]
open(p, 'w', encoding='utf-8').write(s)
print('divisione frasi modificata')

# Velocità: ebook2audiobook riporta il modello XTTS dalla GPU alla RAM dopo ogni frase e ve lo rimanda alla successiva.
# Con 8 GB di VRAM il modello può restare sulla GPU: stesso calcolo, niente spostamenti.
p = '/app/lib/classes/tts_engines/xtts.py'
s = open(p, encoding='utf-8').read()
old = "                            self.engine.to(devices['CPU']['proc'])\n"
assert s.count(old) == 1, 'spostamento su CPU non trovato'
open(p, 'w', encoding='utf-8').write(s.replace(old, ''))
print('modello XTTS lasciato sulla GPU')

# Rimontaggio: se manca il file del blocco ma le frasi ci sono, il blocco si rimonta dalle frasi
# invece di rifarlo da capo (serve dopo una prova con rifai.sh --prove, che ferma il lavoro prima del montaggio).
p = '/app/lib/core.py'
s = open(p, encoding='utf-8').read()
old = """                    if not os.path.exists(chapter_audio_file):
                        show_alert(session_id, {'type': 'warning', 'msg': f'Block {x} chapter audio missing, reconverting entire block…'})"""
new = """                    if not os.path.exists(chapter_audio_file) and len(_check_block_sentences(block_id, sentences)) == _count_sentences(sentences):
                        show_alert(session_id, {'type': 'warning', 'msg': f'Block {x} chapter audio missing, reconverting entire block…'})"""
assert s.count(old) == 1, 'controllo del blocco mancante non trovato'
s = s.replace(old, new)
old = """                        if not missing_sentences:
                            print(f'Chapter {ch_num} (block {x}) — has all sentences')"""
new = """                        if not missing_sentences and os.path.exists(chapter_audio_file):
                            print(f'Chapter {ch_num} (block {x}) — has all sentences')"""
assert s.count(old) == 1, 'controllo delle frasi complete non trovato'
s = s.replace(old, new)
old = """                        show_alert(session_id, {'type': 'warning', 'msg': f'Block {x} has {len(missing_sentences)} missing audio files, reconverting only those: {sorted(missing_sentences)}'})
                        os.unlink(chapter_audio_file)"""
new = """                        show_alert(session_id, {'type': 'warning', 'msg': f'Block {x} has {len(missing_sentences)} missing audio files, reconverting only those: {sorted(missing_sentences)}'})
                        if os.path.exists(chapter_audio_file):
                            os.unlink(chapter_audio_file)"""
assert s.count(old) == 1, 'cancellazione del blocco non trovata'
s = s.replace(old, new)
old = "                if converted or block_changed or missing_sentences:\n"
new = "                if converted or block_changed or missing_sentences or not os.path.exists(os.path.join(session['chapters_dir'], f'{block_id}.{default_audio_proc_format}')):\n"
assert s.count(old) == 1, 'condizione del montaggio non trovata'
open(p, 'w', encoding='utf-8').write(s.replace(old, new))
print('rimontaggio dalle frasi aggiunto')
