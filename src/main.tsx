import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";
import { queryClient } from "./app/queryClient.js";
import { router } from "./app/router.js";
import { ExchangePreferencesProvider } from "./shared/exchanges/ExchangePreferencesProvider.js";
import "./app/styles/global.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ExchangePreferencesProvider>
        <RouterProvider router={router} />
      </ExchangePreferencesProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
