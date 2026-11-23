# Oʻahu Road Trip

A free browser game for studying the **Hawaii instruction permit (learner's permit) written test**. Drive a lap around Oʻahu, clear each stop, and finish at Permit Day.

Made in Honolulu as a Christmas 2026 gift to the local tech and AI community.

## How it plays

- **12 stops around the island**, each covering one topic: Permit Basics (Kapolei), Lanes & Lines (Pearl City), Signals (Downtown), Right of Way (Waikīkī), Shapes & Colors (Hawaiʻi Kai), the **Sign Showdown** boss level with signs that have no words (Makapuʻu), Speed & Space (Waimānalo), Passing & Parking (Kailua), H-3 & Weather (Kāneʻohe), Share the Road (Lāʻie), Emergency Moves (Haleʻiwa) and Safe Choices (Wahiawā).
- **282 questions**, including 58 sign questions using 44 official US road signs (most of them symbol-only, like the real test shows). Some ask "what does this sign mean?" and others ask you to pick the right sign from four pictures.
- **10 questions per stop.** Get 8 right (80%, the game progression threshold) to earn 2 stars and unlock the next stop. 10/10 earns 3 stars.
- **Detour:** questions you miss come back at the end of the stop for another try.
- **Pit Stop:** a spaced-review round. Missed questions return the next day, and questions you keep getting right show up less often (after 1, 2, 4, 7 and 14 days).
- **Overtime:** a 60-second lightning round mixing every unlocked topic. Each miss costs 3 seconds.
- **Permit Day:** a 30-question game practice round with no hints until the end. The game target is 24 correct; HDOT currently describes its online knowledge test as 25 questions, so this mode is not an exact test simulation.
- **Flashcards:** think of the answer, flip, then rate yourself "Got it" or "Not yet". Any topic, even locked ones.
- **Sign Sprint:** 15 quick sign questions, mostly wordless.
- **Mastery and practice progress:** a question counts as mastered after 3 right answers in a row. The Practice Progress card marks a game goal when all stops are cleared, at least 80% of questions in every topic are mastered, and the last two Permit Day scores are 27/30 or better. This does not certify test readiness or driving skill.
- **Coach Corner:** a 2 to 3 week daily study plan, a "Sign Spotter" checklist for real car rides, and "Car Talk" why-questions with answers for parents.
- XP, levels, daily streaks, combos and badges.

### Why it works (study science)

- **Retrieval practice:** you recall answers instead of rereading.
- **Immediate feedback:** each answer explains *why* and cites the manual page.
- **Spacing:** Pit Stop schedules reviews just as you're about to forget.
- **Interleaving:** Overtime and Permit Day mix topics like the real test does.
- **Elaboration:** Car Talk asks *why* each rule exists, which makes rules easier to remember and apply.
- **Real-world practice:** Sign Spotter turns every car ride into a review session.
- **Mastery gates:** you only advance at 80%, and the game’s practice goals encourage continued review.

## Privacy

- No accounts, no server, no analytics, no cookies.
- Several players can share one device. Each picks a nickname and car color. Progress is saved only in that browser's `localStorage` and never leaves the device.
- Clearing browser data erases progress. **Save code backup** (on the map screen) turns a driver's progress into a text code or file. Restore it on the "Who's driving?" screen, on the same device or a new one. The code is validated field by field when it's restored.
- On iPhone, Safari may clear saved data for sites not opened in about a week. Adding the game to the Home Screen helps, and a save code covers the rest.

## License

[MIT](LICENSE). Free to use, share and adapt. The Hawaii Driver's Manual itself is © State of Hawaii and is not included in this repo.

## Content and accuracy

Questions use original wording. The general reference is the [HDOT English driver manual currently linked from its main library](https://hidot.hawaii.gov/highways/files/2024/11/2023-Hawaii-Drivers-Manual_5.375x8.375_Final-r3-Digital-071924web.pdf), the 2023 edition published online in 2024. Older HDOT landing pages still link an earlier printing. Current statutes and newer official safety guidance override outdated manual advice; selected questions cite those sources directly. A focused accuracy review on November 23, 2026 corrected confirmed issues and added current-law gaps. This was not a complete legal or instructor certification of all 282 questions.

Official sample questions begin in the manual appendix around page 99. They are linked for study, not reproduced in the game. See Coach Corner for the manual and current online-test requirements.

 **Road signs are the real ones.** Sign images in `signs/` are the official US sign designs from the Federal Highway Administration's *Manual on Uniform Traffic Control Devices* (MUTCD), which Hawaii uses. They're public domain, and these SVG files come from [Wikimedia Commons](https://commons.wikimedia.org/wiki/Category:Diagrams_of_road_signs_of_the_United_States) (files named `MUTCD <code>.svg`). Each file is named by its official sign code (for example `W4-1R.svg` is Merge). Hand-drawn art is used only for shape-only drills, two generic guide-sign examples, and the slow-moving vehicle emblem (an emblem on vehicles, not a road sign). The manual covers sign shapes and colors on pages 43 to 51.

This is a study aid, not the official test. Laws change between manual printings. Check the current manual and your county driver licensing office before your test, including the current test format (the game’s 30-question Permit Day format is extra practice, not the official online test format).

Found an error? Open an issue with the question ID (for example `s4`) and the manual page.

## Run it

It's a static site: plain HTML, CSS and JavaScript, no build step.

- **Locally:** serve this folder with any static server, for example `python3 -m http.server 8787`, then open http://localhost:8787. Opening `index.html` directly may block saving progress in some browsers.
- **Cloudflare Pages:** connect this repo in Workers & Pages. Framework preset: none. Build command: none. Build output directory: `/`.

## Files

```
index.html        page shell
css/style.css     all styles (dark "asphalt" theme, mobile first)
signs/            official MUTCD sign images (public domain), named by sign code
js/signs.js       sign list: which official image each sign uses, plus hand-drawn shape drills
js/questions.js   core question bank: id, topic, question, choices (first is correct), why, manual page
js/questions-more.js  wordless sign questions plus extra rules and scenarios
js/game.js        game logic: map, stops, spaced review, flashcards, Overtime, Permit Day, readiness, Coach Corner
```

### Adding questions

Add an object to `js/questions.js`:

```js
{ id: "s14", t: "signals", q: "Question text?", c: ["Correct answer", "Wrong", "Wrong", "Wrong"], why: "Short explanation.", src: "p. 41" }
```

`t` must match a stop topic: `basics`, `lines`, `signals`, `row`, `signs`, `symbols`, `speed`, `passing`, `freeway`, `share`, `emergency` or `safety`. Add `sign: "curve"` (any key in `js/signs.js`) to show a sign illustration. Add `cs: true` to make the choices sign pictures, then list sign keys in `c` (the first one is correct).
