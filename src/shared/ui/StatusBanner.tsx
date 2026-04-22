import type { PropsWithChildren } from "react";
import styles from "./StatusBanner.module.css";

interface StatusBannerProps extends PropsWithChildren {
  tone?: "neutral" | "error";
}

export function StatusBanner({ children, tone = "neutral" }: StatusBannerProps) {
  return (
    <div className={tone === "error" ? `${styles.banner} ${styles.error}` : styles.banner}>
      {children}
    </div>
  );
}
