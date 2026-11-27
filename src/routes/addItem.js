// Ajoute une tâche
const db = require('../persistence');
const { v4: uuid } = require('uuid');
const defaults = require('../defaults');
const { nomValide } = require('../validation');

module.exports = async (req, res) => {
    if (!nomValide(req.body.name)) {
        res.status(400).send({ erreur: 'Le nom de la tâche est vide ou trop long.' });
        return;
    }

    const nouvelleTache = {
        id: uuid(),
        name: req.body.name.trim(),
        completed: defaults.completed,
    };

    await db.storeItem(nouvelleTache);
    res.send(nouvelleTache);
};
