import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { TrafficProvider } from "./lib/TrafficContext";
import About from "./pages/About";
import Analytics from "./pages/Analytics";
import Overview from "./pages/Overview";
import Signals from "./pages/Signals";
import Simulation from "./pages/Simulation";
import VideoAnalysis from "./pages/VideoAnalysis";

export default function App() {
  return (
    <TrafficProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/video" element={<VideoAnalysis />} />
          <Route path="/simulation" element={<Simulation />} />
          <Route path="/signals" element={<Signals />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </TrafficProvider>
  );
}
