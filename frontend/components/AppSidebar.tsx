"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Briefcase, Coins, FileText, Home, UserPlus } from "lucide-react";

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
import AccountSection from "./AccountSection";


export default function AppSidebar() {
  const pathname = usePathname();
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
                  isActive={pathname === "/"}
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
                  isActive={pathname === "/jobs"}
                  tooltip="Matches"
                  className="text-slate-200 hover:bg-slate-800/60"
                >
                  <Link
                    href="/jobs"
                    className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                  >
                    <Briefcase className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      Matches
                    </span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/resumes"}
                  tooltip="Resumes"
                  className="text-slate-200 hover:bg-slate-800/60"
                >
                  <Link
                    href="/resumes"
                    className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center"
                  >
                    <FileText className="h-4 w-4" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      Resumes
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
        <AccountSection />
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
