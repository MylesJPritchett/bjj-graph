# Choosing the first Bracket

Research for #12. Checked on 2026-11-27. YouTube metadata (title, channel, length, upload date, chapters, embeddability, region list) was read from each video's public watch page. Nobody watched the videos end to end, so the Match lists inside each video come from YouTube chapters where they exist, and are inferred elsewhere. "Unverified" below means exactly that.

## Recommendation

**Use the ADCC 2022 men's -88kg Bracket** as the first Corpus:

- Video: [Relive The Entire -88kg Division From The 2022 ADCC World Championship](https://www.youtube.com/watch?v=MyUe7tIEWHc), FloGrappling (verified channel), 3:31:19, uploaded 2024-08-10.

Why:

1. **It's the only weight class whose completeness we could check without watching.** Its 16 chapters line up one-to-one with the 16 Matches in the published results, in bracket order (one opponent is misnamed; see below). For the other divisions, the chapters are missing, coarse or garbled.
2. **All 16 Matches were contested.** There are no walkovers, so the Bracket is whole and no Result is missing.
3. **It has a good mix of Methods for shaking out the Label Guide:** 6 submissions (triangle, guillotine, heel hook, 2 toe holds, rear-naked choke), 7 on points (2 in overtime) and 3 referee decisions. That covers long positional Matches as well as finishes in leg entanglements and on the back.
4. **One video, one source, one ruleset.** Every Annotation uses the same video ID with different offsets. The video can be embedded and isn't region-blocked, which is what ADR-0002 needs.

Fallbacks, in order: -66kg, then -77kg (also 16 contested Matches each, but nothing confirms the videos are complete until someone skims them). -99kg comes after those. +99kg and Absolute each lost a Match to a walkover.

## Sources

**Official channel used: FloGrappling on YouTube** ([@FloGrappling](https://www.youtube.com/@FloGrappling), channel ID `UCeOvhU6RbmEj8GKFiIMWxKQ`, verified badge). FloSports was ADCC 2022's exclusive broadcaster. Between 2024 and 2026 it put full-Bracket replays of every 2022 division on YouTube for free.

**ADCC's own YouTube channel: not found.** The `@ADCC` handle belongs to an unrelated, empty account. `@adcc_official`, `@ADCCofficial` and `@ADCCSubmissionFighting` return 404. adcombat.com (ADCC's site) refused automated fetches, so we couldn't check whether it links to a channel. Treat this as unverified, not as proof that no channel exists.

**FloGrappling.com:** the [event page](https://www.flograppling.com/events/7096389) has a "Watch replays" link and a [-66kg supercut](https://www.flograppling.com/video/12683816-supercut-rewatch-the-entire-66kg-bracket-from-the-2022-adcc-worlds). The page doesn't say whether the replays need a FloGrappling PRO subscription, and we didn't check by logging in. This isn't needed, because the YouTube uploads cover every division for free.

**Results** (the Match lists below) come from MMASucka's [day 1](https://mmasucka.com/news/2022-adcc-world-championships-day-1-results/) and [day 2](https://mmasucka.com/news/2022-adcc-world-championships-day-2-results/) results pages. Medallists match [Wikipedia](https://en.wikipedia.org/wiki/2022_ADCC_World_Championship). BJJ Heroes and Sportskeeda blocked automated fetches.

## Licence / permission status (applies to every source below)

- **Licence:** Standard YouTube Licence. No Creative Commons marker was found on any of the watch pages. All rights reserved by the uploader (FloSports) and/or ADCC.
- **Permission:** none asked for or granted. We rely only on YouTube's embedded player, which the uploader has enabled on every video below (`playableInEmbed: true`). Every video is public, not age-restricted, and available in 249 regions.
- **Our use:** per ADR-0002, we reference the video ID plus offsets and store no footage. Record `licence: "YouTube Standard Licence; embed only; no permission sought"` (or the equivalent schema value) in each Annotation's metadata.
- **Risk:** FloSports could take the uploads down or make them private, as it does with other content. Annotations would survive, but nobody could check them against the footage. One re-upload has already happened: the -66kg video appeared on 2026-11-14.

## Per-division findings

Each men's weight class had 16 Athletes, so the Bracket has 16 scheduled Matches: 8 in round one, 4 quarter-finals, 2 semi-finals, a bronze Match and the final. "Contested" leaves out walkovers.

| Division | Scheduled / contested | In the video | Missing / unverified | Video |
|---|---|---|---|---|
| -66kg | 16 / 16 | Probably 16 | No chapters. Completeness unverified (3:32:38 is long enough for 16 Matches). | [gxWFUMaOLw0](https://www.youtube.com/watch?v=gxWFUMaOLw0), uploaded 2026-11-14 |
| -77kg | 16 / 16 | Probably 16 | No chapters. Completeness unverified (2:47:22; many early submissions make a shorter video plausible). | [l3meC5NHMOA](https://www.youtube.com/watch?v=l3meC5NHMOA), uploaded 2024-07-19 |
| **-88kg** | **16 / 16** | **16 (chaptered)** | **None.** One chapter names the wrong opponent. | [MyUe7tIEWHc](https://www.youtube.com/watch?v=MyUe7tIEWHc), uploaded 2024-08-10 |
| -99kg | 16 / 16 | 11 chaptered; rest unverified | Chapters have garbled names. No chapter for Jones v Costa (R1, 0:18 sub), Lovato v Trator (QF), Meregali v Simões (QF) or either semi-final. The "final" chapter runs about 75 min, so it probably contains the semi-finals as well. | [Lorr3RBNwFw](https://www.youtube.com/watch?v=Lorr3RBNwFw), uploaded 2024-07-27 |
| +99kg | 16 / 15 | 13 chapters, coarse | Bronze Match was a walkover (Pena withdrew). Rodriguez v Hansen (QF) and Ryan v Sousa (SF, 0:11 heel hook) have no chapter of their own. | [7wr1sMq2cu8](https://www.youtube.com/watch?v=7wr1sMq2cu8), uploaded 2024-08-03 |
| Absolute | 16 / 15 | 15 (chaptered) | Bronze Match was a walkover (Cyborg injured). It's an open-weight Bracket, not a weight class, and its Athletes overlap with the weight-class Brackets. | [9Bmb-ReK3AY](https://www.youtube.com/watch?v=9Bmb-ReK3AY) (3:26:55); also [u-3Xw89OpTw](https://www.youtube.com/watch?v=u-3Xw89OpTw) (3:06:37, plus the Ryan v Galvão superfight) |

Also on the same channel:

- [All seven finals](https://www.youtube.com/watch?v=RZ1UPMN7FNQ) (2:56:01), with timestamps in the description.
- Some single-Match uploads, e.g. [Jones v Meregali, 99kg SF](https://www.youtube.com/watch?v=cktdK6Lf6ts) and [Jones v Boehm, 99kg QF](https://www.youtube.com/watch?v=W_LGLQpmEzs). These could fill gaps if a Bracket video turns out to be missing a Match.

The chapters aren't in the video descriptions, so YouTube probably generated them automatically. Treat their names and boundaries as hints, not ground truth.

## -88kg Bracket: Matches and approximate start offsets

The offsets are chapter starts in `MyUe7tIEWHc`. They usually include the walk-out and introductions, so the annotator still sets the exact Match start and end offsets. Results are from MMASucka.

One spot looks wrong. The Barbosa v Rocha semi-final went to a referee decision, which means at least 10 minutes of regulation time, yet its chapter lasts only about 6 minutes. The next chapter, Bodoni's 2:18 submission, lasts about 18. So the boundary between them is probably misplaced, or the semi-final was trimmed. Check this one first.

| # | Round | Chapter start | Match | Result / Method |
|---|---|---|---|---|
| 1 | R1 | 0:00 | Vagner Rocha v Izaak Michell | Rocha, referee decision |
| 2 | R1 | 19:09 | Josh Hinger v Tye Ruotolo | Hinger, points 3-2 (OT) |
| 3 | R1 | 36:15 | Giancarlo Bodoni v Isaque Bahiense | Bodoni, points 6-0 (chapter wrongly says "v Izaak Michell") |
| 4 | R1 | 47:34 | Lucas "Hulk" Barbosa v Santeri Ilius | Barbosa, points 3-0 |
| 5 | R1 | 58:27 | Eoghan O'Flanagan v Xande Ribeiro | O'Flanagan, points 3-0 (OT) |
| 6 | R1 | 1:10:23 | Mason Fowler v Alexandre de Jesus | Fowler, guillotine 6:37 |
| 7 | R1 | 1:23:33 | Matheus Diniz v Roberto Dib Frias | Diniz, points 3-0 |
| 8 | R1 | 1:35:16 | Pedro Marinho v Jay (Jacob) Rodriguez | Marinho, points 3-2 |
| 9 | QF | 1:47:07 | Eoghan O'Flanagan v Mason Fowler | O'Flanagan, heel hook 5:57 |
| 10 | QF | 1:54:22 | Giancarlo Bodoni v Matheus Diniz | Bodoni, triangle 9:10 |
| 11 | QF | 2:05:28 | Lucas Barbosa v Josh Hinger | Barbosa, points 7-0 |
| 12 | QF | 2:16:57 | Vagner Rocha v Pedro Marinho | Rocha, referee decision |
| 13 | SF | 2:28:06 | Lucas Barbosa v Vagner Rocha | Barbosa, referee decision |
| 14 | SF | 2:33:59 | Giancarlo Bodoni v Eoghan O'Flanagan | Bodoni, toe hold 2:18 |
| 15 | Bronze | 2:51:53 | Vagner Rocha v Eoghan O'Flanagan | Rocha, toe hold 8:43 |
| 16 | Final | 3:01:24 | Giancarlo Bodoni v Lucas Barbosa | Bodoni, rear-naked choke 14:10 |

## What we couldn't verify

- Whether any Bracket video, including -88kg, shows every Match in full. Editors may have trimmed stalls, Resets or overtime. Only watching will tell. Check this while annotating #13, and record any Match that is cut short.
- Whether ADCC has its own official YouTube channel.
- Whether the replays on FloGrappling.com are behind the PRO paywall.
- The exact copyright holder (FloSports, ADCC or both). Neither the watch pages nor the descriptions state it.
- Results cross-checked against a second full-results source. Only MMASucka was readable, though its medallists match Wikipedia.
