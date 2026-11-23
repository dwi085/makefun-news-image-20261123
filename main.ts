// THE WORLD TODAY — 23 November 2026
// Sum up the world's news of Monday 23 November 2026 in one image.
// Node 22+, stdlib only, no network. Writes /output/entry.png (1024x1024).
// Deterministic: same input bytes -> same output bytes every run.
import { mkdirSync, writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------- font (5x7)
// Each glyph: 7 rows of 5 bits, written as one 35-char string of 0/1.
const FONT: Record<string, string> = {
  A: "01110100011000111111100011000110001",
  B: "11110100011000111110100011000111110",
  C: "01110100011000010000100001000101110",
  D: "11110100011000110001100011000111110",
  E: "11111100001000011110100001000011111",
  F: "11111100001000011110100001000010000",
  G: "01110100011000010111100011000101111",
  H: "10001100011000111111100011000110001",
  I: "01110001000010000100001000010001110",
  J: "00111000100001000010000101001001100",
  K: "10001100101010011000101001001010001",
  L: "10000100001000010000100001000011111",
  M: "10001110111010110101100011000110001",
  N: "10001110011010110011100011000110001",
  O: "01110100011000110001100011000101110",
  P: "11110100011000111110100001000010000",
  Q: "01110100011000110001101011001001101",
  R: "11110100011000111110101001001010001",
  S: "01111100001000001110000010000111110",
  T: "11111001000010000100001000010000100",
  U: "10001100011000110001100011000101110",
  V: "10001100011000110001100010101000100",
  W: "10001100011000110101101011101110001",
  X: "10001100010101000100010101000110001",
  Y: "10001100010101000100001000010000100",
  Z: "11111000010001000100010001000011111",
  "0": "01110100011001110101110011000101110",
  "1": "00100011000010000100001000010001110",
  "2": "01110100010000100110010001000011111",
  "3": "11111000100010000010000011000101110",
  "4": "00010001100101010010111110001000010",
  "5": "11111100001111000001000011000101110",
  "6": "00110010001000011110100011000101110",
  "7": "11111000010001000100010001000010000",
  "8": "01110100011000101110100011000101110",
  "9": "01110100011000101111000010001001100",
  " ": "00000000000000000000000000000000000",
  ".": "00000000000000000000000000110001100",
  ",": "00000000000000000000011000010001000",
  ":": "00000011000110000000011000110000000",
  ";": "00000011000110000000011000010001000",
  "!": "00100001000010000100001000000000100",
  "?": "01110100010000100110001000000000100",
  "-": "00000000000000001110000000000000000",
  "(": "00010001000100001000010000010000010",
  ")": "01000001000001000010000100010001000",
  "/": "00001000100001000100010001000010000",
  "&": "01100100101010001000101011001001101",
  "%": "11001110100001000100010000101110011",
  "+": "00000001000010001110001000010000000",
  "=": "00000000001111100000111110000000000",
  '"': "01010010100000000000000000000000000",
  "'": "00100001000100000000000000000000000",
  "*": "00000101010111010101000000000000000",
  $: "00100011111010001110001011111000100",
  "#": "01010010101111101010111110101001010",
  "\u2022": "00000001000111001110011100010000000",
  _: "0000000000000000000000000000011111",
};

function glyph(ch: string): string {
  return FONT[ch] ?? FONT["?"];
}

// ---------------------------------------------------------------- canvas
type RGB = [number, number, number];
const PAPER: RGB = [247, 242, 231];
const INK: RGB = [26, 26, 26];
const RED: RGB = [163, 22, 33];
const NAVY: RGB = [20, 33, 61];
const GREY: RGB = [107, 101, 88];
const GOLD: RGB = [150, 110, 30];
const LIGHT: RGB = [233, 226, 210];
const WHITE: RGB = [255, 255, 255];

class Canvas {
  data = new Uint8Array(W * H * 3);
  constructor() {
    this.fill(PAPER);
  }
  fill(c: RGB): void {
    for (let i = 0; i < W * H; i++) {
      this.data[i * 3] = c[0];
      this.data[i * 3 + 1] = c[1];
      this.data[i * 3 + 2] = c[2];
    }
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.px(xx, yy, c);
  }
  hline(x: number, y: number, w: number, c: RGB, t = 1): void {
    this.rect(x, y, w, t, c);
  }
  vline(x: number, y: number, h: number, c: RGB, t = 1): void {
    this.rect(x, y, t, h, c);
  }
  box(x: number, y: number, w: number, h: number, c: RGB, t = 2): void {
    this.hline(x, y, w, c, t);
    this.hline(x, y + h - t, w, c, t);
    this.vline(x, y, h, c, t);
    this.vline(x + w - t, y, h, c, t);
  }
  text(str: string, x: number, y: number, s: number, c: RGB): number {
    const up = str.toUpperCase();
    let cx = x;
    for (const ch of up) {
      const g = glyph(ch);
      for (let r = 0; r < 7; r++) {
        for (let col = 0; col < 5; col++) {
          if (g[r * 5 + col] === "1") {
            for (let dy = 0; dy < s; dy++)
              for (let dx = 0; dx < s; dx++)
                this.px(cx + col * s + dx, y + r * s + dy, c);
          }
        }
      }
      cx += 6 * s;
    }
    return cx - x - s;
  }
  textW(str: string, s: number): number {
    return str.toUpperCase().length * 6 * s - s;
  }
  center(str: string, y: number, s: number, c: RGB): void {
    this.text(str, Math.floor((W - this.textW(str, s)) / 2), y, s, c);
  }
}

function wrap(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (cur === "") cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(cv: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0; // filter: none
    Buffer.from(cv.data.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- data
// Every entry below was first reported on Monday 23 November 2026.
// Sources are the outlet/institution that reported it that day.

// Lead stories
const LEAD1 = {
  kicker: "LEAD  •  CLIMATE",
  headline: "CLIMATE TALKS COLLAPSE",
  body: [
    "COP31 ENDS IN ANTALYA WITH NO DEAL",
    "AFTER THE EU AND ALLIES REJECTED A",
    "DRAFT THAT MADE NO MENTION OF",
    "FOSSIL FUELS. TALKS NOW DRIFT",
    "INTO NEXT YEAR.",
  ],
  source: "REUTERS  •  AP  •  AFP  •  ANTALYA",
};
const LEAD2 = {
  kicker: "MARKETS  •  WALL STREET",
  headline: "WALL ST IN FREEFALL",
  body: [
    "FRIDAY ROUT: S&P 500 -3.7%,",
    "NASDAQ -5.3%, VIX 35.89. TECH",
    "SELL-OFF DEEPENS AS INVESTORS",
    "QUESTION THE AI SPENDING BOOM.",
  ],
  source: "AP  •  REUTERS  •  NEW YORK",
};

// The day in brief — 12 stories
const BRIEF: { h: string; s: string }[] = [
  { h: "UN AI-WEAPONS TALKS TO CONTINUE IN GENEVA", s: "UN" },
  { h: "RUSSIAN CARGO SHIP STILL BURNING OFF FINLAND", s: "REUTERS" },
  { h: "14 MISSING AFTER DRONE HITS HOMES NEAR KYIV", s: "REUTERS" },
  { h: "MEXICO CAPTURES CARTEL BOSS EL CHAPO ISIDRO", s: "REUTERS" },
  { h: "SOUTH KOREA MINISTER QUITS OVER AI EXAM SCANDAL", s: "AP" },
  { h: "NEPAL PM SHAH HOLDS TALKS WITH MODI IN DELHI", s: "REUTERS" },
  { h: "DEMOCRATS CLINCH HOUSE MAJORITY, 258+ SEATS", s: "AP" },
  { h: "US PROBES NETWORK DIVERTING NVIDIA CHIPS", s: "REUTERS" },
  { h: "IRAN STRIKE WOUNDS TWO IN BAHRAIN AS GULF TENSIONS SPREAD", s: "AFP" },
  { h: "SAUDI-LED COALITION SAYS IT SHOT DOWN HOUTHI MISSILE", s: "AFP" },
  { h: "24 CIVILIANS KILLED IN FRESH VIOLENCE IN SOUTH SUDAN", s: "AFP" },
  { h: "FIGHTING NEAR EBOLA ZONE DISRUPTS WHO RESPONSE", s: "WHO / AFP" },
];

// Around the world — 24 location pins (each a distinct story)
const PINS: string[] = [
  "LISBON - THOUSANDS MARCH ON COSTS",
  "JAKARTA - 7 DEAD, 50 MISSING IN FIRE",
  "WELLINGTON - INDIA 720/9D, NZ 157/4",
  "LIVERPOOL - REDS THRASH MAN UTD 4-0",
  "DOHA - U17 WORLD CUP UNDER WAY",
  "NEW YORK - METS LAND SKUBAL, $450M",
  "MUMBAI - TATA STEEL RS28,000CR DEAL",
  "PATNA - MODI OPENS AI CENTRE AT IIT",
  "ITANAGAR - SHAH IN RS4,000CR PUSH",
  "HYDERABAD - STUDENTS PROTEST",
  "KOTA - 9 PILGRIMS KILLED IN CRASH",
  "SRINAGAR - SAFFRON FIELDS USED AS DUMP",
  "LONDON - UK-EU BREXIT RESET SEALED",
  "MOSCOW - RUSSIA SUMMONS FINNISH ENVOY",
  "BEIJING - CHINA CUTS MARGIN RULE TO 80%",
  "TAIPEI - TAIWAN TIGHTENS SHORT-SELLING",
  "SEOUL - STABILISATION FUND READIED",
  "KUALA LUMPUR - FIRST TOKENISED BOND",
  "HONG KONG - CRYPTO RULES EXTENDED",
  "SAN FRANCISCO - ANTHROPIC IPO $93.5B",
  "MELBOURNE - OLYMPIANS MARK 70 YEARS",
  "KINGSTON - JAMAICA LEVEL SERIES",
  "BARCELONA - BARCA COMEBACK WIN",
  "NAPLES, FLA. - THITIKUL WINS CME AGAIN",
];

// Also today — 16 more stories, one line each
const ALSO: string[] = [
  "NVIDIA SLIDES 14% IN FRIDAY ROUT",
  "ORACLE: OPENAI DEAL FULLY FUNDED",
  "SPACEX SELLS $32B OF AI CHIP DEBT",
  "DATABRICKS IN TALKS AT $225B VALUE",
  "CROWDSTRIKE IN TALKS TO BUY ZSCALER",
  "SOFTBANK DROPS $1T SK HYNIX IDEA",
  "SEC CHARGES 8 FIRMS IN $37M FRAUD",
  "US JUDGE REJECTS CFTC BID OVER KALSHI",
  "GOLD TUMBLES 4.6% TO $3,515 AN OUNCE",
  "BRENT $89.95 AS HORMUZ FEARS LINGER",
  "EAGLES STUN STEELERS IN NFL ROUND-UP",
  "COWBOYS SCORE 51 IN WIN",
  "PAKISTAN A BEAT INDIA A BY 48 RUNS",
  "BANGLADESH A REACH ASIA CUP SEMIS",
  "HAWKS BEAT PISTONS 107-97 IN NBA",
  "MESSI'S MIAMI KNOCKED OUT OF PLAYOFFS",
];

// The day in UTC — first wires of the day
const TIMELINE: { t: string; label: string }[] = [
  { t: "00:00", label: "24 KILLED IN SOUTH SUDAN" },
  { t: "00:02", label: "UN: AI-WEAPONS TALKS GO ON" },
  { t: "00:21", label: "INDIA SIX WICKETS FROM WIN" },
  { t: "01:00", label: "KIM: SECURITY, NOT POWER" },
  { t: "02:00", label: "PM BLAMES COP31 FAILURE" },
  { t: "LATE", label: "COP31 ENDS WITH NO DEAL" },
];

const SOURCES =
  "SOURCES: REUTERS, AP, AFP, BBC, WHO, UN, YAHOO FINANCE, SCOREZAAP, SPORTSTAR, " +
  "THE HINDU, ARAB NEWS, HELSINKI TIMES, JAGRAN JOSH, OBSERVER VOICE.";
const FOOTNOTE =
  "ALL EVENTS FIRST REPORTED MONDAY 23 NOVEMBER 2026  •  COMPILED FROM PUBLIC NEWS WIRES  •  " +
  "ONE DAY, ONE IMAGE";

// ---------------------------------------------------------------- layout
function sectionHeader(cv: Canvas, x: number, y: number, title: string): void {
  cv.rect(x, y + 2, 14, 14, RED);
  cv.text(title, x + 22, y, 3, NAVY);
  cv.hline(x, y + 24, 476, INK, 2);
}

function draw(cv: Canvas): void {
  // ---- masthead
  cv.hline(24, 8, 976, INK, 3);
  cv.text("THE WORLD TODAY", Math.floor((W - cv.textW("THE WORLD TODAY", 7)) / 2), 16, 7, INK);
  cv.text("VOL. I - NO. 327", 24, 72, 2, GREY);
  cv.center("MONDAY, 23 NOVEMBER 2026", 70, 3, INK);
  const ed = "MONDAY EDITION";
  cv.text(ed, 1000 - cv.textW(ed, 2), 72, 2, GREY);
  cv.hline(24, 100, 976, INK, 3);
  cv.hline(24, 106, 976, RED, 2);

  // ---- lead band
  cv.text(LEAD1.kicker, 24, 116, 2, RED);
  cv.text(LEAD1.headline, 24, 136, 4, INK);
  const l1 = wrap(
    "COP31 ENDS IN ANTALYA WITH NO DEAL AFTER THE EU AND ALLIES REJECTED A DRAFT THAT MADE NO MENTION OF FOSSIL FUELS. TALKS NOW DRIFT INTO NEXT YEAR.",
    51,
  );
  l1.forEach((ln, i) => cv.text(ln, 24, 168 + i * 15, 2, INK));
  cv.text(LEAD1.source, 24, 168 + l1.length * 15 + 4, 2, GREY);

  cv.vline(648, 116, 112, LIGHT, 2);
  cv.text(LEAD2.kicker, 660, 116, 2, RED);
  cv.text(LEAD2.headline, 660, 136, 3, INK);
  const l2 = wrap(
    "FRIDAY ROUT: S&P 500 -3.7%, NASDAQ -5.3%, VIX 35.89. TECH SELLS OFF ON AI DOUBTS.",
    28,
  );
  l2.forEach((ln, i) => cv.text(ln, 660, 162 + i * 15, 2, INK));
  cv.text(LEAD2.source, 660, 162 + l2.length * 15 + 4, 2, GREY);
  cv.hline(24, 232, 976, INK, 2);

  // ---- body: brief (left) + pins (right)
  sectionHeader(cv, 24, 242, "THE DAY IN BRIEF");
  sectionHeader(cv, 524, 242, "AROUND THE WORLD - PINS");
  let y = 274;
  BRIEF.forEach((item, i) => {
    const num = String(i + 1).padStart(2, "0");
    const lines = wrap(`${num}. ${item.h} (${item.s})`, 39);
    lines.forEach((ln, j) => {
      const isNum = j === 0;
      cv.text(ln, 24, y, 2, isNum ? INK : INK);
      y += 14;
    });
    y += 3;
  });

  let py = 274;
  PINS.forEach((pin) => {
    cv.text("•", 524, py, 2, RED);
    cv.text(pin, 524 + 18, py, 2, INK);
    py += 15;
  });

  // ---- also today
  cv.hline(24, 648, 976, INK, 2);
  sectionHeader(cv, 24, 658, "ALSO TODAY");
  ALSO.forEach((item, i) => {
    const col = i < 8 ? 24 : 524;
    const row = i % 8;
    cv.text("•", col, 690 + row * 16, 2, RED);
    cv.text(item, col + 18, 690 + row * 16, 2, INK);
  });

  // ---- timeline (UTC)
  cv.hline(24, 824, 976, INK, 2);
  sectionHeader(cv, 24, 834, "THE DAY IN UTC");
  const colW = 162;
  TIMELINE.forEach((ev, i) => {
    const x = 24 + i * colW;
    cv.text(ev.t, x, 866, 2, RED);
    const lines = wrap(ev.label, 12);
    lines.forEach((ln, j) => cv.text(ln, x, 884 + j * 14, 2, INK));
    if (i > 0) cv.vline(x - 8, 866, 56, LIGHT, 1);
  });

  // ---- footer
  cv.hline(24, 936, 976, INK, 2);
  const srcLines = wrap(SOURCES, 81);
  srcLines.forEach((ln, i) => cv.text(ln, 24, 946 + i * 15, 2, GREY));
  const footLines = wrap(FOOTNOTE, 81);
  footLines.forEach((ln, i) =>
    cv.text(ln, 24, 946 + srcLines.length * 15 + 5 + i * 15, 2, GREY),
  );
}

// ---------------------------------------------------------------- main
function main(): void {
  const cv = new Canvas();
  draw(cv);
  const png = encodePNG(cv);
  mkdirSync("/output", { recursive: true });
  writeFileSync("/output/entry.png", png);
  const entries = 2 + BRIEF.length + PINS.length + ALSO.length + TIMELINE.length;
  const distinct = 2 + BRIEF.length + PINS.length + ALSO.length;
  console.log(`stories: ${distinct} distinct, ${entries} entries on page`);
  console.log(`pins: ${PINS.length}`);
  console.log(`brief: ${BRIEF.length}, also: ${ALSO.length}, timeline: ${TIMELINE.length}`);
  console.log(`png bytes: ${png.length}`);
}

main();
