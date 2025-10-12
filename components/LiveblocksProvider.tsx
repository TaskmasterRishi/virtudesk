'use client';

import { LiveblocksProvider } from "@liveblocks/react";

export function LiveblocksProviderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <LiveblocksProvider
      publicApiKey="pk_dev_7jLTwZ_Anxu4m_aF0laek8ntEJInXULGWAIxX_FDj93R4pVV1d0XFXz64Pp8iJHi"
    >
      {children}
    </LiveblocksProvider>
  );
}
