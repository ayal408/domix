import { useEffect, useState } from 'react'
import { useSearchParams,Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dataClient } from '@/api/http'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { MessageItem } from '@/features/messages/MessageItem'
import { ContactDetailsFields } from '@/features/messages/ContactDetailsFields'
import { EMPTY_CONTACT,withContactDetails } from '@/features/messages/contactDetails'
import { TextareaField } from '@/components/ui/Field'
import { contactOwnerSchema } from '@/features/messages/schemas'
import type { Message } from '@/types/api'
import { useFlowQuery,useFlowAction,type Thread } from './api'
import { ReportDialog } from './ReportDialog'
import { VisitPlanner } from './VisitPlanner'
export function ConversationWorkspace(){
 const{t}=useTranslation('workflows'),[params,P]=useSearchParams(),id=params.get('thread');const[offset,O]=useState(0)
 const list=useFlowQuery<Thread[]>(['threads',offset],`/conversations?offset=${offset}`)
 return <div className="grid min-w-0 gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]"><aside className="flex flex-col gap-2"><h2 className="text-lg font-semibold">{t('threads')}</h2>{list.isError?<p role="alert">{t('loadError')}</p>:list.data?.length===0?<p className="text-sm text-muted">{t('noThreads')}</p>:list.data?.map(thread=><button key={thread.id} type="button" aria-pressed={thread.id===id} onClick={()=>P({thread:thread.id})} className={`rounded-lg border p-3 text-start ${thread.id===id?'border-primary bg-primary/10':'border-border bg-card'}`}><span className="block font-medium">{thread.apartmentSnapshot||t('unknownListing')}</span><span className="text-xs text-muted">{new Date(thread.lastAt).toLocaleString()}{thread.unread>0?` · ${thread.unread}`:''}</span></button>)}<div className="flex gap-2"><Button variant="secondary" size="sm" disabled={!offset} onClick={()=>O(Math.max(0,offset-30))}>{t('previous')}</Button><Button variant="secondary" size="sm" disabled={!list.data||list.data.length<30} onClick={()=>O(offset+30)}>{t('next')}</Button></div></aside>{id?<ThreadView key={id} id={id}/>:<p className="rounded-lg border border-border p-6 text-muted">{t('choose')}</p>}</div>
}
function ThreadView({id}:{id:string}){
 const{t}=useTranslation('workflows'),client=useQueryClient(),action=useFlowAction();const[cursors,C]=useState<string[]>([]),[content,S]=useState(''),[contact,K]=useState(EMPTY_CONTACT),[block,B]=useState(false),[report,R]=useState<string|null>(null),[error,E]=useState('')
 const before=cursors.at(-1),rows=useFlowQuery<Message[]>(['thread',id,before??''],`/conversations/${id}/messages${before?'?beforeId='+encodeURIComponent(before):''}`)
 const safety=useFlowQuery<{blockedByMe:boolean;canMessage:boolean}>(['safety',id],`/conversations/${id}/safety`)
 const newest=rows.data?.[0]?.messageId
 useEffect(()=>{if(!newest)return;let active=true;void dataClient.post(`/conversations/${id}/read`).then(()=>{if(active){void client.invalidateQueries({queryKey:['messages','workflows','threads']});void client.invalidateQueries({queryKey:['messages','unread-count']})}}).catch(()=>{});return()=>{active=false}},[id,newest,client])
 const canMessage=safety.data?.canMessage===true
 async function send(){const full=withContactDetails(content,contact,{email:t('privateMessages:email'),phone:t('privateMessages:phone')});const valid=contactOwnerSchema.safeParse({content:full});if(!valid.success){E('validation.messageRequired');return}try{await action.mutateAsync({path:`/conversations/${id}/messages`,body:{content:full}});S('');K(EMPTY_CONTACT);C([]);E('')}catch{/* draft retained */}}
 return <section className="flex min-w-0 flex-col gap-4"><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" disabled={!safety.data||action.isPending} onClick={()=>B(true)}>{t(safety.data?.blockedByMe?'unblock':'block')}</Button><Button variant="ghost" size="sm" onClick={()=>void rows.refetch()}>{t('refresh')}</Button>{rows.data?.[0]?.apartmentId&&<Link className="text-sm text-primary underline" to={`/apartments/${rows.data[0].apartmentId}`}>{t('exchange:viewListing',{defaultValue:t('open')})}</Link>}</div>
 {rows.isError?<p role="alert">{t('loadError')}</p>:<div className="domix-scroll-list flex flex-col gap-3 rounded-lg border border-border p-3">{[...(rows.data??[])].reverse().map(m=><div key={m.messageId} className={m.isMine?'ms-6':'me-6'}><p className="mb-1 text-xs text-muted">{t(m.isMine?'mine':'other')}</p><MessageItem message={m} onMarkRead={()=>{}} onDelete={()=>{}} hideActions/>{!m.isMine&&<Button size="sm" variant="ghost" onClick={()=>R(m.messageId)}>{t('report')}</Button>}</div>)}</div>}
 <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={!rows.data||rows.data.length<50} onClick={()=>{const last=rows.data?.at(-1);if(last)C([...cursors,last.messageId])}}>{t('older')}</Button><Button size="sm" variant="secondary" disabled={!cursors.length} onClick={()=>C(cursors.slice(0,-1))}>{t('newer')}</Button></div>
 {!canMessage&&safety.data&&<p role="status" className="text-sm text-muted">{t('blocked')}</p>}
 {canMessage&&<form className="flex flex-col gap-3 rounded-lg border border-border p-3" onSubmit={e=>{e.preventDefault();void send()}}><TextareaField label={t('message')} required maxLength={2000} value={content} onChange={e=>S(e.target.value)}/>{error&&<p role="alert" className="text-danger">{t('failed')}</p>}<ContactDetailsFields value={contact} onChange={K}/><Button type="submit" loading={action.isPending}>{t('send')}</Button></form>}
 <VisitPlanner thread={id} canMessage={canMessage}/>
 <ConfirmDialog open={block} title={t(safety.data?.blockedByMe?'unblock':'blockConfirm')} confirmLabel={t(safety.data?.blockedByMe?'unblock':'block')} cancelLabel={t('cancel')} loading={action.isPending} onCancel={()=>B(false)} onConfirm={async()=>{try{await action.mutateAsync({path:`/conversations/${id}/block`,body:{block:!safety.data?.blockedByMe}});B(false)}catch{/* keep confirmation */}}}/>
 {report&&<ReportDialog target={{messageId:report}} onClose={()=>R(null)}/>}</section>
}
