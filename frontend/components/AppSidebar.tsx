"use client";

import Link from "next/link";
import { Briefcase, Home, ListChecks, UserPlus } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";


export default function AppSidebar() {
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Platform</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive tooltip="Home">
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
                <SidebarMenuButton asChild tooltip="Assisted apply">
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
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Resources</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip="Job details">
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
      <SidebarFooter className="flex flex-col gap-3 px-2 pb-3">
        <Button
          className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center"
          variant="outline"
        >
          <UserPlus className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sign up</span>
        </Button>
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="h-8 w-8 rounded-full bg-slate-800 text-slate-200 flex items-center justify-center text-xs font-semibold">
            N
          </div>
          <div className="text-xs text-slate-500 group-data-[collapsible=icon]:hidden">
            Save progress and credits.
          </div>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
