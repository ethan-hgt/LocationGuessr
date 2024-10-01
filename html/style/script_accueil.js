const headerLinks = document.querySelectorAll('.header-link');

headerLinks.forEach(link => {
    link.addEventListener('mouseenter', () => {
        link.style.transition = 'transform 0.5s ease-out';
        link.style.transform = 'scale(1.2)';
    });

    link.addEventListener('mouseleave', () => {
        link.style.transition = 'transform 0.8s ease-in';
        link.style.transform = 'scale(1)';
    });
});


