"use strict";

/* ============================================================
   هفت خبیث — score keeper
   Pure client-side, saved to localStorage. No build step.
   ============================================================ */

const STORAGE_KEY = "khabis_state_v1";

/* ---------- Digit helpers (Persian display / parsing) ---------- */
const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

function toFa(value) {
  return String(value)
    .replace(/-/g, "−")
    .replace(/[0-9]/g, (d) => FA_DIGITS[Number(d)]);
}

// Convert Persian/Arabic digits (and minus signs) to a JS-parseable number string.
function normalizeNumber(str) {
  return String(str)
    .replace(/[۰-۹]/g, (d) => "۰۱۲۳۴۵۶۷۸۹".indexOf(d))
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[−–—]/g, "-")
    .replace(/[^0-9-]/g, "");
}

function parseIntSafe(str) {
  const n = parseInt(normalizeNumber(str), 10);
  return Number.isFinite(n) ? n : 0;
}

/* ---------- State ---------- */
let state = null;
let setupNames = ["", "", ""]; // working list before a game starts

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    /* storage may be unavailable in private mode; ignore */
  }
}

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch (e) {
    return null;
  }
}

/* ---------- DOM refs ---------- */
const $ = (id) => document.getElementById(id);
const screens = {
  setup: $("screen-setup"),
  game: $("screen-game"),
  finished: $("screen-finished"),
};

/* ============================================================
   SETUP SCREEN
   ============================================================ */
function renderSetup() {
  const container = $("setup-players");
  container.innerHTML = "";
  setupNames.forEach((name, i) => {
    const row = document.createElement("div");
    row.className = "player-row";
    row.innerHTML = `
      <span class="player-index">${toFa(i + 1)}</span>
      <input class="text-input" type="text" data-idx="${i}"
             placeholder="نام بازیکن ${toFa(i + 1)}" value="${escapeHtml(name)}" />
      <button class="remove-btn" type="button" data-remove="${i}"
              ${setupNames.length <= 2 ? "disabled" : ""} aria-label="حذف">×</button>`;
    container.appendChild(row);
  });

  container.querySelectorAll("input[data-idx]").forEach((inp) => {
    inp.addEventListener("input", (e) => {
      setupNames[Number(e.target.dataset.idx)] = e.target.value;
    });
  });
  container.querySelectorAll("button[data-remove]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = Number(e.currentTarget.dataset.remove);
      setupNames.splice(idx, 1);
      renderSetup();
    });
  });

  $("player-count-badge").textContent = toFa(setupNames.length) + " نفر";
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

$("add-player-btn").addEventListener("click", () => {
  if (setupNames.length >= 12) {
    showToast("حداکثر ۱۲ بازیکن");
    return;
  }
  setupNames.push("");
  renderSetup();
});

$("start-btn").addEventListener("click", startGame);

function startGame() {
  const errEl = $("setup-error");
  errEl.hidden = true;

  const elim = parseIntSafe($("elim-input").value);
  const names = setupNames.map((n) => n.trim());

  // Fill in default names for blanks.
  const filled = names.map((n, i) => (n === "" ? "بازیکن " + toFa(i + 1) : n));

  if (filled.length < 2) {
    return showError("حداقل دو بازیکن لازم است.");
  }
  if (elim < 1) {
    return showError("امتیاز حذف باید بزرگ‌تر از صفر باشد.");
  }
  const lowered = filled.map((n) => n.toLowerCase());
  if (new Set(lowered).size !== lowered.length) {
    return showError("نام بازیکن‌ها نباید تکراری باشد.");
  }

  state = KhabisEngine.createGame(filled, elim, (i) => "p" + i);
  saveState();
  render();
}

function showError(msg) {
  const errEl = $("setup-error");
  errEl.textContent = msg;
  errEl.hidden = false;
}

/* ============================================================
   GAME SCREEN
   ============================================================ */
function activePlayers() {
  return KhabisEngine.activePlayers(state);
}

function sortedForBoard() {
  // Active players first (by score ascending — lowest/leader on top),
  // then eliminated players by their finishing rank.
  const active = state.players.filter((p) => p.active).sort((a, b) => a.score - b.score);
  const out = state.players.filter((p) => !p.active).sort((a, b) => (a.rank || 0) - (b.rank || 0));
  return active.concat(out);
}

function renderGame() {
  const elim = state.eliminationScore;
  const totalSum = state.players.reduce((s, p) => s + p.score, 0);

  $("stat-hand").textContent = toFa(state.handNumber);
  $("stat-active").textContent = toFa(activePlayers().length);
  $("stat-sum").textContent = toFa(totalSum);
  $("stat-elim").textContent = toFa(elim);

  const board = $("scoreboard");
  board.innerHTML = "";

  const ordered = sortedForBoard();
  const leaderId = activePlayers().length
    ? activePlayers().sort((a, b) => a.score - b.score)[0].id
    : null;

  ordered.forEach((p, i) => {
    const isLeader = p.active && p.id === leaderId && activePlayers().length > 1;
    const pct = Math.max(0, Math.min(100, (p.score / elim) * 100));
    const danger = pct >= 75;

    const row = document.createElement("div");
    row.className = "score-row" + (isLeader ? " leader" : "") + (!p.active ? " eliminated" : "");

    let tag = "";
    if (!p.active) tag = `<span class="score-tag tag-out">حذف · رتبه ${toFa(p.rank)}</span>`;
    else if (isLeader) tag = `<span class="score-tag tag-lead">جلوتر</span>`;

    row.innerHTML = `
      <span class="rank-chip">${toFa(i + 1)}</span>
      <div class="score-main">
        <div class="score-name">${escapeHtml(p.name)} ${tag}</div>
        <div class="progress ${danger ? "danger" : ""}">
          <span style="width:${p.active ? pct : 100}%"></span>
        </div>
      </div>
      <div class="score-value">
        <b>${toFa(p.score)}</b>
        <small>از ${toFa(elim)}</small>
      </div>`;
    board.appendChild(row);
  });

  $("undo-btn").disabled = state.history.length === 0;
  $("undo-btn").style.opacity = state.history.length === 0 ? "0.4" : "1";
}

/* ---------- New hand entry ---------- */
$("new-hand-btn").addEventListener("click", openHandModal);

function openHandModal() {
  const wrap = $("hand-inputs");
  wrap.innerHTML = "";
  activePlayers()
    .sort((a, b) => a.score - b.score)
    .forEach((p) => {
      const row = document.createElement("div");
      row.className = "hand-input-row";
      row.innerHTML = `
        <div>
          <div class="hi-name">${escapeHtml(p.name)}</div>
          <div class="hi-current">فعلی: ${toFa(p.score)}</div>
        </div>
        <input class="hi-input" type="text" inputmode="numeric"
               data-pid="${p.id}" value="0"
               onfocus="this.select()" />`;
      wrap.appendChild(row);
    });

  wrap.querySelectorAll(".hi-input").forEach((inp) => {
    inp.addEventListener("input", updateHandTotal);
  });
  updateHandTotal();
  openModal("hand-modal");
  const first = wrap.querySelector(".hi-input");
  if (first) setTimeout(() => first.focus(), 50);
}

function updateHandTotal() {
  let sum = 0;
  document.querySelectorAll("#hand-inputs .hi-input").forEach((inp) => {
    sum += parseIntSafe(inp.value);
  });
  $("hand-total-value").textContent = toFa(sum);
}

$("hand-confirm-btn").addEventListener("click", confirmHand);
$("hand-cancel-btn").addEventListener("click", () => closeModal("hand-modal"));

function confirmHand() {
  const deltas = {};
  document.querySelectorAll("#hand-inputs .hi-input").forEach((inp) => {
    deltas[inp.dataset.pid] = parseIntSafe(inp.value);
  });

  const result = KhabisEngine.applyHand(state, deltas);
  saveState();
  closeModal("hand-modal");
  render();

  const out = result.eliminated;
  if (out.length === 1) showToast(`${out[0].name} حذف شد`);
  else if (out.length > 1) showToast(`${toFa(out.length)} بازیکن حذف شدند`);
}

/* ---------- Undo ---------- */
$("undo-btn").addEventListener("click", () => {
  if (!KhabisEngine.undo(state)) return;
  saveState();
  render();
  showToast("دست آخر برگردانده شد");
});

/* ---------- Reset ---------- */
$("reset-btn").addEventListener("click", askReset);
$("finished-reset-btn").addEventListener("click", askReset);

function askReset() {
  openConfirm("بازی جدید", "بازی فعلی پاک می‌شود و از نو شروع می‌کنید. مطمئن هستید؟", () => {
    resetToSetup();
  });
}

function resetToSetup() {
  const names = state ? state.players.map((p) => p.name) : setupNames;
  state = null;
  localStorage.removeItem(STORAGE_KEY);
  setupNames = names.length >= 2 ? names.slice() : ["", "", ""];
  render();
}

/* ============================================================
   FINISHED SCREEN
   ============================================================ */
function renderFinished() {
  const champ = state.players.find((p) => p.rank === 1);
  $("champion-name").textContent = champ ? champ.name : "—";

  const list = $("final-ranking");
  list.innerHTML = "";
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  state.players
    .slice()
    .sort((a, b) => (a.rank || 99) - (b.rank || 99))
    .forEach((p) => {
      const li = document.createElement("li");
      li.className = p.rank === 1 ? "rank-1" : "";
      li.innerHTML = `
        <span class="medal">${medals[p.rank] || toFa(p.rank)}</span>
        <span class="r-name">${escapeHtml(p.name)}</span>
        <span class="r-score">${toFa(p.score)} <small>امتیاز</small></span>`;
      list.appendChild(li);
    });
}

/* ============================================================
   MODAL HELPERS
   ============================================================ */
function openModal(id) {
  $(id).hidden = false;
}
function closeModal(id) {
  $(id).hidden = true;
}

document.querySelectorAll("[data-close]").forEach((el) => {
  el.addEventListener("click", () => {
    el.closest(".modal").hidden = true;
  });
});

let confirmCallback = null;
function openConfirm(title, message, onOk) {
  $("confirm-title").textContent = title;
  $("confirm-message").textContent = message;
  confirmCallback = onOk;
  openModal("confirm-modal");
}
$("confirm-ok-btn").addEventListener("click", () => {
  closeModal("confirm-modal");
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});
$("confirm-cancel-btn").addEventListener("click", () => {
  closeModal("confirm-modal");
  confirmCallback = null;
});

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.hidden = true;
  }, 2200);
}

/* ============================================================
   ROUTER / BOOT
   ============================================================ */
function render() {
  const phase = state ? state.phase : "setup";
  Object.entries(screens).forEach(([name, el]) => {
    el.hidden = name !== phase;
  });
  if (phase === "setup") renderSetup();
  else if (phase === "playing") renderGame();
  else if (phase === "finished") renderFinished();
}

function boot() {
  const saved = loadState();
  if (saved && saved.players && saved.players.length) {
    state = saved;
  } else {
    state = null;
    renderSetup();
  }
  render();
}

boot();
