import { purchaseSteps, salesSteps, WorkflowGo } from "./workflow";
import "./workflow.css";

export default function WorkflowSteps({ page, go }: { page: string; go: WorkflowGo }) {
  const purchasing =
    purchaseSteps.some((step) => step.page === page) || page === "Purchasing Overview";
  const sales = page === "Dashboard" || salesSteps.some((step) => step.page === page);
  if (!purchasing && !sales) return null;
  const steps = purchasing ? purchaseSteps : salesSteps;
  return (
    <nav
      className="workflow-step-strip"
      aria-label={purchasing ? "Purchasing steps" : "Sales steps"}
    >
      {steps.map((step, index) => (
        <button
          key={step.page}
          className={page === step.page ? "current" : ""}
          aria-current={page === step.page ? "step" : undefined}
          onClick={() => go(step.page)}
        >
          <i>{index + 1}</i>
          <span>
            <b>
              {step.label}
              {"optional" in step && step.optional ? " (optional)" : ""}
            </b>
            <small>{step.detail}</small>
          </span>
        </button>
      ))}
    </nav>
  );
}
