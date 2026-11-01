import { useQuery } from '@tanstack/react-query'
import { getGoogleAuthConfig } from '@/api/config.api'
import { env } from '@/config/env'

export function useGoogleClientId() {
  const config = useQuery({
    queryKey: ['public-config', 'google-auth'],
    queryFn: getGoogleAuthConfig,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
  return config.data?.clientId?.trim() || env.googleClientId
}
