"use client";

import Link from "next/link";
import { Briefcase, Coins, Home, LineChart, ListChecks, UserPlus } from "lucide-react";

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
import { useCheckoutModalStore } from "@/lib/checkoutModalStore";
import { clearSessionAndStorage } from "@/lib/signOut";
import { useUserBaseStore } from "@/lib/userBaseStore";


export default function AppSidebar() {
  const wallet = useUserBaseStore((s) => s.userBase?.wallet);
  const totalCredits =
    (wallet?.subscription_credits ?? 0) + (wallet?.one_time_credits ?? 0);
  const openCheckout = useCheckoutModalStore((s) => s.openForCredits);

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
                  tooltip="Top picks"
                  className="text-slate-200 hover:bg-slate-800/60"
                >
                  <Link
                    href="/jobs"
                    className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      Top picks
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-400">Credits</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex items-center gap-2 px-2 py-1 text-slate-200 group-data-[collapsible=icon]:justify-center">
              <Coins className="h-4 w-4 shrink-0" />
              <span className="text-sm group-data-[collapsible=icon]:hidden">
                {totalCredits} credits
              </span>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="flex flex-col gap-2 bg-transparent px-2 pb-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 border-slate-700/60 text-slate-200 hover:bg-slate-800/60 group-data-[collapsible=icon]:justify-center"
          onClick={openCheckout}
        >
          <Coins className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Buy credits</span>
        </Button>
        <Button
          className="w-full justify-start gap-2 border-slate-700/60 text-slate-200 hover:bg-slate-800/60 group-data-[collapsible=icon]:justify-center"
          variant="outline"
          onClick={() => {
            clearSessionAndStorage();
            signOut({ callbackUrl: "/auth/signin" });
          }}
        >
          <UserPlus className="h-4 w-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
