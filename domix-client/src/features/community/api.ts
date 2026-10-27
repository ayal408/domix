import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { dataClient } from '@/api/http'
import { useToastStore } from '@/stores/toast.store'
import { toApiError } from '@/api/errors'
import './workflows.i18n'
export function useFlowQuery<T>(key: unknown[], path: string, enabled = true) {
  return useQuery({ queryKey: ['messages','workflows',...key], queryFn: async ({signal}) => (await dataClient.get<T>(path,{signal})).data, enabled, refetchInterval: 30000 })
}
export function useFlowAction() {
  const client=useQueryClient(),push=useToastStore(s=>s.push),{t}=useTranslation('workflows')
  return useMutation({mutationFn: async ({path,body}:{path:string;body?:unknown})=>(await dataClient.post(path,body??{})).data,
    onSuccess:async()=>{await Promise.all([client.invalidateQueries({queryKey:['messages']}),client.invalidateQueries({queryKey:['apartments']}),client.invalidateQueries({queryKey:['community']})])},
    onError:error=>{push({variant:'error',title:t(toApiError(error).status===409?'conflict':'failed')});void client.invalidateQueries({queryKey:['messages']})}})
}
export interface Thread {id:string;lastAt:string;unread:number;apartmentId?:string|null;apartmentSnapshot?:string|null}
export interface Visit {id:string;startsAt:string;status:string;revision:string;updatedAt:string;proposedByMe:boolean;expired:boolean}
