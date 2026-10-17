import { createContext, useContext } from "react";
import type { GoalyDraft } from "./goaly";

export const EMPTY_GOALY_DRAFT: GoalyDraft = {
  title: "",
  successRule: "",
  proofSource: "",
  stake: "5.00",
  deadline: "",
  visibility: "public",
};

export type GoalyBuilderContextValue = {
  draft: GoalyDraft;
  setDraft: (draft: GoalyDraft) => void;
};

export const GoalyBuilderContext = createContext<GoalyBuilderContextValue>({
  draft: EMPTY_GOALY_DRAFT,
  setDraft: () => {},
});

export function useGoalyBuilderDraft() {
  return useContext(GoalyBuilderContext);
}
