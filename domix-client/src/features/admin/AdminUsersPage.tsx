import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAllUsers, useBlockUser, useUnblockUser, useDeleteAccount } from '@/hooks/useUser'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToastStore } from '@/stores/toast.store'
import { errorTranslationKey, toApiError } from '@/api/errors'
import { formatDate } from '@/lib/format'
import { useAuthStore } from '@/stores/auth.store'
import { usePresenceStore } from '@/stores/presence.store'
import type { Guid, UserResponse } from '@/types/api'

/** All registered users — Admin/Manager may view; only Admin may block/unblock (enforced server-side). */
export default function AdminUsersPage() {
  const { t, i18n } = useTranslation()
  const { data: users, isLoading } = useAllUsers()
  const blockMutation = useBlockUser()
  const unblockMutation = useUnblockUser()
  const deleteMutation = useDeleteAccount()
  const pushToast = useToastStore((state) => state.push)
  const currentUserId = useAuthStore((state) => state.user?.userId)
  const isAdmin = useAuthStore((state) => state.hasRole('Admin'))
  const activeUserCount = usePresenceStore((state) => state.activeUserCount)
  const [deleteTarget, setDeleteTarget] = useState<Guid | null>(null)

  async function handleToggleBlock(user: UserResponse) {
    try {
      if (user.isBlocked) {
        await unblockMutation.mutateAsync(user.userId)
      } else {
        await blockMutation.mutateAsync(user.userId)
      }
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget)
      pushToast({ variant: 'success', title: t('admin.users.deleteSuccess') })
      setDeleteTarget(null)
    } catch (error) {
      const apiError = toApiError(error)
      pushToast({ variant: 'error', title: t(errorTranslationKey(error), apiError.message) })
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('admin.users.title')}</h1>
          <p className="mt-1 text-sm text-muted">{t('admin.users.subtitle')}</p>
        </div>
        <Card className="flex items-center gap-2 px-3 py-2">
          <span className="relative flex h-2 w-2">
            {activeUserCount != null && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            )}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${activeUserCount != null ? 'bg-success' : 'bg-muted'}`} />
          </span>
          <span className="text-sm font-medium text-foreground">
            {activeUserCount != null ? t('admin.users.activeNow', { count: activeUserCount }) : t('admin.users.activeNowLoading')}
          </span>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : !users || users.length === 0 ? (
        <EmptyState title={t('admin.users.empty')} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-start text-sm">
            <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 text-start font-medium">{t('admin.users.table.user')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('admin.users.table.role')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('admin.users.table.status')}</th>
                <th className="px-4 py-3 text-start font-medium">{t('admin.users.table.joined')}</th>
                {isAdmin && <th className="px-4 py-3 text-end font-medium">{t('admin.apartments.table.actions')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.userId}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{user.userName}</p>
                    <p className="text-xs text-muted">{user.emailAddress ?? '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-foreground">{user.role}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {user.isBlocked && <Badge tone="danger">{t('admin.users.blocked')}</Badge>}
                      {!user.isEmailVerified && <Badge tone="neutral">{t('admin.users.unverified')}</Badge>}
                      {!user.isBlocked && user.isEmailVerified && <Badge tone="success">{t('admin.users.active')}</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDate(user.joiningDate, i18n.language)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        {user.userId !== currentUserId && (
                          <>
                            <Button
                              size="sm"
                              variant={user.isBlocked ? 'secondary' : 'danger'}
                              loading={blockMutation.isPending || unblockMutation.isPending}
                              onClick={() => handleToggleBlock(user)}
                            >
                              {user.isBlocked ? t('admin.users.unblock') : t('admin.users.block')}
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => setDeleteTarget(user.userId)}>
                              {t('common.delete')}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget != null}
        title={t('admin.users.deleteConfirmTitle')}
        description={t('admin.users.deleteConfirmDescription')}
        confirmLabel={t('common.delete')}
        cancelLabel={t('common.cancel')}
        destructive
        loading={deleteMutation.isPending}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
