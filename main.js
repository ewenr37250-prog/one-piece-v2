function applyFactionTheme(faction) {
    document.body.classList.remove("theme-marine", "theme-pirate", "theme-revo");

    if (faction === "marine") document.body.classList.add("theme-marine");
    if (faction === "pirate") document.body.classList.add("theme-pirate");
    if (faction === "revolutionnaire") document.body.classList.add("theme-revo");

    // Reset animation
    const emblem = document.getElementById("faction-emblem");
    emblem.style.animation = "none";
    void emblem.offsetWidth;
    emblem.style.animation = "emblemFadeIn 1.8s ease-out forwards";
}
