/* Zeste — contenus : ambiances, rayons, check-list, cocktails, jeux. */
const THEMES = [
  { id: 'dance', label: 'Dansante', emo: '🪩', c: '--w-violet' },
  { id: 'anniv', label: 'Anniv', emo: '🎂', c: '--w-pink' },
  { id: 'apero', label: 'Apéro', emo: '🥂', c: '--w-orange' },
  { id: 'chill', label: 'Chill', emo: '🛋️', c: '--w-sky' },
  { id: 'jeux', label: 'Soirée jeux', emo: '🎲', c: '--w-mint' },
  { id: 'diner', label: 'Dîner', emo: '🍝', c: '--w-sun' },
  { id: 'costume', label: 'Déguisée', emo: '🎭', c: '--w-pink' },
  { id: 'crem', label: 'Crémaillère', emo: '🔑', c: '--w-mint' },
];
const NAME_IDEAS = ['Crémaillère', 'Soirée raclette', 'Before du samedi', 'Anniv surprise', 'Apéro rooftop'];

const CATS = [
  { id: 'alcool', label: 'Alcools' },
  { id: 'soft', label: 'Softs et eau' },
  { id: 'food', label: 'À grignoter' },
  { id: 'frais', label: 'Frais et garnitures' },
  { id: 'divers', label: 'Glaçons et matos' },
];

const TASKS = [
  { id: 't1', when: 'J-7', label: 'Envoyer les invitations' },
  { id: 't2', when: 'J-5', label: 'Relancer ceux qui n’ont pas répondu' },
  { id: 't3', when: 'J-3', label: 'Boucler la liste de courses' },
  { id: 't4', when: 'J-1', label: 'Faire les courses' },
  { id: 't5', when: 'J-1', label: 'Glaçons au congélateur' },
  { id: 't6', when: 'Jour J', label: 'Playlist prête, enceinte chargée' },
  { id: 't7', when: 'Jour J', label: 'Planquer les objets fragiles' },
  { id: 't8', when: 'J+1', label: 'Poster les photos dans la galerie' },
];

/* Estimation des quantités : 1 verre par personne et par heure, plus un verre d'accueil. */
function estimateShopping(n, hours, thirst) {
  const f = [0.7, 1, 1.35][thirst];
  const drinks = n * (1 + hours) * f;
  const up = Math.ceil;
  const one = l => (l.qty <= 1 ? { ...l, unit: l.unit.replace(/^(\S+?)s(\s|$)/, '$1$2') } : l);
  return [
    { name: 'Bières 33 cl', qty: up(drinks * 0.5), unit: 'bouteilles', cat: 'alcool', price: 1.2 },
    { name: 'Vin', qty: up(drinks * 0.25 / 6), unit: 'bouteilles', cat: 'alcool', price: 7 },
    { name: 'Rhum', qty: up(drinks * 0.25 / 15), unit: 'bouteilles 70 cl', cat: 'alcool', price: 16 },
    { name: 'Softs (cola, jus, tonic)', qty: up(n / 3 * Math.max(1, hours / 4)), unit: 'bouteilles 1,5 L', cat: 'soft', price: 2 },
    { name: 'Eau', qty: up(n / 4), unit: 'bouteilles 1,5 L', cat: 'soft', price: 0.6 },
    { name: 'Eau gazeuse', qty: up(n / 6), unit: 'bouteilles', cat: 'soft', price: 0.9 },
    { name: 'Chips et biscuits apéro', qty: up(n / 3), unit: 'sachets', cat: 'food', price: 1.8 },
    { name: 'Citrons verts', qty: up(n / 3), unit: 'pièces', cat: 'frais', price: 0.5 },
    { name: 'Menthe fraîche', qty: up(n / 10), unit: 'bouquet', cat: 'frais', price: 1.5 },
    { name: 'Glaçons', qty: Math.max(1, up(n / 5)), unit: 'kg', cat: 'divers', price: 2.5 },
    { name: 'Gobelets', qty: up(n * 3 / 10) * 10, unit: 'pièces', cat: 'divers', price: 0.06 },
  ].map(one);
}

/* Cocktails. k = mots-clés cherchés dans la liste de courses ; base = on suppose que tu l'as. */
const I = (n, q, u, k, cat, base) => ({ n, q, u, k, cat, base: !!base });
const COCKTAILS = [
  { id: 'mojito', name: 'Mojito', glass: 'highball', c: ['#DFF7C8', '#9BE08A'], str: 2, garnish: 'lime',
    ing: [I('Rhum blanc', 5, 'cl', ['rhum'], 'alcool'), I('Citron vert', 0.5, '', ['citron'], 'frais'), I('Menthe fraîche', 8, 'feuilles', ['menthe'], 'frais'), I('Sucre de canne', 2, 'c. à café', ['sucre'], 'divers', 1), I('Eau gazeuse', 6, 'cl', ['eau gaz', 'perrier', 'petillante'], 'soft'), I('Glace pilée', 1, 'verre', ['glacon', 'glace'], 'divers')],
    steps: ['Écrase doucement la menthe, le citron en quartiers et le sucre au fond du verre.', 'Remplis de glace pilée, verse le rhum.', 'Complète à l’eau gazeuse et mélange de bas en haut.'] },
  { id: 'spritz', name: 'Spritz', glass: 'wine', c: ['#FFB25C', '#FF7A2E'], str: 1, garnish: 'orange',
    ing: [I('Apéritif amer à l’orange', 6, 'cl', ['aperol', 'amer', 'spritz', 'bitter'], 'alcool'), I('Prosecco', 9, 'cl', ['prosecco', 'cremant', 'mousseux'], 'alcool'), I('Eau gazeuse', 3, 'cl', ['eau gaz', 'perrier', 'petillante'], 'soft'), I('Orange', 1, 'tranche', ['orange'], 'frais'), I('Glaçons', 5, '', ['glacon', 'glace'], 'divers')],
    steps: ['Remplis le verre de glaçons.', 'Verse le prosecco, puis l’amer, puis l’eau gazeuse.', 'Une tranche d’orange et c’est servi.'] },
  { id: 'gintonic', name: 'Gin tonic', glass: 'highball', c: ['#F1FBFF', '#CFEFFF'], str: 2, garnish: 'lime',
    ing: [I('Gin', 5, 'cl', ['gin'], 'alcool'), I('Tonic', 15, 'cl', ['tonic', 'softs'], 'soft'), I('Citron vert', 1, 'quartier', ['citron'], 'frais'), I('Glaçons', 5, '', ['glacon', 'glace'], 'divers')],
    steps: ['Beaucoup de glaçons dans le verre.', 'Verse le gin, puis le tonic le long d’une cuillère pour garder les bulles.', 'Presse le quartier de citron vert et laisse-le dedans.'] },
  { id: 'mule', name: 'Moscow mule', glass: 'tumbler', c: ['#FFE9B8', '#E8B45A'], str: 2, garnish: 'lime',
    ing: [I('Vodka', 5, 'cl', ['vodka'], 'alcool'), I('Ginger beer', 12, 'cl', ['ginger'], 'soft'), I('Citron vert', 0.5, '', ['citron'], 'frais'), I('Glaçons', 5, '', ['glacon', 'glace'], 'divers')],
    steps: ['Presse le demi citron vert sur les glaçons.', 'Ajoute la vodka puis la ginger beer.', 'Mélange une seule fois.'] },
  { id: 'cubalibre', name: 'Cuba libre', glass: 'highball', c: ['#8A4B2A', '#3B1D12'], str: 2, garnish: 'lime',
    ing: [I('Rhum ambré', 5, 'cl', ['rhum'], 'alcool'), I('Cola', 12, 'cl', ['cola', 'coca', 'softs'], 'soft'), I('Citron vert', 0.5, '', ['citron'], 'frais'), I('Glaçons', 5, '', ['glacon', 'glace'], 'divers')],
    steps: ['Glaçons, rhum, jus du demi citron vert.', 'Complète au cola.', 'Mélange et sers avec le citron pressé.'] },
  { id: 'margarita', name: 'Margarita', glass: 'coupe', c: ['#F4FFC2', '#D8F26B'], str: 3, garnish: 'lime',
    ing: [I('Tequila', 5, 'cl', ['tequila'], 'alcool'), I('Triple sec', 3, 'cl', ['triple sec', 'cointreau'], 'alcool'), I('Jus de citron vert', 2, 'cl', ['citron'], 'frais'), I('Sel', 1, 'pincée', ['sel'], 'divers', 1), I('Glaçons', 5, '', ['glacon', 'glace'], 'divers')],
    steps: ['Givre le bord du verre : citron puis sel.', 'Secoue tequila, triple sec et citron avec des glaçons.', 'Filtre dans le verre.'] },
  { id: 'sunrise', name: 'Tequila sunrise', glass: 'highball', c: ['#FFC53D', '#FF4D4D'], str: 2, garnish: 'orange',
    ing: [I('Tequila', 5, 'cl', ['tequila'], 'alcool'), I('Jus d’orange', 12, 'cl', ['orange', 'jus'], 'soft'), I('Sirop de grenadine', 2, 'cl', ['grenadine'], 'soft'), I('Glaçons', 5, '', ['glacon', 'glace'], 'divers')],
    steps: ['Tequila et jus d’orange sur glaçons.', 'Verse la grenadine doucement : elle tombe au fond.', 'Ne mélange pas, c’est le dégradé qui fait tout.'] },
  { id: 'caipi', name: 'Caïpirinha', glass: 'tumbler', c: ['#EEFFD0', '#C6EE7A'], str: 3, garnish: 'lime',
    ing: [I('Cachaça', 5, 'cl', ['cachaca', 'rhum'], 'alcool'), I('Citron vert', 1, '', ['citron'], 'frais'), I('Sucre de canne', 2, 'c. à café', ['sucre'], 'divers', 1), I('Glace pilée', 1, 'verre', ['glacon', 'glace'], 'divers')],
    steps: ['Coupe le citron en dés, écrase-les avec le sucre dans le verre.', 'Remplis de glace pilée.', 'Verse la cachaça et mélange bien.'] },
  { id: 'pina', name: 'Piña colada', glass: 'wine', c: ['#FFFBEA', '#FFE9A8'], str: 2, garnish: 'none',
    ing: [I('Rhum blanc', 4, 'cl', ['rhum'], 'alcool'), I('Jus d’ananas', 12, 'cl', ['ananas'], 'soft'), I('Lait de coco', 4, 'cl', ['coco'], 'frais'), I('Glaçons', 5, '', ['glacon', 'glace'], 'divers')],
    steps: ['Mixe tout avec les glaçons jusqu’à obtenir une texture onctueuse.', 'Verse dans un grand verre.', 'Parasol en papier vivement conseillé.'] },
  { id: 'espresso', name: 'Espresso martini', glass: 'coupe', c: ['#7A4A2B', '#2A160C'], str: 3, garnish: 'none',
    ing: [I('Vodka', 4, 'cl', ['vodka'], 'alcool'), I('Liqueur de café', 2, 'cl', ['cafe', 'kahlua'], 'alcool'), I('Espresso refroidi', 1, 'tasse', ['cafe', 'espresso'], 'divers', 1), I('Glaçons', 5, '', ['glacon', 'glace'], 'divers')],
    steps: ['Prépare l’espresso et laisse-le tiédir.', 'Secoue très fort avec la vodka, la liqueur et les glaçons.', 'Filtre : la mousse doit tenir trois grains de café.'] },
  { id: 'tipunch', name: 'Ti-punch', glass: 'tumbler', c: ['#FFF3C4', '#F2D675'], str: 3, garnish: 'lime',
    ing: [I('Rhum agricole', 5, 'cl', ['rhum'], 'alcool'), I('Citron vert', 1, 'quartier', ['citron'], 'frais'), I('Sucre de canne', 1, 'c. à café', ['sucre'], 'divers', 1)],
    steps: ['Presse le quartier de citron vert dans le verre.', 'Ajoute le sucre, mélange.', 'Verse le rhum. Pas de glaçon, c’est la règle.'] },
  { id: 'punch', name: 'Punch planteur', glass: 'pitcher', c: ['#FFB03B', '#FF6B4A'], str: 2, garnish: 'orange', batch: 10,
    ing: [I('Rhum ambré', 50, 'cl', ['rhum'], 'alcool'), I('Jus d’orange', 50, 'cl', ['orange', 'jus'], 'soft'), I('Jus d’ananas', 50, 'cl', ['ananas', 'jus'], 'soft'), I('Sirop de sucre de canne', 10, 'cl', ['sirop', 'sucre'], 'soft', 1), I('Citrons verts', 2, '', ['citron'], 'frais'), I('Glaçons', 1, 'kg', ['glacon', 'glace'], 'divers')],
    steps: ['Mélange tout dans un saladier ou un pichet.', 'Laisse reposer 2 h au frais si tu peux.', 'Ajoute les glaçons au moment de servir.'] },
  { id: 'sangria', name: 'Sangria', glass: 'pitcher', c: ['#C2334D', '#6E1230'], str: 1, garnish: 'orange', batch: 10,
    ing: [I('Vin rouge', 150, 'cl', ['vin'], 'alcool'), I('Limonade', 50, 'cl', ['limonade', 'softs'], 'soft'), I('Oranges', 2, '', ['orange'], 'frais'), I('Pêches ou pommes', 2, '', ['peche', 'pomme'], 'frais'), I('Sucre', 4, 'c. à soupe', ['sucre'], 'divers', 1), I('Cannelle', 1, 'bâton', ['cannelle'], 'divers', 1)],
    steps: ['Coupe les fruits, fais-les mariner dans le vin avec le sucre et la cannelle.', 'Au frigo au moins 3 h, la veille c’est mieux.', 'Ajoute la limonade bien fraîche juste avant de servir.'] },
  { id: 'vmojito', name: 'Virgin mojito', glass: 'highball', c: ['#E3FBD0', '#A9E79A'], str: 0, garnish: 'lime',
    ing: [I('Citron vert', 0.5, '', ['citron'], 'frais'), I('Menthe fraîche', 8, 'feuilles', ['menthe'], 'frais'), I('Sucre de canne', 2, 'c. à café', ['sucre'], 'divers', 1), I('Limonade ou eau gazeuse', 15, 'cl', ['limonade', 'eau gaz', 'perrier', 'softs'], 'soft'), I('Glace pilée', 1, 'verre', ['glacon', 'glace'], 'divers')],
    steps: ['Écrase menthe, citron et sucre.', 'Glace pilée jusqu’en haut.', 'Complète avec la limonade.'] },
  { id: 'fraise', name: 'Limonade fraise basilic', glass: 'highball', c: ['#FFD3DA', '#FF7C93'], str: 0, garnish: 'none',
    ing: [I('Fraises', 5, '', ['fraise'], 'frais'), I('Basilic', 4, 'feuilles', ['basilic'], 'frais'), I('Jus de citron', 2, 'cl', ['citron'], 'frais'), I('Limonade', 15, 'cl', ['limonade', 'softs'], 'soft'), I('Glaçons', 5, '', ['glacon', 'glace'], 'divers')],
    steps: ['Écrase les fraises avec le basilic et le citron.', 'Ajoute les glaçons.', 'Complète à la limonade, mélange doucement.'] },
  { id: 'borabora', name: 'Bora Bora', glass: 'wine', c: ['#FFD86B', '#FF8A5C'], str: 0, garnish: 'orange',
    ing: [I('Jus d’ananas', 10, 'cl', ['ananas', 'jus'], 'soft'), I('Jus de fruit de la passion', 6, 'cl', ['passion', 'jus'], 'soft'), I('Jus de citron', 1, 'cl', ['citron'], 'frais'), I('Sirop de grenadine', 1, 'cl', ['grenadine'], 'soft'), I('Glaçons', 5, '', ['glacon', 'glace'], 'divers')],
    steps: ['Secoue tous les jus avec les glaçons.', 'Verse dans le verre.', 'Un trait de grenadine pour la couleur.'] },
];

/* Jeux. lvl : 0 = tout public, 1 = classique, 2 = corsé. {n} = nombre de gorgées. */
const GAMES = [
  { id: 'never', name: 'Je n’ai jamais', emo: '🙈', c: '--w-pink', sub: 'Ceux qui l’ont fait boivent' },
  { id: 'tod', name: 'Action ou vérité', emo: '🎯', c: '--w-orange', sub: 'Chacun son tour' },
  { id: 'wheel', name: 'La roue', emo: '🎡', c: '--w-sun', sub: 'Le hasard décide' },
  { id: 'who', name: 'Qui de nous', emo: '👉', c: '--w-mint', sub: 'À trois, tout le monde pointe' },
  { id: 'bottle', name: 'La bouteille', emo: '🍾', c: '--w-sky', sub: 'Elle désigne, tu exécutes' },
  { id: 'cards', name: 'La pioche', emo: '🃏', c: '--w-violet', sub: 'Une carte, une règle' },
  { id: 'bomb', name: 'La bombe', emo: '💣', c: '--no', sub: 'Fais tourner le téléphone' },
];

const NEVER = [
  [0, 'chanté sous la douche en imaginant un public'], [0, 'fait semblant de connaître une chanson'], [0, 'mangé un truc tombé par terre'],
  [0, 'ri à une blague que je n’avais pas comprise'], [0, 'raté mon train ou mon avion'], [0, 'stalké quelqu’un jusqu’aux photos de 2015'],
  [0, 'menti sur mon âge'], [0, 'fait une nuit blanche pour finir une série'], [0, 'oublié le prénom de quelqu’un en pleine conversation'],
  [0, 'envoyé un message à la mauvaise personne'], [1, 'dormi dans ma voiture'], [1, 'séché un cours pour aller en soirée'],
  [1, 'liké une vieille photo par accident en stalkant'], [1, 'fait croire que j’étais malade pour éviter une soirée'], [1, 'dansé sur une table'],
  [1, 'perdu mon téléphone en soirée'], [1, 'embrassé quelqu’un dont je ne connaissais pas le prénom'], [1, 'oublié comment j’étais rentré'],
  [1, 'appelé mon ex après minuit'], [1, 'menti à mes parents sur l’endroit où je dormais'], [1, 'été viré d’un bar'],
  [2, 'eu un crush sur quelqu’un dans cette pièce'], [2, 'fouillé dans le téléphone de quelqu’un'], [2, 'fait un bain de minuit'],
  [2, 'embrassé deux personnes dans la même soirée'], [2, 'eu un date catastrophique que je n’ai jamais raconté'], [2, 'relancé quelqu’un qui m’avait mis un vent'],
  [2, 'flirté pour avoir un verre gratuit'], [2, 'ghosté quelqu’un que je revois encore'], [2, 'fait le mur'],
];
const TRUTHS = [
  [0, 'C’est quoi ton plus gros mensonge d’enfance ?'], [0, 'Quelle est la chanson que tu écoutes en cachette ?'], [0, 'Ton pire achat ?'],
  [0, 'C’est quoi ta phobie la plus ridicule ?'], [0, 'Quel est le dernier truc que tu as cherché sur ton téléphone ?'], [0, 'Quel surnom tu détestes ?'],
  [1, 'Qui ici a le plus de style ? Et le moins ?'], [1, 'Ta pire honte en soirée ?'], [1, 'Quel est le message que tu regrettes le plus d’avoir envoyé ?'],
  [1, 'Qui ici tu appellerais en cas de galère à 4 h du matin ?'], [1, 'C’est quoi ton red flag ?'], [1, 'Le dernier mensonge que tu as dit ?'],
  [1, 'Quelle est la chose la plus bête que tu aies faite par amour ?'], [2, 'Ton pire date, en détail.'], [2, 'Qui ici tu trouves le plus attirant ?'],
  [2, 'À qui était destiné ton dernier message supprimé ?'], [2, 'Ton crush le plus inavouable ?'], [2, 'Quelle rumeur sur toi était vraie ?'],
];
const DARES = [
  [0, 'Imite quelqu’un de la pièce jusqu’à ce qu’on devine qui.'], [0, 'Parle avec un accent pendant deux tours.'], [0, 'Fais ton meilleur pas de danse, tout de suite.'],
  [0, 'Laisse le groupe choisir ta photo de profil pour 24 h.'], [0, 'Raconte une blague. Si personne ne rit, {n}.'], [0, 'Chante le refrain que le groupe choisit.'],
  [1, 'Envoie « tu me manques » au 5e contact de ta liste.'], [1, 'Laisse ton voisin de droite poster une story sur ton compte.'], [1, 'Fais un compliment sincère à chaque joueur.'],
  [1, 'Échange un vêtement avec la personne en face.'], [1, 'Montre la dernière photo de ta galerie.'], [1, 'Finis ton verre d’eau d’une traite. Oui, d’eau.'],
  [1, 'Fais 10 squats en portant un toast.'], [2, 'Lis à voix haute ton dernier message envoyé.'], [2, 'Appelle quelqu’un et chante-lui joyeux anniversaire.'],
  [2, 'Laisse le groupe écrire un message à la personne de son choix depuis ton téléphone.'], [2, 'Danse un slow avec la personne désignée par le groupe.'], [2, 'Fais une déclaration d’amour à un meuble.'],
];
const WHO = [
  [0, 'finirait célèbre pour une raison stupide'], [0, 'survivrait le plus longtemps sur une île déserte'], [0, 'oublierait son propre anniversaire'],
  [0, 'adopterait dix chats'], [0, 'deviendrait président sans faire exprès'], [0, 'pleurerait devant un dessin animé'],
  [0, 'se perdrait avec un GPS'], [0, 'gagnerait à Koh-Lanta'], [1, 'arriverait en retard à son propre mariage'],
  [1, 'dépenserait son salaire en une soirée'], [1, 'partirait vivre à l’autre bout du monde sur un coup de tête'], [1, 'reprendrait un verre « juste un dernier »'],
  [1, 'se ferait virer d’un karaoké'], [1, 'enverrait un message à son ex ce soir'], [1, 'dormirait le premier ce soir'],
  [1, 'se ferait tatouer après un pari'], [2, 'embrasserait quelqu’un ce soir'], [2, 'a le plus de dossiers compromettants'],
  [2, 'cache une double vie'], [2, 'sortirait avec quelqu’un de cette pièce'], [2, 'ghosterait après trois dates parfaits'],
];
const BOMB_CATS = ['Marques de bière', 'Cocktails', 'Prénoms en A', 'Chanteurs français', 'Marques de voiture', 'Pays d’Europe', 'Trucs qu’on trouve dans un frigo', 'Séries',
  'Insultes polies', 'Sports olympiques', 'Excuses pour annuler une soirée', 'Personnages de dessins animés', 'Marques de chips', 'Capitales', 'Films d’horreur', 'Métiers en -eur',
  'Fromages', 'Applis sur ton téléphone', 'Choses rouges', 'Chansons de karaoké'];
const WHEEL = [
  { t: 'Tu bois', l: 'Bois {n}', n: 2 }, { t: 'Distribue', l: 'Distribue {n} à qui tu veux', n: 3 }, { t: 'Santé !', l: 'Tout le monde trinque et boit une gorgée' },
  { t: 'Règle', l: 'Invente une règle. Celui qui l’oublie boit.' }, { t: 'Voisin', l: 'Ton voisin de gauche boit {n}', n: 2 }, { t: 'Imite', l: 'Imite quelqu’un d’ici. Le premier qui trouve distribue {n}.', n: 2 },
  { t: 'Joker', l: 'Immunité : tu passes ton prochain gage.' }, { t: 'Aveu', l: 'Raconte ta pire honte, ou bois {n}', n: 3 },
];
const CARD_RULES = {
  A: 'Cascade : tout le monde boit, tu t’arrêtes en premier.', 2: 'Tu distribues {n}.', 3: 'Tu bois {n}.', 4: 'Le dernier à toucher le sol boit.',
  5: 'Pouce : pose ton pouce sur la table quand tu veux. Le dernier à suivre boit.', 6: 'Ceux qui portent du noir boivent.', 7: 'Le dernier à lever la main boit.', 8: 'Choisis un binôme : il boit quand tu bois.',
  9: 'Rime : dis un mot, on enchaîne les rimes. Le premier qui sèche boit.', 10: 'Catégorie : choisis un thème, le premier qui sèche boit.', V: 'Ceux dont le prénom contient un A boivent.',
  D: 'Reine des questions : quiconque te répond boit, jusqu’à la prochaine dame.', R: 'Invente une règle pour le reste de la partie.',
};
const BOTTLE_GAGES = [
  [0, 'choisit la prochaine chanson'], [0, 'fait un compliment à la personne à sa droite'], [0, 'raconte son souvenir le plus gênant'], [0, 'mime un film que le groupe doit deviner'],
  [1, 'boit {n}'], [1, 'distribue {n}'], [1, 'échange sa place avec quelqu’un'], [1, 'répond à une question du groupe, sans joker'],
  [2, 'laisse le groupe lire son dernier message'], [2, 'fait un slow de 20 secondes avec la personne de son choix'],
];

const COACH = {
  qg: 'Ici c’est ton QG : compte à rebours, jauges et check-list. Je te préviens si quelque chose cloche.',
  guests: 'Tape sur le statut d’un invité pour le faire changer. Je tiens les comptes pour toi.',
  shop: 'Laisse-moi calculer les quantités selon le nombre d’invités. Le jour J, passe en vue Stock pour suivre ce qu’il reste.',
  bar: 'Je compare chaque recette avec ta liste de courses. « Faisable » veut dire que tu as tout.',
  gallery: 'Ajoute les photos pendant ou après la soirée. Le diaporama, c’est pour le lendemain difficile.',
  night: 'Mode soirée ! Choisis qui joue et règle l’intensité. Le Sam joue au soft, c’est lui le vrai héros.',
};
