# Voice script — Dead Air

This file is generated from the mission data by `npm run voice:script`. Don't edit it by hand: change the lines in `packages/shared/src/story/campaign.ts` (Chapter 01) or `chapter2.ts` (Chapter 02) and regenerate.

**134 lines in total, 50 recorded, 84 still to record.** Lines already recorded are marked ✓ and keep their files; only the ✗ lines need new takes.

## How to record and add the files

1. In ElevenLabs, create one voice per character using **Voice Design** (the prompts are below), or pick a library voice that matches. Keep the existing voices for ADA, CONTROL, FEMI and STATIC.
2. Generate each line with **Text to Speech**, pasting the text exactly as written. Use the direction to choose the take; don't paste the direction into the text box.
3. Download as **MP3 (44.1 kHz, 128 kbps or higher)** and name the file exactly after its key, for example `c10.mp3` or `k1-clean.mp3`.
4. Put the files in `apps/client/src/voice/` and restart `npm run dev`. They are bundled automatically.

Any line without a file keeps working as a subtitle. Subtitles stay up for the length of the recording, so longer takes are fine. CONTROL, UNIT SEVEN and RADIO lines are filtered in-game to sound like a police radio, so record them clean, without radio effects.

Lines marked **clean** are the alternatives used when *Mature language* is turned off in Settings → Audio. Record them with the same take direction as the original.

Tips: leave about 0.2 s of silence at the start and end. Keep each character's settings the same across all their lines. Read ellipses and em dashes as natural pauses or breaks, not as words.

## Cast

### ADA — Inspector Ada Nwosu
**Voice Design prompt:** Nigerian woman in her mid-thirties from Lagos, Igbo heritage. Low, steady, controlled voice with a natural Nigerian English accent. Calm under pressure, dry, never theatrical. Speaks quietly, often to herself.

**Suggested settings:** Stability 45–55 · Similarity 75 · Style 15–25 · Speaker boost on

### CONTROL — Control (police dispatcher)
**Voice Design prompt:** Nigerian man in his late forties, Lagos police radio dispatcher. Warm baritone, clear Nigerian English accent, measured and professional, with fatigue underneath.

**Suggested settings:** Stability 55–65 · Similarity 75 · Style 10 · Speaker boost on. Record clean: the game adds the radio filter.

### FEMI — Femi Adeyemi (Signal 9 engineer, the witness)
**Voice Design prompt:** Yoruba man in his late twenties from Lagos, a telecoms engineer. Lighter tenor, educated Nigerian English accent, frightened and breathless but articulate.

**Suggested settings:** Stability 35–45 · Similarity 75 · Style 30 · Speaker boost on

### STATIC — STATIC crew (enemy call-outs)
**Voice Design prompt:** Young Lagos man in his twenties shouting across a street in Nigerian Pidgin English. Rough, urgent, aggressive, slightly breathless. Make two or three variants of this voice for variety.

**Suggested settings:** Stability 25–35 · Similarity 70 · Style 40 · Speaker boost on

### STATIC_A — STATIC member A (Chapter 2, the bridge)
**Voice Design prompt:** Lagos man in his thirties, older and in charge of the search. Low, gravelly, impatient, Nigerian Pidgin rhythm. Speaks quietly: they are hunting, not fighting.

**Suggested settings:** Stability 40–50 · Similarity 75 · Style 25 · Speaker boost on

### STATIC_B — STATIC member B (Chapter 2, the bridge)
**Voice Design prompt:** Lagos man about twenty, nervous and junior. Higher, quicker voice, Nigerian Pidgin, unsure of what they are doing.

**Suggested settings:** Stability 30–40 · Similarity 70 · Style 30 · Speaker boost on

### UNIT_SEVEN — Unit Seven, also Ada's Corporal at the checkpoint
**Voice Design prompt:** Nigerian police officer, man in his thirties, Lagos accent. In person at the checkpoint he is relaxed and speaks restrained Pidgin. Strained and frightened on an open radio channel. In his last transmission he is hurt and fading.

**Suggested settings:** Stability 30–40 · Similarity 75 · Style 35 · Speaker boost on. Record clean: the game adds the radio filter.

### RADIO_A — Radio chatter A (officer calling it in)
**Voice Design prompt:** Nigerian police officer, man in his forties, fast and panicked, talking over other traffic on an open channel.

**Suggested settings:** Stability 25–35 · Similarity 70 · Style 40. Record clean: the game adds the radio filter.

### RADIO_B — Radio chatter B (officer shouting a warning)
**Voice Design prompt:** Nigerian police officer, woman in her thirties, shouting a warning over the radio, desperate and loud.

**Suggested settings:** Stability 20–30 · Similarity 70 · Style 45. Record clean: the game adds the radio filter.

### SERGEANT — The Sergeant (Femi's escort, in plain clothes)
**Voice Design prompt:** Nigerian man in his forties, Lagos accent. Low, level and economical, a policeman used to not explaining himself. Never unkind, never warm; the listener should not be able to tell whose side he is on.

**Suggested settings:** Stability 45–55 · Similarity 75 · Style 10

### TRADER — The trader on Danfo 247
**Voice Design prompt:** Nigerian woman in her fifties, Lagos market trader. Warm, sharp and quick, in natural Nigerian Pidgin and English.

**Suggested settings:** Stability 35–45 · Similarity 75 · Style 20

### CONDUCTOR — The conductor (also the passengers' asides)
**Voice Design prompt:** Young Lagos man in his twenties, a danfo conductor. Loud, sing-song and street-worn, in restrained Pidgin. For the passenger lines, the same voice quieter and amused.

**Suggested settings:** Stability 30–40 · Similarity 75 · Style 25

### RADIO_PRESENTER — FM radio presenter (news and adverts)
**Voice Design prompt:** Nigerian radio presenter, polished and bright, broadcast diction. Reads the news briskly and adverts with a smile.

**Suggested settings:** Stability 50–60 · Similarity 75 · Style 15

### CALLER — The anonymous caller
**Voice Design prompt:** Nigerian man in his fifties, educated, polished Lagos English with an almost British evenness. Calm, unhurried, slightly amused. Never raises his voice.

**Suggested settings:** Stability 60–70 · Similarity 80 · Style 15 · Speaker boost on

## Still to record (84)

| File | Voice | Text | Plays | Direction |
| --- | --- | --- | --- | --- |
| `h1.mp3` | UNIT_SEVEN | Madam, this one no get particulars. | Signal Lost: cutscene "checkpoint", shot 2 | A checkpoint corporal in restrained Pidgin, bored, fishing for something. |
| `h2.mp3` | ADA | He has them under the mat, with the five hundred naira he's been folding since the flyover. | Signal Lost: cutscene "checkpoint", shot 3 | Dry, unhurried. She has only just walked up and has already seen it. |
| `h3.mp3` | UNIT_SEVEN | Abeg, Madam, why them put Inspector for checkpoint? | Signal Lost: cutscene "checkpoint", shot 5 | Curious, a little amused, half under his breath. |
| `h4.mp3` | ADA | I asked a question in a meeting. | Signal Lost: cutscene "checkpoint", shot 6 | Flat. A closed door with a small smile behind it. |
| `h5.mp3` | UNIT_SEVEN | Which question? | Signal Lost: cutscene "checkpoint", shot 7 | He should not have asked, and he knows it. |
| `h6.mp3` | ADA | Who signs off the outages. | Signal Lost: cutscene "checkpoint", shot 8 | Quiet, watching his reaction. |
| `h7.mp3` | UNIT_SEVEN | Madam, I no hear that one. | Signal Lost: cutscene "checkpoint", shot 9 | Looking away. Not joking now. |
| `h8.mp3` | CONTROL | South checkpoint, all units to the traffic stop at Stadium. That's from Command. All units, Inspector. | Signal Lost: cutscene "checkpoint", shot 10 | Routine, with a slight weight on the last two words. |
| `h9.mp3` | ADA | Send the Corporal. I have a flat. | Signal Lost: cutscene "checkpoint", shot 11 | Without missing a beat. |
| `h10.mp3` | CONTROL | …Is it flat? | Signal Lost: cutscene "checkpoint", shot 12 | A pause first. He knows her. |
| `h11.mp3` | ADA | It's thinking about it. | Signal Lost: cutscene "checkpoint", shot 13 | Bone dry. |
| `h12.mp3` | CONTROL | Ada. Command says eleven coincidences, and that file isn't yours any more. Leave it. | Signal Lost: cutscene "checkpoint", shot 15 | Off the script, lower, a friend warning her. |
| `h13.mp3` | ADA | Command should buy a calendar. I wrote his name in that file. I'll stay until he's past me. | Signal Lost: cutscene "checkpoint", shot 16 | Dry on the first sentence, then quiet and certain. No heroics. |
| `k1.mp3` | ADA | Ah… fuck. | Aftermath: cutscene "wake", shot 1 | Waking up on a hard floor, winded, in pain. Barely voiced. |
| `k1-clean.mp3` | ADA | Ah… damn. | Aftermath: cutscene "wake", shot 1 — clean version, used when Mature language is off | Waking up on a hard floor, winded, in pain. Barely voiced. |
| `k2.mp3` | ADA | The bus. Femi. The checkpoint… | Aftermath: cutscene "wake", shot 2 | Piecing it together, slow and groggy. Trailing off. |
| `k3.mp3` | ADA | The sky. | Aftermath: cutscene "wake", shot 3 | Stops. Remembering. |
| `k4.mp3` | ADA | Was that… a dream? | Aftermath: cutscene "wake", shot 4 | Quiet, unsure, half hoping. |
| `k5.mp3` | CONTROL | —Inspector Nwosu. Respond. | Aftermath: when "Get to the broken window" starts (+1.5s) | Through heavy static on a damaged handset. Flat. |
| `k6.mp3` | ADA | Control? | Aftermath: when "Get to the broken window" starts (+1.5s) | Surprised to hear anyone. |
| `k7.mp3` | CONTROL | Inspector, confirm your status. | Aftermath: when "Get to the broken window" starts (+1.5s) | Procedural. No warmth. |
| `k8.mp3` | ADA | I'm alive. Where the hell am I? | Aftermath: when "Get to the broken window" starts (+1.5s) | Sitting up, irritated, disoriented. |
| `k8-clean.mp3` | ADA | I'm alive. Where am I? | Aftermath: when "Get to the broken window" starts (+1.5s) — clean version, used when Mature language is off | Sitting up, irritated, disoriented. |
| `k9.mp3` | CONTROL | An emergency shelter, approximately two kilometres from the junction. Search and rescue found you unconscious. | Aftermath: when "Get to the broken window" starts (+1.5s) | Reading it out. Too neat. |
| `k10.mp3` | ADA | How long was I out? | Aftermath: cutscene "window", shot 1 | At the window, looking at the smoke. |
| `k11.mp3` | CONTROL | Three hours, twenty-five minutes. | Aftermath: cutscene "window", shot 2 | Precise to the minute. Somebody has been counting. |
| `k12.mp3` | ADA | Oh, my fucking days… | Aftermath: cutscene "window", shot 3 | Lagos exasperation, breathed out. Shock under it. |
| `k12-clean.mp3` | ADA | Oh, my days… | Aftermath: cutscene "window", shot 3 — clean version, used when Mature language is off | Lagos exasperation, breathed out. Shock under it. |
| `k13.mp3` | ADA | The witness. Where's Femi? | Aftermath: cutscene "window", shot 4 | Snapping back to the job. Urgent. |
| `k14.mp3` | CONTROL | Inspector, we need you to listen carefully. | Aftermath: cutscene "window", shot 5 | A delay before answering. Careful, managing her. |
| `k15.mp3` | ADA | Where. Is. Femi? | Aftermath: cutscene "window", shot 6 | Each word on its own. Controlled anger. |
| `k16.mp3` | CONTROL | The bus never arrived at the designated extraction point. | Aftermath: cutscene "window", shot 7 | Flat. A pause after it. |
| `k17.mp3` | CONTROL | We lost contact with the escort team shortly after the explosion. | Aftermath: cutscene "window", shot 8 | Even flatter. Giving nothing away. |
| `k18.mp3` | ADA | No. No, you told me he was safe. You said he was on the bus. | Aftermath: cutscene "window", shot 9 | Rising. Accusing. |
| `k19.mp3` | CONTROL | He was supposed to be. | Aftermath: cutscene "window", shot 10 | Quiet. The only honest-sounding thing they say. |
| `k23.mp3` | CONTROL | Inspector, your next assignment has been authorised. Proceed to Third Mainland Bridge. A recovery team has located a vehicle connected to the incident. | Aftermath: when "Search the shelter for your equipment" completes | Brisk, rehearsed, moving her along. |
| `k24.mp3` | ADA | Who authorised it? | Aftermath: when "Search the shelter for your equipment" completes | Immediate. Testing them. |
| `k25.mp3` | CONTROL | Command. | Aftermath: when "Search the shelter for your equipment" completes | One word. Closed. |
| `k26.mp3` | ADA | Which command? | Aftermath: when "Search the shelter for your equipment" completes | Pressing. |
| `k27.mp3` | CONTROL | Inspector, you need to move. We have reports of armed men converging on the bridge. | Aftermath: when "Search the shelter for your equipment" completes | Changing the subject with urgency. Not answering. |
| `k28.mp3` | ADA | They knew I would make it. They knew exactly where I would be. | Aftermath: when "Search the shelter for your equipment" completes | To herself, very low, after the radio clicks off. |
| `k29.mp3` | ADA | Fine. Third Mainland it is. | Aftermath: cutscene "doorway", shot 1 | At the doorway. Decided, tired. |
| `k30.mp3` | ADA | But if this is another setup… | Aftermath: cutscene "doorway", shot 2 | Looking at the radio in her hand. |
| `k31.mp3` | ADA | …I'm done taking orders. | Aftermath: cutscene "doorway", shot 3 | Quiet, final. She walks out. |
| `k20.mp3` | ADA | Still here. Still loaded. | Aftermath: on "Recover your service pistol" | Checking the pistol, a breath of relief. |
| `k21.mp3` | ADA | Casing cracked. It still gets Control — just about. | Aftermath: on "Check your radio" | Turning the radio over, unimpressed. |
| `k22.mp3` | ADA | Unknown number. That's the inside of Danfo 247… who took this? | Aftermath: on "Read the message on your phone" | Reading her phone, cold realisation. |
| `b1.mp3` | STATIC_A | Boss said the drive must reach the other side before sunrise. | Aftermath: Third Mainland Bridge (map in development) | STATIC crew member, low, searching between cars. Nigerian Pidgin rhythm. |
| `b2.mp3` | STATIC_B | Which drive? | Aftermath: Third Mainland Bridge (map in development) | Second STATIC member, younger, confused. |
| `b3.mp3` | STATIC_A | The one the engineer kept. | Aftermath: Third Mainland Bridge (map in development) | Impatient, keeping his voice down. |
| `b4.mp3` | ADA | You're kidding me. | Aftermath: Third Mainland Bridge (map in development) | Watching the body-camera footage a second time. Disbelief turning cold. |
| `b5.mp3` | CONTROL | Inspector, report your findings. | Aftermath: Third Mainland Bridge (map in development) | Waiting for an answer that does not come. |
| `b6.mp3` | CONTROL | Inspector Nwosu, respond. | Aftermath: Third Mainland Bridge (map in development) | A little sharper. Then she switches the radio off. |
| `b7.mp3` | CALLER | Inspector Nwosu. You've had a difficult night. | Aftermath: Third Mainland Bridge (map in development) | Calm, educated, unhurried. Enjoying this slightly. |
| `b8.mp3` | ADA | Who is this? | Aftermath: Third Mainland Bridge (map in development) | Answering a ringing phone in an abandoned car. |
| `b9.mp3` | CALLER | Someone who knows what happened at Ojuelegba. | Aftermath: Third Mainland Bridge (map in development) | Measured. |
| `b10.mp3` | ADA | Then tell me who paid for the jammer. | Aftermath: Third Mainland Bridge (map in development) | Hard, direct. |
| `b11.mp3` | CALLER | You still think the jammer was the operation? | Aftermath: Third Mainland Bridge (map in development) | Almost amused. |
| `b12.mp3` | CALLER | The jammer was the distraction. The explosion was the cleanup. And the witness list… | Aftermath: Third Mainland Bridge (map in development) | Slower, each sentence landing. |
| `b13.mp3` | CALLER | …was never supposed to leave that bus. | Aftermath: Third Mainland Bridge (map in development) | Lower, almost a whisper. Then he hangs up. |
| `p1.mp3` | CONDUCTOR | Ojuelegba, Yaba! Enter with your change o! I no get change! | The Passenger: cutscene "opening", shot 1 | Danfo conductor calling his route, loud and sing-song, a thousand evenings of this. |
| `p2.mp3` | FEMI | This isn't the bus. They told me the seven o'clock. | The Passenger: cutscene "boarding", shot 1 | Stopping short. Polite, but he has noticed. |
| `p3.mp3` | SERGEANT | Plan changed. | The Passenger: cutscene "boarding", shot 2 | Flat. Not interested in discussing it. |
| `p4.mp3` | FEMI | Who changed it? | The Passenger: cutscene "boarding", shot 3 | Quiet. He wants an answer. |
| `p5.mp3` | SERGEANT | Command. | The Passenger: cutscene "boarding", shot 4 | As if that settles it. |
| `p6.mp3` | FEMI | Which command? | The Passenger: cutscene "boarding", shot 5 | He has spent his life asking systems for their logs. |
| `p7.mp3` | SERGEANT | Oga. Enter. | The Passenger: cutscene "boarding", shot 6 | Not unkind, not asking either. |
| `p8.mp3` | RADIO_PRESENTER | …the eleventh outage on the mainland since June. Police say there is no link to Tuesday's robbery at Ikeja, where witnesses— | The Passenger: cutscene "ride", shot 2 | Evening news on FM, brisk and practised. Cut off by the driver changing the station. |
| `p9.mp3` | CONDUCTOR | Na STATIC be that. | The Passenger: cutscene "ride", shot 3 | A passenger, half to himself. |
| `p10.mp3` | TRADER | Shh! Abeg. No call that name for motor. | The Passenger: cutscene "ride", shot 4 | A market woman in her fifties, sharp and low. She is not joking. |
| `p11.mp3` | RADIO_PRESENTER | Your mama in Aba. Your money in the bank. Your market in your hand. Signal 9: the network that never sleeps. | The Passenger: cutscene "ride", shot 5 | A bright radio advert, warm and over-produced. |
| `p12.mp3` | FEMI | Your phone is fine. It's the mast. Try now. | The Passenger: cutscene "ride", shot 6 | Gentle, handing it back. The first time he has relaxed. |
| `p13.mp3` | TRADER | Ah! God bless you. You work for them? | The Passenger: cutscene "ride", shot 7 | Delighted, her daughter's message arriving. |
| `p14.mp3` | FEMI | Not for long. | The Passenger: cutscene "ride", shot 8 | A small private smile that fades. |
| `p15.mp3` | SERGEANT | You talk tomorrow, you sleep tomorrow night. | The Passenger: cutscene "ride", shot 9 | Low, without looking at him. |
| `p16.mp3` | SERGEANT | Who are you sending that to? | The Passenger: cutscene "ride", shot 10 | Sharper than he meant it. |
| `p17.mp3` | FEMI | Nobody. It's just so somebody knows which bus. | The Passenger: cutscene "ride", shot 11 | Trying to make it sound like nothing. |
| `p18.mp3` | SERGEANT | Stay here. If I'm not back, use this. Only this. | The Passenger: cutscene "ride", shot 12 | Pressing something into his hand, already standing. |
| `p19.mp3` | CONDUCTOR | Na network o. | The Passenger: cutscene "jam", shot 3 | Amused. It happens every week. |
| `p20.mp3` | FEMI | All the bands. Together. That's not a fault. | The Passenger: cutscene "jam", shot 4 | To himself, very quiet. The only person on the bus who understands. |
| `p21.mp3` | STATIC_A | Engineer. Come down. No make me enter. | The Passenger: cutscene "stop", shot 2 | Calm, almost bored, through the door. He knows the job title. |
| `p22.mp3` | STATIC_A | No shoot am! We need that head. | The Passenger: when "Get off the road" starts (+0.6s) | Shouted from inside the bus, furious. |
| `p23.mp3` | FEMI | Come on. One bar. One bar. | The Passenger: when "Send a message while there is signal" starts | Whispered, out of breath, watching the phone. |
| `p24.mp3` | STATIC | Na him be that! Catch am! | The Passenger: in game | A crew member spotting him, shouting across the street. |

## Lines by character

### ADA (52 lines, 32 to record)

**h2** ✗ — _Dry, unhurried. She has only just walked up and has already seen it._

> He has them under the mat, with the five hundred naira he's been folding since the flyover.

**h4** ✗ — _Flat. A closed door with a small smile behind it._

> I asked a question in a meeting.

**h6** ✗ — _Quiet, watching his reaction._

> Who signs off the outages.

**h9** ✗ — _Without missing a beat._

> Send the Corporal. I have a flat.

**h11** ✗ — _Bone dry._

> It's thinking about it.

**h13** ✗ — _Dry on the first sentence, then quiet and certain. No heroics._

> Command should buy a calendar. I wrote his name in that file. I'll stay until he's past me.

**a16** ✓ — _After silence. Quieter, a flicker of fear._

> …Control?

**a1** ✓ — _Ada to herself, low. A beat of fear, then she steadies._

> Control? …Nothing. Backup band's gone too. I'm on my own.

**a2** ✓ — _Quiet, observant, crouched at the bus door._

> Side door forced. No driver, no Femi. Blood on the step — not much. He walked away from this.

**a3** ✓ — _Reading a phone screen, half to herself._

> His phone's under the seat. Last message: 'Relay 07 is jammed from inside the Signal 9 yard.'

**a4** ✓ — _Decision made; brisk._

> 'I got away. Hiding where the presses are.' Kola Printing. First, the network.

**a5** ✓ — _Planning out loud, low and focused._

> Signal 9 yard is north-west, past Bukka 24/7. The gate, the alley, or the park behind it.

**a6** ✓ — _Breathing hard after the fight._

> Yard is clear. The relay cabinet is against the south wall.

**a7** ✓ — _Ada, gentle but firm, taking charge._

> Then you stay behind me. Head down, and keep moving.

**a9** ✓ — _Ada between fights, impatient, a little uneasy._

> Control, that was twenty minutes ago. Where are my units?

**a8** ✓ — _Short and urgent, under fire._

> Park is clear. Femi — the yellow bus. Go.

**a10** ✓ — _Dry, flat disbelief, under her breath._

> A traffic stop. With a jammer on Relay 07.

**a11** ✓ — _Quiet, direct, walking beside him._

> Femi. The laptop they took. What was on it?

**a12** ✓ — _A beat. Honest, wary._

> No.

**o1** ✓ — _Tired, quiet resolve after the fight. Not shouting._

> Tell them I'm walking back. Somebody paid for that jammer, Control — and I want a name.

**a13** ✓ — _Tired, almost a smile, walking alone._

> Lights coming back. Horns. For the first time tonight, Lagos sounds like Lagos.

**a14** ✓ — _Turning it over in her head; it bothers her._

> 'Your unit will meet you there.' No questions. Not one.

**a15** ✓ — _Immediately alert._

> What update?

**a17** ✓ — _Looking up at the sky, stunned._

> What the hell is that?

**a17-clean** ✓ — _Looking up at the sky, stunned._

> What is that?

**a18** ✓ — _Looking toward the flyover, realising. Breaking._

> Oh, no. No, no, no…

**k1** ✗ — _Waking up on a hard floor, winded, in pain. Barely voiced._

> Ah… fuck.

**k1-clean** ✗ — _Waking up on a hard floor, winded, in pain. Barely voiced._

> Ah… damn.

**k2** ✗ — _Piecing it together, slow and groggy. Trailing off._

> The bus. Femi. The checkpoint…

**k3** ✗ — _Stops. Remembering._

> The sky.

**k4** ✗ — _Quiet, unsure, half hoping._

> Was that… a dream?

**k6** ✗ — _Surprised to hear anyone._

> Control?

**k8** ✗ — _Sitting up, irritated, disoriented._

> I'm alive. Where the hell am I?

**k8-clean** ✗ — _Sitting up, irritated, disoriented._

> I'm alive. Where am I?

**k10** ✗ — _At the window, looking at the smoke._

> How long was I out?

**k12** ✗ — _Lagos exasperation, breathed out. Shock under it._

> Oh, my fucking days…

**k12-clean** ✗ — _Lagos exasperation, breathed out. Shock under it._

> Oh, my days…

**k13** ✗ — _Snapping back to the job. Urgent._

> The witness. Where's Femi?

**k15** ✗ — _Each word on its own. Controlled anger._

> Where. Is. Femi?

**k18** ✗ — _Rising. Accusing._

> No. No, you told me he was safe. You said he was on the bus.

**k24** ✗ — _Immediate. Testing them._

> Who authorised it?

**k26** ✗ — _Pressing._

> Which command?

**k28** ✗ — _To herself, very low, after the radio clicks off._

> They knew I would make it. They knew exactly where I would be.

**k29** ✗ — _At the doorway. Decided, tired._

> Fine. Third Mainland it is.

**k30** ✗ — _Looking at the radio in her hand._

> But if this is another setup…

**k31** ✗ — _Quiet, final. She walks out._

> …I'm done taking orders.

**k20** ✗ — _Checking the pistol, a breath of relief._

> Still here. Still loaded.

**k21** ✗ — _Turning the radio over, unimpressed._

> Casing cracked. It still gets Control — just about.

**k22** ✗ — _Reading her phone, cold realisation._

> Unknown number. That's the inside of Danfo 247… who took this?

**b4** ✗ — _Watching the body-camera footage a second time. Disbelief turning cold._

> You're kidding me.

**b8** ✗ — _Answering a ringing phone in an abandoned car._

> Who is this?

**b10** ✗ — _Hard, direct._

> Then tell me who paid for the jammer.

### CONTROL (30 lines, 16 to record)

**h8** ✗ — _Routine, with a slight weight on the last two words._

> South checkpoint, all units to the traffic stop at Stadium. That's from Command. All units, Inspector.

**h10** ✗ — _A pause first. He knows her._

> …Is it flat?

**h12** ✗ — _Off the script, lower, a friend warning her._

> Ada. Command says eleven coincidences, and that file isn't yours any more. Leave it.

**i1** ✓ — _Police dispatcher, calm but strained, heard over a weak radio band._

> Eighteen-forty. Every mast around Ojuelegba just went dark at the same moment. Radio, phones, data — all of it.

**i2** ✓ — _Slower, heavier. The worst news of the night._

> Danfo 247 was carrying our witness through that junction. It went in. It never came out the other side.

**c1** ✓ — _Dispatcher on a failing backup band; urgent, professional._

> Ada, this is Control on the backup band. You're the only unit inside the dead zone.

**c2** ✓ — _Clipped, the signal is going. Last words before the line drops._

> Danfo 247 never cleared the junction. Get under the flyover and find it. We'll lose you soon.

**c3** ✓ — _Radio breaking up and returning; relief cut with urgency._

> …da? Ada, you are breaking up — the relay is rebooting. Do not let them reach that cabinet.

**c4** ✓ — _Firm order._

> Forty-five seconds. Hold the yard.

**c5** ✓ — _Clear signal at last, relieved and quick._

> Network is up. We have you, Inspector. And we have a ping on Femi’s second phone — Kola Printing Press, east side.

**c6** ✓ — _Practical, reassuring._

> Units are twenty minutes out. Bring him to Danfo Park; we have a bus there that never left.

**c7** ✓ — _Warning, rising tension._

> STATIC are pulling back to Danfo Park. They'll try to stop the bus. Clear a way.

**c9** ✓ — _A beat too long before answering. Evasive, carefully neutral._

> …Units are being rerouted, Inspector. Hold for an update.

**c11** ✓ — _Reading off a screen, puzzled, trying to sound routine._

> Inspector, the report we're receiving is… incomplete. It's been logged as a traffic stop. No mention of a witness.

**c8** ✓ — _Warm, proud; the long night is over._

> Witness is on board. Ojuelegba is back on air. Good work, Inspector.

**c10** ✓ — _Instant, smooth, too rehearsed. No hesitation at all._

> Understood, Inspector. Return to the south checkpoint. Your unit will meet you there.

**c12** ✓ — _Formal, careful, as if reading._

> Inspector, remain at your current location. We have an update on the witness.

**k5** ✗ — _Through heavy static on a damaged handset. Flat._

> —Inspector Nwosu. Respond.

**k7** ✗ — _Procedural. No warmth._

> Inspector, confirm your status.

**k9** ✗ — _Reading it out. Too neat._

> An emergency shelter, approximately two kilometres from the junction. Search and rescue found you unconscious.

**k11** ✗ — _Precise to the minute. Somebody has been counting._

> Three hours, twenty-five minutes.

**k14** ✗ — _A delay before answering. Careful, managing her._

> Inspector, we need you to listen carefully.

**k16** ✗ — _Flat. A pause after it._

> The bus never arrived at the designated extraction point.

**k17** ✗ — _Even flatter. Giving nothing away._

> We lost contact with the escort team shortly after the explosion.

**k19** ✗ — _Quiet. The only honest-sounding thing they say._

> He was supposed to be.

**k23** ✗ — _Brisk, rehearsed, moving her along._

> Inspector, your next assignment has been authorised. Proceed to Third Mainland Bridge. A recovery team has located a vehicle connected to the incident.

**k25** ✗ — _One word. Closed._

> Command.

**k27** ✗ — _Changing the subject with urgency. Not answering._

> Inspector, you need to move. We have reports of armed men converging on the bridge.

**b5** ✗ — _Waiting for an answer that does not come._

> Inspector, report your findings.

**b6** ✗ — _A little sharper. Then she switches the radio off._

> Inspector Nwosu, respond.

### FEMI (13 lines, 8 to record)

**f1** ✓ — _Femi, injured and frightened, relieved to see a police officer; speaks fast._

> Officer — thank God. They took my laptop, but the drive is in my pocket. They can't open it without me.

**f2** ✓ — _Femi, a shaky laugh at the irony._

> The last bus out of here — that is the one I was supposed to take.

**f3** ✓ — _Too quick, nervous, avoiding the question._

> Work. Just… work. Please, Inspector — can we keep moving?

**f4** ✓ — _At the bus door, turning back. Hesitant, then deliberate._

> Inspector… did Control tell you who authorised my transfer tonight?

**f5** ✓ — _Quiet and certain, looking straight at her._

> Then somebody's lying.

**p2** ✗ — _Stopping short. Polite, but he has noticed._

> This isn't the bus. They told me the seven o'clock.

**p4** ✗ — _Quiet. He wants an answer._

> Who changed it?

**p6** ✗ — _He has spent his life asking systems for their logs._

> Which command?

**p12** ✗ — _Gentle, handing it back. The first time he has relaxed._

> Your phone is fine. It's the mast. Try now.

**p14** ✗ — _A small private smile that fades._

> Not for long.

**p17** ✗ — _Trying to make it sound like nothing._

> Nobody. It's just so somebody knows which bus.

**p20** ✗ — _To himself, very quiet. The only person on the bus who understands._

> All the bands. Together. That's not a fault.

**p23** ✗ — _Whispered, out of breath, watching the phone._

> Come on. One bar. One bar.

### STATIC (8 lines, 1 to record)

**s1** ✓ — _STATIC crew member shouting across the yard in Nigerian Pidgin; alarmed, aggressive._

> Somebody don touch the box! Go, go — the yard!

**p24** ✗ — _A crew member spotting him, shouting across the street._

> Na him be that! Catch am!

**bark-engage-1** ✓ — _Shouted to other crew members mid-fight._

> Na police! For there!

**bark-engage-2** ✓ — _Shouted to other crew members mid-fight._

> She dey here — open fire!

**bark-engage-3** ✓ — _Shouted to other crew members mid-fight._

> Flank am, go left!

**bark-reload-1** ✓ — _Shouted to other crew members mid-fight._

> Cover me, I dey reload!

**bark-lost-1** ✓ — _Shouted to other crew members mid-fight._

> Where she go?

**bark-lost-2** ✓ — _Shouted to other crew members mid-fight._

> Find am! Check the corner!

### STATIC_A (4 lines, 4 to record)

**b1** ✗ — _STATIC crew member, low, searching between cars. Nigerian Pidgin rhythm._

> Boss said the drive must reach the other side before sunrise.

**b3** ✗ — _Impatient, keeping his voice down._

> The one the engineer kept.

**p21** ✗ — _Calm, almost bored, through the door. He knows the job title._

> Engineer. Come down. No make me enter.

**p22** ✗ — _Shouted from inside the bus, furious._

> No shoot am! We need that head.

### STATIC_B (1 lines, 1 to record)

**b2** ✗ — _Second STATIC member, younger, confused._

> Which drive?

### UNIT_SEVEN (6 lines, 4 to record)

**h1** ✗ — _A checkpoint corporal in restrained Pidgin, bored, fishing for something._

> Madam, this one no get particulars.

**h3** ✗ — _Curious, a little amused, half under his breath._

> Abeg, Madam, why them put Inspector for checkpoint?

**h5** ✗ — _He should not have asked, and he knows it._

> Which question?

**h7** ✗ — _Looking away. Not joking now._

> Madam, I no hear that one.

**r3** ✓ — _Screamed over the radio. Same officer as Unit Seven._

> Ada! GET DOWN!

**u1** ✓ — _Weak, hurt, through heavy static. Cut off mid-word._

> Control, this is Unit Seven… the target wasn’t supposed to be—

### RADIO_A (1 lines, 0 to record)

**r1** ✓ — _Panicked officer on an open channel, talking fast over other voices._

> —unidentified object over the mainland, descending, I say again, descending—

### RADIO_B (1 lines, 0 to record)

**r2** ✓ — _A second voice shouting over the first, desperate._

> Everybody away from the junction! Get away from the junction, now!

### SERGEANT (6 lines, 6 to record)

**p3** ✗ — _Flat. Not interested in discussing it._

> Plan changed.

**p5** ✗ — _As if that settles it._

> Command.

**p7** ✗ — _Not unkind, not asking either._

> Oga. Enter.

**p15** ✗ — _Low, without looking at him._

> You talk tomorrow, you sleep tomorrow night.

**p16** ✗ — _Sharper than he meant it._

> Who are you sending that to?

**p18** ✗ — _Pressing something into his hand, already standing._

> Stay here. If I'm not back, use this. Only this.

### TRADER (2 lines, 2 to record)

**p10** ✗ — _A market woman in her fifties, sharp and low. She is not joking._

> Shh! Abeg. No call that name for motor.

**p13** ✗ — _Delighted, her daughter's message arriving._

> Ah! God bless you. You work for them?

### CONDUCTOR (3 lines, 3 to record)

**p1** ✗ — _Danfo conductor calling his route, loud and sing-song, a thousand evenings of this._

> Ojuelegba, Yaba! Enter with your change o! I no get change!

**p9** ✗ — _A passenger, half to himself._

> Na STATIC be that.

**p19** ✗ — _Amused. It happens every week._

> Na network o.

### RADIO_PRESENTER (2 lines, 2 to record)

**p8** ✗ — _Evening news on FM, brisk and practised. Cut off by the driver changing the station._

> …the eleventh outage on the mainland since June. Police say there is no link to Tuesday's robbery at Ikeja, where witnesses—

**p11** ✗ — _A bright radio advert, warm and over-produced._

> Your mama in Aba. Your money in the bank. Your market in your hand. Signal 9: the network that never sleeps.

### CALLER (5 lines, 5 to record)

**b7** ✗ — _Calm, educated, unhurried. Enjoying this slightly._

> Inspector Nwosu. You've had a difficult night.

**b9** ✗ — _Measured._

> Someone who knows what happened at Ojuelegba.

**b11** ✗ — _Almost amused._

> You still think the jammer was the operation?

**b12** ✗ — _Slower, each sentence landing._

> The jammer was the distraction. The explosion was the cleanup. And the witness list…

**b13** ✗ — _Lower, almost a whisper. Then he hangs up._

> …was never supposed to leave that bus.

## Running order and where each line plays

### Signal Lost (Chapter 01)

| File | Recorded | Plays | Direction |
| --- | --- | --- | --- |
| `h1.mp3` | ✗ | cutscene "checkpoint", shot 2 | A checkpoint corporal in restrained Pidgin, bored, fishing for something. |
| `h2.mp3` | ✗ | cutscene "checkpoint", shot 3 | Dry, unhurried. She has only just walked up and has already seen it. |
| `h3.mp3` | ✗ | cutscene "checkpoint", shot 5 | Curious, a little amused, half under his breath. |
| `h4.mp3` | ✗ | cutscene "checkpoint", shot 6 | Flat. A closed door with a small smile behind it. |
| `h5.mp3` | ✗ | cutscene "checkpoint", shot 7 | He should not have asked, and he knows it. |
| `h6.mp3` | ✗ | cutscene "checkpoint", shot 8 | Quiet, watching his reaction. |
| `h7.mp3` | ✗ | cutscene "checkpoint", shot 9 | Looking away. Not joking now. |
| `h8.mp3` | ✗ | cutscene "checkpoint", shot 10 | Routine, with a slight weight on the last two words. |
| `h9.mp3` | ✗ | cutscene "checkpoint", shot 11 | Without missing a beat. |
| `h10.mp3` | ✗ | cutscene "checkpoint", shot 12 | A pause first. He knows her. |
| `h11.mp3` | ✗ | cutscene "checkpoint", shot 13 | Bone dry. |
| `h12.mp3` | ✗ | cutscene "checkpoint", shot 15 | Off the script, lower, a friend warning her. |
| `h13.mp3` | ✗ | cutscene "checkpoint", shot 16 | Dry on the first sentence, then quiet and certain. No heroics. |
| `a16.mp3` | ✓ | cutscene "checkpoint", shot 18 | After silence. Quieter, a flicker of fear. |
| `i1.mp3` | ✓ | cutscene "intro", shot 1 | Police dispatcher, calm but strained, heard over a weak radio band. |
| `i2.mp3` | ✓ | cutscene "intro", shot 2 | Slower, heavier. The worst news of the night. |
| `c1.mp3` | ✓ | cutscene "intro", shot 3 | Dispatcher on a failing backup band; urgent, professional. |
| `c2.mp3` | ✓ | when "Reach the junction under the flyover" starts | Clipped, the signal is going. Last words before the line drops. |
| `a1.mp3` | ✓ | when "Reach the junction under the flyover" completes | Ada to herself, low. A beat of fear, then she steadies. |
| `a2.mp3` | ✓ | when "Search the abandoned danfo" completes | Quiet, observant, crouched at the bus door. |
| `a3.mp3` | ✓ | when "Search the abandoned danfo" completes | Reading a phone screen, half to herself. |
| `a4.mp3` | ✓ | when "Search the abandoned danfo" completes | Decision made; brisk. |
| `a5.mp3` | ✓ | when "Clear the STATIC crew from the Signal 9 yard" starts | Planning out loud, low and focused. |
| `a6.mp3` | ✓ | when "Clear the STATIC crew from the Signal 9 yard" completes | Breathing hard after the fight. |
| `c3.mp3` | ✓ | cutscene "relay", shot 1 | Radio breaking up and returning; relief cut with urgency. |
| `c4.mp3` | ✓ | when "Pull the jammer off Relay 07" completes | Firm order. |
| `s1.mp3` | ✓ | when "Hold the yard while Relay 07 reboots" starts | STATIC crew member shouting across the yard in Nigerian Pidgin; alarmed, aggressive. |
| `c5.mp3` | ✓ | when "Hold the yard while Relay 07 reboots" completes | Clear signal at last, relieved and quick. |
| `c6.mp3` | ✓ | when "Hold the yard while Relay 07 reboots" completes | Practical, reassuring. |
| `f1.mp3` | ✓ | cutscene "femi", shot 1 | Femi, injured and frightened, relieved to see a police officer; speaks fast. |
| `a7.mp3` | ✓ | cutscene "femi", shot 2 | Ada, gentle but firm, taking charge. |
| `f2.mp3` | ✓ | when "Find Femi inside Kola Printing Press" completes | Femi, a shaky laugh at the irony. |
| `c7.mp3` | ✓ | when "Clear Danfo Park for the last bus" starts | Warning, rising tension. |
| `a9.mp3` | ✓ | when "Clear Danfo Park for the last bus" starts (+16s) | Ada between fights, impatient, a little uneasy. |
| `c9.mp3` | ✓ | when "Clear Danfo Park for the last bus" starts (+23s) | A beat too long before answering. Evasive, carefully neutral. |
| `a8.mp3` | ✓ | when "Clear Danfo Park for the last bus" completes | Short and urgent, under fire. |
| `c11.mp3` | ✓ | when "Get Femi onto the last bus" starts (+3s) | Reading off a screen, puzzled, trying to sound routine. |
| `a10.mp3` | ✓ | when "Get Femi onto the last bus" starts (+3s) | Dry, flat disbelief, under her breath. |
| `a11.mp3` | ✓ | when "Get Femi onto the last bus" starts (+13s) | Quiet, direct, walking beside him. |
| `f3.mp3` | ✓ | when "Get Femi onto the last bus" starts (+13s) | Too quick, nervous, avoiding the question. |
| `f4.mp3` | ✓ | cutscene "outro", shot 1 | At the bus door, turning back. Hesitant, then deliberate. |
| `a12.mp3` | ✓ | cutscene "outro", shot 2 | A beat. Honest, wary. |
| `f5.mp3` | ✓ | cutscene "outro", shot 3 | Quiet and certain, looking straight at her. |
| `c8.mp3` | ✓ | cutscene "outro", shot 5 | Warm, proud; the long night is over. |
| `o1.mp3` | ✓ | cutscene "outro", shot 6 | Tired, quiet resolve after the fight. Not shouting. |
| `c10.mp3` | ✓ | cutscene "outro", shot 7 | Instant, smooth, too rehearsed. No hesitation at all. |
| `a13.mp3` | ✓ | when "Return to the south checkpoint" starts (+6s) | Tired, almost a smile, walking alone. |
| `a14.mp3` | ✓ | when "Return to the south checkpoint" starts (+24s) | Turning it over in her head; it bothers her. |
| `c12.mp3` | ✓ | cutscene "sky", shot 1 | Formal, careful, as if reading. |
| `a15.mp3` | ✓ | cutscene "sky", shot 2 | Immediately alert. |
| `a17.mp3` | ✓ | cutscene "sky", shot 5 | Looking up at the sky, stunned. |
| `a17-clean.mp3` | ✓ | cutscene "sky", shot 5 — clean version, used when Mature language is off | Looking up at the sky, stunned. |
| `r1.mp3` | ✓ | cutscene "sky", shot 6 (over the top) | Panicked officer on an open channel, talking fast over other voices. |
| `r2.mp3` | ✓ | cutscene "sky", shot 6 (over the top) | A second voice shouting over the first, desperate. |
| `a18.mp3` | ✓ | cutscene "sky", shot 7 | Looking toward the flyover, realising. Breaking. |
| `r3.mp3` | ✓ | cutscene "sky", shot 9 (over the top) | Screamed over the radio. Same officer as Unit Seven. |
| `u1.mp3` | ✓ | cutscene "sky", shot 10 | Weak, hurt, through heavy static. Cut off mid-word. |

### Aftermath (Chapter 02)

| File | Recorded | Plays | Direction |
| --- | --- | --- | --- |
| `k1.mp3` | ✗ | cutscene "wake", shot 1 | Waking up on a hard floor, winded, in pain. Barely voiced. |
| `k1-clean.mp3` | ✗ | cutscene "wake", shot 1 — clean version, used when Mature language is off | Waking up on a hard floor, winded, in pain. Barely voiced. |
| `k2.mp3` | ✗ | cutscene "wake", shot 2 | Piecing it together, slow and groggy. Trailing off. |
| `k3.mp3` | ✗ | cutscene "wake", shot 3 | Stops. Remembering. |
| `k4.mp3` | ✗ | cutscene "wake", shot 4 | Quiet, unsure, half hoping. |
| `k5.mp3` | ✗ | when "Get to the broken window" starts (+1.5s) | Through heavy static on a damaged handset. Flat. |
| `k6.mp3` | ✗ | when "Get to the broken window" starts (+1.5s) | Surprised to hear anyone. |
| `k7.mp3` | ✗ | when "Get to the broken window" starts (+1.5s) | Procedural. No warmth. |
| `k8.mp3` | ✗ | when "Get to the broken window" starts (+1.5s) | Sitting up, irritated, disoriented. |
| `k8-clean.mp3` | ✗ | when "Get to the broken window" starts (+1.5s) — clean version, used when Mature language is off | Sitting up, irritated, disoriented. |
| `k9.mp3` | ✗ | when "Get to the broken window" starts (+1.5s) | Reading it out. Too neat. |
| `k10.mp3` | ✗ | cutscene "window", shot 1 | At the window, looking at the smoke. |
| `k11.mp3` | ✗ | cutscene "window", shot 2 | Precise to the minute. Somebody has been counting. |
| `k12.mp3` | ✗ | cutscene "window", shot 3 | Lagos exasperation, breathed out. Shock under it. |
| `k12-clean.mp3` | ✗ | cutscene "window", shot 3 — clean version, used when Mature language is off | Lagos exasperation, breathed out. Shock under it. |
| `k13.mp3` | ✗ | cutscene "window", shot 4 | Snapping back to the job. Urgent. |
| `k14.mp3` | ✗ | cutscene "window", shot 5 | A delay before answering. Careful, managing her. |
| `k15.mp3` | ✗ | cutscene "window", shot 6 | Each word on its own. Controlled anger. |
| `k16.mp3` | ✗ | cutscene "window", shot 7 | Flat. A pause after it. |
| `k17.mp3` | ✗ | cutscene "window", shot 8 | Even flatter. Giving nothing away. |
| `k18.mp3` | ✗ | cutscene "window", shot 9 | Rising. Accusing. |
| `k19.mp3` | ✗ | cutscene "window", shot 10 | Quiet. The only honest-sounding thing they say. |
| `k23.mp3` | ✗ | when "Search the shelter for your equipment" completes | Brisk, rehearsed, moving her along. |
| `k24.mp3` | ✗ | when "Search the shelter for your equipment" completes | Immediate. Testing them. |
| `k25.mp3` | ✗ | when "Search the shelter for your equipment" completes | One word. Closed. |
| `k26.mp3` | ✗ | when "Search the shelter for your equipment" completes | Pressing. |
| `k27.mp3` | ✗ | when "Search the shelter for your equipment" completes | Changing the subject with urgency. Not answering. |
| `k28.mp3` | ✗ | when "Search the shelter for your equipment" completes | To herself, very low, after the radio clicks off. |
| `k29.mp3` | ✗ | cutscene "doorway", shot 1 | At the doorway. Decided, tired. |
| `k30.mp3` | ✗ | cutscene "doorway", shot 2 | Looking at the radio in her hand. |
| `k31.mp3` | ✗ | cutscene "doorway", shot 3 | Quiet, final. She walks out. |
| `k20.mp3` | ✗ | on "Recover your service pistol" | Checking the pistol, a breath of relief. |
| `k21.mp3` | ✗ | on "Check your radio" | Turning the radio over, unimpressed. |
| `k22.mp3` | ✗ | on "Read the message on your phone" | Reading her phone, cold realisation. |
| `b1.mp3` | ✗ | Third Mainland Bridge (map in development) | STATIC crew member, low, searching between cars. Nigerian Pidgin rhythm. |
| `b2.mp3` | ✗ | Third Mainland Bridge (map in development) | Second STATIC member, younger, confused. |
| `b3.mp3` | ✗ | Third Mainland Bridge (map in development) | Impatient, keeping his voice down. |
| `b4.mp3` | ✗ | Third Mainland Bridge (map in development) | Watching the body-camera footage a second time. Disbelief turning cold. |
| `b5.mp3` | ✗ | Third Mainland Bridge (map in development) | Waiting for an answer that does not come. |
| `b6.mp3` | ✗ | Third Mainland Bridge (map in development) | A little sharper. Then she switches the radio off. |
| `b7.mp3` | ✗ | Third Mainland Bridge (map in development) | Calm, educated, unhurried. Enjoying this slightly. |
| `b8.mp3` | ✗ | Third Mainland Bridge (map in development) | Answering a ringing phone in an abandoned car. |
| `b9.mp3` | ✗ | Third Mainland Bridge (map in development) | Measured. |
| `b10.mp3` | ✗ | Third Mainland Bridge (map in development) | Hard, direct. |
| `b11.mp3` | ✗ | Third Mainland Bridge (map in development) | Almost amused. |
| `b12.mp3` | ✗ | Third Mainland Bridge (map in development) | Slower, each sentence landing. |
| `b13.mp3` | ✗ | Third Mainland Bridge (map in development) | Lower, almost a whisper. Then he hangs up. |

### The Passenger (Chapter 01)

| File | Recorded | Plays | Direction |
| --- | --- | --- | --- |
| `p1.mp3` | ✗ | cutscene "opening", shot 1 | Danfo conductor calling his route, loud and sing-song, a thousand evenings of this. |
| `p2.mp3` | ✗ | cutscene "boarding", shot 1 | Stopping short. Polite, but he has noticed. |
| `p3.mp3` | ✗ | cutscene "boarding", shot 2 | Flat. Not interested in discussing it. |
| `p4.mp3` | ✗ | cutscene "boarding", shot 3 | Quiet. He wants an answer. |
| `p5.mp3` | ✗ | cutscene "boarding", shot 4 | As if that settles it. |
| `p6.mp3` | ✗ | cutscene "boarding", shot 5 | He has spent his life asking systems for their logs. |
| `p7.mp3` | ✗ | cutscene "boarding", shot 6 | Not unkind, not asking either. |
| `p8.mp3` | ✗ | cutscene "ride", shot 2 | Evening news on FM, brisk and practised. Cut off by the driver changing the station. |
| `p9.mp3` | ✗ | cutscene "ride", shot 3 | A passenger, half to himself. |
| `p10.mp3` | ✗ | cutscene "ride", shot 4 | A market woman in her fifties, sharp and low. She is not joking. |
| `p11.mp3` | ✗ | cutscene "ride", shot 5 | A bright radio advert, warm and over-produced. |
| `p12.mp3` | ✗ | cutscene "ride", shot 6 | Gentle, handing it back. The first time he has relaxed. |
| `p13.mp3` | ✗ | cutscene "ride", shot 7 | Delighted, her daughter's message arriving. |
| `p14.mp3` | ✗ | cutscene "ride", shot 8 | A small private smile that fades. |
| `p15.mp3` | ✗ | cutscene "ride", shot 9 | Low, without looking at him. |
| `p16.mp3` | ✗ | cutscene "ride", shot 10 | Sharper than he meant it. |
| `p17.mp3` | ✗ | cutscene "ride", shot 11 | Trying to make it sound like nothing. |
| `p18.mp3` | ✗ | cutscene "ride", shot 12 | Pressing something into his hand, already standing. |
| `p19.mp3` | ✗ | cutscene "jam", shot 3 | Amused. It happens every week. |
| `p20.mp3` | ✗ | cutscene "jam", shot 4 | To himself, very quiet. The only person on the bus who understands. |
| `p21.mp3` | ✗ | cutscene "stop", shot 2 | Calm, almost bored, through the door. He knows the job title. |
| `p22.mp3` | ✗ | when "Get off the road" starts (+0.6s) | Shouted from inside the bus, furious. |
| `p23.mp3` | ✗ | when "Send a message while there is signal" starts | Whispered, out of breath, watching the phone. |
| `p24.mp3` | ✗ | in game | A crew member spotting him, shouting across the street. |

### Combat

| File | Recorded | Plays | Direction |
| --- | --- | --- | --- |
| `bark-engage-1.mp3` | ✓ | random enemy call-out in combat | Shouted to other crew members mid-fight. |
| `bark-engage-2.mp3` | ✓ | random enemy call-out in combat | Shouted to other crew members mid-fight. |
| `bark-engage-3.mp3` | ✓ | random enemy call-out in combat | Shouted to other crew members mid-fight. |
| `bark-reload-1.mp3` | ✓ | random enemy call-out in combat | Shouted to other crew members mid-fight. |
| `bark-lost-1.mp3` | ✓ | random enemy call-out in combat | Shouted to other crew members mid-fight. |
| `bark-lost-2.mp3` | ✓ | random enemy call-out in combat | Shouted to other crew members mid-fight. |

## Paste-ready text per voice (lines still to record)

For ElevenLabs projects or batch tools: one line per row, in the format `key<TAB>text`.

### ADA

```
h2	He has them under the mat, with the five hundred naira he's been folding since the flyover.
h4	I asked a question in a meeting.
h6	Who signs off the outages.
h9	Send the Corporal. I have a flat.
h11	It's thinking about it.
h13	Command should buy a calendar. I wrote his name in that file. I'll stay until he's past me.
k1	Ah… fuck.
k1-clean	Ah… damn.
k2	The bus. Femi. The checkpoint…
k3	The sky.
k4	Was that… a dream?
k6	Control?
k8	I'm alive. Where the hell am I?
k8-clean	I'm alive. Where am I?
k10	How long was I out?
k12	Oh, my fucking days…
k12-clean	Oh, my days…
k13	The witness. Where's Femi?
k15	Where. Is. Femi?
k18	No. No, you told me he was safe. You said he was on the bus.
k24	Who authorised it?
k26	Which command?
k28	They knew I would make it. They knew exactly where I would be.
k29	Fine. Third Mainland it is.
k30	But if this is another setup…
k31	…I'm done taking orders.
k20	Still here. Still loaded.
k21	Casing cracked. It still gets Control — just about.
k22	Unknown number. That's the inside of Danfo 247… who took this?
b4	You're kidding me.
b8	Who is this?
b10	Then tell me who paid for the jammer.
```

### CONTROL

```
h8	South checkpoint, all units to the traffic stop at Stadium. That's from Command. All units, Inspector.
h10	…Is it flat?
h12	Ada. Command says eleven coincidences, and that file isn't yours any more. Leave it.
k5	—Inspector Nwosu. Respond.
k7	Inspector, confirm your status.
k9	An emergency shelter, approximately two kilometres from the junction. Search and rescue found you unconscious.
k11	Three hours, twenty-five minutes.
k14	Inspector, we need you to listen carefully.
k16	The bus never arrived at the designated extraction point.
k17	We lost contact with the escort team shortly after the explosion.
k19	He was supposed to be.
k23	Inspector, your next assignment has been authorised. Proceed to Third Mainland Bridge. A recovery team has located a vehicle connected to the incident.
k25	Command.
k27	Inspector, you need to move. We have reports of armed men converging on the bridge.
b5	Inspector, report your findings.
b6	Inspector Nwosu, respond.
```

### FEMI

```
p2	This isn't the bus. They told me the seven o'clock.
p4	Who changed it?
p6	Which command?
p12	Your phone is fine. It's the mast. Try now.
p14	Not for long.
p17	Nobody. It's just so somebody knows which bus.
p20	All the bands. Together. That's not a fault.
p23	Come on. One bar. One bar.
```

### STATIC

```
p24	Na him be that! Catch am!
```

### STATIC_A

```
b1	Boss said the drive must reach the other side before sunrise.
b3	The one the engineer kept.
p21	Engineer. Come down. No make me enter.
p22	No shoot am! We need that head.
```

### STATIC_B

```
b2	Which drive?
```

### UNIT_SEVEN

```
h1	Madam, this one no get particulars.
h3	Abeg, Madam, why them put Inspector for checkpoint?
h5	Which question?
h7	Madam, I no hear that one.
```

### SERGEANT

```
p3	Plan changed.
p5	Command.
p7	Oga. Enter.
p15	You talk tomorrow, you sleep tomorrow night.
p16	Who are you sending that to?
p18	Stay here. If I'm not back, use this. Only this.
```

### TRADER

```
p10	Shh! Abeg. No call that name for motor.
p13	Ah! God bless you. You work for them?
```

### CONDUCTOR

```
p1	Ojuelegba, Yaba! Enter with your change o! I no get change!
p9	Na STATIC be that.
p19	Na network o.
```

### RADIO_PRESENTER

```
p8	…the eleventh outage on the mainland since June. Police say there is no link to Tuesday's robbery at Ikeja, where witnesses—
p11	Your mama in Aba. Your money in the bank. Your market in your hand. Signal 9: the network that never sleeps.
```

### CALLER

```
b7	Inspector Nwosu. You've had a difficult night.
b9	Someone who knows what happened at Ojuelegba.
b11	You still think the jammer was the operation?
b12	The jammer was the distraction. The explosion was the cleanup. And the witness list…
b13	…was never supposed to leave that bus.
```
