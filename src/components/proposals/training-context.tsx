"use client";

import {
  GraduationCap,
  BookOpen,
  User,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import type { TrainingContextData } from "@/lib/types/proposal-detail";

function ProgressBar({
  completed,
  total,
}: {
  completed: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-medium text-muted-foreground">
        {completed}/{total}
      </span>
    </div>
  );
}

interface TrainingContextProps {
  data: TrainingContextData;
  className?: string;
}

export function TrainingContext({ data, className }: TrainingContextProps) {
  const sameInstructor =
    data.instructorName &&
    data.previousInstructorName &&
    data.instructorName === data.previousInstructorName;

  return (
    <Card size="sm" className={cn("bg-muted/30", className)}>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="size-4 text-primary" />
          <h3 className="text-sm font-semibold">Training Progression</h3>
        </div>

        <div className="grid gap-2 text-xs sm:grid-cols-2">
          {/* Enrollment */}
          {data.enrollmentName && (
            <div className="flex items-start gap-1.5">
              <BookOpen className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium text-muted-foreground">Enrollment</p>
                <p className="text-foreground">{data.enrollmentName}</p>
              </div>
            </div>
          )}

          {/* Current stage */}
          {data.currentStage && (
            <div className="flex items-start gap-1.5">
              <CheckCircle className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium text-muted-foreground">
                  Current Stage
                </p>
                <p className="text-foreground">{data.currentStage}</p>
              </div>
            </div>
          )}

          {/* Next lesson */}
          {data.nextLessonName && (
            <div className="flex items-start gap-1.5">
              <ArrowRight className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium text-muted-foreground">
                  Next Lesson
                </p>
                <p className="text-foreground">{data.nextLessonName}</p>
              </div>
            </div>
          )}

          {/* Instructor continuity */}
          {data.instructorName && (
            <div className="flex items-start gap-1.5">
              <User className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium text-muted-foreground">Instructor</p>
                <p className="text-foreground">
                  {data.instructorName}
                  {data.previousInstructorName && (
                    <span
                      className={cn(
                        "ml-1.5 text-xs",
                        sameInstructor
                          ? "text-green-600 dark:text-green-400"
                          : "text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {sameInstructor
                        ? "(same instructor)"
                        : `(was ${data.previousInstructorName})`}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {data.completedLessons != null && data.totalLessons != null && (
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Lesson Progress
            </p>
            <ProgressBar
              completed={data.completedLessons}
              total={data.totalLessons}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
