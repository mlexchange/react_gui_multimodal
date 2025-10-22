import { Accordion } from '@mantine/core';
import { XPSProps } from './types';
import RealSpaceImagesAccordion from './RealSpaceImagesAccordion';
import NumberOfParticlesAccordion from './NumberOfParticlesAccordion';
import XPSSpectraAccordion from './XPSSpectraAccordion';
import XPSControlsPanel from './XPSControlsPanel';

export default function XPS({ isCollapsed, isSecondCollapsed }: XPSProps) {
  return (
    <>
      {/* Third Column - XPS Data Visualization */}
      <div
        className={`h-full border-r-2 border-gray-300 transition-all duration-300
          ${isCollapsed
            ? 'flex-grow-0 w-0 overflow-hidden'
            : isSecondCollapsed
            ? 'flex-grow w-[80%]'
            : 'flex-grow w-[30%]'
          }`}
      >
        {!isCollapsed && (
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
        )}
      </div>

      {/* Fourth Column - XPS Controls */}
      {!isCollapsed && (
        <div className={`border border-gray-300 shadow-lg h-full bg-gray-100 relative transition-all duration-300 flex-shrink-0
          ${isCollapsed ? 'w-0' : 'w-[15%]'}`}
        >
          <XPSControlsPanel />
        </div>
      )}
    </>
  );
}
