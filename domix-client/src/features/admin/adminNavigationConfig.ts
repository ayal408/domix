import type { MarketIconName } from '@/components/ui/MarketIcon'
import type { Role } from '@/types/api'

export interface AdminNavItem { key:string; to:string; icon:MarketIconName; adminOnly?:boolean }
export interface AdminNavGroup { key:string; items:AdminNavItem[] }

const groups: AdminNavGroup[] = [
  {key:'overview',items:[{key:'dashboard',to:'/admin',icon:'grid'}]},
  {key:'operations',items:[{key:'listings',to:'/admin/apartments',icon:'home'},{key:'moderation',to:'/admin/reports',icon:'list'}]},
  {key:'community',items:[{key:'support',to:'/admin/support',icon:'message'},{key:'notifications',to:'/admin/notifications',icon:'bell'}]},
  {key:'system',items:[{key:'analytics',to:'/admin/analytics',icon:'grid'},{key:'users',to:'/admin/users',icon:'user',adminOnly:true},{key:'email',to:'/admin/email',icon:'message',adminOnly:true}]},
]

export function adminGroupsFor(role:Role|undefined):AdminNavGroup[] {
  if (role !== 'Admin' && role !== 'Manager') return []
  return groups.map(group=>({...group,items:group.items.filter(item=>!item.adminOnly||role==='Admin')}))
}

export function activeAdminItem(pathname:string,role:Role|undefined):AdminNavItem|undefined {
  return adminGroupsFor(role).flatMap(group=>group.items).filter(item=>item.to==='/admin'?pathname==='/admin'||pathname==='/admin/':pathname===item.to||pathname.startsWith(item.to+'/')).sort((a,b)=>b.to.length-a.to.length)[0]
}
