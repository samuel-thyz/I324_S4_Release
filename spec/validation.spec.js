const { nomValide } = require('../src/validation');

test('refuse un nom vide', () => {
    expect(nomValide('   ')).toBe(false);
});

test('accepte un nom de 50 caractères', () => {
    expect(nomValide('a'.repeat(50))).toBe(true);
});

test('refuse un nom de 101 caractères', () => {
    expect(nomValide('a'.repeat(101))).toBe(false);
});
