import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { ActiveCatalogFilters } from './ActiveCatalogFilters'
import { numericCatalogParam } from './catalogFilterParams'
function Location() { const location=useLocation();return <output data-testid="location">{location.search}</output> }
function mount(search: string) { render(<MemoryRouter initialEntries={['/'+search]}><ActiveCatalogFilters/><Location/></MemoryRouter>) }
describe('active catalog filters', () => {
  it('removes dependent area with city while preserving price, owner, type and sorting', async () => {
    mount('?city=Haifa&area=Carmel&listingType=Rent&minPrice=0&parking=false&sortBy=price_asc&owner=advertiser')
    await userEvent.click(screen.getByRole('button',{name:'Remove filter: City: Haifa'}))
    const params=new URLSearchParams(screen.getByTestId('location').textContent!)
    expect(params.has('city')).toBe(false);expect(params.has('area')).toBe(false)
    expect(params.get('minPrice')).toBe('0');expect(params.get('parking')).toBe('false')
    expect(params.get('sortBy')).toBe('price_asc');expect(params.get('owner')).toBe('advertiser');expect(params.get('listingType')).toBe('Rent')
  })
  it('shows a negative amenity as an active filter and removes it without selecting yes', async () => {
    mount('?city=Haifa&parking=false')
    await userEvent.click(screen.getByRole('button',{name:'Remove filter: Parking: No'}))
    const params=new URLSearchParams(screen.getByTestId('location').textContent!)
    expect(params.has('parking')).toBe(false);expect(params.get('city')).toBe('Haifa')
  })
  it('ignores empty, invalid, negative and non-finite numeric bounds but keeps zero', () => {
    for(const raw of ['', ' ', 'NaN', 'Infinity', '-10']) expect(numericCatalogParam(new URLSearchParams({minPrice:raw}),'minPrice')).toBeUndefined()
    expect(numericCatalogParam(new URLSearchParams('minPrice=0'),'minPrice')).toBe(0)
  })
})
