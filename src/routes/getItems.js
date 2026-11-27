// Renvoie toutes les tâches, triées par nom
const db = require('../persistence');
const _ = require('lodash');

module.exports = async (req, res) => {
    const items = await db.getItems();
    res.send(_.sortBy(items, 'name'));
};
