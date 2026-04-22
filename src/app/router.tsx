import { createBrowserRouter } from "react-router-dom";
import { NotFoundPage } from "./NotFoundPage.js";
import { AssetDetailPage } from "../features/asset-detail/AssetDetailPage.js";
import { OverviewPage } from "../features/overview/OverviewPage.js";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <OverviewPage />
  },
  {
    path: "/assets/:base",
    element: <AssetDetailPage />
  },
  {
    path: "*",
    element: <NotFoundPage />
  }
]);
