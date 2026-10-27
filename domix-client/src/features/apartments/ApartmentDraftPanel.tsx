import { useState } from 'react'
import{useTranslation}from'react-i18next'
import{Link}from'react-router-dom'
import{Button}from'@/components/ui/Button'
import type{useApartmentDraft}from'./useApartmentDraft'
import'@/features/community/return.i18n'
export function ApartmentDraftPanel({state,busy,onResume,onClose}:{state:ReturnType<typeof useApartmentDraft>;busy:boolean;onResume:()=>void;onClose:()=>void}){const{t}=useTranslation('returnTools'),[invalid,I]=useState(false);return <section className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-card-muted p-3"><p className="text-xs text-muted">{t('draftHint')}</p><p role="status" className="text-sm">{t(state.loading?'loadingDraft':state.saving?'draftSaving':state.error||'draftSaved')}</p>{state.draft?.publishedId&&<><p className="text-sm">{t('draftPublished')}</p><Link className="text-primary underline" to={`/apartments/${state.draft.publishedId}`}>{t('openListing')}</Link><div className="flex flex-wrap gap-2"><Button type="button" loading={busy} disabled={state.error==='draftConflict'} onClick={onResume}>{t('resumePhotos')}</Button><Button type="button" disabled={busy} variant="secondary" onClick={onClose}>{t('translation:common.close')}</Button></div></>}
 {!state.draft?.publishedId&&<label className="text-sm">{t('draftPhotos')}<input className="mt-1 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy||state.loading} onChange={async e=>{const files=Array.from(e.target.files??[]);e.target.value='';I(!await state.photos(files))}}/></label>}
 {invalid&&<p role="alert" className="text-sm text-danger">{t('draftInvalidPhotos')}</p>}
 {!!state.draft?.photos.length&&<ul className="space-y-1">{state.draft.photos.map(p=><li key={p.id} className="flex items-center justify-between gap-2 text-sm"><span className="truncate">{p.file.name}</span><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={()=>void state.removePhoto(p.id)}>{t('removePhoto')}</Button></li>)}</ul>}
 <Button type="button" size="sm" variant="ghost" className="self-start" disabled={busy||state.loading} onClick={()=>void state.clear()}>{t('draftClear')}</Button></section>}
