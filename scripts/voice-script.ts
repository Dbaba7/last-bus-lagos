// Writes docs/voice-script.md from the mission data, so the recording script can never drift from the subtitles.
// Run with: npm run voice:script
import { readdirSync, writeFileSync } from 'node:fs';
import { MISSIONS, CAMPAIGN, BARKS, type Line, type Mission } from '@lastbus/shared';
const CAST: Record<string, { name: string; design: string; settings: string }> = {
  ADA: { name: 'Inspector Ada Nwosu', design: 'Nigerian woman in her mid-thirties from Lagos, Igbo heritage. Low, steady, controlled voice with a natural Nigerian English accent. Calm under pressure, dry, never theatrical. Speaks quietly, often to herself.', settings: 'Stability 45–55 · Similarity 75 · Style 15–25 · Speaker boost on' },
  CONTROL: { name: 'Control (police dispatcher)', design: 'Nigerian man in his late forties, Lagos police radio dispatcher. Warm baritone, clear Nigerian English accent, measured and professional, with fatigue underneath.', settings: 'Stability 55–65 · Similarity 75 · Style 10 · Speaker boost on. Record clean: the game adds the radio filter.' },
  FEMI: { name: 'Femi Adeyemi (Signal 9 engineer, the witness)', design: 'Yoruba man in his late twenties from Lagos, a telecoms engineer. Lighter tenor, educated Nigerian English accent, frightened and breathless but articulate.', settings: 'Stability 35–45 · Similarity 75 · Style 30 · Speaker boost on' },
  STATIC: { name: 'STATIC crew (enemy call-outs)', design: 'Young Lagos man in his twenties shouting across a street in Nigerian Pidgin English. Rough, urgent, aggressive, slightly breathless. Make two or three variants of this voice for variety.', settings: 'Stability 25–35 · Similarity 70 · Style 40 · Speaker boost on' },
  STATIC_A: { name: 'STATIC member A (Chapter 2, the bridge)', design: 'Lagos man in his thirties, older and in charge of the search. Low, gravelly, impatient, Nigerian Pidgin rhythm. Speaks quietly: they are hunting, not fighting.', settings: 'Stability 40–50 · Similarity 75 · Style 25 · Speaker boost on' },
  STATIC_B: { name: 'STATIC member B (Chapter 2, the bridge)', design: 'Lagos man about twenty, nervous and junior. Higher, quicker voice, Nigerian Pidgin, unsure of what they are doing.', settings: 'Stability 30–40 · Similarity 70 · Style 30 · Speaker boost on' },
  UNIT_SEVEN: { name: 'Unit Seven, also Ada\'s Corporal at the checkpoint', design: 'Nigerian police officer, man in his thirties, Lagos accent. In person at the checkpoint he is relaxed and speaks restrained Pidgin. Strained and frightened on an open radio channel. In his last transmission he is hurt and fading.', settings: 'Stability 30–40 · Similarity 75 · Style 35 · Speaker boost on. Record clean: the game adds the radio filter.' },
  RADIO_A: { name: 'Radio chatter A (officer calling it in)', design: 'Nigerian police officer, man in his forties, fast and panicked, talking over other traffic on an open channel.', settings: 'Stability 25–35 · Similarity 70 · Style 40. Record clean: the game adds the radio filter.' },
  RADIO_B: { name: 'Radio chatter B (officer shouting a warning)', design: 'Nigerian police officer, woman in her thirties, shouting a warning over the radio, desperate and loud.', settings: 'Stability 20–30 · Similarity 70 · Style 45. Record clean: the game adds the radio filter.' },
  SERGEANT: { name: 'The Sergeant (Femi\'s escort, in plain clothes)', design: 'Nigerian man in his forties, Lagos accent. Low, level and economical, a policeman used to not explaining himself. Never unkind, never warm; the listener should not be able to tell whose side he is on.', settings: 'Stability 45–55 · Similarity 75 · Style 10' },
  TRADER: { name: 'The trader on Danfo 247', design: 'Nigerian woman in her fifties, Lagos market trader. Warm, sharp and quick, in natural Nigerian Pidgin and English.', settings: 'Stability 35–45 · Similarity 75 · Style 20' },
  CONDUCTOR: { name: 'The conductor (also the passengers\' asides)', design: 'Young Lagos man in his twenties, a danfo conductor. Loud, sing-song and street-worn, in restrained Pidgin. For the passenger lines, the same voice quieter and amused.', settings: 'Stability 30–40 · Similarity 75 · Style 25' },
  RADIO_PRESENTER: { name: 'FM radio presenter (news and adverts)', design: 'Nigerian radio presenter, polished and bright, broadcast diction. Reads the news briskly and adverts with a smile.', settings: 'Stability 50–60 · Similarity 75 · Style 15' },
  CALLER: { name: 'The anonymous caller', design: 'Nigerian man in his fifties, educated, polished Lagos English with an almost British evenness. Calm, unhurried, slightly amused. Never raises his voice.', settings: 'Stability 60–70 · Similarity 80 · Style 15 · Speaker boost on' }
};
const voiceOf = (line: Line) => line.voice ?? line.speaker.replace(/\s+/g, '_');
const recorded = new Set(readdirSync('apps/client/src/voice').filter(f => /\.(mp3|m4a|wav|ogg)$/.test(f)).map(f => f.replace(/\.[^.]+$/, '')));
type Row = { key: string; line: Line; text: string; where: string; mission: string };
/** Walks a mission as it plays, so the script reads in story order; lines not yet placed in play come last. */
function rows(m: Mission): Row[] {
  const where = new Map<string, string>(), order: string[] = [];
  const add = (key: string, place: string) => { if (!where.has(key)) where.set(key, place); if (!order.includes(key)) order.push(key); };
  const scene = (id: string) => { const s = m.cutscenes[id]; s?.shots.forEach((shot, i) => { if (shot.line) add(shot.line, `cutscene "${id}", shot ${i + 1}`); for (const cue of s.cues ?? []) if (cue.shot === i && 'say' in cue) add(cue.say, `cutscene "${id}", shot ${i + 1} (over the top)`); }); };
  for (const o of m.objectives) for (const [when, actions] of [['starts', o.onStart], ['completes', o.onComplete]] as const) for (const a of actions ?? []) {
    if ('say' in a) for (const key of a.say) add(key, `when "${o.text}" ${when}${a.delay ? ` (+${a.delay}s)` : ''}`);
    if ('cutscene' in a) scene(a.cutscene);
  }
  for (const item of m.interactables) for (const a of item.onUse ?? []) if ('say' in a) for (const key of a.say) add(key, `on "${item.prompt}"`);
  for (const key of Object.keys(m.lines)) add(key, key.startsWith('b') && m.id === 'aftermath' ? 'Third Mainland Bridge (map in development)' : 'in game');
  const out: Row[] = [];
  for (const key of order) { const line = m.lines[key]; if (!line || line.unvoiced) continue; out.push({ key, line, text: line.text, where: where.get(key)!, mission: m.title }); if (line.clean) out.push({ key: `${key}-clean`, line, text: line.clean, where: `${where.get(key)} — clean version, used when Mature language is off`, mission: m.title }); }
  return out;
}
const all: Row[] = [...Object.values(MISSIONS).flatMap(rows), ...Object.values(BARKS).flatMap(pool => Object.entries(pool).map(([key, line]) => ({ key, line, text: line.text, where: 'random enemy call-out in combat', mission: 'Combat' })))];
const direction = (r: Row) => r.line.direction ?? 'Shouted to other crew members mid-fight.';
const chapterOf = (title: string) => CAMPAIGN.chapters.find(c => c.missions.some(id => MISSIONS[id]?.title === title));
const todo = all.filter(r => !recorded.has(r.key)), voices = Object.keys(CAST).filter(id => all.some(r => voiceOf(r.line) === id));
const md = `# Voice script — Dead Air

This file is generated from the mission data by \`npm run voice:script\`. Don't edit it by hand: change the lines in \`packages/shared/src/story/campaign.ts\` (Chapter 01) or \`chapter2.ts\` (Chapter 02) and regenerate.

**${all.length} lines in total, ${all.length - todo.length} recorded, ${todo.length} still to record.** Lines already recorded are marked ✓ and keep their files; only the ✗ lines need new takes.

## How to record and add the files

1. In ElevenLabs, create one voice per character using **Voice Design** (the prompts are below), or pick a library voice that matches. Keep the existing voices for ADA, CONTROL, FEMI and STATIC.
2. Generate each line with **Text to Speech**, pasting the text exactly as written. Use the direction to choose the take; don't paste the direction into the text box.
3. Download as **MP3 (44.1 kHz, 128 kbps or higher)** and name the file exactly after its key, for example \`c10.mp3\` or \`k1-clean.mp3\`.
4. Put the files in \`apps/client/src/voice/\` and restart \`npm run dev\`. They are bundled automatically.

Any line without a file keeps working as a subtitle. Subtitles stay up for the length of the recording, so longer takes are fine. CONTROL, UNIT SEVEN and RADIO lines are filtered in-game to sound like a police radio, so record them clean, without radio effects.

Lines marked **clean** are the alternatives used when *Mature language* is turned off in Settings → Audio. Record them with the same take direction as the original.

Tips: leave about 0.2 s of silence at the start and end. Keep each character's settings the same across all their lines. Read ellipses and em dashes as natural pauses or breaks, not as words.

## Cast

${voices.map(id => `### ${id} — ${CAST[id].name}\n**Voice Design prompt:** ${CAST[id].design}\n\n**Suggested settings:** ${CAST[id].settings}\n`).join('\n')}
## Still to record (${todo.length})

| File | Voice | Text | Plays | Direction |
| --- | --- | --- | --- | --- |
${todo.map(r => `| \`${r.key}.mp3\` | ${voiceOf(r.line)} | ${r.text.replace(/\|/g, '\\|')} | ${r.mission}: ${r.where} | ${direction(r)} |`).join('\n')}

## Lines by character

${voices.map(id => { const lines = all.filter(r => voiceOf(r.line) === id); return `### ${id} (${lines.length} lines, ${lines.filter(r => !recorded.has(r.key)).length} to record)\n\n${lines.map(r => `**${r.key}** ${recorded.has(r.key) ? '✓' : '✗'} — _${direction(r)}_\n\n> ${r.text}\n`).join('\n')}`; }).join('\n')}
## Running order and where each line plays

${[...new Set(all.map(r => r.mission))].map(mission => `### ${mission}${chapterOf(mission) ? ` (Chapter ${chapterOf(mission)!.number})` : ''}\n\n| File | Recorded | Plays | Direction |\n| --- | --- | --- | --- |\n${all.filter(r => r.mission === mission).map(r => `| \`${r.key}.mp3\` | ${recorded.has(r.key) ? '✓' : '✗'} | ${r.where} | ${direction(r)} |`).join('\n')}\n`).join('\n')}
## Paste-ready text per voice (lines still to record)

For ElevenLabs projects or batch tools: one line per row, in the format \`key<TAB>text\`.

${voices.filter(id => todo.some(r => voiceOf(r.line) === id)).map(id => `### ${id}\n\n\`\`\`\n${todo.filter(r => voiceOf(r.line) === id).map(r => `${r.key}\t${r.text}`).join('\n')}\n\`\`\`\n`).join('\n')}`;
writeFileSync('docs/voice-script.md', md);
console.log(`docs/voice-script.md written: ${all.length} lines, ${todo.length} to record across ${voices.length} voices`);
