import { Link, useLocation } from "react-router-dom";
import StandalonePage from "./pages/StandalonePage";
import HubLayoutPage from "./pages/HubLayoutPage";

import "../index.css";

function App() {
  const location = useLocation();

  if (location.pathname.startsWith("/standalone")) {
    return <StandalonePage />;
  }

  if (location.pathname.startsWith("/hublayout")) {
    return <HubLayoutPage />;
  }

  // Home page with navigation to examples
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          @blueskyproject/multimodal-analysis
        </h1>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Standalone Example Card */}
          <Link
            to="/standalone"
            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold text-sky-700 mb-2">
              Standalone
            </h2>
            <p className="text-gray-600 mb-4">
              Full-screen Scattering component.
            </p>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
              {"<Scattering standalone={true} />"}
            </code>
          </Link>

          {/* HubAppLayout Example Card */}
          <Link
            to="/hublayout"
            className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h2 className="text-xl font-semibold text-sky-700 mb-2">
              HubAppLayout
            </h2>
            <p className="text-gray-600 mb-4">
              Scattering integrated with Finch HubAppLayout.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default App;
