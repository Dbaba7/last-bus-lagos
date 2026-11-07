# DEAD AIR — story bible (author's direction, 29 October 2026)

This is the creative direction from the game's author. It extends the existing Chapter 1 rather than replacing it. The current mission data lives in `packages/shared/src/story/campaign.ts`. Keep the existing objectives, voice lines, checkpoints and recordings unless a change is listed here.

---

## CHAPTER 01 · SIGNAL LOST
*One night. One missing witness. One city about to go silent.*

### Act I — The night Lagos went silent (EXISTING, keep intact)
Ada investigates the abandoned Danfo 247, fights through the Signal 9 yard, restores Relay 07, finds Femi at Kola Printing Press and fights her way to Danfo Park. The player thinks the objective is simple: get Femi onto the last bus and survive until backup arrives.

**New:** during the final escape, small things don't add up.
- The police response is strangely slow.
- Control keeps receiving incomplete information about the incident.
- Femi becomes increasingly nervous when Ada asks about the stolen laptop.
- Just before the bus leaves, Femi asks Ada whether Control told her who authorised his transfer that night.

Ada says no. Femi looks at her: **"Then somebody's lying."**
Before she can question him further, the bus pulls away.

CONTROL: "Witness is on board. Ojuelegba is back on air. Good work, Inspector." *(existing line c8)*
Ada watches the bus disappear into the traffic.
ADA: "Somebody paid for that jammer, Control. And I want a name." *(existing line o1; current recording says "Tell them I'm walking back. Somebody paid for that jammer, Control — and I want a name." Keep it, or re-record to match.)*
A pause.
CONTROL: "Understood, Inspector. Return to the south checkpoint. Your unit will meet you there."
Something about the response bothers her. It's too quick. Too rehearsed. Still, she's exhausted. She starts walking.

### Act II — Something in the sky (NEW playable epilogue plus a cinematic)
**New objective:** walk back to the south checkpoint. The city is coming back to life: traffic crawls again, shop lights flicker on, distant horns return. For the first time that night, Lagos sounds normal. *(This needs a "city restored" ambience and lighting state.)*

At the checkpoint, the radio crackles:
- CONTROL: "Inspector, remain at your current location. We have an update on the witness."
- ADA: "What update?" *(no response)* "Control?"

A strange sound rolls across the sky — not thunder, something deeper. She looks up: a light moving through the clouds, then another. A bright streak cuts across the skyline, descending far too quickly.
- ADA: "What the hell is that?"
- The radio erupts with overlapping voices: someone shouting about an unidentified object, another screaming for everyone to get away from the junction.
- ADA (looking toward the flyover): "Oh, no. No, no, no..."

The object falls. One impossible second of silence. Then — **BOOM.** A blinding flash engulfs the skyline; the shockwave tears through the junction. Windows burst, streetlights shatter, cars collide, and the screen is swallowed by dust and white light. The camera tumbles. Radio: **"Ada! GET DOWN!"** She reaches for something to hold onto. Cut to black.

Final transmission through the static: **"Control, this is Unit Seven... the target wasn't supposed to be—"** *Transmission lost.* Silence.

**CHAPTER 01: SIGNAL LOST — COMPLETE.** The normal results screen does NOT appear. Instead, one line fades onto the black screen:
**02:17 AM. Three hours and twenty-five minutes later.** → **CHAPTER 02: THIRD MAINLAND**
*(Mission stats can still be saved; show them later or in the campaign screen, not at this moment.)*

---

## CHAPTER 02 · THIRD MAINLAND
*The witness list surfaces on the longest bridge in the city.*

### Act I — The aftermath
Black screen, breathing, a low ringing. Ada wakes on the floor of a damaged building, among dust and broken furniture, under a flickering light. Her uniform is dirty and her radio barely works.
- ADA: "Ah... fuck." *(the author's line; consider a profanity setting or a milder alternative)* "The bus. Femi. The checkpoint..." *(stops)* "The sky." *(beat)* "Was that... a dream?"
- CONTROL: "—Inspector Nwosu. Respond." / ADA: "Control?" / CONTROL: "Inspector, confirm your status."
- ADA: "I'm alive. Where the hell am I?" / CONTROL: "An emergency shelter, approximately two kilometres from the junction. Search and rescue found you unconscious."
- Through the shattered window: smoke over the skyline, sirens, the distant flyover obscured by dust.
- ADA: "How long was I out?" / CONTROL: "Three hours, twenty-five minutes." / ADA: "Oh, my fucking days..."
- ADA: "The witness. Where's Femi?" / CONTROL *(delay)*: "Inspector, we need you to listen carefully." / ADA: "Where. Is. Femi?"
- CONTROL: "The bus never arrived at the designated extraction point." *(pause)* "We lost contact with the escort team shortly after the explosion."
- ADA: "No. No, you told me he was safe. You said he was on the bus." / CONTROL: "He was supposed to be."

Theme: someone has lost the witness again, and the people meant to protect him aren't answering.

### Act II — The second message
Ada searches the shelter: her service pistol is still there, her radio is damaged, and her phone has one unread message from an unknown number containing:
- a photograph of Danfo 247 taken from inside the bus (in the window reflection, a blurry figure stands behind the photographer, apparently in police uniform);
- coordinates on Third Mainland Bridge;
- **THE WITNESS LIST IS NOT COMPLETE.**

- CONTROL: "Inspector, your next assignment has been authorised. Proceed to Third Mainland Bridge. A recovery team has located a vehicle connected to the incident."
- ADA: "Who authorised it?" / CONTROL: "Command." / ADA: "Which command?" / CONTROL: "Inspector, you need to move. We have reports of armed men converging on the bridge."
- Someone knew she'd survive. Someone knew where she'd be. Someone is directing her before she knows who to trust.
- ADA: "Fine. Third Mainland it is." *(at the doorway)* "But if this is another setup..." *(checks radio)* "...I'm done taking orders."

**OBJECTIVE: REACH THIRD MAINLAND BRIDGE.**

### Act III — The bridge
Chapter 2 must feel different: Chapter 1 investigated a blackout; Chapter 2 is navigating a city that no longer knows who to trust. Ada reaches the bridge approach just before dawn: the bridge is partially closed, abandoned vehicles block lanes, and emergency lights flash in the distance. STATIC move between vehicles, searching rather than robbing.
- Overheard: "Boss said the drive must reach the other side before sunrise." / "Which drive?" / "The one the engineer kept."
- Evidence to find (investigation objectives): an **altered police dispatch log**, a **partly destroyed witness transport manifest**, and **camera footage of an official vehicle leaving minutes before the blast**. Everything points to someone with access to police operations.

**Midpoint twist:** the vehicle is an official response van holding the missing escort team's equipment and a damaged body camera. The footage shows the bus approaching a roadblock. Armed men emerge; the escort officers appear to recognise them; one man gives a hand signal; the officers lower their weapons. Ada rewinds it and watches again: **"You're kidding me."**
- CONTROL: "Inspector, report your findings." *(silence)* "Inspector Nwosu, respond."
- Ada slowly switches off the radio. STATIC may not be acting alone, and Control might not be telling her everything.

### Act IV — The bridge goes dark
Once Ada recovers the van's data recorder, STATIC attack. She fights through abandoned traffic, service walkways and maintenance areas to reach an extraction point before the route is sealed.
- Texts from the unknown number: **YOU'RE LOOKING IN THE WRONG PLACE.** then **ASK CONTROL WHO SIGNED THE TRANSFER.**
- At the extraction point, the person sent to collect her isn't there. A phone rings in an abandoned vehicle; she answers.
  - MAN (calm): "Inspector Nwosu. You've had a difficult night." / ADA: "Who is this?" / MAN: "Someone who knows what happened at Ojuelegba." / ADA: "Then tell me who paid for the jammer."
  - MAN: "You still think the jammer was the operation?" *(Ada silent)* "The jammer was the distraction. The explosion was the cleanup. And the witness list..." *(lower)* "...was never supposed to leave that bus."
- The call ends. Headlights approach from the far end of the bridge; the vehicle stops; someone in police uniform steps out and raises a weapon at her. **CUT TO BLACK. CHAPTER 02: THIRD MAINLAND — TO BE CONTINUED.**

---

## CHAPTER 03 · EKO AFTER DARK (outline only)
Ada follows the conspiracy into Lagos Island. The identity of the person behind the jammer operation begins to emerge, and her own unit's involvement becomes impossible to ignore.

## The larger conspiracy
1. Who ordered the network blackout?
2. Why was the explosion necessary, and what did it conceal?
3. Who inside the police is manipulating Ada's assignments?

Femi's stolen laptop and the drive in his pocket stay central. The witness list holds names that could expose the operation, and nobody yet knows whether Femi survived the second attack.

**Rules:** keep Kasali out of the story for now. Don't reveal a mastermind early; let the player suspect several people, including Control, without confirming any of them.

## New voice lines needed (to record later)
- **Act I additions:** the "doesn't add up" lines (slow response, incomplete information, Femi nervous about the laptop); Femi's transfer question; Ada's "No"; Femi's "Then somebody's lying"; Control's "Understood, Inspector. Return to the south checkpoint…".
- **Act II:** Control's "remain at your location"; Ada's "What update?" / "Control?" / "What the hell is that?" / "Oh, no. No, no, no..."; overlapping radio chatter; "Ada! GET DOWN!"; Unit Seven's final transmission.
- **All of Chapter 2:** Ada, Control, two STATIC members, the anonymous caller. Femi is absent.

After the lines are added to `campaign.ts`, run `npm run voice:script` to regenerate `docs/voice-script.md` for recording.
