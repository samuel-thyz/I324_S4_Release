// Bot « Release » (I324, S4).
// Chaque élève travaille dans sa propre copie du dépôt modèle. Le bot lit les tags, les releases
// et les images publiées de la copie (API GitHub), puis répond par un commentaire sur le dernier commit.
// Sa progression est notée dans ses commentaires (<!-- progression:N -->) : les missions déjà réussies
// ne sont pas revérifiées.
'use strict';
const fs = require('fs');
const { execFileSync } = require('child_process');
const yaml = require('js-yaml');

const env = process.env;
const REPO = env.REPO;
const [PROPRIO, NOM] = REPO.split('/');
const pseudo = PROPRIO.toLowerCase();
const IMAGE = `ghcr.io/${pseudo}/${NOM.toLowerCase()}`;

const git = (...a) => { try { return execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };
const normaliser = (t) => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[`'"]/g, '').replace(/\s+/g, ' ').trim();

let appels = 0;
async function api(methode, chemin, corps) {
    appels++;
    const r = await fetch(`https://api.github.com${chemin}`, {
        method: methode,
        headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
        body: corps ? JSON.stringify(corps) : undefined,
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${methode} ${chemin} : ${r.status}`);
    return r.status === 204 ? null : r.json();
}
const get = (c) => api('GET', c);
const memo = (f) => { let p = null; return () => (p = p || f()); };

const D = {
    releases: memo(async () => (await get(`/repos/${REPO}/releases?per_page=100`)) || []),
    tags: memo(async () => ((await get(`/repos/${REPO}/tags?per_page=100`)) || []).map((t) => t.name)),
    images: memo(async () => {
        const v = await get(`/users/${PROPRIO}/packages/container/${NOM.toLowerCase()}/versions?per_page=100`);
        return (Array.isArray(v) ? v : []).map((x) => ({ digest: x.name, tags: ((x.metadata || {}).container || {}).tags || [] }));
    }),
    runs: memo(async () => (((await get(`/repos/${REPO}/actions/runs?per_page=100`)) || {}).workflow_runs || [])),
};
const release = async (tag) => (await D.releases()).find((r) => r.tag_name === tag);
const imageDe = async (etiquette) => (await D.images()).find((i) => i.tags.includes(etiquette));
const lire = (f) => git('show', `origin/main:${f}`);
function reponses() {
    const t = lire(`reponses/${pseudo}.md`);
    if (t === null) return null;
    const r = {};
    for (const l of t.split(/\r?\n/)) { const m = /^\s*(q[0-9]+)\s*:\s*(.*)$/i.exec(l); if (m) r[m[1].toLowerCase()] = m[2].trim(); }
    return r;
}
// Les workflows de la branche main, en texte
const workflows = memo(() => (git('ls-tree', '--name-only', 'origin/main', '.github/workflows/') || '').split('\n').filter(Boolean)
    .map((f) => ({ f, t: lire(f) || '' })).filter((x) => !/\/bot\.ya?ml$/.test(x.f)));
const versionSup = (a, b) => {
    const p = (v) => v.replace(/^v/, '').split('-')[0].split('.').map(Number);
    const [x, y] = [p(a), p(b)];
    for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
    return false;
};

const OK = { ok: true };
const MISSIONS = [
    {
        titre: 'Votre propre dépôt',
        consigne: () => ['Suivez la mission 1 du README.'],
        verifier: async () => {
            const r = reponses();
            if (!r) return { ok: false, aide: `Le fichier \`reponses/${pseudo}.md\` est introuvable sur \`main\`.` };
            if (normaliser(r.q1 || '') !== normaliser(IMAGE)) return { ok: false, aide: '`q1` : le nom complet de votre image, en minuscules, comme indiqué dans le README.' };
            return OK;
        },
        bilan: () => [
            'Votre copie est prête et ses workflows tournent : c\'est moi qui vous réponds.',
            'Ici, vous êtes seul sur votre dépôt : vos tags et vos releases ne gênent personne.',
        ],
    },
    {
        titre: 'Un tag, une release',
        consigne: () => [
            '> « Quand je pose un tag de version, je veux une page de release sur GitHub, avec la liste des changements, sans l\'écrire à la main. »',
            '> — Léa, responsable technique',
            '',
            'Écrivez le workflow `.github/workflows/release.yml`, nommé `Release`, qui se déclenche quand on pousse un tag qui commence par `v`, puis :',
            '```',
            'git tag v1.0.0',
            'git push origin v1.0.0',
            '```',
            'Indice : la commande `gh release create` sait générer les notes toute seule. Le workflow a besoin du droit d\'écrire dans le dépôt.',
        ],
        verifier: async () => {
            if (!(await D.tags()).includes('v1.0.0')) return { ok: false, aide: 'Je ne vois pas le tag `v1.0.0` sur GitHub. Un tag ne part pas avec un push normal : `git push origin v1.0.0`.' };
            const r = await release('v1.0.0');
            if (!r) return { ok: false, aide: 'Le tag `v1.0.0` existe, mais pas de release. Regardez l\'onglet **Actions** : le workflow `Release` a-t-il tourné ?' };
            if (r.author.login !== 'github-actions[bot]') return { ok: false, aide: 'La release `v1.0.0` a été créée à la main. Léa veut qu\'elle soit créée par le workflow : supprimez-la (pas le tag), puis relancez le workflow.' };
            if (!r.body || !r.body.trim()) return { ok: false, aide: 'La release n\'a pas de notes. Cherchez l\'option de `gh release create` qui les génère.' };
            return OK;
        },
        bilan: () => [
            'Un **tag** marque un commit précis, une **release** le présente aux utilisateurs : notes, liste des changements, fichiers à télécharger. Les notes générées listent les commits et les pull requests depuis la version précédente.',
        ],
    },
    {
        titre: 'Une image par version',
        consigne: () => [
            '> « Le serveur de production ne doit jamais lancer une image qui bouge. Chaque release publie son image, avec le numéro de version comme étiquette. »',
            '> — Léa',
            '',
            `Complétez \`release.yml\` : construire l'image avec le \`Dockerfile\` du dépôt et la publier dans \`${IMAGE}\`, avec les étiquettes \`1.0.0\`, \`1.0\`, \`1\` et \`latest\`.`,
            'Indice : les actions officielles de Docker (`docker/metadata-action`, `docker/build-push-action`) calculent ces étiquettes à partir du tag. Puis publiez la version `v1.0.1` : un tag déjà poussé garde l\'ancien workflow, il faut un nouveau tag.',
        ],
        verifier: async () => {
            const imgs = await D.images();
            if (!imgs.length) return { ok: false, aide: `Je ne trouve aucune image dans \`${IMAGE}\`. Le workflow a-t-il le droit d'écrire des paquets ?` };
            const v = imgs.find((i) => i.tags.some((t) => /^\d+\.\d+\.\d+$/.test(t)));
            if (!v) return { ok: false, aide: 'Vos images n\'ont pas d\'étiquette de version complète (par exemple `1.0.0`).' };
            const [ma, mi] = v.tags.find((t) => /^\d+\.\d+\.\d+$/.test(t)).split('.');
            for (const e of [`${ma}.${mi}`, ma]) if (!v.tags.includes(e)) return { ok: false, aide: `Il manque l'étiquette \`${e}\` sur l'image ${v.tags.join(', ')}.` };
            if (!(await imageDe('latest'))) return { ok: false, aide: 'Aucune image ne porte l\'étiquette `latest`.' };
            return OK;
        },
        bilan: () => [
            'Une même image porte plusieurs étiquettes : `1.0.0` ne bougera jamais, `1.0` et `1` suivent la dernière correction, `latest` suit la dernière version stable. En production, on fixe une version précise.',
        ],
    },
    {
        titre: 'Une pré-version',
        consigne: () => [
            '> « Avant la 1.1.0, je veux une version de test pour Marco. Mais personne ne doit la recevoir par erreur. »',
            '> — Léa',
            '',
            'Publiez la pré-version `v1.1.0-rc.1`. La release doit être marquée comme pré-version, et l\'étiquette `latest` ne doit pas bouger.',
        ],
        verifier: async () => {
            const r = await release('v1.1.0-rc.1');
            if (!r) return { ok: false, aide: 'Je ne vois pas de release `v1.1.0-rc.1`.' };
            if (!r.prerelease) return { ok: false, aide: 'La release `v1.1.0-rc.1` n\'est pas marquée comme pré-version : `gh release create` a une option pour ça (et le tag contient un tiret…).' };
            const rc = await imageDe('1.1.0-rc.1');
            if (!rc) return { ok: false, aide: 'Je ne trouve pas l\'image `1.1.0-rc.1`.' };
            if (rc.tags.includes('latest')) return { ok: false, aide: 'L\'image de la pré-version porte `latest` : n\'importe qui la recevrait par erreur.' };
            return OK;
        },
        bilan: () => [
            'Une **pré-version** (`-rc.1`, `-beta`) se teste sans déranger personne : elle n\'est jamais `latest`, et la page des releases l\'affiche à part. Le versionnage sémantique la classe avant la version finale : `1.1.0-rc.1` < `1.1.0`.',
        ],
    },
    {
        titre: 'Revenir en arrière',
        consigne: () => [
            '> « La 1.1.0 est partie en production, et les clients se plaignent. Je veux pouvoir relancer la version d\'avant en une commande. »',
            '> — Léa',
            '',
            '1. Publiez la version finale `v1.1.0`.',
            `2. Répondez à la ligne \`q2:\` avec la commande exacte qui relance la version précédente depuis le registre (le port 3000 du conteneur sur le port 3000 du PC). Testez-la sur votre PC.`,
        ],
        verifier: async () => {
            const r = await release('v1.1.0');
            if (!r || r.prerelease) return { ok: false, aide: 'Je ne vois pas de release finale `v1.1.0`.' };
            const l = await imageDe('latest');
            if (!l || !l.tags.includes('1.1.0')) return { ok: false, aide: '`latest` devrait maintenant être la `1.1.0`.' };
            const q = normaliser((reponses() || {}).q2 || '');
            if (!q.startsWith('docker run')) return { ok: false, aide: '`q2` : une commande `docker run`.' };
            if (!q.includes(`${IMAGE}:1.0`)) return { ok: false, aide: '`q2` : quelle étiquette désigne la version précédente, sans risque qu\'elle bouge ?' };
            if (!/-p 3000:3000/.test(q)) return { ok: false, aide: '`q2` : il manque la redirection du port.' };
            return OK;
        },
        bilan: () => [
            'Revenir en arrière, c\'est relancer une image déjà publiée : rien à reconstruire, rien à corriger dans l\'urgence. C\'est possible parce que chaque version a gardé son image et que personne n\'a supprimé ni déplacé un tag.',
            'En mai 2024, Sonos a publié une nouvelle application sans pouvoir revenir à l\'ancienne. Ici, une commande suffit.',
            'Les missions obligatoires sont terminées. Les deux suivantes sont des bonus.',
        ],
    },
    {
        titre: 'Bonus : la version se calcule toute seule',
        consigne: () => [
            '> « Je ne veux plus calculer la version à la main. Les messages de commit suivent la convention : le pipeline doit trouver la version suivante et poser le tag lui-même. »',
            '> — Léa',
            '',
            'Un workflow nommé `Version`, déclenché par un push sur `main`, calcule la version suivante à partir des messages de commit et crée la release. Faites ensuite un commit `fix: …` sur `main` : la `v1.1.1` doit apparaître toute seule.',
            'Indice : l\'action `mathieudutour/github-tag-action`. Attention, un tag posé par le workflow ne déclenche pas les autres workflows : créez la release dans le même workflow.',
        ],
        verifier: async () => {
            const r = (await D.releases()).find((x) => x.author.login === 'github-actions[bot]' && !x.prerelease && versionSup(x.tag_name, 'v1.1.0'));
            if (!r) return { ok: false, aide: 'Je ne vois pas de release plus récente que `v1.1.0` créée par un workflow.' };
            if (!workflows().some((w) => /branches:[\s\S]*main/.test(w.t) && /github-tag-action|semantic-release|release-please/.test(w.t))) return { ok: false, aide: 'Je ne vois pas de workflow sur `main` qui calcule la version.' };
            return OK;
        },
        bilan: () => [
            'Le versionnage est maintenant automatique : `fix` donne un correctif, `feat` une version mineure, `!` une version majeure. Les messages de commit sont devenus des données que le pipeline lit.',
        ],
    },
    {
        titre: 'Bonus : un secret',
        consigne: () => [
            '> « Le pipeline aura bientôt besoin d\'un mot de passe pour le serveur. Il ne doit jamais apparaître dans le code, ni dans les journaux. »',
            '> — Léa',
            '',
            'Créez un secret de dépôt nommé `MESSAGE_SECRET` (**Settings** › **Secrets and variables** › **Actions**), puis affichez-le dans une étape d\'un workflow. Regardez le journal : que voyez-vous à la place ? Répondez à la ligne `q3:`.',
        ],
        verifier: async () => {
            if (!workflows().some((w) => /secrets\.MESSAGE_SECRET/.test(w.t))) return { ok: false, aide: 'Aucun workflow de `main` n\'utilise `secrets.MESSAGE_SECRET`.' };
            if ((((reponses() || {}).q3) || '').trim() !== '***') return { ok: false, aide: '`q3` : recopiez exactement ce que le journal affiche à la place du secret.' };
            return OK;
        },
        bilan: () => [
            'Un **secret** est chiffré par GitHub et n\'est donné qu\'au workflow qui en a besoin. S\'il apparaît dans un journal, il est remplacé par `***`. C\'est le principe des coffres à secrets (« vaults ») qu\'on retrouvera pour le déploiement.',
        ],
    },
];

async function progressionNotee() {
    let p = 0;
    for (const c of (await get(`/repos/${REPO}/comments?per_page=100`)) || []) {
        const m = /<!-- progression:(\d+) -->/.exec(c.body || '');
        if (m && c.user.type === 'Bot') p = Math.max(p, Number(m[1]));
    }
    return p;
}

async function main() {
    const res = { commentaire: '', sha: env.SHA };
    const fin = () => { fs.writeFileSync(env.SORTIE, JSON.stringify(res)); console.log(`Appels à l'API : ${appels}`); };
    const avant = await progressionNotee();
    let reussies = avant, aide = '';
    for (const m of MISSIONS.slice(avant)) {
        const r = await m.verifier();
        if (!r.ok) { aide = r.aide; break; }
        reussies++;
    }
    const n = MISSIONS.length;
    const L = [`@${PROPRIO}`, '', `**Progression : ${reussies} sur ${n}**`, ''];
    if (reussies > avant) {
        for (let i = avant; i < reussies; i++) L.push(`### Mission ${i + 1} réussie : ${MISSIONS[i].titre}`, '', ...MISSIONS[i].bilan().flatMap((x) => [x, '']));
        if (reussies === n) L.push('### Terminé', '', 'Toutes les missions sont réussies, bonus compris. Montrez ce message à votre enseignant.');
        else L.push(`### Mission ${reussies + 1} : ${MISSIONS[reussies].titre}`, '', ...MISSIONS[reussies].consigne(), '');
    } else if (reussies < n && env.EVENEMENT !== 'push') {
        // Au push, on attend la fin des workflows pour ne pas répondre deux fois
        L.push(`### Mission ${reussies + 1} : pas encore`, '', `> ${aide}`, '');
        if (reussies > 0) L.push('<details><summary>Rappel de la consigne</summary>', '', ...MISSIONS[reussies].consigne(), '', '</details>', '');
    } else {
        return fin();
    }
    L.push(`<!-- progression:${reussies} -->`);
    res.commentaire = L.join('\n');
    return fin();
}
main().catch((e) => { console.error(e.message); fs.writeFileSync(env.SORTIE, JSON.stringify({ commentaire: '', sha: env.SHA })); });
