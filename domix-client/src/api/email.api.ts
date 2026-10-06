import { dataClient } from '@/api/http'
import { apiEndpoints } from '@/api/endpoints'

export interface EmailSettings {
  senderEmail: string
  senderName: string
  replyTo: string
  signature: string
  testSubject: string
  testBody: string
  connected: boolean
  oauthAvailable: boolean
  enabled: boolean
  updatedAt: string
}
export type EmailSettingsInput = Pick<EmailSettings, 'senderName' | 'replyTo' | 'signature' | 'testSubject' | 'testBody'>
export interface EmailDelivery {
  id: string
  recipient: string
  subject: string
  succeeded: boolean
  failureCode: string | null
  createdAt: string
}
export const getEmailSettings = async (): Promise<EmailSettings> =>
  (await dataClient.get<EmailSettings>(apiEndpoints.email.settings())).data
export const saveEmailSettings = async (input: EmailSettingsInput): Promise<EmailSettings> =>
  (await dataClient.put<EmailSettings>(apiEndpoints.email.settings(), input)).data
export const connectGmail = async (): Promise<{ authorizationUrl: string }> =>
  (await dataClient.post<{ authorizationUrl: string }>(apiEndpoints.email.connect())).data
export const disconnectGmail = async (): Promise<void> => { await dataClient.delete(apiEndpoints.email.disconnect()) }
export const sendTestEmail = async (recipient: string): Promise<void> => {
  await dataClient.post(apiEndpoints.email.sendTest(), { recipient })
}
export const getEmailHistory = async (): Promise<EmailDelivery[]> =>
  (await dataClient.get<EmailDelivery[]>(apiEndpoints.email.history())).data
