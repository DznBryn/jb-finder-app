"use client";

import Link from "next/link";
import { Briefcase, Home, LineChart, ListChecks, UserPlus } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";


export default function AppSidebar() {
  return (
    <Sidebar collapsible="icon" className="bg-transparent">
      <SidebarHeader className="bg-transparent px-2 py-2">
        <SidebarTrigger className="text-slate-200 hover:bg-slate-800/60" />
      </SidebarHeader>
      <SidebarContent className="bg-transparent">
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-400">Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive
                  tooltip="Home"
                  className="text-slate-200 hover:bg-slate-800/60 data-[active=true]:bg-slate-800/70"
                >
                  <Link
                    href="/"
                    className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                  >
                    <Home className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      Home
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Assisted apply"
                  className="text-slate-200 hover:bg-slate-800/60"
                >
                  <Link
                    href="/apply"
                    className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                  >
                    <ListChecks className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      Assisted apply
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Analysis"
                  className="text-slate-200 hover:bg-slate-800/60"
                >
                  <Link
                    href="/analysis"
                    className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                  >
                    <LineChart className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      Analysis
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-400">Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip="Job details"
                  className="text-slate-200 hover:bg-slate-800/60"
                >
                  <Link
                    href="/jobs"
                    className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      Job details
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="bg-transparent px-2 pb-3">
        <Button
          className="w-full justify-start gap-2 border-slate-700/60 text-slate-200 hover:bg-slate-800/60 group-data-[collapsible=icon]:justify-center"
          variant="outline"
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
        >
          <UserPlus className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
