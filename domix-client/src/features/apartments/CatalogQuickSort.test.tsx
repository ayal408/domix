import { expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import ApartmentsCatalogPage from './ApartmentsCatalogPage'
vi.mock('@/hooks/useApartments',()=>({useApartmentPages:()=>({data:{pages:[[]]},isLoading:false,isError:false,hasNextPage:false})}))
vi.mock('./ApartmentSearchForm',()=>({ApartmentSearchForm:()=>null}))
vi.mock('./SaveSearchButton',()=>({SaveSearchButton:()=>null}))
function Navigation(){const location=useLocation(),navigate=useNavigate();return <><output data-testid="location">{location.search}</output><button onClick={()=>navigate(-1)}>Back</button></>}
it('sorts without losing active scope and restores the sort through browser history',async()=>{
  render(<MemoryRouter initialEntries={['/?city=Haifa&owner=advertiser&listingType=Rent&parking=false&minPrice=2000']}><ApartmentsCatalogPage/><Navigation/></MemoryRouter>)
  const sort=screen.getByRole('combobox',{name:'Quick sort'})
  await userEvent.selectOptions(sort,'price_asc')
  const params=new URLSearchParams(screen.getByTestId('location').textContent!)
  expect(params.get('sortBy')).toBe('price_asc');expect(params.get('owner')).toBe('advertiser');expect(params.get('listingType')).toBe('Rent');expect(params.get('parking')).toBe('false');expect(params.get('minPrice')).toBe('2000')
  await userEvent.click(screen.getByRole('button',{name:'Back'}))
  expect(sort).toHaveValue('newest');expect(new URLSearchParams(screen.getByTestId('location').textContent!).get('city')).toBe('Haifa')
})
