"use client";

import { useState } from "react";
import { type DcLogicClass, type DcValues } from "./dc";

/** Logika artboardu se stavem (formuláře): stav drží React, renderVals se volá při každém renderu. */
export function useDc(
  Logic: DcLogicClass,
  props: Record<string, unknown> = {},
): DcValues {
  const [state, setState] = useState<Record<string, unknown>>({});
  const inst = new Logic();
  inst.props = props;
  inst.state = state;
  inst.setState = (update) => setState((s) => ({ ...s, ...update }));
  return inst.renderVals();
}
