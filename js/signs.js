/*
  Sign artwork for Oʻahu Road Trip. Hand-drawn SVG versions of standard US
  road signs (Federal MUTCD designs used in Hawaii). Most are WORDLESS on
  purpose: the permit test shows symbol signs and expects you to know them
  by shape, color and picture.

  Each entry: name (what it means) and svg (inner markup for a 120x120 viewBox).
*/
(function () {
  const K = "#111", Y = "#ffcc00", O = "#ff8a1e", R = "#d7262b", W = "#fff", G = "#0b7a3b", B = "#1f5fbf", FYG = "#c6e21a";
  const dia = (fill, inner) => `<polygon points="60,4 116,60 60,116 4,60" fill="${fill}" stroke="${K}" stroke-width="4"/>${inner}`;
  const sq = (inner, fill) => `<rect x="10" y="10" width="100" height="100" rx="8" fill="${fill || W}" stroke="${K}" stroke-width="4"/>${inner}`;
  const tall = (inner, fill) => `<rect x="20" y="4" width="80" height="112" rx="8" fill="${fill || W}" stroke="${K}" stroke-width="4"/>${inner}`;
  const ln = (d, w) => `<path d="${d}" fill="none" stroke="${K}" stroke-width="${w || 9}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const tri = (pts, f) => `<polygon points="${pts}" fill="${f || K}"/>`;
  const slash = `<circle cx="60" cy="60" r="42" fill="none" stroke="${R}" stroke-width="9"/><line x1="31" y1="31" x2="89" y2="89" stroke="${R}" stroke-width="9"/>`;
  const walker = (s) => `<g ${s || ""}><circle cx="60" cy="30" r="7" fill="${K}"/>${ln("M60 40 L56 64 M58 48 L46 58 M58 48 L72 56 M56 64 L46 86 M56 64 L70 86", 7)}</g>`;
  const bike = (s) => `<g ${s || ""}><circle cx="40" cy="76" r="12" fill="none" stroke="${K}" stroke-width="5"/><circle cx="80" cy="76" r="12" fill="none" stroke="${K}" stroke-width="5"/>${ln("M40 76 L54 56 L74 56 L80 76 M54 56 L62 76 L74 56 M50 50 H60 M72 50 L76 48", 5)}<circle cx="64" cy="34" r="6" fill="${K}"/>${ln("M62 41 L58 54 M60 46 L72 52", 5)}</g>`;
  const octa = (cx, cy, r) => { const a = r * 0.414; return `<polygon points="${cx - a},${cy - r} ${cx + a},${cy - r} ${cx + r},${cy - a} ${cx + r},${cy + a} ${cx + a},${cy + r} ${cx - a},${cy + r} ${cx - r},${cy + a} ${cx - r},${cy - a}" fill="${R}" stroke="${W}" stroke-width="3"/>`; };

  window.ORT_SIGNS = {
    // ---------- Regulatory (shape tells you a lot) ----------
    stop: { name: "Stop", svg: `<polygon points="35,5 85,5 115,35 115,85 85,115 35,115 5,85 5,35" fill="${R}" stroke="${W}" stroke-width="5"/><text x="60" y="72" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="30" fill="${W}">STOP</text>` },
    octagon: { name: "Stop (shape only)", svg: `<polygon points="35,5 85,5 115,35 115,85 85,115 35,115 5,85 5,35" fill="${R}" stroke="${W}" stroke-width="5"/>` },
    yield: { name: "Yield", svg: `<polygon points="6,10 114,10 60,108" fill="${W}" stroke="${R}" stroke-width="12" stroke-linejoin="round"/><text x="60" y="48" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="18" fill="${R}">YIELD</text>` },
    triangle: { name: "Yield (shape only)", svg: `<polygon points="6,10 114,10 60,108" fill="${W}" stroke="${R}" stroke-width="14" stroke-linejoin="round"/>` },
    donotenter: { name: "Do not enter", svg: `<circle cx="60" cy="60" r="54" fill="${R}" stroke="${W}" stroke-width="4"/><rect x="22" y="50" width="76" height="20" rx="3" fill="${W}"/>` },
    speed: { name: "Speed limit", svg: `<rect x="18" y="4" width="84" height="112" rx="8" fill="${W}" stroke="${K}" stroke-width="5"/><text x="60" y="38" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="15" fill="${K}">SPEED</text><text x="60" y="56" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="15" fill="${K}">LIMIT</text><text x="60" y="100" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="38" fill="${K}">35</text>` },
    noturn: { name: "No left turn", svg: sq(`<g transform="scale(-1,1) translate(-120,0)">${ln("M50 92 V58 Q50 46 62 46 H72", 10)}${tri("70,32 90,46 70,60")}</g>${slash}`) },
    noright: { name: "No right turn", svg: sq(`${ln("M50 92 V58 Q50 46 62 46 H72", 10)}${tri("70,32 90,46 70,60")}${slash}`) },
    nouturn: { name: "No U-turn", svg: sq(`${ln("M76 92 V56 Q76 36 58 36 Q42 36 42 54 V62", 10)}${tri("30,60 42,82 54,60")}${slash}`) },
    noparking: { name: "No parking", svg: sq(`<text x="60" y="84" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="66" fill="${K}">P</text>${slash}`) },
    nobikes: { name: "No bicycles", svg: sq(`${bike('transform="translate(6,4) scale(0.9)"')}${slash}`) },
    nopeds: { name: "No pedestrians", svg: sq(`${walker()}${slash}`) },
    keepright: { name: "Keep right (of the island or obstacle)", svg: tall(`<ellipse cx="44" cy="80" rx="11" ry="22" fill="${K}"/>${ln("M42 26 Q76 28 76 58 V84", 9)}${tri("64,82 76,102 88,82")}`) },
    leftonly: { name: "Left turn only (this lane)", svg: tall(`${ln("M68 100 V62 Q68 46 52 46 H48", 11)}${tri("50,30 28,46 50,62")}`) },
    oneway: { name: "One way (traffic goes the direction of the arrow)", svg: `<rect x="4" y="34" width="112" height="52" rx="6" fill="${K}" stroke="${W}" stroke-width="3"/><rect x="18" y="52" width="62" height="16" fill="${W}"/>${tri("78,42 104,60 78,78", W)}` },
    noturnred: { name: "Red circle with slash: that movement is prohibited", svg: sq(slash) },
    accessible: { name: "Accessible (disabled) parking", svg: sq(`<circle cx="58" cy="28" r="8" fill="${W}"/>${ln("M56 40 V64 H76 L84 86", 8).replace(K, W)}<circle cx="54" cy="78" r="18" fill="none" stroke="${W}" stroke-width="7"/>`, B) },

    // ---------- Warning (yellow diamond) ----------
    warning: { name: "Warning (general)", svg: dia(Y, `<path d="M48 84 V58 Q48 46 60 46 H70 V38 L84 52 L70 66 V58 H60 V84 Z" fill="${K}"/>`) },
    curve: { name: "Curve to the right ahead", svg: dia(Y, `${ln("M50 94 V70 Q50 48 70 40", 10)}${tri("62,28 88,34 72,54")}`) },
    turn: { name: "Sharp turn to the right ahead", svg: dia(Y, `${ln("M50 94 V44 H72", 10)}${tri("70,30 92,44 70,58")}`) },
    reverse: { name: "Reverse curve: road curves right, then left", svg: dia(Y, `${ln("M46 96 V82 Q46 68 60 62 Q74 56 74 44 V40", 9)}${tri("62,42 74,22 86,42")}`) },
    winding: { name: "Winding road: several curves ahead", svg: dia(Y, `${ln("M54 98 Q38 88 54 78 Q70 68 54 58 Q38 48 54 40", 8)}${tri("42,42 56,20 66,42")}`) },
    crossroad: { name: "Crossroad (4-way intersection) ahead", svg: dia(Y, ln("M60 24 V96 M24 60 H96", 11)) },
    sideroad: { name: "Side road enters from the right ahead", svg: dia(Y, ln("M54 24 V96 M54 52 H90", 11)) },
    tee: { name: "T-intersection ahead: road ends, turn left or right", svg: dia(Y, ln("M60 96 V56 M28 50 H92", 11)) },
    yjunction: { name: "Y-intersection ahead: road splits", svg: dia(Y, ln("M60 96 V66 L38 34 M60 66 L82 34", 11)) },
    merge: { name: "Merge: traffic from the right joins your lane", svg: dia(Y, `${ln("M52 98 V24", 11)}${ln("M86 92 Q86 70 58 56", 8)}`) },
    laneends: { name: "Lane ends: right lane ends, merge left", svg: dia(Y, `${ln("M40 98 V22", 8)}${ln("M84 94 V68 L66 46 V22", 8)}${ln("M62 96 V88 M62 80 V72", 5)}`) },
    addedlane: { name: "Added lane: a new lane joins, no need to merge", svg: dia(Y, `${ln("M48 98 V24", 10)}${ln("M84 96 Q84 72 72 62 V26", 8)}`) },
    divided: { name: "Divided highway begins ahead", svg: dia(Y, `${ln("M46 98 V70 L36 56 V24", 7)}${ln("M74 98 V70 L84 56 V24", 7)}${tri("60,62 70,50 70,24 50,24 50,50")}`) },
    dividedends: { name: "Divided highway ends: two-way traffic ahead", svg: dia(Y, `<g transform="rotate(180 60 60)">${ln("M46 98 V70 L36 56 V24", 7)}${ln("M74 98 V70 L84 56 V24", 7)}${tri("60,62 70,50 70,24 50,24 50,50")}</g>`) },
    twoway: { name: "Two-way traffic ahead", svg: dia(Y, `${ln("M46 36 V84", 8)}${tri("36,80 46,98 56,80")}${ln("M74 36 V84", 8)}${tri("64,40 74,22 84,40")}`) },
    hill: { name: "Hill: steep downgrade ahead", svg: dia(Y, `${tri("26,70 26,92 96,92")}<g transform="rotate(16 56 60)"><rect x="34" y="42" width="30" height="16" fill="${K}"/><rect x="64" y="48" width="13" height="10" fill="${K}"/><circle cx="42" cy="62" r="5" fill="${K}"/><circle cx="70" cy="62" r="5" fill="${K}"/></g>`) },
    slippery: { name: "Slippery when wet", svg: dia(Y, `<rect x="42" y="28" width="36" height="24" rx="6" fill="${K}"/><rect x="38" y="48" width="8" height="10" rx="2" fill="${K}"/><rect x="74" y="48" width="8" height="10" rx="2" fill="${K}"/>${ln("M46 66 q-10 8 0 14 t0 14 M74 66 q10 8 0 14 t0 14", 5)}`) },
    pedestrian: { name: "Pedestrian crossing ahead", svg: dia(Y, walker()) },
    bicycle: { name: "Bicycle crossing ahead", svg: dia(Y, bike()) },
    signal: { name: "Traffic signal ahead", svg: dia(Y, `<rect x="47" y="24" width="26" height="72" rx="6" fill="${K}"/><circle cx="60" cy="38" r="8" fill="${R}"/><circle cx="60" cy="60" r="8" fill="${Y}"/><circle cx="60" cy="82" r="8" fill="#2fbf5a"/>`) },
    stopahead: { name: "Stop sign ahead", svg: dia(Y, `${octa(60, 44, 20)}${ln("M60 98 V74", 8)}${tri("49,78 60,64 71,78")}`) },
    yieldahead: { name: "Yield sign ahead", svg: dia(Y, `<polygon points="38,26 82,26 60,62" fill="${W}" stroke="${R}" stroke-width="7" stroke-linejoin="round"/>${ln("M60 98 V78", 8)}${tri("49,82 60,68 71,82")}`) },
    school: { name: "School zone or school crossing", svg: `<polygon points="60,4 112,44 112,116 8,116 8,44" fill="${FYG}" stroke="${K}" stroke-width="4"/>${walker('transform="translate(-16,22) scale(0.85)"')}${walker('transform="translate(26,26) scale(0.78)"')}` },
    rrahead: { name: "Railroad crossing ahead", svg: `<circle cx="60" cy="60" r="55" fill="${Y}" stroke="${K}" stroke-width="4"/>${ln("M30 30 L90 90 M90 30 L30 90", 7)}<text x="30" y="68" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="22" fill="${K}">R</text><text x="90" y="68" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="22" fill="${K}">R</text>` },
    crossbuck: { name: "Railroad crossing (at the tracks): yield to trains", svg: `<g transform="rotate(40 60 60)"><rect x="4" y="50" width="112" height="20" fill="${W}" stroke="${K}" stroke-width="4"/></g><g transform="rotate(-40 60 60)"><rect x="4" y="50" width="112" height="20" fill="${W}" stroke="${K}" stroke-width="4"/></g>` },
    smv: { name: "Slow-moving vehicle (25 mph or less)", svg: `<polygon points="60,10 112,104 8,104" fill="#ff6a13" stroke="${R}" stroke-width="12" stroke-linejoin="round"/>` },
    pennant: { name: "No passing zone (left side of road)", svg: `<polygon points="6,20 6,100 116,60" fill="${Y}" stroke="${K}" stroke-width="5" stroke-linejoin="round"/><text x="40" y="52" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="13" fill="${K}">NO</text><text x="42" y="68" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="12" fill="${K}">PASSING</text><text x="40" y="84" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="12" fill="${K}">ZONE</text>` },
    pennantblank: { name: "No passing zone (shape only)", svg: `<polygon points="6,20 6,100 116,60" fill="${Y}" stroke="${K}" stroke-width="5" stroke-linejoin="round"/>` },
    diamondblank: { name: "Warning (shape only)", svg: dia(Y, "") },

    // ---------- Work zones (orange) ----------
    construction: { name: "Road work ahead", svg: dia(O, `<text x="60" y="56" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="15" fill="${K}">ROAD</text><text x="60" y="75" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="15" fill="${K}">WORK</text>`) },
    flagger: { name: "Flagger ahead (work zone)", svg: dia(O, `<circle cx="54" cy="32" r="7" fill="${K}"/>${ln("M54 42 V70 M54 70 L46 92 M54 70 L62 92 M54 48 L40 62 M54 48 L72 40 V26", 7)}<rect x="72" y="24" width="16" height="12" fill="${K}"/>`) },
    workers: { name: "Workers ahead (work zone)", svg: dia(O, `<circle cx="48" cy="34" r="7" fill="${K}"/>${ln("M48 44 L52 68 M52 68 L42 90 M52 68 L64 88 M50 50 L68 62 M50 54 L64 66 M66 60 L80 82", 7)}${tri("72,92 96,92 86,78")}`) },

    // ---------- Guide and services ----------
    guide: { name: "Guide sign (directions and distance)", svg: `<rect x="4" y="22" width="112" height="76" rx="10" fill="${G}" stroke="${W}" stroke-width="4"/><text x="60" y="55" text-anchor="middle" font-family="Arial" font-weight="700" font-size="17" fill="${W}">Haleʻiwa</text><text x="60" y="82" text-anchor="middle" font-family="Arial" font-weight="700" font-size="17" fill="${W}">12 mi</text>` },
    hospital: { name: "Hospital (services)", svg: sq(`<text x="60" y="88" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="72" fill="${W}">H</text>`, B) },
    interstate: { name: "Interstate route marker (like H-1)", svg: `<path d="M14 18 Q60 4 106 18 Q114 70 60 114 Q6 70 14 18 Z" fill="${B}" stroke="${W}" stroke-width="4"/><path d="M14 18 Q60 4 106 18 L104 36 H16 Z" fill="${R}"/><text x="60" y="80" text-anchor="middle" font-family="Arial Black, Arial" font-weight="900" font-size="32" fill="${W}">H-1</text>` },
    recreation: { name: "Recreation or cultural interest (brown)", svg: `<rect x="4" y="22" width="112" height="76" rx="10" fill="#6b3f1e" stroke="${W}" stroke-width="4"/><text x="60" y="55" text-anchor="middle" font-family="Arial" font-weight="700" font-size="15" fill="${W}">Beach Park</text><text x="60" y="80" text-anchor="middle" font-family="Arial" font-weight="700" font-size="15" fill="${W}">Next Right</text>` },
  };
})();
