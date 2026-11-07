import { expect, it } from 'vitest';
import { CAMPAIGN, MISSIONS, chapterDone, openingMission } from '@lastbus/shared';
const [first, second] = CAMPAIGN.chapters, finished = { best: 600 };
it('the prologue comes first in Chapter 01, which is called Signal Lost, and hands off to Signal Lost', () => {
  expect(first.title).toBe('Signal Lost'); expect(first.missions).toEqual(['the-passenger', 'signal-lost']);
  const p = MISSIONS['the-passenger']; expect(p.prologue).toBe(true); expect(p.ending?.continue).toBe('signal-lost'); expect(p.ending?.cards.at(-1)).toMatchObject({ text: 'Chapter 01', sub: 'Signal Lost' });
});
it('a new player opens on the prologue, and anyone past it opens on Signal Lost', () => {
  expect(openingMission(first, {})).toBe('the-passenger');
  expect(openingMission(first, { 'the-passenger': finished })).toBe('signal-lost');
  expect(openingMission(first, { 'signal-lost': finished })).toBe('signal-lost');
  expect(openingMission(first, { 'the-passenger': finished, 'signal-lost': finished })).toBe('signal-lost');
});
it('a saved checkpoint decides where the chapter opens, but only inside its own chapter', () => {
  expect(openingMission(first, {}, 'signal-lost')).toBe('signal-lost');
  expect(openingMission(second, {}, 'signal-lost')).toBe('aftermath');
});
it('an older save with Signal Lost finished keeps Chapter 02 open, and the prologue alone does not open it', () => {
  expect(chapterDone(first, { 'signal-lost': finished })).toBe(true);
  expect(chapterDone(first, { 'the-passenger': finished })).toBe(false);
  expect(chapterDone(first, {})).toBe(false);
});
it('a chapter with no missions is never done', () => { expect(chapterDone(CAMPAIGN.chapters[2], {})).toBe(false); });
