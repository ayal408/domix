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
  ownerId: Guid
  senderId: Guid
}

/** Contact-the-owner form shown on a listing's detail page. */
export function ContactOwnerForm({ ownerId, senderId }: Props) {
  const { t } = useTranslation()
  const sendMessage = useSendMessage()
  const pushToast = useToastStore((state) => state.push)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ContactOwnerFormValues>({
    resolver: zodResolver(contactOwnerSchema),
    defaultValues: { content: '' },
  })

  async function onSubmit(values: ContactOwnerFormValues) {
    try {
      await sendMessage.mutateAsync({ senderId, ownerId, content: values.content })
      reset({ content: '' })
      pushToast({ variant: 'success', title: t('messages.contact.sent') })
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="text-base font-semibold text-foreground">{t('messages.contact.title')}</h2>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
        <TextareaField
          label={t('messages.contact.label')}
          placeholder={t('messages.contact.placeholder')}
          error={errors.content?.message}
          {...register('content')}
        />
        <Button type="submit" loading={sendMessage.isPending} className="self-start">
          {t('messages.contact.send')}
        </Button>
      </form>
    </Card>
  )
}
