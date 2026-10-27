import { useState } from 'react'
import { Dialog,DialogPanel,DialogTitle,DialogBackdrop } from '@headlessui/react'
import { useTranslation } from 'react-i18next'
import { SelectField,TextareaField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useFlowAction } from './api'
export function ReportDialog({target,onClose}:{target:{messageId?:string;apartmentId?:string};onClose:()=>void}) {
  const{t}=useTranslation('workflows'),action=useFlowAction();const[reason,R]=useState('Spam'),[details,D]=useState('')
  return <Dialog open onClose={()=>{if(!action.isPending)onClose()}} className="relative z-50"><DialogBackdrop className="fixed inset-0 bg-black/50"/><div className="fixed inset-0 flex items-center justify-center p-4"><DialogPanel className="domix-scroll-panel w-full max-w-lg rounded-xl border border-border bg-card p-5 text-foreground"><DialogTitle className="text-lg font-semibold">{t('reportTitle')}</DialogTitle><p className="my-3 text-sm text-muted">{t('reportHint')}</p><form className="flex flex-col gap-3" onSubmit={async e=>{e.preventDefault();try{await action.mutateAsync({path:'/community/reports',body:{...target,reason,details}});onClose()}catch{/* draft retained */}}}><SelectField label={t('reason')} value={reason} onChange={e=>R(e.target.value)}>{['Spam','Harassment','Fraud','Inaccurate','Other'].map(r=><option key={r} value={r}>{t(r)}</option>)}</SelectField><TextareaField label={t('details')} value={details} onChange={e=>D(e.target.value)} maxLength={1000}/><div className="flex gap-2"><Button type="submit" loading={action.isPending}>{t('report')}</Button><Button type="button" variant="secondary" onClick={onClose} disabled={action.isPending}>{t('cancel')}</Button></div></form></DialogPanel></div></Dialog>
}
