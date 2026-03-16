// ---------------------------------------------------------------------------
// MilestoneDetector — Detects students nearing checkride readiness
// ---------------------------------------------------------------------------

import type { IFspClient } from "@/lib/fsp-client/types";

export interface MilestoneStudent {
  studentId: string;
  studentName: string;
  enrollmentId: string;
  currentStage: string;
  completedLessons: number;
  totalLessons: number;
  percentComplete: number;
  isCheckrideReady: boolean;
}

/**
 * Milestone detection threshold: students at or above this percentage
 * of completed lessons are considered near a milestone.
 */
const MILESTONE_THRESHOLD = 0.8;

/**
 * Checkride readiness threshold: students at or above this percentage
 * are flagged as checkride-ready.
 */
const CHECKRIDE_THRESHOLD = 0.9;

export class MilestoneDetector {
  constructor(private fspClient: IFspClient) {}

  /**
   * Detect students who are >= 80% through their current training stage.
   *
   * For each active student with an active enrollment:
   * 1. Fetch enrollments
   * 2. Fetch enrollment progress
   * 3. Compute percent complete
   * 4. Flag if >= 80% (milestone) and mark checkride-ready if >= 90% or on final lesson
   */
  async detectMilestoneStudents(
    operatorId: number,
  ): Promise<MilestoneStudent[]> {
    // 1. Get all active students
    const users = await this.fspClient.getUsers(operatorId);
    const students = users.filter((u) => u.role === "Student" && u.isActive);

    const milestoneStudents: MilestoneStudent[] = [];

    for (const student of students) {
      // 2. Get enrollments for each student
      const enrollments = await this.fspClient.getEnrollments(
        operatorId,
        student.id,
      );

      const activeEnrollments = enrollments.filter(
        (e) => e.status === "Active" || e.status === "active",
      );

      for (const enrollment of activeEnrollments) {
        // 3. Get progress for this enrollment
        let progress;
        try {
          progress = await this.fspClient.getEnrollmentProgress(
            operatorId,
            enrollment.enrollmentId,
          );
        } catch {
          // Enrollment progress not found — skip
          continue;
        }

        if (progress.totalLessons === 0) continue;

        // 4. Compute percent complete
        const percentComplete =
          progress.completedLessons / progress.totalLessons;

        // 5. Check milestone threshold
        if (percentComplete >= MILESTONE_THRESHOLD) {
          const remainingLessons =
            progress.totalLessons - progress.completedLessons;
          const isCheckrideReady =
            percentComplete >= CHECKRIDE_THRESHOLD || remainingLessons <= 1;

          milestoneStudents.push({
            studentId: student.id,
            studentName: student.fullName,
            enrollmentId: enrollment.enrollmentId,
            currentStage: enrollment.courseName,
            completedLessons: progress.completedLessons,
            totalLessons: progress.totalLessons,
            percentComplete: Math.round(percentComplete * 100) / 100,
            isCheckrideReady,
          });
        }
      }
    }

    return milestoneStudents;
  }
}
