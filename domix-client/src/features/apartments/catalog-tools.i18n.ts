import i18n from '@/i18n'
const en = {
  active: 'Active filters', removeFilter: 'Remove filter: {{label}}', owner: 'This advertiser’s listings', quickSort: 'Quick sort',
  recent: 'Recently viewed homes', recentHint: 'Up to 8 homes viewed in this tab. This list clears on refresh, logout or account change. It is not saved to your account.',
  clearRecent: 'Clear viewing history', removeRecent: 'Remove from history', emptyRecent: 'No recently viewed homes', emptyHint: 'Open a listing to find it here while you browse.',
  unavailable: 'This listing is no longer available to view.', loadFailed: 'Could not load this listing. Your other viewed homes are still available below.',
  returnSearch: 'Back to search', recentLink: 'Go back to homes you viewed',
}
const he: typeof en = {
  active: 'מסננים פעילים', removeFilter: 'הסרת מסנן: {{label}}', owner: 'מודעות המפרסם', quickSort: 'מיון מהיר',
  recent: 'דירות שצפיתי בהן', recentHint: 'עד 8 דירות שנפתחו בלשונית הזאת. הרשימה מתנקה ברענון, בהתנתקות או בהחלפת חשבון, ואינה נשמרת בחשבון שלכם.',
  clearRecent: 'ניקוי היסטוריית צפייה', removeRecent: 'הסרה מהיסטוריית הצפייה', emptyRecent: 'עדיין אין דירות שצפיתם בהן', emptyHint: 'פתחו מודעה כדי לחזור אליה כאן בהמשך הגלישה.',
  unavailable: 'המודעה הזאת כבר אינה זמינה לצפייה.', loadFailed: 'לא ניתן לטעון את המודעה הזאת. יתר הדירות שצפיתם בהן עדיין מוצגות.',
  returnSearch: 'חזרה לחיפוש', recentLink: 'חזרה לדירות שכבר צפיתם בהן',
}
const es: typeof en = {
  active: 'Filtros activos', removeFilter: 'Quitar filtro: {{label}}', owner: 'Anuncios de este anunciante', quickSort: 'Orden rápido',
  recent: 'Viviendas vistas', recentHint: 'Hasta 8 viviendas abiertas en esta pestaña. Se borran al recargar, salir o cambiar de cuenta. No se guardan en tu cuenta.',
  clearRecent: 'Borrar historial de vistas', removeRecent: 'Quitar del historial', emptyRecent: 'Sin viviendas vistas', emptyHint: 'Abre un anuncio para volver a verlo aquí durante la navegación.',
  unavailable: 'Este anuncio ya no se puede consultar.', loadFailed: 'No se pudo cargar este anuncio. Las otras viviendas siguen disponibles.',
  returnSearch: 'Volver a buscar', recentLink: 'Volver a las viviendas que viste',
}
const fr: typeof en = {
  active: 'Filtres actifs', removeFilter: 'Retirer le filtre : {{label}}', owner: 'Annonces de cet annonceur', quickSort: 'Tri rapide',
  recent: 'Logements consultés', recentHint: 'Jusqu’à 8 logements ouverts dans cet onglet. La liste est effacée au rechargement, à la déconnexion ou au changement de compte. Elle n’est pas enregistrée sur votre compte.',
  clearRecent: 'Effacer l’historique', removeRecent: 'Retirer de l’historique', emptyRecent: 'Aucun logement consulté', emptyHint: 'Ouvrez une annonce pour la retrouver ici pendant votre navigation.',
  unavailable: 'Cette annonce ne peut plus être consultée.', loadFailed: 'Impossible de charger cette annonce. Les autres logements restent disponibles.',
  returnSearch: 'Revenir à la recherche', recentLink: 'Retrouver les logements consultés',
}
for (const [lang, values] of Object.entries({en, he, es, fr})) i18n.addResourceBundle(lang, 'catalogTools', values, true, true)
