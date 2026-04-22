import type { PropsWithChildren } from "react";
import styles from "./MetaPill.module.css";

export function MetaPill({ children }: PropsWithChildren) {
  return <div className={styles.pill}>{children}</div>;
}
