import i18n from '@/i18n'

const en = {
  selection: '{{count}} of {{max}} listings selected', open: 'Compare selected listings', freshness: 'Availability confirmation',
  hint: 'Choose up to 3 listings. Scroll within the table on small screens.',
  empty: 'Choose up to 3 listings using Compare on a listing card or its details page.',
  differences: 'Show differences only', same: 'The displayed details are identical.',
  unavailable: 'This listing is no longer available to view.', failed: 'Could not load this listing.',
  column: 'Listing {{index}}', availability: 'Entry / exchange date', through: 'Until',
  confirmed: 'Availability confirmed by the advertiser on {{date}}',
  stale: 'Last availability confirmation: {{date}} — check with the advertiser',
  unconfirmed: 'Availability has not been confirmed yet',
  note: 'Advertiser declaration only. This does not verify ownership or guarantee availability.',
  confirm: 'Confirm that my listing is still available', confirmedNow: 'Availability confirmation saved',
}
const he: typeof en = {
  selection: 'נבחרו {{count}} מתוך {{max}} דירות', open: 'השוואת הדירות שנבחרו', freshness: 'אישור זמינות',
  hint: 'אפשר לבחור עד 3 דירות. במסך קטן אפשר לגלול בתוך הטבלה לצדדים.',
  empty: 'בחרו עד 3 דירות בעזרת כפתור ההשוואה בכרטיס הדירה או בעמוד הפרטים שלה.',
  differences: 'הצגת הבדלים בלבד', same: 'הפרטים המוצגים זהים.',
  unavailable: 'המודעה כבר אינה זמינה לצפייה.', failed: 'לא ניתן לטעון את המודעה הזאת.',
  column: 'דירה {{index}}', availability: 'תאריך כניסה / החלפה', through: 'עד',
  confirmed: 'הזמינות אושרה על ידי המפרסם ב־{{date}}',
  stale: 'אישור הזמינות האחרון: {{date}} — כדאי לבדוק מול המפרסם',
  unconfirmed: 'זמינות המודעה טרם אושרה',
  note: 'הצהרת המפרסם בלבד. אינה אימות בעלות או הבטחה שהדירה זמינה.',
  confirm: 'אישור שהמודעה שלי עדיין זמינה', confirmedNow: 'אישור הזמינות נשמר',
}
const es: typeof en = {
  selection: '{{count}} de {{max}} anuncios seleccionados', open: 'Comparar selección', freshness: 'Confirmación de disponibilidad',
  hint: 'Elige hasta 3 anuncios. En pantallas pequeñas, desplaza la tabla horizontalmente.',
  empty: 'Elige hasta 3 anuncios con el botón Comparar de la tarjeta o los detalles.',
  differences: 'Mostrar solo diferencias', same: 'Los datos mostrados son iguales.',
  unavailable: 'Este anuncio ya no se puede consultar.', failed: 'No se pudo cargar este anuncio.',
  column: 'Anuncio {{index}}', availability: 'Fecha de entrada / intercambio', through: 'Hasta',
  confirmed: 'Disponibilidad confirmada por el anunciante el {{date}}',
  stale: 'Última confirmación: {{date}} — consulta al anunciante',
  unconfirmed: 'Disponibilidad aún sin confirmar',
  note: 'Declaración del anunciante. No verifica la propiedad ni garantiza disponibilidad.',
  confirm: 'Confirmar que mi anuncio sigue disponible', confirmedNow: 'Confirmación guardada',
}
const fr: typeof en = {
  selection: '{{count}} annonces sur {{max}} sélectionnées', open: 'Comparer la sélection', freshness: 'Confirmation de disponibilité',
  hint: 'Choisissez jusqu’à 3 annonces. Sur petit écran, faites défiler le tableau horizontalement.',
  empty: 'Choisissez jusqu’à 3 annonces avec Comparer sur la fiche ou la page de détails.',
  differences: 'Afficher seulement les différences', same: 'Les données affichées sont identiques.',
  unavailable: 'Cette annonce ne peut plus être consultée.', failed: 'Impossible de charger cette annonce.',
  column: 'Annonce {{index}}', availability: 'Date d’entrée / échange', through: 'Jusqu’au',
  confirmed: 'Disponibilité confirmée par l’annonceur le {{date}}',
  stale: 'Dernière confirmation : {{date}} — contactez l’annonceur',
  unconfirmed: 'Disponibilité pas encore confirmée',
  note: 'Déclaration de l’annonceur. Ne vérifie ni la propriété ni la disponibilité.',
  confirm: 'Confirmer que mon annonce est toujours disponible', confirmedNow: 'Confirmation enregistrée',
}
for (const [lang, values] of Object.entries({ en, he, es, fr })) i18n.addResourceBundle(lang, 'comparison', values, true, true)
