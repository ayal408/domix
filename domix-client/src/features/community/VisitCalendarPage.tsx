import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { useReturnQuery, useReturnAction, type CalendarVisit } from './returnApi'
import { visitCalendarFile } from './visitCalendarFile'

export default function VisitCalendarPage() {
  const { t, i18n } = useTranslation('returnTools'),
    [month, M] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const through = new Date(month.getFullYear(), month.getMonth() + 1, 1),
    rows = useReturnQuery<CalendarVisit[]>(
      ['visits', month.toISOString()],
      `/return-tools/visits?from=${encodeURIComponent(month.toISOString())}&through=${encodeURIComponent(through.toISOString())}`
    ),
    action = useReturnAction();
  return <section className="mx-auto flex max-w-3xl flex-col gap-4">
    <h1 className="text-2xl font-bold">{t('calendar')}</h1>
    <p className="text-sm text-muted">{t('calendarHint')}</p>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button variant="secondary" onClick={() => M(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>{t('previousMonth')}</Button>
      <h2 className="font-semibold">{month.toLocaleDateString(i18n.language, { month: 'long', year: 'numeric' })}</h2>
      <Button variant="secondary" onClick={() => M(through)}>{t('nextMonth')}</Button>
    </div>
    {rows.isError ? <p role="alert">{t('workflows:loadError')}</p>
      : rows.isLoading ? <p>{t('translation:common.loading')}</p>
      : !rows.data?.length ? <p>{t('emptyVisits')}</p>
      : rows.data.map(v => <article key={v.id} className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
        <h3 className="font-semibold">{new Date(v.startsAt).toLocaleString(i18n.language, { dateStyle: 'full', timeStyle: 'short' })}</h3>
        <p>{t(`workflows:${v.status}`)}</p>
        <div className="flex flex-wrap gap-2">
          <Link className="text-primary underline" to={`/messages?thread=${v.conversationId}`}>{t('workflows:open')}</Link>
          {v.status === 'Accepted' && <>
            <Button size="sm" variant="secondary" onClick={() => {
              const file = new Blob([visitCalendarFile(v, t('workflows:visits'), location.origin)], { type: 'text/calendar;charset=utf-8' }),
                url = URL.createObjectURL(file),
                a = document.createElement('a');
              a.href = url;
              a.download = `domix-visit-${v.id}.ics`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(url), 1000)
            }}>{t('calendarFile')}</Button>
            <Button size="sm" variant="ghost" disabled={action.isPending}
              onClick={() => action.mutate({ path: `/return-tools/visits/${v.id}/reminder`, body: { enabled: !v.reminderEnabled, revision: v.revision } })}>
              {t(v.reminderEnabled ? 'reminderOff' : 'reminderOn')}
            </Button>
          </>}
        </div>
      </article>)}
  </section>
}
