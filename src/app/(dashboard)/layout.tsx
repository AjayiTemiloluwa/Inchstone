'use client'

import { Sidebar } from "@/components/ui/Sidebar";
import { BottomNav } from "@/components/ui/BottomNav";
import { Topbar } from "@/components/ui/Topbar";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { SmoothScroll } from "@/components/ui/SmoothScroll";
import { RouteProgress } from "@/components/ui/RouteProgress";
import { CommandPalette } from "@/components/ui/CommandPalette";
import { ScrollFx } from "@/components/ui/ScrollFx";
import { TouchFx } from "@/components/ui/TouchFx";
import { FluidPress } from "@/components/ui/FluidPress";
import { PageTransition } from "@/components/ui/PageTransition";
import { AlarmRinger } from "@/components/ui/AlarmRinger";
import { AtmosphereProvider } from "@/components/effects/atmosphere";
import { AmbientBackground } from "@/components/effects/AmbientBackground";
import { ScrollText } from "@/components/effects/ScrollText";
import { GLProvider } from "@/components/gl/GLProvider";

export default function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ToastProvider>
      <AtmosphereProvider>
        <SmoothScroll />
        <RouteProgress />
        <CommandPalette />
        <ScrollFx />
        <TouchFx />
        <FluidPress />
        <AlarmRinger />
        <ScrollText />
        <GLProvider>
        <div className="app-shell relative flex h-screen w-full overflow-hidden">
          {/* Backdrop: living sky → dimming veil → app UI (back to front) */}
          <AmbientBackground />
          <div className="app-overlay" aria-hidden="true" />
          <div className="relative z-[2] flex h-full w-full min-w-0">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden main-content-wrapper">
              <Topbar />
              <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8 pt-16 lg:pt-8">
                <PageTransition>
                  <div data-scroll-content>{children}</div>
                </PageTransition>
              </main>
            </div>
            <BottomNav />
          </div>
        </div>
        </GLProvider>
      </AtmosphereProvider>
    </ToastProvider>
  );
}