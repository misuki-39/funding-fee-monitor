import { fetchAssetDetailRows } from "../exchanges/assetDetail.js";

export function fetchAssetDetails(base: string) {
  return fetchAssetDetailRows(base);
}
