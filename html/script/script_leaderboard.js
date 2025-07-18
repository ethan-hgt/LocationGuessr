// Mode de jeu actuel pour le classement
let currentMode = "france";

// Initialisation de la page
document.addEventListener("DOMContentLoaded", function () {
  updateHeaderDisplay();
  initModeSelector();
  loadLeaderboard();
  if (AuthUtils.getAuthToken()) {
    loadUserPosition();
  }
});

async function loadUserPosition() {
  try {
    const token = AuthUtils.getAuthToken();
    if (!token) return;

    const userId = AuthUtils.getUserId();
    const [rankResponse, statsResponse] = await Promise.all([
      fetch(
        `${CONFIG.API_BASE_URL}/user/rank/${userId}?mode=${currentMode}`
      ),
      fetch(
        `${CONFIG.API_BASE_URL}/user/stats/details?mode=${currentMode}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      ),
    ]);

    const [rankData, statsData] = await Promise.all([
      rankResponse.json(),
      statsResponse.json(),
    ]);

    let userPositionElement = document.getElementById("userPosition");
    if (!userPositionElement) {
      userPositionElement = document.createElement("div");
      userPositionElement.id = "userPosition";
      userPositionElement.className = "user-position";
      document
        .querySelector(".leaderboard-container")
        .insertBefore(
          userPositionElement,
          document.querySelector(".mode-selector")
        );
    }

    userPositionElement.innerHTML = `
            Classement #${rankData.rank}/${rankData.totalPlayers}
            <br>
            Meilleur score ${statsData.currentStats.bestScore} | 
            Moyenne ${Math.round(statsData.currentStats.averageScore)} |
            Parties jouées ${statsData.currentStats.gamesPlayed}
        `;
  } catch (err) {
    console.error("Erreur:", err);
  }
}

// Initialise les boutons de sélection de mode
function initModeSelector() {
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", function () {
      if (this.classList.contains("active")) return;
      currentMode = this.dataset.mode;
      document
        .querySelectorAll(".mode-btn")
        .forEach((b) => b.classList.remove("active"));
      this.classList.add("active");
      loadLeaderboard();
      if (AuthUtils.getAuthToken()) {
        loadUserPosition();
      }
    });
  });
}

// Charge et affiche le classement pour le mode sélectionné
async function loadLeaderboard() {
  try {
    const response = await fetch(
      `${CONFIG.API_BASE_URL}/user/leaderboard?mode=${currentMode}`
    );
    if (!response.ok) throw new Error("Erreur de chargement du leaderboard");

    const data = await response.json();
    const scrollableRows = document.querySelector(".scrollable-rows");
    scrollableRows.innerHTML = "";

    const currentUserId = AuthUtils.getUserId();

    data.leaderboard.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = `player-row ${getRankClass(index)}`;
      row.style.animation = `slideIn 0.5s forwards ${index * 0.1}s`;

      if (player._id === currentUserId) {
        row.classList.add("current-user");
      }

      const tooltip = document.createElement("div");
      tooltip.className = "tooltip";
      tooltip.innerHTML = `
                Moyenne: ${Math.round(player.stats.averageScore)}
                <br>
                Total des parties: ${player.stats.gamesPlayed}
                <br>
                ${
                  player.stats.lastPlayed
                    ? `Dernière partie: ${formatDate(player.stats.lastPlayed)}`
                    : ""
                }
            `;

      let rankDisplay;
      if (index < 3) {
        rankDisplay = `<img src="/img/Medail${
          getRankClass(index).charAt(0).toUpperCase() +
          getRankClass(index).slice(1)
        }.png" alt="${getRankClass(index)}" class="medal ${getRankClass(
          index
        )}">`;
      } else {
        rankDisplay = `#${index + 1}`;
      }

      // Utilisation de avatarData avec fallback sur l'image par défaut
      const avatarSrc = player.avatarData || "/img/default-avatar.webp";

      row.innerHTML = `
                <div class="rank">${rankDisplay}</div>
                <div class="player-info">
                    <img src="${avatarSrc}" alt="Avatar de ${
        player.username
      }" class="player-avatar" onerror="this.src='/img/default-avatar.webp'">
                    <div class="player-details">
                        <img src="${getModeIcon(
                          currentMode
                        )}" alt="${currentMode}" class="mode-icon">
                        <span class="player-name">${player.username}</span>
                    </div>
                </div>
                <div class="matches">${player.stats.gamesPlayed}</div>
                <div class="xp">${player.stats.bestScore}</div>
            `;

      row.appendChild(tooltip);
      scrollableRows.appendChild(row);
    });

    updateTotalPlayers(data.totalPlayers);
  } catch (err) {
    console.error("Erreur:", err);
    const scrollableRows = document.querySelector(".scrollable-rows");
    scrollableRows.innerHTML =
      '<div class="error-message">Erreur lors du chargement du classement</div>';
  }
}

// Récupère l'icône correspondant à chaque mode de jeu 
function getModeIcon(mode) {
  const icons = {
    france: "/img/francec.png",
    mondial: "/img/mondialc.png",
    disneyland: "/img/disneyc.png",
    nevers: "/img/neversc.png",
    versaille: "/img/versaillesc.png",
    dark: "/img/darkc.png",
  };
  return icons[mode] || icons["france"];
}

// Formate les dates pour l'affichage
function formatDate(dateString) {
  if (!dateString) return "Jamais";
  return new Date(dateString).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Style spécial pour les 3 premiers du classement
function getRankClass(index) {
  switch (index) {
    case 0:
      return "gold";
    case 1:
      return "silver";
    case 2:
      return "bronze";
    default:
      return "";
  }
}

function updateTotalPlayers(total) {
  let totalElement = document.querySelector(".total-players");
  if (!totalElement) {
    totalElement = document.createElement("div");
    totalElement.className = "total-players";
    document.querySelector(".leaderboard-content").appendChild(totalElement);
  }
  totalElement.textContent = `${total} ${total > 1 ? "joueurs" : "joueur"}`;
}