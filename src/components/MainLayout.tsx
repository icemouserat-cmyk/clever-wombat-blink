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
import { Outlet } from 'react-router-dom';

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
      <div className="flex min-h-screen w-full bg-slate-50">
        <Sidebar variant="sidebar" collapsible="icon">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-2 font-bold text-xl text-indigo-900">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                A
              </div>
              <span className="group-data-[collapsible=icon]:hidden">AuraSpace</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel className="text-slate-500 font-medium">Operations</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {NAV_ITEMS.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild tooltip={item.title}>
                        <a href={item.url} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-indigo-50 transition-colors">
                          <item.icon className="w-5 h-5 text-slate-600" />
                          <span className="font-medium text-slate-700">{item.title}</span>
                        </a>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <div className="p-4 mt-auto">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <button className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-red-50 text-red-600 transition-colors">
                    <LogOut className="w-5 h-5" />
                    <span className="font-medium">Logout</span>
                  </button>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </div>
        </Sidebar>
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </SidebarProvider>
  );
}
