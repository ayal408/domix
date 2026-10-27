export interface ContactDetails { share: boolean; email: string; phone: string }
export const EMPTY_CONTACT: ContactDetails = { share: false, email: '', phone: '' }
export function withContactDetails(content: string, details: ContactDetails, labels: { email: string; phone: string }) {
  return [content.trim(), ...(details.share ? [details.email.trim() && `${labels.email}: ${details.email.trim()}`, details.phone.trim() && `${labels.phone}: ${details.phone.trim()}`].filter(Boolean) : [])].join('\n\n')
}
