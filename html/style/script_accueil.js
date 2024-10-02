// Sélectionner tous les éléments de questions
const faqItems = document.querySelectorAll('.faq-item');

// Ajouter un écouteur d'événement à chaque question
faqItems.forEach(item => {
    const faqToggle = item.querySelector('.faq-toggle');
    const faqQuestion = item.querySelector('.faq-question');

    faqQuestion.addEventListener('click', () => {
        // Basculer la classe active sur l'élément cliqué
        item.classList.toggle('active');

        // Fermer les autres éléments ouverts
        faqItems.forEach(otherItem => {
            if (otherItem !== item && otherItem.classList.contains('active')) {
                otherItem.classList.remove('active');
            }
        });
    });
});
