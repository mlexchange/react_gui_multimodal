import { useState, useEffect, ReactNode } from 'react';
import { NumberInput } from '@/components/ui';
import { Button } from '@blueskyproject/finch';
import { CrosshairSimpleIcon, GridFourIcon, AngleIcon } from '@phosphor-icons/react';

import { scatteringIcons } from './icons';

// Helper component for icon + label in calibration rows
interface IconLabelProps {
    icon: ReactNode;
    label: string;
}

const IconLabel: React.FC<IconLabelProps> = ({ icon, label }) => (
    <div className="flex flex-col items-center w-28 flex-shrink-0 pt-1">
        {icon}
        <span className="text-sm text-slate-800 text-center mt-1">{label}</span>
    </div>
);

interface CalibrationParams {
    sample_detector_distance: number;  // Distance in millimeters
    beam_center_x: number;            // X-coordinate in pixels
    beam_center_y: number;            // Y-coordinate in pixels
    pixel_size_x: number;             // Size in micrometers
    pixel_size_y: number;             // Size in micrometers
    wavelength: number;               // Wavelength in Angstroms
    tilt: number;                     // Detector tilt in degrees
    tilt_plan_rotation: number;       // Tilt plane rotation in degrees
}

interface CalibrationAccordionProps {
    calibrationParams: CalibrationParams;
    onCalibrationUpdate: (params: CalibrationParams) => void;
}

// Constants for energy-wavelength conversion
// E (eV) = hc / λ (Å) where hc = 12398.419 eV·Å
const HC_CONSTANT = 12398.419;

// Convert wavelength (Angstrom) to energy (eV)
const wavelengthToEnergy = (wavelength: number): number => {
    if (wavelength <= 0) return 0;
    return HC_CONSTANT / wavelength;
};

// Convert energy (eV) to wavelength (Angstrom)
const energyToWavelength = (energy: number): number => {
    if (energy <= 0) return 0;
    return HC_CONSTANT / energy;
};

export default function CalibrationAccordion({
    calibrationParams,
    onCalibrationUpdate,
}: CalibrationAccordionProps) {
    const [isModified, setIsModified] = useState(false);
    const [localParams, setLocalParams] = useState(calibrationParams);
    const [energy, setEnergy] = useState(() => wavelengthToEnergy(calibrationParams.wavelength));

    useEffect(() => {
        setLocalParams(calibrationParams);
        setEnergy(wavelengthToEnergy(calibrationParams.wavelength));
        setIsModified(false);
    }, [calibrationParams]);

    // Handler for general parameter changes
    const handleParamChange = (paramName: keyof CalibrationParams) => (value: string | number) => {
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;

        if (!isNaN(numericValue)) {
            setLocalParams(prev => ({
                ...prev,
                [paramName]: numericValue
            }));
            setIsModified(true);
        }
    };

    // Handler for wavelength change - also updates energy
    const handleWavelengthChange = (value: string | number) => {
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;

        if (!isNaN(numericValue)) {
            setLocalParams(prev => ({
                ...prev,
                wavelength: numericValue
            }));
            setEnergy(wavelengthToEnergy(numericValue));
            setIsModified(true);
        }
    };

    // Handler for energy change - also updates wavelength
    const handleEnergyChange = (value: string | number) => {
        const numericValue = typeof value === 'string' ? parseFloat(value) : value;

        if (!isNaN(numericValue)) {
            setEnergy(numericValue);
            const newWavelength = energyToWavelength(numericValue);
            setLocalParams(prev => ({
                ...prev,
                wavelength: newWavelength
            }));
            setIsModified(true);
        }
    };

    const handleSubmit = () => {
        const isValid = Object.values(localParams).every(value =>
            typeof value === 'number' && !isNaN(value)
        );

        if (isValid) {
            onCalibrationUpdate(localParams);
            setIsModified(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Load Calibration Button */}
            <Button
                size="medium"
                styles="w-full"
                text="Load Calibration"
            />

            {/* Row 1: Sample-to-detector distance */}
            <div className="flex items-center gap-4">
                <IconLabel
                    icon={<div className="w-8 h-8">{scatteringIcons.sampleDetectorDistance}</div>}
                    label="SDD"
                />
                <div className="flex-1">
                    <NumberInput
                        label="Sample-to-detector distance (mm)"
                        value={localParams.sample_detector_distance}
                        onChange={handleParamChange('sample_detector_distance')}
                        decimalScale={2}
                        step={0.1}
                        min={0}
                        size="sm"
                    />
                </div>
            </div>

            {/* Row 2: Wavelength + Energy */}
            <div className="flex items-center gap-4">
                <IconLabel
                    icon={<div className="w-14 h-8">{scatteringIcons.monochromator}</div>}
                    label="Monochromator"
                />
                <div className="flex-1 flex gap-2">
                    <NumberInput
                        label="Wavelength (Å)"
                        value={localParams.wavelength}
                        onChange={handleWavelengthChange}
                        decimalScale={4}
                        step={0.0001}
                        min={0}
                        size="sm"
                        className="flex-1"
                    />
                    <NumberInput
                        label="Energy (eV)"
                        value={energy}
                        onChange={handleEnergyChange}
                        decimalScale={2}
                        step={1}
                        min={0}
                        size="sm"
                        className="flex-1"
                    />
                </div>
            </div>

            {/* Row 3: Beam center X + Y */}
            <div className="flex items-center gap-4">
                <IconLabel
                    icon={<CrosshairSimpleIcon size={32} />}
                    label="Beam center"
                />
                <div className="flex-1 flex gap-2">
                    <NumberInput
                        label="X (px)"
                        value={localParams.beam_center_x}
                        onChange={handleParamChange('beam_center_x')}
                        decimalScale={2}
                        step={0.1}
                        size="sm"
                        className="flex-1"
                    />
                    <NumberInput
                        label="Y (px)"
                        value={localParams.beam_center_y}
                        onChange={handleParamChange('beam_center_y')}
                        decimalScale={2}
                        step={0.1}
                        size="sm"
                        className="flex-1"
                    />
                </div>
            </div>

            {/* Row 4: Pixel size X + Y */}
            <div className="flex items-center gap-4">
                <IconLabel
                    icon={<GridFourIcon size={30} />}
                    label="Pixel size"
                />
                <div className="flex-1 flex gap-2">
                    <NumberInput
                        label="X (μm)"
                        value={localParams.pixel_size_x}
                        onChange={handleParamChange('pixel_size_x')}
                        decimalScale={2}
                        step={1}
                        min={0}
                        size="sm"
                        className="flex-1"
                    />
                    <NumberInput
                        label="Y (μm)"
                        value={localParams.pixel_size_y}
                        onChange={handleParamChange('pixel_size_y')}
                        decimalScale={2}
                        step={1}
                        min={0}
                        size="sm"
                        className="flex-1"
                    />
                </div>
            </div>

            {/* Row 5: Tilt + Plane rotation */}
            <div className="flex items-center gap-4">
                <IconLabel
                    icon={<AngleIcon size={30} />}
                    label="Detector tilt"
                />
                <div className="flex-1 flex gap-2">
                    <NumberInput
                        label="Tilt (°)"
                        value={localParams.tilt}
                        onChange={handleParamChange('tilt')}
                        decimalScale={2}
                        step={0.1}
                        size="sm"
                        className="flex-1"
                    />
                    <NumberInput
                        label="Plane rotation (°)"
                        value={localParams.tilt_plan_rotation}
                        onChange={handleParamChange('tilt_plan_rotation')}
                        decimalScale={2}
                        step={0.1}
                        size="sm"
                        className="flex-1"
                    />
                </div>
            </div>

            {/* Update Button */}
            <Button
                size="medium"
                styles="w-full"
                bgColor={isModified ? "bg-sky-500" : "bg-gray-400"}
                cb={handleSubmit}
                disabled={!isModified}
                text="Update Calibration"
            />
        </div>
    );
}
