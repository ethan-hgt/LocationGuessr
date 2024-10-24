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
    gameTitle.textContent = "France";
    loadGameContent('France');
});
        
document.getElementById('mondialBtn').addEventListener('click', function() {
   gameTitle.textContent = "Mondial";
   loadGameContent('Mondial');
});
        
function loadGameContent(game) {
    gameSelection.classList.add('hidden');
    gameSection.classList.remove('hidden');
    gameContent.innerHTML = `<p>Vous avez choisis: ${game}</p>`;
}