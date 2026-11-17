import { Bot, History, TrendingUp, UserRound, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// A Mock interviews page that isn't open yet. Admin's Open / Coming soon
// switches (docs/interview-prep/spec.md, section 4) arrive in R1.3/R1.4; until
// then every Mock interviews page shows this.

export function ComingSoon({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      <div className="rounded-xl border bg-card p-6 text-center sm:p-10">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-6" aria-hidden />
        </span>
        <Badge variant="secondary" className="mt-4">
          Coming soon
        </Badge>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

// The Coming soon text of each Mock interviews page (shown in production until
// the module opens).

export function AiComingSoon() {
  return (
    <ComingSoon title="AI mock interviews" icon={Bot}>
      Pick the role you&apos;re going for, add your resume and the job description, and practice with an interviewer that
      asks the questions that role gets, with follow-ups when an answer is thin. You finish with a scored report
      showing what went well and what to work on.
    </ComingSoon>
  );
}

export function HumanComingSoon() {
  return (
    <ComingSoon title="Human interviews" icon={UserRound}>
      Book a mock interview with someone who has done the job you want. Choose an interviewer by role, experience and
      price, meet on a video call, and get the same kind of scored report afterwards.
    </ComingSoon>
  );
}

export function HistoryComingSoon() {
  return (
    <ComingSoon title="Interview history" icon={History}>
      Every mock interview you finish, with the AI interviewer or with a person, will be listed here with its report.
    </ComingSoon>
  );
}

export function PerformanceComingSoon() {
  return (
    <ComingSoon title="Performance" icon={TrendingUp}>
      Your scores from every mock interview in one place, so you can see which skills are getting stronger and which
      still need work.
    </ComingSoon>
  );
}
