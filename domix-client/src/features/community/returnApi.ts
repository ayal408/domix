import{useMutation,useQuery,useQueryClient}from'@tanstack/react-query'
import{useTranslation}from'react-i18next'
import{dataClient}from'@/api/http'
import{useAuthStore}from'@/stores/auth.store'
import{useToastStore}from'@/stores/toast.store'
import{toApiError}from'@/api/errors'
import'./return.i18n'
export function useReturnQuery<T>(key:unknown[],path:string,enabled=true){const user=useAuthStore(s=>s.user);return useQuery({queryKey:['returnTools',user?.userId,...key],queryFn:async({signal})=>(await dataClient.get<T>(path,{signal})).data,enabled:!!user&&enabled,refetchInterval:60000})}
export function useReturnAction(){const client=useQueryClient(),push=useToastStore(s=>s.push),{t}=useTranslation('workflows');return useMutation({mutationFn:async({path,body}:{path:string;body?:unknown})=>(await dataClient.post(path,body??{})).data,onSuccess:async()=>{await Promise.all(['returnTools','savedSearches','messages','apartments'].map(key=>client.invalidateQueries({queryKey:[key]})))},onError:error=>push({variant:'error',title:t(toApiError(error).status===409?'conflict':'failed')})})}
export interface MatchAlert{id:string;savedSearchId:string;name:string;matchCount:number;createdAt:string;seenAt?:string}
export interface CalendarVisit{id:string;conversationId:string;startsAt:string;status:string;revision:string;updatedAt:string;proposedByMe:boolean;reminderEnabled:boolean}
export interface Lead{conversationId:string;apartmentId:string;apartmentSnapshot:string;lastAt:string;status:string;revision?:string;personName?:string}
