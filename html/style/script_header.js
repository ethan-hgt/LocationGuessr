const headerLinks = document.querySelectorAll('.header-link');

headerLinks.forEach(link => {
    link.addEventListener('mouseenter', () => {
        link.style.transition = 'transform 1s ease-out';
        link.style.transform = 'scale(1.2)';
    });

    link.addEventListener('mouseleave', () => {
        if (!link.classList.contains('active')) {
            link.style.transition = 'transform 0.6s ease-in';
            link.style.transform = 'scale(1)';
        }
    });
});

const currentLocation = window.location.href;

headerLinks.forEach(link => {
    if (link.href === currentLocation) {
        link.classList.add('active');
    }
});


