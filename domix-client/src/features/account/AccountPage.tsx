import { useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth.store'
import { useUpdateProfileImage } from '@/hooks/useUser'
import { useApartments } from '@/hooks/useApartments'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { base64ToImageSrc, initialsOf } from '@/lib/sanitize'
import { formatDate } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 4 * 1024 * 1024

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export default function AccountPage() {
  const { t, i18n } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const updateImage = useUpdateProfileImage()
  const pushToast = useToastStore((state) => state.push)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { data: apartments } = useApartments()
  const ownedCount = useMemo(
    () => apartments?.filter((apartment) => apartment.userId === user?.userId).length ?? 0,
    [apartments, user?.userId],
  )

  if (!user) return null

  const avatar = base64ToImageSrc(user.profileImageBase64)

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      pushToast({ variant: 'error', title: t('account.invalidType') })
      return
    }
    if (file.size > MAX_BYTES) {
      pushToast({ variant: 'error', title: t('account.tooLarge') })
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      await updateImage.mutateAsync({ profileImage: dataUrl })
      pushToast({ variant: 'success', title: t('account.photoUpdated') })
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t('account.title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('account.subtitle')}</p>
      </div>

      <Card className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:text-start">
        <div className="group relative shrink-0">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-border bg-card-muted text-2xl font-semibold text-muted">
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              initialsOf(user.userName)
            )}
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={updateImage.isPending}
            className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-100"
          >
            {updateImage.isPending ? t('account.uploading') : t('account.changePhoto')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
            <h2 className="text-lg font-semibold text-foreground">{user.userName}</h2>
            <Badge tone={user.role === 'Admin' ? 'primary' : user.role === 'Manager' ? 'warning' : 'neutral'}>
              {user.role}
            </Badge>
          </div>
          {user.emailAddress && <p className="text-sm text-muted">{user.emailAddress}</p>}
          {user.phoneNumber && <p className="text-sm text-muted">{user.phoneNumber}</p>}
          <p className="text-xs text-muted">{t('account.joined', { date: formatDate(user.joiningDate, i18n.language) })}</p>
        </div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-6">
        <div>
          <h2 className="text-base font-semibold text-foreground">{t('account.myListings')}</h2>
          <p className="mt-1 text-sm text-muted">{t('account.myListingsCount', { count: ownedCount })}</p>
        </div>
        <Link to="/my-apartments">
          <Button variant="secondary">{t('nav.myApartments')}</Button>
        </Link>
      </Card>

      <Card className="flex flex-col gap-4 p-6">
        <h2 className="text-base font-semibold text-foreground">{t('account.preferences')}</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-foreground">{t('nav.changeLanguage')}</span>
          <LanguageSwitcher />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-foreground">{t('theme.mode')}</span>
          <ThemeSwitcher />
        </div>
      </Card>
    </div>
  )
}
