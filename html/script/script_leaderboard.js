document.addEventListener('DOMContentLoaded', function() {
    updateHeader();
    loadLeaderboard();
    if (localStorage.getItem('userToken')) {
        loadUserPosition();
    }
});

async function loadUserPosition() {
    try {
        const userId = localStorage.getItem('userId');
        const response = await fetch(`http://localhost:3000/api/user/rank/${userId}`);
        const data = await response.json();

        // Créer ou mettre à jour l'élément de position de l'utilisateur
        let userPositionElement = document.getElementById('userPosition');
        if (!userPositionElement) {
            userPositionElement = document.createElement('div');
            userPositionElement.id = 'userPosition';
            userPositionElement.className = 'user-position';
            document.querySelector('.leaderboard-container').insertBefore(
                userPositionElement,
                document.querySelector('.leaderboard-content')
            );
        }

        // Récupérer les stats détaillées de l'utilisateur
        const statsResponse = await fetch('http://localhost:3000/api/user/stats/details', {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('userToken')}`
            }
        });
        const statsData = await statsResponse.json();

        userPositionElement.innerHTML = `
            Votre position : ${data.rank}/${data.totalPlayers}
            <br>
            Meilleur score : ${statsData.currentStats.bestScore} | 
            Moyenne : ${statsData.currentStats.averageScore} | 
            Parties jouées : ${statsData.currentStats.gamesPlayed}
        `;
    } catch (err) {
        console.error('Erreur lors du chargement de la position:', err);
    }
}

async function loadLeaderboard() {
    try {
        const response = await fetch('http://localhost:3000/api/user/leaderboard');
        const data = await response.json();
        
        const scrollableRows = document.querySelector('.scrollable-rows');
        scrollableRows.innerHTML = '';
        
        const currentUserId = localStorage.getItem('userId');
        
        data.leaderboard.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = `player-row ${getRankClass(index)}`;
            
            if (player._id === currentUserId) {
                row.classList.add('current-user');
            }
            
            row.innerHTML = `
                <div class="rank">
                    ${index < 3 ? getMedalImage(index) : `#${index + 1}`}
                </div>
                <div class="name">${player.username}</div>
                <div class="matches">${player.stats.gamesPlayed}</div>
                <div class="xp">${player.stats.bestScore}</div>
            `;
            
            row.setAttribute('data-tooltip', `
                Moyenne: ${player.stats.averageScore}
                Total des parties: ${player.stats.gamesPlayed}
                Dernière partie: ${player.stats.lastPlayed}
            `);
            
            scrollableRows.appendChild(row);
        });
        
        updateTotalPlayers(data.totalPlayers);
        
    } catch (err) {
        console.error('Erreur lors du chargement du classement:', err);
    }
}

function updateTotalPlayers(total) {
    let totalElement = document.querySelector('.total-players');
    if (!totalElement) {
        totalElement = document.createElement('div');
        totalElement.className = 'total-players';
        document.querySelector('.leaderboard-container').appendChild(totalElement);
    }
    totalElement.textContent = `Total des joueurs: ${total}`;
}

function getRankClass(index) {
    switch(index) {
        case 0: return 'gold';
        case 1: return 'silver';
        case 2: return 'bronze';
        default: return '';
    }
}

function getMedalImage(index) {
    const medals = {
        0: '/img/MedailGold.png',
        1: '/img/MedailSilver.png',
        2: '/img/MedailBronze.png'
    };
    return `<img src="${medals[index]}" alt="${getRankClass(index)}" class="medal">`;
}