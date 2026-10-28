import i18n from '@/i18n'
const en = {
  tagline: 'A place for your next home', title: 'Find your next place.', subtitle: 'Buy, rent or exchange — choose what fits your life.',
  all: 'All listings', Sale: 'For sale', Rent: 'For rent', Exchange: 'Home exchange', Unspecified: 'Other listings',
  publish: 'Post a listing', advanced: 'More filters', less: 'Fewer filters', loaded: '{{count}} listings loaded',
  list: 'List view', grid: 'Grid view', display: 'Results display', results: 'Homes that match',
  searchHint: 'Start with a city and refine your budget and room count.', filters: 'Find a home', view: 'View listing',
  missingPhoto: 'Photo not added yet', photos: '{{count}} photos', details: 'About this home', gallery: 'View all {{count}} photos',
  tools: 'Your home search, organized', savedTitle: 'Keep the right homes close', savedHint: 'Save your favorites and compare up to three homes.',
  alertsTitle: 'Let the next match find you', alertsHint: 'Save a search and choose where to receive new matches.',
  visitTitle: 'From a conversation to a visit', visitHint: 'Arrange visits in messages and find confirmed dates in your calendar.',
  welcome: 'Find a place that feels like yours.', welcomeHint: 'Homes for sale, for rent and for exchange. Explore, compare and contact advertisers in one place.',
  start: 'Find a home', joinHint: 'Sign in to view listings and contact advertisers.',
  profile: 'Account', search: 'Search', favorites: 'Saved', messages: 'Messages', footer: 'DOMIX · Homes and connections',
}
const he: typeof en = {
  tagline: 'המקום לבית הבא שלך', title: 'הבית הבא שלך מתחיל כאן.', subtitle: 'לקנות, לשכור או להחליף — מוצאים את מה שמתאים לחיים שלכם.',
  all: 'כל המודעות', Sale: 'למכירה', Rent: 'להשכרה', Exchange: 'החלפת דירות', Unspecified: 'מודעות נוספות',
  publish: 'פרסום מודעה', advanced: 'סינון נוסף', less: 'פחות מסננים', loaded: '{{count}} מודעות נטענו',
  list: 'תצוגת רשימה', grid: 'תצוגת כרטיסים', display: 'תצוגת התוצאות', results: 'דירות שכדאי להכיר',
  searchHint: 'מתחילים בעיר, ומדייקים לפי התקציב ומספר החדרים.', filters: 'איזו דירה מחפשים?', view: 'לפרטי הדירה',
  missingPhoto: 'עדיין לא נוספה תמונה', photos: '{{count}} תמונות', details: 'על הדירה', gallery: 'לכל {{count}} התמונות',
  tools: 'כל מה שצריך בדרך לבית', savedTitle: 'הדירות שאהבתם, במקום אחד', savedHint: 'שומרים מועדפים ומשווים עד שלוש דירות לפני שמחליטים.',
  alertsTitle: 'הדירה הבאה יכולה להגיע אליכם', alertsHint: 'שומרים חיפוש ובוחרים איפה לקבל עדכונים על התאמות חדשות.',
  visitTitle: 'מהתכתבות לביקור בדירה', visitHint: 'מתאמים ביקור בהודעות ורואים את המועדים שאושרו ביומן שלכם.',
  welcome: 'יש מקום שמרגיש בדיוק שלכם.', welcomeHint: 'דירות למכירה, להשכרה ולהחלפה. מחפשים, משווים ופונים למפרסמים במקום אחד.',
  start: 'למציאת דירה', joinHint: 'כדי לצפות במודעות ולפנות למפרסמים, יש להתחבר לחשבון.',
  profile: 'החשבון שלי', search: 'חיפוש', favorites: 'שמורים', messages: 'הודעות', footer: 'DOMIX · בתים ואנשים',
}
const es: typeof en = {
  ...en, tagline: 'Tu próximo hogar', title: 'Encuentra tu próximo hogar.', subtitle: 'Comprar, alquilar o intercambiar: elige lo que encaja contigo.',
  all: 'Todos', Sale: 'En venta', Rent: 'En alquiler', Exchange: 'Intercambio', Unspecified: 'Otros', publish: 'Publicar anuncio', advanced: 'Más filtros', less: 'Menos filtros', loaded: '{{count}} anuncios cargados',
  list: 'Lista', grid: 'Tarjetas', display: 'Vista de resultados', results: 'Viviendas para conocer', searchHint: 'Elige ciudad, presupuesto y habitaciones.', filters: 'Buscar vivienda', view: 'Ver anuncio', missingPhoto: 'Sin foto', photos: '{{count}} fotos', details: 'Sobre la vivienda', gallery: 'Ver {{count}} fotos',
  tools: 'Organiza tu búsqueda', savedTitle: 'Tus viviendas favoritas', savedHint: 'Guarda favoritos y compara hasta tres viviendas.', alertsTitle: 'Recibe nuevas coincidencias', alertsHint: 'Guarda una búsqueda y elige tus avisos.', visitTitle: 'De la conversación a la visita', visitHint: 'Coordina visitas en mensajes y consulta tu calendario.',
  welcome: 'Un lugar que se sienta tuyo.', welcomeHint: 'Viviendas en venta, alquiler e intercambio. Busca, compara y contacta anunciantes.', start: 'Buscar vivienda', joinHint: 'Inicia sesión para ver anuncios y contactar anunciantes.', profile: 'Cuenta', search: 'Buscar', favorites: 'Guardados', messages: 'Mensajes', footer: 'DOMIX · Hogares y personas',
}
const fr: typeof en = {
  ...en, tagline: 'Votre prochain chez-vous', title: 'Trouvez votre prochain logement.', subtitle: 'Acheter, louer ou échanger : à vous de choisir.',
  all: 'Toutes', Sale: 'À vendre', Rent: 'À louer', Exchange: 'Échange', Unspecified: 'Autres', publish: 'Publier une annonce', advanced: 'Plus de filtres', less: 'Moins de filtres', loaded: '{{count}} annonces chargées',
  list: 'Liste', grid: 'Cartes', display: 'Affichage des résultats', results: 'Des logements à découvrir', searchHint: 'Choisissez ville, budget et nombre de pièces.', filters: 'Chercher un logement', view: 'Voir l’annonce', missingPhoto: 'Pas encore de photo', photos: '{{count}} photos', details: 'À propos du logement', gallery: 'Voir les {{count}} photos',
  tools: 'Organisez votre recherche', savedTitle: 'Vos logements favoris', savedHint: 'Enregistrez et comparez jusqu’à trois logements.', alertsTitle: 'Recevez les prochaines correspondances', alertsHint: 'Enregistrez une recherche et choisissez vos alertes.', visitTitle: 'De la discussion à la visite', visitHint: 'Organisez vos visites dans les messages et consultez votre calendrier.',
  welcome: 'Un lieu qui vous ressemble.', welcomeHint: 'Des logements à vendre, à louer et à échanger. Cherchez, comparez et contactez les annonceurs.', start: 'Trouver un logement', joinHint: 'Connectez-vous pour voir les annonces et contacter les annonceurs.', profile: 'Compte', search: 'Chercher', favorites: 'Favoris', messages: 'Messages', footer: 'DOMIX · Logements et liens',
}
for (const [lang, values] of Object.entries({en, he, es, fr})) i18n.addResourceBundle(lang, 'marketplace', values, true, true)
