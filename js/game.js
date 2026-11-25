/* Oʻahu Road Trip: a Hawaii permit study game.
   Plain JavaScript with server-verified Full Island Pass access. Progress lives in this
   browser's localStorage, per player profile. No names leave the device. */
(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Data
  // ------------------------------------------------------------------
  const MANUAL_URL = "https://hidot.hawaii.gov/highways/files/2024/11/2023-Hawaii-Drivers-Manual_5.375x8.375_Final-r3-Digital-071924web.pdf";
  let Q = [], QBY = {}, TOPIC_IDS = {};
  let access = {active:false,owner:false,hasRecoveryCode:false};
  let checkoutAvailable = false, testMode = true, questionTotal = 282;
  let KNOWN_Q_IDS = new Set();
  async function api(path, body) {
    const response = await fetch(path, {method:body === undefined ? "GET" : "POST",credentials:"same-origin",headers:body === undefined ? {} : {"Content-Type":"application/json"},body:body === undefined ? undefined : JSON.stringify(body),cache:"no-store"});
    let data;
    try { data = await response.json(); } catch { throw new Error("The app could not connect. Please try again."); }
    if (!response.ok) throw new Error(data.error || "Please try again.");
    return data;
  }
  async function loadAccess() {
    const data = await api("/api/bootstrap");
    Q = data.questions; QBY = Object.fromEntries(Q.map(q=>[q.id,q])); TOPIC_IDS = data.topicQuestionIds;
    KNOWN_Q_IDS = new Set(Object.values(TOPIC_IDS).flat());
    access = data.pass; checkoutAvailable = data.checkoutAvailable; testMode = data.testMode; questionTotal = data.totalQuestions;
  }
  function passGate(next) { if (access.active) return true; go(() => passScreen(next)); return false; }


  // Map positions come from real longitude/latitude, scaled onto a 1000x700 map.
  const STOPS = [
    { id: "kapolei",   name: "Kapolei",     topic: "basics",    title: "Permit Basics",      blurb: "Ages, permits and who rides shotgun.", x: 350, y: 550, side: "l" },
    { id: "pearl",     name: "Pearl City",  topic: "lines",     title: "Lanes & Lines",      blurb: "Yellow, white, solid, dashed.", x: 487, y: 462, side: "r" },
    { id: "downtown",  name: "Downtown",    topic: "signals",   title: "Signal Central",     blurb: "Lights, arrows and flashing X's.", x: 627, y: 578, side: "l" },
    { id: "waikiki",   name: "Waikīkī",     topic: "row",       title: "Right of Way",       blurb: "Who goes first, every time.", x: 672, y: 620, side: "r" },
    { id: "hawaiikai", name: "Hawaiʻi Kai", topic: "signs",     title: "Shapes & Colors",    blurb: "What each sign shape and color means.", x: 822, y: 610, side: "b" },
    { id: "makapuu",   name: "Makapuʻu",    topic: "symbols",   title: "Sign Showdown",      blurb: "Boss level: signs with no words.", x: 866, y: 578, side: "r", boss: true },
    { id: "waimanalo", name: "Waimānalo",   topic: "speed",     title: "Speed & Space",      blurb: "Following distance and signals.", x: 806, y: 537, side: "r" },
    { id: "kailua",    name: "Kailua",      topic: "passing",   title: "Passing & Parking",  blurb: "Pass smart, park right.", x: 772, y: 468, side: "r" },
    { id: "kaneohe",   name: "Kāneʻohe",    topic: "freeway",   title: "H-3 & Weather",      blurb: "Freeways, rain and fog.", x: 700, y: 446, side: "l" },
    { id: "laie",      name: "Lāʻie",       topic: "share",     title: "Share the Road",     blurb: "Bikes, motorcycles and big rigs.", x: 528, y: 150, side: "r" },
    { id: "haleiwa",   name: "Haleʻiwa",    topic: "emergency", title: "Emergency Moves",    blurb: "Blowouts, skids and crashes.", x: 325, y: 232, side: "l" },
    { id: "wahiawa",   name: "Wahiawā",     topic: "safety",    title: "Safe Choices",       blurb: "Alcohol, phones and seat belts.", x: 425, y: 329, side: "r" },
  ];
  const PERMIT_STOP = { name: "Kapālama Hale", x: 578, y: 532 };

  const LEG_LEN = 10;          // questions per stop
  const STAR_2 = 8;            // Game progression threshold; not an official test specification
  const STAR_1 = 6;
  const PERMIT_LEN = 30;
  const PERMIT_PASS = 24;      // 80%
  const OT_SECONDS = 60;
  const READY_SCORE = 27;      // Game practice goal, not a validated prediction of exam success
  const SPRINT_LEN = 15;
  const FLASH_LEN = 15;
  const BOXES = [0, 1, 2, 4, 7, 14]; // spaced-review intervals in days

  const COLORS = ["#ff5a5f", "#ffcc00", "#19b5c8", "#3ddc84", "#b07cff", "#ff8a3d", "#f4f6fb"];
  const LEVELS = [
    [0, "Passenger"], [100, "Backseat Navigator"], [250, "Learner"], [500, "Cruiser"],
    [800, "Road Scholar"], [1200, "Island Navigator"], [1700, "Kamaʻāina Driver"],
  ];
  const BADGES = [
    { id: "first",   ico: "1st",  name: "First Stop",      how: "Clear any stop" },
    { id: "perfect", ico: "10/10", name: "Perfect Drive",  how: "Get 10 out of 10 on a stop" },
    { id: "signs",   ico: "STOP", name: "Sign Master",     how: "3 stars at the Makapuʻu Sign Showdown" },
    { id: "signpro", ico: "SIGN", name: "Sign Pro",        how: "Master 80% of the no-words signs" },
    { id: "streak3", ico: "3",    name: "3-Day Streak",    how: "Study 3 days in a row" },
    { id: "streak7", ico: "7",    name: "Week Warrior",    how: "Study 7 days in a row" },
    { id: "ot20",    ico: "OT",   name: "Overtime Hero",   how: "Score 20+ in Overtime" },
    { id: "pit",     ico: "PIT",  name: "Pit Crew",        how: "Finish 5 Pit Stops" },
    { id: "island",  ico: "360",  name: "Round the Island", how: "2+ stars at every stop" },
    { id: "permit",  ico: "PASS", name: "Test Passer",     how: "Pass a Permit Day practice test" },
    { id: "ready",   ico: "100",  name: "Practice Milestone",    how: "Meet all three practice checks" },
  ];

  // ------------------------------------------------------------------
  // Storage (device only)
  // ------------------------------------------------------------------
  const KEY = "oahu-road-trip-v1";
  let store = { v: 1, active: null, profiles: {} };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) store = Object.assign(store, JSON.parse(raw));
  } catch (e) { /* private mode or blocked storage: play without saving */ }
  let canSave = true;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); }
    catch (e) { if (canSave) { canSave = false; toast("Heads up: this browser isn't saving progress."); } }
  }
  const P = () => store.profiles[store.active];

  function today() {
    const d = new Date();
    return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 864e5);
  }

  function newProfile(name, color) {
    const id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    store.profiles[id] = {
      id, name, color, xp: 0, streak: 0, lastDay: null, best: {}, cards: {}, badges: [],
      otBest: 0, permitBest: null, permitTries: 0, pits: 0, answered: 0, right: 0, sound: true, created: Date.now(),
    };
    store.active = id;
    save();
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------
  const app = document.getElementById("app");
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) document.documentElement.classList.add("anim");

  function level(xp) {
    let i = 0;
    while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1][0]) i++;
    const cur = LEVELS[i][0], next = LEVELS[i + 1] ? LEVELS[i + 1][0] : null;
    return { n: i + 1, title: LEVELS[i][1], pct: next ? Math.round(((xp - cur) / (next - cur)) * 100) : 100, next };
  }
  function stars(n) { return n >= LEG_LEN ? 3 : n >= STAR_2 ? 2 : n >= STAR_1 ? 1 : 0; }
  function starStr(s) { return "★".repeat(s) + "☆".repeat(3 - s); }
  function unlocked(i) { return access.owner || i === 0 || (access.active && (P().best[STOPS[i - 1].id] || 0) >= 2); }
  function nextStopIndex() { for (let i = 0; i < STOPS.length; i++) if ((P().best[STOPS[i].id] || 0) < 2) return i; return -1; }
  function dueCards() {
    const t = today(), p = P();
    return Object.entries(p.cards).filter(([id, c]) => QBY[id] && c.due <= t).sort((a, b) => a[1].box - b[1].box).map(([id]) => id);
  }

  const CONTENT_REVIEW = "2026-11-23-accuracy";
  const CORRECTED_IDS = ["a14", "h2", "a3", "a10", "e5", "f1", "f2", "f12", "e14", "b17", "s15"];
  function refreshCorrectedContent(p) {
    if (p.contentReview === CONTENT_REVIEW) return;
    CORRECTED_IDS.forEach(id => {
      if (p.cards[id]) p.cards[id] = Object.assign({}, p.cards[id], { box: 0, due: today() });
    });
    p.contentReview = CONTENT_REVIEW;
    save();
  }

  function sourceHTML(q) {
    const page = /(?:^|\s)p\.\s*(\d+)/.exec(q.src || "");
    const url = q.url || (q.id === "b4" ? "https://data.capitol.hawaii.gov/hrscurrent/Vol05_Ch0261-0319/HRS0286/HRS_0286-0110.htm" : "") || (MANUAL_URL + (page ? "#page=" + page[1] : ""));
    return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(q.src || "Official study source")}</a>`;
  }

  function carSVG(color, cls) {
    return `<svg class="${cls || ""}" viewBox="0 0 64 40" aria-hidden="true"><ellipse cx="32" cy="34" rx="29" ry="4" fill="#030b13" opacity=".5"/><path d="M4 25L9 21L20 11Q23 9 29 9H38Q42 9 46 14L52 21L59 23L62 28L60 33H4L2 29Z" fill="${color}" stroke="#102334" stroke-width="1.4"/><path d="M12 21L22 12H29V21ZM32 12H38Q40 12 43 16L47 21H32Z" fill="#183a50"/><path d="M14 19L23 13H28L20 20ZM34 13H38L43 19H34Z" fill="#8ed6e5" opacity=".7"/><path d="M5 25Q30 21 58 25" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="1.2"/><path d="M5 29H60L58 33H5Z" fill="#071b2a" opacity=".4"/><path d="M31 23V29M34 24H38" stroke="#173041" stroke-opacity=".55" fill="none"/><path d="M54 24H60L61 27H55Z" fill="#ebfbff"/><path d="M3 25H7V28H3Z" fill="#ff5858"/><path d="M8 12H19" stroke="${color}" stroke-width="2"/><circle cx="15" cy="31" r="6.5" fill="#07111c"/><circle cx="49" cy="31" r="6.5" fill="#07111c"/><circle cx="15" cy="31" r="4" fill="#b1c3cf"/><circle cx="49" cy="31" r="4" fill="#b1c3cf"/><path d="M15 27V35M11 31H19M49 27V35M45 31H53" stroke="#42586a" stroke-width="1.5"/><circle cx="15" cy="31" r="1.3" fill="#e9f6ff"/><circle cx="49" cy="31" r="1.3" fill="#e9f6ff"/></svg>`;
  }

  const SIGNS = window.ORT_SIGNS || {};
  const OFFICIAL = window.ORT_OFFICIAL || {};
  function signImg(kind, cls) {
    const s = SIGNS[kind];
    if (OFFICIAL[kind]) return `<img class="sign-img ${cls || ""}" src="signs/${OFFICIAL[kind]}.svg" alt="" draggable="false" loading="lazy">`;
    return s ? `<svg class="sign-img ${cls || ""}" viewBox="0 0 120 120" aria-hidden="true">${s.svg}</svg>` : "";
  }
  function signSVG(kind) {
    return SIGNS[kind] ? `<div class="sign-art" role="img" aria-label="Road sign">${signImg(kind)}</div>` : "";
  }
  // What to show for an answer: text, or a sign's meaning when choices are signs.
  const label = (q, v) => (q.cs && SIGNS[v] ? SIGNS[v].name : v);

  // Mastery: a question is "mastered" after 3 correct answers in a row.
  const MASTER_BOX = 3;
  function topicIds(t) { return TOPIC_IDS[t] || []; }
  function mastery(ids) {
    const c = P().cards;
    return ids.length ? ids.filter((id) => c[id] && c[id].box >= MASTER_BOX).length / ids.length : 0;
  }
  function readiness() {
    const p = P(), hist = p.permitHist || [];
    const cleared = STOPS.every((s) => (p.best[s.id] || 0) >= 2);
    const m = mastery([...KNOWN_Q_IDS]);
    const topicReady = STOPS.every(s => mastery(topicIds(s.topic)) >= 0.8);
    const lastTwo = hist.length >= 2 && hist.slice(-2).every((x) => x >= READY_SCORE);
    return { cleared, m, topicReady, lastTwo, ready: cleared && topicReady && lastTwo };
  }

  // Sound: tiny optional beeps
  let actx = null;
  function beep(good) {
    const p = P(); if (!p || !p.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = good ? "triangle" : "sawtooth";
      o.frequency.setValueAtTime(good ? 660 : 180, actx.currentTime);
      if (good) o.frequency.exponentialRampToValueAtTime(990, actx.currentTime + 0.12);
      g.gain.setValueAtTime(0.08, actx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.22);
      o.connect(g); g.connect(actx.destination); o.start(); o.stop(actx.currentTime + 0.23);
    } catch (e) { /* no audio */ }
  }

  function toast(msg) {
    const t = document.createElement("div");
    t.className = "toast"; t.setAttribute("role", "status"); t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2600);
  }
  function floatXP(n) {
    if (reduceMotion) return;
    const f = document.createElement("div");
    f.className = "float-xp"; f.textContent = "+" + n + " XP";
    document.body.appendChild(f); setTimeout(() => f.remove(), 900);
  }

  // Spaced review: Leitner boxes
  function grade(qid, ok) {
    const p = P(), t = today();
    const c = p.cards[qid] || { box: 0, due: t, r: 0, w: 0 };
    if (ok) { c.box = Math.min(c.box + 1, BOXES.length - 1); c.r++; }
    else { c.box = 0; c.w++; }
    c.due = t + BOXES[c.box];
    p.cards[qid] = c;
    p.answered++; if (ok) p.right++;
  }
  function pickFrom(ids, n) {
    // Weakest and never-seen first, randomized inside each group.
    const p = P();
    const score = (id) => (p.cards[id] ? p.cards[id].box + 1 : 0.5) + Math.random() * 1.5;
    return ids.slice().sort((a, b) => score(a) - score(b)).slice(0, n);
  }

  function award(id) {
    const p = P();
    if (!p.badges.includes(id)) { p.badges.push(id); const b = BADGES.find((x) => x.id === id); setTimeout(() => toast("Badge unlocked: " + b.name), 400); }
  }
  function touchStreak() {
    const p = P(), t = today();
    if (p.lastDay === t) return;
    p.streak = p.lastDay === t - 1 ? p.streak + 1 : 1;
    p.lastDay = t;
    if (p.streak >= 3) award("streak3");
    if (p.streak >= 7) award("streak7");
  }

  // ------------------------------------------------------------------
  // Screens
  // ------------------------------------------------------------------
  let session = null;
  let tick = null;
  function clearTick() { if (tick) { clearInterval(tick); tick = null; } }
  function go(fn) { clearTick(); document.onkeydown = null; fn(); window.scrollTo(0, 0); }

  // ------------------------------------------------------------------
  // Home (garage): animated island scene, drivers, what's inside, sign teaser
  // ------------------------------------------------------------------
  function heroScene() {
    return `<img class="hero-art" src="assets/oahu-racing-hero-v3.png" width="1774" height="887" alt="Racing-game scene of a coral sports coupe on an imagined island coastal road" fetchpriority="high" decoding="async">`;
  }

  function teaser() {
    const pool = Q.filter((q) => q.t === "symbols" && q.sign && !q.cs);
    const q = pool[Math.floor(Math.random() * pool.length)];
    const opts = shuffle([q.c[0]].concat(shuffle(q.c.slice(1)).slice(0, 2)));
    return { q, opts };
  }
  function renderTeaser() {
    const box = app.querySelector("#teaser"); if (!box) return;
    const { q, opts } = teaser();
    box.innerHTML = `
      <div class="teaser-sign">${signImg(q.sign)}</div>
      <div class="teaser-body">
        <div class="kicker">Quick quiz: no words, no problem?</div>
        <h3>What does this sign mean?</h3>
        <div class="teaser-choices">${opts.map((o, k) => `<button class="tchoice" data-k="${k}">${esc(o)}</button>`).join("")}</div>
        <div class="teaser-fb" aria-live="polite"></div>
      </div>`;
    box.querySelectorAll(".tchoice").forEach((b) => b.onclick = () => {
      const ok = opts[+b.dataset.k] === q.c[0];
      box.querySelectorAll(".tchoice").forEach((x, j) => { x.disabled = true; if (opts[j] === q.c[0]) x.classList.add("right"); else if (x === b) x.classList.add("wrong"); });
      box.querySelector(".teaser-fb").innerHTML = `<b>${ok ? pick(["Shoots! You know your signs.", "Chee-hoo! Nailed it.", "Right on!"]) : "Not quite. Good thing there's a whole boss level for this."}</b> <span class="muted">${esc(q.why)}</span>
        <div class="row" style="margin-top:10px"><button class="btn ghost" id="another">Try another sign</button></div>`;
      if (ok) confetti();
      box.querySelector("#another").onclick = renderTeaser;
    });
  }

  function garage() {
    const ps = Object.values(store.profiles).sort((a, b) => b.created - a.created);
    const tile = (sign, title, text, color) => `<div class="tile" style="--tile:${color}"><div class="tile-ico">${signImg(sign)}</div><div><b>${title}</b><p>${text}</p></div></div>`;
    app.innerHTML = `
      <div class="home-hero">
        ${heroScene()}
        <div class="hero-text">
          <span class="badge-pill">Hawaii learner's permit study game</span>
          <h1 class="title-pop"><span class="t1">Oʻahu</span> <span class="t2">Road Trip</span></h1>
          <p class="hero-sub">Learn the rules. Try them out. <b>Earn your way around Oʻahu.</b></p>
        </div>
      </div>

      <p class="pass-status">${testMode ? "Test environment · no real payments · " : ""}Level 1 is free. Full Island Pass: <b>$9.99 total</b>, one time.</p>
      <section class="garage">
        <h2>${ps.length ? "Who's driving?" : "Ready to roll?"}</h2>
        <div class="profiles">
          ${ps.map((p) => {
            const done = STOPS.filter((s) => (p.best[s.id] || 0) >= 2).length;
            return `<button class="profile garage-card" data-id="${p.id}" style="--car:${p.color}">
              ${carSVG(p.color, "car-badge")}
              <span class="gc-body"><span class="name">${esc(p.name)}</span>
                <span class="meta">Lv ${level(p.xp).n} ${esc(level(p.xp).title)} · ${p.streak} day streak</span>
                <span class="mini-bar"><i style="width:${Math.round((done / STOPS.length) * 100)}%"></i></span>
                <span class="meta">${done}/${STOPS.length} stops cleared</span></span>
              <span class="go-arrow" aria-hidden="true">›</span></button>`;
          }).join("")}
        </div>
        <div class="row" style="margin-top:14px">
          <button class="btn primary big start-btn" id="new">${ps.length ? "+ New driver" : "Start learning"}</button>
          <button class="btn ghost big" id="home-pass">${access.active ? "My Full Island Pass" : "Full Island Pass · $9.99"}</button>
          <button class="btn ghost" id="restore">Restore from save code</button>
        </div>
      </section>

      <section class="card learning-intro"><h2>Your road trip starts here</h2><p>Pick a nickname and a car. We’ll teach you before we test you.</p><ol class="journey-steps"><li><b>Learn</b><span>Your road tips on one easy page</span></li><li><b>Practice</b><span>Optional help before your challenge</span></li><li><b>Earn stars</b><span>Take the challenge and unlock your next stop</span></li></ol></section>

      <section>
        <details class="menu-group"><summary>Explore the game modes</summary>
        <div class="tiles">
          ${tile("guide", "12 island stops", "Kapolei to Haleʻiwa, one topic per stop. Score 80% to unlock the next.", "#19b5c8")}
          ${tile("octagon", "Sign Showdown boss", "Signs with no words. Know them by shape, color and picture.", "#ff5a5f")}
          ${tile("signal", "Overtime", "60-second lightning round. How many can you get?", "#ffcc00")}
          ${tile("interstate", "Permit Day", "The final boss: a full 30-question practice test.", "#b07cff")}
          ${tile("crossroad", "Streaks and badges", "Level up from Passenger to Kamaʻāina Driver.", "#3ddc84")}
          ${tile("school", "Coach Corner", "A study plan and car-ride challenges for parents too.", "#ff8a3d")}
        </div>
        </details>
      </section>

      <div class="footer">
        <p>First level free. No ads. Learning progress stays on this device; use a save code to back it up. Paid access uses a private browser session and recovery code. Checkout is handled by Stripe. Use a nickname, not your real name.</p>
        <p>Questions are based on the official Hawaii Driver's Manual (Hawaii DOT). This is a study aid, not the official test. Always check the current manual and your county driver licensing office.</p>
        <p>Made with aloha in Honolulu for the local tech and AI community.</p>
      </div>`;
    app.querySelectorAll(".garage-card").forEach((b) => b.onclick = () => { store.active = b.dataset.id; save(); go(map); });
    app.querySelector("#new").onclick = () => go(createProfile);
    app.querySelector("#restore").onclick = () => go(restoreScreen);
    app.querySelector("#home-pass").onclick = () => go(() => passScreen());

  }

  // Confetti for big wins (skipped when the device prefers reduced motion)
  function confetti() {
    if (reduceMotion) return;
    const colors = ["#ffcc00", "#ff5a5f", "#19b5c8", "#3ddc84", "#b07cff", "#ff8a3d"];
    const wrap = document.createElement("div"); wrap.className = "confetti"; wrap.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 90; i++) {
      const c = document.createElement("i");
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colors[i % colors.length];
      c.style.animationDelay = Math.random() * 0.4 + "s";
      c.style.animationDuration = 1.6 + Math.random() * 1.2 + "s";
      c.style.setProperty("--drift", (Math.random() * 160 - 80) + "px");
      c.style.setProperty("--spin", (Math.random() * 720 + 360) + "deg");
      wrap.appendChild(c);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 3200);
  }

  function createProfile() {
    let color = COLORS[Math.floor(Math.random() * COLORS.length)];
    app.innerHTML = `
      <div class="card stack">
        <h2>New driver</h2>
        <label for="nm" class="small muted">Nickname (shown only on this device)</label>
        <input id="nm" class="field" maxlength="16" autocomplete="off" placeholder="e.g. TurboTurtle">
        <div class="small muted">Pick your ride</div>
        <div class="row"><div id="preview" style="width:120px">${carSVG(color)}</div>
          <div class="swatches">${COLORS.map((c) => `<button class="swatch" style="background:${c}" data-c="${c}" aria-label="Car color" aria-pressed="${c === color}"></button>`).join("")}</div></div>
        <div class="row"><button class="btn primary big" id="ok">Start the engine</button><button class="btn ghost" id="back">Back</button></div>
      </div>`;
    const nm = app.querySelector("#nm"); nm.focus();
    app.querySelectorAll(".swatch").forEach((s) => s.onclick = () => {
      color = s.dataset.c; app.querySelector("#preview").innerHTML = carSVG(color);
      app.querySelectorAll(".swatch").forEach((x) => x.setAttribute("aria-pressed", x === s));
    });
    const ok = () => { const n = nm.value.trim(); if (!n) { nm.focus(); toast("Give your driver a nickname"); return; } newProfile(n, color); go(map); };
    app.querySelector("#ok").onclick = ok;
    nm.onkeydown = (e) => { if (e.key === "Enter") ok(); };
    app.querySelector("#back").onclick = () => go(Object.keys(store.profiles).length ? garage : createProfile);
  }

  function hud() {
    const p = P(), lv = level(p.xp);
    return `
      <div class="hud">
        <button class="chip" id="garage" title="Switch driver">${carSVG(p.color, "car-badge")} ${esc(p.name)}</button>
        <span class="chip">Lv <b>${lv.n}</b> ${esc(lv.title)}</span>
        <span class="chip">XP <b>${p.xp}</b></span>
        <span class="chip streak">Streak <b>${p.streak}</b> day${p.streak === 1 ? "" : "s"}</span>
        <span class="spacer"></span>
        <button class="chip pass-chip" id="pass-account">${access.active ? (access.owner ? "Owner pass" : "Full Island Pass") : "Level 1 free"}</button>
        <button class="chip" id="snd" aria-pressed="${p.sound}">Sound ${p.sound ? "on" : "off"}</button>
      </div>
      <div class="xpbar" title="Progress to next level"><i style="width:${lv.pct}%"></i></div>`;
  }
  function wireHud() {
    app.querySelector("#pass-account").onclick = () => go(() => passScreen());
    app.querySelector("#garage").onclick = () => go(garage);
    app.querySelector("#snd").onclick = () => { P().sound = !P().sound; save(); go(map); };
  }

  function mapSVG() {
    const p = P(), nx = nextStopIndex();
    const pts = STOPS.map((s) => `${s.x},${s.y}`).concat(`${PERMIT_STOP.x},${PERMIT_STOP.y}`);
    let doneUpTo = 0;
    for (let i = 0; i < STOPS.length; i++) if ((p.best[STOPS[i].id] || 0) >= 2) doneUpTo = i + 1; else break;
    const donePts = pts.slice(0, Math.max(1, doneUpTo + (doneUpTo < STOPS.length ? 1 : 1)));
    const carAt = nx === -1 ? PERMIT_STOP : STOPS[nx];
    // Coastline traced from real lon/lat points (x = 75 + (lon+158.30)*1250, y = 20 + (21.73-lat)*1343).
    const island = "100,228 160,222 225,221 275,214 319,201 369,141 400,94 440,62 462,47 505,82 550,127 569,181 605,220 637,255 656,302 672,345 687,396 720,415 750,423 776,392 800,383 812,398 806,409 790,420 794,463 812,500 837,550 870,566 887,584 868,620 837,644 812,631 760,640 715,650 687,658 662,638 640,610 612,591 580,584 550,577 494,577 500,540 500,503 475,490 450,512 450,530 469,571 450,584 380,592 312,597 294,557 250,483 206,403 175,362 150,310 137,262";
    return `
    <svg class="map" viewBox="0 0 1000 700" role="img" aria-label="Map of Oʻahu with ${STOPS.length} stops">
      <defs><linearGradient id="island-terrain" x2=".8" y2="1"><stop stop-color="#b6cc70"/><stop offset=".45" stop-color="#4d9457"/><stop offset="1" stop-color="#1b684d"/></linearGradient><radialGradient id="map-water"><stop stop-color="#188c9d"/><stop offset="1" stop-color="#0b304c"/></radialGradient></defs><rect width="1000" height="700" fill="url(#map-water)"/><path class="wave" d="M40 80 q20 -12 40 0 t40 0"/><path class="wave" d="M860 160 q20 -12 40 0 t40 0"/><path class="wave" d="M120 640 q20 -12 40 0 t40 0"/><path class="wave" d="M900 300 q20 -12 40 0 t40 0"/>
      <polygon class="island" points="${island}"/>
      <polyline class="ridge" points="150,285 205,330 255,405 300,490"/>
      <polyline class="ridge" points="470,100 535,175 590,255 640,345 672,420 715,505 790,585"/>
      <polyline class="route" points="${pts.join(" ")}"/>
      <polyline class="route-dash" points="${pts.join(" ")}"/>
      ${doneUpTo > 0 ? `<polyline class="route-done" points="${donePts.join(" ")}"/>` : ""}
      <text class="label" x="110" y="110" style="font-family:var(--display);font-size:34px;fill:var(--line)">OʻAHU</text>
      <text class="label" x="110" y="138" style="font-size:14px;fill:#bfe9f2">Road Trip</text>
      ${STOPS.map((s, i) => {
        const st = p.best[s.id] || 0, lock = !unlocked(i);
        const fill = st >= 2 ? "var(--go)" : s.boss ? "var(--coral)" : "var(--line)";
        const left = s.side === "l", below = s.side === "b";
        const lx = below ? s.x : left ? s.x - 18 : s.x + 18, anchor = below ? "middle" : left ? "end" : "start";
        const ly = below ? s.y + 34 : s.y - 6, sy = below ? s.y + 50 : s.y + 13;
        return `<g class="stop ${lock ? "locked" : ""} ${i === nx ? "next" : ""}" data-i="${i}" tabindex="${lock && !(i > 0 && !access.active) ? -1 : 0}" role="button" aria-label="Stop ${i + 1}: ${esc(s.name)}, ${esc(s.title)}${i > 0 && !access.active ? ", Full Island Pass" : lock ? ", earn 2 stars at the previous stop" : ""}">
          <circle class="ring" cx="${s.x}" cy="${s.y}" r="18"/>
          <circle class="stop-dot" cx="${s.x}" cy="${s.y}" r="13" fill="${fill}"/>
          <text class="label" x="${lx}" y="${ly}" text-anchor="${anchor}">${esc(s.name)}</text>
          ${st ? `<text class="stars" x="${lx}" y="${sy}" text-anchor="${anchor}">${starStr(st)}</text>` : s.boss ? `<text class="boss-tag" x="${lx}" y="${sy}" text-anchor="${anchor}">BOSS</text>` : ""}
        </g>`;
      }).join("")}
      <g class="stop" data-permit="1" tabindex="0" role="button" aria-label="Permit Day final test at ${PERMIT_STOP.name}">
        <rect x="${PERMIT_STOP.x - 14}" y="${PERMIT_STOP.y - 14}" width="28" height="28" rx="6" fill="#fff" stroke="#0d1119" stroke-width="4"/>
        <text class="label" x="${PERMIT_STOP.x - 10}" y="${PERMIT_STOP.y - 22}" text-anchor="end">Permit Day</text>
      </g>
      <g transform="translate(${carAt.x - 30},${carAt.y - 50})">${carSVG(p.color).replace("<svg ", '<svg width="60" height="38" ')}</g>
    </svg>`;
  }

  function map() {
    const p = P(); if (!p) return go(garage);
    refreshCorrectedContent(p);
    const due = dueCards().length, nx = nextStopIndex();
    const cleared = STOPS.filter((s) => (p.best[s.id] || 0) >= 2).length;
    app.innerHTML = `
      ${hud()}
      ${testMode ? `<p class="pass-status">Test environment: checkout uses test payments only.</p>` : ""}
      <section class="card next-drive">
        <div class="kicker">${cleared ? "Your next adventure" : "Start here · Stop 1 of 12"}</div>
        <h1>${nx >= 0 ? esc(STOPS[nx].name) + ": " + esc(STOPS[nx].title) : "You’ve travelled the island!"}</h1>
        <p>Read your roadside briefing. Then earn stars in a 10-question challenge.</p>
        <button class="btn primary big" id="m-next">${nx > 0 && !access.active ? "Unlock the full island · $9.99" : nx >= 0 ? (cleared ? "Continue learning" : "Start learning in Kapolei") : "Revisit your first stop"}</button>
        <p class="small muted">No timer on the learning route. Mistakes are part of the trip.</p>
      </section>
      <div class="map-wrap">${mapSVG()}</div>
      <p class="small muted center">${cleared}/${STOPS.length} stops cleared · ${access.active ? "Earn stars to open the next stop." : "Kapolei is free. A Full Island Pass opens the remaining route and tools."}</p>
      ${!access.active ? `<section class="card pass-teaser"><h2>Keep your road trip going</h2><p>11 more stops, practice games and your Permit Day challenge.</p><button class="btn primary" id="m-pass">See Full Island Pass · $9.99 once</button><button class="btn ghost" id="m-restore-pass">Already have a pass?</button></section>` : ""}
      <details class="menu-group"><summary>Practice & quick games <span>Flashcards, signs, daily review and speed rounds</span></summary><div class="modes">
        <button class="mode pit" id="m-pit"><h3>Pit Stop</h3><p>Start here each day: review what you missed or are due to see again.</p><span class="pill">${due ? due + " due now" : "Nothing due"}</span></button>
        <button class="mode" id="m-flash"><h3>Flashcards</h3><p>Think of the answer first, then flip. Pick any topic, even locked ones.</p><span class="pill">Self-check</span></button>
        <button class="mode boss" id="m-sprint"><h3>Sign Sprint</h3><p>${SPRINT_LEN} signs, most with no words. Know them by shape, color and picture.</p><span class="pill">Mastered: ${Math.round(mastery(topicIds("symbols")) * 100)}%</span></button>
        <button class="mode ot" id="m-ot"><h3>Overtime</h3><p>${OT_SECONDS}-second lightning round from every stop you've unlocked.</p><span class="pill">Best: ${p.otBest}</span></button>
      </div></details><details class="menu-group"><summary>Test readiness & coach <span>Permit Day and Coach Corner</span></summary><div class="modes">
        <button class="mode boss" id="m-permit"><h3>Permit Day</h3><p>Practice test: ${PERMIT_LEN} questions from all over the island. No hints until the end.</p><span class="pill">${p.permitBest === null ? "Not tried yet" : "Best: " + p.permitBest + "/" + PERMIT_LEN}</span></button>
        <button class="mode pit" id="m-coach"><h3>Coach Corner</h3><p>Study plan, car-ride sign spotting and "why" questions for parents.</p><span class="pill">For drivers and parents</span></button>
      </div>
      </details>
      <details class="menu-group"><summary>Your route <span>All 12 stops and your stars</span></summary>
      <h3 style="margin-top:22px">All stops</h3>
      <div class="stop-list">
        ${STOPS.map((s, i) => {
          const st = p.best[s.id] || 0, lock = !unlocked(i), m = Math.round(mastery(topicIds(s.topic)) * 100);
          return `<button class="stop-row ${st >= 2 ? "done" : ""} ${i === nx ? "next" : ""}" data-i="${i}" ${lock && !(i > 0 && !access.active) ? "disabled" : ""}>
            <span class="num">${i + 1}</span><span><span class="title">${esc(s.name)}</span><br><span class="sub">${esc(s.title)}${i > 0 && !access.active ? " · Full Island Pass" : lock ? " · earn 2 stars at the previous stop" : ` · ${m}% mastered`}</span></span>
            <span class="st">${st ? starStr(st) : s.boss ? "BOSS" : ""}</span></button>`;
        }).join("")}
      </div>
      </details>
      <details class="menu-group"><summary>Progress & driver tools <span>Readiness, badges, backup and driver settings</span></summary>
      ${readyCard()}
      <div class="row" style="margin-top:22px"><button class="btn ghost" id="m-badges">Badges (${p.badges.length}/${BADGES.length})</button><button class="btn ghost" id="m-save">Save code backup</button><span class="spacer"></span><button class="linkish" id="m-del">Delete this driver</button></div>
      </details>
      <div class="footer"><p>Based on the <a href="${MANUAL_URL}" target="_blank" rel="noopener">official Hawaii Driver’s Manual</a>. Study aid only. The manual remains free to read. Learning progress stays on this device; purchase access uses a secure browser cookie and a private recovery code.</p></div>`;
    wireHud();
    const passButton=app.querySelector("#m-pass"); if(passButton) passButton.onclick=()=>go(()=>passScreen());
    const restoreButton=app.querySelector("#m-restore-pass"); if(restoreButton) restoreButton.onclick=()=>go(()=>restorePass());
    const openStop = (i) => { if (i > 0 && !access.active) return go(()=>passScreen(()=>startLeg(i))); if (unlocked(i)) go(() => startLeg(i)); else toast("Clear the stop before it with 2 stars first"); };
    app.querySelectorAll(".map .stop[data-i]").forEach((g) => {
      g.onclick = () => openStop(+g.dataset.i);
      g.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openStop(+g.dataset.i); } };
    });
    const pd = app.querySelector('.map [data-permit]');
    pd.onclick = () => go(startPermit); pd.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(startPermit); } };
    app.querySelectorAll(".stop-row").forEach((b) => b.onclick = () => openStop(+b.dataset.i));
    const mn = app.querySelector("#m-next"); if (mn) mn.onclick = () => openStop(nx >= 0 ? nx : 0);
    app.querySelector("#m-pit").onclick = () => go(startPit);
    app.querySelector("#m-ot").onclick = () => go(startOT);
    app.querySelector("#m-permit").onclick = () => go(startPermit);
    app.querySelector("#m-badges").onclick = () => go(badges);
    app.querySelector("#m-flash").onclick = () => go(flashPick);
    app.querySelector("#m-sprint").onclick = () => go(startSprint);
    app.querySelector("#m-coach").onclick = () => go(coach);
    app.querySelector("#m-save").onclick = () => go(backupScreen);
    app.querySelector("#m-del").onclick = () => {
      if (confirm(`Delete ${p.name} and all their progress on this device? This can't be undone.`)) {
        delete store.profiles[p.id]; store.active = null; save(); go(garage);
      }
    };
  }

  // ------------------------------------------------------------------
  // Save code: back up a driver as text (or a file), restore anywhere.
  // Nothing is uploaded. The code IS the data, so whoever has it can restore it.
  // ------------------------------------------------------------------
  const CODE_PREFIX = "ORT1.";
  const b64e = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const b64d = (s) => { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; return decodeURIComponent(escape(atob(s))); };

  function makeCode(p) {
    const cards = Object.entries(p.cards).filter(([id]) => KNOWN_Q_IDS.has(id)).map(([id, c]) => [id, c.box, c.due, c.r, c.w]);
    const data = { v: 1, n: p.name, c: p.color, x: p.xp, s: p.streak, l: p.lastDay, b: p.best, k: cards, g: p.badges,
      o: p.otBest, pb: p.permitBest, pt: p.permitTries, ph: p.permitHist || [], pi: p.pits, a: p.answered, r: p.right, sp: p.spotted || [] };
    return CODE_PREFIX + b64e(JSON.stringify(data));
  }

  // Strictly rebuild a profile from untrusted text: only known fields, right types, sane ranges.
  function readCode(text) {
    const raw = String(text || "").replace(/\s+/g, "");
    if (!raw.startsWith(CODE_PREFIX)) throw new Error("That doesn't look like an Oʻahu Road Trip save code.");
    let d;
    try { d = JSON.parse(b64d(raw.slice(CODE_PREFIX.length))); } catch (e) { throw new Error("That save code is incomplete or damaged. Copy the whole thing and try again."); }
    if (!d || d.v !== 1) throw new Error("This save code is from a different version.");
    const int = (v, lo, hi, def) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, Math.round(v))) : def);
    const stopIds = new Set(STOPS.map((s) => s.id)), badgeIds = new Set(BADGES.map((b) => b.id));
    const best = {};
    if (d.b && typeof d.b === "object") for (const [k, v] of Object.entries(d.b)) if (stopIds.has(k)) best[k] = int(v, 0, 3, 0);
    const cards = {};
    if (Array.isArray(d.k)) for (const row of d.k) {
      if (!Array.isArray(row) || !KNOWN_Q_IDS.has(row[0])) continue;
      cards[row[0]] = { box: int(row[1], 0, BOXES.length - 1, 0), due: int(row[2], 0, 1e6, today()), r: int(row[3], 0, 1e6, 0), w: int(row[4], 0, 1e6, 0) };
    }
    const name = String(d.n || "Driver").slice(0, 16).trim() || "Driver";
    return {
      name, color: COLORS.includes(d.c) ? d.c : COLORS[0], xp: int(d.x, 0, 1e7, 0), streak: int(d.s, 0, 1e4, 0),
      lastDay: Number.isFinite(d.l) ? int(d.l, 0, 1e6, null) : null, best, cards,
      badges: Array.isArray(d.g) ? d.g.filter((x) => badgeIds.has(x)) : [],
      otBest: int(d.o, 0, 1e4, 0), permitBest: Number.isFinite(d.pb) ? int(d.pb, 0, PERMIT_LEN, null) : null,
      permitTries: int(d.pt, 0, 1e5, 0), permitHist: Array.isArray(d.ph) ? d.ph.map((x) => int(x, 0, PERMIT_LEN, 0)).slice(-10) : [],
      pits: int(d.pi, 0, 1e5, 0), answered: int(d.a, 0, 1e7, 0), right: int(d.r, 0, 1e7, 0),
      spotted: Array.isArray(d.sp) ? d.sp.filter((k) => typeof k === "string" && SIGNS[k]) : [],
    };
  }

  function backupScreen() {
    const p = P(), code = makeCode(p);
    app.innerHTML = `${hud()}
      <div class="card stack" style="margin-top:14px">
        <h2>Save code backup</h2>
        <p>This code holds all of <b>${esc(p.name)}</b>'s progress. Keep a copy somewhere safe, like a note or a text to yourself. Use it to restore progress if browser data gets cleared, or to keep playing on a different phone or computer.</p>
        <p class="small muted">Nothing is uploaded anywhere. Anyone with this code can load this progress, so only share it with people you trust.</p>
        <textarea class="field code" id="code" readonly rows="5" aria-label="Save code">${esc(code)}</textarea>
        <div class="row">
          <button class="btn primary big" id="copy">Copy code</button>
          <button class="btn ghost" id="dl">Download as file</button>
          ${navigator.share ? `<button class="btn ghost" id="share">Share</button>` : ""}
        </div>
        <p class="small muted">Saved ${new Date().toLocaleDateString()}. Make a fresh code after big study sessions, since an older code won't include newer progress.</p>
        <p class="small muted">iPhone tip: Safari can clear a website's saved data if you don't open it for about a week. Add this game to your Home Screen (Share, then Add to Home Screen) to help keep progress, and keep a save code just in case.</p>
        <button class="btn ghost" id="back">Back to the map</button>
      </div>`;
    wireHud();
    const ta = app.querySelector("#code");
    ta.onclick = () => ta.select();
    app.querySelector("#copy").onclick = async () => {
      try { await navigator.clipboard.writeText(code); toast("Save code copied"); }
      catch (e) { ta.select(); try { document.execCommand("copy"); toast("Save code copied"); } catch (e2) { toast("Select the code and copy it"); } }
    };
    app.querySelector("#dl").onclick = () => {
      const blob = new Blob([code], { type: "text/plain" }), a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `oahu-road-trip-${p.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "driver"}-${new Date().toISOString().slice(0, 10)}.txt`;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const sh = app.querySelector("#share");
    if (sh) sh.onclick = () => navigator.share({ title: "Oʻahu Road Trip save code", text: code }).catch(() => {});
    app.querySelector("#back").onclick = () => go(map);
  }

  function restoreScreen() {
    app.innerHTML = `
      <div class="card stack" style="margin-top:14px">
        <h2>Restore from save code</h2>
        <p>Paste a save code, or open a save code file. This adds the driver to this device.</p>
        <textarea class="field code" id="code" rows="5" placeholder="ORT1.…" aria-label="Paste save code"></textarea>
        <label class="small muted">Or choose a file: <input type="file" id="file" accept=".txt,text/plain"></label>
        <div class="row"><button class="btn primary big" id="ok">Restore</button><button class="btn ghost" id="back">Back</button></div>
      </div>`;
    const ta = app.querySelector("#code");
    app.querySelector("#file").onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 500000) { toast("That file is too big to be a save code"); return; }
      f.text().then((t) => { ta.value = t.trim(); });
    };
    app.querySelector("#back").onclick = () => go(garage);
    app.querySelector("#ok").onclick = () => {
      let data;
      try { data = readCode(ta.value); } catch (e) { toast(e.message); return; }
      const same = Object.values(store.profiles).find((x) => x.name.toLowerCase() === data.name.toLowerCase());
      if (same) {
        if (!confirm(`${same.name} already exists on this device. Replace their progress with the save code? (Cancel keeps both.)`)) {
          data.name = (data.name + " 2").slice(0, 16);
        } else { delete store.profiles[same.id]; }
      }
      newProfile(data.name, data.color);
      Object.assign(P(), data, { sound: true });
      save(); toast(`Welcome back, ${data.name}!`); go(map);
    };
  }

  function badges() {
    const p = P();
    app.innerHTML = `${hud()}
      <div class="card stack" style="margin-top:14px">
        <h2>Badges</h2>
        <div class="badges">${BADGES.map((b) => `<div class="badge ${p.badges.includes(b.id) ? "" : "locked"}"><span class="ico">${b.ico}</span><b>${esc(b.name)}</b><br><span class="muted">${esc(b.how)}</span></div>`).join("")}</div>
        <div class="stat-grid">
          <div class="stat"><b>${p.answered}</b><span>answered</span></div>
          <div class="stat"><b>${p.answered ? Math.round((p.right / p.answered) * 100) : 0}%</b><span>accuracy</span></div>
          <div class="stat"><b>${Object.keys(p.cards).length}/${questionTotal}</b><span>questions seen</span></div>
        </div>
        <button class="btn primary" id="back">Back to the map</button>
      </div>`;
    wireHud();
    app.querySelector("#back").onclick = () => go(map);
  }

  // ------------------------------------------------------------------
  // Sessions: leg (stop), pit (review), ot (timed), permit (mock test)
  // ------------------------------------------------------------------
  function begin(mode, ids, extra) {
    if ((mode !== "leg" || extra?.stop > 0) && !passGate(()=>begin(mode,ids,extra))) return;
    session = Object.assign({ mode, queue: ids, i: 0, results: [], combo: 0, bestCombo: 0, xp: 0, detour: [], inDetour: false }, extra || {});
    touchStreak(); save();
    ask();
  }
  function startLeg(i) {
    if (i > 0 && !passGate(()=>startLeg(i))) return;
    if (!unlocked(i)) { toast("Earn 2 stars at the previous stop first."); return go(map); }
    const s = STOPS[i];
    const ids = pickFrom(Q.filter((q) => q.t === s.topic).map((q) => q.id), LEG_LEN);
    go(() => roadBriefing(i, ids));
  }
  // One page of study material for the exact questions in the next challenge.
  // Reading or practicing never awards mastery, XP, or stars.
  function roadBriefing(stop, ids) {
    const s = STOPS[stop];
    const tips = ids.map(id => QBY[id]);
    app.innerHTML = `<section class="briefing-page">
      <nav class="drive-top briefing-nav"><button class="btn ghost" id="briefing-map">Back to map</button><span class="briefing-level">Stop ${stop + 1} of ${STOPS.length} · ${esc(s.name)}</span></nav>
      <header class="briefing-header"><span class="briefing-tag">Roadside briefing</span><h1>${esc(s.title)}</h1><p>Your next mission: ${esc(s.blurb)} Read these ${tips.length} tips, then put them into play.</p><div class="briefing-route" aria-label="Briefing, then challenge, then stars"><span class="active">1. Briefing</span><span>2. Challenge</span><span>3. Stars</span></div></header>
      <ol class="briefing-tips">${tips.map((q,i) => `<li class="briefing-tip" data-tip="${esc(q.id)}"><span class="briefing-number" aria-hidden="true">${String(i+1).padStart(2,"0")}</span><div>${q.sign ? signSVG(q.sign) : ""}${q.cs ? `<div class="briefing-sign">${signImg(q.c[0])}<span>${esc(label(q,q.c[0]))}</span></div>` : ""}<h2>${esc(q.q)}</h2><p>${esc(q.why)}</p></div></li>`).join("")}</ol>
      <footer class="card briefing-ready"><h2>Ready for your challenge?</h2><p>${tips.length} questions, no timer. Earn ${STAR_2} correct answers for 2 stars and the next stop. Misses get another practice lap.</p><div class="row"><button class="btn primary big" id="briefing-challenge">Start the ${tips.length}-question challenge</button><button class="btn ghost" id="briefing-practice">Practice with help first</button><button class="btn ghost" id="briefing-print">Print briefing</button></div></footer>
      <details class="briefing-sources"><summary>Study sources</summary><p>This briefing is a game study aid. Check the current official guidance before driving or testing.</p><ol>${tips.map(q=>`<li>${sourceHTML(q)}</li>`).join("")}</ol></details>
    </section>`;
    app.querySelector("#briefing-map").onclick = () => go(map);
    app.querySelector("#briefing-challenge").onclick = () => begin("leg", shuffle(ids.slice()), {stop});
    app.querySelector("#briefing-practice").onclick = () => go(() => roadLesson(stop, ids, 0));
    app.querySelector("#briefing-print").onclick = () => window.print();
  }

  // Learning does not grade cards, award mastery, or alter challenge scores.
  function roadLesson(stop, ids, at) {
    const s = STOPS[stop];
    if (at >= ids.length) {
      app.innerHTML = `<div class="card stack learning-intro"><div class="kicker">Road tips complete</div><h1>Ready to earn your stars?</h1><p>You’ve learned and practiced ${ids.length} road tips in ${esc(s.name)}. Now try them without the hints. Get ${STAR_2} of ${LEG_LEN} right to unlock the next stop.</p><p>Missed questions get another practice lap. Learning comes first.</p><div class="row"><button class="btn primary big" id="challenge">Start the star challenge</button><button class="btn ghost" id="review">Review the tips again</button><button class="btn ghost" id="lesson-map">Back to map</button></div></div>`;
      app.querySelector("#challenge").onclick = () => begin("leg", shuffle(ids.slice()), { stop });
      app.querySelector("#review").onclick = () => go(() => roadLesson(stop, ids, 0));
      app.querySelector("#lesson-map").onclick = () => go(map);
      return;
    }
    const q = QBY[ids[at]];
    app.innerHTML = `<div class="drive-top"><button class="btn ghost" id="lesson-map">Map</button><div><div class="small muted">${esc(s.name)} · ${esc(s.title)}</div><b>Road tip ${at + 1} of ${ids.length}</b></div></div>
      <ol class="journey-steps"><li class="current"><b>1. Learn</b></li><li><b>2. Try it</b></li><li><b>3. Earn stars</b></li></ol>
      <div class="card stack lesson-card">${q.sign ? signSVG(q.sign) : ""}<div class="kicker">Your roadside briefing</div><h2>${esc(q.q)}</h2>
      ${q.cs ? signImg(q.c[0]) : ""}<p class="lesson-answer">${esc(label(q, q.c[0]))}</p><p>${esc(q.why)}</p><p class="small muted">Source: ${sourceHTML(q)}</p><p class="small muted">Before you try it: explain the tip in your own words.</p><button class="btn primary big" id="try-tip">Got it · let me try</button></div>`;
    app.querySelector("#lesson-map").onclick = () => go(map);
    app.querySelector("#try-tip").onclick = () => {
      const opts = shuffle(q.c.map((text, i) => ({text, ok:i === 0})));
      app.innerHTML = `<div class="drive-top"><button class="btn ghost" id="practice-map">Map</button><b>Try it · ${at + 1} of ${ids.length}</b></div><div class="card stack"><div class="kicker">Practice lap · no score, no timer</div>${q.sign ? signSVG(q.sign) : ""}<h2>${esc(q.q)}</h2><div class="choices ${q.cs ? "sign-choices" : ""}">${opts.map((o,k) => `<button class="choice" data-practice="${k}" aria-label="${esc(label(q,o.text))}">${q.cs ? signImg(o.text,"choice-sign") : esc(o.text)}</button>`).join("")}</div><div id="practice-feedback" aria-live="polite"></div></div>`;
      app.querySelector("#practice-map").onclick = () => go(map);
      app.querySelectorAll("[data-practice]").forEach(b => b.onclick = () => {
        const ok = opts[+b.dataset.practice].ok;
        app.querySelectorAll("[data-practice]").forEach(x => { x.disabled = true; if(opts[+x.dataset.practice].ok) x.classList.add("right"); else if(x === b) x.classList.add("wrong"); });
        app.querySelector("#practice-feedback").innerHTML = `<h3>${ok ? "Nice driving!" : "A practice detour. Let’s learn from it."}</h3><p>${esc(q.why)}</p><p class="small muted">${sourceHTML(q)} · Practice does not affect stars or mastery.</p><button class="btn primary" id="next-tip">${at + 1 < ids.length ? "Next road tip" : "Finish practice"}</button>`;
        app.querySelector("#next-tip").onclick = () => go(() => roadLesson(stop, ids, at + 1));
      });
      window.scrollTo(0,0);
    };
  }
  function startPit() {
    if (!passGate(startPit)) return;
    let ids = dueCards().slice(0, 15), label = "Pit Stop";
    if (!ids.length) {
      const seen = Object.keys(P().cards);
      if (!seen.length) { toast("Drive to a stop first. Missed questions show up here for review."); return go(map); }
      ids = pickFrom(seen, 10); label = "Bonus Pit Stop";
      toast("No reviews due. Here are your weakest spots instead.");
    }
    begin("pit", shuffle(ids), { label });
  }
  function unlockedTopics() {
    const t = STOPS.filter((s, i) => unlocked(i)).map((s) => s.topic);
    return new Set(t);
  }
  function startOT() {
    if (!passGate(startOT)) return;
    const topics = unlockedTopics();
    const ids = shuffle(Q.filter((q) => topics.has(q.t)).map((q) => q.id));
    begin("ot", ids, { score: 0, end: Date.now() + OT_SECONDS * 1000, missed: [] });
  }
  function startPermit() {
    if (!passGate(startPermit)) return;
    let ids = [];
    STOPS.forEach((s) => { ids = ids.concat(shuffle(Q.filter((q) => q.t === s.topic).map((q) => q.id)).slice(0, 3)); });
    ids = shuffle(ids).slice(0, PERMIT_LEN);
    begin("permit", ids);
  }

  function startSprint() {
    if (!passGate(startSprint)) return;
    const pool = Q.filter((q) => q.t === "symbols" || q.sign).map((q) => q.id);
    begin("sprint", shuffle(pickFrom(pool, SPRINT_LEN)));
  }

  // Game practice goals, not certification or a guarantee of passing.
  function readyCard() {
    const r = readiness(), hist = P().permitHist || [];
    const row = (ok, text) => `<li class="${ok ? "ok" : ""}"><span class="tick">${ok ? "✓" : ""}</span>${text}</li>`;
    return `<div class="card ready-card ${r.ready ? "is-ready" : ""}">
      <div class="row"><h3>Practice progress</h3><span class="spacer"></span><b class="ready-pct">${r.ready ? "GOAL MET" : Math.round(r.m * 100) + "% mastered"}</b></div>
      <div class="xpbar"><i style="width:${Math.round(r.m * 100)}%"></i></div>
      <ul class="checks">
        ${row(r.cleared, `Clear all ${STOPS.length} stops (2+ stars each)`)}
        ${row(r.topicReady, "Master at least 80% in every topic (3 right in a row each)")}
        ${row(r.lastTwo, `Score ${READY_SCORE}/${PERMIT_LEN}+ on your last two Permit Days${hist.length ? ` (last: ${hist.slice(-2).join(", ")})` : ""}`)}
      </ul>
      <p class="small muted" style="margin:6px 0 0">${r.ready ? "You’ve met the game’s practice goals. Review the official manual and county requirements before booking a test." : "Game progress is a study guide, not proof of test readiness or safe driving skill. Use the official manual and supervised practice too."}</p>
    </div>`;
  }

  // Flashcards: retrieval practice with self-check. Think first, then flip.
  function flashPick() {
    if (!passGate(flashPick)) return;
    app.innerHTML = `${hud()}
      <div class="card stack" style="margin-top:14px">
        <h2>Flashcards</h2>
        <p class="muted">Pick a topic. Say the answer out loud (or in your head) before you flip the card. Be honest with "Got it" and "Not yet": cards you miss come back sooner.</p>
        <div class="stop-list">${STOPS.map((s, i) => `<button class="stop-row" data-i="${i}"><span class="num">${i + 1}</span><span><span class="title">${esc(s.title)}</span><br><span class="sub">${esc(s.name)} · ${Math.round(mastery(topicIds(s.topic)) * 100)}% mastered</span></span></button>`).join("")}
          <button class="stop-row" data-i="all"><span class="num">★</span><span><span class="title">Mixed: weakest cards</span><br><span class="sub">From every topic</span></span></button></div>
        <button class="btn ghost" id="back">Back to the map</button>
      </div>`;
    wireHud();
    app.querySelector("#back").onclick = () => go(map);
    app.querySelectorAll(".stop-row").forEach((b) => b.onclick = () => {
      const ids = b.dataset.i === "all" ? Q.map((q) => q.id) : topicIds(STOPS[+b.dataset.i].topic);
      go(() => flash(pickFrom(ids, FLASH_LEN), 0, 0));
    });
  }
  function flash(ids, i, got) {
    if (i >= ids.length) {
      touchStreak(); save();
      app.innerHTML = `<div class="card"><div class="result-hero"><h2>Deck done</h2><div class="big-stars">${got}/${ids.length}</div><p class="muted">"Not yet" cards will come back in your next Pit Stop.</p></div>
        <div class="row"><button class="btn primary" id="again">Another deck</button><button class="btn ghost" id="map">Map</button></div></div>`;
      app.querySelector("#again").onclick = () => go(flashPick);
      app.querySelector("#map").onclick = () => go(map);
      return;
    }
    const q = QBY[ids[i]];
    app.innerHTML = `
      <div class="drive-top"><button class="btn ghost" id="quit">Map</button><div><div class="small muted">Flashcards</div><b>Card ${i + 1} of ${ids.length}</b></div></div>
      <div class="card flashcard" style="margin-top:14px">
        ${q.sign ? signSVG(q.sign) : ""}
        <div class="question">${esc(q.q)}</div>
        <div id="back" class="hidden">
          ${q.cs ? `<div class="sign-art">${signImg(q.c[0])}</div>` : ""}
          <div class="feedback"><div class="head">${esc(label(q, q.c[0]))}</div><div>${esc(q.why)}</div><div class="src">Source: ${sourceHTML(q)}</div></div>
          <div class="row" style="margin-top:12px"><button class="btn go big" id="yes">Got it</button><button class="btn danger big" id="no">Not yet</button></div>
        </div>
        <div class="row" id="front" style="margin-top:8px"><button class="btn primary big" id="flip">Flip card</button><span class="small muted">Answer it in your head first</span></div>
      </div>`;
    app.querySelector("#quit").onclick = () => { save(); go(map); };
    const flip = () => { app.querySelector("#back").classList.remove("hidden"); app.querySelector("#front").classList.add("hidden"); app.querySelector("#yes").focus(); };
    app.querySelector("#flip").onclick = flip;
    const rate = (ok) => { grade(q.id, ok); if (ok) { P().xp += 3; } save(); flash(ids, i + 1, got + (ok ? 1 : 0)); };
    app.querySelector("#yes").onclick = () => rate(true);
    app.querySelector("#no").onclick = () => rate(false);
    document.onkeydown = (e) => {
      if (app.querySelector("#back").classList.contains("hidden")) { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } }
      else if (e.key === "1" || e.key === "y") rate(true); else if (e.key === "2" || e.key === "n") rate(false);
    };
  }

  // Coach Corner: how to study, plus real-world practice for car rides
  const CAR_TALK = [
    ["Why is following distance measured in seconds, not feet?", "Seconds automatically grow with speed. At 60 mph, two seconds covers far more road than at 25 mph, which is exactly the extra room you need to stop."],
    ["Why does the driver turning left usually have to yield?", "A left turn crosses oncoming traffic's path, so the turning driver is the one creating the conflict."],
    ["Why is the road most slippery right when it starts to rain?", "Oil from cars sits on the road. The first drops float it up before rain washes it away."],
    ["Why keep your wheels straight while waiting to turn left?", "If someone rear-ends you, straight wheels keep you from being pushed into oncoming traffic."],
    ["Why are motorcycles easy to misjudge?", "They're small, so they look farther away and slower than they are. Look twice."],
    ["Why is the alcohol limit 0.02 for drivers under 21?", "It's zero tolerance: under 21, any real amount of alcohol is illegal, and new drivers are most affected by even small amounts."],
    ["How can you keep a freeway merge safe in heavy traffic?", "Leave room to build speed for a safe gap, yield to freeway traffic, and follow ramp controls. Slow or stop when traffic or safety requires it; never force a merge."],
    ["Why use low beams, not high beams, in fog?", "High beams bounce off the fog and blind you."],
    ["Why turn your wheels toward the curb when parking on a hill?", "If the brakes slip, the curb stops the car and it rolls away from traffic, not into it."],
    ["Why can't you pass within 100 feet of an intersection?", "Cars may turn or pull out there, and you'd be in the wrong lane with no escape."],
    ["What does the shape of a sign tell you before you can read it?", "Octagon = stop, triangle = yield, diamond = warning, pentagon = school, circle = railroad ahead, pennant = no passing."],
    ["What's the difference between a merge sign and an added-lane sign?", "Merge: the joining lane flows into yours, so adjust speed. Added lane: it becomes its own lane, so no one has to merge."],
  ];
  const SPOT = ["octagon", "triangle", "speed", "donotenter", "oneway", "noturn", "nouturn", "noparking", "keepright", "leftonly", "accessible", "curve", "turn", "winding", "crossroad", "sideroad", "tee", "merge", "laneends", "addedlane", "divided", "dividedends", "twoway", "hill", "slippery", "pedestrian", "bicycle", "signal", "stopahead", "school", "rrahead", "workers", "flagger", "hospital", "interstate", "recreation", "guide"];
  function coach() {
    if (!passGate(coach)) return;
    const p = P(); p.spotted = p.spotted || [];
    app.innerHTML = `${hud()}
      <div class="card stack" style="margin-top:14px">
        <h2>Coach Corner</h2>
        <p>For learners and the adults helping them. Use this suggested routine alongside the official manual, required driver education and supervised driving.</p>
        <h3>A suggested routine: 15 to 20 minutes a day</h3>
        <ol class="plan">
          <li><b>Start every day with a Pit Stop.</b> It brings back what you're about to forget. Short daily sessions beat cramming the night before.</li>
          <li><b>Then drive one stop or do a Flashcard deck.</b> Answering from memory (not rereading) is what makes facts stick.</li>
          <li><b>Read every explanation, especially on misses.</b> Then say the rule out loud in your own words. Look up the manual page if it still doesn't click.</li>
          <li><b>Do a Sign Sprint every few days.</b> The test shows signs with no words. Learn the shape and color first, then the picture.</li>
          <li><b>Mix it up.</b> Once most stops are cleared, use Overtime and Permit Day. Mixed topics feel harder, but that's what the real test does.</li>
          <li><b>Use game goals to find what needs more practice.</b> Read the whole official manual and check county requirements. Game scores do not guarantee a pass or establish driving skill.</li>
        </ol>
        <h3>On every car ride: be the navigator</h3>
        <p class="muted">Before you ever drive, you can practice as a passenger. Call out each sign and what it means, and point out lane lines, signals and who has the right of way at each intersection. Check off signs as you spot them in real life.</p>
        <div class="spot-grid">${SPOT.filter((k) => SIGNS[k]).map((k) => `<button class="spot ${p.spotted.includes(k) ? "on" : ""}" data-k="${k}" aria-pressed="${p.spotted.includes(k)}">${signImg(k)}<span>${esc(SIGNS[k].name)}</span></button>`).join("")}</div>
        <p class="small muted" id="spotcount">${p.spotted.length} of ${SPOT.length} spotted on Oʻahu roads</p>
        <h3>Car Talk: "why" questions for parents to ask</h3>
        <p class="muted">Knowing <i>why</i> a rule exists makes it much easier to remember and to use on the road. Ask one per ride. Tap to see a good answer.</p>
        ${CAR_TALK.map(([qq, a]) => `<details class="talk"><summary>${esc(qq)}</summary><p>${esc(a)}</p></details>`).join("")}
        <h3>Official study resources</h3>
        <ul class="plan"><li><a href="${MANUAL_URL}" target="_blank" rel="noopener">Current HDOT English driver manual</a>: study the full guide.</li><li><a href="${MANUAL_URL}#page=99" target="_blank" rel="noopener">Official sample questions and illustrations</a>: use the page references to check your reasoning.</li><li><a href="https://hidot.hawaii.gov/online-learners-permit-test/" target="_blank" rel="noopener">HDOT online permit test requirements</a>: currently describes 25 questions and a one-hour limit. This game’s 30-question Permit Day is extra practice, not a replica.</li></ul>
        <h3>Before test day</h3>
        <ul class="plan">
          <li>Read the official <a href="https://hidot.hawaii.gov/highways/library/motor-vehicle-safety-office/" target="_blank" rel="noopener">Hawaii Driver's Manual</a> once, start to finish. This game covers the key facts, but the manual is the source.</li>
          <li>Check your county driver licensing office's website for the documents to bring, fees, hours and appointments. Under 18 needs parent or guardian consent.</li>
          <li>Getting a permit also requires a vision screening. Completing a knowledge test alone does not issue a permit.</li>
          <li>Read each question all the way through. Watch for words like <i>never</i>, <i>always</i>, <i>except</i> and <i>at least</i>.</li>
        </ul>
        <button class="btn primary" id="back">Back to the map</button>
      </div>`;
    wireHud();
    app.querySelector("#back").onclick = () => go(map);
    app.querySelectorAll(".spot").forEach((b) => b.onclick = () => {
      const k = b.dataset.k, on = p.spotted.includes(k);
      p.spotted = on ? p.spotted.filter((x) => x !== k) : p.spotted.concat(k);
      b.classList.toggle("on", !on); b.setAttribute("aria-pressed", String(!on));
      app.querySelector("#spotcount").textContent = `${p.spotted.length} of ${SPOT.length} spotted on Oʻahu roads`;
      save();
    });
  }

  function title() {
    const s = session;
    if (s.mode === "leg") return `${STOPS[s.stop].name}: ${STOPS[s.stop].title}${s.inDetour ? " · Detour" : ""}`;
    if (s.mode === "pit") return s.label;
    if (s.mode === "sprint") return "Sign Sprint";
    if (s.mode === "ot") return "Overtime";
    return "Permit Day practice test";
  }

  function ask() {
    const s = session;
    if (s.mode === "ot" && Date.now() >= s.end) return finish();
    if (s.i >= s.queue.length) {
      if (s.mode === "leg" && !s.inDetour && s.detour.length) {
        s.inDetour = true; s.queue = shuffle(s.detour); s.i = 0;
        toast("Detour! One more look at the ones you missed.");
      } else if (s.mode === "ot") { s.queue = s.queue.concat(shuffle(s.queue)); }
      else return finish();
    }
    const q = QBY[s.queue[s.i]];
    const opts = shuffle(q.c.map((text, k) => ({ text, ok: k === 0 })));
    const p = P();
    const total = s.inDetour ? s.queue.length : s.queue.length;
    const firstPassRight = s.results.filter((r) => r.ok && !r.detour).length;
    const progress = s.mode === "leg" && !s.inDetour ? firstPassRight / LEG_LEN : s.mode === "permit" ? s.i / PERMIT_LEN : s.mode === "pit" ? s.i / total : 0;

    app.innerHTML = `
      <div class="drive-top"><button class="btn ghost" id="quit" aria-label="Back to map">Map</button><div><div class="small muted">${esc(title())}</div><b>${s.mode === "ot" ? "Score " + s.score : "Question " + (s.i + 1) + " of " + total}</b></div><span class="spacer"></span>${s.combo >= 2 && s.mode !== "permit" ? `<span class="combo">x${s.combo} combo</span>` : ""}</div>
      ${s.mode === "ot" ? `<div class="timer" style="margin-top:12px"><i id="tbar" style="width:${Math.max(0, ((s.end - Date.now()) / (OT_SECONDS * 1000)) * 100)}%"></i></div>` :
        `<div class="track" aria-hidden="true"><div class="finish"></div><div class="car" id="car" style="left:calc(${Math.round(progress * 100)}% * .82)">${carSVG(p.color)}</div></div>`}
      <div class="card">
        ${q.sign ? signSVG(q.sign) : ""}
        <div class="question" id="qtext">${esc(q.q)}</div>
        <div class="choices ${q.cs ? "sign-choices" : ""}">${opts.map((o, k) => `<button class="choice" data-k="${k}" aria-label="Option ${k + 1}${q.cs ? "" : ": " + esc(o.text)}"><span class="key">${k + 1}</span>${q.cs ? signImg(o.text, "choice-sign") : `<span>${esc(o.text)}</span>`}</button>`).join("")}</div>
        <div id="fb"></div>
      </div>`;
    app.querySelector("#quit").onclick = () => { if (s.mode === "permit" && s.i > 0 && !confirm("Leave Permit Day? This attempt won't count.")) return; save(); go(map); };

    let answered = false;
    const choose = (k) => {
      if (answered) return; answered = true;
      const o = opts[k];
      const btns = app.querySelectorAll(".choice");
      btns.forEach((b, j) => { b.disabled = true; if (s.mode !== "permit") { if (opts[j].ok) b.classList.add("right"); else if (j === k) b.classList.add("wrong"); } });
      if (s.mode === "permit") btns[k].style.borderColor = "var(--ocean)";
      const correct = opts.find((x) => x.ok).text;
      s.results.push({ id: q.id, ok: o.ok, picked: o.text, correct, detour: s.inDetour });
      if (!s.inDetour) grade(q.id, o.ok);
      if (o.ok) { s.combo++; s.bestCombo = Math.max(s.bestCombo, s.combo); } else s.combo = 0;

      if (s.mode === "permit") { s.i++; save(); setTimeout(ask, 250); return; }

      beep(o.ok);
      const car = app.querySelector("#car");
      let gain = 0;
      if (o.ok) {
        gain = s.inDetour ? 5 : 10 + (s.combo >= 3 ? 5 : 0);
        if (car) { const fp = s.results.filter((r) => r.ok && !r.detour).length; car.style.left = `calc(${Math.round((s.mode === "leg" && !s.inDetour ? fp / LEG_LEN : (s.i + 1) / total) * 100)}% * .82)`; car.classList.add("boost"); }
      } else if (car) car.classList.add("bump");
      if (gain) { s.xp += gain; P().xp += gain; floatXP(gain); }
      if (!o.ok && s.mode === "leg" && !s.inDetour) s.detour.push(q.id);

      if (s.mode === "ot") {
        if (o.ok) s.score++; else { s.missed.push(q.id); s.end -= 3000; }
        s.i++; save();
        setTimeout(ask, o.ok ? 350 : 900);
        return;
      }

      app.querySelector("#fb").innerHTML = `
        <div class="feedback ${o.ok ? "" : "bad"}">
          <div class="head">${o.ok ? pick(["Nice!", "Clean drive!", "Shoots!", "Right on!", "Smooth!"]) : "Pothole!"}</div>
          ${o.ok ? (q.cs ? `<div>That sign means: <b>${esc(label(q, correct))}</b></div>` : "") : `<div>Answer: <b>${esc(label(q, correct))}</b></div>`}
          <div>${esc(q.why)}</div>
          <div class="src">Source: ${sourceHTML(q)}</div>
        </div>
        <div class="row" style="margin-top:12px"><button class="btn go big" id="next">Keep driving</button><span class="small muted">or press Enter</span></div>`;
      const nb = app.querySelector("#next"); nb.focus();
      nb.onclick = () => { s.i++; save(); ask(); };
      document.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); nb.onclick(); } };
    };
    app.querySelectorAll(".choice").forEach((b) => b.onclick = () => choose(+b.dataset.k));
    document.onkeydown = (e) => { const n = parseInt(e.key, 10); if (n >= 1 && n <= opts.length) choose(n - 1); };

    if (s.mode === "ot") {
      clearTick();
      tick = setInterval(() => {
        const left = s.end - Date.now(), bar = document.getElementById("tbar");
        if (bar) bar.style.width = Math.max(0, (left / (OT_SECONDS * 1000)) * 100) + "%";
        if (left <= 0) { clearTick(); finish(); }
      }, 200);
    }
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  function reviewList(rows) {
    if (!rows.length) return "";
    return `<h3 style="margin-top:16px">Review</h3><ul class="review-list">${rows.map((r) => {
      const q = QBY[r.id];
      return `<li><div><b>${esc(q.q)}</b></div>${q.sign ? signImg(q.sign, "review-sign") : ""}${q.cs ? signImg(q.c[0], "review-sign") : ""}<div class="ans">${esc(label(q, q.c[0]))}</div>${r.picked && r.picked !== q.c[0] ? `<div class="yours small">You picked: ${esc(label(q, r.picked))}</div>` : ""}<div class="small muted">${esc(q.why)} (Source: ${sourceHTML(q)})</div></li>`;
    }).join("")}</ul>`;
  }

  function finish() {
    clearTick(); document.onkeydown = null;
    const s = session, p = P();
    let body = "";
    if (s.mode === "leg") {
      const st = STOPS[s.stop];
      const right = s.results.filter((r) => r.ok && !r.detour).length;
      const got = stars(right), prev = p.best[st.id] || 0;
      if (got > prev) p.best[st.id] = got;
      const bonus = got >= 2 && prev < 2 ? 50 : 0;
      if (bonus) { p.xp += bonus; s.xp += bonus; }
      if (got >= 1) award("first");
      if (right === LEG_LEN) award("perfect");
      if (got >= 2) setTimeout(confetti, 150);
      if (st.id === "makapuu" && got === 3) award("signs");
      if (STOPS.every((x) => (p.best[x.id] || 0) >= 2)) award("island");
      const nextI = s.stop + 1;
      const cleared = got >= 2;
      body = `
        <div class="result-hero">
          <div class="small muted">${esc(st.name)}: ${esc(st.title)}</div>
          <h2>${cleared ? (got === 3 ? "Perfect drive!" : "Stop cleared!") : "Almost there"}</h2>
          <div class="big-stars" aria-label="${got} of 3 stars">${"★".repeat(got)}<span class="off">${"★".repeat(3 - got)}</span></div>
          <p class="muted">${cleared ? (nextI < STOPS.length && prev < 2 ? `${access.active ? `Road to <b>${esc(STOPS[nextI].name)}</b> is open.` : `Your free stop is complete! Keep going with a Full Island Pass.`}` : "Nice work.") : `You need ${STAR_2} of ${LEG_LEN} to clear this stop. Try again, the questions you missed come back first.`}</p>
        </div>
        <div class="stat-grid"><div class="stat"><b>${right}/${LEG_LEN}</b><span>first try</span></div><div class="stat"><b>+${s.xp}</b><span>XP${bonus ? " + bonus" : ""}</span></div><div class="stat"><b>x${s.bestCombo}</b><span>best combo</span></div></div>
        <div class="row"><button class="btn primary big" id="again">${cleared ? "Replay for 3 stars" : "Try again"}</button>${cleared && nextI < STOPS.length ? `<button class="btn go big" id="next">${access.active ? `Drive to ${esc(STOPS[nextI].name)}` : "Unlock Full Island Pass · $9.99"}</button>` : ""}<button class="btn ghost" id="map">Map</button></div>`;
      save();
      app.innerHTML = `<div class="card">${body}</div>`;
      app.querySelector("#again").onclick = () => go(() => startLeg(s.stop));
      const nb = app.querySelector("#next"); if (nb) nb.onclick = () => go(() => startLeg(nextI));
    } else if (s.mode === "pit" || s.mode === "sprint") {
      if (s.mode === "pit") { p.pits++; if (p.pits >= 5) award("pit"); }
      const right = s.results.filter((r) => r.ok).length;
      save();
      app.innerHTML = `<div class="card"><div class="result-hero"><h2>${s.mode === "sprint" ? "Sign Sprint done" : "Pit Stop done"}</h2><p class="muted">${right} of ${s.results.length} correct. Right answers move further out in your review schedule. Misses come back tomorrow.</p></div>
        <div class="row"><button class="btn primary" id="map">Back to the map</button></div>
        ${reviewList(s.results.filter((r) => !r.ok))}</div>`;
    } else if (s.mode === "ot") {
      const newBest = s.score > p.otBest; if (newBest) p.otBest = s.score;
      if (s.score >= 20) award("ot20");
      const bonus = s.score * 2; p.xp += bonus;
      save();
      const missed = [...new Set(s.missed)].map((id) => ({ id }));
      app.innerHTML = `<div class="card"><div class="result-hero"><div class="small muted">Overtime</div><h2>${newBest ? "New best!" : "Time!"}</h2><div class="big-stars">${s.score}</div><p class="muted">Best: ${p.otBest} · +${s.xp + bonus} XP · Each miss costs 3 seconds.</p></div>
        <div class="row"><button class="btn primary big" id="again">Run it back</button><button class="btn ghost" id="map">Map</button></div>
        ${reviewList(missed)}</div>`;
      app.querySelector("#again").onclick = () => go(startOT);
    } else {
      const right = s.results.filter((r) => r.ok).length, pass = right >= PERMIT_PASS;
      p.permitTries++;
      p.permitHist = (p.permitHist || []).concat(right).slice(-10);
      if (p.permitBest === null || right > p.permitBest) p.permitBest = right;
      const gain = right * 3 + (pass ? 100 : 0); p.xp += gain;
      if (pass) { award("permit"); setTimeout(confetti, 150); }
      save();
      app.innerHTML = `<div class="card"><div class="result-hero"><div class="small muted">Permit Day practice test</div>
          <h2>${pass ? "You passed!" : "Not yet"}</h2><div class="big-stars">${right}/${PERMIT_LEN}</div>
          <p class="muted">${pass ? "That's a passing score on this practice test. Keep it up with Pit Stops until test day." : `You need ${PERMIT_PASS} to pass this practice test. Review the misses below, then hit the stops for those topics.`}</p>
          <p class="small muted">Practice format: ${PERMIT_LEN} questions, ${PERMIT_PASS} to pass (80%). Check the current test format with your county driver licensing office.</p></div>
        <div class="stat-grid"><div class="stat"><b>${Math.round((right / PERMIT_LEN) * 100)}%</b><span>score</span></div><div class="stat"><b>+${gain}</b><span>XP</span></div><div class="stat"><b>${p.permitTries}</b><span>attempts</span></div></div>
        <div class="row"><button class="btn primary big" id="again">Take another</button><button class="btn ghost" id="map">Map</button></div>
        ${reviewList(s.results.filter((r) => !r.ok))}</div>`;
      app.querySelector("#again").onclick = () => go(startPermit);
    }
    if (mastery(topicIds("symbols")) >= 0.8) award("signpro");
    if (readiness().ready) award("ready");
    save();
    const mb = app.querySelector("#map"); if (mb) mb.onclick = () => go(map);
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------
  function passBack() { go(P() ? map : garage); }
  function passScreen(next) {
    if (access.active) {
      app.innerHTML = `<section class="card stack island-pass"><div class="kicker">${access.owner ? "Complimentary owner access" : "Your pass is active"}</div><h1>Full Island Pass</h1><p>You have access to every stop and all practice tools. Earn stars to advance along the learning route${access.owner ? ", or select any stop with your owner pass" : ""}.</p><p>Learning progress is separate from your pass. Back up your progress with a save code before changing devices.</p><button class="btn primary" id="recovery-code">${access.hasRecoveryCode ? "Replace my recovery code" : "Save my recovery code"}</button><button class="btn ghost" id="pass-continue">Back to my road trip</button><details><summary>Sign out on this browser</summary><p>Your progress stays on this device. You’ll need your recovery code to restore paid access.</p><button class="btn ghost" id="pass-signout">Sign out of my pass</button></details></section>`;
      app.querySelector("#recovery-code").onclick=()=>go(recoveryScreen);
      app.querySelector("#pass-continue").onclick=next ? ()=>go(next) : passBack;
      app.querySelector("#pass-signout").onclick=async()=>{ if(!confirm("Have you saved your recovery code? Signing out keeps progress, but you’ll need the code to restore full access."))return; try{await api("/api/logout",{});await loadAccess();passBack();}catch(e){toast(e.message);} };
      return;
    }
    app.innerHTML = `<section class="card stack island-pass"><button class="btn ghost" id="pass-back">Back to the free level</button><div class="kicker">Your next adventure</div><h1>Unlock the full island</h1><p class="pass-price">$9.99 <span>one time</span></p><p>No subscription. Keep learning at your pace.</p><ul class="pass-benefits"><li>All 12 island stops, including the free Kapolei level</li><li>Flashcards, Sign Sprint and Overtime</li><li>Pit Stop review, Permit Day and Coach Corner</li><li>A private recovery code to restore your pass on another device</li></ul><p>Your free level, explanations and progress stay available if you choose not to buy.</p>${testMode ? `<p class="pass-status">Sandbox checkout: test payments only. No real charge.</p>` : ""}<button class="btn primary big" id="pass-buy" ${checkoutAvailable ? "" : "disabled"}>${checkoutAvailable ? "Continue to secure checkout" : "Checkout is being set up"}</button><p class="small muted">Payment is handled by Stripe. Your total is $9.99.</p><button class="btn ghost" id="restore-pass">Already have a pass? Restore with a code</button><a href="${MANUAL_URL}" target="_blank" rel="noopener">Read the official manual free</a><p id="pass-error" role="alert"></p></section>`;
    app.querySelector("#pass-back").onclick=passBack;
    app.querySelector("#restore-pass").onclick=()=>go(()=>restorePass(next));
    app.querySelector("#pass-buy").onclick=async()=>{
      const b=app.querySelector("#pass-buy");b.disabled=true;b.textContent="Opening checkout…";
      try {const data=await api("/api/checkout",{});if(data.alreadyUnlocked){await loadAccess();return go(()=>passScreen(next));}const target=new URL(data.url);if(target.protocol!=="https:"||target.hostname!=="checkout.stripe.com")throw new Error("Checkout could not be opened.");window.location.assign(target.href);}
      catch(e){app.querySelector("#pass-error").textContent=e.message;b.disabled=false;b.textContent="Try secure checkout again";}
    };
  }
  function restorePass(next) {
    app.innerHTML=`<section class="card stack island-pass"><h1>Restore Full Island Pass</h1><p>Enter the private recovery code you saved after purchasing, or the complimentary pass code you received. A website link or learning-progress save code won’t unlock a pass.</p><form id="restore-form"><label for="pass-code">Full Island Pass recovery code</label><input class="field" id="pass-code" autocomplete="off" spellcheck="false" placeholder="OAHU-…" maxlength="80" required><button class="btn primary" type="submit" id="restore-submit">Restore my pass</button></form><p id="restore-error" role="alert"></p><button class="btn ghost" id="restore-back">Back</button></section>`;
    app.querySelector("#restore-back").onclick=()=>go(()=>passScreen(next));
    app.querySelector("#restore-form").onsubmit=async e=>{e.preventDefault();const b=app.querySelector("#restore-submit");b.disabled=true;try{await api("/api/recovery/restore",{code:app.querySelector("#pass-code").value});await loadAccess();go(()=>passScreen(next));}catch(error){app.querySelector("#restore-error").textContent=error.message;b.disabled=false;}};
  }
  function recoveryScreen() {
    app.innerHTML=`<section class="card stack island-pass"><h1>Keep a spare key to your island</h1><p>Your recovery code restores paid access, but it does not transfer your learning progress. Use a separate save code to back up progress.</p><p>${access.hasRecoveryCode ? "Generating a new code will invalidate your previous recovery code. Browsers already signed in stay signed in." : "Save this code somewhere private. Anyone who has it can restore your pass."}</p><button class="btn primary" id="issue-code">${access.hasRecoveryCode ? "Generate replacement code" : "Generate my recovery code"}</button><div id="code-result" aria-live="polite"></div><button class="btn ghost" id="code-back">Back to my pass</button></section>`;
    app.querySelector("#code-back").onclick=()=>go(()=>passScreen());
    app.querySelector("#issue-code").onclick=async()=>{const b=app.querySelector("#issue-code");b.disabled=true;try{const data=await api("/api/recovery/issue",{});access.hasRecoveryCode=true;app.querySelector("#code-result").innerHTML=`<label for="new-pass-code">Your private recovery code</label><textarea id="new-pass-code" class="field" readonly></textarea><p>Save it now. We don’t store a readable copy of this code.</p><button class="btn primary" id="download-pass">Download my recovery code</button>`;app.querySelector("#new-pass-code").value=data.code;app.querySelector("#download-pass").onclick=()=>{const blob=new Blob(["Oʻahu Road Trip Full Island Pass\n\n"+data.code+"\n\nKeep this code private. It restores access, not learning progress.\n"],{type:"text/plain"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="oahu-full-island-pass.txt";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};b.textContent="Recovery code generated";}catch(e){app.querySelector("#code-result").textContent=e.message;b.disabled=false;}};
  }
  async function purchaseStatus() {
    app.innerHTML=`<section class="card stack island-pass"><h1>Checking your Full Island Pass</h1><p>We’re waiting for payment confirmation. This page does not unlock access by itself.</p><p id="purchase-message" aria-live="polite"></p><button class="btn primary" id="check-payment">Check payment status</button><button class="btn ghost" id="purchase-back">Back to the free level</button></section>`;
    app.querySelector("#purchase-back").onclick=passBack;
    const check=async()=>{const b=app.querySelector("#check-payment");b.disabled=true;try{await loadAccess();if(access.active){history.replaceState(null,"",window.location.pathname);app.innerHTML=`<section class="card stack island-pass"><div class="kicker">Payment confirmed</div><h1>Your island is unlocked!</h1><p>Save your private recovery code so you can restore access on another device.</p><button class="btn primary big" id="purchase-code">Save my recovery code</button><button class="btn ghost" id="purchase-continue">Continue my road trip</button></section>`;app.querySelector("#purchase-code").onclick=()=>go(recoveryScreen);app.querySelector("#purchase-continue").onclick=passBack;return;}app.querySelector("#purchase-message").textContent="Payment isn’t confirmed yet. If you paid, wait a moment and check again. Please don’t pay twice.";}catch(e){app.querySelector("#purchase-message").textContent=e.message;}b.disabled=false;};
    app.querySelector("#check-payment").onclick=check;
    await check();
  }

  // Boot: question content and paid access come from the server, never a URL or local save.
  async function boot() {
    app.innerHTML = `<div class="card stack"><h1>Getting your road trip ready…</h1><p>Checking your access. Your learning progress stays on this device.</p></div>`;
    try {
      await loadAccess();
      const result = new URLSearchParams(window.location.search).get("purchase");
      if (result === "complete") return go(purchaseStatus);
      if (result === "cancelled") toast("Checkout cancelled. Your free level is still here.");
      if (store.active && store.profiles[store.active]) go(map); else go(garage);
    } catch {
      app.innerHTML = `<div class="card stack"><h1>Let’s try that again</h1><p>We couldn’t connect to the game. Your saved progress has not been changed.</p><button class="btn primary" id="reload">Try again</button></div>`;
      app.querySelector("#reload").onclick = boot;
    }
  }
  boot();
})();
