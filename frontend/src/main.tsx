import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import AppDialogs from "./AppDialogs";
import "./styles.css";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
    <AppDialogs />
  </React.StrictMode>,
);
