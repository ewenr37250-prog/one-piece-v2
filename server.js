const forbiddenNames = ["Luffy", "Zoro", "Nami", "Sanji", "Ace", "Kaido", "Shanks"];

// Fonction de vérification lors de la création de compte
function validateIdentity(name, secretCode) {
    const isLegendaryName = forbiddenNames.some(n => n.toLowerCase() === name.toLowerCase());
    
    // Logique Modo Principal
    if (secretCode === "VOID-CENTURY-000") {
        return { valid: true, role: "Modo Principal", level: 2 };
    }
    
    // Logique Grand Corsaire
    if (secretCode === "SMILE-777") {
        return { valid: true, role: "Grand Corsaire", level: 1 };
    }
    
    // Logique Joueur Lambda
    if (isLegendaryName) {
        return { valid: false, error: "Ce nom est réservé aux légendes ou au staff." };
    }
    
    return { valid: true, role: "Joueur", level: 0 };
}
