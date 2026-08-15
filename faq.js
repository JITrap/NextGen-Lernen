// FAQ-Bereich für alle Seiten des Shops.
// Einbinden mit <script src="faq.js"></script> – der Bereich erscheint dann
// automatisch ganz unten, direkt über dem Footer. Fragen und Antworten nur
// hier in FAQ_ITEMS anpassen, das gilt sofort für alle Seiten.

const FAQ_ITEMS = [
    {
        frage: "Was ist NextGen Lernen?",
        antwort: "NextGen Lernen ist eine Plattform für modernes Lernen mit KI-Unterstützung. Du findest hier digitale Lernhilfen wie die AI Learning Assistance, einen persönlichen Lernplaner und praktische Werkzeuge für Lehrkräfte."
    },
    {
        frage: "Wie funktioniert die AI Learning Assistance?",
        antwort: "Du tippst deine Frage einfach in das Textfeld ein und schickst sie ab. Die KI analysiert deine Frage und liefert dir in wenigen Sekunden eine verständliche Antwort – rund um die Uhr."
    },
    {
        frage: "Was kostet die Nutzung?",
        antwort: "Die aktuellen Preise findest du direkt beim jeweiligen Produkt. So siehst du immer vor dem Kauf, was ein Angebot kostet – ohne versteckte Kosten."
    },
    {
        frage: "Welche Zahlungsmöglichkeiten gibt es?",
        antwort: "Wir unterstützen gängige Zahlungsarten wie Kreditkarte, PayPal und Überweisung. Beim Bezahlvorgang siehst du alle verfügbaren Optionen im Überblick."
    },
    {
        frage: "Kann ich jederzeit kündigen?",
        antwort: "Ja. Abos kannst du jederzeit zum Ende des laufenden Abrechnungszeitraums kündigen – ohne lange Vertragsbindung."
    },
    {
        frage: "Sind meine Daten sicher?",
        antwort: "Deine Daten werden vertraulich behandelt und nicht an Dritte verkauft. Deine Fragen an die KI verwenden wir ausschließlich, um dir eine Antwort zu geben."
    },
    {
        frage: "Wie erreiche ich den Support?",
        antwort: "Schreib uns einfach eine E-Mail an support@nextgen-lernen.de. Wir melden uns in der Regel innerhalb von 24 Stunden bei dir."
    }
];

document.addEventListener("DOMContentLoaded", () => {
    const section = document.createElement("section");
    section.className = "faq";
    section.id = "faq";

    const heading = document.createElement("h2");
    heading.textContent = "Häufig gestellte Fragen";
    section.appendChild(heading);

    FAQ_ITEMS.forEach((item) => {
        const details = document.createElement("details");
        details.className = "faq-item";

        const summary = document.createElement("summary");
        summary.textContent = item.frage;

        const antwort = document.createElement("p");
        antwort.textContent = item.antwort;

        details.appendChild(summary);
        details.appendChild(antwort);
        section.appendChild(details);
    });

    const footer = document.querySelector("footer");
    if (footer) {
        footer.before(section);
    } else {
        document.body.appendChild(section);
    }
});
