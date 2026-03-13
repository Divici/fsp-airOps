---
name: tdd-workflow
description: Test-Driven Development workflow for FSP Agentic Scheduler. Use when writing tests, implementing features with TDD, or when asked about test-first development, red-green-refactor, or testing patterns.
---

# TDD Workflow

Note: Strict TDD (mandatory failing test before every implementation) is relaxed for this project. Write tests when they add value. The patterns below are available when you choose to use TDD.

## Red-Green-Refactor Cycle

### 1. RED -- Write a Failing Test
- Understand the requirement
- Write a test that describes the expected behavior
- Run `pnpm test` -- confirm it FAILS

### 2. GREEN -- Make It Pass
- Write the MINIMUM code to make the test pass
- No extra features, no "while I'm here" changes
- Run `pnpm test` -- confirm it PASSES

### 3. REFACTOR -- Improve the Code
- Clean up the implementation
- Remove duplication, improve naming
- Run `pnpm test` -- confirm tests still PASS

## Test Quality Rules

**Good tests:**
- Test behavior, not implementation
- One assertion per test (when practical)
- Descriptive names: `it('should [behavior] when [condition]')`
- Independent -- no shared mutable state between tests
- Fast -- mock external dependencies (FSP API calls, database)

## Test Structure (Arrange-Act-Assert)

```typescript
import { describe, it, expect } from 'vitest';

describe('ProposalGenerator', () => {
  it('should generate reschedule proposals for cancelled reservation', () => {
    // Arrange
    const cancellation = createMockCancellation({ studentId: 'student-1' });
    const availableSlots = [createMockSlot({ start: '2025-10-15T14:00' })];

    // Act
    const proposals = generateRescheduleProposals(cancellation, availableSlots);

    // Assert
    expect(proposals).toHaveLength(1);
    expect(proposals[0].studentId).toBe('student-1');
  });
});
```

## When to Mock

**DO mock:** FSP API calls, database queries, SMS/email services, AI provider calls
**DON'T mock:** The code you're testing, simple utility functions, type transformations

## FSP Client Testing Pattern

```typescript
import { createMockFspClient } from '@/lib/fsp-client/mock';

const fspClient = createMockFspClient({
  findAvailableSlots: async () => [mockSlot1, mockSlot2],
  validateReservation: async () => ({ errors: [] }),
});
```
