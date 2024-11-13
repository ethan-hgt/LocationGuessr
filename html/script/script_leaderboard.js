let currentMode = 'france';

document.addEventListener('DOMContentLoaded', function() {
    updateHeader();
    initModeSelector();
    loadLeaderboard();
    if (localStorage.getItem('userToken')) {
        loadUserPosition();
    }
});

function initModeSelector() {
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (this.classList.contains('active')) return;
            
            currentMode = this.dataset.mode;
            
            // Met à jour l'apparence des boutons
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // Animation de sortie
            const rows = document.querySelectorAll('.player-row');
            rows.forEach((row, index) => {
                row.style.animation = `slideOut 0.3s forwards ${index * 0.05}s`;
            });
            
            // Attend que l'animation de sortie soit terminée
            await new Promise(resolve => setTimeout(resolve, (rows.length * 0.05 + 0.3) * 1000));
            
            // Recharge le leaderboard
            loadLeaderboard();
            if (localStorage.getItem('userToken')) {
                loadUserPosition();
            }
        });
    });
}

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

        userPositionElement.style.opacity = '0';
        userPositionElement.innerHTML = `
            Votre position : #${data.rank}/${data.totalPlayers}
            <br>
            Meilleur score : ${statsData.currentStats.bestScore} | 
            Moyenne : ${statsData.currentStats.averageScore} | 
            Parties jouées : ${statsData.currentStats.gamesPlayed}
        `;
        
        // Animation d'apparition des stats
        requestAnimationFrame(() => {
            userPositionElement.style.opacity = '1';
            userPositionElement.style.transform = 'translateY(0)';
        });

    } catch (err) {
        console.error('Erreur lors du chargement de la position:', err);
    }
}

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

            const medalClass = index < 3 ? getRankClass(index) : '';
            row.innerHTML = `
                <div class="rank">
                    ${index < 3 ? getMedalImage(index, medalClass) : `#${index + 1}`}
                </div>
                <div class="player-info mode-transition">
                    <img src="${getModeIcon(currentMode)}" alt="${currentMode}" class="mode-icon">
                    <span>${player.username}</span>
                </div>
                <div class="matches">${player.stats.gamesPlayed}</div>
                <div class="xp">${player.stats.bestScore}</div>
            `;
            
            row.appendChild(tooltip);
            scrollableRows.appendChild(row);
            
            // Animation de l'icône du mode
            requestAnimationFrame(() => {
                const modeTransition = row.querySelector('.mode-transition');
                modeTransition.classList.add('active');
            });
        });
        
        updateTotalPlayers(data.totalPlayers);
        
    } catch (err) {
        console.error('Erreur lors du chargement du classement:', err);
    }
}

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