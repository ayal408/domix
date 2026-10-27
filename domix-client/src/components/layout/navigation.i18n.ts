import i18n from '@/i18n'
for (const [language, values] of Object.entries({
  he: { menu: 'תפריט ניווט', more: 'עוד כלים', primary: 'ניווט ראשי', account: 'תפריט החשבון' },
  en: { menu: 'Navigation menu', more: 'More tools', primary: 'Main navigation', account: 'Account menu' },
  es: { menu: 'Menú de navegación', more: 'Más herramientas', primary: 'Navegación principal', account: 'Menú de cuenta' },
  fr: { menu: 'Menu de navigation', more: 'Autres outils', primary: 'Navigation principale', account: 'Menu du compte' },
})) i18n.addResourceBundle(language, 'navigation', values, true, true)
