import{Link}from'react-router-dom'
import{useTranslation}from'react-i18next'
import{useReturnNotifications}from'./useReturnNotifications'
export function ReturnNotifications(){const{t,i18n}=useTranslation('returnTools'),{alerts,visits}=useReturnNotifications();return <div className="space-y-2">{!!alerts.data?.some(a=>!a.seenAt)&&<Link className="block rounded-lg bg-primary/10 p-3 text-sm text-primary" to="/saved-searches">{t('alerts')} · {alerts.data.filter(a=>!a.seenAt).length}</Link>}{visits.data?.map(v=><Link key={v.id} className="block rounded-lg bg-primary/10 p-3 text-sm text-primary" to="/visits">{t('visitSoon')} · {new Date(v.startsAt).toLocaleString(i18n.language,{dateStyle:'short',timeStyle:'short'})}</Link>)}</div>}
