document.addEventListener('DOMContentLoaded', function () {
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const faqToggle = item.querySelector('.faq-toggle');
        const faqQuestion = item.querySelector('.faq-question');

        faqQuestion.addEventListener('click', () => {
            item.classList.toggle('active');

            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
        });
    });

    document.getElementById('playButton').addEventListener('click', function() {
        const userFirstName = localStorage.getItem('userFirstName');
        
        if (userFirstName) {
            window.location.href = 'play.html';
        } else {
            document.getElementById('popup').style.display = 'flex';
        }
    });

    document.getElementById('closePopup').addEventListener('click', function() {
        document.getElementById('popup').style.display = 'none';
    });

    document.getElementById('loginBtn').addEventListener('click', function() {
        window.location.href = 'login.html';
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('show');
            }
        });
    });

    const hiddenElements = document.querySelectorAll('.hidden');
    hiddenElements.forEach((el) => observer.observe(el));
});