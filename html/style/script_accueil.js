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
