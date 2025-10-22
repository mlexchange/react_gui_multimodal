import { Accordion } from '@mantine/core';
// import { XPSProps } from './types';
import RealSpaceImagesAccordion from './RealSpaceImagesAccordion';
import NumberOfParticlesAccordion from './NumberOfParticlesAccordion';
import XPSSpectraAccordion from './XPSSpectraAccordion';
import XPSControlsPanel from './XPSControlsPanel';

export default function XPS() {
  return (
    <div className="flex h-full w-full bg-slate-200 overflow-hidden">
      {/* Fourth Column - XPS Controls */}
      {(
        <div className={`border border-gray-300 shadow-lg h-full relative transition-all duration-300 flex-shrink-0 w-[15%]`}
        >
          <XPSControlsPanel />
        </div>
      )}

      {/* Third Column - XPS Data Visualization */}
      <div
        className={`h-full border-r-2 border-gray-300 transition-all duration-300 flex-grow w-[30%]`}
      >
          <Accordion
            multiple
            defaultValue={['real-space-images-accordion', 'number-of-particles-accordion', 'xps-spectra-accordion']}
            chevronPosition="right"
            classNames={{ chevron: 'text-lg font-bold', label: 'text-lg font-bold' }}
          >
            <Accordion.Item value="real-space-images-accordion">
              <Accordion.Control>Real Space Images</Accordion.Control>
              <Accordion.Panel>
                <RealSpaceImagesAccordion />
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="number-of-particles-accordion">
              <Accordion.Control>Number of Particles</Accordion.Control>
              <Accordion.Panel>
                <NumberOfParticlesAccordion />
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="xps-spectra-accordion">
              <Accordion.Control>XPS Spectra</Accordion.Control>
              <Accordion.Panel>
                <XPSSpectraAccordion />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
      </div>

    </div>
  );
}
