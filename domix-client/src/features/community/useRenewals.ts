import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { dataClient } from '@/api/http'
export function useRenewals(){const user=useAuthStore(s=>s.user);return useQuery({queryKey:['community','renewals',user?.userId],queryFn:async({signal})=>(await dataClient.get<{apartmentId:string;city:string;area:string}[]>('/community/renewals',{signal})).data,enabled:!!user,refetchInterval:5*60*1000})}
