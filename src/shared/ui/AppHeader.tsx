import type { ReactNode } from "react";
import styles from "./AppHeader.module.css";

interface AppHeaderProps {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
}

export function AppHeader({ left, center, right }: AppHeaderProps) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {left ? <div className={styles.left}>{left}</div> : <div />}
        {center ? <div className={styles.center}>{center}</div> : null}
        {right ? <div className={styles.right}>{right}</div> : <div />}
      </div>
    </header>
  );
}
