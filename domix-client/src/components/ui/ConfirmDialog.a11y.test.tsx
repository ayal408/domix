import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import { axe } from 'vitest-axe'
import { ConfirmDialog } from './ConfirmDialog'

describe('ConfirmDialog accessibility', () => {
  test('has no axe violations while open', async () => {
    render(
      <ConfirmDialog
        open
        title="Delete listing?"
        description="This can't be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        destructive
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    // Headless UI's Dialog renders into a portal outside `container`, so scan `document.body`
    // (axe-core happily accepts a real DOM node, not just the render's own container).
    const results = await axe(document.body)
    expect(results.violations).toEqual([])
  })
})
