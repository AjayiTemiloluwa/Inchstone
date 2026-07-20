import { Sidebar } from "@/components/ui/Sidebar";
import { BottomNav } from "@/components/ui/BottomNav";
import { MobileMenu } from "@/components/ui/MobileMenu";
import { Topbar } from "@/components/ui/Topbar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { MobileMenuProvider } from "@/components/ui/MobileMenuContext";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <MobileMenuProvider>
      <ToastProvider>
        <div className="flex h-screen w-full overflow-hidden bg-paper">
          <Sidebar />
          <MobileMenu />
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Topbar />
            <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 pt-16 lg:pt-0">
              {children}
            </main>
          </div>
          <BottomNav />
        </div>
      </ToastProvider>
    </MobileMenuProvider>
  );
}
