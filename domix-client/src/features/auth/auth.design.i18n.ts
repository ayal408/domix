import i18n from '@/i18n'

const resources = {
  he: { eyebrow: 'השכרה · החלפה · קהילה', headline: 'המקום הבא שלכם מתחיל כאן.', description: 'דירות להשכרה ולהחלפה, שיחות עם בעלי דירות וכל מה ששמרתם — במקום אחד.', note: 'מקום חדש. אפשרויות חדשות.', welcome: 'טוב לראות אתכם שוב', subtitle: 'היכנסו לחשבון והמשיכו לחפש את המקום שמתאים לכם.' },
  en: { eyebrow: 'Rent · Exchange · Connect', headline: 'Your next place starts here.', description: 'Homes to rent and exchange, conversations with owners, and everything you saved — together in one place.', note: 'A new place. New possibilities.', welcome: 'Welcome back', subtitle: 'Sign in and pick up the search for a place that fits.' },
  es: { eyebrow: 'Alquilar · Intercambiar · Conectar', headline: 'Tu próximo hogar empieza aquí.', description: 'Viviendas, conversaciones con propietarios y tus favoritos, en un solo lugar.', note: 'Un nuevo lugar. Nuevas posibilidades.', welcome: 'Te damos la bienvenida', subtitle: 'Inicia sesión y continúa buscando tu próximo hogar.' },
  fr: { eyebrow: 'Louer · Échanger · Rencontrer', headline: 'Votre prochain chez-vous commence ici.', description: 'Locations, échanges, conversations et favoris réunis au même endroit.', note: 'Un nouveau lieu. De nouvelles possibilités.', welcome: 'Heureux de vous revoir', subtitle: 'Connectez-vous et reprenez votre recherche.' },
}
for (const [language, values] of Object.entries(resources)) {
  i18n.addResourceBundle(language, 'authDesign', values, true, true)
}
