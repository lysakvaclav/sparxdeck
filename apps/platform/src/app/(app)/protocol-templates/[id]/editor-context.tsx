"use client";

import { createContext, useContext } from "react";

// What the property panels of the template editor need beyond the template
// itself (part 22, stage C): the company's device types (for a block shown
// only for one of them) and the template's own logo (upload, preview).

export type EditorEnvironment = {
  templateId: string;
  deviceTypes: string[];
  /** Short-lived links to show uploaded logos, by their path. */
  logoUrls: Record<string, string>;
  addLogoUrl: (path: string, url: string) => void;
};

export const EditorEnvironmentContext = createContext<EditorEnvironment>({
  templateId: "",
  deviceTypes: [],
  logoUrls: {},
  addLogoUrl: () => {},
});

export const useEditorEnvironment = () => useContext(EditorEnvironmentContext);
