import { useRenewals } from './useRenewals'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { useFlowAction } from './api'
export function RenewalReminders({compact=false}:{compact?:boolean}){
 const{t}=useTranslation('workflows'),rows=useRenewals(),action=useFlowAction()
 if(!rows.data?.length)return null
 if(compact)return <Link to="/my-apartments" className="my-2 block rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm text-primary">{t('renewalBell')} · {rows.data.length}</Link>
 return <section className="rounded-xl border border-primary/30 bg-card p-4"><h2 className="font-semibold">{t('renewals')}</h2><p className="my-2 text-sm text-muted">{t('renewalHint')}</p><div className="flex flex-col gap-2">{rows.data.map(a=><div key={a.apartmentId} className="flex flex-wrap items-center gap-2 rounded bg-card-muted p-3"><Link to={`/apartments/${a.apartmentId}`} className="me-auto text-sm text-primary underline">{a.city} · {a.area}</Link><Button size="sm" disabled={action.isPending} onClick={()=>action.mutate({path:`/community/renewals/${a.apartmentId}`,body:{snooze:false}})}>{t('renew')}</Button><Button size="sm" variant="secondary" disabled={action.isPending} onClick={()=>action.mutate({path:`/community/renewals/${a.apartmentId}`,body:{snooze:true}})}>{t('snooze')}</Button></div>)}</div></section>
}
