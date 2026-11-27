"use client";

// INTERNAL MODEL TOGGLE: sticky strip with a segmented [Sonnet 5.5 | GPT-6.1-sol | Sonnet 5.5 + skills] switch. Temporary, see docs/astroroast/SPEC.md.
// Texts here are deliberately not part of UiCopy (they must not change with the model).

import { MODEL_TOGGLE_ENABLED } from "@/astroroast/copy";
import { MODEL_IDS, MODEL_LABELS } from "@/astroroast/types";
import { useModel } from "./ModelProvider";

export function ModelToggle() {
  const { model, setModel } = useModel();
  if (!MODEL_TOGGLE_ENABLED) return null;
  return (
    <div className="ar-modelbar">
      <div className="ar-wrap ar-modelbar-in" role="group" aria-label="Interní přepínač: kdo napsal texty">
        <span className="ar-modelbar-tag">interní</span>
        <span className="ar-modelbar-label">Texty píše:</span>
        <div className="ar-modelseg">
          {MODEL_IDS.map((id) => (
            <button
              key={id}
              type="button"
              className="ar-modelseg-btn"
              aria-pressed={model === id}
              title={MODEL_LABELS[id].detail}
              onClick={() => setModel(id)}
            >
              <span className="ar-modelseg-name">{MODEL_LABELS[id].name}</span>
              <span className="ar-modelseg-effort">{MODEL_LABELS[id].effort}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
