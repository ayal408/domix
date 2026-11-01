import { dataClient } from '@/api/http'

export interface GoogleAuthConfig { clientId: string }

export async function getGoogleAuthConfig(): Promise<GoogleAuthConfig> {
  const { data } = await dataClient.get<GoogleAuthConfig>('/config/google')
  return data
}
