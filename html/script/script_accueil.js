// Attends que le contenu de la page soit chargé
document.addEventListener("DOMContentLoaded", function () {
    const faqItems = document.querySelectorAll(".faq-item");
    const popup = document.getElementById("popup");
    const closePopup = document.getElementById("closePopup");
    const loginBtn = document.getElementById("loginBtn");

    // Parcourt tous les éléments de la FAQ
    faqItems.forEach((item) => {
        const faqQuestion = item.querySelector(".faq-question");

        // Ajoute un écouteur d'événement au clic sur la question de la FAQ
        faqQuestion.addEventListener("click", () => {
            item.classList.toggle("active");

            // Parcourt tous les autres éléments de la FAQ
            faqItems.forEach((otherItem) => {
                if (otherItem !== item && otherItem.classList.contains("active")) {
                    otherItem.classList.remove("active");
                }
            });
        });
    });

    // Ajoute un écouteur d'événement au clic sur le bouton "Jouer"
    document.getElementById("playButton").addEventListener("click", function () {
        // Utilise AuthUtils pour vérifier l'authentification
        if (AuthUtils.isLoggedIn()) {
            window.location.href = "play.html";
        } else {
            popup.classList.add("show");
        }
    });

    // Ajoute un écouteur d'événement au clic sur le bouton de fermeture de la fenêtre contextuelle
    closePopup.addEventListener("click", function () {
        popup.classList.remove("show");
    });

    // Ajoute un écouteur d'événement au clic sur le bouton de connexion
    loginBtn.addEventListener("click", function () {
        window.location.href = "/login";
    });

    // Crée un observateur d'intersection
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("show");
            }
        });
    });

    // Sélectionne tous les éléments cachés
    const hiddenElements = document.querySelectorAll(".hidden");
    hiddenElements.forEach((el) => observer.observe(el));
});