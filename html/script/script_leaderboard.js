let currentMode = 'france';

document.addEventListener('DOMContentLoaded', function() {
    updateHeader();
    initModeSelector();
    loadLeaderboard();
    if (localStorage.getItem('userToken')) {
        loadUserPosition();
    }
});

// Initialise les boutons de mode de jeu
function initModeSelector() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.classList.contains('active')) return;
            
            currentMode = this.dataset.mode;
            // Met à jour l'apparence des boutons
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Recharge le leaderboard avec le nouveau mode
            loadLeaderboard();
            if (localStorage.getItem('userToken')) {
                loadUserPosition();
            }
        });
    });
}

// Charge la position de l'utilisateur connecté
async function loadUserPosition() {
    try {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`http://localhost:3000/api/user/rank/${userId}?mode=${currentMode}`);
        const data = await response.json();

        let userPositionElement = document.getElementById('userPosition');
        if (!userPositionElement) {
            userPositionElement = document.createElement('div');
            userPositionElement.id = 'userPosition';
            userPositionElement.className = 'user-position';
            document.querySelector('.leaderboard-container').insertBefore(
                userPositionElement,
                document.querySelector('.mode-selector')
            );
        }

        const statsResponse = await fetch('http://localhost:3000/api/user/stats/details', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('userToken')}`
            }
        });
        const statsData = await statsResponse.json();

        userPositionElement.innerHTML = `
            Votre position : #${data.rank}/${data.totalPlayers}
            <br>
            Meilleur score : ${statsData.currentStats.bestScore} | 
            Moyenne : ${statsData.currentStats.averageScore} | 
            Parties jouées : ${statsData.currentStats.gamesPlayed}
        `;
    } catch (err) {
        console.error('Erreur lors du chargement de la position:', err);
    }
}

// Charge le leaderboard
async function loadLeaderboard() {
    try {
        const response = await fetch(`http://localhost:3000/api/user/leaderboard?mode=${currentMode}`);
        const data = await response.json();
        
        const scrollableRows = document.querySelector('.scrollable-rows');
        scrollableRows.innerHTML = '';
        
        const currentUserId = localStorage.getItem('userId');
        
        data.leaderboard.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = `player-row ${getRankClass(index)}`;
            row.style.animation = `slideIn 0.5s forwards ${index * 0.1}s`;
            
            if (player._id === currentUserId) {
                row.classList.add('current-user');
            }

            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.innerHTML = `
                Moyenne: ${player.stats.averageScore}
                <br>
                Total des parties: ${player.stats.gamesPlayed}
                <br>
                ${player.stats.lastPlayed ? `Dernière partie: ${formatDate(player.stats.lastPlayed)}` : ''}
            `;

            const rankDisplay = index < 3 
                ? getMedalImage(index, getRankClass(index)) 
                : `#${index + 1}`;

            row.innerHTML = `
                <div class="rank">
                    ${rankDisplay}
                </div>
                <div class="player-info">
                    <img src="${getModeIcon(currentMode)}" alt="${currentMode}" class="mode-icon">
                    <span>${player.username}</span>
                </div>
                <div class="matches">${player.stats.gamesPlayed}</div>
                <div class="xp">${player.stats.bestScore}</div>
            `;
            
            row.appendChild(tooltip);
            scrollableRows.appendChild(row);
        });
        
        updateTotalPlayers(data.totalPlayers);
        
    } catch (err) {
        console.error('Erreur lors du chargement du classement:', err);
    }
}

// Met à jour le nombre total de joueurs
function updateTotalPlayers(total) {
    let totalElement = document.querySelector('.total-players');
    if (!totalElement) {
        totalElement = document.createElement('div');
        totalElement.className = 'total-players';
        document.querySelector('.leaderboard-container').appendChild(totalElement);
    }
    totalElement.textContent = `${total} ${total > 1 ? 'joueurs' : 'joueur'}`;
}

// Retourne la classe CSS selon le rang
function getRankClass(index) {
    switch(index) {
        case 0: return 'gold';
        case 1: return 'silver';
        case 2: return 'bronze';
        default: return '';
    }
}

// Retourne l'image de médaille selon le rang
function getMedalImage(index, medalClass = '') {
    const medals = {
        0: '/img/MedailGold.png',
        1: '/img/MedailSilver.png',
        2: '/img/MedailBronze.png'
    };
    return `<img src="${medals[index]}" alt="${getRankClass(index)}" class="medal ${medalClass}">`;
}

// Retourne l'icône du mode de jeu
function getModeIcon(mode) {
    const icons = {
        'france': '/img/France.png',
        'mondial': '/img/Mondial.png',
        'disneyland': '/img/disney.png',
        'nevers': '/img/nevers.png',
        'versaille': '/img/versaille.png',
        'dark': '/img/lampe.png'
    };
    return icons[mode] || icons['france'];
}

// Formate la date pour l'affichage
function formatDate(dateString) {
    if (!dateString) return 'Jamais';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}