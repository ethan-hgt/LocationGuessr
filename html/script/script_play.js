const gameSelection = document.getElementById('gameSelection');
const gameSection = document.getElementById('gameSection');
const gameTitle = document.getElementById('gameTitle');
const gameContent = document.getElementById('gameContent');
        
window.onload = function() {
    const gameButtons = document.querySelectorAll('.game-button');
    gameButtons.forEach(button => {
        button.classList.add('show');
    });
};
        
document.getElementById('franceBtn').addEventListener('click', function() {
    localStorage.setItem('gameMode', 'france');
    window.location.href = "/html/jeu.html";
});

document.getElementById("mondialBtn").onclick = function() {
    localStorage.setItem('gameMode', 'mondial');
    window.location.href = "/html/jeu.html";
};

        
function loadGameContent(game) {
    gameSelection.classList.add('hidden');
    gameSection.classList.remove('hidden');
    gameContent.innerHTML = `<p>Vous avez choisis: ${game}</p>`;
}