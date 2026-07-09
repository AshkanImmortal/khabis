"use strict";
/* ============================================================
   هفت خبیث — game engine (pure logic, no DOM).
   Works both as a browser global (window.KhabisEngine) and as a
   Node module (require) so the rules can be unit-tested headlessly.
   ============================================================ */
(function (root) {
  /**
   * Create a fresh game.
   * @param {string[]} names            player display names
   * @param {number}   eliminationScore reaching this score knocks a player out
   * @param {(i:number)=>string} idFactory unique id per player
   */
  function createGame(names, eliminationScore, idFactory) {
    return {
      phase: "playing",
      eliminationScore: eliminationScore,
      handNumber: 0,
      players: names.map(function (name, i) {
        return { id: idFactory(i), name: name, score: 0, active: true, rank: null };
      }),
      history: [], // snapshots taken before each hand, for undo
    };
  }

  function activePlayers(state) {
    return state.players.filter(function (p) { return p.active; });
  }

  function snapshot(state) {
    return {
      handNumber: state.handNumber,
      players: state.players.map(function (p) { return Object.assign({}, p); }),
    };
  }

  /**
   * Apply one hand. `deltas` maps player id -> points to add.
   * Mutates `state`; returns { eliminated: player[], finished: boolean }.
   */
  function applyHand(state, deltas) {
    state.history.push(snapshot(state));
    state.handNumber += 1;
    state.players.forEach(function (p) {
      if (p.active && deltas[p.id] != null) p.score += deltas[p.id];
    });
    var eliminated = processEliminations(state);
    return { eliminated: eliminated, finished: state.phase === "finished" };
  }

  function processEliminations(state) {
    var elim = state.eliminationScore;
    var active = activePlayers(state);
    var reached = active.filter(function (p) { return p.score >= elim; });
    if (reached.length === 0) {
      checkGameOver(state);
      return [];
    }

    // Never eliminate everyone in a single hand: the lowest score among the
    // currently-active players always survives as the (potential) champion.
    if (active.length - reached.length < 1) {
      var keep = active.slice().sort(function (a, b) { return a.score - b.score; })[0];
      reached = reached.filter(function (p) { return p.id !== keep.id; });
    }

    // Rank among players active going into this hand: last one standing is
    // rank 1, so the worst (highest) score gets the highest rank number.
    var activeCount = active.length;
    var ranked = reached.slice().sort(function (a, b) { return b.score - a.score; });
    ranked.forEach(function (p, idx) {
      p.active = false;
      p.rank = activeCount - idx;
    });

    checkGameOver(state);
    return ranked;
  }

  function checkGameOver(state) {
    var active = activePlayers(state);
    if (active.length <= 1) {
      if (active.length === 1) active[0].rank = 1;
      state.phase = "finished";
    }
  }

  /** Roll back the most recent hand. Returns true if something was undone. */
  function undo(state) {
    if (!state.history.length) return false;
    var snap = state.history.pop();
    state.handNumber = snap.handNumber;
    state.players = snap.players.map(function (p) { return Object.assign({}, p); });
    state.phase = "playing";
    return true;
  }

  var api = {
    createGame: createGame,
    activePlayers: activePlayers,
    applyHand: applyHand,
    undo: undo,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.KhabisEngine = api;
})(typeof self !== "undefined" ? self : this);
