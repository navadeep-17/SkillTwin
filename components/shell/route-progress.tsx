"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [value, setValue] = useState(0);
  const timerRef = useRef<number | null>(null);
  const hideRef = useRef<number | null>(null);

  useEffect(() => {
    if (!visible) return;

    setValue(100);
    hideRef.current = window.setTimeout(() => {
      setVisible(false);
      setValue(0);
    }, 220);

    return () => {
      if (hideRef.current) window.clearTimeout(hideRef.current);
    };
  }, [pathname]);

  useEffect(() => {
    function start() {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (hideRef.current) window.clearTimeout(hideRef.current);

      setVisible(true);
      setValue(12);

      timerRef.current = window.setInterval(() => {
        setValue(current => {
          if (current >= 88) return current;
          const remaining = 88 - current;
          return Math.min(88, current + Math.max(2, remaining * 0.16));
        });
      }, 180);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }

      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      start();
    }

    function handlePopState() {
      start();
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);

    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (hideRef.current) window.clearTimeout(hideRef.current);
    };
  }, []);

  useEffect(() => {
    if (!visible && timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [visible]);

  return (
    <div
      className={"route-progress-track " + (visible ? "opacity-100" : "pointer-events-none opacity-0")}
      aria-hidden="true"
    >
      <div className="route-progress-bar" style={{ width: value + "%" }} />
    </div>
  );
}
