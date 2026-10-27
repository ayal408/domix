import { beforeEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { dataClient } from '@/api/http'
import i18n from '@/i18n'
import { ApartmentSearchForm } from './ApartmentSearchForm'
vi.mock('@/hooks/useApartments', () => ({ useCities: () => ({ data: ['Jerusalem', 'Haifa'] }) }))
vi.mock('@/api/http', () => ({ dataClient: { get: vi.fn() } }))
beforeEach(async () => { vi.resetAllMocks(); await i18n.changeLanguage('en'); vi.mocked(dataClient.get).mockResolvedValue({ data: ['Center', 'Carmel'] }) })
function open(props: Partial<Parameters<typeof ApartmentSearchForm>[0]> = {}) {
  const submit = vi.fn(), clear = vi.fn()
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><ApartmentSearchForm onSubmit={submit} onClear={clear} {...props} /></QueryClientProvider>)
  return { submit, clear }
}
it('uses dropdowns for every filter and submits numeric and negative boolean choices accurately', async () => {
  const { submit } = open(); const user = userEvent.setup()
  expect(screen.getAllByRole('combobox')).toHaveLength(10); expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Min price'), '2000'); await user.selectOptions(screen.getByLabelText('Min rooms'), '2.5')
  await user.selectOptions(screen.getByLabelText('Parking'), 'false'); await user.selectOptions(screen.getByLabelText('Elevator'), 'true')
  await user.click(screen.getByRole('button', { name: 'Apply filters' }))
  await waitFor(() => expect(submit).toHaveBeenCalled())
  expect(submit.mock.calls[0]![0]).toMatchObject({ minPrice: 2000, minRooms: 2.5, parking: false, elevator: true })
})
it('preserves saved custom bounds and clears the area when city changes', async () => {
  open({ initialValues: { city: 'Jerusalem', area: 'Old area', minPrice: 3333, maxRooms: 11.5 } }); const user = userEvent.setup()
  expect(screen.getByLabelText('Min price')).toHaveValue('3333'); expect(screen.getByLabelText('Max rooms')).toHaveValue('11.5')
  await user.selectOptions(screen.getByLabelText('City'), 'Haifa')
  expect(screen.getByLabelText('Area / neighbourhood')).toHaveValue('')
  await waitFor(() => expect(dataClient.get).toHaveBeenCalledWith('/Apartment/areas', expect.objectContaining({ params: { city: 'Haifa' } })))
})
it('clears dropdowns without turning any amenity into a negative filter', async () => {
  const { clear, submit } = open({ initialValues: { parking: false, minPrice: 2000 } }); const user = userEvent.setup()
  await user.click(screen.getByRole('button', { name: 'Clear filters' })); expect(clear).toHaveBeenCalled()
  expect(screen.getByLabelText('Parking')).toHaveValue(''); expect(screen.getByLabelText('Min price')).toHaveValue('')
  await user.click(screen.getByRole('button', { name: 'Apply filters' })); await waitFor(() => expect(submit).toHaveBeenCalled())
  expect(submit.mock.calls[0]![0].parking).toBeUndefined()
})
