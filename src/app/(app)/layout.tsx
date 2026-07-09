import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { Topbar } from "@/components/layout/Topbar";
import { ToastProvider } from "@/components/ui/ToastProvider";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <div className="flex h-screen w-full overflow-hidden bg-paper">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
