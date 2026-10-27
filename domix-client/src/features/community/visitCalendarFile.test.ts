import{expect,it}from'vitest'
import{visitCalendarFile}from'./visitCalendarFile'
import type{CalendarVisit}from'./returnApi'
const visit:CalendarVisit={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',conversationId:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',startsAt:'2026-11-01T10:30:00Z',updatedAt:'2026-10-28T10:00:00Z',revision:'rev',status:'Accepted',proposedByMe:false,reminderEnabled:true}
it('exports UTC times and a stable event identity, without inventing a visit duration or copying personal data',()=>{
 const extra={...visit,address:'private street',phone:'0501234567',personName:'Private name'}
 const text=visitCalendarFile(extra,'ביקור בדירה','http://localhost:8081');const unfolded=text.replaceAll('\r\n ','')
 expect(unfolded).toContain('DTSTART:20261101T103000Z');expect(unfolded).toContain(`UID:${visit.id}@domix`);expect(text).toContain('TRIGGER:-PT1H');expect(text).not.toContain('DTEND');expect(text).not.toContain('private street');expect(text).not.toContain('0501234567');expect(text).not.toContain('Private name')
 expect(unfolded).toContain(`/messages?thread=${visit.conversationId}`)
})
it('folds UTF-8 lines and escapes title text so it cannot introduce calendar properties',()=>{
 const text=visitCalendarFile(visit,'תזכורת '.repeat(30)+'\nBEGIN:VEVENT;test,yes','https://domix.example')
 for(const line of text.split('\r\n'))expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
 const unfolded=text.replaceAll('\r\n ','');expect(unfolded.match(/\r\nBEGIN:VEVENT/g)).toHaveLength(1);expect(unfolded).toContain('\\nBEGIN:VEVENT\\;test\\,yes')
})
