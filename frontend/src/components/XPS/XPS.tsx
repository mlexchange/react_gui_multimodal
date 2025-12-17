import RealSpaceImagesAccordion from './RealSpaceImagesAccordion';
import NumberOfParticlesAccordion from './NumberOfParticlesAccordion';
import XPSSpectraAccordion from './XPSSpectraAccordion';
import XPSControlsPanel from './XPSControlsPanel';

export default function XPS() {
  return (
    <div className="flex h-full w-full bg-slate-200 overflow-hidden">
      {/* Fourth Column - XPS Controls */}
      <div className="border border-gray-300 shadow-lg h-full relative transition-all duration-300 flex-shrink-0 w-[15%]">
        <XPSControlsPanel />
      </div>

      {/* Third Column - XPS Data Visualization */}
      <div className="h-full border-r-2 border-gray-300 transition-all duration-300 flex-grow w-[30%] overflow-y-auto">
        <div className="p-4 space-y-4">
          <section>
            <h2 className="text-lg font-bold mb-2">Real Space Images</h2>
            <RealSpaceImagesAccordion />
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">Number of Particles</h2>
            <NumberOfParticlesAccordion />
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">XPS Spectra</h2>
            <XPSSpectraAccordion />
          </section>
        </div>
      </div>
    </div>
  );
}
