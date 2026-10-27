import { useTranslation } from 'react-i18next'
import { CheckboxField, InputField } from '@/components/ui/Field'
import './private-messages.i18n'
import type { ContactDetails } from './contactDetails'
export function ContactDetailsFields({ value, onChange }: { value: ContactDetails; onChange: (value: ContactDetails) => void }) {
  const { t } = useTranslation('privateMessages')
  return <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
    <CheckboxField label={t('share')} checked={value.share} onChange={event => onChange({ ...value, share: event.target.checked })} />
    {value.share && <><p className="text-xs text-muted">{t('shareHint')}</p><div className="grid gap-3 sm:grid-cols-2">
      <InputField label={t('email')} type="email" dir="ltr" maxLength={254} value={value.email} onChange={event => onChange({ ...value, email: event.target.value })} />
      <InputField label={t('phone')} type="tel" dir="ltr" maxLength={40} value={value.phone} onChange={event => onChange({ ...value, phone: event.target.value })} />
    </div></>}
  </div>
}
