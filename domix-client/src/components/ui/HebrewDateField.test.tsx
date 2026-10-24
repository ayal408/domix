import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HebrewDateField } from './HebrewDateField'

const isoLocal = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
describe('Hebrew calendar date-only integration', () => {
  it('emits the local calendar date when choosing today, without shifting a day', async () => {
    const onChange = vi.fn()
    render(<HebrewDateField name="start" label="כניסה" value="" onChange={onChange} />)
    await userEvent.click(screen.getByLabelText('כניסה'))
    await userEvent.click(screen.getByRole('button', { name: 'היום' }))
    expect(onChange).toHaveBeenCalledWith(isoLocal(new Date()))
  })
  it('displays the same Hebrew day for a controlled ISO value in any timezone', () => {
    render(<HebrewDateField name="start" label="כניסה" value="2026-10-25" onChange={vi.fn()} />)
    // 25 October 2026 is 14 Cheshvan 5787, also in timezones west of UTC.
    expect((screen.getByLabelText('כניסה') as HTMLInputElement).value).toContain('יד חשוון')
  })
})
