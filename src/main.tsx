import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { StudioTheme } from "@moritzbrantner/ui/studio";

import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <StudioTheme className="contents">
      <App />
    </StudioTheme>
  </StrictMode>,
);
