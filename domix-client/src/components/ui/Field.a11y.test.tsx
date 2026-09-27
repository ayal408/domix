import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { InputField, TextareaField, SelectField, CheckboxField } from './Field'

// Field.tsx is the shared label/error/aria wiring behind every form control in the app (auth,
// apartment listing, account settings, ...) — one violation-free check here rules out the most
// common form a11y failure (a control with no accessible label) everywhere it's used.
describe('Field components accessibility', () => {
  test('InputField with an error has no axe violations', async () => {
    const { container } = render(
      <InputField label="Email" type="email" required error="Enter a valid email address" />,
    )
    expect((await axe(container)).violations).toEqual([])
  })

  test('TextareaField has no axe violations', async () => {
    const { container } = render(<TextareaField label="Description" hint="Up to 500 characters" />)
    expect((await axe(container)).violations).toEqual([])
  })

  test('SelectField has no axe violations', async () => {
    const { container } = render(
      <SelectField label="Property type">
        <option value="apartment">Apartment</option>
        <option value="house">House</option>
      </SelectField>,
    )
    expect((await axe(container)).violations).toEqual([])
  })

  test('CheckboxField has no axe violations', async () => {
    const { container } = render(<CheckboxField label="Has parking" />)
    expect((await axe(container)).violations).toEqual([])
  })
})
