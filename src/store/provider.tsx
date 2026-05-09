"use client";

import { Provider } from "react-redux";
import { Toaster } from "@/components/ui/toaster";
import { store } from "./store";

export default function StoreProvider({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      {children}
      <Toaster />
    </Provider>
  );
}
