import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./styles.css";

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <div className="pop contents" data-ui-theme="pop">
      <App />
    </div>
  </StrictMode>,
);
