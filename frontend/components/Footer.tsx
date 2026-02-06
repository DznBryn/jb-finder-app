import Link from "next/link";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu";

const VERSION = "1.0.0";
const LINKEDIN_URL = "https://www.linkedin.com/in/brian-demorcy/";

const footerLinkClass =
  "text-slate-400 hover:text-slate-200 transition-colors text-xs focus:outline-none focus:ring-0";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-transparent border-t border-slate-800/50 mt-auto">
      <div className="w-full max-w-7xl mx-auto px-4 md:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-x-4 gap-y-1">
          <span>v{VERSION}</span>
          <span className="text-slate-600">·</span>
          <a
            href={LINKEDIN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={footerLinkClass}
          >
            © {year}  Debybe & Co, Llc
          </a>
        </div>
        <NavigationMenu className="max-w-max flex-1 justify-end">
          <NavigationMenuList className="gap-4 h-auto flex-none bg-transparent p-0">
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/privacy" className={footerLinkClass}>
                  Privacy
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/terms" className={footerLinkClass}>
                  Terms
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink asChild>
                <Link href="/support" className={footerLinkClass}>
                  Support
                </Link>
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      </div>
    </footer>
  );
}
