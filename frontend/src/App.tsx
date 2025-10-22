import { useState } from 'react';
import { MantineProvider, Container } from '@mantine/core';
import { FiArrowRight, FiArrowLeft } from 'react-icons/fi';
import '@mantine/core/styles.css';
import './index.css';
import alsLogo from '/src/assets/cropped-favicon-270x270.png';
import { Scattering } from './components/Scattering';
import { XPS } from './components/XPS';


function App() {
  const [isSecondCollapsed, setSecondCollapsed] = useState(false);
  const [isThirdCollapsed] = useState(true);

  return (
    <MantineProvider>
      {/* Title Bar */}
      <div className="flex items-center justify-center p-5 w-full h-[50px] shadow-md relative">
        {/* Icon */}
        <img
          src={alsLogo}
          alt="ALS Icon"
          className="h-10 mr-4"
        />
        {/* Title */}
        <h1 className="m-0 text-2xl text-sky-900">
          Multimodal Analysis
        </h1>
        {/* Left collapsing arrow */}
        <div
              className="absolute top-[50px] -left-0 flex items-center justify-center bg-gray-200 rounded-full w-10 h-10 cursor-pointer shadow-md z-[1000]"
              onClick={() => {
                setSecondCollapsed(!isSecondCollapsed);
              }}
            >
              {isSecondCollapsed ? <FiArrowRight size={20} /> : <FiArrowLeft size={20} />}
        </div>
      </div>

      {/* Main Layout */}
      <Container
        fluid
        style={{
          display: 'flex',
          height: 'calc(100vh - 50px)',
          width: '100%',
          padding: 0,
        }}
      >
        {/* Scattering Module (Columns 1 & 2) */}
        <Scattering
          isCollapsed={isSecondCollapsed}
          isThirdCollapsed={isThirdCollapsed}
        />

        {/* XPS Module (Columns 3 & 4) */}
        <XPS
          isCollapsed={isThirdCollapsed}
          isSecondCollapsed={isSecondCollapsed}
        />
      </Container>
    </MantineProvider>
  );
}

export default App;
