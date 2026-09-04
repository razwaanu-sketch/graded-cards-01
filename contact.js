// Builds a mailto: link from the contact form so it works with zero backend.
// To upgrade to a real inbox-free submission (no email client popup), point
// the form at a service like Formspree — see SETUP.md.
(function () {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const CONTACT_EMAIL = "your-email@example.com"; // TODO: replace with your real contact email

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.elements["name"].value.trim();
    const email = form.elements["email"].value.trim();
    const message = form.elements["message"].value.trim();

    const subject = encodeURIComponent(`Website enquiry from ${name}`);
    const body = encodeURIComponent(`${message}\n\n— ${name} (${email})`);
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  });
})();
