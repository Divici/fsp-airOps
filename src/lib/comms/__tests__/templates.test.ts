import { describe, it, expect } from "vitest";
import {
  getTemplate,
  getTemplateForOperator,
  getDefaultTemplates,
  extractTemplateVariables,
  renderTemplate,
  listTemplateIds,
} from "../templates";
import type { OperatorTemplateOverrides } from "../templates";

describe("getTemplateForOperator", () => {
  it("returns custom template when operator has override", () => {
    const overrides: OperatorTemplateOverrides = {
      proposal_ready: {
        subject: "Custom subject",
        body: "Custom body for {{dispatcherName}}",
      },
    };

    const result = getTemplateForOperator("proposal_ready", overrides);

    expect(result).toBeDefined();
    expect(result!.subject).toBe("Custom subject");
    expect(result!.body).toBe("Custom body for {{dispatcherName}}");
    expect(result!.id).toBe("proposal_ready");
  });

  it("falls back to default template when operator has no override", () => {
    const overrides: OperatorTemplateOverrides = {
      proposal_ready: {
        subject: "Custom",
        body: "Custom body",
      },
    };

    const result = getTemplateForOperator("proposal_approved", overrides);
    const defaultTemplate = getTemplate("proposal_approved");

    expect(result).toBeDefined();
    expect(result!.body).toBe(defaultTemplate!.body);
    expect(result!.subject).toBe(defaultTemplate!.subject);
  });

  it("falls back to default when operatorTemplates is null", () => {
    const result = getTemplateForOperator("proposal_ready", null);
    const defaultTemplate = getTemplate("proposal_ready");

    expect(result).toBeDefined();
    expect(result!.body).toBe(defaultTemplate!.body);
  });

  it("returns undefined for unknown template name", () => {
    const result = getTemplateForOperator("nonexistent", null);
    expect(result).toBeUndefined();
  });

  it("returns undefined for unknown template with overrides present", () => {
    const overrides: OperatorTemplateOverrides = {
      proposal_ready: { subject: "Custom", body: "Custom" },
    };
    const result = getTemplateForOperator("nonexistent", overrides);
    expect(result).toBeUndefined();
  });
});

describe("renderTemplate with custom templates", () => {
  it("interpolates variables in custom template", () => {
    const overrides: OperatorTemplateOverrides = {
      proposal_ready: {
        subject: "Hey {{dispatcherName}}, check this out!",
        body: "A {{workflowType}} proposal is ready for {{studentName}}.",
      },
    };

    const template = getTemplateForOperator("proposal_ready", overrides);
    expect(template).toBeDefined();

    const rendered = renderTemplate(template!, {
      dispatcherName: "Jane",
      workflowType: "reschedule",
      studentName: "John",
    });

    expect(rendered.subject).toBe("Hey Jane, check this out!");
    expect(rendered.body).toBe(
      "A reschedule proposal is ready for John."
    );
  });

  it("leaves unknown variables as-is in custom templates", () => {
    const overrides: OperatorTemplateOverrides = {
      proposal_ready: {
        subject: "For {{dispatcherName}}",
        body: "Student: {{studentName}}, Extra: {{unknownVar}}",
      },
    };

    const template = getTemplateForOperator("proposal_ready", overrides);
    const rendered = renderTemplate(template!, {
      dispatcherName: "Jane",
      studentName: "John",
    });

    expect(rendered.body).toContain("{{unknownVar}}");
  });
});

describe("extractTemplateVariables", () => {
  it("extracts variables from subject and body", () => {
    const template = getTemplate("proposal_ready");
    expect(template).toBeDefined();

    const vars = extractTemplateVariables(template!);

    expect(vars).toContain("dispatcherName");
    expect(vars).toContain("workflowType");
    expect(vars).toContain("studentName");
    expect(vars).toContain("summary");
  });

  it("returns unique variables only", () => {
    const vars = extractTemplateVariables({
      id: "test",
      subject: "Hi {{name}}",
      body: "Hello {{name}}, this is {{name}} again.",
    });

    expect(vars).toEqual(["name"]);
  });

  it("returns empty array for template with no variables", () => {
    const vars = extractTemplateVariables({
      id: "test",
      body: "No variables here.",
    });

    expect(vars).toEqual([]);
  });
});

describe("getDefaultTemplates", () => {
  it("returns all templates", () => {
    const defaults = getDefaultTemplates();
    const ids = listTemplateIds();

    expect(Object.keys(defaults)).toEqual(ids);
    expect(ids.length).toBeGreaterThan(0);
  });

  it("returns copies (not references to internal state)", () => {
    const defaults1 = getDefaultTemplates();
    const defaults2 = getDefaultTemplates();

    expect(defaults1).not.toBe(defaults2);
    expect(defaults1).toEqual(defaults2);
  });
});

describe("fallback behavior with empty overrides", () => {
  it("handles empty overrides object", () => {
    const overrides: OperatorTemplateOverrides = {};
    const result = getTemplateForOperator("proposal_ready", overrides);
    const defaultTemplate = getTemplate("proposal_ready");

    expect(result).toBeDefined();
    expect(result!.body).toBe(defaultTemplate!.body);
  });
});
