import { useState } from 'react'
import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { ContactDetailsFields } from './ContactDetailsFields'
import { EMPTY_CONTACT, withContactDetails } from './contactDetails'
import { contactOwnerSchema, type ContactOwnerFormValues } from './schemas'
import { useReplyMessage } from '@/hooks/useMessages'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey } from '@/api/errors'
import { TextareaField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import type { Message } from '@/types/api'
export function ReplyMessageDialog({ message, onClose }: { message: Message; onClose: () => void }) {
  const { t } = useTranslation()
  const [contact, setContact] = useState(EMPTY_CONTACT)
  const reply = useReplyMessage()
  const push = useToastStore(state => state.push)
  const { register, handleSubmit, setError, formState: { errors } } = useForm<ContactOwnerFormValues>({ resolver: zodResolver(contactOwnerSchema), defaultValues: { content: '' } })
  async function send(values: ContactOwnerFormValues) {
    const content = withContactDetails(values.content, contact, { email: t('privateMessages:email'), phone: t('privateMessages:phone') })
    const validation = contactOwnerSchema.safeParse({ content })
    if (!validation.success) { setError('content', { message: validation.error.issues[0]?.message }); return }
    try {
      await reply.mutateAsync({ messageId: message.messageId, content })
      push({ variant: 'success', title: t('privateMessages:sent') }); onClose()
    } catch (error) { push({ variant: 'error', title: t(errorTranslationKey(error)) }) }
  }
  return <Dialog open onClose={() => { if (!reply.isPending) onClose() }} className="relative z-50">
    <DialogBackdrop className="fixed inset-0 bg-black/50" />
    <div className="fixed inset-0 flex items-center justify-center p-4">
      <DialogPanel className="domix-scroll-panel w-full max-w-xl rounded-xl border border-border bg-card p-5 text-foreground shadow-xl">
        <DialogTitle className="text-lg font-semibold">{t('privateMessages:replyTitle')}</DialogTitle>
        <p className="mt-2 text-sm text-muted">{t('privateMessages:privacy')}</p>
        <blockquote className="my-3 max-h-28 overflow-y-auto whitespace-pre-wrap break-words rounded bg-card-muted p-3 text-sm">{message.content}</blockquote>
        <form className="flex flex-col gap-3" onSubmit={handleSubmit(send)}>
          <TextareaField label={t('messages.contact.label')} maxLength={2000} rows={4} error={errors.content?.message} {...register('content')} />
          <ContactDetailsFields value={contact} onChange={setContact} />
          <div className="flex flex-wrap gap-2"><Button type="submit" loading={reply.isPending}>{t('messages.contact.send')}</Button><Button type="button" variant="secondary" disabled={reply.isPending} onClick={onClose}>{t('common.cancel')}</Button></div>
        </form>
      </DialogPanel>
    </div>
  </Dialog>
}
