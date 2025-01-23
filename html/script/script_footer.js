const footerLinks = document.querySelectorAll(".footer-link");

const currentLocation = window.location.href;

footerLinks.forEach((link) => {
  if (link.href === currentLocation) {
    link.classList.add("active");
  }
});
