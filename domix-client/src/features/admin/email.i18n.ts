import i18n from '@/i18n'

const en = {
  nav: 'System email', title: 'System email sender',
  subtitle: 'This Gmail account sends all verification, password reset and notification emails from DOMIX.',
  account: 'Sending account', connected: 'Connected', disconnected: 'Not connected',
  connect: 'Connect Gmail', switchAccount: 'Change Gmail account', disconnect: 'Disconnect',
  confirmDisconnect: 'Disconnect the system sender? Verification and notification emails will stop until you reconnect.',
  noKeys: 'Google mail connection is not configured on the server.',
  senderName: 'Sender name', replyTo: 'Reply-to address (optional)', signature: 'Signature (optional)',
  save: 'Save sender settings', saved: 'Sender settings saved.',
  testTitle: 'Send a test email', recipient: 'Test recipient', sendTest: 'Send test email', sent: 'Test email sent.',
  template: 'Test email template', subject: 'Subject', body: 'Message',
  templateHint: 'You can use {{DateTime}} and {{Email}} placeholders.',
  history: 'Recent email deliveries', emptyHistory: 'No email deliveries recorded yet.',
  date: 'Date', to: 'Recipient', status: 'Status', success: 'Sent', failure: 'Failed',
  consentSuccess: 'Gmail account connected. It is now the sender for all system emails.',
  consentFailed: 'Gmail connection was canceled or failed. Your previous sender settings were kept.',
  disconnectedSuccess: 'System sender disconnected.', error: 'The operation failed. Please try again.', retry: 'Retry',
  errors: {
    EMAIL_NOT_CONFIGURED: 'Connect a Gmail account before sending email.',
    EMAIL_SEND_FAILED: 'Google rejected the send request or could not be reached. Check the connection and try again.',
    EMAIL_INVALID_SETTINGS: 'Check the sender name and reply-to address.',
  },
}
const he = {
  nav: 'מיילים מהמערכת', title: 'חשבון השולח של המערכת',
  subtitle: 'חשבון Gmail זה ישלח את כל מיילי האימות, איפוס הסיסמה וההתראות של DOMIX.',
  account: 'חשבון לשליחה', connected: 'מחובר', disconnected: 'לא מחובר',
  connect: 'חיבור Gmail', switchAccount: 'החלפת חשבון Gmail', disconnect: 'ניתוק',
  confirmDisconnect: 'לנתק את חשבון השולח? מיילי האימות וההתראות לא יישלחו עד לחיבור מחדש.',
  noKeys: 'חיבור Google לשליחת מיילים עדיין לא הוגדר בשרת.',
  senderName: 'שם השולח', replyTo: 'כתובת לתשובות (לא חובה)', signature: 'חתימה (לא חובה)',
  save: 'שמירת הגדרות השולח', saved: 'הגדרות השולח נשמרו.',
  testTitle: 'שליחת מייל בדיקה', recipient: 'כתובת לקבלת הבדיקה', sendTest: 'שליחת בדיקה', sent: 'מייל הבדיקה נשלח.',
  template: 'תבנית למייל בדיקה', subject: 'נושא', body: 'תוכן ההודעה',
  templateHint: 'אפשר להשתמש במשתנים {{DateTime}} ו־{{Email}}.',
  history: 'שליחות אחרונות', emptyHistory: 'עדיין לא נרשמו שליחות.',
  date: 'תאריך', to: 'נמען', status: 'מצב', success: 'נשלח', failure: 'נכשל',
  consentSuccess: 'חשבון Gmail חובר. הוא ישמש לשליחת כל המיילים מהמערכת.',
  consentFailed: 'חיבור Gmail בוטל או נכשל. הגדרות השולח הקודמות נשמרו.',
  disconnectedSuccess: 'חשבון השולח נותק.', error: 'הפעולה נכשלה. נסי שוב.', retry: 'ניסיון נוסף',
  errors: {
    EMAIL_NOT_CONFIGURED: 'יש לחבר חשבון Gmail לפני שליחת מיילים.',
    EMAIL_SEND_FAILED: 'Google דחה את השליחה או שלא ניתן להתחבר אליו. בדקי את החיבור ונסי שוב.',
    EMAIL_INVALID_SETTINGS: 'בדקי את שם השולח ואת כתובת המענה.',
  },
}
const es = {
  ...en, nav: 'Correo del sistema', title: 'Remitente del sistema',
  subtitle: 'Esta cuenta de Gmail envía los correos de verificación, recuperación de contraseña y notificaciones de DOMIX.',
  account: 'Cuenta remitente', connected: 'Conectada', disconnected: 'Sin conectar', connect: 'Conectar Gmail',
  switchAccount: 'Cambiar cuenta de Gmail', disconnect: 'Desconectar', senderName: 'Nombre del remitente',
  replyTo: 'Dirección de respuesta (opcional)', signature: 'Firma (opcional)', save: 'Guardar configuración',
  saved: 'Configuración guardada.', testTitle: 'Enviar correo de prueba', recipient: 'Destinatario de prueba',
  sendTest: 'Enviar prueba', sent: 'Correo de prueba enviado.', template: 'Plantilla de prueba', subject: 'Asunto', body: 'Mensaje',
  history: 'Envíos recientes', date: 'Fecha', to: 'Destinatario', status: 'Estado', success: 'Enviado', failure: 'Error',
}
const fr = {
  ...en, nav: 'E-mails système', title: 'Expéditeur du système',
  subtitle: 'Ce compte Gmail envoie tous les e-mails de vérification, de réinitialisation et de notification de DOMIX.',
  account: 'Compte expéditeur', connected: 'Connecté', disconnected: 'Non connecté', connect: 'Connecter Gmail',
  switchAccount: 'Changer de compte Gmail', disconnect: 'Déconnecter', senderName: 'Nom de l’expéditeur',
  replyTo: 'Adresse de réponse (facultatif)', signature: 'Signature (facultatif)', save: 'Enregistrer les paramètres',
  saved: 'Paramètres enregistrés.', testTitle: 'Envoyer un e-mail de test', recipient: 'Destinataire du test',
  sendTest: 'Envoyer le test', sent: 'E-mail de test envoyé.', template: 'Modèle de test', subject: 'Objet', body: 'Message',
  history: 'Envois récents', date: 'Date', to: 'Destinataire', status: 'État', success: 'Envoyé', failure: 'Échec',
}
for (const [language, resources] of Object.entries({ en, he, es, fr }))
  i18n.addResourceBundle(language, 'email', resources, true, true)
