import './workflows.i18n'
import { expect,it,vi } from 'vitest'
import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { VisitPlanner } from './VisitPlanner'
import { useFlowQuery,useFlowAction } from './api'
vi.mock('./api',()=>({useFlowQuery:vi.fn(),useFlowAction:vi.fn()}))
const visit={id:'v1',startsAt:'2099-01-02T10:00:00Z',status:'Pending',revision:'rev1',proposedByMe:false,expired:false,updatedAt:'2099-01-01T10:00:00Z'}
it('allows only the other participant to confirm, passing the displayed revision',async()=>{
 const send=vi.fn().mockResolvedValue({});vi.mocked(useFlowQuery).mockReturnValue({data:[visit]} as unknown as ReturnType<typeof useFlowQuery>);vi.mocked(useFlowAction).mockReturnValue({mutateAsync:send,isPending:false} as unknown as ReturnType<typeof useFlowAction>)
 const{rerender}=render(<VisitPlanner thread="thread" canMessage/>);await userEvent.click(screen.getByRole('button',{name:'Confirm'}));await waitFor(()=>expect(send).toHaveBeenCalledWith({path:'/conversations/thread/visits/v1',body:{action:'Accept',revision:'rev1',startsAt:undefined}}))
 vi.mocked(useFlowQuery).mockReturnValue({data:[{...visit,proposedByMe:true}]} as unknown as ReturnType<typeof useFlowQuery>);rerender(<VisitPlanner thread="thread" canMessage/>);expect(screen.queryByRole('button',{name:'Confirm'})).not.toBeInTheDocument()
})
it('keeps cancellation available while blocking new proposals and confirmations',()=>{
 vi.mocked(useFlowQuery).mockReturnValue({data:[visit]} as unknown as ReturnType<typeof useFlowQuery>);vi.mocked(useFlowAction).mockReturnValue({isPending:false} as ReturnType<typeof useFlowAction>)
 render(<VisitPlanner thread="thread" canMessage={false}/>);expect(screen.queryByRole('button',{name:'Confirm'})).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Suggest another time'})).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Cancel visit'})).toBeInTheDocument()
})
