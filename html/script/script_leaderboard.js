let currentMode = 'france';

document.addEventListener('DOMContentLoaded', function() {
    updateHeader();
    initModeSelector();
    loadLeaderboard();
    if (localStorage.getItem('userToken')) {
        loadUserPosition();
    }
});

async function loadUserPosition() {
    try {
        const token = localStorage.getItem('userToken');
        if (!token) return;

        const userId = localStorage.getItem('userId');
        const [rankResponse, statsResponse] = await Promise.all([
            fetch(`http://localhost:3000/api/user/rank/${userId}?mode=${currentMode}`),
            fetch(`http://localhost:3000/api/user/stats/details?mode=${currentMode}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        const [rankData, statsData] = await Promise.all([
            rankResponse.json(),
            statsResponse.json()
        ]);

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

        userPositionElement.innerHTML = `
            Classement #${rankData.rank}/${rankData.totalPlayers}
            <br>
            Meilleur score ${statsData.currentStats.bestScore} | 
            Moyenne ${Math.round(statsData.currentStats.averageScore)} |
            Parties jouées ${statsData.currentStats.gamesPlayed}
        `;
    } catch (err) {
        console.error('Erreur:', err);
    }
}

function initModeSelector() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            if (this.classList.contains('active')) return;
            currentMode = this.dataset.mode;
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            loadLeaderboard();
            if (localStorage.getItem('userToken')) {
                loadUserPosition();
            }
        });
    });
}

async function loadLeaderboard() {
    try {
        const response = await fetch(`http://localhost:3000/api/user/leaderboard?mode=${currentMode}`);
        if (!response.ok) throw new Error('Erreur de chargement du leaderboard');
        
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
                Moyenne: ${Math.round(player.stats.averageScore)}
                <br>
                Total des parties: ${player.stats.gamesPlayed}
                <br>
                ${player.stats.lastPlayed ? `Dernière partie: ${formatDate(player.stats.lastPlayed)}` : ''}
            `;

            let rankDisplay;
            if (index < 3) {
                rankDisplay = `<img src="/img/Medail${getRankClass(index).charAt(0).toUpperCase() + getRankClass(index).slice(1)}.png" alt="${getRankClass(index)}" class="medal ${getRankClass(index)}">`;
            } else {
                rankDisplay = `#${index + 1}`;
            }

            // Utilisation de avatarData avec fallback sur l'image par défaut
            const avatarSrc = player.avatarData || '/img/default-avatar.webp';

            row.innerHTML = `
                <div class="rank">${rankDisplay}</div>
                <div class="player-info">
                    <img src="${avatarSrc}" alt="Avatar de ${player.username}" class="player-avatar" onerror="this.src='/img/default-avatar.webp'">
                    <div class="player-details">
                        <img src="${getModeIcon(currentMode)}" alt="${currentMode}" class="mode-icon">
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
        console.error('Erreur:', err);
        const scrollableRows = document.querySelector('.scrollable-rows');
        scrollableRows.innerHTML = '<div class="error-message">Erreur lors du chargement du classement</div>';
    }
}

function getModeIcon(mode) {
    const icons = {
        'france': '/img/francec.png',
        'mondial': '/img/mondialc.png',
        'disneyland': '/img/disneyc.png',
        'nevers': '/img/neversc.png',
        'versaille': '/img/versaillesc.png',
        'dark': '/img/darkc.png'
    };
    return icons[mode] || icons['france'];
}

function updateTotalPlayers(total) {
    let totalElement = document.querySelector('.total-players');
    if (!totalElement) {
        totalElement = document.createElement('div');
        totalElement.className = 'total-players';
        document.querySelector('.leaderboard-content').appendChild(totalElement);
    }
    totalElement.textContent = `${total} ${total > 1 ? 'joueurs' : 'joueur'}`;
}

function getRankClass(index) {
    switch(index) {
        case 0: return 'gold';
        case 1: return 'silver';
        case 2: return 'bronze';
        default: return '';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'Jamais';
    return new Date(dateString).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}