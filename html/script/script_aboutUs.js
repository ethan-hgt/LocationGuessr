// Animation de la première section et de la section du globe lors du chargement
document.addEventListener('DOMContentLoaded', () => {
    const sectionAccueil = document.querySelector('.section-accueil');
    const sectionGlobe = document.querySelector('.section-globe-interactif');

    if (sectionAccueil) {
        sectionAccueil.style.opacity = '0';
        setTimeout(() => {
            sectionAccueil.style.transition = 'opacity 1s ease';
            sectionAccueil.style.opacity = '1';
        }, 500);
    }

    if (sectionGlobe) {
        sectionGlobe.style.opacity = '0';
        setTimeout(() => {
            sectionGlobe.style.transition = 'opacity 1s ease';
            sectionGlobe.style.opacity = '1';
        }, 700);
    }

    const autresSections = document.querySelectorAll('.conteneur-principal section:not(.section-accueil):not(.section-globe-interactif)');
    autresSections.forEach((section) => {
        section.style.opacity = '0';
    });
});

// Effet d'apparition des autres sections au défilement
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('.conteneur-principal section:not(.section-accueil):not(.section-globe-interactif)');
    sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        if (rect.top < window.innerHeight - 100) {
            section.style.transition = 'opacity 0.8s ease-out';
            section.style.opacity = '1';
        }
    });
});

// Effet au survol des éléments de la liste des fonctionnalités et des technologies
const elementsInteractifs = document.querySelectorAll('.element-fonctionnalite, .element-technologie');
elementsInteractifs.forEach(element => {
    element.addEventListener('mouseenter', () => {
        element.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
        element.style.transform = 'scale(1.05)';
        element.style.boxShadow = '0 8px 20px rgba(0, 120, 212, 0.5)'; // Couleur bleue
    });

    element.addEventListener('mouseleave', () => {
        element.style.transform = 'scale(1)';
        element.style.boxShadow = '0 4px 15px rgba(0, 0, 0, 0.3)';
    });
});


// Animation du bouton "Rejoignez l'Aventure" lors du chargement
const boutonAppelAction = document.querySelector('.bouton-cta');
if (boutonAppelAction) {
    boutonAppelAction.style.opacity = '0';
    boutonAppelAction.style.transform = 'scale(0.5)';
    window.addEventListener('load', () => {
        setTimeout(() => {
            boutonAppelAction.style.transition = 'opacity 1s ease, transform 1s ease';
            boutonAppelAction.style.opacity = '1';
            boutonAppelAction.style.transform = 'scale(1)';
        }, 1500);
    });

    boutonAppelAction.addEventListener('mouseenter', () => {
        boutonAppelAction.style.backgroundColor = '#005bb5';
        boutonAppelAction.style.transform = 'scale(1.05)';
        boutonAppelAction.style.boxShadow = '0 8px 30px rgba(0, 91, 181, 0.7)';
    });

    boutonAppelAction.addEventListener('mouseleave', () => {
        boutonAppelAction.style.backgroundColor = '#0078d4';
        boutonAppelAction.style.transform = 'scale(1)';
        boutonAppelAction.style.boxShadow = '0 4px 20px rgba(0, 120, 212, 0.5)';
    });

    boutonAppelAction.addEventListener('mousedown', () => {
        boutonAppelAction.style.transform = 'scale(0.95)';
    });

    boutonAppelAction.addEventListener('mouseup', () => {
        boutonAppelAction.style.transform = 'scale(1.05)';
    });

    window.addEventListener('pageshow', () => {
        boutonAppelAction.style.opacity = '1';
        boutonAppelAction.style.transform = 'scale(1)';
    });
}
