// Règles sur le nom d'une tâche
const LONGUEUR_MAX = 100;

function nomValide(nom) {
    if (typeof nom !== 'string') return false;
    const propre = nom.trim();
    return propre.length > 0 && propre.length <= LONGUEUR_MAX;
}

module.exports = { nomValide, LONGUEUR_MAX };
