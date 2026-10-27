import { Link } from 'react-router-dom'
import '@/features/community/workflows.i18n'
import { useState } from 'react'
import { ContactDetailsFields } from './ContactDetailsFields'
import { EMPTY_CONTACT, withContactDetails } from './contactDetails'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { useSendMessage } from '@/hooks/useMessages'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { contactOwnerSchema, type ContactOwnerFormValues } from '@/features/messages/schemas'
import { TextareaField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import type { Guid } from '@/types/api'

interface Props {
  isAnonymous?: boolean
  apartmentId: Guid
  listingAddress: string
  offeredApartmentId?: Guid
  exchangeStart?: string
  exchangeEnd?: string
  ownerId: Guid
  senderId: Guid
}

/** Contact-the-owner form shown on a listing's detail page. */
export function ContactOwnerForm({ isAnonymous, ownerId, senderId, apartmentId, listingAddress, offeredApartmentId, exchangeStart, exchangeEnd }: Props) {
  const { t } = useTranslation()
  const [sentThread, setSentThread] = useState<string | null>(null)
  const [contact, setContact] = useState(EMPTY_CONTACT)
  const sendMessage = useSendMessage()
  const pushToast = useToastStore((state) => state.push)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ContactOwnerFormValues>({
    resolver: zodResolver(contactOwnerSchema),
    defaultValues: { content: '' },
  })

  async function onSubmit(values: ContactOwnerFormValues) {
    const content = withContactDetails(values.content, contact, { email: t('privateMessages:email'), phone: t('privateMessages:phone') })
    const validation = contactOwnerSchema.safeParse({ content })
    if (!validation.success) { setError('content', { message: validation.error.issues[0]?.message }); return }
    try {
      const sent = await sendMessage.mutateAsync({ senderId, ownerId, apartmentId, offeredApartmentId, exchangeStart: offeredApartmentId ? exchangeStart : undefined, exchangeEnd: offeredApartmentId ? exchangeEnd : undefined, content })
      setSentThread(sent.conversationId ?? null)
      reset({ content: '' }); setContact(EMPTY_CONTACT)
      pushToast({ variant: 'success', title: t('messages.contact.sent') })
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  return (
    <Card id="contact-owner" className="flex scroll-mt-24 flex-col gap-3 p-4">
      <h2 className="text-base font-semibold text-foreground">{t('messages.contact.title')}</h2>
      <p className="text-sm text-muted">{t('exchange.regarding')}: {listingAddress}</p>
      {isAnonymous && <p className="text-sm text-muted">{t('privateMessages:privacy')}</p>}
      {exchangeStart && <p className="text-sm text-muted">{t('discovery.contactHint')}</p>}
      {offeredApartmentId && <p className="text-sm">{t('exchange.proposalDates')}: {exchangeStart} — {exchangeEnd}</p>}
      {sentThread && <Link className="text-primary underline" to={`/messages?thread=${sentThread}`}>{t('workflows:continue')}</Link>}
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <TextareaField
          label={t('messages.contact.label')}
          placeholder={t('messages.contact.placeholder')}
          error={errors.content?.message}
          {...register('content')}
        />
        <ContactDetailsFields value={contact} onChange={setContact} />
        <Button type="submit" loading={sendMessage.isPending} className="self-start">
          {t('messages.contact.send')}
        </Button>
      </form>
    </Card>
  )
}
