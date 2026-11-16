import { BrowserRouter, Route, Routes } from "react-router-dom";
import ScreensReference from "./screens-reference";

// Routes
// Admin pages go in src/pages: Login, Applications, ApplicationReview, Cases, CaseDetail, Members.
// Until a page is built, the Figma reference is shown so the whole design can be clicked through.
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/*" element={<ScreensReference />} />
      </Routes>
    </BrowserRouter>
  );
}
