(() => {
  const $ = id => document.getElementById(id);

  let players = [];
  let tournament = null;

  const nameInput = $("nameInput");
  const playersEl = $("players");
  const countText = $("countText");
  const generateBtn = $("generateBtn");

  function escapeHTML(str){
    return str.replace(/[&<>"']/g, ch => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
    }[ch]));
  }

  function updatePlayersUI(){
    countText.textContent = `${players.length} participante${players.length === 1 ? "" : "s"}`;
    $("infoPlayers").textContent = players.length;
    generateBtn.disabled = players.length < 2;

    if (!players.length){
      playersEl.innerHTML = '<div class="empty" style="width:100%">Todavía no agregaste jugadores.</div>';
      return;
    }

    playersEl.innerHTML = players.map((name, i) => `
      <div class="player">
        <span>${escapeHTML(name)}</span>
        <button title="Quitar jugador" onclick="removePlayer(${i})">✕</button>
      </div>
    `).join("");
  }

  window.removePlayer = (index) => {
    players.splice(index, 1);
    updatePlayersUI();
  };

  function addPlayer(){
    const name = nameInput.value.trim();
    if(!name) return;
    if(players.some(p => p.toLowerCase() === name.toLowerCase())){
      alert("Ese nombre ya está agregado.");
      return;
    }
    players.push(name);
    nameInput.value = "";
    nameInput.focus();
    updatePlayersUI();
  }

  $("addBtn").addEventListener("click", addPlayer);
  nameInput.addEventListener("keydown", e => {
    if(e.key === "Enter") addPlayer();
  });



  $("clearBtn").addEventListener("click", () => {
    players = [];
    tournament = null;
    $("bracketSection").style.display = "none";
    updatePlayersUI();
  });

  $("newTournamentBtn").addEventListener("click", () => {
    tournament = null;
    $("bracketSection").style.display = "none";
    window.scrollTo({top:0,behavior:"smooth"});
  });

  function nextPowerOf2(n){
    let p = 1;
    while(p < n) p *= 2;
    return p;
  }

  function roundName(size){
    const map = {
      2:"Final",
      4:"Semifinales",
      8:"Cuartos de final",
      16:"Octavos de final",
      32:"Dieciseisavos de final",
      64:"Treintaidosavos de final"
    };
    return map[size] || `Ronda de ${size}`;
  }

  function shuffle(arr){
    const a = [...arr];
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function createTournament(){
    if(players.length < 2) return;

    const slots = nextPowerOf2(players.length);
    const firstRoundPlayers = shuffle(players);
    while(firstRoundPlayers.length < slots) firstRoundPlayers.push(null);

    const rounds = [];
    let matchCount = slots / 2;
    let roundPlayers = firstRoundPlayers;

    // Ronda inicial
    let initialMatches = [];
    for(let i=0;i<slots;i+=2){
      initialMatches.push({
        id: `r0m${i/2}`,
        p1: roundPlayers[i],
        p2: roundPlayers[i+1],
        s1: null, s2: null,
        winner: null,
        manual: false,
        bye: false
      });
    }

    // Resolver BYEs: si exactamente uno está vacío, el otro avanza.
    initialMatches.forEach(m => {
      if(m.p1 && !m.p2){ m.winner=m.p1; m.bye=true; }
      if(!m.p1 && m.p2){ m.winner=m.p2; m.bye=true; }
    });

    rounds.push({size:slots, name:roundName(slots), matches:initialMatches});

    let size = slots;
    while(size > 2){
      const prev = rounds[rounds.length-1];
      const nextMatches = [];
      for(let i=0;i<prev.matches.length;i+=2){
        nextMatches.push({
          id:`r${rounds.length}m${i/2}`,
          p1:null,p2:null,s1:null,s2:null,winner:null,manual:false,bye:false
        });
      }
      rounds.push({size:size/2, name:roundName(size/2), matches:nextMatches});
      size /= 2;
    }

    tournament = {slots, rounds};
    propagateAll();
    $("bracketSection").style.display = "block";
    $("infoSlots").textContent = slots;
    $("infoRounds").textContent = rounds.length;
    $("bracketLegend").textContent =
      `${players.length} jugadores · cuadro de ${slots} · ${rounds.length} ${rounds.length === 1 ? "ronda" : "rondas"}`;
    render();
    $("bracketSection").scrollIntoView({behavior:"smooth",block:"start"});
  }

  function propagateAll(){
    // Ronda 0 ya tiene sus BYEs.
    for(let r=1;r<tournament.rounds.length;r++){
      const prev = tournament.rounds[r-1];
      const cur = tournament.rounds[r];

      prev.matches.forEach((pm, i) => {
        const target = cur.matches[Math.floor(i/2)];
        if(i % 2 === 0) target.p1 = pm.winner || null;
        else target.p2 = pm.winner || null;
      });

      cur.matches.forEach(m => {
        // Si quedó un solo jugador, es BYE automático.
        if(m.p1 && !m.p2 && !m.manual){
          m.winner = m.p1;
          m.bye = true;
        } else if(!m.p1 && m.p2 && !m.manual){
          m.winner = m.p2;
          m.bye = true;
        } else if(!m.p1 || !m.p2){
          if(!m.manual) m.winner = null;
        }
      });
    }
  }

  function setWinner(roundIndex, matchIndex, winnerSlot){
    const round = tournament.rounds[roundIndex];
    const m = round.matches[matchIndex];
    if(!m.p1 || !m.p2) return;

    m.winner = winnerSlot === 1 ? m.p1 : m.p2;
    m.s1 = winnerSlot === 1 ? 1 : 0;
    m.s2 = winnerSlot === 2 ? 1 : 0;
    m.manual = true;
    m.bye = false;

    // Resetear todo lo que venía después porque un resultado cambió.
    for(let r=roundIndex+1;r<tournament.rounds.length;r++){
      tournament.rounds[r].matches.forEach(next => {
        next.p1=null; next.p2=null; next.s1=null; next.s2=null;
        next.winner=null; next.manual=false; next.bye=false;
      });
    }

    propagateAll();
    render();
  }

  window.chooseWinner = setWinner;

  window.resetMatch = (roundIndex, matchIndex) => {
    const m = tournament.rounds[roundIndex].matches[matchIndex];
    m.winner=null; m.s1=null; m.s2=null; m.manual=false; m.bye=false;

    for(let r=roundIndex+1;r<tournament.rounds.length;r++){
      tournament.rounds[r].matches.forEach(next => {
        next.p1=null; next.p2=null; next.s1=null; next.s2=null;
        next.winner=null; next.manual=false; next.bye=false;
      });
    }

    propagateAll();
    render();
  };

  function slotHTML(name, score, winner, unknownText="Pendiente"){
    if(!name){
      return `<div class="slot"><span class="name unknown">${unknownText}</span><span class="score">—</span></div>`;
    }
    return `<div class="slot ${winner ? "winner" : ""}">
      <span class="name">${escapeHTML(name)}</span>
      <span class="score">${score ?? ""}</span>
    </div>`;
  }

  function render(){
    if(!tournament) return;

    const bracket = $("bracket");
    bracket.innerHTML = tournament.rounds.map((round, rIndex) => {
      return `
        <div class="round">
          <div class="round-title">${round.name}</div>
          <div class="round-matches">
            ${round.matches.map((m,mIndex) => {
              const isBye = m.bye;
              const p1Unknown = !m.p1 && !m.p2 ? "Por definir" : "BYE";
              const p2Unknown = !m.p1 && !m.p2 ? "Por definir" : "BYE";

              let controls = "";
              if(m.p1 && m.p2){
                controls = `
                  <div class="match-controls">
                    <button class="score-btn p1" onclick="chooseWinner(${rIndex},${mIndex},1)">🏓 ${escapeHTML(m.p1)}</button>
                    <button class="score-btn p2" onclick="chooseWinner(${rIndex},${mIndex},2)">🏓 ${escapeHTML(m.p2)}</button>
                    ${m.manual ? `<button class="reset-match danger" title="Borrar resultado" onclick="resetMatch(${rIndex},${mIndex})">↺</button>` : ""}
                  </div>
                `;
              } else if(m.winner){
                controls = `<div style="margin-top:8px;color:var(--muted);font-size:12px">✅ Avanza automáticamente</div>`;
              }

              return `
                <div class="match ${m.manual ? "completed" : ""} ${isBye ? "bye" : ""}">
                  <div class="match-label">Partido ${mIndex+1}${isBye ? " · BYE" : ""}</div>
                  ${m.p1
                    ? slotHTML(m.p1, m.s1, m.winner===m.p1)
                    : slotHTML(null, null, false, p1Unknown)}
                  ${m.p2
                    ? slotHTML(m.p2, m.s2, m.winner===m.p2)
                    : slotHTML(null, null, false, p2Unknown)}
                  ${controls}
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }).join("");

    const finalRound = tournament.rounds[tournament.rounds.length-1];
    const finalMatch = finalRound.matches[0];
    const champion = finalMatch && finalMatch.winner && finalMatch.manual;
    $("champion").style.display = champion ? "block" : "none";
    if(champion) $("championName").textContent = finalMatch.winner;
  }

  $("generateBtn").addEventListener("click", createTournament);

  updatePlayersUI();
})();
