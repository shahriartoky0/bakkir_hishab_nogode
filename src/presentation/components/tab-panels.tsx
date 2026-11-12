"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

/** Client tabs around server-rendered panels. */
export function TabPanels({ tabs, defaultTab }: { tabs: { id: string; label: ReactNode; content: ReactNode }[]; defaultTab?: string }) {
  return (
    <Tabs defaultValue={defaultTab ?? tabs[0]?.id} className="gap-4">
      <TabsList className="h-11 w-full">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="h-9">
            {t.label}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => (
        <TabsContent key={t.id} value={t.id}>
          {t.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
