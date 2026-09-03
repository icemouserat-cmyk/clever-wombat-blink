import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings, 
  DollarSign, 
  BrainCircuit,
  LogOut
} from 'lucide-react';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel, 
  SidebarHeader, 
  SidebarMenu, 
  SidebarMenuButton, 
  SidebarMenuItem 
} from '@/components/ui/sidebar';
import { Outlet, NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Inquiries',
    url: '/inquiries',
    icon: Users,
  },
  {
    title: 'Quotations',
    url: '/quotations',
    icon: FileText,
  },
  {
    title: 'Pricing',
    url: '/settings/pricing',
    icon: DollarSign,
  },
  {
    title: 'AI Config',
    url: '/settings/ai',
    icon: BrainCircuit,
  },
];

export default function MainLayout() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-slate-50/50">
        <Sidebar variant="sidebar" collapsible="icon" className="border-r border-slate-200">
          <SidebarHeader className="p-6">
            <div className="flex items-center gap-3 font-extrabold text-2xl tracking-tight text-indigo-900">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-50">
                A
              </div>
              <span className="group-data-[collapsible=icon]:hidden font-black">AuraSpace</span>
            </div>
          </SidebarHeader>
          <SidebarContent className="px-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-slate-400 text-xs uppercase tracking-wider font-bold px-3 mb-2">Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <NavLink 
                          to={item.url} 
                          className={({ isActive }) => `
                            flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200
                            ${isActive 
                              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100' 
                              : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-600'}
                          `}
                        >
                          <item.icon className={`w-5 h-5 ${item.url === '/' ? 'text-inherit' : ''}`} />
                          <span className="font-semibold">{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <div className="p-4 mt-auto border-t border-slate-100">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-500 transition-all duration-200 group">
                    <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    <span className="font-semibold">Logout</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </Sidebar>
        <main className="flex-1 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
