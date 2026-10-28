import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, X } from "lucide-react";

type Message = { text: string; confirm: boolean; resolve: (accepted: boolean) => void };

function requestMessage(text: string, confirm: boolean): Promise<boolean> {
  return new Promise((resolve) =>
    window.dispatchEvent(
      new CustomEvent<Message>("aerosoft-message", { detail: { text, confirm, resolve } }),
    ),
  );
}

export const confirmDialog = (text: string) => requestMessage(text, true);
export const showNotice = (text: string) => {
  void requestMessage(text, false);
};

export default function AppDialogs() {
  const [queue, setQueue] = useState<Message[]>([]);
  const active = queue[0];
  const surface = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const receive = (event: Event) =>
      setQueue((current) => [...current, (event as CustomEvent<Message>).detail]);
    window.addEventListener("aerosoft-message", receive);
    return () => window.removeEventListener("aerosoft-message", receive);
  }, []);
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    return () => previous?.focus();
  }, [active]);
  const finish = (accepted: boolean) => {
    active.resolve(accepted);
    setQueue((current) => current.slice(1));
  };
  if (!active) return null;
  return createPortal(
    <div className="backdrop message-backdrop" onMouseDown={() => finish(false)}>
      <div
        className="modal message-modal"
        ref={surface}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="message-title"
        aria-describedby="message-description"
        onMouseDown={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            finish(false);
          }
          if (event.key === "Tab") {
            const buttons = surface.current?.querySelectorAll<HTMLButtonElement>("button");
            if (!buttons?.length) return;
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <div className="popup-header">
          <button
            type="button"
            className="close"
            aria-label="Close message"
            onClick={() => finish(false)}
          >
            <X />
          </button>
          <span>{active.confirm ? "CONFIRM ACTION" : "CHECK YOUR DETAILS"}</span>
          <h2 id="message-title">{active.confirm ? "Delete this record?" : "Review required"}</h2>
        </div>
        <div className="popup-body">
          <div className="message-content">
            <AlertTriangle />
            <p id="message-description">{active.text}</p>
          </div>
        </div>
        <div className="popup-footer">
          <div className="actions">
            {active.confirm ? (
              <>
                <button type="button" ref={cancel} onClick={() => finish(false)}>
                  Cancel
                </button>
                <button type="button" className="danger" onClick={() => finish(true)}>
                  Delete record
                </button>
              </>
            ) : (
              <button type="button" className="primary" ref={cancel} onClick={() => finish(false)}>
                <Check /> Got it
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
