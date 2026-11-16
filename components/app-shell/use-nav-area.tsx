"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { areaForPath, type NavArea } from "@/lib/nav-area";
import { useLimitedMode } from "@/lib/access-mode";

// Which main menu (Lead management or Mock interviews) the app is showing.
// A page inside an area decides it; a shared page (Settings, Help…) keeps the
// last area the user was in, remembered per browser. Storage is a convenience:
// if it's blocked, shared pages simply fall back to Lead management.

const KEY = "jobtiva.nav.area";

function load(): NavArea {
  try {
    return localStorage.getItem(KEY) === "mock" ? "mock" : "leads";
  } catch {
    return "leads";
  }
}

function save(area: NavArea) {
  try {
    localStorage.setItem(KEY, area);
  } catch {
    /* storage blocked: nothing to remember */
  }
}

export function useNavArea(): NavArea {
  const pathname = usePathname();
  const limited = useLimitedMode();
  // With the plan ended, every lead page redirects to Upgrade Plan, so that page
  // stands in for Lead management (its menus show, locked).
  const direct =
    areaForPath(pathname) ?? (limited && (pathname === "/upgrade" || pathname.startsWith("/upgrade/")) ? "leads" : null);
  const [remembered, setRemembered] = useState<NavArea>("leads");
  useEffect(() => {
    if (direct) save(direct);
    else setRemembered(load());
  }, [direct]);
  return direct ?? remembered;
}

/** Renders its children only while Lead management is the open area (the add-lead
 *  button, lead search and lead stats make no sense inside Mock interviews). */
export function LeadAreaOnly({ children }: { children: React.ReactNode }) {
  return useNavArea() === "leads" ? <>{children}</> : null;
}
