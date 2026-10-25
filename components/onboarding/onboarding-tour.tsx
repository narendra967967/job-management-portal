"use client";

// Onboarding tour (Driver.js) for the signed-in app. Runs on the Leads page:
// on its own for a user who hasn't seen the current tour version yet, or when
// the URL has ?tour=1 ("Take the tour" in the sidebar / phone menu). Desktop
// and phone get different steps; a step whose element isn't on screen (no
// leads yet, view switch hidden…) is skipped. Finishing or skipping stores the
// version (actions/tour.ts), so it never nags.

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { useProfile } from "@/lib/mock-store";
import { markTourSeenAction } from "@/actions/tour";

const sel = (id: string) => `[data-tour="${id}"]`;

/** First visible match (the phone menu duplicates sidebar anchors while open). */
function visible(selector: string): Element | null {
  for (const el of document.querySelectorAll(selector)) {
    if (el.getClientRects().length > 0) return el;
  }
  return null;
}

function desktopSteps(firstName: string): DriveStep[] {
  return [
    {
      popover: {
        title: `Welcome to Jobtiva${firstName ? `, ${firstName}` : ""}`,
        description: "Here's a quick tour of the essentials. It takes about a minute.",
        nextBtnText: "Start tour",
        showButtons: ["next", "close"],
      },
    },
    {
      element: sel("nav-leads"),
      popover: {
        title: "Your leads",
        description: "Every job you're tracking lives here. New jobs from your job alerts land on this page.",
        side: "right",
      },
    },
    {
      element: sel("add-lead"),
      popover: {
        title: "Add a job",
        description: "Add a job by hand, or paste a job post or a screenshot and AI fills in the details for you.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: sel("status-tiles"),
      popover: {
        title: "Jobs by stage",
        description: "See how many jobs are at each stage. Click a tile to show only those jobs.",
        side: "bottom",
      },
    },
    {
      element: sel("view-toggle"),
      popover: {
        title: "List or board",
        description: "Work through a list, or switch to the board and drag jobs from one stage to the next.",
        side: "bottom",
        align: "end",
      },
    },
    {
      element: sel("lead-card"),
      popover: {
        title: "One card per job",
        description:
          "Change the status, set a reminder, add a contact or draft a message right from the card. Open it to read the full job description, the AI summary and your fit score.",
        side: "bottom",
      },
    },
    {
      element: sel("group-leads"),
      popover: {
        title: "Your pipeline",
        description:
          "Ready to action lists open jobs that have a description and a contact, so you can act on them. Outreached holds the jobs you've messaged someone about, and Archive keeps closed and old jobs.",
        side: "right",
      },
    },
    {
      element: sel("group-follow-up"),
      popover: {
        title: "Follow-ups",
        description: "To-do and Reminders keep track of what to do next, so no application goes quiet.",
        side: "right",
      },
    },
    {
      element: sel("group-network"),
      popover: {
        title: "Your network",
        description: "Contacts lists the recruiters and referrals you're talking to, and Outreach collects your messages.",
        side: "right",
      },
    },
    {
      element: sel("search"),
      popover: {
        title: "Search and notifications",
        description: "Find any job by company or title. Updates and reminders show up under the bell at the top right.",
        side: "bottom",
      },
    },
    {
      element: sel("nav-settings"),
      popover: {
        title: "Settings",
        description:
          "Set up email forwarding here so your job alerts arrive on their own. This is also where you add your AI key and AI prompts, your résumés and your career profile. Under Account you can reset your leads or delete your account.",
        side: "right",
        align: "end",
      },
    },
    {
      element: sel("help"),
      popover: {
        title: "Help when you need it",
        description: "How-to guides and support are always here, and Take the tour starts this walkthrough again whenever you like.",
        side: "right",
        align: "end",
      },
    },
    {
      popover: {
        title: "You're all set",
        description: "The most useful next step is setting up email forwarding, so new jobs start arriving on their own.",
        doneBtnText: "Done",
      },
    },
  ];
}

function mobileSteps(firstName: string): DriveStep[] {
  const all = desktopSteps(firstName);
  return [
    all[0],
    {
      element: sel("bottom-nav"),
      popover: {
        title: "Your main pages",
        description: "Leads, Ready to action, Outreached, To-do and Reminders are always one tap away.",
        side: "top",
      },
    },
    { element: sel("add-lead-fab"), popover: { ...all[2].popover, side: "left" } },
    { element: sel("lead-card"), popover: { ...all[5].popover, side: "bottom" } },
    {
      element: sel("menu"),
      popover: {
        title: "Everything else",
        description: "Open the menu for Contacts, Outreach, Settings, guides and support. Take the tour lives there too.",
        side: "bottom",
        align: "start",
      },
    },
    all[all.length - 1],
  ];
}

export function OnboardingTour({ autoStart }: { autoStart: boolean }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const { name } = useProfile();
  const running = useRef(false);
  const autoDone = useRef(!autoStart);

  const requested = params.get("tour") === "1";

  useEffect(() => {
    if (pathname !== "/leads" || running.current) return;
    if (!requested && autoDone.current) return;

    // Let the page paint (leads, tiles) before measuring.
    const t = setTimeout(() => {
      if (running.current) return;
      running.current = true;
      autoDone.current = true;
      if (requested) router.replace("/leads", { scroll: false });

      const firstName = (name || "").trim().split(/\s+/)[0] ?? "";
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const steps = (isDesktop ? desktopSteps(firstName) : mobileSteps(firstName))
        .filter((s) => !s.element || visible(s.element as string))
        .map((s) => (s.element ? { ...s, element: () => visible(s.element as string)! } : s));
      const last = steps.length - 1;

      const tour = driver({
        steps,
        animate: !reduceMotion,
        smoothScroll: !reduceMotion,
        showProgress: true,
        progressText: "{{current}} of {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Done",
        allowClose: true,
        overlayColor: "#1e1b4b",
        overlayOpacity: 0.55,
        stagePadding: 6,
        stageRadius: 12,
        popoverClass: "jobtiva-tour",
        onPopoverRender: (popover, { state }) => {
          // First step: a clear way out. Last step: jump to email forwarding.
          if (state.activeIndex === 0) {
            const skip = document.createElement("button");
            skip.type = "button";
            skip.textContent = "Skip";
            skip.className = "jobtiva-tour-skip";
            skip.addEventListener("click", () => tour.destroy());
            popover.footerButtons.prepend(skip);
          }
          if (state.activeIndex === last) {
            const cta = document.createElement("button");
            cta.type = "button";
            cta.textContent = "Set up email forwarding";
            cta.className = "jobtiva-tour-cta";
            cta.addEventListener("click", () => {
              tour.destroy();
              router.push("/settings?tab=forwarding");
            });
            popover.footerButtons.prepend(cta);
          }
        },
        onDestroyed: () => {
          running.current = false;
          // Finished, skipped or closed — don't start on its own again.
          void markTourSeenAction().catch(() => {});
        },
      });
      tour.drive();
    }, 600);
    return () => clearTimeout(t);
  }, [pathname, requested, router, name]);

  return null;
}
